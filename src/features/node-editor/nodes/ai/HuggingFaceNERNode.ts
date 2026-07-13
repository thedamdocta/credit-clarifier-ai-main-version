import { BaseNodeExecutor } from '../base/BaseNodeExecutor';
import {
  NodePort,
  ConfigSchema,
  ValidationResult,
  ExecutionContext,
} from '../../core/types';
import { Sparkles } from 'lucide-react';
import { extractEntities } from '@/lib/ai/textAnalysis';

/**
 * Hugging Face NER Node
 * Named Entity Recognition using Hugging Face Transformers
 */
export class HuggingFaceNERNode extends BaseNodeExecutor {
  type = 'ai.huggingface-ner';
  category = 'ai' as const;
  label = 'Hugging Face NER';
  description = 'Extract named entities (people, orgs, locations)';
  icon = Sparkles;

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
        id: 'entities',
        label: 'entities',
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
      const entities = await extractEntities(text);

      return {
        entities,
      };
    } catch (error: any) {
      throw new Error(`NER extraction failed: ${error.message}`);
    }
  }
}
