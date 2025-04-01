/**
 * Utilities for parsing values from table cells
 */

/**
 * Parse numeric values from table cells
 */
export function parseNumericValue(value: string | undefined): string | null {
  if (!value || value === '0' || value === 'N/A' || value === '') return '0';
  
  // Remove any non-numeric characters except decimal point
  const numericValue = value.replace(/[^0-9.]/g, '');
  const parsed = parseFloat(numericValue);
  
  return isNaN(parsed) ? null : String(parsed);
}

/**
 * Parse currency values from table cells
 */
export function parseCurrencyValue(value: string | undefined): string | null {
  if (!value || value === '0' || value === 'N/A' || value === '') return '0';
  
  // Remove currency symbols and commas
  const numericValue = value.replace(/[$,]/g, '');
  const parsed = parseFloat(numericValue);
  
  return isNaN(parsed) ? null : String(parsed);
}

/**
 * Parse percentage values from table cells with improved decimal handling
 */
export function parsePercentageValue(value: string | undefined): string | null {
  if (!value || value === '0' || value === 'N/A' || value === '') return '0%';
  
  try {
    // Handle different percentage formats
    if (typeof value === 'string') {
      // Check for explicit percentage notation (e.g. "116%" or "116.0%")
      if (value.includes('%')) {
        // Extract just the number part
        const numMatch = value.match(/(\d+\.?\d*)/);
        if (numMatch && numMatch[1]) {
          return `${numMatch[1]}%`;
        }
      }
      
      // Check if it's a decimal representation of percentage (e.g. "1.16" meaning 116%)
      const decimal = parseFloat(value.replace(/[^\d.-]/g, ''));
      if (!isNaN(decimal)) {
        // If value is between 0 and 5, assume it's already in decimal form and needs to be multiplied by 100
        if (decimal > 0 && decimal < 5) {
          return `${(decimal * 100).toFixed(1)}%`;
        }
        // Otherwise assume it's already a percentage value
        return `${decimal.toFixed(1)}%`;
      }
    }
    
    return '0%'; // Default fallback
  } catch (error) {
    console.error('Error parsing percentage value:', error);
    return '0%'; // Default on error
  }
}
