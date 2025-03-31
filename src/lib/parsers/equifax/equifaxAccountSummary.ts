
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
    
    // Extract account data from this line
    const tokens = accountLine.split(/\s+/);
    
    // Find the position of the account type in the tokens
    const accountTypeIndex = tokens.findIndex(t => 
      new RegExp(`\\b${t}\\b`, 'i').test(accountType)
    );
    
    if (accountTypeIndex >= 0) {
      // Extract Open accounts - first number after account type
      const openIndex = accountTypeIndex + 1;
      if (openIndex < tokens.length && /^\d+$/.test(tokens[openIndex])) {
        summary.open = parseInt(tokens[openIndex]);
      }
      
      // Extract With Balance - second number after account type
      const withBalanceIndex = openIndex + 1;
      if (withBalanceIndex < tokens.length && /^\d+$/.test(tokens[withBalanceIndex])) {
        summary.withBalance = parseInt(tokens[withBalanceIndex]);
      }
      
      // Look for dollar values and percentages
      const dollarPattern = /\$([0-9,.-]+)/g;
      const percentPattern = /(\d+\.?\d*)%/;
      
      let dollarMatches = [];
      let match;
      
      // Extract all dollar values from the line
      while ((match = dollarPattern.exec(accountLine)) !== null) {
        dollarMatches.push(match[0]);
      }
      
      // Assign dollar values in expected order - skip values that are clearly not for this row
      if (dollarMatches.length > 0) {
        // Filter out dollar values that clearly belong to another row
        // by checking if they appear before the account type name in the line
        const accountTypePos = accountLine.indexOf(accountType);
        dollarMatches = dollarMatches.filter(match => 
          accountLine.indexOf(match) > accountTypePos
        );
        
        // Now assign the values in sequence: totalBalance, available, creditLimit, payment
        const valueMapping = [
          { field: 'totalBalance', index: 0 },
          { field: 'available', index: 1 },
          { field: 'creditLimit', index: 2 },
          { field: 'payment', index: 3 }
        ];
        
        for (const mapping of valueMapping) {
          if (mapping.index < dollarMatches.length) {
            summary[mapping.field] = dollarMatches[mapping.index];
          }
        }
      }
      
      // Extract debt-to-credit percentage
      const percentMatch = accountLine.match(percentPattern);
      if (percentMatch) {
        summary.debtToCredit = `${percentMatch[0]}`;
      }
    }
  }
  
  summaries.push(summary);
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
