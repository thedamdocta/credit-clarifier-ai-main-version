
import { AccountSummary } from "../../types/creditReport";
import { parsingLogger } from "@/utils/parsingLogger";
import { 
  formatAccountValue, 
  extractCellContent, 
  extractNumericValue, 
  extractDollarValue, 
  extractPercentageValue 
} from "@/utils/formatters/accountValueFormatters";

export const extractEquifaxAccountSummaries = async (text: string): Promise<AccountSummary[]> => {
  console.log("Starting account summary extraction with isolated row processing");
  parsingLogger.logEvent("Starting equifax account summary extraction with isolated row approach");
  
  // Define the empty account summaries structure 
  const accountSummaries: AccountSummary[] = [
    { accountType: 'Revolving', totalAccounts: null, open: null, closed: null, balance: null, withBalance: null, totalBalance: null, available: null, creditLimit: null, debtToCredit: null, payment: null },
    { accountType: 'Mortgage', totalAccounts: null, open: null, closed: null, balance: null, withBalance: null, totalBalance: null, available: null, creditLimit: null, debtToCredit: null, payment: null },
    { accountType: 'Installment', totalAccounts: null, open: null, closed: null, balance: null, withBalance: null, totalBalance: null, available: null, creditLimit: null, debtToCredit: null, payment: null },
    { accountType: 'Other', totalAccounts: null, open: null, closed: null, balance: null, withBalance: null, totalBalance: null, available: null, creditLimit: null, debtToCredit: null, payment: null },
    { accountType: 'Total', totalAccounts: null, open: null, closed: null, balance: null, withBalance: null, totalBalance: null, available: null, creditLimit: null, debtToCredit: null, payment: null }
  ];

  try {
    // Extract the credit account table section specifically from the text
    const tableSection = extractCreditAccountTableSection(text);
    if (!tableSection) {
      console.log("No credit account summary table found in the text");
      parsingLogger.logEvent("No credit account summary table found in the text");
      return accountSummaries;
    }
    
    console.log("Found credit account table section, length:", tableSection.length);
    
    // Split the table into lines and filter out empty lines
    const lines = tableSection.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    console.log("Table section lines:", lines.length);
    
    // Find the header line to understand column positions
    const headerLine = findHeaderLine(lines);
    
    if (!headerLine) {
      console.log("Could not find header line for account summary table");
      return accountSummaries;
    }
    
    console.log("Found header line:", headerLine);
    
    // Get columns positions from the header line
    const columns = extractColumnPositions(headerLine);
    
    if (!columns || Object.keys(columns).length < 7) {
      console.log("Could not extract enough columns from the header line");
      return accountSummaries;
    }
    
    console.log("Extracted column positions:", columns);
    
    // Process each account type individually by finding their specific lines
    // Each cell is processed independently
    processAccountType('Revolving', lines, accountSummaries, columns);
    processAccountType('Mortgage', lines, accountSummaries, columns);
    processAccountType('Installment', lines, accountSummaries, columns);
    processAccountType('Other', lines, accountSummaries, columns);
    processAccountType('Total', lines, accountSummaries, columns);
    
    console.log("Account summaries extracted with isolated approach:", accountSummaries.length);
    console.log("Account summaries:", accountSummaries);
    parsingLogger.logEvent("Completed account summary extraction", { count: accountSummaries.length });
    return accountSummaries;
  } catch (error) {
    console.error("Error extracting account summaries:", error);
    parsingLogger.logEvent("Error extracting account summaries", { error: String(error) });
    return accountSummaries; // Return empty structure on error
  }
};

/**
 * Extract the credit account table section from the document text
 */
function extractCreditAccountTableSection(text: string): string | null {
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
function findHeaderLine(lines: string[]): string | null {
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
function extractColumnPositions(headerLine: string): Record<string, number> {
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

/**
 * Process a specific account type by searching for its line in the data
 */
function processAccountType(
  accountType: string,
  lines: string[],
  accountSummaries: AccountSummary[],
  columns: Record<string, number>
): void {
  console.log(`Processing ${accountType} account line`);
  
  // Find the line that specifically contains this account type as a word
  const accountLine = lines.find(line => {
    // Skip the header line
    if (line.toLowerCase().includes('account type') && line.toLowerCase().includes('with balance')) {
      return false;
    }
    
    // Match only if line has this account type with clear word boundary
    return new RegExp(`(?:^|\\s)${accountType}(?:\\s|$|\\t)`, 'i').test(line);
  });
  
  if (!accountLine) {
    console.log(`No line found for ${accountType}`);
    return;
  }
  
  console.log(`Found line for ${accountType}:`, accountLine);
  
  // Find this account type in our summary array
  const accountSummary = accountSummaries.find(summary => summary.accountType === accountType);
  if (!accountSummary) return;
  
  // Process the account line - each cell is treated independently
  processAccountLineWithColumnAwareness(accountLine, accountSummary, columns);
  
  // Special handling for Revolving account - explicitly look for "0" values
  if (accountType === 'Revolving') {
    // Additional logging to debug Revolving row specifically
    console.log("Revolving raw line:", accountLine);
    
    // Enhanced detection for "0" values in the Revolving row
    const zeroPattern = /\b0\b/g;
    const matches = [...accountLine.matchAll(zeroPattern)];
    console.log("Zero matches in Revolving row:", matches.length);
    
    // If we find multiple zeros, check if they correspond to open and withBalance columns
    if (matches.length >= 2) {
      // Check for zeros near the expected column positions
      const openPos = columns['open'] || 0;
      const withBalancePos = columns['withBalance'] || 0;
      
      // Map matches to their positions
      const matchPositions = matches.map(m => m.index || 0);
      console.log("Zero positions:", matchPositions);
      console.log("Column positions - Open:", openPos, "WithBalance:", withBalancePos);
      
      // Find closest match to each column position
      for (const matchPos of matchPositions) {
        // Determine which column this zero is closest to
        const openDist = Math.abs(matchPos - openPos);
        const withBalanceDist = Math.abs(matchPos - withBalancePos);
        
        if (openDist < withBalanceDist && openDist < 30) {
          accountSummary.open = "0";
          console.log("Explicitly set Revolving open to 0");
        } else if (withBalanceDist < 30) {
          accountSummary.withBalance = "0";
          console.log("Explicitly set Revolving withBalance to 0");
        }
      }
    }
  }
  
  console.log(`${accountType} row after processing:`, accountSummary);
}

/**
 * Process an account line using column-by-column cell extraction
 * Each cell is treated independently
 */
function processAccountLineWithColumnAwareness(
  line: string, 
  accountSummary: AccountSummary, 
  columns: Record<string, number>
): void {
  // Check all column positions in order to ensure proper extraction
  const columnKeys = [
    'accountType', 'open', 'withBalance', 'totalBalance', 
    'available', 'creditLimit', 'debtToCredit', 'payment'
  ];
  
  // Get column positions in the order they appear in the text
  const sortedColumnKeys = columnKeys.sort((a, b) => {
    const posA = columns[a] || 999;
    const posB = columns[b] || 999;
    return posA - posB;
  });
  
  // Process each column in order, treating each cell independently
  for (let i = 0; i < sortedColumnKeys.length; i++) {
    const key = sortedColumnKeys[i];
    const nextKey = i < sortedColumnKeys.length - 1 ? sortedColumnKeys[i + 1] : null;
    
    // Skip accountType as it's already set
    if (key === 'accountType') continue;
    
    // Get the position range for this cell
    const startPos = columns[key];
    const endPos = nextKey ? columns[nextKey] : undefined;
    
    // Extract content for this cell position
    const cellContent = extractCellContent(line, startPos, endPos);
    
    // Log explicitly what we found for debugging
    console.log(`[${accountSummary.accountType}] Cell ${key}: "${cellContent}"`);
    
    // If cell is empty, leave as null (which will render as 'x')
    if (!cellContent) {
      console.log(`[${accountSummary.accountType}] Cell ${key} is empty, keeping as null`);
      continue;
    }
    
    // Special handling for "0" values - check before other processing
    if (cellContent.trim() === "0") {
      if (key === 'open' || key === 'withBalance') {
        // Fix: Convert to string "0" instead of numeric 0 to match type
        accountSummary[key] = "0"; // Store as string "0", not numeric 0
        console.log(`[${accountSummary.accountType}] Set ${key} to string "0"`, accountSummary[key]);
        continue;
      }
    }
    
    // Process the cell content based on its column type
    if (key === 'open' || key === 'withBalance') {
      const numericValue = extractNumericValue(cellContent);
      if (numericValue !== null) {
        // Fix: Ensure we're storing string values, not numbers
        accountSummary[key] = String(numericValue); // Convert to string to match type
        console.log(`[${accountSummary.accountType}] Set ${key} to extracted value`, accountSummary[key]);
      }
    } else if (key === 'totalBalance' || key === 'available' || key === 'creditLimit' || key === 'payment') {
      const dollarValue = extractDollarValue(cellContent);
      if (dollarValue !== null) {
        accountSummary[key] = dollarValue;
      }
    } else if (key === 'debtToCredit') {
      const percentValue = extractPercentageValue(cellContent);
      if (percentValue !== null) {
        accountSummary[key] = percentValue;
      }
    }
  }
  
  console.log(`Processed values for ${accountSummary.accountType}:`, {
    open: accountSummary.open,
    withBalance: accountSummary.withBalance,
    totalBalance: accountSummary.totalBalance,
    available: accountSummary.available,
    creditLimit: accountSummary.creditLimit,
    debtToCredit: accountSummary.debtToCredit,
    payment: accountSummary.payment
  });
}
