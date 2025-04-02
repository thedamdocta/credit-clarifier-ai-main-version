
// Global declarations for the application

// Define the window object with our custom properties
interface Window {
  currentPdfData?: {
    reportId: string;
    fileName: string;
    extractedText: string;
  };
}

// Extend the global Window interface
declare global {
  interface Window {
    currentPdfData?: {
      reportId: string;
      fileName: string;
      extractedText: string;
    };
  }
}
