
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
    
    // Split the table section into lines for per-type processing
    const lines = tableSection.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    // Log the extracted table section for debugging
    console.log("Extracted table section:");
    lines.forEach((line, i) => console.log(`Line ${i}: ${line}`));
    
    // Process each account type separately
    // This approach isolates each account type's data to prevent mixing
    const accountTypes = ['Revolving', 'Mortgage', 'Installment', 'Other', 'Total'];
    
    for (const accountType of accountTypes) {
      // Find lines containing this specific account type
      const relevantLines = lines.filter(line => line.includes(accountType));
      
      if (relevantLines.length > 0) {
        const targetLine = relevantLines[0];
        console.log(`Processing line for ${accountType}: ${targetLine}`);
        
        // Get the corresponding account summary object
        const accountIndex = accountSummaries.findIndex(a => a.accountType === accountType);
        if (accountIndex !== -1) {
          // Extract values specifically for this account type only
          extractValuesForAccountType(targetLine, accountType, accountSummaries[accountIndex]);
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

function extractValuesForAccountType(line: string, accountType: string, summary: AccountSummary): void {
  // Find the position of the account type in the line
  const accountTypePosition = line.indexOf(accountType);
  if (accountTypePosition === -1) return;
  
  // Extract only the part of the line that follows the account type
  const dataSection = line.substring(accountTypePosition + accountType.length).trim();
  console.log(`Extracting from data section: "${dataSection}" for ${accountType}`);
  
  // Convert to tokens for more precise value extraction
  const tokens = dataSection.split(/\s+/);
  
  // Track numeric values and monetary values separately to prevent mixing
  // This prevents values from one column contaminating another
  let numericValues = [];
  let monetaryValues = [];
  let debtToCreditValue = null;
  
  // First pass: categorize tokens into different types of values
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i].trim();
    
    // Skip empty tokens
    if (!token) continue;
    
    // Check for percentage (debt-to-credit)
    if (token.includes('%')) {
      debtToCreditValue = token;
      continue;
    }
    
    // Check for monetary values (with $ sign)
    if (token.includes('$') || (token.startsWith('-') && tokens[i+1] && tokens[i+1].includes('$'))) {
      // Handle case where negative sign might be separated
      if (token === '-' && i+1 < tokens.length && tokens[i+1].includes('$')) {
        monetaryValues.push('-' + tokens[i+1]);
        i++; // Skip the next token as we've processed it
      } else {
        monetaryValues.push(token);
      }
      continue;
    }
    
    // Check for numeric values (account counts)
    if (/^\d+$/.test(token)) {
      numericValues.push(parseInt(token));
    }
  }
  
  console.log(`Found for ${accountType}: numeric=${numericValues.join(',')} monetary=${monetaryValues.join(',')} debt=${debtToCreditValue}`);
  
  // Second pass: assign values to the appropriate fields
  // This ensures values are assigned to the correct fields in the right order
  
  // Assign numeric values (typically open and withBalance)
  if (numericValues.length > 0) summary.open = numericValues[0];
  if (numericValues.length > 1) summary.withBalance = numericValues[1];
  
  // Assign monetary values (in expected order)
  if (monetaryValues.length > 0) summary.totalBalance = monetaryValues[0];
  if (monetaryValues.length > 1) summary.available = monetaryValues[1];
  if (monetaryValues.length > 2) summary.creditLimit = monetaryValues[2];
  if (monetaryValues.length > 3) summary.payment = monetaryValues[3];
  
  // Assign debt-to-credit value
  if (debtToCreditValue) {
    summary.debtToCredit = debtToCreditValue;
  }
}
