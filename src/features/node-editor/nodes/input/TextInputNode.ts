import { BaseNodeExecutor } from '../base/BaseNodeExecutor';
import {
  NodePort,
  ConfigSchema,
  ValidationResult,
  ExecutionContext,
} from '../../core/types';
import { Type } from 'lucide-react';

/**
 * Text Input Node
 * Provides manual text input for testing or custom data
 */
export class TextInputNode extends BaseNodeExecutor {
  type = 'input.text';
  category = 'input' as const;
  label = 'Text Input';
  description = 'Manual text input for testing';
  icon = Type;

  getInputPorts(config: Record<string, any>): NodePort[] {
    return []; // No inputs - this is a source node
  }

  getOutputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'text',
        label: 'text',
        dataType: 'text',
        required: false,
      },
    ];
  }

  getConfigSchema(): ConfigSchema {
    return {
      fields: [
        {
          key: 'text',
          label: 'Text Content',
          type: 'textarea',
          defaultValue: '',
          required: true,
          placeholder: 'Enter text content...',
          helpText: 'The text to output',
        },
      ],
    };
  }

  validate(config: Record<string, any>): ValidationResult {
    const errors: string[] = [];

    if (!config.text || config.text.trim() === '') {
      errors.push('Text content cannot be empty');
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

    return {
      text: config.text,
    };
  }
}
