
/**
 * Safely formats cell values for the account summary tables
 */
export const formatAccountValue = (value: any): string => {
  // Special explicit handling for 0 values - display as "0" not "x"
  if (value === 0 || value === "0") {
    console.log("formatAccountValue: Formatting zero value");
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
  if (value === 0 || value === "0") {
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
    console.log("Found standalone '0' value in cell:", substring);
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
  if (cellContent.trim() === "0" || /\b0\b/.test(cellContent)) {
    console.log("Found standalone '0' value in numeric extraction");
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
  
  // Check if there's any percentage sign in this cell section
  if (cellContent.includes('%')) {
    // Extract percentage value
    const match = cellContent.match(/([\d.]+%)/);
    if (match && match[1]) {
      return match[1];
    }
  } else {
    // Check for numeric values that might be percentages but without % sign
    const numericMatch = cellContent.match(/(\d+\.?\d*)(?!\d)/);
    if (numericMatch && numericMatch[1]) {
      return `${numericMatch[1]}%`;
    }
  }
  
  return null;
};
