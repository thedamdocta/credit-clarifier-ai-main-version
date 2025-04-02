
import { toast } from "sonner";
import { extractTextFromPDF, setCurrentPDFData, setExtractedReportData } from "./extractText";
import { parsePDFContent } from "./parseExtractedText";
import { setupProgressTracking } from "./progressHandling";
import { convertPDFPageToImage } from "./pdfToImage";
import { parsingLogger } from "@/utils/parsingLogger";

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
    console.log(`Set unique report ID: ${uniqueReportId}`);
    
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
    
    // Dynamically load PDF.js library
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = 
      `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    
    updateProgress(10);
    
    // Wrap file reading in a Promise with a small delay to prevent UI freezing
    const readFilePromise = async () => {
      await new Promise(resolve => setTimeout(resolve, 50)); // Yield to UI
      return readFileAsArrayBuffer(file);
    };
    
    const typedarray = await readFilePromise();
    updateProgress(20);
    
    try {
      // Add another delay to prevent UI freezing before heavy PDF parsing
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Wrap the PDF loading in a promise with a timeout
      const loadPdfPromise = async () => {
        try {
          return await Promise.race([
            pdfjsLib.getDocument({ data: typedarray }).promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error("PDF loading timeout")), 30000)) // 30s timeout
          ]);
        } catch (error) {
          console.error("Error loading PDF:", error);
          throw error;
        }
      };
      
      const pdf = await loadPdfPromise();
      const numPages = pdf.numPages;
      console.log(`PDF loaded with ${numPages} pages`);
      parsingLogger.logEvent("PDF loaded", { pages: numPages });
      updateProgress(30);
      
      // Extract images in a separate chunk to prevent UI freezing
      if (useImageExtraction) {
        try {
          // Yield control back to browser before image extraction
          await new Promise(resolve => setTimeout(resolve, 50));
          console.log("Extracting images from PDF for OCR processing");
          
          // Store PDF data for later use in image extraction
          window.currentPdf = pdf;
          
          // Try to convert the first page to an image but don't block
          // if it takes too long
          updateProgress(35);
          
          const imageExtractionPromise = async () => {
            try {
              return await Promise.race([
                convertPDFPageToImage(pdf, 1),
                new Promise(resolve => setTimeout(() => {
                  console.log("Image extraction taking too long, continuing process");
                  resolve(null);
                }, 10000)) // 10s timeout for image extraction
              ]);
            } catch (error) {
              console.error("Image extraction error:", error);
              return null;
            }
          };
          
          const firstPageImage = await imageExtractionPromise();
          updateProgress(40);
          
          if (firstPageImage) {
            console.log("Successfully extracted first page as image");
            parsingLogger.logEvent("PDF first page extracted as image", { 
              imageLength: firstPageImage.length,
              preview: firstPageImage.substring(0, 50) + '...'
            });
            
            // Store image data for later use
            window.currentPdfPageImages = [firstPageImage];
          }
        } catch (error) {
          console.error("Error extracting images from PDF:", error);
          // Continue without images - non-critical error
        }
      }
      
      // Extract text in a separate process chunk
      await new Promise(resolve => setTimeout(resolve, 50)); // Yield to UI
      updateProgress(45);
      
      // Wrap text extraction in a promise with timeout
      const extractTextPromise = async () => {
        try {
          return await Promise.race([
            extractTextFromPDF(pdf),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Text extraction timeout")), 60000)) // 60s timeout
          ]);
        } catch (error) {
          console.error("Text extraction error:", error);
          throw error;
        }
      };
      
      const extractedText = await extractTextPromise();
      console.log("Successfully extracted text from PDF, length:", extractedText.length);
      updateProgress(60);
      
      // Yield control before parsing
      await new Promise(resolve => setTimeout(resolve, 50));
      
      try {
        // Parse the extracted text with the unique report ID
        // but don't let it block UI for too long
        const parsePromise = async () => {
          try {
            return await Promise.race([
              parsePDFContent(extractedText, useAI),
              new Promise((_, reject) => setTimeout(() => reject(new Error("Parsing timeout")), 30000)) // 30s timeout
            ]);
          } catch (error) {
            console.error("Parsing error:", error);
            throw error;
          }
        };
        
        const parsedReport = await parsePromise();
        updateProgress(80);
        
        // Yield control to UI
        await new Promise(resolve => setTimeout(resolve, 50));
        
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
          
          // Final UI yield before completion
          await new Promise(resolve => setTimeout(resolve, 50));
          updateProgress(95);
          
          // Complete processing
          completeProgressTracking();
          
          // Pass the extracted text, file, and parsed report to the parent component
          onPDFUploaded(file, extractedText, parsedReport);
          
          toast.success("PDF successfully processed!");
          parsingLogger.logEvent("PDF processing complete", { 
            reportId: uniqueReportId,
            bureau: parsedReport.bureau,
            accountSummaries: parsedReport.accountSummaries ? parsedReport.accountSummaries.length : 0
          });
        } else {
          await handleBasicProcessing(uniqueReportId, file, extractedText, onPDFUploaded);
          completeProgressTracking();
        }
        
      } catch (error) {
        console.error("Error parsing PDF content:", error);
        parsingLogger.logEvent("PDF parsing error", { error: String(error) });
        // Fall back to basic processing
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

// Helper function to read file as ArrayBuffer with Promise - with improved error handling
async function readFileAsArrayBuffer(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    
    // Add timeout to prevent freezing on large files
    const timeout = setTimeout(() => {
      fileReader.abort();
      reject(new Error("File reading timed out - file may be too large"));
    }, 30000); // 30 second timeout
    
    fileReader.onload = function() {
      clearTimeout(timeout);
      resolve(new Uint8Array(this.result as ArrayBuffer));
    };
    
    fileReader.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("Error reading the file."));
    };
    
    fileReader.readAsArrayBuffer(file);
  });
}

// Extract basic processing into a separate function for better readability
async function handleBasicProcessing(
  reportId: string, 
  file: File, 
  extractedText: string, 
  onPDFUploaded: (file: File, text: string, parsedReport?: any) => void
) {
  // Add small delay to prevent UI freezing
  await new Promise(resolve => setTimeout(resolve, 50));
  
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

// Extract OCR using Tesseract - this is kept for the credit account extraction specifically
// but not used in the main PDF processing flow
async function extractTextFromImage(imageData: string): Promise<string | null> {
  try {
    const Tesseract = (await import('tesseract.js')).default;
    console.log("Using Tesseract.js for OCR");
    
    const worker = await Tesseract.createWorker({
      logger: m => console.log(`Tesseract progress: ${m.progress} - ${m.status}`),
    });
    
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    
    // Set page segmentation mode for better recognition of tables and structured text
    await worker.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM.AUTO_OSD, // Auto detect orientation
      preserve_interword_spaces: '1', // Preserve spaces between words
      tessedit_char_whitelist: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$,.-% ', // Limit to relevant characters
    });
    
    const result = await worker.recognize(imageData);
    console.log("Tesseract confidence:", result.data.confidence);
    
    await worker.terminate();
    return result.data.text;
  } catch (error) {
    console.error("OCR extraction error:", error);
    return null;
  }
}
