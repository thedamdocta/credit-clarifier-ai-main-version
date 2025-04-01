/**
 * Utilities for parsing values from table cells
 */

/**
 * Parse numeric values from table cells
 */
export function parseNumericValue(value: string | undefined): string | null {
  if (!value || value === 'N/A' || value === '') return '0';
  
  // Special handling for zero values
  if (value === '0') return '0';
  
  // Remove any non-numeric characters except decimal point and negative sign
  const numericValue = value.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(numericValue);
  
  return isNaN(parsed) ? null : String(parsed);
}

/**
 * Parse currency values from table cells with improved handling of negative values
 */
export function parseCurrencyValue(value: string | undefined): string | null {
  if (!value || value === 'N/A' || value === '') return '0';
  
  // Special handling for zero values
  if (value === '0') return '0';
  
  try {
    // Handle negative values with dash or parentheses
    let isNegative = false;
    let cleanValue = value;
    
    if (value.includes('-') || value.startsWith('(') || value.startsWith('-')) {
      isNegative = true;
    }
    
    // Remove currency symbols, commas, parentheses
    cleanValue = cleanValue.replace(/[$,()]/g, '');
    
    // Parse the numeric value
    const numericValue = parseFloat(cleanValue);
    
    if (isNaN(numericValue)) return '0';
    
    // Format with correct sign
    return isNegative ? String(-Math.abs(numericValue)) : String(numericValue);
  } catch (error) {
    console.error('Error parsing currency value:', value, error);
    return '0';
  }
}

/**
 * Parse percentage values from table cells with improved decimal handling
 */
export function parsePercentageValue(value: string | undefined): string | null {
  if (!value || value === 'N/A' || value === '') return '0.0%';
  
  // Special case for zero values
  if (value === '0' || value === '0%' || value === '0.0%') return '0.0%';
  
  try {
    // Already formatted as percentage
    if (typeof value === 'string' && value.includes('%')) {
      // Extract the number part
      const numMatch = value.match(/(-?\d+\.?\d*)/);
      if (numMatch && numMatch[1]) {
        const num = parseFloat(numMatch[1]);
        if (!isNaN(num)) {
          return `${num.toFixed(1)}%`;
        }
      }
    }
    
    // Number without percentage sign
    const num = parseFloat(value.replace(/[^\d.-]/g, ''));
    if (!isNaN(num)) {
      // If value is between 0 and 5, assume it's a decimal (e.g. 1.01 = 101%)
      if (num > 0 && num < 5) {
        return `${(num * 100).toFixed(1)}%`;
      }
      // Otherwise assume it's already a percentage value
      return `${num.toFixed(1)}%`;
    }
    
    return '0.0%'; // Default fallback
  } catch (error) {
    console.error('Error parsing percentage value:', value, error);
    return '0.0%';
  }
}
