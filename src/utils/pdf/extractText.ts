
// Re-export all extraction utilities from their respective modules
import { 
  setPDFData,
  setExtractedReportData,
  getExtractedReportData,
  resetCurrentReportImage,
  getCurrentPDFData
} from './core/storageManager';

import { extractTextFromPDF } from './core/textExtractionHelper';
import { extractCreditAccountsTableImage } from './core/tableExtractor';

// Export all functions for backward compatibility
export {
  setPDFData,
  setExtractedReportData,
  getExtractedReportData,
  resetCurrentReportImage,
  extractTextFromPDF,
  extractCreditAccountsTableImage,
  getCurrentPDFData
};
