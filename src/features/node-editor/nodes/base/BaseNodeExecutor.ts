import {
  NodeExecutor,
  NodeCategory,
  NodePort,
  ConfigSchema,
  ValidationResult,
  ExecutionContext,
} from '../../core/types';
import { ReactNode } from 'react';

export abstract class BaseNodeExecutor implements NodeExecutor {
  abstract type: string;
  abstract category: NodeCategory;
  abstract label: string;
  abstract description: string;
  icon?: ReactNode;

  abstract getInputPorts(config: Record<string, any>): NodePort[];
  abstract getOutputPorts(config: Record<string, any>): NodePort[];
  abstract getConfigSchema(): ConfigSchema;

  /**
   * Default validation - checks required fields
   * Override for custom validation
   */
  validate(config: Record<string, any>): ValidationResult {
    const schema = this.getConfigSchema();
    const errors: string[] = [];

    for (const field of schema.fields) {
      if (field.required && !config[field.key]) {
        errors.push(`${field.label} is required`);
      }

      // Type-specific validation
      if (config[field.key] !== undefined) {
        switch (field.type) {
          case 'number':
            if (typeof config[field.key] !== 'number') {
              errors.push(`${field.label} must be a number`);
            }
            if (field.min !== undefined && config[field.key] < field.min) {
              errors.push(`${field.label} must be at least ${field.min}`);
            }
            if (field.max !== undefined && config[field.key] > field.max) {
              errors.push(`${field.label} must be at most ${field.max}`);
            }
            break;
          case 'boolean':
            if (typeof config[field.key] !== 'boolean') {
              errors.push(`${field.label} must be a boolean`);
            }
            break;
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  abstract execute(
    inputs: Record<string, any>,
    config: Record<string, any>,
    context: ExecutionContext
  ): Promise<Record<string, any>>;

  /**
   * Helper to report progress during execution
   */
  protected reportProgress(
    context: ExecutionContext,
    nodeId: string,
    progress: number,
    message: string
  ): void {
    if (context.onProgress) {
      context.onProgress(nodeId, progress, message);
    }
  }

  /**
   * Helper to check if execution should abort
   */
  protected checkAbort(context: ExecutionContext): void {
    if (context.abortSignal.aborted) {
      throw new Error('Execution aborted');
    }
  }
}
