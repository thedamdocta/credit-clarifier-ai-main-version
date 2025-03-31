
import { AccountSummary } from "../../types/creditReport";
import { parsingLogger } from "@/utils/parsingLogger";
import { formatAccountValue } from "@/utils/formatters/accountValueFormatters";

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
    
    // Process each account type with completely isolated extraction functions
    extractRevolvingAccount(lines, accountSummaries, columns);
    extractMortgageAccount(lines, accountSummaries, columns);
    extractInstallmentAccount(lines, accountSummaries, columns);
    extractOtherAccount(lines, accountSummaries, columns);
    extractTotalAccount(lines, accountSummaries, columns);
    
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
  // First try to find the "Credit Accounts" header section
  const creditAccountsPattern = /\bCredit\s+Accounts\b.*?(?:\n|$)/i;
  const creditAccountsMatch = text.match(creditAccountsPattern);
  
  if (!creditAccountsMatch) {
    return extractTableSectionFallback(text);
  }
  
  const headerIndex = creditAccountsMatch.index || 0;
  
  // Look for the account type header row after the Credit Accounts header
  const accountTypeHeaderPattern = /\baccount\s+type\b.*?\bopen\b.*?\bwith\s+balance\b.*?\btotal\s+balance\b/i;
  const headerMatch = text.slice(headerIndex).match(accountTypeHeaderPattern);
  
  if (!headerMatch) {
    return extractTableSectionFallback(text);
  }
  
  // Get the text from the header to the end of the table
  const accountTypeHeaderIndex = headerIndex + (headerMatch.index || 0);
  const tableEndPattern = /(?:other items|summary of|consumer statement|public records|end of report)/i;
  const tableEndMatch = text.slice(accountTypeHeaderIndex).match(tableEndPattern);
  
  if (tableEndMatch) {
    return text.slice(accountTypeHeaderIndex, accountTypeHeaderIndex + tableEndMatch.index);
  } else {
    // If we can't find a clear end, just take a reasonable chunk
    return text.slice(accountTypeHeaderIndex, accountTypeHeaderIndex + 3000); 
  }
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
 * Isolated extraction function specifically for Revolving accounts
 */
function extractRevolvingAccount(lines: string[], accountSummaries: AccountSummary[], columns: Record<string, number>): void {
  console.log("Extracting Revolving account line");
  const accountType = 'Revolving';
  
  // Find the line that specifically contains just Revolving as a word
  const accountLine = lines.find(line => {
    // Skip the header line
    if (line.toLowerCase().includes('account type') && line.toLowerCase().includes('with balance')) {
      return false;
    }
    
    // Match only if line begins with Revolving or has clear word boundary
    const matches = line.match(/(?:^|\s)Revolving(?:\s|$)/i);
    return matches !== null;
  });
  
  if (!accountLine) {
    console.log(`No line found for ${accountType}`);
    return;
  }
  
  console.log(`Found line for ${accountType}:`, accountLine);
  
  // Find this account type in our summary array
  const accountSummary = accountSummaries.find(summary => summary.accountType === accountType);
  if (!accountSummary) return;
  
  // Extract values based on column positions
  extractValuesFromLine(accountLine, accountSummary, columns);
  
  console.log(`Processed ${accountType}:`, accountSummary);
}

/**
 * Isolated extraction function specifically for Mortgage accounts
 */
function extractMortgageAccount(lines: string[], accountSummaries: AccountSummary[], columns: Record<string, number>): void {
  console.log("Extracting Mortgage account line");
  const accountType = 'Mortgage';
  
  // Find the line that specifically contains just Mortgage as a word
  const accountLine = lines.find(line => {
    // Skip the header line
    if (line.toLowerCase().includes('account type') && line.toLowerCase().includes('with balance')) {
      return false;
    }
    
    // Match only if line begins with Mortgage or has clear word boundary
    const matches = line.match(/(?:^|\s)Mortgage(?:\s|$)/i);
    return matches !== null;
  });
  
  if (!accountLine) {
    console.log(`No line found for ${accountType}`);
    return;
  }
  
  console.log(`Found line for ${accountType}:`, accountLine);
  
  // Find this account type in our summary array
  const accountSummary = accountSummaries.find(summary => summary.accountType === accountType);
  if (!accountSummary) return;
  
  // Extract values based on column positions
  extractValuesFromLine(accountLine, accountSummary, columns);
  
  console.log(`Processed ${accountType}:`, accountSummary);
}

/**
 * Isolated extraction function specifically for Installment accounts
 */
function extractInstallmentAccount(lines: string[], accountSummaries: AccountSummary[], columns: Record<string, number>): void {
  console.log("Extracting Installment account line");
  const accountType = 'Installment';
  
  // Find the line that specifically contains just Installment as a word
  const accountLine = lines.find(line => {
    // Skip the header line
    if (line.toLowerCase().includes('account type') && line.toLowerCase().includes('with balance')) {
      return false;
    }
    
    // Match only if line begins with Installment or has clear word boundary
    const matches = line.match(/(?:^|\s)Installment(?:\s|$)/i);
    return matches !== null;
  });
  
  if (!accountLine) {
    console.log(`No line found for ${accountType}`);
    return;
  }
  
  console.log(`Found line for ${accountType}:`, accountLine);
  
  // Find this account type in our summary array
  const accountSummary = accountSummaries.find(summary => summary.accountType === accountType);
  if (!accountSummary) return;
  
  // Extract values based on column positions
  extractValuesFromLine(accountLine, accountSummary, columns);
  
  console.log(`Processed ${accountType}:`, accountSummary);
}

/**
 * Isolated extraction function specifically for Other accounts
 */
function extractOtherAccount(lines: string[], accountSummaries: AccountSummary[], columns: Record<string, number>): void {
  console.log("Extracting Other account line");
  const accountType = 'Other';
  
  // Find the line that specifically contains just Other as a word
  const accountLine = lines.find(line => {
    // Skip the header line
    if (line.toLowerCase().includes('account type') && line.toLowerCase().includes('with balance')) {
      return false;
    }
    
    // Match only if line begins with Other or has clear word boundary
    const matches = line.match(/(?:^|\s)Other(?:\s|$)/i);
    return matches !== null;
  });
  
  if (!accountLine) {
    console.log(`No line found for ${accountType}`);
    return;
  }
  
  console.log(`Found line for ${accountType}:`, accountLine);
  
  // Find this account type in our summary array
  const accountSummary = accountSummaries.find(summary => summary.accountType === accountType);
  if (!accountSummary) return;
  
  // Extract values based on column positions
  extractValuesFromLine(accountLine, accountSummary, columns);
  
  console.log(`Processed ${accountType}:`, accountSummary);
}

/**
 * Isolated extraction function specifically for Total line
 */
function extractTotalAccount(lines: string[], accountSummaries: AccountSummary[], columns: Record<string, number>): void {
  console.log("Extracting Total account line");
  const accountType = 'Total';
  
  // Find the line that specifically contains just Total as a word
  const accountLine = lines.find(line => {
    // Skip the header line
    if (line.toLowerCase().includes('account type') && line.toLowerCase().includes('with balance')) {
      return false;
    }
    
    // Match only if line begins with Total or has clear word boundary
    const matches = line.match(/(?:^|\s)Total(?:\s|$)/i);
    return matches !== null;
  });
  
  if (!accountLine) {
    console.log(`No line found for ${accountType}`);
    return;
  }
  
  console.log(`Found line for ${accountType}:`, accountLine);
  
  // Find this account type in our summary array
  const accountSummary = accountSummaries.find(summary => summary.accountType === accountType);
  if (!accountSummary) return;
  
  // Extract values based on column positions
  extractValuesFromLine(accountLine, accountSummary, columns);
  
  console.log(`Processed ${accountType}:`, accountSummary);
}

/**
 * Extract values from a line based on column positions
 */
function extractValuesFromLine(line: string, accountSummary: AccountSummary, columns: Record<string, number>): void {
  // Ensure we have the full line to work with
  if (!line || line.length < 10) return;
  
  try {
    // Extract numeric values with better spacing recognition for Open
    accountSummary.open = extractSingleNumericValue(line, columns.open);
    
    // Extract numeric values with better spacing recognition for With Balance
    accountSummary.withBalance = extractSingleNumericValue(line, columns.withBalance);
    
    // For dollar amount columns
    accountSummary.totalBalance = extractDollarValue(line, columns.totalBalance, columns.available);
    accountSummary.available = extractDollarValue(line, columns.available, columns.creditLimit);
    accountSummary.creditLimit = extractDollarValue(line, columns.creditLimit, columns.debtToCredit);
    accountSummary.payment = extractDollarValue(line, columns.payment);
    
    // For percentage column
    accountSummary.debtToCredit = extractPercentageValue(line, columns.debtToCredit, columns.payment);
  } catch (error) {
    console.error("Error extracting values from line:", error);
  }
}

/**
 * Extract a single numeric value from a line based on column positions
 * This function specifically looks for isolated numbers with spaces around them
 */
function extractSingleNumericValue(line: string, startPos: number): string | null {
  if (startPos === undefined || startPos < 0) return null;
  
  try {
    // Get the portion of the line starting at the column position
    const substring = line.substring(startPos).trim();
    
    // Extract the first standalone numeric value 
    // This pattern looks for digits that are surrounded by word boundaries
    const match = substring.match(/\b(\d+)\b/);
    if (match && match[1]) {
      return match[1];
    }
  } catch (error) {
    console.error("Error extracting numeric value:", error);
  }
  
  return null;
}

/**
 * Extract a dollar value from a line based on column positions
 */
function extractDollarValue(line: string, startPos: number, endPos?: number): string | null {
  if (startPos === undefined || startPos < 0) return null;
  
  try {
    const substring = endPos !== undefined ? 
      line.substring(startPos, endPos).trim() : 
      line.substring(startPos).trim();
    
    // Match dollar patterns for both positive and negative values
    // Handles both -$XXX and $-XXX formats for negative values
    const match = substring.match(/(-?\$[\d,.]+|\$-[\d,.]+)/);
    if (match && match[1]) {
      // Normalize negative format to -$XXX
      let value = match[1];
      if (value.startsWith('$-')) {
        value = `-$${value.substring(2)}`;
      }
      return value;
    }
  } catch (error) {
    console.error("Error extracting dollar value:", error);
  }
  
  return null;
}

/**
 * Extract a percentage value from a line based on column positions
 */
function extractPercentageValue(line: string, startPos: number, endPos?: number): string | null {
  if (startPos === undefined || startPos < 0) return null;
  
  try {
    const substring = endPos !== undefined ? 
      line.substring(startPos, endPos).trim() : 
      line.substring(startPos).trim();
    
    // Extract percentage value
    const match = substring.match(/([\d.]+%)/);
    if (match && match[1]) {
      return match[1];
    }
  } catch (error) {
    console.error("Error extracting percentage value:", error);
  }
  
  return null;
}
