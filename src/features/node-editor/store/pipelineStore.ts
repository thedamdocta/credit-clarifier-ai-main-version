import { create } from 'zustand';
import {
  PipelineNode,
  PipelineEdge,
  PipelineDefinition,
  ExecutionResult,
  ExecutionLogEntry,
  NodeStatus,
} from '../core/types';
import {
  savePipeline,
  loadPipeline,
  createEmptyPipeline,
  generatePipelineId,
} from '../core/serialization';

interface PipelineState {
  // Current pipeline
  currentPipeline: PipelineDefinition | null;
  nodes: PipelineNode[];
  edges: PipelineEdge[];

  // Execution state
  isExecuting: boolean;
  executionResult: ExecutionResult | null;
  executionLog: ExecutionLogEntry[];

  // Selected node
  selectedNodeId: string | null;

  // Actions
  loadPipelineById: (id: string) => void;
  createDefaultPipeline: (name: string) => void;
  createNewPipeline: (name: string) => void;
  updatePipeline: (updates: Partial<PipelineDefinition>) => void;
  saveCurrentPipeline: () => void;

  setNodes: (nodes: PipelineNode[]) => void;
  setEdges: (edges: PipelineEdge[]) => void;
  updateNode: (nodeId: string, updates: Partial<PipelineNode['data']>) => void;

  setSelectedNode: (nodeId: string | null) => void;

  setExecuting: (isExecuting: boolean) => void;
  setExecutionResult: (result: ExecutionResult | null) => void;
  setExecutionLog: (log: ExecutionLogEntry[]) => void;
  updateNodeStatus: (nodeId: string, status: NodeStatus, error?: string) => void;

  reset: () => void;
}

export const usePipelineStore = create<PipelineState>((set, get) => ({
  // Initial state
  currentPipeline: null,
  nodes: [],
  edges: [],
  isExecuting: false,
  executionResult: null,
  executionLog: [],
  selectedNodeId: null,

  // Load a pipeline from localStorage
  loadPipelineById: (id: string) => {
    const pipeline = loadPipeline(id);
    if (pipeline) {
      set({
        currentPipeline: pipeline,
        nodes: pipeline.nodes,
        edges: pipeline.edges,
        executionResult: null,
        executionLog: [],
      });
    }
  },

  // Create a default pipeline with standard nodes
  createDefaultPipeline: (name: string) => {
    // Dynamically import to ensure we get the latest definition
    import('../core/serialization').then(({ createDefaultPipeline }) => {
      const pipeline = createDefaultPipeline(name);
      set({
        currentPipeline: pipeline,
        nodes: pipeline.nodes,
        edges: pipeline.edges,
        executionResult: null,
        executionLog: [],
      });
    });
  },

  // Create a new empty pipeline
  createNewPipeline: (name: string) => {
    const pipeline = createEmptyPipeline(name);
    set({
      currentPipeline: pipeline,
      nodes: [],
      edges: [],
      executionResult: null,
      executionLog: [],
    });
  },

  // Update pipeline metadata
  updatePipeline: (updates: Partial<PipelineDefinition>) => {
    const current = get().currentPipeline;
    if (current) {
      const updated = { ...current, ...updates, updatedAt: Date.now() };
      set({ currentPipeline: updated });
    }
  },

  // Save current pipeline to localStorage
  saveCurrentPipeline: () => {
    const { currentPipeline, nodes, edges } = get();
    if (currentPipeline) {
      const updated: PipelineDefinition = {
        ...currentPipeline,
        nodes,
        edges,
        updatedAt: Date.now(),
      };
      savePipeline(updated);
      set({ currentPipeline: updated });
    }
  },

  // Set nodes
  setNodes: (nodes: PipelineNode[]) => {
    set({ nodes });
  },

  // Set edges
  setEdges: (edges: PipelineEdge[]) => {
    set({ edges });
  },

  // Update a specific node
  updateNode: (nodeId: string, updates: Partial<PipelineNode['data']>) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...updates } }
          : node
      ),
    }));
  },

  // Set selected node
  setSelectedNode: (nodeId: string | null) => {
    set({ selectedNodeId: nodeId });
  },

  // Set executing state
  setExecuting: (isExecuting: boolean) => {
    set({ isExecuting });
  },

  // Set execution result
  setExecutionResult: (result: ExecutionResult | null) => {
    set({ executionResult: result });
  },

  // Set execution log
  setExecutionLog: (log: ExecutionLogEntry[]) => {
    set({ executionLog: log });
  },

  // Update node status during execution
  updateNodeStatus: (nodeId: string, status: NodeStatus, error?: string) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? {
            ...node,
            data: {
              ...node.data,
              status,
              error: error || undefined,
            },
          }
          : node
      ),
    }));
  },

  // Reset state
  reset: () => {
    set({
      currentPipeline: null,
      nodes: [],
      edges: [],
      isExecuting: false,
      executionResult: null,
      executionLog: [],
      selectedNodeId: null,
    });
  },
}));
