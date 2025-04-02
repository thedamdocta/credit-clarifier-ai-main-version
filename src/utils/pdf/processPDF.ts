
import { toast } from "sonner";
import { extractTextFromPDF, setCurrentPDFData, setExtractedReportData } from "./extractText";
import { parsePDFContent } from "./parseExtractedText";
import { setupProgressTracking } from "./progressHandling";
import { convertPDFPageToImage } from "./pdfToImage";

interface PDFProcessingCallbacks {
  setCurrentFile: (file: File) => void;
  setUploadProgress: (value: number | ((prev: number) => number)) => void;
  onPDFUploaded: (file: File, text: string, parsedReport?: any) => void;
  useImageExtraction?: boolean;
  targetTable?: string; // Added parameter to specify which table to target
}

export const processPDFDocument = async (
  file: File,
  useAI: boolean,
  callbacks: PDFProcessingCallbacks
) => {
  const { 
    setCurrentFile, 
    onPDFUploaded, 
    useImageExtraction = false, 
    targetTable = "Credit Accounts" 
  } = callbacks;
  
  try {
    setCurrentFile(file);
    console.log(`Processing PDF document with file: ${file.name}, targeting table: ${targetTable}`);
    
    // Store this file as the current PDF being processed with a unique ID
    const uniqueReportId = setCurrentPDFData(file, { targetTable });
    console.log(`Set unique report ID: ${uniqueReportId}`);
    
    // Setup progress tracking
    const { 
      clearProgressTracking, 
      completeProgressTracking, 
      handleProgressError,
      updateProgress
    } = setupProgressTracking(callbacks);
    
    // Load the PDF.js library dynamically
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = 
      `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    
    // Read the PDF file
    const fileReader = new FileReader();
    
    fileReader.onload = async function() {
      const typedarray = new Uint8Array(this.result as ArrayBuffer);
      
      try {
        // Load the PDF document
        const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
        const numPages = pdf.numPages;
        console.log(`PDF loaded with ${numPages} pages`);
        updateProgress(10);
        
        // Use standard text extraction for the main content with table targeting
        const extractedText = await extractTextFromPDF(pdf);
        console.log("Successfully extracted text from PDF, length:", extractedText.length);
        updateProgress(60);
        
        try {
          // Parse the extracted text with the unique report ID
          console.log("Starting PDF content parsing...");
          const parsedReport = await parsePDFContent(extractedText, useAI);
          
          // Ensure the report has a unique ID and filename
          if (parsedReport) {
            parsedReport.reportId = uniqueReportId;
            parsedReport.fileName = file.name;
            parsedReport.rawText = extractedText; // Store the raw text for later use
            
            // Store this parsed data in our cache to prevent overriding with sample data
            setExtractedReportData(parsedReport);
            
            // Create a global reference to this PDF for better extraction
            window.currentPdfData = {
              reportId: uniqueReportId,
              fileName: file.name,
              extractedText: extractedText.substring(0, 1000) // Store preview
            };
            
            // Make sure state is updated before completing processing
            setTimeout(() => {
              completeProgressTracking();
              
              // Pass the extracted text, file, and parsed report to the parent component
              onPDFUploaded(file, extractedText, parsedReport);
              
              toast.success("PDF successfully processed!");
            }, 500);
          } else {
            handleBasicProcessing(uniqueReportId, file, extractedText, targetTable, onPDFUploaded);
            completeProgressTracking();
          }
          
        } catch (error) {
          console.error("Error parsing PDF content:", error);
          // Fall back to basic processing
          handleBasicProcessing(uniqueReportId, file, extractedText, targetTable, onPDFUploaded);
          completeProgressTracking();
        }
        
      } catch (error) {
        console.error("Error processing PDF:", error);
        toast.error("Failed to process PDF. Please try another file.");
        clearProgressTracking();
      }
    };

    fileReader.onerror = () => {
      toast.error("Error reading the file.");
      handleProgressError("File reader error");
    };

    fileReader.readAsArrayBuffer(file);
  } catch (error) {
    console.error("Error in PDF processing:", error);
    toast.error("An error occurred while processing the PDF.");
    callbacks.setUploadProgress(0);
  }
};

// Extract basic processing into a separate function for better readability
function handleBasicProcessing(
  reportId: string, 
  file: File, 
  extractedText: string, 
  targetTable: string,
  onPDFUploaded: (file: File, text: string, parsedReport?: any) => void
) {
  const basicReport = { 
    reportId: reportId,
    fileName: file.name,
    rawText: extractedText,
    bureau: 'Unknown' as const,
    reportDate: new Date().toISOString().split('T')[0],
    personalInfo: { name: 'Unknown', addresses: [] },
    accounts: [],
    inquiries: [],
    publicRecords: [],
    collections: [],
    creditScores: []
  };
  
  // Store in global for easier access
  window.currentPdfData = {
    reportId: reportId,
    fileName: file.name,
    extractedText: extractedText.substring(0, 1000)
  };
  
  // Store this parsed data in our cache
  setExtractedReportData(basicReport);
  
  onPDFUploaded(file, extractedText, basicReport);
  toast.success("PDF processed with basic extraction");
}
