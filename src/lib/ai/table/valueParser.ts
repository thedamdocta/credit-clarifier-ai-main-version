
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
  
  // Handle "0" values (including common OCR misreads)
  if (normalized === '0' || normalized === 'O' || normalized === 'o') {
    return '0';
  }
  
  // Handle common OCR errors like ',' or '.' instead of number
  if (normalized === ',' || normalized === '.') {
    return '0';
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
  
  // Handle common OCR errors
  if (normalized === '$,' || normalized === '$.' || normalized === '$-') {
    return '$0';
  }
  
  // Handle zero values with various formats
  if (normalized === '$0' || normalized === '$O' || normalized === '$o') {
    return '$0';
  }
  
  // Check if this is a negative value that should be positive
  // Available and Credit Limit values are often incorrectly read with negative signs
  if (normalized.includes('-$') || (normalized.includes('-') && normalized.includes('$'))) {
    // Remove the negative sign for these values as they should be positive
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
    return `$${numericPart}`;
  }

  // If all else fails, return the normalized string
  return normalized;
}

/**
 * Parse a percentage value from OCR text
 * Formats as "XX.X%" for consistency
 */
export function parsePercentageValue(value: string | null): string | null {
  if (value === null || value === undefined || value === '') return null;
  
  // Normalize the value
  const normalized = value.toString().trim();
  
  // Handle common OCR errors
  if (normalized === '%' || normalized === '.%') {
    return '0.0%';
  }
  
  // Check if it contains a number and % sign
  const matches = normalized.match(/([\d.]+)\s*%?/);
  if (matches) {
    // Format to ensure one decimal place
    const num = parseFloat(matches[1]);
    // Handle NaN
    if (isNaN(num)) {
      return '0.0%';
    }
    return `${num.toFixed(1)}%`;
  }

  // If it's just a number without a % sign, add it
  const numericMatches = normalized.match(/^[\d.]+$/);
  if (numericMatches) {
    const num = parseFloat(normalized);
    // Handle NaN
    if (isNaN(num)) {
      return '0.0%';
    }
    return `${num.toFixed(1)}%`;
  }

  return normalized;
}
