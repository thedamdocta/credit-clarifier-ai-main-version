import { BaseNodeExecutor } from '../base/BaseNodeExecutor';
import {
  NodePort,
  ConfigSchema,
  ValidationResult,
  ExecutionContext,
} from '../../core/types';
import { Scissors } from 'lucide-react';

const MAX_SNIPPET_LENGTH = 6500;
const SNIPPET_PADDING = 2200;

/**
 * Account Snippet Builder Node
 * Extract text snippet around account anchor point
 */
export class AccountSnippetBuilderNode extends BaseNodeExecutor {
  type = 'transform.account-snippet';
  category = 'transform' as const;
  label = 'Account Snippet Builder';
  description = 'Build text snippet around anchor index';
  icon = Scissors;

  getInputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'text',
        label: 'text',
        dataType: 'text',
        required: true,
      },
      {
        id: 'anchorIndex',
        label: 'anchorIndex',
        dataType: 'any',
        required: true,
      },
    ];
  }

  getOutputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'snippet',
        label: 'snippet',
        dataType: 'text',
        required: false,
      },
    ];
  }

  getConfigSchema(): ConfigSchema {
    return {
      fields: [
        {
          key: 'snippetPadding',
          label: 'Snippet Padding',
          type: 'number',
          required: false,
          defaultValue: SNIPPET_PADDING,
        },
        {
          key: 'maxSnippetLength',
          label: 'Max Snippet Length',
          type: 'number',
          required: false,
          defaultValue: MAX_SNIPPET_LENGTH,
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
    const anchorIndex = inputs.anchorIndex as number;

    if (!text) {
      throw new Error('No text provided');
    }

    if (typeof anchorIndex !== 'number') {
      throw new Error('No anchor index provided');
    }

    const padding = config.snippetPadding || SNIPPET_PADDING;
    const maxLength = config.maxSnippetLength || MAX_SNIPPET_LENGTH;

    const start = Math.max(0, anchorIndex - padding);
    const end = Math.min(text.length, anchorIndex + maxLength);
    const snippet = text.slice(start, end);

    return {
      snippet,
    };
  }
}
