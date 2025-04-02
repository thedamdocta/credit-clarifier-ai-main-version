
import { pipeline } from '@huggingface/transformers';

// Configuration for AI cell processing
const AI_CELL_ENABLED = true;  // Toggle to enable/disable AI cell processing
const AI_TIMEOUT_MS = 1500;    // Timeout for AI processing per cell
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
    textProcessorPromise = pipeline('text-classification', TEXT_MODEL);
  }
  return textProcessorPromise;
};

/**
 * Process a single cell using AI to improve data extraction
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
    // Create a context-enhanced prompt for the AI to understand cell better
    const prompt = createCellPrompt(rawValue, cellType, columnName);
    
    // Process with timeout to prevent hanging
    const result = await Promise.race([
      processWithAI(prompt, cellType),
      new Promise<AICellResult>((resolve) => {
        setTimeout(() => resolve(defaultResult), AI_TIMEOUT_MS);
      })
    ]);
    
    return result || defaultResult;
  } catch (error) {
    console.error('Error in AI cell processing:', error);
    return defaultResult;
  }
}

/**
 * Create a specialized prompt for the AI model based on cell type
 */
function createCellPrompt(rawValue: string, cellType: CellType, columnName: string): string {
  // Base context
  let prompt = `Extract the correct value from this text that was OCR'd from a credit report table cell: "${rawValue}". `;
  
  // Add context based on cell type
  switch (cellType) {
    case 'numeric':
      prompt += `This should be a whole number. Column: ${columnName}`;
      break;
    case 'currency':
      prompt += `This should be a currency value with $ sign. Column: ${columnName}`;
      break;
    case 'percentage':
      prompt += `This should be a percentage value with % sign. Column: ${columnName}`;
      break;
    case 'text':
      prompt += `This is text content. Column: ${columnName}`;
      break;
  }
  
  return prompt;
}

/**
 * Process the cell with AI model
 */
async function processWithAI(prompt: string, cellType: CellType): Promise<AICellResult> {
  console.log(`AI processing cell with prompt: ${prompt}`);
  
  // For dev/demo purposes, simulate AI processing with rules
  // In production, this would call the actual AI model
  await new Promise(resolve => setTimeout(resolve, 100)); // Simulate processing time
  
  let processedValue = '';
  let confidence = 0.95;
  
  // Simple simulation of AI processing based on content patterns
  // In production, this would use the actual AI model response
  if (prompt.includes('currency')) {
    // Extract currency patterns
    const match = prompt.match(/\$?([\d,]+)/);
    processedValue = match ? `$${match[1]}` : '';
    confidence = match ? 0.9 : 0.5;
  } else if (prompt.includes('percentage')) {
    // Extract percentage patterns
    const match = prompt.match(/([\d\.]+)%?/);
    processedValue = match ? `${parseFloat(match[1]).toFixed(1)}%` : '';
    confidence = match ? 0.9 : 0.5;
  } else if (prompt.includes('numeric')) {
    // Extract numeric patterns
    const match = prompt.match(/\b(\d+)\b/);
    processedValue = match ? match[1] : '';
    confidence = match ? 0.95 : 0.5;
  } else {
    // For text, just clean up whitespace
    processedValue = prompt.replace(/Extract.*?"(.*?)"\..*$/s, '$1').trim();
    confidence = 0.8;
  }
  
  return {
    value: processedValue,
    confidence,
    processed: true
  };
}

/**
 * Batch process multiple cells with AI
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
  
  // Process cells in parallel with individual timeouts
  const promises = cells.map(cell => 
    processTableCellWithAI(cell.value, cell.type, cell.columnName)
  );
  
  return Promise.all(promises);
}
