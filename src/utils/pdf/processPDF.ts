
// Main PDF processing orchestrator that coordinates the different modules
import { toast } from "sonner";
import { setupProgressTracking, ProgressCallbacks } from "./progressHandling";
import { parsingLogger } from "@/utils/parsingLogger";
import { CreditReport } from "@/lib/types/creditReport";
import { handleBasicProcessing, setCurrentPDFData } from "./core/reportHandling";
import { readFileAsArrayBuffer, loadPdfDocument, checkFileSizeAndWarn } from "./core/pdfDocumentLoader";
import { extractTextInBatches, determinePageCountForProcessing } from "./core/textExtraction";
import { attemptExtractFirstPageImage } from "./core/imageExtraction";
import { handleParsing } from "./core/parsingHandler";

// Define PDF document type based on PDF.js types
interface PDFDocumentType {
  numPages: number;
  getPage: (pageNumber: number) => Promise<any>;
}

interface PDFProcessingCallbacks {
  setCurrentFile: (file: File) => void;
  setUploadProgress: (value: number | ((prev: number) => number)) => void;
  onPDFUploaded: (file: File, text: string, parsedReport?: any) => void;
  useImageExtraction?: boolean;
}

export const processPDFDocument = async (
  file: File,
  useAI: boolean,
  callbacks: PDFProcessingCallbacks
) => {
  const { setCurrentFile, onPDFUploaded, useImageExtraction = true } = callbacks;
  
  try {
    setCurrentFile(file);
    console.log(`Processing PDF document with file: ${file.name}, using image extraction: ${useImageExtraction}`);
    parsingLogger.logEvent("PDF processing started", { fileName: file.name, size: file.size });
    
    // Store this file as the current PDF being processed with a unique ID
    const uniqueReportId = setCurrentPDFData(file);
    
    // Setup progress tracking
    const { 
      clearProgressTracking, 
      completeProgressTracking, 
      handleProgressError,
      updateProgress
    } = setupProgressTracking(callbacks);
    
    // To prevent UI freezing, yield control back to the browser
    await new Promise(resolve => setTimeout(resolve, 50));
    updateProgress(5);
    
    // Check file size and warn for large files
    const fileSizeMB = checkFileSizeAndWarn(file);
    
    // Wrap file reading in a Promise with a small delay to prevent UI freezing
    const readFilePromise = async () => {
      await new Promise(resolve => setTimeout(resolve, 50)); // Yield to UI
      return readFileAsArrayBuffer(file);
    };
    
    const typedarray = await readFilePromise();
    updateProgress(20);
    
    try {
      // Load PDF document
      const pdf = await loadPdfDocument(typedarray, fileSizeMB) as PDFDocumentType;
      const numPages = pdf.numPages;
      console.log(`PDF loaded with ${numPages} pages`);
      parsingLogger.logEvent("PDF loaded", { pages: numPages });
      updateProgress(30);
      
      // Memory management - release array buffer after PDF is loaded to free memory
      // @ts-ignore - This is a hack to free memory
      let nullArray = null;
      
      // Yield control back to browser to prevent UI freeze
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Extract images in a separate chunk to prevent UI freezing
      if (useImageExtraction) {
        // Yield control back to browser before image extraction
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const firstPageImage = await attemptExtractFirstPageImage(pdf);
        updateProgress(40);
      } else {
        updateProgress(40);
      }
      
      // Extract text in batches for large documents to prevent memory issues
      await new Promise(resolve => setTimeout(resolve, 100)); // Yield to UI
      updateProgress(45);
      
      // Determine how many pages to process (limit for very large PDFs)
      const pagesToProcess = determinePageCountForProcessing(pdf, (message) => {
        toast.info(message, { duration: 4000 });
      });
      
      // Extract text in batches to prevent UI freezes
      let extractedText = "";
      try {
        extractedText = await extractTextInBatches(pdf, updateProgress, pagesToProcess);
        updateProgress(60);
      } catch (error) {
        console.error("Error in batch text extraction:", error);
        toast.error("Error extracting text from PDF. Using partial text.");
        // Continue with whatever text we extracted
      }
      
      // Handle parsing with worker-like processing to prevent UI freezes
      const parsedReport = await handleParsing(
        extractedText,
        uniqueReportId,
        file,
        useAI,
        updateProgress
      );
      
      // Final UI yield before completion
      await new Promise(resolve => setTimeout(resolve, 50));
      updateProgress(95);
      
      if (parsedReport) {
        // Complete processing
        completeProgressTracking();
        
        // Pass the extracted text, file, and parsed report to the parent component
        onPDFUploaded(file, extractedText, parsedReport);
        
        toast.success("PDF successfully processed!");
      } else {
        await handleBasicProcessing(uniqueReportId, file, extractedText, onPDFUploaded);
        completeProgressTracking();
      }
      
    } catch (error) {
      console.error("Error processing PDF:", error);
      parsingLogger.logEvent("PDF processing error", { error: String(error) });
      toast.error("Failed to process PDF. Please try another file.");
      clearProgressTracking();
    }
  } catch (error) {
    console.error("Error in PDF processing:", error);
    parsingLogger.logEvent("PDF processing error", { error: String(error) });
    toast.error("An error occurred while processing the PDF.");
    callbacks.setUploadProgress(0);
  }
};

// Import the renamed function from extractText.ts
import { setPDFData } from './extractText';
