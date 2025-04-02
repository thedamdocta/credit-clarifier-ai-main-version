
/**
 * Types related to table extraction functionality
 */

// Interface for structured table data
export interface ExtractedTableData {
  headers: string[];
  rows: string[][];
  confidence: number;
  text?: string; // Add optional text property to store the raw OCR text
}

// Interface for formatted table data ready for use in the app
export interface FormattedTableData {
  headers: string[];
  rows: Record<string, string>[];
}
