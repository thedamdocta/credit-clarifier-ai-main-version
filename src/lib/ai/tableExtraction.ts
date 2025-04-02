
import { AccountSummary } from '../types/creditReport';
import { getExtractedReportData } from '@/utils/pdf/extractText';
import { extractTableWithTesseract } from './table/tesseractExtraction';
import { calculateCreditAccountsTableScore } from './tableDetection';

/**
 * Enhanced table extraction with improved targeting for Credit Accounts tables
 * @param imageUrl - The URL of the image to extract table from
 * @param targetTableName - The name of the target table to extract (default: "Credit Accounts")
 */
export async function extractTableFromImage(
  imageUrl: string, 
  targetTableName: string = "Credit Accounts"
) {
  try {
    console.log(`Starting ${targetTableName} table extraction from image:`, imageUrl);
    
    if (!imageUrl) {
      console.log('No image URL provided for table extraction');
      return null;
    }
    
    // First check if we already have extracted data from a real file
    const extractedData = getExtractedReportData();
    if (extractedData && extractedData.accountSummaries && extractedData.accountSummaries.length > 0) {
      console.log('Using pre-extracted account data from actual report:', extractedData.reportId);
      
      // Check if there's any real data in the account summaries
      const hasRealData = extractedData.accountSummaries.some(summary => 
        (summary.open && summary.open !== "0") || 
        (summary.withBalance && summary.withBalance !== "0") || 
        (summary.totalBalance && summary.totalBalance !== "$0" && summary.totalBalance !== "0"));
      
      if (hasRealData) {
        console.log('Real account data found, using it');
        // Convert to table format for compatibility
        const tableFormat = {
          headers: ['Account Type', 'Open', 'With Balance', 'Total Balance', 'Available', 'Credit Limit', 'Debt-to-Credit', 'Payment'],
          rows: extractedData.accountSummaries.map(summary => ({
            'Account Type': summary.accountType,
            'Open': summary.open || '0',
            'With Balance': summary.withBalance || '0',
            'Total Balance': summary.totalBalance || '$0',
            'Available': summary.available || '$0',
            'Credit Limit': summary.creditLimit || '$0',
            'Debt-to-Credit': summary.debtToCredit || '0%',
            'Payment': summary.payment || '$0'
          }))
        };
        
        return tableFormat;
      } else {
        console.log('Account summaries exist but contain no real data');
      }
    }
    
    // Use enhanced Tesseract OCR to extract table data from the image with improved settings
    console.log(`Using enhanced Tesseract OCR to extract ${targetTableName} table from image`);
    const extractedTable = await extractTableWithTesseract(imageUrl, targetTableName);
    
    if (extractedTable) {
      console.log('Successfully extracted table with Tesseract:', extractedTable);
      
      // Check specifically if the text contains credit account table keywords
      // Safely handle the potential undefined text property
      const textLower = extractedTable.text ? extractedTable.text.toLowerCase() : '';
      const hasTableKeywords = 
        (textLower.includes('revolving') || textLower.includes('mortgage') || textLower.includes('installment')) && 
        (textLower.includes('balance') || textLower.includes('credit limit') || textLower.includes('payment'));
      
      // Look specifically for currency symbols and numeric patterns
      const hasCurrencyPattern = extractedTable.text ? /\$[\d,.]+/i.test(extractedTable.text) : false;
      const hasNumericColumns = extractedTable.text ? /(\d+)\s+(\d+)\s+\$?([\d,.]+)/i.test(extractedTable.text) : false;
      
      // Determine if this is likely the correct table with a more comprehensive check
      const isLikelyTargetTable = extractedTable.isTargetTable || 
                               (extractedTable.matchScore && extractedTable.matchScore > 0.5) ||
                               (hasTableKeywords && textLower.includes('account type')) ||
                               (hasTableKeywords && hasCurrencyPattern && hasNumericColumns);
      
      if (isLikelyTargetTable) {
        console.log(`This appears to be the ${targetTableName} table we're looking for`);
        
        // Convert to the expected format
        const formattedTable = {
          headers: extractedTable.headers,
          rows: extractedTable.rows.map(row => {
            const rowObject: Record<string, string> = {};
            extractedTable.headers.forEach((header, index) => {
              rowObject[header] = row[index] || '';
            });
            return rowObject;
          }),
          matchScore: extractedTable.matchScore || 0
        };
        
        return formattedTable;
      } else {
        console.log(`This table doesn't appear to be the ${targetTableName} table we're looking for`);
        // Return null to trigger fallback methods
        return null;
      }
    }
    
    // If Tesseract extraction fails, try fallback pattern matching on text
    console.log(`Tesseract extraction failed for ${targetTableName}, trying pattern matching on extracted text`);
    const extractedText = document.querySelector('.extracted-text-content')?.textContent || '';
    if (extractedText) {
      // Calculate a score to determine if this text contains the target table
      const textScore = calculateCreditAccountsTableScore(extractedText);
      console.log(`Text match score for ${targetTableName}: ${textScore.toFixed(2)}`);
      
      // Only extract if the score is reasonably high
      if (textScore > 0.4) {
        const tableData = extractTableStructureFromText(extractedText, targetTableName);
        if (tableData) {
          tableData.matchScore = textScore;
          return tableData;
        }
      }
    }
    
    // All extraction methods failed
    console.log(`All extraction methods failed to extract ${targetTableName} table data`);
    return null;
  } catch (error) {
    console.error('Error in table extraction:', error);
    return null;
  }
}

/**
 * Extract table structure from raw text using template matching
 * @param text - Raw text to extract table from
 * @param targetTableName - Name of the target table
 */
export function extractTableStructureFromText(
  text: string, 
  targetTableName: string = "Credit Accounts"
): any {
  try {
    console.log(`Extracting ${targetTableName} table structure from text using pattern matching`);
    
    // Define enhanced patterns specifically for credit report account tables
    // These patterns identify data in the format: account type + numbers with various formats
    const rowPatterns = {
      revolving: /revolving\s+(\d+)\s+(\d+)\s+\$?([\d,.]+)\s+\$?([\d,.]+)\s+\$?([\d,.]+)/i,
      mortgage: /mortgage\s+(\d+)\s+(\d+)\s+\$?([\d,.]+)\s+\$?([\d,.]+)\s+\$?([\d,.]+)/i,
      installment: /installment\s+(\d+)\s+(\d+)\s+\$?([\d,.]+)\s+\$?([\d,.]+)\s+\$?([\d,.]+)/i,
      other: /other\s+(\d+)\s+(\d+)\s+\$?([\d,.]+)\s+\$?([\d,.]+)\s+\$?([\d,.]+)/i,
      total: /total\s+(\d+)\s+(\d+)\s+\$?([\d,.]+)\s+\$?([\d,.]+)\s+\$?([\d,.]+)/i,
    };
    
    // Check if text contains the target table name
    const containsTargetName = text.toLowerCase().includes(targetTableName.toLowerCase());
    if (containsTargetName) {
      console.log(`Found "${targetTableName}" in text`);
    }
    
    // Initialize table structure
    const tableStructure = {
      headers: ['Account Type', 'Open', 'With Balance', 'Total Balance', 'Available', 'Credit Limit', 'Debt-to-Credit', 'Payment'],
      rows: []
    };
    
    // Extract rows using the patterns
    Object.entries(rowPatterns).forEach(([accountType, pattern]) => {
      const match = text.match(pattern);
      if (match) {
        console.log(`Found match for ${accountType}: ${match[0]}`);
        const row: Record<string, string> = {
          'Account Type': accountType.charAt(0).toUpperCase() + accountType.slice(1),
          'Open': match[1] || '0',
          'With Balance': match[2] || '0',
          'Total Balance': match[3] ? `$${match[3]}` : '$0',
          'Available': match[4] ? `$${match[4]}` : '$0',
          'Credit Limit': match[5] ? `$${match[5]}` : '$0',
          'Debt-to-Credit': '0%',
          'Payment': '$0'
        };
        
        tableStructure.rows.push(row);
      }
    });
    
    return tableStructure.rows.length > 0 ? tableStructure : null;
  } catch (error) {
    console.error('Error extracting table structure from text:', error);
    return null;
  }
}

// Keep simulated data function for development purposes only - retain exact values for testing/comparison
export function createSimulatedTableData(forceUseActualImage: boolean = false) {
  // If we're forcing use of actual image data, don't return simulated data
  if (forceUseActualImage) {
    return null;
  }
  
  // Don't use sample data in production environments
  if (process.env.NODE_ENV !== 'development' && window.location.hostname !== 'localhost') {
    return null;
  }
  
  console.log('Creating simulated table data');
  
  return {
    headers: ['Account Type', 'Open', 'With Balance', 'Total Balance', 'Available', 'Credit Limit', 'Debt-to-Credit', 'Payment'],
    rows: [
      {
        'Account Type': 'Revolving',
        'Open': '10',
        'With Balance': '9',
        'Total Balance': '$16,355',
        'Available': '$8,345',
        'Credit Limit': '$24,700',
        'Debt-to-Credit': '66.0%',
        'Payment': '$627'
      },
      {
        'Account Type': 'Mortgage',
        'Open': '0',
        'With Balance': '0',
        'Total Balance': '$0',
        'Available': '$0',
        'Credit Limit': '$0',
        'Debt-to-Credit': '0.0%',
        'Payment': '$0'
      },
      {
        'Account Type': 'Installment',
        'Open': '2',
        'With Balance': '2',
        'Total Balance': '$204,150',
        'Available': '$15,455',
        'Credit Limit': '$219,605',
        'Debt-to-Credit': '93.0%',
        'Payment': '$498'
      },
      {
        'Account Type': 'Other',
        'Open': '0',
        'With Balance': '0',
        'Total Balance': '$0',
        'Available': '$0',
        'Credit Limit': '$0',
        'Debt-to-Credit': '0.0%',
        'Payment': '$0'
      },
      {
        'Account Type': 'Total',
        'Open': '12',
        'With Balance': '11',
        'Total Balance': '$220,505',
        'Available': '$23,800',
        'Credit Limit': '$244,305',
        'Debt-to-Credit': '66.0%',
        'Payment': '$1,125'
      }
    ]
  };
}

// Import the value parsers from our value parser module
import { parseNumericValue, parseCurrencyValue, parsePercentageValue } from './table/valueParser';

/**
 * Convert extracted table data to AccountSummary objects
 */
export function convertTableToAccountSummaries(tableData: any): AccountSummary[] {
  const summaries: AccountSummary[] = [];
  
  if (!tableData || !tableData.rows || tableData.rows.length === 0) {
    return summaries;
  }
  
  // Process each row in the table
  tableData.rows.forEach((row: any) => {
    // Extract account type
    const accountType = row['Account Type'];
    if (!accountType) return;
    
    // Create an account summary object with all required properties
    const summary: AccountSummary = {
      accountType: accountType,
      totalAccounts: null,
      open: parseNumericValue(row['Open']),
      closed: null,
      balance: null,
      withBalance: parseNumericValue(row['With Balance']),
      totalBalance: parseCurrencyValue(row['Total Balance']),
      available: parseCurrencyValue(row['Available']),
      creditLimit: parseCurrencyValue(row['Credit Limit']),
      debtToCredit: parsePercentageValue(row['Debt-to-Credit']),
      payment: parseCurrencyValue(row['Payment'])
    };
    
    summaries.push(summary);
  });
  
  return summaries;
}
