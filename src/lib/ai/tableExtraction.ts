
import { pipeline, env } from '@huggingface/transformers';
import { AccountSummary } from '../types/creditReport';

// Configure environment for transformers
env.allowLocalModels = true;
env.useBrowserCache = true;

// Interface to represent the extracted table data
interface ExtractedTable {
  headers: string[];
  rows: Record<string, string>[];
}

/**
 * Extract table data from an image using visual question answering
 */
export async function extractTableFromImage(imageUrl: string): Promise<ExtractedTable | null> {
  try {
    console.log('Starting table extraction from image:', imageUrl);
    
    // Initialize the VQA model - using correct pipeline type
    const vqa = await pipeline('document-question-answering', 'impira/layoutlm-document-qa', {
      revision: 'main'
    });
    
    // Extract table headers (headers are fixed for credit account tables)
    const headers = ['Account Type', 'Open', 'With Balance', 'Total Balance', 
                    'Available', 'Credit Limit', 'Debt-to-Credit', 'Payment'];
    
    // Extract rows using structured queries for each account type
    const accountTypes = ['Revolving', 'Mortgage', 'Installment', 'Other', 'Total'];
    const rows: Record<string, string>[] = [];
    
    // Process each row
    for (const accountType of accountTypes) {
      console.log(`Processing row for account type: ${accountType}`);
      // Create a row object
      const row: Record<string, string> = { 'Account Type': accountType };
      
      try {
        // Extract row values with specific questions
        // Fix: Properly format the arguments as an object with image and question properties
        const openResponse = await vqa({
          image: imageUrl,
          question: `What is the 'Open' value for ${accountType} accounts?`
        });
        
        const withBalanceResponse = await vqa({
          image: imageUrl,
          question: `What is the 'With Balance' value for ${accountType} accounts?`
        });
        
        const totalBalanceResponse = await vqa({
          image: imageUrl,
          question: `What is the 'Total Balance' value for ${accountType} accounts?`
        });
        
        // Add more questions for other columns
        const availableResponse = await vqa({
          image: imageUrl,
          question: `What is the 'Available' value for ${accountType} accounts?`
        });
        
        const creditLimitResponse = await vqa({
          image: imageUrl,
          question: `What is the 'Credit Limit' value for ${accountType} accounts?`
        });
        
        const debtToCreditResponse = await vqa({
          image: imageUrl,
          question: `What is the 'Debt-to-Credit' value for ${accountType} accounts?`
        });
        
        const paymentResponse = await vqa({
          image: imageUrl,
          question: `What is the 'Payment' value for ${accountType} accounts?`
        });
        
        // Extract values from responses
        row['Open'] = extractAnswer(openResponse);
        row['With Balance'] = extractAnswer(withBalanceResponse);
        row['Total Balance'] = extractAnswer(totalBalanceResponse);
        row['Available'] = extractAnswer(availableResponse);
        row['Credit Limit'] = extractAnswer(creditLimitResponse);
        row['Debt-to-Credit'] = extractAnswer(debtToCreditResponse);
        row['Payment'] = extractAnswer(paymentResponse);
      } catch (error) {
        console.error(`Error processing row for ${accountType}:`, error);
      }
      
      console.log(`Extracted row for ${accountType}:`, row);
      rows.push(row);
    }
    
    return { headers, rows };
  } catch (error) {
    console.error('Error extracting table from image:', error);
    return null;
  }
}

/**
 * Helper function to extract answer from response
 */
function extractAnswer(response: any): string {
  if (response && typeof response === 'object') {
    // Different models have different response formats
    if (response.answer) {
      return response.answer;
    } else if (response.text) {
      return response.text;
    } else if (Array.isArray(response) && response.length > 0) {
      if (response[0].answer) {
        return response[0].answer;
      } else if (response[0].text) {
        return response[0].text;
      }
    }
  }
  return '';
}

/**
 * Convert extracted table data to AccountSummary objects
 */
export function convertTableToAccountSummaries(tableData: ExtractedTable): AccountSummary[] {
  return tableData.rows.map(row => {
    return {
      accountType: row['Account Type'],
      totalAccounts: null,
      open: parseValue(row['Open']),
      closed: null,
      balance: null,
      withBalance: parseValue(row['With Balance']),
      totalBalance: parseFinancialValue(row['Total Balance']),
      available: parseFinancialValue(row['Available']),
      creditLimit: parseFinancialValue(row['Credit Limit']),
      debtToCredit: parsePercentValue(row['Debt-to-Credit']),
      payment: parseFinancialValue(row['Payment'])
    };
  });
}

/**
 * Parse numeric values and handle "0" cases
 */
function parseValue(value: string): string | null {
  if (!value) return null;
  
  // Check for zero values specifically
  if (value === '0' || value.trim() === '0') {
    return "0";
  }
  
  // Check if it's a numeric value
  const numMatch = value.match(/\b(\d+)\b/);
  if (numMatch && numMatch[1]) {
    return numMatch[1];
  }
  
  return null;
}

/**
 * Parse financial values ($)
 */
function parseFinancialValue(value: string): string | null {
  if (!value) return null;
  
  // Handle $X,XXX format
  if (value.includes('$')) {
    return value.trim();
  }
  
  // Check for numeric values that should be dollar amounts
  const numMatch = value.match(/\b([\d,]+\.\d+|\d+)\b/);
  if (numMatch && numMatch[1]) {
    return `$${numMatch[1]}`;
  }
  
  return null;
}

/**
 * Parse percentage values
 */
function parsePercentValue(value: string): string | null {
  if (!value) return null;
  
  // Handle X.X% format
  if (value.includes('%')) {
    return value.trim();
  }
  
  // Check for numeric values that should be percentages
  const numMatch = value.match(/\b(\d+\.\d+|\d+)\b/);
  if (numMatch && numMatch[1]) {
    return `${numMatch[1]}%`;
  }
  
  return null;
}
