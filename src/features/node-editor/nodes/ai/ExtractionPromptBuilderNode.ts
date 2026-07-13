import { BaseNodeExecutor } from '../base/BaseNodeExecutor';
import {
  NodePort,
  ConfigSchema,
  ValidationResult,
  ExecutionContext,
} from '../../core/types';
import { MessageSquareText } from 'lucide-react';

/**
 * Default extraction prompt template
 */
const EXTRACTION_PROMPT_TEMPLATE = [
  {
    role: 'system',
    content: `You are an expert at extracting detailed account information from credit reports. Extract all available information accurately.`,
  },
  {
    role: 'user',
    content: `Extract detailed information for the following account from this credit report snippet:

Account Name: {{ACCOUNT_NAME}}
Account Number: {{ACCOUNT_NUMBER}}

Snippet:
{{SNIPPET}}

Return a JSON object with these fields:
- accountName: Creditor/lender name
- accountNumber: Account number
- balance: Current balance (number or null)
- creditLimit: Credit limit (number or null)
- paymentStatus: Payment status (e.g., "Current", "Past Due")
- dateOpened: Date account was opened
- lastPaymentDate: Last payment date
- monthsReviewed: Number of months in review
- comments: Any additional notes

Return ONLY the JSON object, no other text.`,
  },
];

/**
 * Extraction Prompt Builder Node
 * Build single account extraction prompt
 */
export class ExtractionPromptBuilderNode extends BaseNodeExecutor {
  type = 'ai.build-extraction-prompt';
  category = 'ai' as const;
  label = 'Extraction Prompt Builder';
  description = 'Build single account extraction prompt';
  icon = MessageSquareText;

  getInputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'snippet',
        label: 'snippet',
        dataType: 'text',
        required: true,
      },
      {
        id: 'accountName',
        label: 'accountName',
        dataType: 'text',
        required: true,
      },
      {
        id: 'accountNumber',
        label: 'accountNumber',
        dataType: 'text',
        required: false,
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

    const snippet = inputs.snippet as string;
    const accountName = inputs.accountName as string;
    const accountNumber = inputs.accountNumber as string;
    const customTemplate = inputs.customTemplate;

    if (!snippet) {
      throw new Error('No snippet provided');
    }

    if (!accountName) {
      throw new Error('No account name provided');
    }

    // Use custom template or default
    const template = customTemplate || EXTRACTION_PROMPT_TEMPLATE;

    // Clone and substitute variables
    const messages = JSON.parse(JSON.stringify(template));

    for (const message of messages) {
      if (message.content) {
        message.content = message.content
          .replace(/\{\{SNIPPET\}\}/g, snippet)
          .replace(/\{\{ACCOUNT_NAME\}\}/g, accountName)
          .replace(/\{\{ACCOUNT_NUMBER\}\}/g, accountNumber || 'Not provided');
      }
    }

    return {
      messages,
    };
  }
}
