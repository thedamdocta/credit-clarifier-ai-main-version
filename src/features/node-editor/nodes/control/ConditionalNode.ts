import { BaseNodeExecutor } from '../base/BaseNodeExecutor';
import {
  NodePort,
  ConfigSchema,
  ValidationResult,
  ExecutionContext,
} from '../../core/types';
import { GitBranch } from 'lucide-react';

/**
 * Conditional Node
 * Route data based on condition (if/else)
 */
export class ConditionalNode extends BaseNodeExecutor {
  type = 'control.conditional';
  category = 'control' as const;
  label = 'Conditional';
  description = 'If/else conditional routing';
  icon = GitBranch;

  getInputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'condition',
        label: 'condition',
        dataType: 'any',
        required: true,
      },
      {
        id: 'trueInput',
        label: 'trueInput',
        dataType: 'any',
        required: false,
      },
      {
        id: 'falseInput',
        label: 'falseInput',
        dataType: 'any',
        required: false,
      },
    ];
  }

  getOutputPorts(config: Record<string, any>): NodePort[] {
    return [
      {
        id: 'result',
        label: 'result',
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

    const condition = inputs.condition;
    const trueInput = inputs.trueInput;
    const falseInput = inputs.falseInput;

    // Evaluate condition
    const isTrue = Boolean(condition);

    return {
      result: isTrue ? trueInput : falseInput,
    };
  }
}
