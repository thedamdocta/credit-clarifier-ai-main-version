import { BaseNodeExecutor } from '../base/BaseNodeExecutor';
import {
  NodePort,
  ConfigSchema,
  ValidationResult,
  ExecutionContext,
} from '../../core/types';
import { Brain } from 'lucide-react';
import { extractAccountsFromReport, DETECTION_PROMPT_TEMPLATE, EXTRACTION_PROMPT_TEMPLATE } from '@/lib/ai/accountsExtraction';
import { CreditReport } from '@/lib/types/creditReport';

/**
 * Account Extraction Node
 * Extracts credit accounts from a credit report using AI
 */
export class AccountExtractionNode extends BaseNodeExecutor {
  type = 'ai.account-extraction';
  category = 'ai' as const;
  label = 'Account Extraction';
  description = 'Extract credit accounts from a report using AI analysis';
  icon = Brain;

  getInputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'report',
        label: 'report',
        dataType: 'creditReport',
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
      {
        id: 'logs',
        label: 'logs',
        dataType: 'any',
        required: false,
      },
    ];
  }

  getConfigSchema(): ConfigSchema {
    return {
      fields: [
        {
          key: 'detectionPrompt',
          label: 'Detection Prompt (JSON)',
          type: 'textarea',
          defaultValue: JSON.stringify(DETECTION_PROMPT_TEMPLATE, null, 2),
          helpText: 'Override the default prompt for detecting accounts. Must be a valid JSON array of messages.',
          placeholder: 'Leave empty to use default detection prompt...',
        },
        {
          key: 'extractionPrompt',
          label: 'Extraction Prompt (JSON)',
          type: 'textarea',
          defaultValue: JSON.stringify(EXTRACTION_PROMPT_TEMPLATE, null, 2),
          helpText: 'Override the default prompt for extracting account details. Must be a valid JSON array of messages.',
          placeholder: 'Leave empty to use default extraction prompt...',
        }
      ],
    };
  }

  validate(config: Record<string, any>): ValidationResult {
    const errors: string[] = [];

    if (config.detectionPrompt) {
      try {
        const parsed = JSON.parse(config.detectionPrompt);
        if (!Array.isArray(parsed)) errors.push('Detection prompt must be a JSON array');
      } catch (e) {
        errors.push('Detection prompt must be valid JSON');
      }
    }

    if (config.extractionPrompt) {
      try {
        const parsed = JSON.parse(config.extractionPrompt);
        if (!Array.isArray(parsed)) errors.push('Extraction prompt must be a JSON array');
      } catch (e) {
        errors.push('Extraction prompt must be valid JSON');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  async execute(
    inputs: Record<string, any>,
    config: Record<string, any>,
    context: ExecutionContext
  ): Promise<Record<string, any>> {
    this.checkAbort(context);

    const report = inputs.report as CreditReport;
    if (!report) {
      throw new Error('No credit report provided');
    }

    try {
      // Use existing account extraction function with optional prompts
      const { accounts, logs } = await extractAccountsFromReport(
        report,
        config.detectionPrompt,
        config.extractionPrompt
      );

      return {
        accounts,
        logs,
      };
    } catch (error: any) {
      throw new Error(`Failed to extract accounts: ${error.message}`);
    }
  }
}
