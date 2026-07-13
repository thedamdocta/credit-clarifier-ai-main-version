import { useState, useCallback, useRef } from 'react';
import { PipelineExecutor } from '../core/engine';
import { nodeRegistry } from '../core/registry';
import { usePipelineStore } from '../store/pipelineStore';
import { ExecutionContext } from '../core/types';

export function usePipelineExecution() {
  const {
    nodes,
    edges,
    setExecuting,
    setExecutionResult,
    setExecutionLog,
    updateNodeStatus,
  } = usePipelineStore();

  const [progress, setProgress] = useState<Map<string, { progress: number; message: string }>>(
    new Map()
  );
  const abortControllerRef = useRef<AbortController | null>(null);

  const executePipeline = useCallback(async () => {
    // Reset state
    setProgress(new Map());
    setExecutionResult(null);
    setExecutionLog([]);

    // Reset all node statuses
    nodes.forEach((node) => {
      updateNodeStatus(node.id, 'idle');
    });

    // Create abort controller
    abortControllerRef.current = new AbortController();

    // Create executor
    const executor = new PipelineExecutor(nodes, edges, nodeRegistry);

    // Create execution context
    const context: ExecutionContext = {
      reportId: `exec_${Date.now()}`,
      abortSignal: abortControllerRef.current.signal,
      onProgress: (nodeId, progress, message) => {
        setProgress((prev) => new Map(prev).set(nodeId, { progress, message }));
      },
      cache: new Map(),
    };

    setExecuting(true);

    try {
      const result = await executor.execute(context);
      setExecutionResult(result);
      setExecutionLog(executor.getExecutionLog());
      return result;
    } catch (error: any) {
      const errorResult = {
        success: false,
        results: {},
        error: error.message,
      };
      setExecutionResult(errorResult);
      setExecutionLog(executor.getExecutionLog());
      throw error;
    } finally {
      setExecuting(false);
      abortControllerRef.current = null;
    }
  }, [nodes, edges, setExecuting, setExecutionResult, setExecutionLog, updateNodeStatus]);

  const abortExecution = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setExecuting(false);
    }
  }, [setExecuting]);

  return {
    executePipeline,
    abortExecution,
    progress,
  };
}
