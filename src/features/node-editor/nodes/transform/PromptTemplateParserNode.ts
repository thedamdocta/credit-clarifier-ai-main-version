import { BaseNodeExecutor } from '../base/BaseNodeExecutor';
import {
  NodePort,
  ConfigSchema,
  ValidationResult,
  ExecutionContext,
} from '../../core/types';
import { FileCode } from 'lucide-react';

/**
 * Prompt Template Parser Node
 * Parse and validate JSON prompt templates
 */
export class PromptTemplateParserNode extends BaseNodeExecutor {
  type = 'transform.parse-prompt-template';
  category = 'transform' as const;
  label = 'Prompt Template Parser';
  description = 'Parse and validate JSON prompt templates';
  icon = FileCode;

  getInputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'detectionTemplate',
        label: 'detectionTemplate',
        dataType: 'text',
        required: true,
      },
      {
        id: 'extractionTemplate',
        label: 'extractionTemplate',
        dataType: 'text',
        required: true,
      },
    ];
  }

  getOutputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'parsedDetectionTemplate',
        label: 'parsedDetectionTemplate',
        dataType: 'any',
        required: false,
      },
      {
        id: 'parsedExtractionTemplate',
        label: 'parsedExtractionTemplate',
        dataType: 'any',
        required: false,
      },
      {
        id: 'errors',
        label: 'errors',
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

    const detectionTemplate = inputs.detectionTemplate as string;
    const extractionTemplate = inputs.extractionTemplate as string;

    const errors: string[] = [];
    let parsedDetectionTemplate: any = null;
    let parsedExtractionTemplate: any = null;

    // Try to parse detection template
    if (detectionTemplate) {
      try {
        parsedDetectionTemplate = JSON.parse(detectionTemplate);
      } catch (error: any) {
        errors.push(`Detection template parse error: ${error.message}`);
      }
    }

    // Try to parse extraction template
    if (extractionTemplate) {
      try {
        parsedExtractionTemplate = JSON.parse(extractionTemplate);
      } catch (error: any) {
        errors.push(`Extraction template parse error: ${error.message}`);
      }
    }

    return {
      parsedDetectionTemplate,
      parsedExtractionTemplate,
      errors: errors.length > 0 ? errors : null,
    };
  }
}
