
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
 * Parse percentage values from table cells
 */
export function parsePercentageValue(value: string | undefined): string | null {
  if (!value || value === '0' || value === 'N/A' || value === '') return '0';
  
  // Remove percentage symbols
  const numericValue = value.replace(/%/g, '');
  const parsed = parseFloat(numericValue);
  
  return isNaN(parsed) ? null : String(parsed / 100); // Convert to decimal and to string
}
