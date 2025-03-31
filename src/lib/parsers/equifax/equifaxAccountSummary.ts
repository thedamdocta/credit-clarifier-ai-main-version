
import { AccountSummary } from "../../types/creditReport";

export const extractEquifaxAccountSummaries = (text: string): AccountSummary[] => {
  const summaries: AccountSummary[] = [];
  
  // Common account types in Equifax reports
  const accountTypes = ['Revolving', 'Installment', 'Mortgage', 'Other', 'Total'];

  // Look for the table header first - Equifax has a specific format
  const tableHeaderRegex = /Account\s+Type\s+(Total\s+Accounts)?\s*(Open)?\s*(Closed)?\s*(Balance)?/i;
  const expandedTablePattern = /Account\s+Type\s+Open\s+With\s+Balance\s+Total\s+Balance\s+Available\s+Credit\s+Limit\s+Debt-to-Credit\s+Payment/i;
  
  const tableHeaderMatch = text.match(tableHeaderRegex);
  const hasExpandedTable = expandedTablePattern.test(text);
  
  if (tableHeaderMatch || hasExpandedTable) {
    console.log("Found Equifax account summary table header");
    
    // Extract the table section from the text to limit our search
    const tableSectionMatch = text.match(/(Account\s+Type\s+Open\s+With\s+Balance[\s\S]+?)(?:Other Items|Summary of|Statement|Public Records)/i);
    const tableSection = tableSectionMatch ? tableSectionMatch[1] : text;
    
    if (hasExpandedTable) {
      // For the expanded table format, extract data for each specific account type separately
      extractAccountData(tableSection, accountTypes, summaries);
    } else {
      // Standard table format - process each row
      processStandardTable(text, accountTypes, summaries);
    }
  } else {
    console.log("Could not find Equifax account summary table header");
    
    // Create default entries for all account types with nulls
    createDefaultSummaries(accountTypes, summaries);
  }
  
  console.log("Extracted account summaries:", summaries);
  return summaries;
};

// Helper function to extract account data from expanded table format
function extractAccountData(tableSection: string, accountTypes: string[], summaries: AccountSummary[]) {
  // Split the table text into lines for better processing
  const lines = tableSection.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Process each account type individually
  for (const accountType of accountTypes) {
    // Create a default summary object with null values
    const summary: AccountSummary = createDefaultSummary(accountType);
    
    // Find the line that starts with this account type
    const accountLine = lines.find(line => 
      new RegExp(`^${accountType}\\b`, 'i').test(line)
    );
    
    if (accountLine) {
      console.log(`Found line for ${accountType}: ${accountLine}`);
      
      // Extract data for this specific account type
      extractLineData(accountLine, accountType, summary);
    }
    
    // Add the summary to our list
    summaries.push(summary);
  }
}

// Helper function to extract data from a specific line
function extractLineData(line: string, accountType: string, summary: AccountSummary) {
  // Split the line into tokens for easier access
  const tokens = line.split(/\s+/);
  const accountTypeIndex = tokens.findIndex(t => 
    t.toLowerCase() === accountType.toLowerCase());
  
  if (accountTypeIndex >= 0) {
    // Extract "open" accounts - first number after account type
    let currentIndex = accountTypeIndex + 1;
    
    // Check if the next token is a number (open accounts)
    if (currentIndex < tokens.length && /^\d+$/.test(tokens[currentIndex])) {
      summary.open = parseInt(tokens[currentIndex]);
      currentIndex++;
    }
    
    // Check for "with balance" - next number if present
    if (currentIndex < tokens.length && /^\d+$/.test(tokens[currentIndex])) {
      summary.withBalance = parseInt(tokens[currentIndex]);
      currentIndex++;
    }
    
    // Look for $ values in sequence for totalBalance, available, creditLimit
    const dollarValues = extractDollarValues(line, accountType);
    
    // Only assign values if they exist in the specific format for this account type
    if (dollarValues.length > 0) {
      // Check if values are actually present in the line for this account
      // Map dollar values to their respective fields in the correct order
      if (dollarValues[0]) summary.totalBalance = dollarValues[0];
      if (dollarValues[1]) summary.available = dollarValues[1];
      if (dollarValues[2]) summary.creditLimit = dollarValues[2];
      if (dollarValues[3]) summary.payment = dollarValues[3];
    }
    
    // Extract debt-to-credit percentage specific to this account type
    const percentPattern = new RegExp(`${accountType}[^%]*?(\\d+\\.?\\d*%)`, 'i');
    const percentMatch = line.match(percentPattern);
    if (percentMatch && percentMatch[1]) {
      summary.debtToCredit = percentMatch[1];
    }
  }
}

// Helper function to extract dollar values in the right context
function extractDollarValues(line: string, accountType: string): string[] {
  // Look for dollar values after the account type
  const afterAccountType = line.substring(line.toLowerCase().indexOf(accountType.toLowerCase()));
  const dollarMatches = afterAccountType.match(/\$[\d,.-]+/g);
  
  if (dollarMatches) {
    // Only include dollar values that belong to this account type row
    // Stop when we hit the next account type
    const nextAccountIndex = findNextAccountTypeIndex(afterAccountType);
    if (nextAccountIndex > -1) {
      // Only take dollar values before the next account type
      const relevantSection = afterAccountType.substring(0, nextAccountIndex);
      return relevantSection.match(/\$[\d,.-]+/g) || [];
    }
    return dollarMatches;
  }
  return [];
}

// Helper function to find the index of the next account type in a string
function findNextAccountTypeIndex(text: string): number {
  const accountTypes = ['Revolving', 'Installment', 'Mortgage', 'Other', 'Total'];
  let minIndex = -1;
  
  for (const type of accountTypes) {
    // Skip the first occurrence as it's the current account type
    const firstIndex = text.toLowerCase().indexOf(type.toLowerCase());
    const secondIndex = text.toLowerCase().indexOf(type.toLowerCase(), firstIndex + 1);
    
    if (secondIndex > -1 && (minIndex === -1 || secondIndex < minIndex)) {
      minIndex = secondIndex;
    }
  }
  
  return minIndex;
}

// Helper function to process the standard table format
function processStandardTable(text: string, accountTypes: string[], summaries: AccountSummary[]) {
  for (const accountType of accountTypes) {
    const summary = createDefaultSummary(accountType);
    
    // Try to match the standard row pattern for this account type
    const rowRegex = new RegExp(`${accountType}\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)\\s*(?:\\$([\\.\\d,]+)|\\$0|-)?`, 'i');
    const rowMatch = text.match(rowRegex);
    
    if (rowMatch) {
      console.log(`Found standard row for ${accountType}:`, rowMatch[0]);
      
      // Extract available values
      summary.totalAccounts = rowMatch[1] ? parseInt(rowMatch[1]) : null;
      summary.open = rowMatch[2] ? parseInt(rowMatch[2]) : null; 
      summary.closed = rowMatch[3] ? parseInt(rowMatch[3]) : null;
      
      // For balance, try to extract it
      if (rowMatch[4]) {
        summary.balance = `$${rowMatch[4]}`;
      }
    } else {
      // Try simple pattern for just finding open account number
      const simpleRowRegex = new RegExp(`\\b${accountType}\\b\\s+(\\d+)`, 'i');
      const simpleMatch = text.match(simpleRowRegex);
      
      if (simpleMatch && simpleMatch[1]) {
        summary.open = parseInt(simpleMatch[1]);
      }
    }
    
    summaries.push(summary);
  }
}

// Helper function to create a default summary object
function createDefaultSummary(accountType: string): AccountSummary {
  return {
    accountType,
    totalAccounts: null,
    open: null,
    closed: null,
    balance: null,
    withBalance: null,
    totalBalance: null,
    available: null,
    creditLimit: null,
    debtToCredit: null,
    payment: null
  };
}

// Helper function to create default summaries for all account types
function createDefaultSummaries(accountTypes: string[], summaries: AccountSummary[]) {
  accountTypes.forEach(accountType => {
    summaries.push(createDefaultSummary(accountType));
  });
}
