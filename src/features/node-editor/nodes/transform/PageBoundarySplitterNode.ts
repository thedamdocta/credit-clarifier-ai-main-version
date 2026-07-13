import { BaseNodeExecutor } from '../base/BaseNodeExecutor';
import {
  NodePort,
  ConfigSchema,
  ValidationResult,
  ExecutionContext,
} from '../../core/types';
import { Scissors } from 'lucide-react';

/**
 * Page Boundary Splitter Node
 * Split text into pages by form feeds or page labels
 */
export class PageBoundarySplitterNode extends BaseNodeExecutor {
  type = 'transform.split-pages';
  category = 'transform' as const;
  label = 'Page Boundary Splitter';
  description = 'Split text into pages by form feeds or page labels';
  icon = Scissors;

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
        id: 'pages',
        label: 'pages',
        dataType: 'any',
        required: false,
      },
    ];
  }

  getConfigSchema(): ConfigSchema {
    return {
      fields: [
        {
          key: 'minPageCount',
          label: 'Minimum Page Count',
          type: 'number',
          defaultValue: 3,
          required: false,
          min: 1,
          max: 1000,
          helpText: 'Minimum number of pages expected',
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
    const minPageCount = config.minPageCount || 3;

    if (!text) {
      throw new Error('No text provided');
    }

    let pages: string[] = [];

    // First try splitting by form feed character (\f)
    const formFeedPages = text.split('\f').filter(page => page.trim().length > 0);

    if (formFeedPages.length >= minPageCount) {
      pages = formFeedPages;
    } else {
      // Try splitting by "Page X" labels
      const pageRegex = /Page\s+\d+/gi;
      const matches = Array.from(text.matchAll(new RegExp(pageRegex.source, 'gi')));

      if (matches.length >= minPageCount - 1) {
        // Split at each "Page X" marker
        const splits: string[] = [];
        let lastIndex = 0;

        for (const match of matches) {
          if (match.index !== undefined && match.index > lastIndex) {
            splits.push(text.substring(lastIndex, match.index));
            lastIndex = match.index;
          }
        }

        // Add the last section
        if (lastIndex < text.length) {
          splits.push(text.substring(lastIndex));
        }

        pages = splits.filter(page => page.trim().length > 0);
      } else {
        // Fallback: treat entire text as a single page
        pages = [text];
      }
    }

    return {
      pages,
    };
  }
}
