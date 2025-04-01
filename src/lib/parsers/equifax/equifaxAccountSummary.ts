
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
    
    // Post-process the data to handle common OCR errors
    accountSummaries.forEach(summary => {
      // Fix comma issues in "Other" row
      if (summary.accountType === 'Other') {
        if (summary.open === ',') summary.open = '0';
        if (summary.withBalance === ',') summary.withBalance = '0';
        if (summary.totalBalance === '$,') summary.totalBalance = '$0';
      }
      
      // Fix negative values that should be positive
      if (summary.available && summary.available.includes('-')) {
        summary.available = summary.available.replace('-$', '$').replace('-', '');
      }
      if (summary.creditLimit && summary.creditLimit.includes('-')) {
        summary.creditLimit = summary.creditLimit.replace('-$', '$').replace('-', '');
      }
      
      // Fix common debt-to-credit format issues - extract just the number + %
      if (summary.debtToCredit) {
        const match = summary.debtToCredit.match(/(\d+\.?\d*)%?/);
        if (match) {
          const num = parseFloat(match[1]);
          summary.debtToCredit = `${num.toFixed(1)}%`;
        }
      }
      
      // Fix payment values
      if (summary.payment === '$0' && summary.accountType === 'Revolving') {
        // Look for matches to 3-digit or $100+ payment amounts typically found in revolving
        const match = lines.find(line => line.toLowerCase().includes('revolving') && /\$\d{3}/.test(line));
        if (match) {
          const paymentMatch = match.match(/\$(\d{2,3})/);
          if (paymentMatch) {
            summary.payment = `$${paymentMatch[1]}`;
          }
        }
      }
    });
    
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
    
    // Match the account type more precisely to avoid partial matches
    return new RegExp(`(?:^|\\s|\\t)${accountType}(?:\\s|$|\\t|:)`, 'i').test(line);
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
  
  // Additional processing for special values based on account type
  if (accountType === 'Revolving') {
    // Try to extract debt-to-credit values which may be in a different format
    const debtCreditMatch = accountLine.match(/(\d+\.?\d*)\s*%/);
    if (debtCreditMatch && !accountSummary.debtToCredit) {
      accountSummary.debtToCredit = `${parseFloat(debtCreditMatch[1]).toFixed(1)}%`;
    }
    
    // Find payment values which may be missed in column extraction
    const paymentMatch = accountLine.match(/\$(\d{2,3})\b/);
    if (paymentMatch && (!accountSummary.payment || accountSummary.payment === '$0')) {
      accountSummary.payment = `$${paymentMatch[1]}`;
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
    if (cellContent.trim() === "0" || /\b0\b/.test(cellContent)) {
      if (key === 'open' || key === 'withBalance') {
        // Store as string "0", not numeric 0
        accountSummary[key] = "0";
        console.log(`[${accountSummary.accountType}] Set ${key} to string "0"`, accountSummary[key]);
        continue;
      }
    }
    
    // Handle common OCR errors
    if (cellContent.trim() === "," || cellContent.trim() === ".") {
      if (key === 'open' || key === 'withBalance') {
        accountSummary[key] = "0";
        console.log(`[${accountSummary.accountType}] Fixed comma/period in ${key} to "0"`);
        continue;
      }
    }
    
    // Process the cell content based on its column type
    if (key === 'open' || key === 'withBalance') {
      const numericValue = extractNumericValue(cellContent);
      if (numericValue !== null) {
        // Ensure we're storing string values, not numbers
        accountSummary[key] = String(numericValue);
        console.log(`[${accountSummary.accountType}] Set ${key} to extracted value`, accountSummary[key]);
      }
    } else if (key === 'totalBalance' || key === 'available' || key === 'creditLimit' || key === 'payment') {
      const dollarValue = extractDollarValue(cellContent);
      if (dollarValue !== null) {
        // Fix negative values that should be positive (like -$440 should be $440)
        if (dollarValue.includes('-')) {
          accountSummary[key] = dollarValue.replace('-$', '$').replace('-', '');
        } else {
          accountSummary[key] = dollarValue;
        }
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

