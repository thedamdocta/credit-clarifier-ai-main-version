import { BaseNodeExecutor } from '../base/BaseNodeExecutor';
import {
  NodePort,
  ConfigSchema,
  ValidationResult,
  ExecutionContext,
} from '../../core/types';
import { Key } from 'lucide-react';

/**
 * API Key Validator Node
 * Validate OpenAI key from localStorage or fallback
 */
export class APIKeyValidatorNode extends BaseNodeExecutor {
  type = 'control.api-key-validator';
  category = 'control' as const;
  label = 'API Key Validator';
  description = 'Disabled in Phase 0 security mode';
  icon = Key;

  getInputPorts(config: Record<string, any>): NodePort[] {
    return [];
  }

  getOutputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'apiKey',
        label: 'apiKey',
        dataType: 'text',
        required: false,
      },
      {
        id: 'isValid',
        label: 'isValid',
        dataType: 'any',
        required: false,
      },
    ];
  }

  getConfigSchema(): ConfigSchema {
    return {
      fields: [
        {
          key: 'fallbackKey',
          label: 'Fallback Key',
          type: 'text',
          defaultValue: '',
          required: false,
          placeholder: 'sk-...',
          helpText: 'Fallback API key if localStorage key is invalid',
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

    return {
      apiKey: '',
      isValid: false,
    };
  }
}
