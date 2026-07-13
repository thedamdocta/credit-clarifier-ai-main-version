import { BaseNodeExecutor } from '../base/BaseNodeExecutor';
import {
  NodePort,
  ConfigSchema,
  ValidationResult,
  ExecutionContext,
} from '../../core/types';
import { Merge as MergeIcon } from 'lucide-react';

/**
 * Merge Node
 * Combine multiple inputs into one
 */
export class MergeNode extends BaseNodeExecutor {
  type = 'transform.merge';
  category = 'transform' as const;
  label = 'Merge';
  description = 'Combine multiple inputs';
  icon = MergeIcon;

  getInputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'input1',
        label: 'input1',
        dataType: 'any',
        required: false,
      },
      {
        id: 'input2',
        label: 'input2',
        dataType: 'any',
        required: false,
      },
      {
        id: 'input3',
        label: 'input3',
        dataType: 'any',
        required: false,
      },
    ];
  }

  getOutputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'merged',
        label: 'merged',
        dataType: 'any',
        required: false,
      },
    ];
  }

  getConfigSchema(): ConfigSchema {
    return {
      fields: [
        {
          key: 'strategy',
          label: 'Merge Strategy',
          type: 'select',
          defaultValue: 'object',
          options: [
            { label: 'Object (merge properties)', value: 'object' },
            { label: 'Array (concatenate)', value: 'array' },
          ],
          helpText: 'How to combine the inputs',
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

    const strategy = config.strategy || 'object';
    const values = [inputs.input1, inputs.input2, inputs.input3].filter((v) => v !== undefined);

    if (values.length === 0) {
      return { merged: null };
    }

    try {
      let merged: any;

      if (strategy === 'array') {
        // Concatenate arrays
        merged = values.reduce((acc, val) => {
          if (Array.isArray(val)) {
            return [...acc, ...val];
          }
          return [...acc, val];
        }, []);
      } else {
        // Merge objects
        merged = values.reduce((acc, val) => {
          if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
            return { ...acc, ...val };
          }
          return acc;
        }, {});
      }

      return {
        merged,
      };
    } catch (error: any) {
      throw new Error(`Merge failed: ${error.message}`);
    }
  }
}
