
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
    console.log(`No line found for ${accountType}, ensuring all values are null`);
    // Make sure all account values are explicitly null
    const accountSummary = accountSummaries.find(summary => summary.accountType === accountType);
    if (accountSummary) {
      // Set all fields to null explicitly
      accountSummary.open = null;
      accountSummary.withBalance = null;
      accountSummary.totalBalance = null;
      accountSummary.available = null;
      accountSummary.creditLimit = null;
      accountSummary.debtToCredit = null;
      accountSummary.payment = null;
    }
    return;
  }
  
  console.log(`Found line for ${accountType}:`, accountLine);
  
  // Find this account type in our summary array
  const accountSummary = accountSummaries.find(summary => summary.accountType === accountType);
  if (!accountSummary) return;
  
  // Special debug for rows
  console.log(`Processing ${accountType} row`);
  
  // IMPROVED: First set ALL fields to null by default
  accountSummary.open = null;
  accountSummary.withBalance = null;
  accountSummary.totalBalance = null;
  accountSummary.available = null;
  accountSummary.creditLimit = null;
  accountSummary.debtToCredit = null;
  accountSummary.payment = null;
  
  // Process the account line using cell by cell processing
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
  
  // IMPROVED: All fields start as null (set in the processAccountType function)
  // We will only set values for fields that have actual data
  
  // Process the data for columns that have values
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
    
    // Only process if cell has meaningful content
    if (!cellContent || cellContent.trim() === '') {
      console.log(`${accountSummary.accountType} - ${key}: Empty cell detected, keeping as null`);
      continue;
    }
    
    // Log extracted content
    console.log(`${accountSummary.accountType} - ${key}: Extracted content: "${cellContent}"`);
    
    // Process based on column type
    if (key === 'open' || key === 'withBalance') {
      const numericValue = extractNumericValue(cellContent);
      if (numericValue !== null) {
        accountSummary[key] = numericValue;
        console.log(`${accountSummary.accountType} - ${key}: Numeric value: ${numericValue}`);
      }
    } else if (key === 'totalBalance' || key === 'available' || key === 'creditLimit' || key === 'payment') {
      const dollarValue = extractDollarValue(cellContent);
      if (dollarValue !== null) {
        accountSummary[key] = dollarValue;
        console.log(`${accountSummary.accountType} - ${key}: Dollar value: ${dollarValue}`);
      }
    } else if (key === 'debtToCredit') {
      const percentValue = extractPercentageValue(cellContent);
      if (percentValue !== null) {
        accountSummary[key] = percentValue;
        console.log(`${accountSummary.accountType} - ${key}: Percentage value: ${percentValue}`);
      }
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
