import { BaseNodeExecutor } from '../base/BaseNodeExecutor';
import {
  NodePort,
  ConfigSchema,
  ValidationResult,
  ExecutionContext,
} from '../../core/types';
import { Eye } from 'lucide-react';

/**
 * OpenAI Vision Node
 * Analyzes images using OpenAI GPT-4 Vision
 */
export class OpenAIVisionNode extends BaseNodeExecutor {
  type = 'ai.openai-vision';
  category = 'ai' as const;
  label = 'OpenAI Vision';
  description = 'Disabled in Phase 0 security mode';
  icon = Eye;

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
        id: 'result',
        label: 'result',
        dataType: 'any',
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
          required: true,
          placeholder: 'sk-...',
          helpText: 'OpenAI API key',
        },
        {
          key: 'prompt',
          label: 'Prompt',
          type: 'textarea',
          defaultValue: 'Describe what you see in this image.',
          required: true,
          placeholder: 'What should the AI analyze?',
          helpText: 'Instructions for the vision model',
        },
        {
          key: 'model',
          label: 'Model',
          type: 'select',
          defaultValue: 'gpt-4o',
          options: [
            { label: 'GPT-4o', value: 'gpt-4o' },
            { label: 'GPT-4o Mini', value: 'gpt-4o-mini' },
          ],
          helpText: 'Which model to use',
        },
      ],
    };
  }

  validate(config: Record<string, any>): ValidationResult {
    void config;
    const errors: string[] = ['Client-side provider calls are disabled in Phase 0.'];
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
    void inputs;
    void config;
    throw new Error('Phase 0 security lock: node execution is disabled for client-side provider calls.');
  }
}
