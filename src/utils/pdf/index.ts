
// Re-export all PDF processing utilities for easier imports
export * from './processPDF';
export * from './parseExtractedText';
export * from './progressHandling';

// Export everything from extractText except parsePDFContent to avoid ambiguity
export {
  getExtractedReportData,
  setExtractedReportData,
  resetExtractedReportData,
  resetCurrentReportImage,
  setCurrentReportImage,
  getCurrentReportImage,
  extractTextFromPDF,
  getCurrentPDFData,
  setCurrentPDFData,
  extractCreditAccountsTableImage
} from './extractText';

// Export the correct parsePDFContent from parseExtractedText
export { parsePDFContent } from './parseExtractedText';
