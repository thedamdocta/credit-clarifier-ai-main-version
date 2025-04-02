
import { pipeline, type PretrainedOptions } from '@huggingface/transformers';

// Configuration for AI cell processing - optimized for performance
const AI_CELL_ENABLED = false;  // Disabled by default for better performance
const AI_TIMEOUT_MS = 1000;    // Reduced from 1500ms to 1000ms
const TEXT_MODEL = 'distilbert-base-uncased';  // Lightweight model for text classification

// Types of cell content we need to process
export type CellType = 'numeric' | 'currency' | 'percentage' | 'text';

// Interface for AI cell processing results
interface AICellResult {
  value: string;
  confidence: number;
  processed: boolean;
}

// Cache for AI model to prevent reloading
let textProcessorPromise: Promise<any> | null = null;

/**
 * Get or initialize the text processor pipeline
 */
const getTextProcessor = async () => {
  if (!textProcessorPromise) {
    console.log('Initializing AI text processor for cell processing...');
    const options: PretrainedOptions = {
      // Type-safe way to pass custom options
      ...({} as Record<string, unknown>)
    };
    
    // Add quantized as a custom option
    (options as any).quantized = true;
    
    textProcessorPromise = pipeline('text-classification', TEXT_MODEL, options);
  }
  return textProcessorPromise;
};

/**
 * Process a single cell using AI to improve data extraction
 * Optimized for performance
 * 
 * @param rawValue The raw text extracted from the cell
 * @param cellType The expected type of data in the cell
 * @param columnName The name of the column for context
 * @returns Processed cell value with higher accuracy
 */
export async function processTableCellWithAI(
  rawValue: string | null, 
  cellType: CellType,
  columnName: string
): Promise<AICellResult> {
  // Default result with the original value
  const defaultResult: AICellResult = {
    value: rawValue || '',
    confidence: 0,
    processed: false
  };
  
  // Skip AI processing if disabled or raw value is empty
  if (!AI_CELL_ENABLED || !rawValue || rawValue.trim() === '') {
    return defaultResult;
  }
  
  try {
    // Use rule-based processing instead of AI for better performance
    return processWithRules(rawValue, cellType);
  } catch (error) {
    console.error('Error in AI cell processing:', error);
    return defaultResult;
  }
}

/**
 * Process cell values using rules instead of AI for better performance
 */
function processWithRules(rawValue: string, cellType: CellType): AICellResult {
  let processedValue = rawValue;
  let confidence = 0.9;
  
  // Simple rule-based processing based on expected cell type
  switch (cellType) {
    case 'currency':
      // Clean up currency values
      if (!rawValue.includes('$')) {
        processedValue = `$${rawValue.replace(/[^\d.,\-]/g, '')}`;
      } else {
        processedValue = rawValue.replace(/[^\$\d.,\-]/g, '');
      }
      break;
      
    case 'percentage':
      // Clean up percentage values
      if (!rawValue.includes('%')) {
        processedValue = `${rawValue.replace(/[^\d.,]/g, '')}%`;
      } else {
        processedValue = rawValue.replace(/[^%\d.,]/g, '');
      }
      break;
      
    case 'numeric':
      // Clean up numeric values
      processedValue = rawValue.replace(/[^\d.,\-]/g, '');
      break;
      
    case 'text':
      // Clean up text values
      processedValue = rawValue.trim();
      break;
  }
  
  return {
    value: processedValue,
    confidence,
    processed: true
  };
}

/**
 * Batch process multiple cells with rules instead of AI
 * This is more efficient when processing many cells
 */
export async function batchProcessCells(
  cells: Array<{value: string | null, type: CellType, columnName: string}>
): Promise<AICellResult[]> {
  if (!AI_CELL_ENABLED) {
    return cells.map(cell => ({
      value: cell.value || '',
      confidence: 0,
      processed: false
    }));
  }
  
  // Process cells in parallel - but use rules instead of AI for better performance
  return cells.map(cell => processWithRules(cell.value || '', cell.type));
}
