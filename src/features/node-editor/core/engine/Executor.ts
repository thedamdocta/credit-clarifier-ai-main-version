import {
  PipelineNode,
  PipelineEdge,
  ExecutionContext,
  ExecutionResult,
  ValidationResult,
  DataType,
  NodeStatus,
  ExecutionLogEntry,
} from '../types';
import { NodeRegistry } from '../registry';

/**
 * Pipeline executor - runs node graphs
 * Handles validation, topological sorting, and execution orchestration
 */
export class PipelineExecutor {
  private executionLog: ExecutionLogEntry[] = [];

  constructor(
    private nodes: PipelineNode[],
    private edges: PipelineEdge[],
    private registry: NodeRegistry
  ) {}

  /**
   * Execute the pipeline
   */
  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const startTime = Date.now();
    this.executionLog = [];

    try {
      // 1. Validate graph structure
      const validation = this.validateGraph();
      if (!validation.valid) {
        throw new Error(`Invalid graph: ${validation.errors.join(', ')}`);
      }

      // 2. Topological sort to determine execution order
      const executionOrder = this.topologicalSort();
      if (!executionOrder) {
        throw new Error('Graph contains cycles or is invalid');
      }

      // 3. Execute nodes in order
      const results = new Map<string, any>();

      for (const nodeId of executionOrder) {
        if (context.abortSignal.aborted) {
          throw new Error('Execution aborted');
        }

        const node = this.nodes.find((n) => n.id === nodeId);
        if (!node) {
          throw new Error(`Node ${nodeId} not found`);
        }

        const executor = this.registry.getExecutor(node.data.type);

        // Gather inputs from previous nodes
        const inputs = this.gatherInputs(nodeId, results);

        // Execute node
        const logEntry: ExecutionLogEntry = {
          nodeId: node.id,
          nodeLabel: node.data.label,
          status: 'running',
          timestamp: Date.now(),
          inputs,
        };

        try {
          node.data.status = 'running';
          const nodeStartTime = Date.now();

          const output = await executor.execute(inputs, node.data.config, context);

          const duration = Date.now() - nodeStartTime;
          results.set(nodeId, output);
          node.data.status = 'success';
          node.data.result = output;

          logEntry.status = 'success';
          logEntry.duration = duration;
          logEntry.outputs = output;
        } catch (error: any) {
          node.data.status = 'error';
          node.data.error = error.message;

          logEntry.status = 'error';
          logEntry.error = error.message;
          logEntry.duration = Date.now() - logEntry.timestamp;

          this.executionLog.push(logEntry);

          throw new Error(`Node ${node.data.label} failed: ${error.message}`);
        }

        this.executionLog.push(logEntry);
      }

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        results: Object.fromEntries(results),
        executionTime,
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      return {
        success: false,
        results: {},
        error: error.message,
        executionTime,
      };
    }
  }

  /**
   * Validate the graph structure
   */
  private validateGraph(): ValidationResult {
    const errors: string[] = [];

    // Check for cycles
    if (this.hasCycles()) {
      errors.push('Graph contains cycles');
    }

    // Check for disconnected required inputs
    for (const node of this.nodes) {
      const executor = this.registry.getExecutor(node.data.type);
      const inputPorts = executor.getInputPorts(node.data.config);

      for (const port of inputPorts) {
        if (port.required) {
          const hasConnection = this.edges.some(
            (e) => e.target === node.id && e.targetHandle === port.id
          );
          if (!hasConnection) {
            errors.push(`${node.data.label}: Required input "${port.label}" is not connected`);
          }
        }
      }
    }

    // Validate each node's configuration
    for (const node of this.nodes) {
      const executor = this.registry.getExecutor(node.data.type);
      const validation = executor.validate(node.data.config);
      if (!validation.valid) {
        errors.push(`${node.data.label}: ${validation.errors.join(', ')}`);
      }
    }

    // Validate type compatibility on edges
    for (const edge of this.edges) {
      const sourceNode = this.nodes.find((n) => n.id === edge.source);
      const targetNode = this.nodes.find((n) => n.id === edge.target);

      if (!sourceNode || !targetNode) {
        errors.push(`Invalid edge: source or target node not found`);
        continue;
      }

      const sourceExecutor = this.registry.getExecutor(sourceNode.data.type);
      const targetExecutor = this.registry.getExecutor(targetNode.data.type);

      const sourcePort = sourceExecutor
        .getOutputPorts(sourceNode.data.config)
        .find((p) => p.id === edge.sourceHandle);
      const targetPort = targetExecutor
        .getInputPorts(targetNode.data.config)
        .find((p) => p.id === edge.targetHandle);

      if (!sourcePort || !targetPort) {
        errors.push(
          `Invalid edge: port not found (${sourceNode.data.label} -> ${targetNode.data.label})`
        );
        continue;
      }

      if (!this.isTypeCompatible(sourcePort.dataType, targetPort.dataType)) {
        errors.push(
          `Type mismatch: ${sourceNode.data.label}.${sourcePort.label} (${sourcePort.dataType}) -> ${targetNode.data.label}.${targetPort.label} (${targetPort.dataType})`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if two data types are compatible
   */
  private isTypeCompatible(sourceType: DataType, targetType: DataType): boolean {
    if (sourceType === 'any' || targetType === 'any') {
      return true;
    }
    return sourceType === targetType;
  }

  /**
   * Check if the graph has cycles using DFS
   */
  private hasCycles(): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const outgoingEdges = this.edges.filter((e) => e.source === nodeId);
      for (const edge of outgoingEdges) {
        if (!visited.has(edge.target)) {
          if (dfs(edge.target)) {
            return true;
          }
        } else if (recursionStack.has(edge.target)) {
          return true; // Cycle detected
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const node of this.nodes) {
      if (!visited.has(node.id)) {
        if (dfs(node.id)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Topological sort using Kahn's algorithm
   */
  private topologicalSort(): string[] | null {
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();

    // Initialize
    for (const node of this.nodes) {
      inDegree.set(node.id, 0);
      adjList.set(node.id, []);
    }

    // Build graph
    for (const edge of this.edges) {
      adjList.get(edge.source)!.push(edge.target);
      inDegree.set(edge.target, inDegree.get(edge.target)! + 1);
    }

    // Find nodes with no incoming edges
    const queue: string[] = [];
    for (const [nodeId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    const result: string[] = [];

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      result.push(nodeId);

      for (const neighbor of adjList.get(nodeId)!) {
        inDegree.set(neighbor, inDegree.get(neighbor)! - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      }
    }

    // If result doesn't contain all nodes, there's a cycle
    if (result.length !== this.nodes.length) {
      return null;
    }

    return result;
  }

  /**
   * Gather inputs for a node from previous node results
   */
  private gatherInputs(nodeId: string, results: Map<string, any>): Record<string, any> {
    const inputs: Record<string, any> = {};

    // Find all edges targeting this node
    const incomingEdges = this.edges.filter((e) => e.target === nodeId);

    for (const edge of incomingEdges) {
      const sourceResults = results.get(edge.source);
      if (!sourceResults) {
        continue;
      }

      const targetNode = this.nodes.find((n) => n.id === nodeId);
      if (!targetNode) {
        continue;
      }

      const executor = this.registry.getExecutor(targetNode.data.type);
      const inputPort = executor
        .getInputPorts(targetNode.data.config)
        .find((p) => p.id === edge.targetHandle);

      if (!inputPort) {
        continue;
      }

      // Get the output value from source node
      const outputValue = sourceResults[edge.sourceHandle!];
      inputs[edge.targetHandle!] = outputValue;
    }

    return inputs;
  }

  /**
   * Get execution log
   */
  getExecutionLog(): ExecutionLogEntry[] {
    return this.executionLog;
  }

  /**
   * Update node status
   */
  updateNodeStatus(nodeId: string, status: NodeStatus, error?: string): void {
    const node = this.nodes.find((n) => n.id === nodeId);
    if (node) {
      node.data.status = status;
      if (error) {
        node.data.error = error;
      }
    }
  }
}
