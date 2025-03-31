
import { AccountSummary } from "../../types/creditReport";

export const extractEquifaxAccountSummaries = async (text: string): Promise<AccountSummary[]> => {
  console.log("Starting account summary extraction with cell-by-cell approach");
  
  // Create a completely empty data grid for our 5x8 table
  // 5 rows (account types) and 8 columns (metrics)
  const accountSummaries: AccountSummary[] = [
    // Revolving row (all individual cells)
    {
      accountType: 'Revolving',
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
    },
    
    // Mortgage row (all individual cells)
    {
      accountType: 'Mortgage',
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
    },
    
    // Installment row (all individual cells)
    {
      accountType: 'Installment',
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
    },
    
    // Other row (completely empty)
    {
      accountType: 'Other',
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
    },
    
    // Total row (all individual cells)
    {
      accountType: 'Total',
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
    }
  ];
  
  try {
    console.log("Attempting to find cell values one by one in text");
    
    // Find table section that contains account summaries
    const tableSectionMatch = text.match(/(Account\s+Type[\s\S]+?)(?:Other Items|Summary of|Consumer Statement|Public Records|End of Report)/i);
    if (tableSectionMatch) {
      const tableSection = tableSectionMatch[1];
      console.log("Found account table section");
      
      // Process tables using a cell-by-cell approach
      processTableCellByCellApproach(tableSection, accountSummaries);
    } else {
      console.log("Could not find account summary table section");
    }
    
    return accountSummaries;
  } catch (error) {
    console.error("Error extracting account summaries:", error);
    return accountSummaries; // Return our structure even if processing fails
  }
};

// Process the table cell by cell without any dependencies between cells
function processTableCellByCellApproach(tableSection: string, accountSummaries: AccountSummary[]): void {
  const lines = tableSection.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  
  // Process each account type individually
  const accountTypes = ['Revolving', 'Mortgage', 'Installment', 'Other', 'Total'];
  
  for (let rowIndex = 0; rowIndex < accountTypes.length; rowIndex++) {
    const accountType = accountTypes[rowIndex];
    
    // Find any line containing this account type
    const accountLineIndices = lines.reduce((indices, line, index) => {
      if (new RegExp(`(?:^|\\s)${accountType}(?:\\s|$)`, 'i').test(line)) {
        indices.push(index);
      }
      return indices;
    }, [] as number[]);
    
    // Process each found line for this account type
    for (const lineIdx of accountLineIndices) {
      const line = lines[lineIdx];
      console.log(`Processing line for ${accountType}: ${line}`);
      
      // Call individual cell processors independently
      // Each processor only looks for its specific data point
      
      // Process 'open' cell (numeric)
      extractOpenCellValue(line, accountType, accountSummaries[rowIndex]);
      
      // Process 'withBalance' cell (numeric)
      extractWithBalanceCellValue(line, accountType, accountSummaries[rowIndex]);
      
      // Process 'totalBalance' cell (dollar amount)
      extractTotalBalanceCellValue(line, accountSummaries[rowIndex]);
      
      // Process 'available' cell (dollar amount)
      extractAvailableCellValue(line, accountSummaries[rowIndex]);
      
      // Process 'creditLimit' cell (dollar amount)
      extractCreditLimitCellValue(line, accountSummaries[rowIndex]);
      
      // Process 'debtToCredit' cell (percentage)
      extractDebtToCreditCellValue(line, accountSummaries[rowIndex]);
      
      // Process 'payment' cell (dollar amount - usually last $ value)
      extractPaymentCellValue(line, accountSummaries[rowIndex]);
    }
  }
}

// Individual cell processing functions - each operates independently

function extractOpenCellValue(line: string, accountType: string, summary: AccountSummary): void {
  // Look for a number after the account type
  const openMatch = line.match(new RegExp(`${accountType}\\s+(\\d+)`, 'i'));
  if (openMatch && openMatch[1]) {
    summary.open = parseInt(openMatch[1], 10);
    console.log(`✓ Cell updated: ${accountType} open = ${summary.open}`);
  }
}

function extractWithBalanceCellValue(line: string, accountType: string, summary: AccountSummary): void {
  // Look for second number after account type (specific pattern for "with balance" column)
  const withBalanceMatch = line.match(new RegExp(`${accountType}\\s+\\d+\\s+(\\d+)`, 'i'));
  if (withBalanceMatch && withBalanceMatch[1]) {
    summary.withBalance = parseInt(withBalanceMatch[1], 10);
    console.log(`✓ Cell updated: ${accountType} withBalance = ${summary.withBalance}`);
  }
}

function extractTotalBalanceCellValue(line: string, summary: AccountSummary): void {
  // Look for the first dollar amount
  const totalBalanceMatch = line.match(/(\$[0-9,.]+|-\$[0-9,.]+)/);
  if (totalBalanceMatch) {
    summary.totalBalance = totalBalanceMatch[0];
    console.log(`✓ Cell updated: ${summary.accountType} totalBalance = ${summary.totalBalance}`);
  }
}

function extractAvailableCellValue(line: string, summary: AccountSummary): void {
  // Look for the second dollar amount
  const allDollarMatches = Array.from(line.matchAll(/(\$[0-9,.]+|-\$[0-9,.]+)/g));
  if (allDollarMatches.length >= 2) {
    summary.available = allDollarMatches[1][0];
    console.log(`✓ Cell updated: ${summary.accountType} available = ${summary.available}`);
  }
}

function extractCreditLimitCellValue(line: string, summary: AccountSummary): void {
  // Look for the third dollar amount
  const allDollarMatches = Array.from(line.matchAll(/(\$[0-9,.]+|-\$[0-9,.]+)/g));
  if (allDollarMatches.length >= 3) {
    summary.creditLimit = allDollarMatches[2][0];
    console.log(`✓ Cell updated: ${summary.accountType} creditLimit = ${summary.creditLimit}`);
  }
}

function extractDebtToCreditCellValue(line: string, summary: AccountSummary): void {
  // Look for percentage values
  const percentMatch = line.match(/(\d+\.?\d*)\s*%/);
  if (percentMatch) {
    summary.debtToCredit = `${percentMatch[0].trim()}`;
    console.log(`✓ Cell updated: ${summary.accountType} debtToCredit = ${summary.debtToCredit}`);
  }
}

function extractPaymentCellValue(line: string, summary: AccountSummary): void {
  // Look for the last dollar amount in the line
  const allDollarMatches = Array.from(line.matchAll(/(\$[0-9,.]+|-\$[0-9,.]+)/g));
  if (allDollarMatches.length > 0) {
    summary.payment = allDollarMatches[allDollarMatches.length - 1][0];
    console.log(`✓ Cell updated: ${summary.accountType} payment = ${summary.payment}`);
  }
}
