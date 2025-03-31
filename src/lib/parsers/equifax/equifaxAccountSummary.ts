
import { AccountSummary } from "../../types/creditReport";
import { extractEntities } from "../../ai/textAnalysis";

export const extractEquifaxAccountSummaries = async (text: string): Promise<AccountSummary[]> => {
  // Create empty account summaries for all required types
  const accountTypes = ['Revolving', 'Mortgage', 'Installment', 'Other', 'Total'];
  const summariesByType = new Map<string, AccountSummary>();
  
  // Initialize with default empty summaries
  accountTypes.forEach(type => {
    summariesByType.set(type, createDefaultSummary(type));
  });
  
  try {
    console.log("Attempting AI-enhanced account summary extraction");
    
    // First attempt AI-enhanced extraction for better pattern recognition
    const entities = await extractEntities(text);
    
    // Look for table section that contains account summaries
    const tableSectionMatch = text.match(/(Account\s+Type[\s\S]+?)(?:Other Items|Summary of|Consumer Statement|Public Records|End of Report)/i);
    if (!tableSectionMatch) {
      console.log("Could not find account summary table section");
      return Array.from(summariesByType.values());
    }
    
    const tableSection = tableSectionMatch[1];
    console.log("Found account table section");
    
    // Split into lines for processing
    const lines = tableSection.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    // Find lines for each account type
    for (const accountType of accountTypes) {
      // Look for lines containing this specific account type
      const typeLines = lines.filter(line => 
        line.match(new RegExp(`\\b${accountType}\\b`, 'i'))
      );
      
      if (typeLines.length > 0) {
        const typeLine = typeLines[0];
        console.log(`Found line for account type ${accountType}: ${typeLine}`);
        
        // Extract data specific to this account type
        const summary = extractDataFromLine(typeLine, accountType, entities);
        summariesByType.set(accountType, summary);
      }
    }
    
    // Return summaries in the correct order
    return accountTypes.map(type => summariesByType.get(type)!);
  } catch (error) {
    console.error("Error in AI-enhanced extraction:", error);
    // Return default summaries on error
    return Array.from(summariesByType.values());
  }
};

// Extract data from a line for a specific account type
function extractDataFromLine(line: string, accountType: string, entities: any[]): AccountSummary {
  const summary = createDefaultSummary(accountType);
  
  // Find position of account type in the line
  const accountTypePos = line.toLowerCase().indexOf(accountType.toLowerCase());
  if (accountTypePos < 0) return summary;
  
  // Get text after account type
  const afterAccountType = line.substring(accountTypePos + accountType.length).trim();
  console.log(`Processing data after "${accountType}": ${afterAccountType}`);
  
  // Extract numeric values (Open, With Balance)
  const numericValues = extractNumericValues(afterAccountType);
  if (numericValues.length >= 1) {
    summary.open = numericValues[0];
  }
  if (numericValues.length >= 2) {
    summary.withBalance = numericValues[1];
  }
  
  // Extract dollar amounts
  const dollarValues = extractDollarValues(afterAccountType);
  
  // Fixed: Use explicit type checking for each field to avoid type errors
  if (dollarValues.length >= 1) {
    summary.totalBalance = dollarValues[0];
  }
  if (dollarValues.length >= 2) {
    summary.available = dollarValues[1];
  }
  if (dollarValues.length >= 3) {
    summary.creditLimit = dollarValues[2];
  }
  if (dollarValues.length >= 4) {
    summary.payment = dollarValues[3];
  }
  
  // Extract debt-to-credit percentage
  const debtToCredit = extractPercentage(afterAccountType);
  if (debtToCredit) {
    summary.debtToCredit = debtToCredit;
  }
  
  return summary;
}

// Extract numeric values from text (for Open and With Balance)
function extractNumericValues(text: string): number[] {
  const values: number[] = [];
  const matches = text.match(/\b\d+\b/g) || [];
  
  // Only get the first few numbers, which are generally Open and With Balance
  matches.slice(0, 3).forEach(match => {
    values.push(parseInt(match, 10));
  });
  
  return values;
}

// Extract dollar values from text
function extractDollarValues(text: string): string[] {
  const values: string[] = [];
  // This regex matches patterns like $1,234 or -$1,234 or $-1,234
  const regex = /(-?\$[\d,.]+|\$-[\d,.]+)/g;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    let value = match[0];
    // Normalize $-1,234 format to -$1,234
    if (value.startsWith('$-')) {
      value = '-$' + value.substring(2);
    }
    values.push(value);
  }
  
  return values;
}

// Extract percentage values from text
function extractPercentage(text: string): string | null {
  const match = text.match(/(\d+\.?\d*)%/);
  return match ? match[0] : null;
}

// Helper function to create a default summary object with null values
function createDefaultSummary(accountType: string): AccountSummary {
  return {
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
}
