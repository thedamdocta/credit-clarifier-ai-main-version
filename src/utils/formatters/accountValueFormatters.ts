
/**
 * Safely formats cell values for the account summary tables
 */
export const formatAccountValue = (value: any): string => {
  if (value === undefined || value === null || value === '') {
    return ""; 
  }
  
  return String(value);
};

/**
 * Formats dollar amounts properly with $ prefix
 */
export const formatDollarAmount = (value: any): string => {
  if (value === undefined || value === null || value === '') {
    return ""; 
  }

  const stringValue = String(value);
  
  // For values already properly formatted with $ or -$, return as is
  if (stringValue.startsWith('$') || stringValue.startsWith('-$')) {
    return stringValue;
  }
  
  // For numeric values or numeric strings that should be dollar amounts
  if (!isNaN(Number(stringValue.replace(/[^0-9.-]/g, '')))) {
    const numericValue = parseFloat(stringValue.replace(/[^0-9.-]/g, ''));
    return numericValue < 0 ? 
      `-$${Math.abs(numericValue).toLocaleString()}` : 
      `$${numericValue.toLocaleString()}`;
  }
  
  return stringValue;
};
