import { BaseNodeExecutor } from '../base/BaseNodeExecutor';
import {
  NodePort,
  ConfigSchema,
  ValidationResult,
  ExecutionContext,
} from '../../core/types';
import { Crosshair } from 'lucide-react';
import { devDiagnostics } from "@/lib/security/devDiagnostics";

/**
 * Anchor Text Finder Node
 * Find text position using regex matching
 */
export class AnchorTextFinderNode extends BaseNodeExecutor {
  type = 'transform.find-anchor';
  category = 'transform' as const;
  label = 'Anchor Text Finder';
  description = 'Find text position using regex matching';
  icon = Crosshair;

  getInputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'text',
        label: 'text',
        dataType: 'text',
        required: true,
      },
      {
        id: 'anchor',
        label: 'anchor',
        dataType: 'text',
        required: true,
      },
      {
        id: 'fallback',
        label: 'fallback',
        dataType: 'text',
        required: false,
      },
    ];
  }

  getOutputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'anchorIndex',
        label: 'anchorIndex',
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

    const text = inputs.text as string;
    const anchor = inputs.anchor as string;
    const fallback = inputs.fallback as string;

    if (!text) {
      throw new Error('No text provided');
    }

    if (!anchor) {
      throw new Error('No anchor text provided');
    }

    // Create regex with flexible whitespace (replace \s+ with flexible matching)
    const createFlexibleRegex = (pattern: string): RegExp => {
      const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const flexible = escaped.replace(/\s+/g, '\\s+');
      return new RegExp(flexible, 'i');
    };

    let anchorIndex = -1;

    // Try to find anchor
    try {
      const regex = createFlexibleRegex(anchor);
      const match = text.match(regex);
      if (match && match.index !== undefined) {
        anchorIndex = match.index;
      }
    } catch (error: any) {
      devDiagnostics.warn(`Anchor regex failed: ${error.message}`);
    }

    // Try fallback if anchor not found
    if (anchorIndex === -1 && fallback) {
      try {
        const fallbackRegex = createFlexibleRegex(fallback);
        const match = text.match(fallbackRegex);
        if (match && match.index !== undefined) {
          anchorIndex = match.index;
        }
      } catch (error: any) {
        devDiagnostics.warn(`Fallback anchor regex failed: ${error.message}`);
      }
    }

    return {
      anchorIndex: anchorIndex !== -1 ? anchorIndex : 0,
    };
  }
}
