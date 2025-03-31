
import { AccountSummary } from "../../types/creditReport";
import { extractEntities } from "../../ai/textAnalysis";

export const extractEquifaxAccountSummaries = async (text: string): Promise<AccountSummary[]> => {
  const summaries: AccountSummary[] = [];
  
  // Common account types in Equifax reports
  const accountTypes = ['Revolving', 'Mortgage', 'Installment', 'Other', 'Total'];

  try {
    // First attempt AI-enhanced extraction for better pattern recognition
    console.log("Attempting AI-enhanced account summary extraction");
    const entities = await extractEntities(text);
    
    // Look for the table header first - Equifax has a specific format
    const tableHeaderRegex = /Account\s+Type\s+(Total\s+Accounts)?\s*(Open)?\s*(Closed)?\s*(Balance)?/i;
    const expandedTablePattern = /Account\s+Type\s+Open\s+With\s+Balance\s+Total\s+Balance\s+Available\s+Credit\s+Limit\s+Debt-to-Credit\s+Payment/i;
    
    const tableHeaderMatch = text.match(tableHeaderRegex);
    const hasExpandedTable = expandedTablePattern.test(text);
    
    if (tableHeaderMatch || hasExpandedTable) {
      console.log("Found Equifax account summary table header");
      
      // Extract the table section from the text to limit our search
      const tableSectionMatch = text.match(/(Account\s+Type[\s\S]+?)(?:Other Items|Summary of|Consumer Statement|Public Records|End of Report)/i);
      const tableSection = tableSectionMatch ? tableSectionMatch[1] : text;
      
      // Split the table into rows for better processing
      const rows = tableSection.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      // Find the rows that have account type names in them
      const accountRows = new Map();
      
      // First identify which rows contain which account types
      for (const row of rows) {
        for (const accountType of accountTypes) {
          if (new RegExp(`\\b${accountType}\\b`, 'i').test(row)) {
            accountRows.set(accountType, row);
            console.log(`Found row for account type ${accountType}: ${row}`);
            break;
          }
        }
      }
      
      // Now process each account type with its specific row
      for (const accountType of accountTypes) {
        const summary = createDefaultSummary(accountType);
        const row = accountRows.get(accountType);
        
        if (row) {
          console.log(`Processing row for ${accountType}: ${row}`);
          await processAccountRow(row, accountType, summary, entities);
        } else {
          console.log(`No specific row found for account type: ${accountType}`);
        }
        
        summaries.push(summary);
      }
    } else {
      console.log("Could not find Equifax account summary table header");
      // Create default summaries for all account types
      accountTypes.forEach(accountType => {
        summaries.push(createDefaultSummary(accountType));
      });
    }
  } catch (error) {
    console.error("Error in AI-enhanced extraction:", error);
    console.log("Falling back to traditional extraction method");
    
    // Create default summaries for all account types as fallback
    accountTypes.forEach(accountType => {
      summaries.push(createDefaultSummary(accountType));
    });
  }
  
  // Sort the summaries to match the expected order
  summaries.sort((a, b) => {
    return accountTypes.indexOf(a.accountType) - accountTypes.indexOf(b.accountType);
  });
  
  console.log("Extracted account summaries:", summaries);
  return summaries;
};

// Process a single row for a specific account type
async function processAccountRow(row: string, accountType: string, summary: AccountSummary, entities: any[]) {
  console.log(`Processing account row for ${accountType}`);
  
  // Find the start position of the account type in the row
  const accountTypePos = row.indexOf(accountType);
  if (accountTypePos < 0) return;
  
  // Extract the part after the account type name
  const afterAccountType = row.substring(accountTypePos + accountType.length).trim();
  
  // Split the remaining text into tokens for column-by-column analysis
  const tokens = afterAccountType.split(/\s+/);
  const numericTokens = tokens.filter(token => /^-?\d+(\.\d+)?%?$/.test(token) || /^\$[\d,.]+$/.test(token) || /^-\$[\d,.]+$/.test(token));
  
  // Extract Open accounts (first numeric value)
  if (numericTokens.length >= 1) {
    const openValue = numericTokens[0];
    if (/^\d+$/.test(openValue)) {
      summary.open = parseInt(openValue);
    }
  }
  
  // Extract With Balance (second numeric value)
  if (numericTokens.length >= 2) {
    const withBalanceValue = numericTokens[1];
    if (/^\d+$/.test(withBalanceValue)) {
      summary.withBalance = parseInt(withBalanceValue);
    }
  }
  
  // Extract dollar values using regex
  const dollarPattern = /(-?\$[\d,.]+|-\$[\d,.]+|\$-[\d,.]+)/g;
  const dollarMatches = [];
  let match;
  
  while ((match = dollarPattern.exec(row)) !== null) {
    dollarMatches.push(match[0]);
  }
  
  // Assign dollar values in expected order: totalBalance, available, creditLimit, payment
  if (dollarMatches.length >= 1) {
    summary.totalBalance = normalizeDollarFormat(dollarMatches[0]);
  }
  
  if (dollarMatches.length >= 2) {
    summary.available = normalizeDollarFormat(dollarMatches[1]);
  }
  
  if (dollarMatches.length >= 3) {
    summary.creditLimit = normalizeDollarFormat(dollarMatches[2]);
  }
  
  if (dollarMatches.length >= 4) {
    summary.payment = normalizeDollarFormat(dollarMatches[3]);
  }
  
  // Extract debt-to-credit percentage
  const percentPattern = /(\d+\.?\d*)\s*%/;
  const percentMatch = row.match(percentPattern);
  if (percentMatch) {
    summary.debtToCredit = `${percentMatch[0].trim()}`;
  }
  
  // Use AI entity extraction as a fallback for missing values
  if (!summary.totalBalance || !summary.available || !summary.creditLimit || !summary.payment) {
    await enhanceWithAI(row, summary, entities);
  }
}

// Enhance parsing with AI entity extraction
async function enhanceWithAI(row: string, summary: AccountSummary, entities: any[]) {
  try {
    const relevantEntities = entities.filter(entity => {
      // Find entities that look like numbers, dollar amounts or percentages
      const word = entity.word;
      return /^\d+$/.test(word) || 
        /^-?\$[\d,.]+$/.test(word) || 
        /^-\$[\d,.]+$/.test(word) ||
        /^\d+\.?\d*%$/.test(word);
    });
    
    // Try to map entities to the right fields based on format
    for (const entity of relevantEntities) {
      if (row.includes(entity.word)) {
        const value = entity.word;
        
        if (/^\d+$/.test(value) && summary.open === null) {
          summary.open = parseInt(value);
        } else if (/^\d+$/.test(value) && summary.open !== null && summary.withBalance === null) {
          summary.withBalance = parseInt(value);
        } else if ((/^-?\$[\d,.]+$/.test(value) || /^-\$[\d,.]+$/.test(value)) && !summary.totalBalance) {
          summary.totalBalance = normalizeDollarFormat(value);
        } else if ((/^-?\$[\d,.]+$/.test(value) || /^-\$[\d,.]+$/.test(value)) && summary.totalBalance && !summary.available) {
          summary.available = normalizeDollarFormat(value);
        } else if ((/^-?\$[\d,.]+$/.test(value) || /^-\$[\d,.]+$/.test(value)) && summary.totalBalance && summary.available && !summary.creditLimit) {
          summary.creditLimit = normalizeDollarFormat(value);
        } else if ((/^-?\$[\d,.]+$/.test(value) || /^-\$[\d,.]+$/.test(value)) && summary.totalBalance && summary.available && summary.creditLimit && !summary.payment) {
          summary.payment = normalizeDollarFormat(value);
        } else if (/\d+\.?\d*%$/.test(value) && !summary.debtToCredit) {
          summary.debtToCredit = value;
        }
      }
    }
  } catch (error) {
    console.error("Error in AI entity enhancement:", error);
  }
}

// Normalize dollar format to ensure negative values are consistently formatted
function normalizeDollarFormat(value: string): string {
  if (!value) return value;
  
  // Handle negative values in either format
  if (value.startsWith('$-')) {
    // Convert $-1,234 format to -$1,234
    return '-$' + value.substring(2);
  }
  if (value.startsWith('-$')) {
    // Already in the correct format
    return value;
  }
  return value;
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
