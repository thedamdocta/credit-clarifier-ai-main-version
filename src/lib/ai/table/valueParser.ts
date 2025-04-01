
/**
 * Utilities for parsing values from table cells
 */

/**
 * Parse numeric values from table cells
 * This function now strictly preserves the original numeric value without calculations
 */
export function parseNumericValue(value: string | undefined): string | null {
  if (!value || value === 'N/A' || value === '') return null;
  
  // Special handling for zero values
  if (value === '0') return '0';
  
  // Strip any non-numeric characters except decimal point 
  // and preserve the value exactly as it appears in the original format
  const numericValue = value.replace(/[^0-9.-]/g, '');
  
  // Return the cleaned string directly without numerical conversions
  return numericValue || null;
}

/**
 * Parse currency values from table cells with improved handling of negative values
 * This function now preserves the original currency value format
 */
export function parseCurrencyValue(value: string | undefined): string | null {
  if (!value || value === 'N/A' || value === '') return null;
  
  // Special handling for zero values
  if (value === '0') return '$0';
  
  try {
    // Check if value already has dollar sign
    if (value.includes('$')) {
      // Just clean up any redundant spaces but preserve the original format
      return value.trim();
    }
    
    // If no dollar sign, add one (assuming it's a dollar amount)
    const numericPart = value.replace(/[^0-9.-]/g, '');
    if (numericPart) {
      // Check for negative value
      if (value.includes('-') || value.startsWith('(')) {
        return `-$${numericPart.replace('-', '')}`;
      } else {
        return `$${numericPart}`;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing currency value:', value, error);
    return null;
  }
}

/**
 * Parse percentage values from table cells
 * This function now preserves the original percentage value format
 */
export function parsePercentageValue(value: string | undefined): string | null {
  if (!value || value === 'N/A' || value === '') return null;
  
  // Special case for zero values
  if (value === '0' || value === '0%') return '0.0%';
  
  try {
    // Already formatted as percentage - preserve as is
    if (typeof value === 'string' && value.includes('%')) {
      return value.trim();
    }
    
    // Number without percentage sign
    const numericPart = value.replace(/[^0-9.-]/g, '');
    if (numericPart) {
      return `${numericPart}%`;
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing percentage value:', value, error);
    return null;
  }
}
