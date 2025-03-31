
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
 * Parse account value to number or null
 * Note: This function is kept for backward compatibility
 * but should no longer be used in the equifaxAccountSummary.ts file
 */
export const parseAccountValueToNumber = (value: any): number | null => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  
  // If it's already a number, return it
  if (typeof value === 'number') {
    return value;
  }
  
  // Try to convert to a number
  const stringValue = String(value);
  const numericValue = parseInt(stringValue.replace(/[^0-9-]/g, ''), 10);
  return isNaN(numericValue) ? null : numericValue;
};
