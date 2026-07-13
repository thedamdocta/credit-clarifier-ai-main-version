import { BaseNodeExecutor } from '../base/BaseNodeExecutor';
import {
  NodePort,
  ConfigSchema,
  ValidationResult,
  ExecutionContext,
} from '../../core/types';
import { Image } from 'lucide-react';
import { getCurrentPdfDocument } from '@/utils/pdf/extractText';
import { convertPDFPageToImage } from '@/utils/pdf/pdfToImage';
import { devDiagnostics } from "@/lib/security/devDiagnostics";

/**
 * Debug Page Image Builder Node
 * Convert PDF pages to debug images
 */
export class DebugPageImageBuilderNode extends BaseNodeExecutor {
  type = 'processing.debug-images';
  category = 'processing' as const;
  label = 'Debug Page Image Builder';
  description = 'Convert PDF pages to base64 images';
  icon = Image;

  getInputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'pageNumbers',
        label: 'pageNumbers',
        dataType: 'any',
        required: true,
      },
    ];
  }

  getOutputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'debugPageImages',
        label: 'debugPageImages',
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

    const pageNumbers = inputs.pageNumbers as number[];

    if (!pageNumbers || !Array.isArray(pageNumbers) || pageNumbers.length === 0) {
      return { debugPageImages: [] };
    }

    const pdfDocument = getCurrentPdfDocument();
    if (!pdfDocument) {
      return { debugPageImages: [] };
    }

    const validPages = Array.from(new Set(pageNumbers)).filter(
      (page) => page >= 1 && page <= pdfDocument.numPages
    );

    const pageImageMap = new Map<number, string>();

    for (const page of validPages) {
      try {
        const image = await convertPDFPageToImage(pdfDocument, page);
        if (image) {
          pageImageMap.set(page, image);
        } else {
          pageImageMap.set(page, '');
        }
      } catch (error) {
        devDiagnostics.error(`Failed to generate image for page ${page}`, error);
        pageImageMap.set(page, '');
      }
    }

    const debugPageImages = pageNumbers.map((page) => pageImageMap.get(page) ?? '');

    return {
      debugPageImages,
    };
  }
}
