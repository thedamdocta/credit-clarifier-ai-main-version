import { BaseNodeExecutor } from '../base/BaseNodeExecutor';
import {
  NodePort,
  ConfigSchema,
  ValidationResult,
  ExecutionContext,
} from '../../core/types';
import { Repeat } from 'lucide-react';

/**
 * Loop Node
 * Iterate over array items
 */
export class LoopNode extends BaseNodeExecutor {
  type = 'control.loop';
  category = 'control' as const;
  label = 'Loop';
  description = 'Iterate over array items';
  icon = Repeat;

  getInputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'items',
        label: 'items',
        dataType: 'any',
        required: true,
      },
    ];
  }

  getOutputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'results',
        label: 'results',
        dataType: 'any',
        required: false,
      },
    ];
  }

  getConfigSchema(): ConfigSchema {
    return {
      fields: [
        {
          key: 'maxIterations',
          label: 'Max Iterations',
          type: 'number',
          defaultValue: 100,
          required: false,
          min: 1,
          max: 1000,
          helpText: 'Safety limit on loop iterations',
        },
      ],
    };
  }

  validate(config: Record<string, any>): ValidationResult {
    return { valid: true, errors: [] };
  }

  async execute(
    inputs: Record<string, any>,
    config: Record<string, any>,
    context: ExecutionContext
  ): Promise<Record<string, any>> {
    this.checkAbort(context);

    const items = inputs.items;
    if (!items) {
      throw new Error('No items provided');
    }

    if (!Array.isArray(items)) {
      return { results: [items] };
    }

    const maxIterations = config.maxIterations || 100;
    const limitedItems = items.slice(0, maxIterations);

    // For now, just return the items
    // In a full implementation, this would execute a subgraph for each item
    return {
      results: limitedItems,
    };
  }
}
