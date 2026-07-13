import { BaseNodeExecutor } from '../base/BaseNodeExecutor';
import {
  NodePort,
  ConfigSchema,
  ValidationResult,
  ExecutionContext,
} from '../../core/types';
import { AlertTriangle } from 'lucide-react';

/**
 * Account Error Handler Node
 * Gracefully handle account extraction failures
 */
export class AccountErrorHandlerNode extends BaseNodeExecutor {
  type = 'control.account-error-handler';
  category = 'control' as const;
  label = 'Account Error Handler';
  description = 'Gracefully handle account extraction failures';
  icon = AlertTriangle;

  getInputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'error',
        label: 'error',
        dataType: 'any',
        required: true,
      },
      {
        id: 'accountName',
        label: 'accountName',
        dataType: 'text',
        required: true,
      },
      {
        id: 'defaultTemplate',
        label: 'defaultTemplate',
        dataType: 'any',
        required: false,
      },
    ];
  }

  getOutputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'recoveredAccount',
        label: 'recoveredAccount',
        dataType: 'any',
        required: false,
      },
    ];
  }

  getConfigSchema(): ConfigSchema {
    return {
      fields: [
        {
          key: 'createDefaultOnError',
          label: 'Create Default on Error',
          type: 'checkbox',
          defaultValue: true,
          required: false,
          helpText: 'Create a default account object when extraction fails',
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

    const error = inputs.error;
    const accountName = inputs.accountName as string;
    const defaultTemplate = inputs.defaultTemplate;
    const createDefaultOnError = config.createDefaultOnError !== false; // default to true

    let recoveredAccount: any = null;

    if (createDefaultOnError) {
      // Create a default account object with error information
      recoveredAccount = {
        accountName: accountName || 'Unknown Account',
        accountNumber: null,
        creditorName: accountName || null,
        balance: null,
        status: 'ERROR',
        comments: `Extraction failed: ${error?.message || error || 'Unknown error'}`,
        ...(defaultTemplate || {}),
      };
    }

    return {
      recoveredAccount,
    };
  }
}
