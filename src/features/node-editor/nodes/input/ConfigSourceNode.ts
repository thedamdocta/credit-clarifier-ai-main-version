import { BaseNodeExecutor } from '../base/BaseNodeExecutor';
import {
  NodePort,
  ConfigSchema,
  ValidationResult,
  ExecutionContext,
} from '../../core/types';
import { Settings2 } from 'lucide-react';

/**
 * Config Source Node
 * Provides configuration values (API keys, settings, etc.)
 */
export class ConfigSourceNode extends BaseNodeExecutor {
  type = 'input.config';
  category = 'input' as const;
  label = 'Config Source';
  description = 'Provide configuration values like API keys';
  icon = Settings2;

  getInputPorts(config: Record<string, any>): NodePort[] {
    return []; // No inputs - this is a source node
  }

  getOutputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'config',
        label: 'config',
        dataType: 'config',
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
          helpText: 'OpenAI API key',
        },
        {
          key: 'customConfig',
          label: 'Custom Config (JSON)',
          type: 'textarea',
          defaultValue: '{}',
          required: false,
          placeholder: '{"key": "value"}',
          helpText: 'Additional configuration as JSON',
        },
      ],
    };
  }

  validate(config: Record<string, any>): ValidationResult {
    const errors: string[] = [];

    // Validate JSON if provided
    if (config.customConfig) {
      try {
        JSON.parse(config.customConfig);
      } catch (e) {
        errors.push('Custom config must be valid JSON');
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

    const outputConfig: Record<string, any> = {};

    if (config.apiKey) {
      outputConfig.apiKey = config.apiKey;
    }

    if (config.customConfig) {
      try {
        const custom = JSON.parse(config.customConfig);
        Object.assign(outputConfig, custom);
      } catch (e) {
        // Already validated, shouldn't happen
      }
    }

    return {
      config: outputConfig,
    };
  }
}
