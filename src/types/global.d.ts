
// Global declarations for the application

// Define the window object with our custom properties
interface Window {
  currentPdfData?: {
    reportId: string;
    fileName: string;
    extractedText: string;
  };
  currentPdf?: any; // Add this property to fix the TypeScript error
  currentPdfPageImages?: string[]; // Add this property to fix the TypeScript error
}

// Extend the global Window interface
declare global {
  interface Window {
    currentPdfData?: {
      reportId: string;
      fileName: string;
      extractedText: string;
    };
    currentPdf?: any; // Add this property to fix the TypeScript error
    currentPdfPageImages?: string[]; // Add this property to fix the TypeScript error
  }
}
