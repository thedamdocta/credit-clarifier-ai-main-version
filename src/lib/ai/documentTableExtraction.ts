
import Tesseract from 'tesseract.js';
import { toast } from "sonner";

// Interface for structured table data
interface ExtractedTableData {
  headers: string[];
  rows: string[][];
  confidence: number;
}

/**
 * Enhanced table detection and extraction using Tesseract.js
 * This complements the Hugging Face approach for better table structure recognition
 */
export async function extractTableWithTesseract(imageUrl: string): Promise<ExtractedTableData | null> {
  try {
    console.log('Starting Tesseract table extraction from image:', imageUrl);
    
    // Initialize Tesseract with table structure detection
    const worker = await Tesseract.createWorker({
      logger: m => console.log(`Tesseract progress: ${m.progress} - ${m.status}`),
    });
    
    // Configure Tesseract for table detection
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    
    // Set page segmentation mode to detect tables and organized text
    await worker.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM.AUTO_OSD, // Auto detect orientation and script detection
      preserve_interword_spaces: '1', // Preserve spaces between words
      tessjs_create_hocr: '1', // Create HOCR output for better structure understanding
    });
    
    const result = await worker.recognize(imageUrl);
    console.log('Tesseract confidence:', result.data.confidence);
    
    // If confidence is too low, we might want to fall back to other methods
    if (result.data.confidence < 65) {
      console.log('Tesseract confidence too low, may need fallback method');
      await worker.terminate();
      return null;
    }
    
    // Extract tabular data using Tesseract's block structure detection
    const tableData = extractTableFromOCRResult(result.data);
    
    await worker.terminate();
    return tableData;
  } catch (error) {
    console.error('Error in Tesseract table extraction:', error);
    toast.error("Tesseract extraction failed");
    return null;
  }
}

/**
 * Process Tesseract OCR result to extract tabular data
 * This function analyzes word positions to detect table structure
 */
function extractTableFromOCRResult(ocrResult: Tesseract.Page): ExtractedTableData | null {
  try {
    // Get the lines content for positional analysis
    const lines = ocrResult.lines || [];
    if (lines.length === 0) return null;
    
    // Detect column boundaries based on word positions
    const columns = detectColumns(lines);
    if (columns.length < 3) return null; // Need at least 3 columns for a valid table
    
    // Find header row
    const headerRowIndex = findHeaderRow(lines);
    if (headerRowIndex === -1) return null;
    
    // Extract headers and data rows based on positions
    const headers = extractHeadersFromRow(lines[headerRowIndex], columns);
    const dataRows = extractDataRows(lines, headerRowIndex + 1, columns);
    
    console.log('Extracted table structure with headers:', headers);
    console.log('Found data rows:', dataRows.length);
    
    return {
      headers,
      rows: dataRows,
      confidence: ocrResult.confidence || 0
    };
  } catch (error) {
    console.error('Error extracting table from OCR result:', error);
    return null;
  }
}

/**
 * Detect column boundaries by analyzing word positions
 */
function detectColumns(lines: Tesseract.Line[]): number[] {
  // Analyze word positions across multiple lines to detect column boundaries
  const positions: number[] = [];
  
  // Get words from the first few content lines (skip potential headers)
  const contentLines = lines.slice(1, Math.min(lines.length, 6));
  
  // Extract word start positions
  contentLines.forEach(line => {
    line.words.forEach(word => {
      positions.push(word.bbox.x0);
    });
  });
  
  // Sort positions
  positions.sort((a, b) => a - b);
  
  // Find clusters of positions (columns)
  const columnBoundaries: number[] = [];
  let currentCluster: number[] = [];
  let prevPosition = positions[0];
  
  positions.forEach(position => {
    if (position - prevPosition > 20) {
      // New column boundary found
      if (currentCluster.length > 0) {
        const avgPosition = currentCluster.reduce((sum, pos) => sum + pos, 0) / currentCluster.length;
        columnBoundaries.push(avgPosition);
      }
      currentCluster = [position];
    } else {
      currentCluster.push(position);
    }
    prevPosition = position;
  });
  
  // Add the last cluster
  if (currentCluster.length > 0) {
    const avgPosition = currentCluster.reduce((sum, pos) => sum + pos, 0) / currentCluster.length;
    columnBoundaries.push(avgPosition);
  }
  
  return columnBoundaries;
}

/**
 * Find the header row by looking for specific header text patterns
 */
function findHeaderRow(lines: Tesseract.Line[]): number {
  const headerKeywords = ['account type', 'open', 'balance', 'credit limit', 'payment'];
  
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const lineText = lines[i].text.toLowerCase();
    
    // Check if this line contains multiple header keywords
    const keywordsFound = headerKeywords.filter(keyword => lineText.includes(keyword));
    if (keywordsFound.length >= 3) {
      return i;
    }
  }
  
  return -1; // No header row found
}

/**
 * Extract headers from a detected header row
 */
function extractHeadersFromRow(headerLine: Tesseract.Line, columnBoundaries: number[]): string[] {
  const headers: string[] = [];
  
  // Default expected headers
  const defaultHeaders = [
    'Account Type', 'Open', 'With Balance', 'Total Balance',
    'Available', 'Credit Limit', 'Debt-to-Credit', 'Payment'
  ];
  
  // Extract text based on column positions
  headerLine.words.forEach(word => {
    // Find which column this word belongs to
    const columnIndex = columnBoundaries.findIndex((boundary, i) => {
      const nextBoundary = i < columnBoundaries.length - 1 ? columnBoundaries[i + 1] : Number.MAX_VALUE;
      return word.bbox.x0 >= boundary && word.bbox.x0 < nextBoundary;
    });
    
    // Add the word to the appropriate header
    if (columnIndex >= 0) {
      if (!headers[columnIndex]) {
        headers[columnIndex] = word.text;
      } else {
        headers[columnIndex] += ' ' + word.text;
      }
    }
  });
  
  // Clean up and normalize headers
  const cleanedHeaders = headers.map(header => header ? header.trim() : '');
  
  // If we didn't find enough headers, use defaults
  if (cleanedHeaders.filter(h => h).length < 4) {
    console.log('Not enough headers found, using defaults');
    return defaultHeaders;
  }
  
  return cleanedHeaders;
}

/**
 * Extract data rows from the detected table
 */
function extractDataRows(lines: Tesseract.Line[], startIndex: number, columnBoundaries: number[]): string[][] {
  const dataRows: string[][] = [];
  const accountTypes = ['Revolving', 'Mortgage', 'Installment', 'Other', 'Total'];
  
  // Process each line that could be a data row
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    const lineText = line.text;
    
    // Check if this is an account type row we're interested in
    const matchingAccountType = accountTypes.find(type => 
      lineText.toLowerCase().includes(type.toLowerCase()));
      
    if (matchingAccountType) {
      // This is an account type row we want
      const rowData: string[] = Array(columnBoundaries.length).fill('');
      
      // First cell is the account type
      rowData[0] = matchingAccountType;
      
      // Extract values for each column
      line.words.forEach(word => {
        // Skip the account type word itself
        if (word.text.toLowerCase() === matchingAccountType.toLowerCase()) return;
        
        // Find which column this word belongs to
        const columnIndex = columnBoundaries.findIndex((boundary, i) => {
          const nextBoundary = i < columnBoundaries.length - 1 ? columnBoundaries[i + 1] : Number.MAX_VALUE;
          return word.bbox.x0 >= boundary && word.bbox.x0 < nextBoundary;
        });
        
        if (columnIndex > 0) { // Skip first column as we've already set it
          if (!rowData[columnIndex]) {
            rowData[columnIndex] = word.text;
          } else {
            rowData[columnIndex] += ' ' + word.text;
          }
        }
      });
      
      // Clean values and handle empty cells
      const cleanedRow = rowData.map(cell => {
        const cleaned = cell.trim();
        // Handle zero values specially
        if (cleaned === '0' || cleaned === 'O' || cleaned === 'o') return '0';
        return cleaned || '';
      });
      
      dataRows.push(cleanedRow);
    }
  }
  
  // Ensure we have all required account types
  const existingTypes = new Set(dataRows.map(row => row[0]));
  
  accountTypes.forEach(type => {
    if (!existingTypes.has(type)) {
      // Add empty row for missing account type
      const emptyRow = Array(columnBoundaries.length).fill('');
      emptyRow[0] = type;
      dataRows.push(emptyRow);
    }
  });
  
  return dataRows;
}

/**
 * Convert raw table data to the format expected by the application
 */
export function convertTesseractTableToAppFormat(tableData: ExtractedTableData): any {
  // Map the detected headers to the expected application format
  const headerMap: Record<string, string> = {
    'account type': 'Account Type',
    'open': 'Open',
    'with balance': 'With Balance',
    'total balance': 'Total Balance',
    'available': 'Available',
    'credit limit': 'Credit Limit',
    'debt-to-credit': 'Debt-to-Credit',
    'payment': 'Payment'
  };
  
  // Normalize headers
  const normalizedHeaders = tableData.headers.map(header => {
    const lowerHeader = header.toLowerCase();
    for (const [key, value] of Object.entries(headerMap)) {
      if (lowerHeader.includes(key)) return value;
    }
    return header;
  });
  
  // Convert rows to objects with header keys
  const rows = tableData.rows.map(row => {
    const rowObj: Record<string, string> = {};
    row.forEach((cell, index) => {
      const header = normalizedHeaders[index] || `Column${index}`;
      rowObj[header] = cell;
    });
    return rowObj;
  });
  
  return {
    headers: normalizedHeaders,
    rows
  };
}
