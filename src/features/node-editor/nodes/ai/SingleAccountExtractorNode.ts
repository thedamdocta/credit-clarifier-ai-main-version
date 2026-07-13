import { BaseNodeExecutor } from '../base/BaseNodeExecutor';
import {
  NodePort,
  ConfigSchema,
  ValidationResult,
  ExecutionContext,
} from '../../core/types';
import { FileSearch } from 'lucide-react';
import { devDiagnostics } from "@/lib/security/devDiagnostics";

/**
 * Single Account Extractor Node
 * Second stage - extract full account details
 */
export class SingleAccountExtractorNode extends BaseNodeExecutor {
  type = 'ai.extract-single-account';
  category = 'ai' as const;
  label = 'Single Account Extractor';
  description = 'Second stage - extract full account details';
  icon = FileSearch;

  getInputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'detection',
        label: 'detection',
        dataType: 'any',
        required: true,
      },
      {
        id: 'rawText',
        label: 'rawText',
        dataType: 'text',
        required: true,
      },
    ];
  }

  getOutputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'account',
        label: 'account',
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
          placeholder: 'Optional custom extraction template',
          helpText: 'Custom template for account extraction',
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

    const detection = inputs.detection;
    if (!detection) {
      throw new Error('No detection provided');
    }

    const rawText = inputs.rawText as string;
    if (!rawText) {
      throw new Error('No raw text provided');
    }

    // Note: Single account extraction function is not exported from @/lib/ai/accountsExtraction
    // This is a stub implementation that needs actual implementation
    devDiagnostics.warn(
      'SingleAccountExtractorNode: This node requires actual implementation of single account extraction logic'
    );

    try {
      // Stub implementation - replace with actual account extraction logic
      const account = {
        accountNumber: null,
        creditorName: null,
        balance: null,
        status: null,
        message: 'This is a stub implementation. Implement actual account extraction.',
      };

      return {
        account,
      };
    } catch (error: any) {
      throw new Error(`Single account extraction failed: ${error.message}`);
    }
  }
}
