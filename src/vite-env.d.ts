
/// <reference types="vite/client" />

// Extend the Window interface to include our custom property
interface Window {
  currentPdfData?: {
    reportId: string;
    fileName: string;
    extractedText: string;
  };
}
