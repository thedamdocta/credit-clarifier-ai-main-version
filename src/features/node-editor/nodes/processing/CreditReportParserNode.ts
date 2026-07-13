import { BaseNodeExecutor } from '../base/BaseNodeExecutor';
import {
  NodePort,
  ConfigSchema,
  ValidationResult,
  ExecutionContext,
} from '../../core/types';
import { FileSearch } from 'lucide-react';
import { parseCreditReport } from '@/lib/creditReportParser';

/**
 * Credit Report Parser Node
 * Parses extracted text into a structured credit report
 */
export class CreditReportParserNode extends BaseNodeExecutor {
  type = 'processing.credit-report-parser';
  category = 'processing' as const;
  label = 'Credit Report Parser';
  description = 'Parse extracted text into a structured credit report object';
  icon = FileSearch;

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
        id: 'report',
        label: 'report',
        dataType: 'creditReport',
        required: false,
      },
    ];
  }

  getConfigSchema(): ConfigSchema {
    return {
      fields: [
        {
          key: 'useAI',
          label: 'Use AI Enhancement',
          type: 'boolean',
          defaultValue: true,
          helpText: 'Enable AI-powered parsing with Hugging Face models',
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

    const useAI = config.useAI !== undefined ? config.useAI : true;

    try {
      // Use existing credit report parser
      const report = await parseCreditReport(text, useAI);

      return {
        report,
      };
    } catch (error: any) {
      throw new Error(`Failed to parse credit report: ${error.message}`);
    }
  }
}
