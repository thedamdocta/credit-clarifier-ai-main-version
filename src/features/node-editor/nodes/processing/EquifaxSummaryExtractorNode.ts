import { BaseNodeExecutor } from '../base/BaseNodeExecutor';
import {
  NodePort,
  ConfigSchema,
  ValidationResult,
  ExecutionContext,
} from '../../core/types';
import { FileText } from 'lucide-react';
import { extractReportSummaryWithAI } from '@/lib/ai/summaryExtraction';

/**
 * Equifax Summary Extractor Node
 * Extracts structured summary fields from Equifax credit reports
 */
export class EquifaxSummaryExtractorNode extends BaseNodeExecutor {
  type = 'processing.equifax-summary';
  category = 'processing' as const;
  label = 'Equifax Summary Extractor';
  description = 'Extract summary fields (alerts, account age, credit history, etc.)';
  icon = FileText;

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
        id: 'summaryData',
        label: 'summaryData',
        dataType: 'any',
        required: false,
      },
    ];
  }

  getConfigSchema(): ConfigSchema {
    return {
      fields: [],
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

    try {
      const summaryData = await extractReportSummaryWithAI(text);

      return {
        summaryData,
      };
    } catch (error: any) {
      throw new Error(`Summary extraction failed: ${error.message}`);
    }
  }
}
