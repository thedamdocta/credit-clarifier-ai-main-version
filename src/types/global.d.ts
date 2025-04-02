
// Global type definitions
interface Window {
  currentPdf?: any;
  currentPdfPageImages?: string[];
  currentPdfData?: {
    reportId: string;
    fileName: string;
    extractedText: string;
  };
}
