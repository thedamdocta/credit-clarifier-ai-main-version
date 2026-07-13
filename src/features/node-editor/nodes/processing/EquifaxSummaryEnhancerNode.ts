import { BaseNodeExecutor } from '../base/BaseNodeExecutor';
import {
  NodePort,
  ConfigSchema,
  ValidationResult,
  ExecutionContext,
} from '../../core/types';
import { Sparkles } from 'lucide-react';
import { enhanceEquifaxSummaryWithAI } from '@/lib/ai/summaryExtraction';

/**
 * Equifax Summary Enhancer Node
 * Merges AI-extracted summary data with existing summary
 */
export class EquifaxSummaryEnhancerNode extends BaseNodeExecutor {
  type = 'processing.equifax-summary-enhance';
  category = 'processing' as const;
  label = 'Equifax Summary Enhancer';
  description = 'Merge AI-extracted summary with existing data';
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
        id: 'existingSummary',
        label: 'existingSummary',
        dataType: 'any',
        required: true,
      },
    ];
  }

  getOutputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'enhancedSummary',
        label: 'enhancedSummary',
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
    const existingSummary = inputs.existingSummary;

    if (!text) {
      throw new Error('No text provided');
    }

    if (!existingSummary) {
      throw new Error('No existing summary provided');
    }

    try {
      const enhancedSummary = await enhanceEquifaxSummaryWithAI(text, existingSummary);

      return {
        enhancedSummary,
      };
    } catch (error: any) {
      throw new Error(`Summary enhancement failed: ${error.message}`);
    }
  }
}
