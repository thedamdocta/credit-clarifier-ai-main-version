
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
    // Use a broader match to ensure we capture all rows of the table
    const tableSectionMatch = text.match(/(Account\s+Type[\s\S]+?)(?:Other Items|Summary of|Consumer Statement|Public Records|End of Report)/i);
    const tableSection = tableSectionMatch ? tableSectionMatch[1] : text;
    
    // Split the table into lines for better processing
    const lines = tableSection.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    // Process each account type individually from the table section
    for (const accountType of accountTypes) {
      processAccountTypeData(lines, accountType, summaries);
    }
  } else {
    console.log("Could not find Equifax account summary table header");
    
    // Create default entries for all account types with nulls
    createDefaultSummaries(accountTypes, summaries);
  }
  
  console.log("Extracted account summaries:", summaries);
  return summaries;
};

// Process data for a specific account type by searching through table lines
function processAccountTypeData(lines: string[], accountType: string, summaries: AccountSummary[]) {
  // Create a default summary for this account type
  const summary: AccountSummary = createDefaultSummary(accountType);
  
  // Find the line that starts with this account type
  // We need to be careful to match it at the beginning of a line or word boundary
  const accountLines = lines.filter(line => 
    new RegExp(`\\b${accountType}\\b`, 'i').test(line)
  );
  
  if (accountLines.length > 0) {
    // Get the first line that contains this account type
    const accountLine = accountLines[0];
    console.log(`Found line for ${accountType}:`, accountLine);
    
    // Extract numeric values for open and with balance columns
    extractNumericValues(accountLine, accountType, summary);
    
    // Extract dollar values (including negative numbers) and percentages
    extractFinancialValues(accountLine, accountType, summary);
  }
  
  summaries.push(summary);
}

// Extract numeric values (open and withBalance) from a line
function extractNumericValues(line: string, accountType: string, summary: AccountSummary) {
  // Get the position of account type in the line
  const accountTypePos = line.indexOf(accountType);
  if (accountTypePos < 0) return;
  
  // Get text after account type
  const afterAccountType = line.substring(accountTypePos + accountType.length);
  
  // Split by whitespace and find first numbers
  const tokens = afterAccountType.trim().split(/\s+/);
  let numCount = 0;
  
  for (let i = 0; i < tokens.length; i++) {
    if (/^\d+$/.test(tokens[i])) {
      if (numCount === 0) {
        summary.open = parseInt(tokens[i]);
      } else if (numCount === 1) {
        summary.withBalance = parseInt(tokens[i]);
      }
      numCount++;
      
      // Stop after finding the first two numbers
      if (numCount >= 2) break;
    }
  }
}

// Extract dollar values and percentages from a line
function extractFinancialValues(line: string, accountType: string, summary: AccountSummary) {
  const accountTypePos = line.indexOf(accountType);
  if (accountTypePos < 0) return;
  
  // Extract all dollar values, including negative numbers
  // Pattern now includes -$ format and $- format for negative numbers
  const dollarPattern = /(-?\$[0-9,.-]+|\$-[0-9,.-]+)/g;
  const dollars = [];
  let match;
  
  // Find all dollar matches after account type position
  const afterAccountType = line.substring(accountTypePos + accountType.length);
  while ((match = dollarPattern.exec(afterAccountType)) !== null) {
    dollars.push(match[0]);
  }
  
  // Assign dollar values in expected order
  const dollarFields = ['totalBalance', 'available', 'creditLimit', 'payment'];
  dollars.forEach((value, index) => {
    if (index < dollarFields.length) {
      // Convert incorrectly formatted negative numbers ($-1,234) to proper format (-$1,234)
      if (value.startsWith('$-')) {
        value = '-$' + value.substring(2);
      }
      summary[dollarFields[index]] = value;
    }
  });
  
  // Extract debt-to-credit percentage
  const percentPattern = /(\d+\.?\d*)\s*%/;
  const percentMatch = afterAccountType.match(percentPattern);
  if (percentMatch) {
    summary.debtToCredit = `${percentMatch[0].trim()}`;
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
