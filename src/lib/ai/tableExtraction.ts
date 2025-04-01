import { AccountSummary } from '../types/creditReport';
import { getExtractedReportData } from '@/utils/pdf/extractText';
import { extractTableWithTesseract } from './table/tesseractExtraction';

/**
 * Extract table data from an image
 * Uses Tesseract OCR to extract table structure from the image
 */
export async function extractTableFromImage(imageUrl: string) {
  try {
    console.log('Starting table extraction from image:', imageUrl);
    
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
    
    // Log the image data for debugging
    console.log('Image URL length:', imageUrl.length);
    console.log('Image URL starts with:', imageUrl.substring(0, 30) + '...');
    
    // Check if this is a proper data URL
    if (!imageUrl.startsWith('data:image')) {
      console.error('Invalid image URL format');
      return null;
    }
    
    // Use Tesseract OCR to extract table data from the image
    console.log('Using Tesseract OCR to extract table data from image');
    const extractedTable = await extractTableWithTesseract(imageUrl);
    
    if (extractedTable) {
      console.log('Successfully extracted table with Tesseract:', extractedTable);
      
      // Convert to the expected format
      const formattedTable = {
        headers: extractedTable.headers,
        rows: extractedTable.rows.map(row => {
          const rowObject: Record<string, string> = {};
          extractedTable.headers.forEach((header, index) => {
            rowObject[header] = row[index] || '';
          });
          return rowObject;
        })
      };
      
      return formattedTable;
    }
    
    // If Tesseract extraction fails, try to extract table structure from the image text
    console.log('Tesseract extraction failed, trying to extract table from text');
    const extractedText = await extractTextFromTable(imageUrl);
    if (extractedText) {
      const tableStructure = extractTableStructureFromText(extractedText);
      if (tableStructure) {
        return tableStructure;
      }
    }
    
    // If all extraction methods fail, return null
    console.log('All extraction methods failed to extract table data');
    
    // Fall back to simulated data for development purposes only
    if (process.env.NODE_ENV === 'development') {
      console.log('Development environment detected, falling back to simulated data');
      return createSimulatedTableData();
    }
    
    return null;
  } catch (error) {
    console.error('Error in table extraction:', error);
    return null;
  }
}

/**
 * Extract text specifically from a table image
 */
async function extractTextFromTable(imageUrl: string): Promise<string | null> {
  try {
    // Use Tesseract.js for text extraction
    const Tesseract = (await import('tesseract.js')).default;
    
    const worker = await Tesseract.createWorker({
      logger: m => console.log(`Tesseract progress: ${m.progress} - ${m.status}`),
    });
    
    // Configure Tesseract for table extraction
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    
    // Set page segmentation mode for structured text and tables
    await worker.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM.AUTO_OSD,
      preserve_interword_spaces: '1',
    });
    
    console.log('Running Tesseract text extraction on image');
    const result = await worker.recognize(imageUrl);
    await worker.terminate();
    
    console.log('Tesseract extraction completed with confidence:', result.data.confidence);
    return result.data.text;
  } catch (error) {
    console.error('Error extracting text from table:', error);
    return null;
  }
}

/**
 * Extract table structure from raw text using template matching
 */
export function extractTableStructureFromText(text: string) {
  try {
    console.log('Extracting table structure from text using pattern matching');
    
    // Define expected row patterns for credit report account tables
    // These patterns identify data in the format: account type + numbers
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

// Keep simulated data function for development purposes only
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
  return null; // In most cases, we don't want to use simulated data
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
