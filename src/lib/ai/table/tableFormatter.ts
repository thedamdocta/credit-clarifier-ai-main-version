
import { ExtractedTableData, FormattedTableData } from './types';

/**
 * Convert raw table data to the format expected by the application
 */
export function convertTesseractTableToAppFormat(tableData: ExtractedTableData): FormattedTableData {
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
