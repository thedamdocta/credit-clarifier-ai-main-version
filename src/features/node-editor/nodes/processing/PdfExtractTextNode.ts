import { BaseNodeExecutor } from '../base/BaseNodeExecutor';
import {
  NodePort,
  ConfigSchema,
  ValidationResult,
  ExecutionContext,
} from '../../core/types';
import { FileText } from 'lucide-react';
import { extractTextFromPDF } from '@/utils/pdf/extractText';

/**
 * PDF Extract Text Node
 * Extracts text content from a PDF file
 */
export class PdfExtractTextNode extends BaseNodeExecutor {
  type = 'processing.pdf-extract-text';
  category = 'processing' as const;
  label = 'PDF Extract Text';
  description = 'Extract text content from a PDF file using PDF.js';
  icon = FileText;

  getInputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'file',
        label: 'file',
        dataType: 'file',
        required: true,
      },
    ];
  }

  getOutputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'text',
        label: 'text',
        dataType: 'text',
        required: false,
      },
      {
        id: 'pageCount',
        label: 'pageCount',
        dataType: 'any',
        required: false,
      },
      {
        id: 'pageOffsets',
        label: 'pageOffsets',
        dataType: 'any',
        required: false,
      },
    ];
  }

  getConfigSchema(): ConfigSchema {
    return {
      fields: [], // No configuration needed
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

    const file = inputs.file as File;
    if (!file) {
      throw new Error('No file provided');
    }

    try {
      // Use existing PDF extraction function
      const result = await extractTextFromPDF(file);

      return {
        text: result.text,
        pageCount: result.pageCount,
        pageOffsets: result.pageOffsets,
      };
    } catch (error: any) {
      throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }
  }
}
