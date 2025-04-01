
import { toast } from "sonner";
import { extractTextFromPDF, setCurrentPDFData } from "./extractText";
import { parsePDFContent } from "./parseExtractedText";
import { setupProgressTracking } from "./progressHandling";
import { resetCurrentReportImage } from "./extractText";

interface PDFProcessingCallbacks {
  setCurrentFile: (file: File) => void;
  setUploadProgress: (value: number | ((prev: number) => number)) => void;
  onPDFUploaded: (file: File, text: string, parsedReport?: any) => void;
}

export const processPDFDocument = async (
  file: File,
  useAI: boolean,
  callbacks: PDFProcessingCallbacks
) => {
  const { setCurrentFile, onPDFUploaded } = callbacks;
  
  try {
    setCurrentFile(file);
    
    // Reset any cached image data from previous uploads
    resetCurrentReportImage();
    
    // Store this file as the current PDF being processed with a unique ID
    // This is important for image extraction later
    const uniqueReportId = setCurrentPDFData(file);
    console.log(`Processing PDF document with file: ${file.name}, report ID: ${uniqueReportId}`);
    
    // Setup progress tracking
    const { 
      clearProgressTracking, 
      completeProgressTracking, 
      handleProgressError 
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
        
        // Extract text from the PDF
        const extractedText = await extractTextFromPDF(pdf);
        
        try {
          // Parse the extracted text with the unique report ID
          const parsedReport = await parsePDFContent(extractedText, useAI);
          
          // Ensure the report has a unique ID and filename
          if (parsedReport) {
            parsedReport.reportId = uniqueReportId;
            parsedReport.fileName = file.name; // Store filename for reference
            
            // Create a global reference to this PDF for better extraction
            // This helps with finding the correct image data later
            window.currentPdfData = {
              reportId: uniqueReportId,
              fileName: file.name,
              extractedText: extractedText.substring(0, 1000) // Store preview
            };
          }
          
          completeProgressTracking();
          
          // Pass the extracted text, file, and parsed report to the parent component
          onPDFUploaded(file, extractedText, parsedReport);
          
          toast.success("PDF successfully processed!");
        } catch (error) {
          console.error("Error parsing PDF content:", error);
          // Fall back to basic processing
          const basicReport = { 
            reportId: uniqueReportId,
            fileName: file.name,
            rawText: extractedText
          };
          onPDFUploaded(file, extractedText, basicReport);
          toast.success("PDF processed with basic extraction");
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
