import { BaseNodeExecutor } from '../base/BaseNodeExecutor';
import {
  NodePort,
  ConfigSchema,
  ValidationResult,
  ExecutionContext,
} from '../../core/types';
import { Building } from 'lucide-react';
import { identifyBureauWithAI } from '@/lib/ai/entityExtraction';

/**
 * Bureau Identifier AI Node
 * AI-enhanced bureau detection
 */
export class BureauIdentifierAINode extends BaseNodeExecutor {
  type = 'ai.identify-bureau-ai';
  category = 'ai' as const;
  label = 'Bureau Identifier AI';
  description = 'AI-enhanced bureau detection';
  icon = Building;

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
        id: 'bureau',
        label: 'bureau',
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
      const bureau = await identifyBureauWithAI(inputs.text as string);

      return {
        bureau,
      };
    } catch (error: any) {
      throw new Error(`Bureau identification failed: ${error.message}`);
    }
  }
}
