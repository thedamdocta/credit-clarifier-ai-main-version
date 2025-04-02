
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
    
    // Yield to main thread to prevent UI freeze
    await new Promise(resolve => setTimeout(resolve, 100));
    updateProgress(5);
    
    // Check file size and warn for large files
    const fileSizeMB = checkFileSizeAndWarn(file);
    
    // For extremely large files, use very simplified processing - increase threshold to 200MB
    if (fileSizeMB > 200) {
      toast.info("Using simplified processing for this very large file", { duration: 5000 });
      await handleBasicProcessing(uniqueReportId, file, "Very large file - text extraction limited", onPDFUploaded);
      completeProgressTracking();
      return;
    }
    
    // IMPROVED: Use a web worker for file reading to prevent UI thread blocking
    // Only read a manageable chunk of the file at once for really large files
    try {
      // Yield to UI thread before starting heavy work
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const typedarray = await readFileAsArrayBuffer(file);
      updateProgress(20);
      
      // Yield to UI thread again
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Load PDF document with optimizations for large files
      const pdfLoadOptions = fileSizeMB > 100 ? { disableFontFace: true, cMapPacked: false } : {};
      const pdf = await loadPdfDocument(typedarray, fileSizeMB);
      
      const numPages = pdf.numPages;
      console.log(`PDF loaded with ${numPages} pages`);
      parsingLogger.logEvent("PDF loaded", { pages: numPages });
      updateProgress(30);
      
      // For extremely large documents (500+ pages), show a toast and limit processing
      const pagesToProcess = numPages > 300 ? 300 : numPages;
      if (numPages > 300) {
        toast.info(`This document has ${numPages} pages. Processing first ${pagesToProcess} pages for better performance.`, { duration: 6000 });
      }
      
      // Split heavy operations into small chunks with yields to prevent UI freezing
      
      // STEP 1: Extract images if needed (with yield points to prevent freezing)
      if (useImageExtraction) {
        // Yield to UI thread before image extraction
        await new Promise(resolve => setTimeout(resolve, 100));
        
        try {
          await Promise.race([
            attemptExtractFirstPageImage(pdf),
            new Promise((_, reject) => setTimeout(() => reject("Image extraction timed out"), 15000))
          ]);
        } catch (error) {
          console.log("Image extraction skipped:", error);
        }
        
        // Yield to UI thread after image extraction
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      updateProgress(40);
      
      // STEP 2: Extract text in small batches with yields between each batch
      await new Promise(resolve => setTimeout(resolve, 100));
      updateProgress(45);
      
      let extractedText = "";
      try {
        extractedText = await extractTextInBatches(pdf, updateProgress, pagesToProcess);
        updateProgress(60);
      } catch (error) {
        console.error("Error in batch text extraction:", error);
        toast.warning("Text extraction incomplete. Using partial text.");
        // Continue with whatever text we extracted
      }
      
      // Yield again after text extraction
      await new Promise(resolve => setTimeout(resolve, 100));
      updateProgress(75);
      
      // STEP 3: Parse the extracted text
      const parsedReport = await handleParsing(
        extractedText,
        uniqueReportId,
        file,
        useAI,
        updateProgress
      );
      
      // Final yield before completion
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
