
import { AccountSummary } from "../../types/creditReport";

export const extractEquifaxAccountSummaries = async (text: string): Promise<AccountSummary[]> => {
  console.log("Starting account summary extraction with true cell-by-cell approach");
  
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
    const tableSection = extractTableSection(text);
    if (!tableSection) {
      console.log("Could not find account summary table section");
      return accountSummaries;
    }
    
    // Process each cell independently
    processTableCellByCellTrue(tableSection, accountSummaries);
    
    // Log the results for debugging
    console.log("Extracted account summaries:", accountSummaries);
    
    return accountSummaries;
  } catch (error) {
    console.error("Error extracting account summaries:", error);
    return accountSummaries; // Return empty structure on error
  }
};

function extractTableSection(text: string): string | null {
  // Look for the account summary table section
  const tableSectionMatch = text.match(/(Account\s+Type[\s\S]+?)(?:Other Items|Summary of|Consumer Statement|Public Records|End of Report)/i);
  if (tableSectionMatch) {
    return tableSectionMatch[1];
  }
  return null;
}

function processTableCellByCellTrue(tableSection: string, accountSummaries: AccountSummary[]): void {
  // Process each account type separately for true cell-by-cell extraction
  const accountTypes = ['Revolving', 'Mortgage', 'Installment', 'Other', 'Total'];
  
  console.log("Processing account summaries individually for each account type");
  
  // Split into lines for processing
  const lines = tableSection.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  
  // For each account type, find specific information about it
  for (let i = 0; i < accountTypes.length; i++) {
    const accountType = accountTypes[i];
    
    // Find lines containing this account type
    const relevantLines = lines.filter(line => 
      new RegExp(`(?:^|\\s)${accountType}(?:\\s|$)`, 'i').test(line)
    );
    
    if (relevantLines.length > 0) {
      const accountLine = relevantLines[0]; // Use the first matching line
      console.log(`Processing line for ${accountType}: ${accountLine}`);
      
      // Extract each cell value independently for this account type
      extractCellValue(accountLine, accountType, accountSummaries[i], 'open');
      extractCellValue(accountLine, accountType, accountSummaries[i], 'withBalance');
      extractCellValue(accountLine, accountType, accountSummaries[i], 'totalBalance');
      extractCellValue(accountLine, accountType, accountSummaries[i], 'available');
      extractCellValue(accountLine, accountType, accountSummaries[i], 'creditLimit');
      extractCellValue(accountLine, accountType, accountSummaries[i], 'debtToCredit');
      extractCellValue(accountLine, accountType, accountSummaries[i], 'payment');
    }
  }
}

function extractCellValue(line: string, accountType: string, summary: AccountSummary, field: keyof AccountSummary): void {
  // Get position of account type in the line
  const accountTypePos = line.toLowerCase().indexOf(accountType.toLowerCase());
  if (accountTypePos < 0) return;
  
  // Get remainder of line after account type
  const remainingText = line.substring(accountTypePos + accountType.length).trim();
  
  // Extract specific cell value based on field
  switch (field) {
    case 'open': {
      // First number after account type is usually the 'open' count
      const match = remainingText.match(/^(\d+)/);
      if (match && match[1]) {
        const value = parseInt(match[1]);
        if (!isNaN(value) && summary[field] === null) {
          summary[field] = value;
          console.log(`Found ${accountType} ${field}: ${value}`);
        }
      }
      break;
    }
    
    case 'withBalance': {
      // Second number is usually the 'with balance' count
      const match = remainingText.match(/^\s*\d+\s+(\d+)/);
      if (match && match[1]) {
        const value = parseInt(match[1]);
        if (!isNaN(value) && summary[field] === null) {
          summary[field] = value;
          console.log(`Found ${accountType} ${field}: ${value}`);
        }
      }
      break;
    }
    
    case 'totalBalance': {
      // First dollar amount is usually the 'total balance'
      const match = remainingText.match(/\s(\$[\d,]+|-\$[\d,]+|\$-[\d,]+)/);
      if (match && match[1]) {
        if (summary[field] === null) {
          summary[field] = normalizeDollarFormat(match[1]);
          console.log(`Found ${accountType} ${field}: ${summary[field]}`);
        }
      }
      break;
    }
    
    case 'available': {
      // Second dollar amount is usually 'available'
      const dollars = extractAllDollarAmounts(remainingText);
      if (dollars.length >= 2 && summary[field] === null) {
        summary[field] = dollars[1];
        console.log(`Found ${accountType} ${field}: ${summary[field]}`);
      }
      break;
    }
    
    case 'creditLimit': {
      // Third dollar amount is usually 'credit limit'
      const dollars = extractAllDollarAmounts(remainingText);
      if (dollars.length >= 3 && summary[field] === null) {
        summary[field] = dollars[2];
        console.log(`Found ${accountType} ${field}: ${summary[field]}`);
      }
      break;
    }
    
    case 'debtToCredit': {
      // Look for a percentage value
      const match = remainingText.match(/(\d+(?:\.\d+)?\s*%)/);
      if (match && match[1] && summary[field] === null) {
        summary[field] = match[1].trim();
        console.log(`Found ${accountType} ${field}: ${summary[field]}`);
      }
      break;
    }
    
    case 'payment': {
      // Last dollar amount is usually 'payment'
      const dollars = extractAllDollarAmounts(remainingText);
      if (dollars.length > 0 && summary[field] === null) {
        summary[field] = dollars[dollars.length - 1];
        console.log(`Found ${accountType} ${field}: ${summary[field]}`);
      }
      break;
    }
  }
}

function extractAllDollarAmounts(text: string): string[] {
  const dollarPattern = /(\$[\d,]+|-\$[\d,]+|\$-[\d,]+)/g;
  const dollars: string[] = [];
  let match;
  
  while ((match = dollarPattern.exec(text)) !== null) {
    dollars.push(normalizeDollarFormat(match[1]));
  }
  
  return dollars;
}

function normalizeDollarFormat(value: string): string {
  // Normalize $-X,XXX format to -$X,XXX for consistency
  if (value.startsWith('$-')) {
    return `-$${value.substring(2)}`;
  }
  return value;
}
