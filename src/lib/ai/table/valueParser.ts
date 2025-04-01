
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
  
  // Handle "0" values
  if (normalized === '0' || normalized === 'O' || normalized === 'o') {
    return '0';
  }
  
  // Handle common OCR errors like ',' instead of number
  if (normalized === ',' || normalized === '.') {
    return '0';
  }

  // Try to extract a number from the string
  const matches = normalized.match(/\d+/);
  if (matches) {
    return matches[0];
  }

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
  
  // Check if we can extract a number
  const matches = normalized.match(/\$[\d,.]+/);
  if (matches) {
    return matches[0];
  }

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
    const num = parseFloat(matches[1]);
    return `${num.toFixed(1)}%`;
  }

  return normalized;
}
