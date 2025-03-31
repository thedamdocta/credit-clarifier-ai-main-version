
import { parsingLogger } from "@/utils/parsingLogger";

/**
 * Extract the credit account table section from the document text
 */
export function extractCreditAccountTableSection(text: string): string | null {
  // First try to find the specific "Credit Accounts" section
  const creditAccountsHeaderPattern = /\bCredit\s+Accounts\b/i;
  const creditAccountsMatch = text.match(creditAccountsHeaderPattern);
  
  if (creditAccountsMatch) {
    const headerIndex = creditAccountsMatch.index || 0;
    
    // Get a more focused section around the Credit Accounts header
    const sectionStart = Math.max(0, headerIndex - 100); // Include some context before
    const focusedText = text.substring(sectionStart);
    
    // Look for the account type header row within this focused text
    const accountTypeHeaderPattern = /\baccount\s+type\b.*?\bopen\b.*?\bwith\s+balance\b.*?\btotal\s+balance\b/i;
    const headerMatch = focusedText.match(accountTypeHeaderPattern);
    
    if (headerMatch) {
      // Get the text from the header to the end of the table
      const accountTypeHeaderIndex = sectionStart + (headerMatch.index || 0);
      const tableEndPattern = /(?:other items|summary of|consumer statement|public records|end of report)/i;
      const endSearchText = text.slice(accountTypeHeaderIndex);
      const tableEndMatch = endSearchText.match(tableEndPattern);
      
      if (tableEndMatch) {
        return text.slice(accountTypeHeaderIndex, accountTypeHeaderIndex + tableEndMatch.index);
      } else {
        // If we can't find a clear end, just take a reasonable chunk
        return text.slice(accountTypeHeaderIndex, accountTypeHeaderIndex + 3000); 
      }
    }
  }
  
  // Fallback to searching for the account type header directly
  return extractTableSectionFallback(text);
}

/**
 * Fallback method to extract table section
 */
function extractTableSectionFallback(text: string): string | null {
  // Look for the account type header row
  const headerPattern = /\baccount\s+type\b.*?\bopen\b.*?\bwith\s+balance\b.*?\btotal\s+balance\b/i;
  const headerMatch = text.match(headerPattern);
  
  if (!headerMatch) {
    return null;
  }
  
  // Get the text from the header to the end of the table
  const headerIndex = headerMatch.index || 0;
  const tableEndPattern = /(?:other items|summary of|consumer statement|public records|end of report)/i;
  const tableEndMatch = text.slice(headerIndex).match(tableEndPattern);
  
  if (tableEndMatch) {
    return text.slice(headerIndex, headerIndex + tableEndMatch.index);
  } else {
    // If we can't find a clear end, just take a reasonable chunk
    return text.slice(headerIndex, headerIndex + 3000); 
  }
}

/**
 * Find the header line in the table to understand column positions
 */
export function findHeaderLine(lines: string[]): string | null {
  // Look for the line with all column headers
  const headerPattern = /account\s+type.*open.*with\s+balance.*total\s+balance.*available.*credit\s+limit.*debt-to-credit.*payment/i;
  
  for (const line of lines) {
    if (headerPattern.test(line)) {
      return line;
    }
  }
  
  return null;
}

/**
 * Extract column positions from the header line
 */
export function extractColumnPositions(headerLine: string): Record<string, number> {
  const columns: Record<string, number> = {};
  
  // Normalize header line (lowercase and clean up extra spaces)
  const normalizedLine = headerLine.toLowerCase().replace(/\s+/g, ' ');
  
  // Map of column names to look for in the header
  const columnMap = {
    'accountType': 'account type',
    'open': 'open',
    'withBalance': 'with balance',
    'totalBalance': 'total balance',
    'available': 'available',
    'creditLimit': 'credit limit',
    'debtToCredit': 'debt-to-credit',
    'payment': 'payment'
  };
  
  // Find position of each column in the header
  for (const [key, value] of Object.entries(columnMap)) {
    const pos = normalizedLine.indexOf(value);
    if (pos >= 0) {
      columns[key] = pos;
    }
  }
  
  return columns;
}
