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
    
    // For extremely large files, use very simplified processing - increase threshold to 150MB (from 100MB)
    if (fileSizeMB > 150) {
      toast.info("Using simplified processing for this very large file", { duration: 5000 });
      await handleBasicProcessing(uniqueReportId, file, "Very large file - text extraction limited", onPDFUploaded);
      completeProgressTracking();
      return;
    }
    
    // Create a timeout promise to prevent hanging on file read
    const fileReadTimeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("File reading timed out")), 45000) // Increased from 30s to 45s
    );
    
    // Wrap file reading in a Promise with a small delay to prevent UI freezing
    const readFilePromise = async () => {
      await new Promise(resolve => setTimeout(resolve, 50)); // Yield to UI
      return readFileAsArrayBuffer(file);
    };
    
    // Use let instead of const for the typedarray to allow memory management
    let typedarray;
    try {
      typedarray = await Promise.race([readFilePromise(), fileReadTimeout]);
    } catch (error) {
      console.error("Error or timeout reading file:", error);
      toast.error("Failed to read the PDF file. It may be too large or corrupted.");
      clearProgressTracking();
      return;
    }
    
    updateProgress(20);
    
    try {
      // Implement a timeout for loading PDF document to prevent hanging
      const pdfLoadTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("PDF loading timed out")), 60000) // Increased from 40s to 60s
      );
      
      // Load PDF document with timeout
      const pdf = await Promise.race([
        loadPdfDocument(typedarray, fileSizeMB),
        pdfLoadTimeout
      ]) as PDFDocumentType;
      
      const numPages = pdf.numPages;
      console.log(`PDF loaded with ${numPages} pages`);
      parsingLogger.logEvent("PDF loaded", { pages: numPages });
      updateProgress(30);
      
      // Memory management - release array buffer after PDF is loaded to free memory
      typedarray = null;
      
      // For extremely large documents (500+ pages), show a toast
      if (numPages > 500) {
        toast.info(`This document has ${numPages} pages. Processing might be limited for performance.`, { duration: 6000 });
      }
      
      // Extract images in a separate chunk to prevent UI freezing
      if (useImageExtraction) {
        // Yield control back to browser before image extraction
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Set a timeout for image extraction
        try {
          const imageExtractionTimeout = new Promise((_, reject) => 
            setTimeout(() => {
              console.log("Image extraction taking too long, continuing process");
              reject(new Error("Image extraction timed out"));
            }, 30000) // Increased from 20s to 30s
          );
          
          const firstPageImage = await Promise.race([
            attemptExtractFirstPageImage(pdf),
            imageExtractionTimeout
          ]);
          
          updateProgress(40);
        } catch (error) {
          console.log("Skipping image extraction due to timeout or error:", error);
          updateProgress(40);
        }
      } else {
        updateProgress(40);
      }
      
      // Extract text in batches for large documents to prevent memory issues
      await new Promise(resolve => setTimeout(resolve, 100)); // Yield to UI
      updateProgress(45);
      
      // Process all pages - with new limit of 200
      const pagesToProcess = determinePageCountForProcessing(pdf, (message) => {
        // Just log info about the page count, but process all pages
        if (numPages > 100) { // Lowered from 300 to 100
          toast.info(`Processing ${numPages} pages - this may take a while`, { duration: 4000 });
        }
      });
      
      // Extract text in batches to prevent UI freezes - with overall timeout
      let extractedText = "";
      try {
        // Set an overall timeout for text extraction
        const extractionTimeout = new Promise<string>((_, reject) => 
          setTimeout(() => {
            console.log("Text extraction taking too long, proceeding with partial text");
            reject(new Error("Text extraction timed out"));
          }, 120000) // Increased from 60s to 120s (2 minutes) for larger documents
        );
        
        extractedText = await Promise.race([
          extractTextInBatches(pdf, updateProgress, pagesToProcess),
          extractionTimeout
        ]);
        
        updateProgress(60);
      } catch (error) {
        console.error("Error or timeout in batch text extraction:", error);
        toast.warning("Text extraction incomplete. Using partial text.");
        // Continue with whatever text we extracted
      }
      
      // Simplified parsing for performance
      updateProgress(80);
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
