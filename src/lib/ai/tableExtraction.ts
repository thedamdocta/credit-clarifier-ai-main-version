
import { AccountSummary } from '../types/creditReport';
import { getExtractedReportData } from '@/utils/pdf/extractText';
import { extractTableWithTesseract } from './table/tesseractExtraction';
import { calculateCreditAccountsTableScore } from './tableDetection';
import { trainParser } from './table/valueParser';
import { extractTableWithOpenAI, canUseOpenAI } from './openai/openaiService';

/**
 * Enhanced table extraction with improved targeting for Credit Accounts tables
 * Uses multiple extraction methods including OpenAI when available
 * @param imageUrl - The URL of the image to extract table from
 * @param targetTableName - The name of the target table to extract (default: "Credit Accounts")
 */
export async function extractTableFromImage(
  imageUrl: string, 
  targetTableName: string = "Credit Accounts"
) {
  try {
    console.log(`Starting ${targetTableName} table extraction from image`);
    
    // Check if we can use OpenAI for extraction (preferred method)
    if (canUseOpenAI()) {
      console.log('Using OpenAI for table extraction');
      const openaiData = await extractTableWithOpenAI(imageUrl);
      
      if (openaiData && openaiData.length > 0) {
        console.log('Successfully extracted table data with OpenAI');
        return {
          rows: openaiData,
          method: 'openai'
        };
      }
      
      console.log('OpenAI extraction failed or returned empty data, falling back to Tesseract');
    } else {
      console.log('OpenAI not available, using Tesseract for table extraction');
    }
    
    // Fall back to Tesseract OCR
    const tesseractData = await extractTableWithTesseract(imageUrl);
    if (tesseractData && tesseractData.rows && tesseractData.rows.length > 0) {
      console.log('Successfully extracted table data with Tesseract');
      return {
        rows: tesseractData.rows,
        method: 'tesseract'
      };
    }
    
    console.log('All extraction methods failed');
    return null;
    
  } catch (error) {
    console.error('Error extracting table from image:', error);
    return null;
  }
}

/**
 * Converts raw extracted table data to structured account summaries
 */
export function convertTableToAccountSummaries(tableData: { 
  rows: any[]; 
  method: string;
}): AccountSummary[] {
  try {
    if (!tableData || !tableData.rows || tableData.rows.length === 0) {
      console.log('No table data to convert to account summaries');
      return [];
    }
    
    console.log(`Converting ${tableData.rows.length} rows of table data to account summaries`);
    console.log('Extraction method used:', tableData.method);
    
    // Different conversion strategies based on extraction method
    if (tableData.method === 'openai') {
      return tableData.rows;
    }
    
    // Generic conversion for other methods
    const accountTypes = ['Revolving', 'Mortgage', 'Installment', 'Other', 'Total'];
    const accountSummaries: AccountSummary[] = [];
    
    // Try to extract account summaries from the rows
    for (const row of tableData.rows) {
      let accountType = null;
      
      // Try to determine the account type
      for (const type of accountTypes) {
        if (row.text && row.text.toLowerCase().includes(type.toLowerCase())) {
          accountType = type;
          break;
        }
      }
      
      if (!accountType) {
        continue;
      }
      
      // Extract numeric values from the row
      const valueMatches = row.text.match(/\d+|(\$[\d,.]+)/g) || [];
      
      // Create account summary object with all required properties
      const summary: AccountSummary = {
        accountType,
        totalAccounts: null,
        open: valueMatches[0] || null,
        withBalance: valueMatches[1] || null,
        totalBalance: valueMatches[2] && valueMatches[2].includes('$') ? valueMatches[2] : (valueMatches[2] ? `$${valueMatches[2]}` : null),
        available: valueMatches[3] && valueMatches[3].includes('$') ? valueMatches[3] : (valueMatches[3] ? `$${valueMatches[3]}` : null),
        creditLimit: valueMatches[4] && valueMatches[4].includes('$') ? valueMatches[4] : (valueMatches[4] ? `$${valueMatches[4]}` : null),
        payment: valueMatches[5] && valueMatches[5].includes('$') ? valueMatches[5] : (valueMatches[5] ? `$${valueMatches[5]}` : null),
        closed: null,
        balance: null,
        debtToCredit: null
      };
      
      accountSummaries.push(summary);
    }
    
    // Ensure we have all required account types
    for (const type of accountTypes) {
      if (!accountSummaries.some(s => s.accountType === type)) {
        accountSummaries.push({
          accountType: type,
          totalAccounts: null,
          open: null,
          withBalance: null,
          totalBalance: null,
          available: null,
          creditLimit: null,
          payment: null,
          closed: null,
          balance: null,
          debtToCredit: null
        });
      }
    }
    
    // Sort by expected account type order
    const sortedSummaries = accountSummaries.sort((a, b) => {
      return accountTypes.indexOf(a.accountType) - accountTypes.indexOf(b.accountType);
    });
    
    console.log(`Converted ${sortedSummaries.length} account summaries`);
    return sortedSummaries;
    
  } catch (error) {
    console.error('Error converting table data to account summaries:', error);
    return [];
  }
}

/**
 * Gets cached account summaries from the report data if available
 */
export function getCachedAccountSummaries(): AccountSummary[] | null {
  try {
    const reportData = getExtractedReportData();
    if (reportData && reportData.accountSummaries && reportData.accountSummaries.length > 0) {
      return reportData.accountSummaries;
    }
    return null;
  } catch (error) {
    console.error('Error retrieving cached account summaries:', error);
    return null;
  }
}
