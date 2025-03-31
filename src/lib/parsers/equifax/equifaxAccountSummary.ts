
import { AccountSummary } from "../../types/creditReport";

export const extractEquifaxAccountSummaries = (text: string): AccountSummary[] => {
  const summaries: AccountSummary[] = [];
  
  // Common account types in Equifax reports
  const accountTypes = ['Revolving', 'Installment', 'Mortgage', 'Other', 'Total'];

  // Look for the table header first - Equifax has a specific format
  const tableHeaderRegex = /Account\s+Type\s+(Total\s+Accounts)?\s*(Open)?\s*(Closed)?\s*(Balance)?/i;
  const tableHeaderMatch = text.match(tableHeaderRegex);
  
  // Also check if we have the expanded table format
  const expandedTablePattern = /Account\s+Type\s+Open\s+With\s+Balance\s+Total\s+Balance\s+Available\s+Credit\s+Limit\s+Debt-to-Credit\s+Payment/i;
  const hasExpandedTable = expandedTablePattern.test(text);
  
  if (tableHeaderMatch || hasExpandedTable) {
    console.log("Found Equifax account summary table header");
    
    // First extract the table section from the text
    // This helps limit our search to just the relevant table data
    const tableSectionMatch = text.match(/(Account\s+Type\s+Open\s+With\s+Balance[\s\S]+?)(?:Other Items|Summary of|Statement|Public Records)/i);
    const tableSection = tableSectionMatch ? tableSectionMatch[1] : text;
    
    // Process each account type individually
    for (const accountType of accountTypes) {
      // Create a default summary object with null values
      const summary: AccountSummary = {
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
      
      // For expanded table format, extract data line by line for each account type
      if (hasExpandedTable) {
        // Find the specific line for this account type
        const accountTypeLineRegex = new RegExp(`\\b${accountType}\\b[^\\n]+`, 'i');
        const accountTypeLine = tableSection.match(accountTypeLineRegex);
        
        if (accountTypeLine && accountTypeLine[0]) {
          const line = accountTypeLine[0].trim();
          console.log(`Found line for ${accountType}: ${line}`);
          
          // Extract open accounts - first number after account type
          const openMatch = line.match(new RegExp(`\\b${accountType}\\b\\s+(\\d+)`));
          if (openMatch && openMatch[1]) {
            summary.open = parseInt(openMatch[1]);
          }
          
          // Extract "with balance" - typically the second number
          const parts = line.split(/\s+/);
          const accountTypeIndex = parts.findIndex(p => 
            p.toLowerCase() === accountType.toLowerCase());
          
          if (accountTypeIndex >= 0 && parts.length > accountTypeIndex + 2) {
            // First number is open, second is withBalance
            const withBalanceIndex = accountTypeIndex + 2;
            if (/^\d+$/.test(parts[withBalanceIndex])) {
              summary.withBalance = parseInt(parts[withBalanceIndex]);
            }
          }
          
          // Extract dollar values - they should appear in order
          const dollarValues = line.match(/\$[\d,.]+/g);
          if (dollarValues) {
            if (dollarValues.length > 0) summary.totalBalance = dollarValues[0];
            if (dollarValues.length > 1) summary.available = dollarValues[1]; 
            if (dollarValues.length > 2) summary.creditLimit = dollarValues[2];
            if (dollarValues.length > 3) summary.payment = dollarValues[3];
          }
          
          // Extract debt-to-credit percentage
          const percentageMatch = line.match(/(\d+\.?\d*%)/);
          if (percentageMatch && percentageMatch[1]) {
            summary.debtToCredit = percentageMatch[1];
          }
        }
      } else {
        // Standard table format - using previous regex approach with some improvements
        const rowRegex = new RegExp(`${accountType}\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)\\s*(?:\\$([\\.\\d,]+)|\\$0|-)?`, 'i');
        const rowMatch = text.match(rowRegex);
        
        if (rowMatch) {
          console.log(`Found detailed row for ${accountType}:`, rowMatch[0]);

          // Extract the values (without providing fallbacks, to allow nulls)
          const totalAccounts = rowMatch[1] ? parseInt(rowMatch[1]) : null;
          const openAccounts = rowMatch[2] ? parseInt(rowMatch[2]) : null;
          const closedAccounts = rowMatch[3] ? parseInt(rowMatch[3]) : null;
          
          // For balance, try to extract it from either pattern
          let balance: string | null = null;
          if (rowMatch[4]) {
            balance = `$${rowMatch[4]}`;
          }
          
          // Update the summary object with available data
          summary.totalAccounts = totalAccounts;
          summary.open = openAccounts; 
          summary.closed = closedAccounts;
          summary.balance = balance;
        } else {
          // Try the simple pattern for just finding the open account number
          const simpleRowRegex = new RegExp(`\\b${accountType}\\b\\s+(\\d+)`, 'i');
          const simpleMatch = text.match(simpleRowRegex);
          
          if (simpleMatch && simpleMatch[1]) {
            summary.open = parseInt(simpleMatch[1]);
          }
        }
      }
      
      // Add the summary to our list
      summaries.push(summary);
    }
  } else {
    console.log("Could not find Equifax account summary table header");
    
    // Create default entries for all account types with nulls
    accountTypes.forEach(accountType => {
      summaries.push({
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
      });
    });
  }
  
  console.log("Extracted account summaries:", summaries);
  return summaries;
};
