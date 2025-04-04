import { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { CreditReport } from "@/lib/types/creditReport";

// Store the extracted report data
let extractedReportData: CreditReport | null = null;

// Get the extracted report data
export const getExtractedReportData = () => {
  return extractedReportData;
};

// Set the extracted report data
export const setExtractedReportData = (report: CreditReport) => {
  extractedReportData = report;
};

// Reset the extracted report data
export const resetExtractedReportData = () => {
  extractedReportData = null;
};

// Store the current report image URL
let currentReportImageURL: string | null = null;

export const resetCurrentReportImage = () => {
  currentReportImageURL = null;
};

export const setCurrentReportImage = (url: string) => {
  currentReportImageURL = url;
};

export const getCurrentReportImage = () => {
  return currentReportImageURL;
};

// Extract text from PDF document
export const extractTextFromPDF = async (pdf: PDFDocumentProxy): Promise<string> => {
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(" ");
    fullText += pageText + "\n";
  }
  return fullText;
};

// Store the current PDF data
let currentPDFData: {
  file: File | null;
  pdfDocument: any;
  targetTable?: string;
  reportId: string;
} | null = null;

// Get the current PDF data (added this function)
export const getCurrentPDFData = () => {
  return currentPDFData;
};

// Set the current PDF data
export const setCurrentPDFData = (file: File, options: { targetTable?: string } = {}) => {
  const reportId = `report_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  
  currentPDFData = {
    file,
    pdfDocument: null,
    targetTable: options.targetTable,
    reportId
  };
  
  return reportId;
};

// Parse PDF content
export const parsePDFContent = async (text: string, useAI: boolean): Promise<CreditReport | null> => {
  try {
    if (text.includes("EQUIFAX")) {
      const { parseEquifaxCreditReport } = await import("@/lib/creditReportParser");
      return parseEquifaxCreditReport(text);
    } else if (text.includes("Experian")) {
      // Placeholder for Experian parsing
      console.log("Experian report detected, but parsing is not yet implemented.");
      return null;
    } else if (text.includes("TransUnion")) {
      // Placeholder for TransUnion parsing
      console.log("TransUnion report detected, but parsing is not yet implemented.");
      return null;
    } else {
      console.log("Unknown credit report format.");
      return null;
    }
  } catch (error) {
    console.error("Error parsing PDF content:", error);
    return null;
  }
};
