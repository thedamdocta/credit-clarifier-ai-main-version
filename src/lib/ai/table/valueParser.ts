import { devDiagnostics } from "@/lib/security/devDiagnostics";

/**
 * Value parsing utilities for table extraction
 * These functions handle parsing and formatting of different types of values
 * found in credit report tables
 */

// Store example patterns that we've seen before to improve recognition
const knownPatterns = {
  currency: [
    { pattern: /^\$?[\d,]+(\.\d{2})?$/, replacement: (match: string) => match.startsWith('$') ? match : `$${match}` },
    { pattern: /^\(?[\d,]+(\.\d{2})?\)?$/, replacement: (match: string) => match.startsWith('(') ? `-$${match.slice(1, -1)}` : `$${match}` },
  ],
  percentage: [
    { pattern: /^[\d.]+\%?$/, replacement: (match: string) => match.endsWith('%') ? match : `${match}%` },
  ],
  numeric: [
    { pattern: /^[\d,]+$/, replacement: (match: string) => match.replace(/,/g, '') },
    { pattern: /^[\d]+\.[\d]+$/, replacement: (match: string) => match },
  ]
};

// Store examples we've seen for training the system
let trainingExamples: {
  raw: string;
  type: 'currency' | 'percentage' | 'numeric';
  corrected: string;
}[] = [];

/**
 * Add a new training example to improve future recognition
 * @param raw Original string from OCR
 * @param type Type of value (currency, percentage, numeric)
 * @param corrected Correctly formatted value
 */
export function addTrainingExample(raw: string, type: 'currency' | 'percentage' | 'numeric', corrected: string) {
  // Don't add duplicates
  if (!trainingExamples.some(ex => ex.raw === raw && ex.corrected === corrected)) {
    trainingExamples.push({ raw, type, corrected });
    devDiagnostics.log(`Added training example: ${raw} → ${corrected} (${type})`);
  }
}

/**
 * Learn from a set of examples
 * @param examples Array of example objects with raw, type, and corrected values
 */
export function learnFromExamples(examples: {raw: string, corrected: string, type: string}[]) {
  examples.forEach(ex => {
    if (ex.raw && ex.corrected && (ex.type === 'currency' || ex.type === 'percentage' || ex.type === 'numeric')) {
      addTrainingExample(ex.raw, ex.type as 'currency' | 'percentage' | 'numeric', ex.corrected);
    }
  });
  devDiagnostics.log(`Learned from ${examples.length} examples`);
}

/**
 * Parse a numeric value from text, handling different formats
 * @param value The text value to parse
 * @returns Formatted numeric string or null if invalid
 */
export function parseNumericValue(value: any): string | null {
  if (value === null || value === undefined) return null;
  
  // Convert to string if not already
  const strValue = String(value).trim();
  
  // First check if this matches a training example
  const matchingExample = trainingExamples.find(ex => 
    ex.type === 'numeric' && (ex.raw === strValue || ex.raw.toLowerCase() === strValue.toLowerCase())
  );
  
  if (matchingExample) {
    devDiagnostics.log(`Using training example match for ${strValue} → ${matchingExample.corrected}`);
    return matchingExample.corrected;
  }
  
  // Common OCR errors - replace comma with empty string if it's alone
  if (strValue === ',' || strValue === '.') return '0';
  
  // Handle "x" or empty string as null
  if (strValue === 'x' || strValue === '' || strValue.toLowerCase() === 'null') return null;
  
  // Handle case where value is just a dollar sign
  if (strValue === '$') return '$0';
  
  // Fix common OCR errors where O or o is used instead of 0
  const fixedValue = strValue
    .replace(/([^a-zA-Z])[O]/g, '$10')
    .replace(/([^a-zA-Z])[o]/g, '$10')
    .replace(/l0/g, '10') // Fix OCR confusion between l (lowercase L) and 1
    .replace(/\bO\b/g, '0') // Fix standalone "O" as "0"
    .replace(/\bo\b/g, '0') // Fix standalone "o" as "0"
    // Additional OCR error fixes
    .replace(/I/g, '1') // Fix OCR confusion between I (uppercase i) and 1
    .replace(/l(\d)/g, '1$1') // Fix OCR confusion between l (lowercase L) and 1 when followed by digits
    .replace(/[|]/g, '1') // Fix OCR confusion between pipe character and 1
    .replace(/B/g, '8') // Fix OCR confusion between B and 8
    .replace(/S/g, '5'); // Fix OCR confusion between S and 5
  
  // Extract only digits and at most one decimal point
  const numericPattern = /[-0-9,.]+/;
  const matches = fixedValue.match(numericPattern);
  if (!matches) return null;
  
  const numericValue = matches[0].replace(/[^0-9.-]/g, '');
  
  // If we have an empty string after removing non-numeric chars, return null
  if (!numericValue) return null;
  
  // Special handling for zero values - return string "0"
  if (parseFloat(numericValue) === 0) return "0";
  
  // Add this as a training example for future use
  addTrainingExample(strValue, 'numeric', numericValue);
  
  return numericValue;
}

/**
 * Parse a currency value from text, handling dollar signs and commas
 * @param value The text value to parse
 * @returns Formatted currency string with dollar sign or null if invalid
 */
export function parseCurrencyValue(value: any): string | null {
  if (value === null || value === undefined) return null;
  
  // Convert to string if not already
  const strValue = String(value).trim();
  
  // First check if this matches a training example
  const matchingExample = trainingExamples.find(ex => 
    ex.type === 'currency' && (ex.raw === strValue || ex.raw.toLowerCase() === strValue.toLowerCase())
  );
  
  if (matchingExample) {
    devDiagnostics.log(`Using training example match for ${strValue} → ${matchingExample.corrected}`);
    return matchingExample.corrected;
  }
  
  // Common OCR errors - replace standalone characters with empty
  if (strValue === '$' || strValue === ',' || strValue === '$,') return '$0';
  
  // Handle "x" or empty string as null
  if (strValue === 'x' || strValue === '' || strValue.toLowerCase() === 'null') return null;
  
  // Handle negative values consistently
  const isNegative = strValue.startsWith('-') || strValue.includes('-$') || strValue.includes('(') && strValue.includes(')');
  
  // Fix common OCR errors where O or o is used instead of 0
  const fixedValue = strValue
    .replace(/([^a-zA-Z])[O]/g, '$10')
    .replace(/([^a-zA-Z])[o]/g, '$10')
    .replace(/\$(\d+)[.,](\d+)[$]/g, '$$$1.$2') // Fix malformed currency with trailing $ (OCR error)
    .replace(/\bO\b/g, '0')
    .replace(/\bo\b/g, '0')
    // Fix other common OCR errors for currency values
    .replace(/I/g, '1')
    .replace(/l(\d)/g, '1$1')
    .replace(/[|]/g, '1')
    .replace(/S/g, '5') // Fix OCR confusion between S and 5
    .replace(/(\d+)\.(\d+)\.(\d+)/g, '$1$2$3') // Fix double decimal points (OCR error)
    .replace(/\((\d+[\d,.]*)\)/g, '-$1') // Handle parentheses notation for negative numbers
    .replace(/B/g, '8') // Fix OCR confusion between B and 8
    .replace(/Z/g, '2'); // Fix OCR confusion between Z and 2
  
  // Extract digits, commas, and period for decimal point
  const numericPattern = /[-0-9,.]+/;
  const matches = fixedValue.match(numericPattern);
  if (!matches) return null;
  
  let numericPart = matches[0].replace(/[^0-9.]/g, '');
  
  // If we just have empty string, return $0
  if (!numericPart) return '$0';
  
  // Convert numeric part to a number and back to string to handle formatting
  const numValue = parseFloat(numericPart);
  
  // Handle zero values specially
  if (numValue === 0) return '$0';
  
  // Format with commas for thousands
  numericPart = numValue.toLocaleString('en-US');
  
  // Format the final result
  const finalValue = isNegative ? `-$${numericPart}` : `$${numericPart}`;
  
  // Add this as a training example for future use
  addTrainingExample(strValue, 'currency', finalValue);
  
  return finalValue;
}

/**
 * Parse a percentage value from text
 * @param value The text value to parse
 * @returns Formatted percentage string with % sign or null if invalid
 */
export function parsePercentageValue(value: any): string | null {
  if (value === null || value === undefined) return null;
  
  // Convert to string if not already
  const strValue = String(value).trim();
  
  // First check if this matches a training example
  const matchingExample = trainingExamples.find(ex => 
    ex.type === 'percentage' && (ex.raw === strValue || ex.raw.toLowerCase() === strValue.toLowerCase())
  );
  
  if (matchingExample) {
    devDiagnostics.log(`Using training example match for ${strValue} → ${matchingExample.corrected}`);
    return matchingExample.corrected;
  }
  
  // Handle "x" or empty string as null
  if (strValue === 'x' || strValue === '' || strValue.toLowerCase() === 'null') return null;
  
  // Check if we already have a percent sign
  const hasPercentSign = strValue.includes('%');
  
  // Fix common OCR errors where O or o is used instead of 0
  const fixedValue = strValue
    .replace(/([^a-zA-Z])[O]/g, '$10')
    .replace(/([^a-zA-Z])[o]/g, '$10')
    .replace(/\bO\b/g, '0')
    .replace(/\bo\b/g, '0')
    // Additional OCR fixes for percentages
    .replace(/I/g, '1')
    .replace(/l(\d)/g, '1$1')
    .replace(/[|]/g, '1')
    .replace(/(\d+)\.(\d+)\.(\d+)/g, '$1$2$3') // Fix double decimal points
    .replace(/B/g, '8'); // Fix OCR confusion between B and 8
  
  // Extract numeric part using a pattern to handle various formats
  const numericPattern = /[-0-9,.]+/;
  const matches = fixedValue.match(numericPattern);
  if (!matches) return null;
  
  const numericPart = matches[0].replace(/[^0-9.]/g, '');
  
  // If we have an empty string after removing non-numeric chars, return null
  if (!numericPart) return null;
  
  // Try to parse the numeric value
  const numValue = parseFloat(numericPart);
  if (isNaN(numValue)) return null;
  
  // Handle zero values specially
  if (numValue === 0) return "0.0%";
  
  // Format the final result
  const finalValue = hasPercentSign ? strValue : `${numValue.toFixed(1)}%`;
  
  // Add this as a training example for future use
  addTrainingExample(strValue, 'percentage', finalValue);
  
  return finalValue;
}

/**
 * Determine if a value represents zero
 * @param value The value to check
 * @returns True if the value represents zero, false otherwise
 */
export function isZeroValue(value: any): boolean {
  if (value === null || value === undefined) return false;
  
  const strValue = String(value).trim();
  
  return strValue === '0' || 
         strValue === '$0' || 
         strValue === '0.0%' || 
         strValue === '$0.00';
}

/**
 * Format a parsed value for display, handling special cases
 * @param value The value to format
 * @returns Formatted value for display
 */
export function formatValueForDisplay(value: any): string {
  if (value === null || value === undefined) return "x";
  
  const strValue = String(value).trim();
  if (strValue === '') return "x";
  
  return strValue;
}

/**
 * Try multiple parsing approaches for a value and return the first successful one
 * This helps with inconsistent OCR output formats
 * @param value The value to parse
 * @returns Parsed value or null if all parsing methods fail
 */
export function parseFlexibleValue(value: any): string | null {
  if (value === null || value === undefined) return null;
  
  // Try currency parsing first (for values with $ signs)
  if (String(value).includes('$')) {
    const currencyValue = parseCurrencyValue(value);
    if (currencyValue !== null) return currencyValue;
  }
  
  // Try percentage parsing next (for values with % signs)
  if (String(value).includes('%')) {
    const percentValue = parsePercentageValue(value);
    if (percentValue !== null) return percentValue;
  }
  
  // Check if this might be a currency value missing the $ sign
  if (mightBeCurrencyValue(String(value))) {
    const currencyValue = parseCurrencyValue('$' + value);
    if (currencyValue !== null) return currencyValue;
  }
  
  // Finally try numeric parsing for plain numbers
  return parseNumericValue(value);
}

/**
 * Check if a string might be a currency value based on context
 * Useful when OCR fails to detect the $ symbol
 * @param value The value to check
 * @returns True if the value is likely a currency value
 */
export function mightBeCurrencyValue(value: string): boolean {
  // Check if the value is a number with commas or decimal points
  // which is common for currency values
  return /^\d{1,3}(,\d{3})*(\.\d{2})?$/.test(value) || 
         /^\d+\.\d{2}$/.test(value);
}

/**
 * Special parser for empty cells that contain only spaces or other non-printing chars
 * @param value The value to parse
 * @returns "0" for empty cells in numeric contexts, null otherwise
 */
export function parseEmptyCell(value: any, defaultToZero: boolean = false): string | null {
  if (value === null || value === undefined) return defaultToZero ? "0" : null;
  
  const strValue = String(value).trim();
  if (strValue === '') return defaultToZero ? "0" : null;
  
  // Check for non-printing characters and whitespace only
  if (/^\s*$/.test(strValue)) return defaultToZero ? "0" : null;
  
  // For values that just contain a dash or hyphen (common for "no value")
  if (strValue === '-' || strValue === '–' || strValue === '—') return defaultToZero ? "0" : null;
  
  // Not an empty cell
  return null;
}

/**
 * Improved currency parser that's more aggressive in finding currency patterns
 * @param value Any input value that might represent currency
 * @returns Formatted currency string or null
 */
export function parseAggressiveCurrency(value: any): string | null {
  if (value === null || value === undefined) return null;
  
  const strValue = String(value).trim();
  
  // Skip obvious non-currency values
  if (strValue === 'x' || strValue === '' || strValue.toLowerCase() === 'null') return null;
  
  // Look for numeric patterns that might be currency
  const numericMatch = strValue.match(/[\d,.]+/);
  
  if (numericMatch) {
    let numericStr = numericMatch[0].replace(/[^\d.]/g, '');
    
    // Try to parse as a number
    const numValue = parseFloat(numericStr);
    if (isNaN(numValue)) return null;
    
    // Format as currency
    return `$${numValue.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    })}`;
  }
  
  return null;
}

/**
 * Detect the likely type of a value (numeric, currency, percentage)
 * @param value The value to analyze
 * @returns The detected type as a string
 */
export function detectValueType(value: any): 'numeric' | 'currency' | 'percentage' | 'unknown' {
  if (value === null || value === undefined) return 'unknown';
  
  const strValue = String(value).trim();
  
  // Check for currency indicators
  if (strValue.includes('$') || 
      /^\d{1,3}(,\d{3})*(\.\d{2})?$/.test(strValue)) {
    return 'currency';
  }
  
  // Check for percentage indicators
  if (strValue.includes('%')) {
    return 'percentage';
  }
  
  // Check for numeric patterns
  if (/^-?\d+(\.\d+)?$/.test(strValue)) {
    return 'numeric';
  }
  
  return 'unknown';
}

/**
 * Function to train the parser with known good examples
 * @param examples Array of example records to learn from
 */
export function trainParser(examples: Array<{
  accountType: string,
  open?: string | null,
  withBalance?: string | null,
  totalBalance?: string | null,
  available?: string | null,
  creditLimit?: string | null,
  debtToCredit?: string | null,
  payment?: string | null
}>) {
  devDiagnostics.log(`Training parser with ${examples.length} examples`);
  
  try {
    examples.forEach(example => {
      // For each field, if it exists and isn't null, add it as a training example
      if (example.open) {
        addTrainingExample(example.open, 'numeric', example.open);
      }
      
      if (example.withBalance) {
        addTrainingExample(example.withBalance, 'numeric', example.withBalance);
      }
      
      if (example.totalBalance) {
        // Clean up the value first to ensure it's in the right format
        const cleanedValue = example.totalBalance.startsWith('$') ? 
          example.totalBalance : `$${example.totalBalance}`;
        addTrainingExample(example.totalBalance, 'currency', cleanedValue);
      }
      
      if (example.available) {
        const cleanedValue = example.available.startsWith('$') ? 
          example.available : `$${example.available}`;
        addTrainingExample(example.available, 'currency', cleanedValue);
      }
      
      if (example.creditLimit) {
        const cleanedValue = example.creditLimit.startsWith('$') ? 
          example.creditLimit : `$${example.creditLimit}`;
        addTrainingExample(example.creditLimit, 'currency', cleanedValue);
      }
      
      if (example.debtToCredit) {
        const cleanedValue = example.debtToCredit.endsWith('%') ? 
          example.debtToCredit : `${example.debtToCredit}%`;
        addTrainingExample(example.debtToCredit, 'percentage', cleanedValue);
      }
      
      if (example.payment) {
        const cleanedValue = example.payment.startsWith('$') ? 
          example.payment : `$${example.payment}`;
        addTrainingExample(example.payment, 'currency', cleanedValue);
      }
    });
    
    devDiagnostics.log(`Training complete. ${trainingExamples.length} patterns learned.`);
  } catch (error) {
    devDiagnostics.error("Error while training parser:", error);
  }
}
