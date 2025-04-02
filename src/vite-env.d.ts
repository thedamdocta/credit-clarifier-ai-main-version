
/// <reference types="vite/client" />

interface Window {
  currentPdfData?: {
    reportId: string;
    fileName: string;
    extractedText: string;
  };
  currentPdf?: any; // Add this property
  currentPdfPageImages?: string[]; // Add this property
}

// Make sure the window.currentPdfData global is accessible
declare global {
  interface Window {
    currentPdfData?: {
      reportId: string;
      fileName: string;
      extractedText: string;
    };
    currentPdf?: any; // Add this property
    currentPdfPageImages?: string[]; // Add this property
  }
}
