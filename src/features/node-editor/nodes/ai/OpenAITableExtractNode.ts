import { BaseNodeExecutor } from '../base/BaseNodeExecutor';
import {
  NodePort,
  ConfigSchema,
  ValidationResult,
  ExecutionContext,
} from '../../core/types';
import { Table } from 'lucide-react';
import { extractTableWithOpenAI } from '@/lib/ai/openai/openaiService';

/**
 * OpenAI Table Extract Node
 * Extracts tables from images using OpenAI
 */
export class OpenAITableExtractNode extends BaseNodeExecutor {
  type = 'ai.openai-table-extract';
  category = 'ai' as const;
  label = 'OpenAI Table Extract';
  description = 'Disabled in Phase 0 security mode';
  icon = Table;

  getInputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'image',
        label: 'image',
        dataType: 'image',
        required: true,
      },
    ];
  }

  getOutputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'accounts',
        label: 'accounts',
        dataType: 'accounts',
        required: false,
      },
    ];
  }

  getConfigSchema(): ConfigSchema {
    return {
      fields: [
        {
          key: 'apiKey',
          label: 'API Key',
          type: 'apikey',
          defaultValue: '',
          required: false,
          placeholder: 'sk-...',
          helpText: 'Unused in Phase 0 while client-side provider calls are disabled',
        },
      ],
    };
  }

  validate(config: Record<string, any>): ValidationResult {
    void config;
    return {
      valid: false,
      errors: ['Client-side provider calls are disabled in Phase 0.']
    };
  }

  async execute(
    inputs: Record<string, any>,
    config: Record<string, any>,
    context: ExecutionContext
  ): Promise<Record<string, any>> {
    this.checkAbort(context);

    const image = inputs.image as string;
    if (!image) {
      throw new Error('No image provided');
    }

    try {
      const result = await extractTableWithOpenAI(image, config.apiKey);

      return {
        accounts: result || [],
      };
    } catch (error: any) {
      throw new Error(`Table extraction failed: ${error.message}`);
    }
  }
}
