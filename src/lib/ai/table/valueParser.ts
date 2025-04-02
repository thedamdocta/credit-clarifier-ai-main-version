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
  
  // Handle explicit zeros - always return "0" as a string, not numeric 0
  if (normalized === '0' || normalized === 'O' || normalized === 'o') {
    return '0';
  }
  
  // Handle common OCR errors like ',' or '.' instead of number
  if (normalized === ',' || normalized === '.') {
    return '0';  // Return '0' for these common OCR error values for standalone commas or periods
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
    return '$0';  // Return '$0' for these common OCR error values
  }
  
  // Handle explicit zero values with various formats
  if (normalized === '$0' || normalized === '$O' || normalized === '$o' || normalized === '0' || normalized === ',') {
    return '$0';  // Keep zero values as "$0"
  }
  
  // Check if this is a negative value that should be displayed as is
  // (negative values should be preserved in Available column)
  let isNegative = false;
  if (normalized.includes('-$') || (normalized.includes('-') && normalized.includes('$'))) {
    isNegative = true;
    // Keep the negative format for these special cases
    // Make sure it's formatted as -$XXX consistently
    if (normalized.indexOf('$') > normalized.indexOf('-')) {
      // Change "-XXX$" or "- $XXX" to "-$XXX"
      normalized = normalized.replace(/-(.*)\$/, '-$$$1').replace(/\s+/g, '');
    }
    
    // Extract just the number part for processing
    const numMatch = normalized.match(/-\$?([\d,]+)/);
    if (numMatch) {
      return `-$${numMatch[1]}`;
    }
    
    // If we got here with a negative symbol, return as is
    return normalized;
  }
  
  // For non-negative values, ensure $ is present and format consistently
  const numMatch = normalized.match(/\$?([\d,]+)/);
  if (numMatch) {
    return `$${numMatch[1]}`;
  }
  
  // Return the original if no pattern matched
  return normalized.length > 0 ? normalized : null;
}

/**
 * Parse a percentage value from OCR text
 * Handles different percentage formats
 */
export function parsePercentageValue(value: string | null): string | null {
  if (value === null || value === undefined || value === '') return null;
  
  // Normalize the value
  const normalized = value.toString().trim();
  
  // Handle explicit zero values
  if (normalized === '0' || normalized === '0.0' || normalized === '0%' || normalized === '0.0%') {
    return '0.0%';  // Standardize zero values
  }
  
  // Try to extract a percentage value
  const percentMatch = normalized.match(/([\d\.]+)%?/);
  if (percentMatch) {
    const numValue = parseFloat(percentMatch[1]);
    // Format consistently with one decimal place
    return `${numValue.toFixed(1)}%`;
  }
  
  // Return the original if no pattern matched
  return normalized.length > 0 ? normalized : null;
}
