import { BaseNodeExecutor } from '../base/BaseNodeExecutor';
import {
  NodePort,
  ConfigSchema,
  ValidationResult,
  ExecutionContext,
} from '../../core/types';
import { Building2 } from 'lucide-react';
import { identifyBureau } from '@/lib/parsers/bureauIdentifier';

/**
 * Bureau Identifier Node
 * Identifies which credit bureau the report is from
 */
export class BureauIdentifierNode extends BaseNodeExecutor {
  type = 'processing.bureau-identifier';
  category = 'processing' as const;
  label = 'Bureau Identifier';
  description = 'Identify credit bureau from text';
  icon = Building2;

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
        dataType: 'text',
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

    const bureau = identifyBureau(text);

    return {
      bureau: bureau || 'Unknown',
    };
  }
}
