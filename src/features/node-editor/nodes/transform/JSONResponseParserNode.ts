import { BaseNodeExecutor } from '../base/BaseNodeExecutor';
import {
  NodePort,
  ConfigSchema,
  ValidationResult,
  ExecutionContext,
} from '../../core/types';
import { Braces } from 'lucide-react';

/**
 * JSON Response Parser Node
 * Extract JSON from markdown code blocks
 */
export class JSONResponseParserNode extends BaseNodeExecutor {
  type = 'transform.extract-json';
  category = 'transform' as const;
  label = 'JSON Response Parser';
  description = 'Extract JSON from markdown code blocks';
  icon = Braces;

  getInputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'responseText',
        label: 'responseText',
        dataType: 'text',
        required: true,
      },
    ];
  }

  getOutputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'parsedJson',
        label: 'parsedJson',
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

    const responseText = inputs.responseText as string;
    if (!responseText) {
      throw new Error('No response text provided');
    }

    let jsonText = responseText.trim();

    // Try to extract from markdown code blocks first
    const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1].trim();
    } else {
      // Try to find JSON between first { and last }
      const firstBrace = responseText.indexOf('{');
      const lastBrace = responseText.lastIndexOf('}');

      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonText = responseText.substring(firstBrace, lastBrace + 1);
      }
    }

    try {
      const parsedJson = JSON.parse(jsonText);
      return {
        parsedJson,
      };
    } catch (error: any) {
      throw new Error(`Failed to parse JSON: ${error.message}`);
    }
  }
}
