
/**
 * Types related to table extraction functionality
 */

// Interface for structured table data
export interface ExtractedTableData {
  headers: string[];
  rows: string[][];
  confidence: number;
  matchScore?: number;
  isTargetTable?: boolean;
  text?: string; // Add text property that's being referenced
}

// Interface for formatted table data ready for use in the app
export interface FormattedTableData {
  headers: string[];
  rows: Record<string, string>[];
  matchScore?: number;
}
