
/**
 * Safely formats cell values for the account summary tables
 */
export const formatAccountValue = (value: any): string => {
  // Special explicit handling for 0 values - display as "0" not "x"
  if (value === 0 || value === "0") {
    return "0";
  }
  
  // Convert empty, null, or undefined values to "x"
  if (value === undefined || value === null || value === '') {
    return "x"; 
  }
  
  // Always return as string, don't do numeric conversions
  return String(value);
};

/**
 * Formats dollar amounts properly with $ prefix and handles negative values consistently
 */
export const formatDollarAmount = (value: any): string => {
  // Convert empty, null, or undefined values to "x"
  if (value === undefined || value === null || value === '') {
    return "x"; 
  }
  
  // Special handling for 0 - display as "$0"
  if (value === 0 || value === "0" || value === "," || value === "$,") {
    return "$0";
  }

  const stringValue = String(value);
  
  // For values already properly formatted with $ or -$, return as is
  if ((stringValue.startsWith('$') && !stringValue.startsWith('$-')) || 
      stringValue.startsWith('-$')) {
    return stringValue;
  }
  
  // Handle $-XXX format (convert to -$XXX for consistency)
  if (stringValue.startsWith('$-')) {
    return `-$${stringValue.substring(2)}`;
  }
  
  // For numeric-looking strings that should be dollar amounts
  if (!isNaN(Number(stringValue.replace(/[^0-9.-]/g, '')))) {
    // Normalize negative number format to -$XXX
    if (stringValue.startsWith('-')) {
      return `-$${stringValue.substring(1)}`;
    } else {
      return `$${stringValue}`;
    }
  }
  
  return stringValue;
};

/**
 * Format percentage values consistently
 */
export const formatPercentageValue = (value: any): string => {
  // Handle null/undefined/empty
  if (value === undefined || value === null || value === '') {
    return "x";
  }
  
  // Special handling for 0
  if (value === 0 || value === "0" || value === "0%" || value === "," || value === "%") {
    return "0.0%";
  }
  
  const stringValue = String(value);
  
  // If it already has a % symbol, ensure it has a decimal place
  if (stringValue.includes('%')) {
    // Extract the numeric part
    const numMatch = stringValue.match(/(\d+\.?\d*)/);
    if (numMatch && numMatch[1]) {
      const num = parseFloat(numMatch[1]);
      return `${num.toFixed(1)}%`;
    }
    return stringValue; // Keep as is if we can't parse it
  }
  
  // If it's a decimal like "1.16" (representing 116%)
  if (!isNaN(parseFloat(stringValue))) {
    const num = parseFloat(stringValue);
    
    // If less than 5, assume it's in decimal form (e.g. 1.16 means 116%)
    if (num > 0 && num < 5) {
      return `${(num * 100).toFixed(1)}%`;
    }
    // Otherwise assume it's already in percentage form
    return `${num.toFixed(1)}%`;
  }
  
  // If we get here, just add a % if it doesn't have one
  return stringValue.endsWith('%') ? stringValue : `${stringValue}%`;
};

/**
 * Check if a cell value exists and should be displayed
 */
export const hasDisplayValue = (value: any): boolean => {
  // Always return true even for empty values since we'll show "x" 
  return true;
};

/**
 * Detect empty cell positions based on column spacing and expectations
 * This helps identify cells that were skipped during text extraction
 */
export const detectEmptyCells = (line: string, columnPositions: number[]): boolean[] => {
  const emptyCells = columnPositions.map((position, index) => {
    const start = position;
    const end = index < columnPositions.length - 1 ? columnPositions[index + 1] : line.length;
    
    if (start >= 0 && end > start) {
      const cellContent = line.substring(start, end).trim();
      return cellContent.length === 0;
    }
    return true; // Assume empty if column position is invalid
  });
  
  return emptyCells;
};

/**
 * Enhanced cell content extraction with improved empty space detection
 */
export const extractCellContent = (line: string, startPos: number, endPos: number | undefined): string | null => {
  if (startPos === undefined || startPos < 0) return null;
  
  // Get the portion of the line for this cell
  const substring = endPos !== undefined ? 
    line.substring(startPos, endPos).trim() : 
    line.substring(startPos).trim();
  
  // If the cell space is completely empty or only has whitespace
  if (substring.length === 0) return null;
  
  // Enhanced detection for standalone "0" values
  if (substring.trim() === "0" || /\b0\b/.test(substring)) {
    return "0";
  }
  
  return substring;
};

/**
 * Extract numeric value with improved empty cell detection and specific handling for "0"
 */
export const extractNumericValue = (cellContent: string | null): string | null => {
  if (!cellContent) return null;
  
  // Check for exactly "0" with word boundaries (handles the Revolving row case in your example)
  if (cellContent.trim() === "0" || /\b0\b/.test(cellContent) || cellContent === ",") {
    return "0";
  }
  
  // Look for a number pattern with word boundaries to isolate just the number
  const match = cellContent.match(/\b(\d+)\b/);
  if (match && match[1]) {
    return match[1];
  }
  
  return null;
};

/**
 * Extract dollar value with improved empty cell detection
 */
export const extractDollarValue = (cellContent: string | null): string | null => {
  if (!cellContent) return null;
  
  // Return "$0" for zero value indicators like "0", ",", or "$,"
  if (cellContent.trim() === "0" || cellContent.trim() === "," || cellContent.trim() === "$,") {
    return "$0";
  }
  
  // Check if there's any dollar sign in this cell section
  if (cellContent.includes('$')) {
    // Match dollar patterns for both positive and negative values
    // Handles both -$XXX and $-XXX formats for negative values
    const match = cellContent.match(/(-?\$[\d,.]+|\$-[\d,.]+)/);
    if (match && match[1]) {
      // Normalize negative format to -$XXX
      let value = match[1];
      if (value.startsWith('$-')) {
        value = `-$${value.substring(2)}`;
      }
      return value;
    }
  } else {
    // Check for numeric values that should be dollar amounts but don't have $ sign
    const numericMatch = cellContent.match(/\b(\d[\d,.]*)\.?\b/);
    if (numericMatch && numericMatch[1]) {
      return `$${numericMatch[1]}`;
    }
  }
  
  return null;
};

/**
 * Extract percentage value with improved empty cell detection
 */
export const extractPercentageValue = (cellContent: string | null): string | null => {
  if (!cellContent) return null;
  
  // Return "0.0%" for zero value indicators
  if (cellContent.trim() === "0" || cellContent.trim() === "," || cellContent.trim() === "%") {
    return "0.0%";
  }
  
  // Check if there's any percentage sign in this cell section
  if (cellContent.includes('%')) {
    // Extract percentage value
    const match = cellContent.match(/([\d.]+%)/);
    if (match && match[1]) {
      return match[1];
    }
  } else {
    // Check for decimal values that might represent percentages (e.g. 1.16 for 116%)
    const numericMatch = cellContent.match(/(\d+\.?\d*)/);
    if (numericMatch && numericMatch[1]) {
      const value = parseFloat(numericMatch[1]);
      // If value is less than 5, assume it's in decimal form (like 1.16 meaning 116%)
      if (value > 0 && value < 5) {
        return `${(value * 100).toFixed(1)}%`;
      }
      // Otherwise treat it as a percentage as is
      return `${value.toFixed(1)}%`;
    }
  }
  
  return null;
};
