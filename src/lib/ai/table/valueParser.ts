
/**
 * Value parsing utilities for table extraction
 * These functions handle parsing and formatting of different types of values
 * found in credit report tables
 */

/**
 * Parse a numeric value from text, handling different formats
 * @param value The text value to parse
 * @returns Formatted numeric string or null if invalid
 */
export function parseNumericValue(value: any): string | null {
  if (value === null || value === undefined) return null;
  
  // Convert to string if not already
  const strValue = String(value).trim();
  
  // Common OCR errors - replace comma with empty string if it's alone
  if (strValue === ',' || strValue === '.') return '0';
  
  // Handle "x" or empty string as null
  if (strValue === 'x' || strValue === '' || strValue.toLowerCase() === 'null') return null;
  
  // Handle case where value is just a dollar sign
  if (strValue === '$') return '$0';
  
  // Fix common OCR errors where O or o is used instead of 0
  const fixedValue = strValue.replace(/([^a-zA-Z])[O]/g, '$10').replace(/([^a-zA-Z])[o]/g, '$10');
  
  // Extract only digits and at most one decimal point
  const numericPattern = /[-0-9,.]+/;
  const matches = fixedValue.match(numericPattern);
  if (!matches) return null;
  
  const numericValue = matches[0].replace(/[^0-9.-]/g, '');
  
  // If we have an empty string after removing non-numeric chars, return null
  if (!numericValue) return null;
  
  // Special handling for zero values - return string "0"
  if (parseFloat(numericValue) === 0) return "0";
  
  return numericValue;
}

/**
 * Parse a currency value from text, handling dollar signs and commas
 * @param value The text value to parse
 * @returns Formatted currency string with dollar sign or null if invalid
 */
export function parseCurrencyValue(value: any): string | null {
  if (value === null || value === undefined) return null;
  
  // Convert to string if not already
  const strValue = String(value).trim();
  
  // Common OCR errors - replace standalone characters with empty
  if (strValue === '$' || strValue === ',' || strValue === '$,') return '$0';
  
  // Handle "x" or empty string as null
  if (strValue === 'x' || strValue === '' || strValue.toLowerCase() === 'null') return null;
  
  // Handle negative values consistently
  const isNegative = strValue.startsWith('-') || strValue.includes('-$');
  
  // Fix common OCR errors where O or o is used instead of 0
  const fixedValue = strValue.replace(/([^a-zA-Z])[O]/g, '$10').replace(/([^a-zA-Z])[o]/g, '$10');
  
  // Extract digits, commas, and period for decimal point
  const numericPattern = /[-0-9,.]+/;
  const matches = fixedValue.match(numericPattern);
  if (!matches) return null;
  
  let numericPart = matches[0].replace(/[^0-9.]/g, '');
  
  // If we just have empty string, return $0
  if (!numericPart) return '$0';
  
  // Convert numeric part to a number and back to string to handle formatting
  const numValue = parseFloat(numericPart);
  
  // Handle zero values specially
  if (numValue === 0) return '$0';
  
  // Format with commas for thousands
  numericPart = numValue.toLocaleString('en-US');
  
  // Format with dollar sign and handle negative values
  if (isNegative) {
    return `-$${numericPart}`;
  } else {
    // Check if we already have a dollar sign
    return strValue.includes('$') ? `$${numericPart}` : `$${numericPart}`;
  }
}

/**
 * Parse a percentage value from text
 * @param value The text value to parse
 * @returns Formatted percentage string with % sign or null if invalid
 */
export function parsePercentageValue(value: any): string | null {
  if (value === null || value === undefined) return null;
  
  // Convert to string if not already
  const strValue = String(value).trim();
  
  // Handle "x" or empty string as null
  if (strValue === 'x' || strValue === '' || strValue.toLowerCase() === 'null') return null;
  
  // Check if we already have a percent sign
  const hasPercentSign = strValue.includes('%');
  
  // Fix common OCR errors where O or o is used instead of 0
  const fixedValue = strValue.replace(/([^a-zA-Z])[O]/g, '$10').replace(/([^a-zA-Z])[o]/g, '$10');
  
  // Extract numeric part using a pattern to handle various formats
  const numericPattern = /[-0-9,.]+/;
  const matches = fixedValue.match(numericPattern);
  if (!matches) return null;
  
  const numericPart = matches[0].replace(/[^0-9.]/g, '');
  
  // If we have an empty string after removing non-numeric chars, return null
  if (!numericPart) return null;
  
  // Try to parse the numeric value
  const numValue = parseFloat(numericPart);
  if (isNaN(numValue)) return null;
  
  // Handle zero values specially
  if (numValue === 0) return "0.0%";
  
  // Format with percent sign and one decimal place
  return hasPercentSign ? strValue : `${numValue.toFixed(1)}%`;
}

/**
 * Determine if a value represents zero
 * @param value The value to check
 * @returns True if the value represents zero, false otherwise
 */
export function isZeroValue(value: any): boolean {
  if (value === null || value === undefined) return false;
  
  const strValue = String(value).trim();
  
  return strValue === '0' || 
         strValue === '$0' || 
         strValue === '0.0%' || 
         strValue === '$0.00';
}

/**
 * Format a parsed value for display, handling special cases
 * @param value The value to format
 * @returns Formatted value for display
 */
export function formatValueForDisplay(value: any): string {
  if (value === null || value === undefined) return "x";
  
  const strValue = String(value).trim();
  if (strValue === '') return "x";
  
  return strValue;
}
