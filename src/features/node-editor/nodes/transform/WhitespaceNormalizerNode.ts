import { BaseNodeExecutor } from '../base/BaseNodeExecutor';
import {
  NodePort,
  ConfigSchema,
  ValidationResult,
  ExecutionContext,
} from '../../core/types';
import { Wand2 } from 'lucide-react';

/**
 * Whitespace Normalizer Node
 * Remove carriage returns from text
 */
export class WhitespaceNormalizerNode extends BaseNodeExecutor {
  type = 'transform.normalize-whitespace';
  category = 'transform' as const;
  label = 'Whitespace Normalizer';
  description = 'Remove carriage returns from text';
  icon = Wand2;

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
        id: 'normalizedText',
        label: 'normalizedText',
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
      normalizedText: text.replace(/\r/g, ''),
    };
  }
}
