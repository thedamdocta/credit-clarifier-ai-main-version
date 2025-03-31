
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
  
  // For numeric-looking strings that should be dollar amounts
  if (!isNaN(Number(stringValue.replace(/[^0-9.-]/g, '')))) {
    // Do NOT convert to a number and back - preserve original format
    // Just ensure it has the $ prefix
    return stringValue.startsWith('-') ? 
      `-$${stringValue.substring(1)}` : 
      `$${stringValue}`;
  }
  
  return stringValue;
};

/**
 * Check if a cell value exists and should be displayed
 */
export const hasDisplayValue = (value: any): boolean => {
  return value !== undefined && value !== null && value !== '';
};

