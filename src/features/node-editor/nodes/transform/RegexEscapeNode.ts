import { BaseNodeExecutor } from '../base/BaseNodeExecutor';
import {
  NodePort,
  ConfigSchema,
  ValidationResult,
  ExecutionContext,
} from '../../core/types';
import { Code2 } from 'lucide-react';

/**
 * Regex Escape Node
 * Escape special regex characters
 */
export class RegexEscapeNode extends BaseNodeExecutor {
  type = 'transform.escape-regex';
  category = 'transform' as const;
  label = 'Regex Escape';
  description = 'Escape special regex characters';
  icon = Code2;

  getInputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'text',
        label: 'text',
        dataType: 'text',
        required: true,
      },
    ];
  }

  getOutputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'escapedText',
        label: 'escapedText',
        dataType: 'text',
        required: false,
      },
    ];
  }

  getConfigSchema(): ConfigSchema {
    return {
      fields: [],
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

    const text = inputs.text as string;
    if (!text) {
      throw new Error('No text provided');
    }

    return {
      escapedText: text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    };
  }
}
