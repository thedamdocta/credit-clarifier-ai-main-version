import { BaseNodeExecutor } from '../base/BaseNodeExecutor';
import {
  NodePort,
  ConfigSchema,
  ValidationResult,
  ExecutionContext,
} from '../../core/types';
import { Shuffle } from 'lucide-react';

/**
 * Data Mapper Node
 * Transform data structure using JSONPath or custom mapping
 */
export class DataMapperNode extends BaseNodeExecutor {
  type = 'transform.data-mapper';
  category = 'transform' as const;
  label = 'Data Mapper';
  description = 'Transform and restructure data';
  icon = Shuffle;

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
        id: 'mapped',
        label: 'mapped',
        dataType: 'any',
        required: false,
      },
    ];
  }

  getConfigSchema(): ConfigSchema {
    return {
      fields: [
        {
          key: 'mapping',
          label: 'Mapping (JSON)',
          type: 'textarea',
          defaultValue: '{}',
          required: true,
          placeholder: '{"newKey": "$.oldKey"}',
          helpText: 'JSONPath expressions to map data',
        },
      ],
    };
  }

  validate(config: Record<string, any>): ValidationResult {
    const errors: string[] = [];

    if (config.mapping) {
      try {
        JSON.parse(config.mapping);
      } catch (e) {
        errors.push('Mapping must be valid JSON');
      }
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

    try {
      const mapping = JSON.parse(config.mapping || '{}');
      const result: Record<string, any> = {};

      // Simple object mapping (no JSONPath for now, can be enhanced)
      for (const [newKey, oldKey] of Object.entries(mapping)) {
        if (typeof oldKey === 'string' && oldKey in data) {
          result[newKey] = data[oldKey];
        }
      }

      return {
        mapped: Object.keys(result).length > 0 ? result : data,
      };
    } catch (error: any) {
      throw new Error(`Data mapping failed: ${error.message}`);
    }
  }
}
