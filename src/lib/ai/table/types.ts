
/**
 * Types related to table extraction functionality
 */

// Interface for structured table data
export interface ExtractedTableData {
  headers: string[];
  rows: string[][];
  confidence: number;
  text?: string; // Store the raw OCR text to help with pattern matching
  imageUrl?: string; // Store the source image URL for debugging
}

// Interface for formatted table data ready for use in the app
export interface FormattedTableData {
  headers: string[];
  rows: Record<string, string>[];
  imageUrl?: string; // Add image URL to formatted data as well
}
