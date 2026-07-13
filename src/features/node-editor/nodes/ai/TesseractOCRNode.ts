import { BaseNodeExecutor } from '../base/BaseNodeExecutor';
import {
  NodePort,
  ConfigSchema,
  ValidationResult,
  ExecutionContext,
} from '../../core/types';
import { ScanText } from 'lucide-react';
import { extractTextFromImageWithOCR } from '@/lib/ai/ocrExtraction';

/**
 * Tesseract OCR Node
 * Optical Character Recognition using Tesseract.js
 */
export class TesseractOCRNode extends BaseNodeExecutor {
  type = 'ai.tesseract-ocr';
  category = 'ai' as const;
  label = 'Tesseract OCR';
  description = 'Extract text from images using OCR';
  icon = ScanText;

  getInputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'image',
        label: 'image',
        dataType: 'image',
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
        id: 'confidence',
        label: 'confidence',
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

    const image = inputs.image as string;
    if (!image) {
      throw new Error('No image provided');
    }

    try {
      const text = await extractTextFromImageWithOCR(image);

      return {
        text: text || '',
        confidence: text ? 1 : 0,
      };
    } catch (error: any) {
      throw new Error(`OCR extraction failed: ${error.message}`);
    }
  }
}
