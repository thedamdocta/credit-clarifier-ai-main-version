
// Global type extensions for the application

interface Window {
  currentPdf: any;
  currentPdfPageImages: string[];
  currentPdfData?: {
    reportId: string;
    fileName: string;
    extractedText: string;
  };
}

// Add any other global type extensions here
