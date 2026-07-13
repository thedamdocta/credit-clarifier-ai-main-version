import { BaseNodeExecutor } from '../base/BaseNodeExecutor';
import {
  NodePort,
  ConfigSchema,
  ValidationResult,
  ExecutionContext,
} from '../../core/types';
import { Search } from 'lucide-react';
import { devDiagnostics } from "@/lib/security/devDiagnostics";

/**
 * Account Detection Node
 * First stage - detect all accounts with OpenAI
 */
export class AccountDetectionNode extends BaseNodeExecutor {
  type = 'ai.detect-accounts';
  category = 'ai' as const;
  label = 'Account Detection';
  description = 'First stage - detect all accounts with OpenAI';
  icon = Search;

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
        id: 'accountDetections',
        label: 'accountDetections',
        dataType: 'any',
        required: false,
      },
    ];
  }

  getConfigSchema(): ConfigSchema {
    return {
      fields: [
        {
          key: 'customTemplate',
          label: 'Custom Template',
          type: 'textarea',
          defaultValue: '',
          required: false,
          placeholder: 'Optional custom detection template',
          helpText: 'Custom template for account detection',
        },
        {
          key: 'accountResultLimit',
          label: 'Account Result Limit',
          type: 'number',
          defaultValue: 20,
          required: false,
          placeholder: '20',
          helpText: 'Maximum number of accounts to detect',
        },
      ],
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

    // Note: detectAccounts is not exported from @/lib/ai/accountsExtraction
    // This is a stub implementation that needs actual implementation
    devDiagnostics.warn(
      'AccountDetectionNode: This node requires actual implementation of account detection logic'
    );

    try {
      // Stub implementation - replace with actual account detection logic
      const accountDetections = {
        accounts: [],
        detectedCount: 0,
        limit: config.accountResultLimit || 20,
        message: 'This is a stub implementation. Implement actual account detection.',
      };

      return {
        accountDetections,
      };
    } catch (error: any) {
      throw new Error(`Account detection failed: ${error.message}`);
    }
  }
}
