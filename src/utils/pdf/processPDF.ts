
// Main PDF processing orchestrator that coordinates the different modules
import { toast } from "sonner";
import { setupProgressTracking, ProgressCallbacks } from "./progressHandling";
import { parsingLogger } from "@/utils/parsingLogger";
import { CreditReport } from "@/lib/types/creditReport";
import { handleBasicProcessing, setCurrentPDFData } from "./core/reportHandling";
import { readFileAsArrayBuffer, loadPdfDocument } from "./core/pdfDocumentLoader";
import { extractTextInBatches, determinePageCountForProcessing } from "./core/textExtraction";
import { attemptExtractFirstPageImage } from "./core/imageExtraction";
import { handleParsing } from "./core/parsingHandler";

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
      updateProgress
    } = setupProgressTracking(callbacks);
    
    updateProgress(5);
    
    // Read file as array buffer
    const typedarray = await readFileAsArrayBuffer(file);
    updateProgress(20);
    
    // Load PDF document
    const pdf = await loadPdfDocument(typedarray);
    const numPages = pdf.numPages;
    console.log(`PDF loaded with ${numPages} pages`);
    parsingLogger.logEvent("PDF loaded", { pages: numPages });
    updateProgress(30);
    
    // Extract images if needed
    if (useImageExtraction) {
      updateProgress(35);
      try {
        await attemptExtractFirstPageImage(pdf);
      } catch (error) {
        console.log("Image extraction skipped:", error);
      }
    } else {
      console.log("Image extraction disabled");
    }
    
    updateProgress(40);
    
    // Extract text
    const pagesToProcess = determinePageCountForProcessing(pdf);
    let extractedText = await extractTextInBatches(pdf, updateProgress, pagesToProcess);
    updateProgress(65);
    
    // Parse the extracted text
    await new Promise(resolve => setTimeout(resolve, 100));
    updateProgress(70);
    
    try {
      const parsedReport = await handleParsing(
        extractedText,
        uniqueReportId,
        file,
        useAI,
        updateProgress
      );
      
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
    callbacks.setUploadProgress(0);
  }
};
