import { BaseNodeExecutor } from '../base/BaseNodeExecutor';
import {
  NodePort,
  ConfigSchema,
  ValidationResult,
  ExecutionContext,
} from '../../core/types';
import { FileStack } from 'lucide-react';

const DEFAULT_DEBUG_PAGE_COUNT = 3;

/**
 * Debug Page Creator Node
 * Split snippet into debug pages for visualization
 */
export class DebugPageCreatorNode extends BaseNodeExecutor {
  type = 'transform.debug-pages';
  category = 'transform' as const;
  label = 'Debug Page Creator';
  description = 'Split snippet into debug page chunks';
  icon = FileStack;

  getInputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'snippet',
        label: 'snippet',
        dataType: 'text',
        required: true,
      },
    ];
  }

  getOutputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'debugPages',
        label: 'debugPages',
        dataType: 'any',
        required: false,
      },
    ];
  }

  getConfigSchema(): ConfigSchema {
    return {
      fields: [
        {
          key: 'pageCount',
          label: 'Page Count',
          type: 'number',
          required: false,
          defaultValue: DEFAULT_DEBUG_PAGE_COUNT,
        },
      ],
    };
  }

  validate(config: Record<string, any>): ValidationResult {
    return { valid: true, errors: [] };
  }

  private normalizeWhitespace(value: string): string {
    return value.replace(/\r/g, '');
  }

  private splitOnPageBoundaries(text: string): string[] {
    const byFormFeed = text.split(/\f+/).map((chunk) => chunk.trim()).filter(Boolean);
    if (byFormFeed.length >= DEFAULT_DEBUG_PAGE_COUNT) {
      return byFormFeed;
    }

    const byPageLabel = text.split(/(?:\n|\r)\s*page\s+\d+/i).map((chunk) => chunk.trim()).filter(Boolean);
    if (byPageLabel.length >= DEFAULT_DEBUG_PAGE_COUNT) {
      return byPageLabel;
    }

    return [];
  }

  private chunkSnippet(text: string, count: number): string[] {
    if (!text) return [];
    const clean = text.trim();
    if (!clean) return [];

    const chunkLength = Math.max(Math.ceil(clean.length / count), 900);
    const chunks: string[] = [];
    for (let i = 0; i < count; i++) {
      const start = i * chunkLength;
      if (start >= clean.length) {
        break;
      }
      const end = Math.min(clean.length, start + chunkLength);
      chunks.push(clean.slice(start, end).trim());
    }
    return chunks;
  }

  async execute(
    inputs: Record<string, any>,
    config: Record<string, any>,
    context: ExecutionContext
  ): Promise<Record<string, any>> {
    this.checkAbort(context);

    const snippet = inputs.snippet as string;
    if (!snippet) {
      return { debugPages: [] };
    }

    const pageCount = config.pageCount || DEFAULT_DEBUG_PAGE_COUNT;
    const normalized = this.normalizeWhitespace(snippet);

    const pageSegments = this.splitOnPageBoundaries(normalized);
    if (pageSegments.length >= pageCount) {
      return { debugPages: pageSegments.slice(0, pageCount) };
    }

    const chunks = this.chunkSnippet(normalized, pageCount);
    const filled = chunks.slice(0, pageCount);

    while (filled.length < pageCount) {
      filled.push('');
    }

    return {
      debugPages: filled,
    };
  }
}
