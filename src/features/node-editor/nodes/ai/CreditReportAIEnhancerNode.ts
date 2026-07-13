import { BaseNodeExecutor } from '../base/BaseNodeExecutor';
import {
  NodePort,
  ConfigSchema,
  ValidationResult,
  ExecutionContext,
} from '../../core/types';
import { Sparkles } from 'lucide-react';
import { enhanceCreditReportWithAI } from '@/lib/ai/creditReportParsing';

/**
 * Credit Report AI Enhancer Node
 * Use NER to improve personal info extraction
 */
export class CreditReportAIEnhancerNode extends BaseNodeExecutor {
  type = 'ai.enhance-report';
  category = 'ai' as const;
  label = 'Credit Report AI Enhancer';
  description = 'Use NER to improve personal info extraction';
  icon = Sparkles;

  getInputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'text',
        label: 'text',
        dataType: 'text',
        required: true,
      },
      {
        id: 'partialReport',
        label: 'partialReport',
        dataType: 'any',
        required: true,
      },
    ];
  }

  getOutputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'enhancedReport',
        label: 'enhancedReport',
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

    const partialReport = inputs.partialReport;
    if (!partialReport) {
      throw new Error('No partial report provided');
    }

    try {
      const enhancedReport = await enhanceCreditReportWithAI(
        inputs.text as string,
        inputs.partialReport
      );

      return {
        enhancedReport,
      };
    } catch (error: any) {
      throw new Error(`AI enhancement failed: ${error.message}`);
    }
  }
}
