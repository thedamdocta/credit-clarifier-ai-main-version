
/**
 * Types for table extraction functionality
 */

export interface ExtractedTableData {
  headers: string[];
  rows: string[][];
  confidence?: number;
  text?: string;
  imageUrl?: string;
}

/**
 * Structure for a processed table row
 */
export interface TableRow {
  [column: string]: string;
}

/**
 * Complete table structure with headers and rows
 */
export interface ExtractedTable {
  headers: string[];
  rows: TableRow[];
  imageUrl?: string;
}

/**
 * Formatted table data returned after processing
 */
export interface FormattedTableData {
  headers: string[];
  rows: Record<string, string>[];
}
