import { BaseNodeExecutor } from '../base/BaseNodeExecutor';
import {
  NodePort,
  ConfigSchema,
  ValidationResult,
  ExecutionContext,
} from '../../core/types';
import { Cpu } from 'lucide-react';

/**
 * OpenAI API Caller Node
 * Generic OpenAI API wrapper
 */
export class OpenAICallerNode extends BaseNodeExecutor {
  type = 'ai.openai-call';
  category = 'ai' as const;
  label = 'OpenAI API Caller';
  description = 'Disabled in Phase 0 security mode';
  icon = Cpu;

  getInputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'messages',
        label: 'messages',
        dataType: 'any',
        required: true,
      },
      {
        id: 'apiKey',
        label: 'apiKey',
        dataType: 'text',
        required: true,
      },
    ];
  }

  getOutputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'responseText',
        label: 'responseText',
        dataType: 'text',
        required: false,
      },
    ];
  }

  getConfigSchema(): ConfigSchema {
    return {
      fields: [
        {
          key: 'model',
          label: 'Model',
          type: 'text',
          defaultValue: 'gpt-4o-mini',
          required: false,
          placeholder: 'gpt-4o-mini',
          helpText: 'OpenAI model to use',
        },
        {
          key: 'temperature',
          label: 'Temperature',
          type: 'number',
          defaultValue: 0.2,
          required: false,
          min: 0,
          max: 2,
          helpText: 'Sampling temperature (0-2)',
        },
        {
          key: 'maxTokens',
          label: 'Max Tokens',
          type: 'number',
          defaultValue: 2000,
          required: false,
          min: 1,
          max: 16000,
          helpText: 'Maximum tokens to generate',
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
    void inputs;
    void config;
    throw new Error('Phase 0 security lock: node execution is disabled for client-side provider calls.');
  }
}
