
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
  
  // Handle 'x' values (common placeholder)
  if (normalized.toLowerCase() === 'x') {
    return null;
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
  
  // Handle 'x' values (common placeholder)
  if (normalized.toLowerCase() === 'x') {
    return null;
  }
  
  // Handle negative values specifically
  const isNegative = normalized.includes('-');
  
  // Clean the string to just numbers, decimals, and $ signs
  normalized = normalized.replace(/[^\d$,.-]/g, '');
  
  // Extract just the numeric part
  const numericPart = normalized.replace(/[$,]/g, '');
  
  // If it's just a dash or empty after cleaning, return $0
  if (numericPart === '-' || numericPart === '') {
    return '$0';
  }
  
  // If it has a negative sign, format as -$XXX consistently
  if (isNegative) {
    // Remove all negative signs and dollar signs
    const cleanNumber = numericPart.replace(/-/g, '');
    
    // Format as -$XXX
    return cleanNumber ? `-$${cleanNumber}` : '$0';
  }
  
  // Make sure it starts with a dollar sign
  return normalized.includes('$') ? normalized : `$${normalized}`;
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
  
  // Handle 'x' values (common placeholder)
  if (normalized.toLowerCase() === 'x') {
    return null;
  }
  
  // Check if it contains a number and % sign
  let numMatch = normalized.match(/([\d.]+)\s*%?/);
  
  // Additional handling for cases where OCR reads "116.0%" as "1160%" or similar
  if (!numMatch) {
    // Try to detect if this is a percentage without a decimal point
    const largePercentMatch = normalized.match(/(\d{3,})%?/);
    if (largePercentMatch) {
      const num = parseInt(largePercentMatch[1], 10);
      // If number is 100+ and doesn't have decimal point, assume it needs one
      if (num >= 100) {
        const adjusted = (num / 10).toFixed(1);
        return `${adjusted}%`;
      }
    }
  }
  
  if (numMatch) {
    // Use parseFloat to handle decimal points properly
    const num = parseFloat(numMatch[1]);
    
    // Special handling for values that look like they're missing decimal points
    if (num >= 100 && !numMatch[1].includes('.')) {
      // If it's a number like 1160 (should be 116.0), add decimal point
      return `${(num / 10).toFixed(1)}%`;
    }
    
    return `${num.toFixed(1)}%`;
  }

  // If we still have something but couldn't parse it properly
  return normalized.endsWith('%') ? normalized : `${normalized}%`;
}
