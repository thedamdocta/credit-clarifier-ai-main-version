
/**
 * Utilities for parsing values from table cells
 * All functions preserve original values without any calculations
 */

/**
 * Parse numeric values from table cells
 * This function strictly preserves the original value exactly as it appears
 */
export function parseNumericValue(value: string | undefined): string | null {
  // Handle empty or undefined values
  if (!value || value === 'N/A' || value === '') return null;
  
  // Special handling for zero values (preserve exactly as "0")
  if (value === '0') return '0';
  
  // Just return the original string value without modifications
  return value;
}

/**
 * Parse currency values from table cells
 * This function preserves the original format with dollar sign
 */
export function parseCurrencyValue(value: string | undefined): string | null {
  // Handle empty or undefined values
  if (!value || value === 'N/A' || value === '') return null;
  
  // Special handling for zero values
  if (value === '0') return '$0';
  
  // Ensure the value has a dollar sign
  if (value.startsWith('$')) {
    return value;
  } else {
    // Add dollar sign if it doesn't have one
    return `$${value}`;
  }
}

/**
 * Parse percentage values from table cells
 * This function preserves the original percentage format
 */
export function parsePercentageValue(value: string | undefined): string | null {
  // Handle empty or undefined values
  if (!value || value === 'N/A' || value === '') return null;
  
  // Special case for zero values
  if (value === '0' || value === '0%') return '0.0%';
  
  // Ensure the value has a percentage sign
  if (value.endsWith('%')) {
    return value;
  } else {
    // Add percentage sign if it doesn't have one
    return `${value}%`;
  }
}
