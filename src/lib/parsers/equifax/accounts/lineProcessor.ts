
import { AccountSummary } from "../../../types/creditReport";
import { ColumnPositions } from "./types";
import {
  extractCellContent, 
  extractDollarValue, 
  extractNumericValue, 
  extractPercentageValue
} from "@/utils/formatters/accountValueFormatters";

/**
 * Process a specific account type by searching for its line in the data
 */
export function processAccountType(
  accountType: string,
  lines: string[],
  accountSummaries: AccountSummary[],
  columns: Record<string, number>
): void {
  console.log(`Processing ${accountType} account line`);
  
  // Find the line that specifically contains this account type as a word
  const accountLine = lines.find(line => {
    // Skip the header line
    if (line.toLowerCase().includes('account type') && line.toLowerCase().includes('with balance')) {
      return false;
    }
    
    // Match only if line has this account type with clear word boundary
    return new RegExp(`(?:^|\\s)${accountType}(?:\\s|$|\\t)`, 'i').test(line);
  });
  
  if (!accountLine) {
    console.log(`No line found for ${accountType}, keeping empty values (nulls)`);
    return;
  }
  
  console.log(`Found line for ${accountType}:`, accountLine);
  
  // Find this account type in our summary array
  const accountSummary = accountSummaries.find(summary => summary.accountType === accountType);
  if (!accountSummary) return;
  
  // Special debug for rows
  console.log(`Processing ${accountType} row`);
  
  // Process the account line using cell by cell processing with empty cell detection
  processAccountLineWithColumnAwareness(accountLine, accountSummary, columns);
  
  // After processing log
  console.log(`${accountType} row after processing:`, accountSummary);
}

/**
 * Process an account line using column-by-column cell extraction with 
 * enhanced empty space detection
 */
export function processAccountLineWithColumnAwareness(
  line: string, 
  accountSummary: AccountSummary, 
  columns: Record<string, number>
): void {
  // Check all column positions in order to ensure proper extraction
  const columnKeys = [
    'accountType', 'open', 'withBalance', 'totalBalance', 
    'available', 'creditLimit', 'debtToCredit', 'payment'
  ];
  
  // Get column positions in the order they appear in the text
  const sortedColumnKeys = columnKeys.sort((a, b) => {
    const posA = columns[a] || 999;
    const posB = columns[b] || 999;
    return posA - posB;
  });
  
  // Process each column in order, checking for empty cells
  for (let i = 0; i < sortedColumnKeys.length; i++) {
    const key = sortedColumnKeys[i];
    const nextKey = i < sortedColumnKeys.length - 1 ? sortedColumnKeys[i + 1] : null;
    
    // Skip accountType as it's already set
    if (key === 'accountType') continue;
    
    // Get the position range for this column
    const startPos = columns[key];
    const endPos = nextKey ? columns[nextKey] : undefined;
    
    // Extract content for this cell position
    const cellContent = extractCellContent(line, startPos, endPos);
    
    // If cell is empty or can't be extracted, make sure the value is null
    if (!cellContent || cellContent.trim() === '') {
      accountSummary[key] = null;
      console.log(`${accountSummary.accountType} - ${key}: Empty cell detected, setting to null`);
      continue;
    }
    
    // Log extracted content
    console.log(`${accountSummary.accountType} - ${key}: Extracted content: "${cellContent}"`);
    
    // Process based on column type
    if (key === 'open' || key === 'withBalance') {
      const numericValue = extractNumericValue(cellContent);
      accountSummary[key] = numericValue;
      console.log(`${accountSummary.accountType} - ${key}: Numeric value: ${numericValue}`);
    } else if (key === 'totalBalance' || key === 'available' || key === 'creditLimit' || key === 'payment') {
      const dollarValue = extractDollarValue(cellContent);
      accountSummary[key] = dollarValue;
      console.log(`${accountSummary.accountType} - ${key}: Dollar value: ${dollarValue}`);
    } else if (key === 'debtToCredit') {
      const percentValue = extractPercentageValue(cellContent);
      accountSummary[key] = percentValue;
      console.log(`${accountSummary.accountType} - ${key}: Percentage value: ${percentValue}`);
    }
  }
  
  console.log(`Processed values for ${accountSummary.accountType}:`, {
    open: accountSummary.open,
    withBalance: accountSummary.withBalance,
    totalBalance: accountSummary.totalBalance,
    available: accountSummary.available,
    creditLimit: accountSummary.creditLimit,
    debtToCredit: accountSummary.debtToCredit,
    payment: accountSummary.payment
  });
}
