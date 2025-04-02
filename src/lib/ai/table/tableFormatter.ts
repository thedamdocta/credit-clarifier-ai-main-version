import { ExtractedTableData, ExtractedTable, FormattedTableData } from './types';
import { parseNumericValue, parseCurrencyValue, parsePercentageValue } from './valueParser';

/**
 * Format extracted table data for display
 * Updated to process each cell individually
 */
export function formatTableData(tableData: ExtractedTableData): FormattedTableData {
  if (!tableData || !tableData.headers || !tableData.rows) {
    return { headers: [], rows: [] };
  }
  
  const headers = tableData.headers.map(header => header.trim());
  const rows = tableData.rows.map(row => {
    const rowObject: Record<string, string> = {};
    
    headers.forEach((header, index) => {
      // Get raw value from the cell
      const rawValue = row[index]?.trim() || '';
      
      // Process each cell individually based on its content and column type
      let processedValue = '';
      
      // Determine cell type based on column name and content
      if (/open|with\s+balance/i.test(header)) {
        // Count columns - process numeric values
        processedValue = parseNumericValue(rawValue) || '';
      } 
      else if (/total\s+balance|available|credit\s+limit|payment/i.test(header)) {
        // Money columns - process currency values
        processedValue = parseCurrencyValue(rawValue) || '';
      }
      else if (/debt.*credit/i.test(header)) {
        // Percentage column - process percentage values
        processedValue = parsePercentageValue(rawValue) || '';
      }
      else {
        // Other columns - use as is
        processedValue = rawValue;
      }
      
      rowObject[header] = processedValue;
    });
    
    return rowObject;
  });
  
  return { headers, rows };
}

/**
 * Convert table data to CSV format
 */
export function tableToCSV(tableData: ExtractedTableData): string {
  if (!tableData || !tableData.headers || !tableData.rows) {
    return '';
  }
  
  const headers = tableData.headers.join(',');
  const rows = tableData.rows.map(row => row.join(','));
  return [headers, ...rows].join('\n');
}

/**
 * Format table data for display in a specific format
 * Enhanced with cell-by-cell processing
 */
export function formatTableForDisplay(tableData: ExtractedTable): FormattedTableData {
  const headers = tableData.headers;
  const rows = tableData.rows.map(row => {
    const formattedRow: Record<string, string> = {};
    
    // Process each cell individually
    headers.forEach(header => {
      const rawValue = row[header];
      
      // Apply cell-specific formatting based on column name
      if (/open|with\s+balance/i.test(header)) {
        formattedRow[header] = parseNumericValue(rawValue) || '';
      }
      else if (/total\s+balance|available|credit\s+limit|payment/i.test(header)) {
        formattedRow[header] = parseCurrencyValue(rawValue) || '';
      }
      else if (/debt.*credit/i.test(header)) {
        formattedRow[header] = parsePercentageValue(rawValue) || '';
      }
      else {
        formattedRow[header] = rawValue || '';
      }
    });
    
    return formattedRow;
  });
  
  return { headers, rows };
}
