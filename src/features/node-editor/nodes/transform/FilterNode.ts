import { BaseNodeExecutor } from '../base/BaseNodeExecutor';
import {
  NodePort,
  ConfigSchema,
  ValidationResult,
  ExecutionContext,
} from '../../core/types';
import { Filter as FilterIcon } from 'lucide-react';

/**
 * Filter Node
 * Filter array items based on conditions
 */
export class FilterNode extends BaseNodeExecutor {
  type = 'transform.filter';
  category = 'transform' as const;
  label = 'Filter';
  description = 'Filter array items by condition';
  icon = FilterIcon;

  getInputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'data',
        label: 'data',
        dataType: 'any',
        required: true,
      },
    ];
  }

  getOutputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'filtered',
        label: 'filtered',
        dataType: 'any',
        required: false,
      },
    ];
  }

  getConfigSchema(): ConfigSchema {
    return {
      fields: [
        {
          key: 'condition',
          label: 'Condition (JS)',
          type: 'text',
          defaultValue: 'item.value > 0',
          required: true,
          placeholder: 'item.balance > 1000',
          helpText: 'JavaScript expression (item is each array element)',
        },
      ],
    };
  }

  validate(config: Record<string, any>): ValidationResult {
    const errors: string[] = [];

    if (!config.condition) {
      errors.push('Condition is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async execute(
    inputs: Record<string, any>,
    config: Record<string, any>,
    context: ExecutionContext
  ): Promise<Record<string, any>> {
    this.checkAbort(context);

    const data = inputs.data;
    if (!data) {
      throw new Error('No data provided');
    }

    if (!Array.isArray(data)) {
      return { filtered: data }; // Return as-is if not an array
    }

    try {
      const condition = config.condition || 'true';
      // Simple property-based filtering (can be enhanced with safe eval)
      const filtered = data.filter((item) => {
        try {
          // Basic filtering by property existence/truthiness
          if (condition.includes('>') || condition.includes('<') || condition.includes('===')) {
            return eval(condition.replace(/item\./g, 'item.'));
          }
          return true;
        } catch {
          return true;
        }
      });

      return {
        filtered,
      };
    } catch (error: any) {
      throw new Error(`Filtering failed: ${error.message}`);
    }
  }
}
