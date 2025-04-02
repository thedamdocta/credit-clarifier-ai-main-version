
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
  const { setCurrentFile, onPDFUploaded, useImageExtraction = true } = callbacks; // Enable image extraction by default
  
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
        parsingLogger.logEvent("PDF loaded", { pages: numPages });
        updateProgress(10);
        
        // Extract images if enabled (for later OCR processing)
        if (useImageExtraction) {
          try {
            console.log("Extracting images from PDF for OCR processing");
            // Store PDF data for later use in image extraction
            window.currentPdf = pdf;
            
            // Try to convert the first page to an image for better extraction
            const firstPageImage = await convertPDFPageToImage(pdf, 1);
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
          }
        }
        
        // Use standard text extraction for the main content
        const extractedText = await extractTextFromPDF(pdf);
        console.log("Successfully extracted text from PDF, length:", extractedText.length);
        updateProgress(60);
        
        try {
          // Parse the extracted text with the unique report ID
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
              parsingLogger.logEvent("PDF processing complete", { 
                reportId: uniqueReportId,
                bureau: parsedReport.bureau,
                accountSummaries: parsedReport.accountSummaries ? parsedReport.accountSummaries.length : 0
              });
            }, 500);
          } else {
            handleBasicProcessing(uniqueReportId, file, extractedText, onPDFUploaded);
            completeProgressTracking();
          }
          
        } catch (error) {
          console.error("Error parsing PDF content:", error);
          parsingLogger.logEvent("PDF parsing error", { error: String(error) });
          // Fall back to basic processing
          handleBasicProcessing(uniqueReportId, file, extractedText, onPDFUploaded);
          completeProgressTracking();
        }
        
      } catch (error) {
        console.error("Error processing PDF:", error);
        parsingLogger.logEvent("PDF processing error", { error: String(error) });
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
    parsingLogger.logEvent("PDF processing error", { error: String(error) });
    toast.error("An error occurred while processing the PDF.");
    callbacks.setUploadProgress(0);
  }
};

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

// Extract basic processing into a separate function for better readability
function handleBasicProcessing(reportId: string, file: File, extractedText: string, onPDFUploaded: (file: File, text: string, parsedReport?: any) => void) {
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
