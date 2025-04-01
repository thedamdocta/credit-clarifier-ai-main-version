
/// <reference types="vite/client" />

interface Window {
  currentPdfData?: {
    reportId: string;
    fileName: string;
    extractedText: string;
  };
}

// Make sure the window.currentPdfData global is accessible
declare global {
  interface Window {
    currentPdfData?: {
      reportId: string;
      fileName: string;
      extractedText: string;
    };
  }
}
