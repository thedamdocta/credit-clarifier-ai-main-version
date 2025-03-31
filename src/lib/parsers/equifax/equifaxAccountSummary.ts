
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
    
    // Get individual rows by finding lines that contain the account types
    // This ensures we're working with complete rows for each account type
    const accountTypes = ['Revolving', 'Mortgage', 'Installment', 'Other', 'Total'];
    const rows: {[key: string]: string} = {};
    
    // Find complete lines containing each account type
    for (const accountType of accountTypes) {
      const regex = new RegExp(`.*\\b${accountType}\\b.*`, 'i');
      const matches = tableSection.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .filter(line => regex.test(line));
      
      if (matches.length > 0) {
        rows[accountType] = matches[0];
        console.log(`Found row for ${accountType}: ${matches[0]}`);
      }
    }
    
    // Process each account type row separately
    for (const accountType of accountTypes) {
      if (rows[accountType]) {
        const accountIndex = accountSummaries.findIndex(a => a.accountType === accountType);
        if (accountIndex !== -1) {
          // Extract values specifically for this account type
          extractValuesFromRow(rows[accountType], accountType, accountSummaries[accountIndex]);
        }
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

function extractValuesFromRow(row: string, accountType: string, summary: AccountSummary): void {
  // Find the position of the account type in the row
  const accountTypePos = row.indexOf(accountType);
  if (accountTypePos === -1) return;
  
  // Extract only the data part after the account type
  const dataSection = row.substring(accountTypePos + accountType.length);
  console.log(`Processing data for ${accountType}: "${dataSection}"`);
  
  // Split into tokens and classify them
  const tokens = dataSection.split(/\s+/).filter(token => token.trim().length > 0);
  const numericValues = [];
  const monetaryValues = [];
  let percentValue = null;
  
  // First pass: classify all tokens
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i].trim();
    
    // Skip empty tokens
    if (!token) continue;
    
    // Check for percentage values (debt-to-credit)
    if (token.includes('%')) {
      percentValue = token;
      continue;
    }
    
    // Check for monetary values (with $ sign)
    if (token.includes('$')) {
      // Handle potential separate negative sign
      if (i > 0 && tokens[i-1] === '-' && !token.startsWith('-')) {
        monetaryValues.push('-' + token);
      } else {
        monetaryValues.push(token);
      }
      continue;
    }
    
    // Check for standalone negative signs (might be part of next monetary value)
    if (token === '-' && i+1 < tokens.length && tokens[i+1].includes('$')) {
      // Skip - we'll handle this in the monetary values check
      continue;
    }
    
    // Check for plain numeric values (typically account counts)
    if (/^\d+$/.test(token)) {
      numericValues.push(parseInt(token));
    }
  }
  
  console.log(`Extracted for ${accountType}: numbers=${numericValues.join(',')}, money=${monetaryValues.join(',')}, percent=${percentValue}`);
  
  // Second pass: assign values to fields in the correct order
  
  // Assign numeric values (typically count fields)
  if (numericValues.length > 0) summary.open = numericValues[0];
  if (numericValues.length > 1) summary.withBalance = numericValues[1];
  
  // Assign monetary values in expected order
  if (monetaryValues.length > 0) summary.totalBalance = monetaryValues[0];
  if (monetaryValues.length > 1) summary.available = monetaryValues[1];
  if (monetaryValues.length > 2) summary.creditLimit = monetaryValues[2];
  if (monetaryValues.length > 3) summary.payment = monetaryValues[3];
  
  // Assign percentage value to debt-to-credit
  if (percentValue) {
    summary.debtToCredit = percentValue;
  }
}
