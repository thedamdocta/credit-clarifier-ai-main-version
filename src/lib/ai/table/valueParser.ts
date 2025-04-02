
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
  if (strValue === 'x' || strValue === '') return null;
  
  // Extract only digits and at most one decimal point
  const numericValue = strValue.replace(/[^0-9.]/g, '');
  
  // If we have an empty string after removing non-numeric chars, return null
  if (!numericValue) return null;
  
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
  if (strValue === 'x' || strValue === '') return null;
  
  // Check if we already have a dollar sign
  const hasDollarSign = strValue.includes('$');
  
  // Extract digits, commas, and period for decimal point
  let numericPart = strValue.replace(/[^0-9,.]/g, '');
  
  // If we just have a comma or empty string, return $0
  if (!numericPart || numericPart === ',') return '$0';
  
  // Format with dollar sign
  return hasDollarSign ? strValue : `$${numericPart}`;
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
  if (strValue === 'x' || strValue === '') return null;
  
  // Check if we already have a percent sign
  const hasPercentSign = strValue.includes('%');
  
  // Extract digits and period for decimal point
  const numericPart = strValue.replace(/[^0-9.]/g, '');
  
  // If we have an empty string after removing non-numeric chars, return null
  if (!numericPart) return null;
  
  // Try to parse the numeric value
  const numValue = parseFloat(numericPart);
  if (isNaN(numValue)) return null;
  
  // Format with percent sign and one decimal place
  return hasPercentSign ? strValue : `${numValue.toFixed(1)}%`;
}
