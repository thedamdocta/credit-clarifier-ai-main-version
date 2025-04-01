
import { AccountSummary } from '../types/creditReport';
import { pipeline } from '@huggingface/transformers';
import { toast } from "sonner";
import { extractTableWithTesseract, convertTesseractTableToAppFormat } from './table';
import { processImageWithEnhancedOCR } from './ocrExtraction';
import { preprocessImageForOCR } from './imagePreprocessing';

// Configuration parameters
const USE_SIMULATION = false; // Set to false to use real extraction

/**
 * Two-stage extraction approach:
 * 1. Extract all text from the image
 * 2. Apply template-based structure recognition to organize into tables
 */
export async function extractTableFromImage(imageUrl: string) {
  try {
    console.log('Extracting table from image:', imageUrl);
    
    // Generate a unique timestamp to avoid browser caching
    const timestamp = Date.now();
    const uniqueImageUrl = `${imageUrl}?t=${timestamp}`;
    
    // Always use the original image directly - no preprocessing
    const imageToProcess = uniqueImageUrl;
    
    // Try multiple extraction methods in sequence
    let extractionResult = null;
    
    // Method 1: Tesseract with direct image passthrough
    try {
      console.log('Attempting extraction with Tesseract');
      const tesseractResult = await extractTableWithTesseract(imageToProcess);
      
      if (tesseractResult && tesseractResult.headers.length > 0 && tesseractResult.rows.length > 0) {
        console.log('Successfully extracted table using Tesseract');
        return convertTesseractTableToAppFormat(tesseractResult);
      }
    } catch (tesseractError) {
      console.error('Tesseract extraction failed:', tesseractError);
    }
    
    // Method 2: Template-based pattern extraction
    // Extract text first, then identify table structure
    try {
      const extractedText = await processImageWithEnhancedOCR(imageToProcess);
      if (extractedText) {
        const tableStructure = extractTableStructureFromText(extractedText);
        if (tableStructure && tableStructure.rows && tableStructure.rows.length > 0) {
          return tableStructure;
        }
      }
    } catch (textError) {
      console.error('Text-based extraction failed:', textError);
    }
    
    // If all extraction methods fail, return null instead of hardcoded data
    console.log('All extraction methods failed, returning null');
    toast.error("Could not extract data from image - you may need to manually enter values");
    
    return null;
  } catch (error) {
    console.error('Error in table extraction:', error);
    toast.error("Error processing the image");
    return null;
  }
}

/**
 * Extract table structure from raw text using template matching
 * This is part of the two-stage OCR process
 */
function extractTableStructureFromText(text: string) {
  try {
    console.log('Extracting table structure from text using template matching');
    
    // Define expected row patterns for credit report account tables
    const rowPatterns = {
      revolving: /revolving\s+(\d+)\s+(\d+)\s+\$?([\d,]+)\s+\$?([\d,]+)\s+\$?([\d,]+)/i,
      mortgage: /mortgage\s+(\d+)\s+(\d+)\s+\$?([\d,]+)\s+\$?([\d,]+)\s+\$?([\d,]+)/i,
      installment: /installment\s+(\d+)\s+(\d+)\s+\$?([\d,]+)\s+\$?([\d,]+)\s+\$?([\d,]+)/i,
      other: /other\s+(\d+)\s+(\d+)\s+\$?([\d,]+)\s+\$?([\d,]+)\s+\$?([\d,]+)/i,
      total: /total\s+(\d+)\s+(\d+)\s+\$?([\d,]+)\s+\$?([\d,]+)\s+\$?([\d,]+)/i,
    };
    
    // Initialize table structure
    const tableStructure = {
      headers: ['Account Type', 'Open', 'With Balance', 'Total Balance', 'Available', 'Credit Limit', 'Debt-to-Credit', 'Payment'],
      rows: []
    };
    
    // Extract rows using the patterns
    Object.entries(rowPatterns).forEach(([accountType, pattern]) => {
      const match = text.match(pattern);
      if (match) {
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

// Import the value parsers from our value parser module
import { parseNumericValue, parseCurrencyValue, parsePercentageValue } from './table/valueParser';

/**
 * Convert extracted table data to AccountSummary objects
 * Preserves original values without calculations
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
    
    // Additional logging to track what's happening with the parsing
    console.log(`Parsed row for ${accountType}:`, {
      open: row['Open'] + ' → ' + summary.open,
      withBalance: row['With Balance'] + ' → ' + summary.withBalance,
      totalBalance: row['Total Balance'] + ' → ' + summary.totalBalance,
      available: row['Available'] + ' → ' + summary.available,
      creditLimit: row['Credit Limit'] + ' → ' + summary.creditLimit,
      debtToCredit: row['Debt-to-Credit'] + ' → ' + summary.debtToCredit,
      payment: row['Payment'] + ' → ' + summary.payment
    });
    
    summaries.push(summary);
  });
  
  return summaries;
}
