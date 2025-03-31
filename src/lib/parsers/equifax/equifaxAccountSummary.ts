
import { AccountSummary } from "../../types/creditReport";

export const extractEquifaxAccountSummaries = async (text: string): Promise<AccountSummary[]> => {
  console.log("Starting account summary extraction with improved row-by-row approach");
  
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
    
    // Process the table content line by line
    const lines = tableSection.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    // Log the extracted table section for debugging
    console.log("Extracted table section:");
    lines.forEach((line, i) => console.log(`Line ${i}: ${line}`));
    
    // Extract lines that contain account types and clean them
    const accountTypeLines = [];
    for (const line of lines) {
      for (const accountType of ['Revolving', 'Mortgage', 'Installment', 'Other', 'Total']) {
        if (line.includes(accountType)) {
          accountTypeLines.push({ accountType, line });
          break;
        }
      }
    }
    
    // Process each account type separately with its own line
    for (const { accountType, line } of accountTypeLines) {
      console.log(`Processing line for ${accountType}: ${line}`);
      const accountIndex = accountSummaries.findIndex(a => a.accountType === accountType);
      if (accountIndex !== -1) {
        extractValuesForAccountType(line, accountSummaries[accountIndex]);
      }
    }
    
    console.log("Final extracted account summaries:", accountSummaries);
    return accountSummaries;
  } catch (error) {
    console.error("Error extracting account summaries:", error);
    return accountSummaries; // Return empty structure on error
  }
};

function extractTableSection(text: string): string | null {
  // Look for sections that contain account summary tables
  const possibleMarkers = [
    /Account\s+Type\s+Open\s+With\s+Balance\s+Total\s+Balance\s+Available\s+Credit\s+Limit/i,
    /Your\s+credit\s+report\s+includes\s+information\s+about\s+activity\s+on\s+your\s+credit\s+accounts/i,
    /Account\s+Type[\s\S]+?(?:Revolving|Mortgage|Installment|Other|Total)/i
  ];
  
  let tableSection = null;
  
  for (const marker of possibleMarkers) {
    // Find a section that starts with our marker and continues until another major section
    const sectionMatch = text.match(new RegExp(`(${marker.source}[\\s\\S]+?)(?:Other Items|Summary of|Consumer Statement|Public Records|End of Report)`, 'i'));
    if (sectionMatch && sectionMatch[1]) {
      tableSection = sectionMatch[1];
      console.log(`Found table section using marker: ${marker.source}`);
      break;
    }
  }
  
  // If we still don't have a match, try a more generic approach
  if (!tableSection) {
    const genericMatch = text.match(/((?:Revolving|Mortgage|Installment|Other|Total)[\s\S]+?(?:Other Items|Summary of|Consumer Statement|Public Records|End of Report))/i);
    if (genericMatch && genericMatch[1]) {
      tableSection = genericMatch[1];
      console.log("Found table section using generic approach");
    }
  }
  
  return tableSection;
}

function extractValuesForAccountType(line: string, summary: AccountSummary): void {
  // Focus only on the part of the line after the account type
  const typePart = line.match(new RegExp(`\\b(${summary.accountType})\\b`, 'i'));
  if (!typePart || !typePart.index) return;
  
  const lineAfterType = line.substring(typePart.index + summary.accountType.length);
  console.log(`Extracting from: "${lineAfterType}" for ${summary.accountType}`);
  
  // Extract numeric values (first looking for plain integers - typically open/with balance counts)
  const numericMatches = lineAfterType.match(/\b(\d+)\b/g);
  if (numericMatches && numericMatches.length >= 1) {
    summary.open = parseInt(numericMatches[0]);
    if (numericMatches.length >= 2) {
      summary.withBalance = parseInt(numericMatches[1]);
    }
  }
  
  // Extract dollar amounts
  const dollarMatches = lineAfterType.match(/\$[\d,]+|-\$[\d,]+/g);
  if (dollarMatches) {
    if (dollarMatches.length >= 1) summary.totalBalance = dollarMatches[0];
    if (dollarMatches.length >= 2) summary.available = dollarMatches[1];
    if (dollarMatches.length >= 3) summary.creditLimit = dollarMatches[2];
    if (dollarMatches.length >= 4) summary.payment = dollarMatches[3];
  }
  
  // Extract percentage for debt-to-credit
  const percentMatch = lineAfterType.match(/(\d+\.?\d*)%/);
  if (percentMatch) {
    summary.debtToCredit = percentMatch[0];
  }
}
