import { ReactNode } from 'react';
import { Node as ReactFlowNode, Edge as ReactFlowEdge } from 'reactflow';

// Data types that can flow between nodes
export type DataType =
  | 'file'          // PDF File
  | 'text'          // Extracted text
  | 'creditReport'  // Parsed CreditReport object
  | 'accounts'      // Account[]
  | 'image'         // Image data URL
  | 'config'        // Configuration object
  | 'any';          // Generic data

// Node execution status
export type NodeStatus = 'idle' | 'running' | 'success' | 'error';

// Node category for organization
export type NodeCategory = 'input' | 'processing' | 'ai' | 'transform' | 'output' | 'control';

// Input/Output port definition
export interface NodePort {
  id: string;
  label: string;
  dataType: DataType;
  required: boolean;
}

// Node data structure (used by React Flow)
export interface NodeData {
  label: string;
  type: string;
  category: NodeCategory;
  config: Record<string, any>;
  inputs: NodePort[];
  outputs: NodePort[];
  status?: NodeStatus;
  error?: string;
  result?: Record<string, any>;
  isDisconnected?: boolean; // Flag for nodes not connected in the pipeline
}

// Extended React Flow node type
export type PipelineNode = ReactFlowNode<NodeData>;
export type PipelineEdge = ReactFlowEdge;

// Execution context passed to all nodes during execution
export interface ExecutionContext {
  reportId: string;
  abortSignal: AbortSignal;
  onProgress?: (nodeId: string, progress: number, message: string) => void;
  cache: Map<string, any>;
}

// Validation result
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// Configuration field types for properties panel
export type ConfigFieldType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'select'
  | 'textarea'
  | 'file'
  | 'apikey';

// Configuration field definition
export interface ConfigField {
  key: string;
  label: string;
  type: ConfigFieldType;
  defaultValue: any;
  required?: boolean;
  options?: { label: string; value: any }[];
  placeholder?: string;
  helpText?: string;
  min?: number;
  max?: number;
}

// Configuration schema
export interface ConfigSchema {
  fields: ConfigField[];
}

// Node executor interface - implemented by all node types
export interface NodeExecutor {
  type: string;
  category: NodeCategory;
  label: string;
  description: string;
  icon?: ReactNode;

  // Define node's input/output ports
  getInputPorts: (config: Record<string, any>) => NodePort[];
  getOutputPorts: (config: Record<string, any>) => NodePort[];

  // Configuration schema for properties panel
  getConfigSchema: () => ConfigSchema;

  // Validate configuration
  validate: (config: Record<string, any>) => ValidationResult;

  // Execute the node's logic
  execute: (
    inputs: Record<string, any>,
    config: Record<string, any>,
    context: ExecutionContext
  ) => Promise<Record<string, any>>;

  // Generate TypeScript code (Phase 2 - optional)
  generateCode?: (config: Record<string, any>) => string;
}

// Execution result
export interface ExecutionResult {
  success: boolean;
  results: Record<string, any>;
  error?: string;
  executionTime?: number;
}

// Pipeline definition
export interface PipelineDefinition {
  id: string;
  name: string;
  description?: string;
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  createdAt: number;
  updatedAt: number;
}

// Execution log entry
export interface ExecutionLogEntry {
  nodeId: string;
  nodeLabel: string;
  status: NodeStatus;
  timestamp: number;
  duration?: number;
  error?: string;
  inputs?: Record<string, any>;
  outputs?: Record<string, any>;
}
