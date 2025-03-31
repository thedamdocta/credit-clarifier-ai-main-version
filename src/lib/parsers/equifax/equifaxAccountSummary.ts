
import { AccountSummary } from "../../types/creditReport";

export const extractEquifaxAccountSummaries = (text: string): AccountSummary[] => {
  const summaries: AccountSummary[] = [];
  
  // Common account types in Equifax reports
  const accountTypes = ['Revolving', 'Mortgage', 'Installment', 'Other', 'Total'];

  // Look for the table header first - Equifax has a specific format
  const tableHeaderRegex = /Account\s+Type\s+(Total\s+Accounts)?\s*(Open)?\s*(Closed)?\s*(Balance)?/i;
  const expandedTablePattern = /Account\s+Type\s+Open\s+With\s+Balance\s+Total\s+Balance\s+Available\s+Credit\s+Limit\s+Debt-to-Credit\s+Payment/i;
  
  const tableHeaderMatch = text.match(tableHeaderRegex);
  const hasExpandedTable = expandedTablePattern.test(text);
  
  if (tableHeaderMatch || hasExpandedTable) {
    console.log("Found Equifax account summary table header");
    
    // Extract the table section from the text to limit our search
    // Use a broader match to ensure we capture all rows of the table
    const tableSectionMatch = text.match(/(Account\s+Type[\s\S]+?)(?:Other Items|Summary of|Consumer Statement|Public Records|End of Report)/i);
    const tableSection = tableSectionMatch ? tableSectionMatch[1] : text;
    
    // Create default summaries for all account types
    const summaryMap = new Map();
    accountTypes.forEach(accountType => {
      summaryMap.set(accountType, createDefaultSummary(accountType));
    });
    
    // Split into lines for processing row by row
    const lines = tableSection.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
      
    // Look for each account type in the lines and extract the data
    accountTypes.forEach(accountType => {
      // Find lines containing this specific account type
      const accountLine = lines.find(line => 
        line.match(new RegExp(`^\\s*${accountType}\\b`, 'i')) || 
        line.match(new RegExp(`\\s+${accountType}\\s+\\d+`, 'i'))
      );
      
      if (accountLine) {
        processAccountLine(accountLine, accountType, summaryMap.get(accountType));
      }
    });
    
    // Convert the map to an array and add to summaries
    summaryMap.forEach(summary => {
      summaries.push(summary);
    });
  } else {
    console.log("Could not find Equifax account summary table header");
    // Create default summaries for all account types
    accountTypes.forEach(accountType => {
      summaries.push(createDefaultSummary(accountType));
    });
  }
  
  // Sort the summaries to match the expected order
  summaries.sort((a, b) => {
    return accountTypes.indexOf(a.accountType) - accountTypes.indexOf(b.accountType);
  });
  
  console.log("Extracted account summaries:", summaries);
  return summaries;
};

// Process a single line that contains account type information
function processAccountLine(line: string, accountType: string, summary: AccountSummary) {
  console.log(`Processing line for ${accountType}:`, line);
  
  // Find position of account type in the line
  let startIndex = line.indexOf(accountType);
  if (startIndex < 0) {
    const match = line.match(new RegExp(`\\b${accountType}\\b`, 'i'));
    startIndex = match ? match.index || 0 : 0;
  }
  
  // Skip the account type text itself
  const afterType = line.substring(startIndex + accountType.length).trim();
  
  // Split by whitespace into potential columns
  const columns = afterType.split(/\s+/);
  
  // Extract numeric values (open and withBalance counts)
  let openCountIndex = -1;
  let withBalanceIndex = -1;
  
  // Find first two numeric values for open and withBalance
  for (let i = 0; i < columns.length; i++) {
    if (/^\d+$/.test(columns[i])) {
      if (openCountIndex === -1) {
        openCountIndex = i;
        summary.open = parseInt(columns[i]);
      } else if (withBalanceIndex === -1) {
        withBalanceIndex = i;
        summary.withBalance = parseInt(columns[i]);
        break;
      }
    }
  }
  
  // Look for dollar values and percentages in specific positions after account type
  extractFinancialValues(line, accountType, summary);
}

// Extract dollar values and percentages from a line
function extractFinancialValues(line: string, accountType: string, summary: AccountSummary) {
  // Find position of account type in line
  const typePos = line.indexOf(accountType);
  if (typePos === -1) return;
  
  const afterType = line.substring(typePos + accountType.length);
  
  // Extract all dollar values using improved pattern that handles negative numbers
  const dollarPattern = /(-?\$[0-9,.-]+|\$-[0-9,.-]+)/g;
  const dollars = [];
  let match;
  
  // Find all dollar value matches after account type position
  while ((match = dollarPattern.exec(afterType)) !== null) {
    dollars.push(match[0]);
  }
  
  // Only assign dollar values if they actually appear in this row
  if (dollars.length >= 1) {
    summary.totalBalance = normalizeDollarFormat(dollars[0]);
  }
  if (dollars.length >= 2) {
    summary.available = normalizeDollarFormat(dollars[1]);
  }
  if (dollars.length >= 3) {
    summary.creditLimit = normalizeDollarFormat(dollars[2]);
  }
  if (dollars.length >= 4) {
    summary.payment = normalizeDollarFormat(dollars[3]);
  }
  
  // Extract debt-to-credit percentage
  const percentPattern = /(\d+\.?\d*)\s*%/;
  const percentMatch = afterType.match(percentPattern);
  if (percentMatch) {
    summary.debtToCredit = `${percentMatch[0].trim()}`;
  }
}

// Normalize dollar format to ensure negative values are consistently formatted
function normalizeDollarFormat(value: string): string {
  if (value.startsWith('$-')) {
    // Convert $-1,234 format to -$1,234
    return '-$' + value.substring(2);
  }
  return value;
}

// Helper function to create a default summary object with null values
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
