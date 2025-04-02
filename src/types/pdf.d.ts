
interface Window {
  currentPdf: any;
  currentPdfData?: {
    reportId: string;
    fileName: string;
    extractedText: string;
  };
  currentPdfPageImages?: string[];
  gc?: () => void;
}
