import { BaseNodeExecutor } from '../base/BaseNodeExecutor';
import {
  NodePort,
  ConfigSchema,
  ValidationResult,
  ExecutionContext,
} from '../../core/types';
import { Upload } from 'lucide-react';

/**
 * PDF Upload Node
 * Provides a file input for uploading PDF files
 */
export class PdfUploadNode extends BaseNodeExecutor {
  type = 'input.pdf-upload';
  category = 'input' as const;
  label = 'PDF Upload';
  description = 'Upload a PDF file to process';
  icon = Upload;

  getInputPorts(config: Record<string, any>): NodePort[] {
    return []; // No inputs - this is a source node
  }

  getOutputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'file',
        label: 'file',
        dataType: 'file',
        required: false,
      },
      {
        id: 'metadata',
        label: 'metadata',
        dataType: 'any',
        required: false,
      },
    ];
  }

  getConfigSchema(): ConfigSchema {
    return {
      fields: [
        {
          key: 'file',
          label: 'PDF File',
          type: 'file',
          defaultValue: null,
          required: true,
          helpText: 'Select a PDF file to upload',
        },
      ],
    };
  }

  validate(config: Record<string, any>): ValidationResult {
    const errors: string[] = [];

    if (!config.file) {
      errors.push('Please select a PDF file');
    } else if (!(config.file instanceof File)) {
      errors.push('Invalid file object');
    } else if (!config.file.name.toLowerCase().endsWith('.pdf')) {
      errors.push('File must be a PDF');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async execute(
    inputs: Record<string, any>,
    config: Record<string, any>,
    context: ExecutionContext
  ): Promise<Record<string, any>> {
    this.checkAbort(context);

    const file = config.file as File;

    // Extract metadata
    const metadata = {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
    };

    return {
      file,
      metadata,
    };
  }
}
