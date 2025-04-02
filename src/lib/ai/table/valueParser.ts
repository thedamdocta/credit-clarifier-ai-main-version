
/**
 * Value parsing utilities for extracted table data
 * These functions help convert raw OCR text into properly formatted values
 */

/**
 * Parse a numeric value from OCR text
 * Handles different formats and common OCR errors
 */
export function parseNumericValue(value: string | null): string | null {
  if (value === null || value === undefined || value === '') return null;
  
  // Normalize the value
  const normalized = value.toString().trim();
  
  // Special handling for Total row - preserve nulls instead of converting to 0
  if (normalized.toLowerCase() === 'total') {
    return null;
  }
  
  // Handle explicit zeros - always return "0" as a string, not numeric 0
  if (normalized === '0' || normalized === 'O' || normalized === 'o') {
    return '0';
  }
  
  // Handle common OCR errors like ',' or '.' instead of number
  if (normalized === ',' || normalized === '.') {
    return null;  // Return null for error values, not "0"
  }

  // Handle single character OCR errors that should be numbers
  if (/^[oO]$/.test(normalized)) {
    return '0';
  }

  // Try to extract a number from the string
  const matches = normalized.match(/\d+/);
  if (matches) {
    return matches[0];
  }

  // If we got here but still have content, return it as-is
  return normalized.length > 0 ? normalized : null;
}

/**
 * Parse a currency value from OCR text
 * Handles dollar signs, commas, and formats properly
 */
export function parseCurrencyValue(value: string | null): string | null {
  if (value === null || value === undefined || value === '') return null;
  
  // Normalize the value
  let normalized = value.toString().trim();
  
  // Special handling for empty-looking currency values (like just a comma or period)
  if (normalized === '$,' || normalized === '$.' || normalized === '$-') {
    return null;  // Return null for truly empty values
  }
  
  // Handle explicit zero values with various formats
  if (normalized === '$0' || normalized === '$O' || normalized === '$o') {
    return '$0';  // Keep zero values as "$0"
  }
  
  // Check if this is a negative value that should be displayed as is
  // (negative values should be preserved in Available column)
  let isNegative = false;
  if (normalized.includes('-$') || (normalized.includes('-') && normalized.includes('$'))) {
    isNegative = true;
    // Remove the negative sign temporarily for processing
    normalized = normalized.replace('-', '');
  }
  
  // Make sure it starts with a dollar sign
  if (!normalized.includes('$')) {
    normalized = '$' + normalized;
  }
  
  // Try to extract the currency value with better regex
  const matches = normalized.match(/\$([\d,.]+)/);
  if (matches) {
    // Use the captured group which has just the number part
    const numericPart = matches[1];
    return isNegative ? `-$${numericPart}` : `$${numericPart}`;
  }

  // If all else fails, return the normalized string
  return isNegative ? `-${normalized}` : normalized;
}

/**
 * Parse a percentage value from OCR text
 * Formats as "XX.X%" for consistency
 */
export function parsePercentageValue(value: string | null): string | null {
  if (value === null || value === undefined || value === '') return null;
  
  // Normalize the value
  const normalized = value.toString().trim();
  
  // Handle empty percentage values
  if (normalized === '%' || normalized === '.%') {
    return null;  // Return null for truly empty values
  }
  
  // Handle explicit zero percentage values
  if (normalized === '0%' || normalized === '0.0%') {
    return '0.0%';
  }
  
  // Check if it contains a number and % sign
  const matches = normalized.match(/([\d.]+)\s*%?/);
  if (matches) {
    // Format to ensure one decimal place
    const num = parseFloat(matches[1]);
    // Handle NaN
    if (isNaN(num)) {
      return null;  // Return null for error values
    }
    return `${num.toFixed(1)}%`;
  }

  // If it's just a number without a % sign, add it
  const numericMatches = normalized.match(/^[\d.]+$/);
  if (numericMatches) {
    const num = parseFloat(normalized);
    // Handle NaN
    if (isNaN(num)) {
      return null;  // Return null for error values
    }
    return `${num.toFixed(1)}%`;
  }

  return normalized;
}
