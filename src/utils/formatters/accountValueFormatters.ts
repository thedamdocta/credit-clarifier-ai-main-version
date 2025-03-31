
/**
 * Safely formats cell values for the account summary tables
 */
export const formatAccountValue = (value: any): string => {
  if (value === undefined || value === null || value === '') {
    return ""; 
  }
  
  // Always return as string, don't do numeric conversions
  return String(value);
};

/**
 * Formats dollar amounts properly with $ prefix and handles negative values consistently
 */
export const formatDollarAmount = (value: any): string => {
  if (value === undefined || value === null || value === '') {
    return ""; 
  }

  const stringValue = String(value);
  
  // For values already properly formatted with $ or -$, return as is
  if ((stringValue.startsWith('$') && !stringValue.startsWith('$-')) || 
      stringValue.startsWith('-$')) {
    return stringValue;
  }
  
  // Handle $-XXX format (convert to -$XXX for consistency)
  if (stringValue.startsWith('$-')) {
    return `-$${stringValue.substring(2)}`;
  }
  
  // For numeric-looking strings that should be dollar amounts
  if (!isNaN(Number(stringValue.replace(/[^0-9.-]/g, '')))) {
    // Normalize negative number format to -$XXX
    if (stringValue.startsWith('-')) {
      return `-$${stringValue.substring(1)}`;
    } else {
      return `$${stringValue}`;
    }
  }
  
  return stringValue;
};

/**
 * Check if a cell value exists and should be displayed
 */
export const hasDisplayValue = (value: any): boolean => {
  return value !== undefined && value !== null && value !== '';
};
