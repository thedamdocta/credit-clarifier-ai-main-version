import { BaseNodeExecutor } from '../base/BaseNodeExecutor';
import {
  NodePort,
  ConfigSchema,
  ValidationResult,
  ExecutionContext,
} from '../../core/types';
import { Hash } from 'lucide-react';
import { getCurrentPdfPageOffsets } from '@/utils/pdf/extractText';

/**
 * Page Number Deriver Node
 * Derive PDF page numbers from anchor index
 */
export class PageNumberDeriverNode extends BaseNodeExecutor {
  type = 'processing.page-numbers';
  category = 'processing' as const;
  label = 'Page Number Deriver';
  description = 'Find PDF page numbers for anchor location';
  icon = Hash;

  getInputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'anchorIndex',
        label: 'anchorIndex',
        dataType: 'any',
        required: true,
      },
      {
        id: 'totalPages',
        label: 'totalPages',
        dataType: 'any',
        required: true,
      },
    ];
  }

  getOutputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'pageNumbers',
        label: 'pageNumbers',
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

    const anchorIndex = inputs.anchorIndex as number;
    const totalPages = inputs.totalPages as number;

    if (typeof anchorIndex !== 'number') {
      throw new Error('No anchor index provided');
    }

    if (typeof totalPages !== 'number') {
      throw new Error('No total pages provided');
    }

    const offsets = getCurrentPdfPageOffsets();
    if (!offsets || offsets.length === 0) {
      return { pageNumbers: [] };
    }

    let anchorPage = offsets[0].page;
    for (const entry of offsets) {
      if (anchorIndex >= entry.start && anchorIndex < entry.end) {
        anchorPage = entry.page;
        break;
      }
    }

    const pages = [anchorPage];
    if (anchorPage + 1 <= totalPages) pages.push(anchorPage + 1);
    if (anchorPage + 2 <= totalPages) pages.push(anchorPage + 2);

    return {
      pageNumbers: pages,
    };
  }
}
