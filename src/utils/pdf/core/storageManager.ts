
// Manages the storage of PDF data and parsed report information
import { CreditReport } from "@/lib/types/creditReport";

// Global storage for the current PDF being processed
let currentPdfData: {
  pdfFile?: File;
  pdfDocument?: any;
  reportId?: string;
  parsedReport?: any;
  fileName?: string;
  extractedText?: string;
  tableImageUrl?: string; // Added to store table image URL
  scannedPages?: number[]; // Track which pages have been scanned
} = {};

// Cache for extracted report data - prevents overriding with sample data
let extractedReportData: any = null;

// Generate and set a unique ID for the current PDF document
export const setPDFData = (file: File): string => {
  const reportId = `report-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  currentPdfData = {
    pdfFile: file,
    reportId,
    fileName: file.name,
    scannedPages: []
  };
  return reportId;
};

// Store the parsed report data
export const setExtractedReportData = (parsedReport: any) => {
  extractedReportData = parsedReport;
};

// Get the extracted report data
export const getExtractedReportData = () => {
  return extractedReportData;
};

// Reset the current report image
export const resetCurrentReportImage = () => {
  if (currentPdfData) {
    currentPdfData.tableImageUrl = undefined;
    currentPdfData.scannedPages = [];
  }
};

// Store PDF document reference
export const setPDFDocument = (pdfDocument: any) => {
  if (currentPdfData) {
    currentPdfData.pdfDocument = pdfDocument;
  }
};

// Get current PDF document
export const getCurrentPDFDocument = () => {
  return currentPdfData.pdfDocument;
};

// Store extracted text
export const setExtractedText = (text: string) => {
  if (currentPdfData) {
    currentPdfData.extractedText = text;
  }
};

// Get stored extracted text
export const getExtractedText = () => {
  return currentPdfData.extractedText;
};

// Store table image URL
export const setTableImageUrl = (url: string) => {
  if (currentPdfData) {
    currentPdfData.tableImageUrl = url;
  }
};

// Get table image URL
export const getTableImageUrl = () => {
  return currentPdfData.tableImageUrl;
};

// Add scanned page
export const addScannedPage = (pageNum: number) => {
  if (currentPdfData.scannedPages) {
    currentPdfData.scannedPages.push(pageNum);
  } else {
    currentPdfData.scannedPages = [pageNum];
  }
};

// Get scanned pages
export const getScannedPages = () => {
  return currentPdfData.scannedPages || [];
};

// Get current PDF data
export const getCurrentPDFData = () => {
  return currentPdfData;
};
