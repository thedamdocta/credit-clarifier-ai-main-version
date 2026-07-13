import { PipelineDefinition, PipelineNode, PipelineEdge } from '../types';
import { getDefaultPipeline } from '../../utils/defaultPipelines';
import { devDiagnostics } from "@/lib/security/devDiagnostics";

const STORAGE_KEY = 'node-editor-pipelines';
const ACTIVE_PIPELINE_KEY = 'node-editor-active-pipeline';
const PIPELINE_MODE_KEY = 'pipeline-mode';

/**
 * Save a pipeline to localStorage
 */
export function savePipeline(pipeline: PipelineDefinition): void {
  try {
    const pipelines = loadAllPipelines();
    pipelines[pipeline.id] = {
      ...pipeline,
      updatedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pipelines));
  } catch (error) {
    devDiagnostics.error('Failed to save pipeline:', error);
    throw new Error('Failed to save pipeline to localStorage');
  }
}

/**
 * Load a pipeline from localStorage
 */
export function loadPipeline(id: string): PipelineDefinition | null {
  try {
    const pipelines = loadAllPipelines();
    return pipelines[id] || null;
  } catch (error) {
    devDiagnostics.error('Failed to load pipeline:', error);
    return null;
  }
}

/**
 * Load all pipelines from localStorage
 */
export function loadAllPipelines(): Record<string, PipelineDefinition> {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      return {};
    }
    return JSON.parse(data);
  } catch (error) {
    devDiagnostics.error('Failed to load pipelines:', error);
    return {};
  }
}

/**
 * Delete a pipeline from localStorage
 */
export function deletePipeline(id: string): void {
  try {
    const pipelines = loadAllPipelines();
    delete pipelines[id];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pipelines));

    // If this was the active pipeline, clear it
    if (getActivePipelineId() === id) {
      setActivePipelineId(null);
    }
  } catch (error) {
    devDiagnostics.error('Failed to delete pipeline:', error);
    throw new Error('Failed to delete pipeline from localStorage');
  }
}

/**
 * Get active pipeline ID
 */
export function getActivePipelineId(): string | null {
  return localStorage.getItem(ACTIVE_PIPELINE_KEY);
}

/**
 * Set active pipeline ID
 */
export function setActivePipelineId(id: string | null): void {
  if (id) {
    localStorage.setItem(ACTIVE_PIPELINE_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_PIPELINE_KEY);
  }
}

/**
 * Get pipeline mode (classic or visual)
 */
export function getPipelineMode(): 'classic' | 'visual' {
  const mode = localStorage.getItem(PIPELINE_MODE_KEY);
  return mode === 'visual' ? 'visual' : 'classic';
}

/**
 * Set pipeline mode
 */
export function setPipelineMode(mode: 'classic' | 'visual'): void {
  localStorage.setItem(PIPELINE_MODE_KEY, mode);
}

/**
 * Export pipeline to JSON file
 */
export function exportPipeline(pipeline: PipelineDefinition): void {
  const json = JSON.stringify(pipeline, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${pipeline.name.replace(/\s+/g, '-')}.pipeline.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Import pipeline from JSON
 */
export async function importPipeline(file: File): Promise<PipelineDefinition> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const pipeline = JSON.parse(e.target?.result as string) as PipelineDefinition;
        // Generate new ID and timestamps
        pipeline.id = generatePipelineId();
        pipeline.createdAt = Date.now();
        pipeline.updatedAt = Date.now();
        resolve(pipeline);
      } catch (error) {
        reject(new Error('Invalid pipeline file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Generate a unique pipeline ID
 */
export function generatePipelineId(): string {
  return `pipeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new empty pipeline
 */
export function createEmptyPipeline(name: string): PipelineDefinition {
  return {
    id: generatePipelineId(),
    name,
    description: '',
    nodes: [],
    edges: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Create a default pipeline with pre-configured nodes
 */
export function createDefaultPipeline(name: string): PipelineDefinition {
  // Look up template from default pipelines
  const template = getDefaultPipeline(name);
  if (template) {
    // Return a copy with new ID and timestamps
    return {
      ...template,
      id: generatePipelineId(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  // Fallback: create basic pipeline if template not found
  const uploadId = `node_${Date.now()}_1`;
  const extractId = `node_${Date.now()}_2`;
  const parserId = `node_${Date.now()}_3`;
  const extractAccountsId = `node_${Date.now()}_4`;
  const displayId = `node_${Date.now()}_5`;

  return {
    id: generatePipelineId(),
    name,
    description: 'Standard credit report analysis workflow',
    nodes: [
      {
        id: uploadId,
        type: 'custom',
        position: { x: 50, y: 300 },
        data: {
          label: 'PDF Upload',
          type: 'input.pdf-upload',
          category: 'input',
          config: {},
          status: 'idle',
          inputs: [],
          outputs: [
            { id: 'file', label: 'file', dataType: 'file', required: false },
            { id: 'metadata', label: 'metadata', dataType: 'any', required: false }
          ]
        },
      },
      {
        id: extractId,
        type: 'custom',
        position: { x: 300, y: 300 },
        data: {
          label: 'Extract Text',
          type: 'processing.pdf-extract-text',
          category: 'processing',
          config: {},
          status: 'idle',
          inputs: [
            { id: 'file', label: 'file', dataType: 'file', required: true }
          ],
          outputs: [
            { id: 'text', label: 'text', dataType: 'text', required: false },
            { id: 'pageCount', label: 'page count', dataType: 'any', required: false },
            { id: 'pageOffsets', label: 'page offsets', dataType: 'any', required: false }
          ]
        },
      },
      {
        id: `node_${Date.now()}_bureau`,
        type: 'custom',
        position: { x: 550, y: 150 },
        data: {
          label: 'Identify Bureau',
          type: 'processing.bureau-identifier',
          category: 'processing',
          config: {},
          status: 'idle',
          inputs: [
            { id: 'text', label: 'text', dataType: 'text', required: true }
          ],
          outputs: [
            { id: 'bureau', label: 'bureau', dataType: 'text', required: false }
          ]
        },
      },
      {
        id: parserId,
        type: 'custom',
        position: { x: 550, y: 300 },
        data: {
          label: 'Parse Report',
          type: 'processing.credit-report-parser',
          category: 'processing',
          config: { useAI: true },
          status: 'idle',
          inputs: [
            { id: 'text', label: 'text', dataType: 'text', required: true }
          ],
          outputs: [
            { id: 'report', label: 'report', dataType: 'creditReport', required: false }
          ]
        },
      },
      {
        id: extractAccountsId,
        type: 'custom',
        position: { x: 800, y: 300 },
        data: {
          label: 'Extract Accounts',
          type: 'ai.account-extraction',
          category: 'ai',
          config: {},
          status: 'idle',
          inputs: [
            { id: 'report', label: 'report', dataType: 'creditReport', required: true }
          ],
          outputs: [
            { id: 'accounts', label: 'accounts', dataType: 'accounts', required: false },
            { id: 'logs', label: 'logs', dataType: 'any', required: false }
          ]
        },
      },
      {
        id: displayId,
        type: 'custom',
        position: { x: 1050, y: 300 },
        data: {
          label: 'Display Results',
          type: 'output.display',
          category: 'output',
          config: { format: 'json' },
          status: 'idle',
          inputs: [
            { id: 'data', label: 'data', dataType: 'any', required: true }
          ],
          outputs: []
        },
      },
    ],
    edges: [
      {
        id: `edge_${Date.now()}_1`,
        source: uploadId,
        sourceHandle: 'file',
        target: extractId,
        targetHandle: 'file',
      },
      {
        id: `edge_${Date.now()}_2`,
        source: extractId,
        sourceHandle: 'text',
        target: parserId,
        targetHandle: 'text',
      },
      {
        id: `edge_${Date.now()}_2b`,
        source: extractId,
        sourceHandle: 'text',
        target: `node_${Date.now()}_bureau`,
        targetHandle: 'text',
      },
      {
        id: `edge_${Date.now()}_3`,
        source: parserId,
        sourceHandle: 'report',
        target: extractAccountsId,
        targetHandle: 'report',
      },
      {
        id: `edge_${Date.now()}_4`,
        source: extractAccountsId,
        sourceHandle: 'accounts',
        target: displayId,
        targetHandle: 'data',
      },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Duplicate a pipeline
 */
export function duplicatePipeline(pipeline: PipelineDefinition): PipelineDefinition {
  const newPipeline: PipelineDefinition = {
    ...pipeline,
    id: generatePipelineId(),
    name: `${pipeline.name} (Copy)`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  return newPipeline;
}
