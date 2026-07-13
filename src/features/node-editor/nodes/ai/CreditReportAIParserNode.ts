import { BaseNodeExecutor } from '../base/BaseNodeExecutor';
import {
  NodePort,
  ConfigSchema,
  ValidationResult,
  ExecutionContext,
} from '../../core/types';
import { Brain } from 'lucide-react';
import { parseWithAI } from '@/lib/ai/creditReportParsing';

/**
 * Credit Report AI Parser Node
 * AI-first credit report parsing
 */
export class CreditReportAIParserNode extends BaseNodeExecutor {
  type = 'ai.parse-with-ai';
  category = 'ai' as const;
  label = 'Credit Report AI Parser';
  description = 'AI-first credit report parsing';
  icon = Brain;

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
        id: 'partialReport',
        label: 'partialReport',
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
      const partialReport = await parseWithAI(inputs.text as string);

      return {
        partialReport,
      };
    } catch (error: any) {
      throw new Error(`AI parsing failed: ${error.message}`);
    }
  }
}
