
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

// Performance optimization flags
const SKIP_IMAGE_EXTRACTION_FOR_LARGE_FILES = true;
const REDUCED_PAGE_LIMIT_FOR_LARGE_FILES = 50; // Reduced from 100 to 50

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
    
    // For extremely large files, use very simplified processing - reduced from 100MB to 75MB
    if (fileSizeMB > 75) {
      toast.info("Using simplified processing for this very large file", { duration: 5000 });
      await handleBasicProcessing(uniqueReportId, file, "Very large file - text extraction limited", onPDFUploaded);
      completeProgressTracking();
      return;
    }
    
    // Break down processing into smaller steps with more UI yields
    try {
      // Step 1: Read the file as array buffer with more UI yields
      updateProgress(10);
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Read file in chunks for large files
      const typedarray = await readFileAsArrayBuffer(file);
      updateProgress(20);
      
      // Step 2: Load PDF document with more UI yields
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Use more aggressive optimizations for PDF loading
      const pdfLoadOptions = fileSizeMB > 30 ? { 
        disableFontFace: true, 
        cMapPacked: false,
        disableRange: true, // Disable range requests
        disableStream: true, // Disable streaming
        disableAutoFetch: true // Disable auto fetching
      } : {};
      
      // Load the PDF with timeout and error handling - reduced from 60s to 45s
      const pdf = await Promise.race([
        loadPdfDocument(typedarray, fileSizeMB),
        new Promise((_, reject) => setTimeout(() => reject(new Error("PDF loading timed out")), 45000))
      ]).catch(error => {
        console.error("Error loading PDF:", error);
        toast.error("Could not load this PDF. The file might be damaged or too complex.");
        clearProgressTracking();
        throw new Error("PDF loading failed");
      });
      
      const numPages = pdf.numPages;
      console.log(`PDF loaded with ${numPages} pages`);
      parsingLogger.logEvent("PDF loaded", { pages: numPages });
      updateProgress(30);
      
      // Step 3: Process images if needed, but skip for large files
      const shouldExtractImages = useImageExtraction && 
        (!SKIP_IMAGE_EXTRACTION_FOR_LARGE_FILES || fileSizeMB < 30);
      
      if (shouldExtractImages) {
        updateProgress(35);
        await new Promise(resolve => setTimeout(resolve, 50));
        
        try {
          await Promise.race([
            attemptExtractFirstPageImage(pdf),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Image extraction timed out")), 8000)) // Reduced from 10s to 8s
          ]);
        } catch (error) {
          console.log("Image extraction skipped or timed out:", error);
        }
        
        await new Promise(resolve => setTimeout(resolve, 50));
      } else {
        console.log("Skipping image extraction for better performance");
      }
      
      updateProgress(40);
      
      // Step 4: Extract text with dynamic page processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Determine how many pages to process based on document size and device capabilities
      // For large files, use reduced page limit
      const pagesToProcess = fileSizeMB > 30 
        ? Math.min(REDUCED_PAGE_LIMIT_FOR_LARGE_FILES, pdf.numPages)
        : determinePageCountForProcessing(pdf, (message) => {
            toast.info(message, { duration: 5000 });
          });
      
      let extractedText = "";
      try {
        extractedText = await extractTextInBatches(pdf, updateProgress, pagesToProcess);
        updateProgress(65);
      } catch (error) {
        console.error("Error in batch text extraction:", error);
        toast.warning("Text extraction incomplete. Using partial text.");
        // Continue with whatever text we extracted
      }
      
      // Step 5: Parse the extracted text with more UI yields
      await new Promise(resolve => setTimeout(resolve, 100));
      updateProgress(70);
      
      // Give the UI more time to update before heavy parsing
      await new Promise(resolve => setTimeout(resolve, 200));
      
      try {
        // For large files, set useAI to false to improve performance
        const shouldUseAI = fileSizeMB > 30 ? false : useAI;
        
        if (fileSizeMB > 30 && useAI) {
          toast.info("Disabling AI processing for better performance with this large file");
        }
        
        const parsedReport = await handleParsing(
          extractedText,
          uniqueReportId,
          file,
          shouldUseAI,
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
      } catch (parsingError) {
        console.error("Error during parsing:", parsingError);
        toast.warning("Parsing encountered issues, using basic text extraction");
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
