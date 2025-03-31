
import { AccountSummary } from "../../types/creditReport";

export const extractEquifaxAccountSummaries = (text: string): AccountSummary[] => {
  const summaries: AccountSummary[] = [];
  
  // Common account types in Equifax reports
  const accountTypes = ['Revolving', 'Installment', 'Mortgage', 'Other', 'Total'];

  // Look for the table header first - Equifax has a specific format
  const tableHeaderRegex = /Account\s+Type\s+(Total\s+Accounts)?\s*(Open)?\s*(Closed)?\s*(Balance)?/i;
  const tableHeaderMatch = text.match(tableHeaderRegex);
  
  if (tableHeaderMatch) {
    console.log("Found Equifax account summary table header");
    
    // Extract table rows
    for (const accountType of accountTypes) {
      // Look for rows that start with the account type
      // Updated to match the format: Account Type, Total Accounts, Open, Closed, Balance
      const rowRegex = new RegExp(`${accountType}\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)\\s*(?:\\$([\\.\\d,]+)|\\$0|-)?`, 'i');
      
      // Alternative pattern for just the account type and a number (for "Open" column)
      const simpleRowRegex = new RegExp(`${accountType}\\s+(\\d+)`, 'i');
      
      // Try to find the row with the detailed pattern
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
        
        // Create the summary object with available data
        const summary: AccountSummary = {
          accountType,
          totalAccounts,
          open: openAccounts, 
          closed: closedAccounts,
          balance,
        };
        
        summaries.push(summary);
      } else {
        // Try the simple pattern for just finding the open account number
        const simpleMatch = text.match(simpleRowRegex);
        
        if (simpleMatch && simpleMatch[1]) {
          console.log(`Found simple row for ${accountType}:`, simpleMatch[0]);
          
          // Create summary with just the open account number
          summaries.push({
            accountType,
            totalAccounts: null,
            open: parseInt(simpleMatch[1]),
            closed: null,
            balance: null
          });
        } else {
          // If no match, create a default entry for this account type with nulls
          summaries.push({
            accountType,
            totalAccounts: null,
            open: null,
            closed: null,
            balance: null
          });
        }
      }
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
        balance: null
      });
    });
  }
  
  console.log("Extracted account summaries:", summaries);
  return summaries;
};
