import { BaseNodeExecutor } from '../base/BaseNodeExecutor';
import {
  NodePort,
  ConfigSchema,
  ValidationResult,
  ExecutionContext,
} from '../../core/types';
import { MessageSquare } from 'lucide-react';

/**
 * Default detection prompt template
 */
const DETECTION_PROMPT_TEMPLATE = [
  {
    role: 'system',
    content: `You are an expert at analyzing credit reports. Your task is to identify and extract account information from credit report text.`,
  },
  {
    role: 'user',
    content: `Please identify up to {{LIMIT}} credit accounts from the following credit report text. Return a JSON array of objects, each containing:
- accountName: The creditor or lender name
- accountNumber: Account number if visible (or null)

Text:
{{TEXT}}

Return ONLY the JSON array, no other text.`,
  },
];

/**
 * Detection Prompt Builder Node
 * Build account detection prompt with variable substitution
 */
export class DetectionPromptBuilderNode extends BaseNodeExecutor {
  type = 'ai.build-detection-prompt';
  category = 'ai' as const;
  label = 'Detection Prompt Builder';
  description = 'Build account detection prompt with variable substitution';
  icon = MessageSquare;

  getInputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'text',
        label: 'text',
        dataType: 'text',
        required: true,
      },
      {
        id: 'customTemplate',
        label: 'customTemplate',
        dataType: 'any',
        required: false,
      },
    ];
  }

  getOutputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'messages',
        label: 'messages',
        dataType: 'any',
        required: false,
      },
    ];
  }

  getConfigSchema(): ConfigSchema {
    return {
      fields: [
        {
          key: 'accountLimit',
          label: 'Account Limit',
          type: 'number',
          defaultValue: 20,
          required: false,
          min: 1,
          max: 100,
          helpText: 'Maximum number of accounts to detect',
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
    const customTemplate = inputs.customTemplate;
    const accountLimit = config.accountLimit || 20;

    if (!text) {
      throw new Error('No text provided');
    }

    // Use custom template or default
    const template = customTemplate || DETECTION_PROMPT_TEMPLATE;

    // Clone and substitute variables
    const messages = JSON.parse(JSON.stringify(template));

    for (const message of messages) {
      if (message.content) {
        message.content = message.content
          .replace(/\{\{LIMIT\}\}/g, String(accountLimit))
          .replace(/\{\{TEXT\}\}/g, text);
      }
    }

    return {
      messages,
    };
  }
}
