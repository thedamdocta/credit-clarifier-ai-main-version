
import { AccountSummary } from "../../types/creditReport";
import { parsingLogger } from "@/utils/parsingLogger";

export const extractEquifaxAccountSummaries = async (text: string): Promise<AccountSummary[]> => {
  console.log("Starting account summary extraction for table structure");
  parsingLogger.logEvent("Starting equifax account summary extraction");
  
  // Define the empty account summaries structure 
  const accountSummaries: AccountSummary[] = [
    { accountType: 'Revolving', totalAccounts: null, open: null, closed: null, balance: null, withBalance: null, totalBalance: null, available: null, creditLimit: null, debtToCredit: null, payment: null },
    { accountType: 'Mortgage', totalAccounts: null, open: null, closed: null, balance: null, withBalance: null, totalBalance: null, available: null, creditLimit: null, debtToCredit: null, payment: null },
    { accountType: 'Installment', totalAccounts: null, open: null, closed: null, balance: null, withBalance: null, totalBalance: null, available: null, creditLimit: null, debtToCredit: null, payment: null },
    { accountType: 'Other', totalAccounts: null, open: null, closed: null, balance: null, withBalance: null, totalBalance: null, available: null, creditLimit: null, debtToCredit: null, payment: null },
    { accountType: 'Total', totalAccounts: null, open: null, closed: null, balance: null, withBalance: null, totalBalance: null, available: null, creditLimit: null, debtToCredit: null, payment: null }
  ];

  try {
    // Extract the table section with account summaries
    const tableText = extractTableSection(text);
    if (!tableText) {
      console.log("Could not find account summary table section");
      parsingLogger.logEvent("No account summary table section found");
      return accountSummaries;
    }
    
    // Extract rows from the table
    const rows = extractTableRows(tableText);
    if (rows.length === 0) {
      console.log("No table rows found");
      parsingLogger.logEvent("No table rows found");
      return accountSummaries;
    }
    
    // Find the header row to determine column positions
    const headerRow = rows.find(row => 
      row.toLowerCase().includes("account type") && 
      row.toLowerCase().includes("open") && 
      row.toLowerCase().includes("balance")
    );
    
    if (!headerRow) {
      console.log("Could not find header row");
      parsingLogger.logEvent("No header row found");
      return accountSummaries;
    }
    
    // Define column positions based on header row
    const columnPositions = getColumnPositions(headerRow);
    
    // Process each account type individually with its own row
    processAccountTypeRows(rows, accountSummaries, columnPositions);
    
    console.log("Final extracted account summaries:", accountSummaries);
    parsingLogger.logEvent("Completed account summary extraction", { count: accountSummaries.length });
    return accountSummaries;
  } catch (error) {
    console.error("Error extracting account summaries:", error);
    parsingLogger.logEvent("Error extracting account summaries", { error: String(error) });
    return accountSummaries; // Return empty structure on error
  }
};

/**
 * Extract the table section containing account summaries
 */
function extractTableSection(text: string): string | null {
  // Look for a section that contains the account summary table
  const tableMarkers = [
    /Your credit report includes information about activity on your credit accounts[\s\S]*?Account Type/i,
    /Credit Accounts[\s\S]*?Account Type/i,
    /Account Type\s+Open\s+With Balance/i
  ];
  
  for (const marker of tableMarkers) {
    const match = text.match(marker);
    if (match) {
      // Extract from the match to the end of the table section
      const startIndex = match.index || 0;
      // Find an ending marker for the table section
      const endMarkers = [
        /(?:Other Items|Consumer Statement|Public Records|End of Report)/i
      ];
      
      let endIndex = text.length;
      for (const endMarker of endMarkers) {
        const endMatch = text.slice(startIndex).match(endMarker);
        if (endMatch && endMatch.index) {
          endIndex = startIndex + endMatch.index;
          break;
        }
      }
      
      return text.slice(startIndex, endIndex);
    }
  }
  
  return null;
}

/**
 * Extract rows from the table text
 */
function extractTableRows(tableText: string): string[] {
  // Split by newlines and clean each row
  return tableText.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

/**
 * Determine the position of each column in the header row
 */
function getColumnPositions(headerRow: string): Record<string, number> {
  const positions: Record<string, number> = {};
  
  // Find positions of key headers
  const accountTypePos = headerRow.toLowerCase().indexOf("account type");
  const openPos = headerRow.toLowerCase().indexOf("open");
  const withBalancePos = headerRow.toLowerCase().indexOf("with balance");
  const totalBalancePos = headerRow.toLowerCase().indexOf("total balance");
  const availablePos = headerRow.toLowerCase().indexOf("available");
  const creditLimitPos = headerRow.toLowerCase().indexOf("credit limit");
  const debtToCreditPos = headerRow.toLowerCase().indexOf("debt-to-credit");
  const paymentPos = headerRow.toLowerCase().indexOf("payment");
  
  positions.accountType = accountTypePos;
  positions.open = openPos;
  positions.withBalance = withBalancePos;
  positions.totalBalance = totalBalancePos;
  positions.available = availablePos;
  positions.creditLimit = creditLimitPos;
  positions.debtToCredit = debtToCreditPos;
  positions.payment = paymentPos;
  
  return positions;
}

/**
 * Process each account type row from the table
 */
function processAccountTypeRows(rows: string[], accountSummaries: AccountSummary[], columnPositions: Record<string, number>): void {
  // Define account types to look for
  const accountTypes = ['Revolving', 'Mortgage', 'Installment', 'Other', 'Total'];
  
  // Process each account type
  for (const accountType of accountTypes) {
    // Find the row for this account type specifically
    const accountTypeRows = rows.filter(row => 
      row.length > columnPositions.accountType + accountType.length &&
      row.substring(columnPositions.accountType, columnPositions.accountType + accountType.length).toLowerCase() === accountType.toLowerCase() &&
      !isHeaderRow(row)
    );
    
    if (accountTypeRows.length > 0) {
      // Get the row for this account type
      const accountTypeRow = accountTypeRows[0];
      console.log(`Processing row for ${accountType}:`, accountTypeRow);
      
      // Find the summary for this account type
      const summary = accountSummaries.find(s => s.accountType === accountType);
      if (summary) {
        // Extract values for this account type
        extractValuesForAccountType(accountTypeRow, summary, columnPositions);
      }
    } else {
      console.log(`No row found for account type: ${accountType}`);
    }
  }
}

/**
 * Check if a row is a header row
 */
function isHeaderRow(row: string): boolean {
  const headerKeywords = ['account type', 'open', 'with balance', 'total balance', 'available', 'credit limit'];
  const lowercaseRow = row.toLowerCase();
  
  // Count how many header keywords are in this row
  let keywordCount = 0;
  for (const keyword of headerKeywords) {
    if (lowercaseRow.includes(keyword)) {
      keywordCount++;
    }
  }
  
  // If it has most header keywords, it's likely a header
  return keywordCount >= 3;
}

/**
 * Extract values for a specific account type from its row
 */
function extractValuesForAccountType(row: string, summary: AccountSummary, columnPositions: Record<string, number>): void {
  // Extract open accounts
  if (columnPositions.open >= 0) {
    summary.open = extractNumericValue(row, columnPositions.open, columnPositions.withBalance);
  }
  
  // Extract with balance accounts
  if (columnPositions.withBalance >= 0) {
    summary.withBalance = extractNumericValue(row, columnPositions.withBalance, columnPositions.totalBalance);
  }
  
  // Extract total balance
  if (columnPositions.totalBalance >= 0) {
    summary.totalBalance = extractCurrencyValue(row, columnPositions.totalBalance, columnPositions.available);
  }
  
  // Extract available credit
  if (columnPositions.available >= 0) {
    summary.available = extractCurrencyValue(row, columnPositions.available, columnPositions.creditLimit);
  }
  
  // Extract credit limit
  if (columnPositions.creditLimit >= 0) {
    summary.creditLimit = extractCurrencyValue(row, columnPositions.creditLimit, columnPositions.debtToCredit);
  }
  
  // Extract debt-to-credit
  if (columnPositions.debtToCredit >= 0) {
    summary.debtToCredit = extractPercentageValue(row, columnPositions.debtToCredit, columnPositions.payment);
  }
  
  // Extract payment
  if (columnPositions.payment >= 0) {
    summary.payment = extractCurrencyValue(row, columnPositions.payment, row.length);
  }
  
  console.log(`Extracted data for ${summary.accountType}:`, {
    open: summary.open,
    withBalance: summary.withBalance,
    totalBalance: summary.totalBalance,
    available: summary.available,
    creditLimit: summary.creditLimit,
    debtToCredit: summary.debtToCredit,
    payment: summary.payment
  });
}

/**
 * Extract a numeric value from a specific column
 */
function extractNumericValue(row: string, startPos: number, endPos: number): number | null {
  if (startPos < 0 || startPos >= row.length) return null;
  
  // Get the text in this column
  const columnText = row.substring(startPos, endPos < 0 ? row.length : endPos).trim();
  
  // Look for a number pattern
  const numMatch = columnText.match(/^\d+$/);
  if (numMatch && numMatch[0]) {
    return parseInt(numMatch[0], 10);
  }
  
  return null;
}

/**
 * Extract a currency value from a specific column
 */
function extractCurrencyValue(row: string, startPos: number, endPos: number): string | null {
  if (startPos < 0 || startPos >= row.length) return null;
  
  // Get the text in this column
  const columnText = row.substring(startPos, endPos < 0 ? row.length : endPos).trim();
  
  // Look for a currency pattern
  const currencyMatch = columnText.match(/(-?\$[0-9,.]+|\$-[0-9,.]+)/);
  if (currencyMatch && currencyMatch[0]) {
    return currencyMatch[0];
  }
  
  return null;
}

/**
 * Extract a percentage value from a specific column
 */
function extractPercentageValue(row: string, startPos: number, endPos: number): string | null {
  if (startPos < 0 || startPos >= row.length) return null;
  
  // Get the text in this column
  const columnText = row.substring(startPos, endPos < 0 ? row.length : endPos).trim();
  
  // Look for a percentage pattern
  const percentMatch = columnText.match(/(\d+\.?\d*)\s*%/);
  if (percentMatch && percentMatch[0]) {
    return percentMatch[0];
  }
  
  return null;
}
