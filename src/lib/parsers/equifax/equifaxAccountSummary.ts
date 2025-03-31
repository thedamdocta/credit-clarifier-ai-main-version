
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
    
    // Extract table rows
    for (const accountType of accountTypes) {
      // For expanded table format
      if (hasExpandedTable) {
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
        
        // Match open accounts
        const openPattern = new RegExp(`${accountType}\\s+(\\d+)(?:\\s|$)`, 'i');
        const openMatch = text.match(openPattern);
        if (openMatch && openMatch[1]) {
          summary.open = parseInt(openMatch[1]);
        }
        
        // Match with balance 
        const withBalancePattern = new RegExp(`${accountType}(?:[^\\n]*?)(\\d+)\\s+(?:with\\s+balance|\\$[\\d,.]+)`, 'i');
        const withBalanceMatch = text.match(withBalancePattern);
        if (withBalanceMatch && withBalanceMatch[1] && summary.open !== null) {
          // Only set withBalance if we have a valid open value and the match isn't just repeating the open value
          summary.withBalance = parseInt(withBalanceMatch[1]);
        }
        
        // Match total balance with more flexible pattern
        const totalBalancePattern = new RegExp(`${accountType}[^\\n]*?(\\$[\\d,.]+)(?:\\s|$)`, 'i');
        const totalBalanceMatch = text.match(totalBalancePattern);
        if (totalBalanceMatch && totalBalanceMatch[1]) {
          summary.totalBalance = totalBalanceMatch[1];
        }
        
        // Match available credit
        const availablePattern = new RegExp(`${accountType}[^\\n]*?(?:available[^\\n]*?)(\\-?\\$[\\d,.]+)`, 'i');
        const availableMatch = text.match(availablePattern);
        if (availableMatch && availableMatch[1]) {
          summary.available = availableMatch[1];
        }
        
        // Match credit limit
        const creditLimitPattern = new RegExp(`${accountType}[^\\n]*?(?:credit\\s+limit[^\\n]*?)(\\$[\\d,.]+)`, 'i');
        const creditLimitMatch = text.match(creditLimitPattern);
        if (creditLimitMatch && creditLimitMatch[1]) {
          summary.creditLimit = creditLimitMatch[1];
        }
        
        // Match debt to credit ratio
        const debtToCreditPattern = new RegExp(`${accountType}[^\\n]*?(?:debt-to-credit[^\\n]*?)([\\d.]+%)`, 'i');
        const debtToCreditMatch = text.match(debtToCreditPattern);
        if (debtToCreditMatch && debtToCreditMatch[1]) {
          summary.debtToCredit = debtToCreditMatch[1];
        }
        
        // Match payment amount
        const paymentPattern = new RegExp(`${accountType}[^\\n]*?(?:payment[^\\n]*?)(\\$[\\d,.]+)`, 'i');
        const paymentMatch = text.match(paymentPattern);
        if (paymentMatch && paymentMatch[1]) {
          summary.payment = paymentMatch[1];
        }
        
        summaries.push(summary);
      } else {
        // Standard table format - using previous regex approach with some improvements
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
            withBalance: null,
            totalBalance: null,
            available: null,
            creditLimit: null,
            debtToCredit: null,
            payment: null
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
              balance: null,
              withBalance: null,
              totalBalance: null,
              available: null,
              creditLimit: null,
              debtToCredit: null,
              payment: null
            });
          } else {
            // If no match, create a default entry for this account type with nulls
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
          }
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
