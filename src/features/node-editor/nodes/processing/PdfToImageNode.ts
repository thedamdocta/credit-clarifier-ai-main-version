import { BaseNodeExecutor } from '../base/BaseNodeExecutor';
import {
  NodePort,
  ConfigSchema,
  ValidationResult,
  ExecutionContext,
} from '../../core/types';
import { Image } from 'lucide-react';
import { convertPDFPageToImage } from '@/utils/pdf/pdfToImage';

/**
 * PDF to Image Node
 * Converts PDF pages to images
 */
export class PdfToImageNode extends BaseNodeExecutor {
  type = 'processing.pdf-to-image';
  category = 'processing' as const;
  label = 'PDF to Image';
  description = 'Convert PDF pages to images';
  icon = Image;

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
        id: 'images',
        label: 'images',
        dataType: 'any',
        required: false,
      },
    ];
  }

  getConfigSchema(): ConfigSchema {
    return {
      fields: [
        {
          key: 'pageNumber',
          label: 'Page Number',
          type: 'number',
          defaultValue: 1,
          required: false,
          min: 1,
          helpText: 'Specific page to convert (leave empty for all pages)',
        },
        {
          key: 'scale',
          label: 'Scale',
          type: 'number',
          defaultValue: 2,
          required: false,
          min: 0.5,
          max: 5,
          helpText: 'Image scale factor (higher = better quality, larger file)',
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

    const file = inputs.file as File;
    if (!file) {
      throw new Error('No file provided');
    }

    const scale = config.scale || 2;
    const pageNumber = config.pageNumber;

    try {
      const imageDataUrl = await convertPDFPageToImage(file, pageNumber || 1, scale);

      return {
        images: pageNumber ? [imageDataUrl] : [imageDataUrl], // For now, single page
      };
    } catch (error: any) {
      throw new Error(`Failed to convert PDF to image: ${error.message}`);
    }
  }
}
