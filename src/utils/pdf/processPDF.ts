
import { toast } from "sonner";
import { extractTextFromPDF } from "./extractText";
import { parsePDFContent } from "./parseExtractedText";
import { setupProgressTracking } from "./progressHandling";

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
          // Parse the extracted text
          const parsedReport = await parsePDFContent(extractedText, useAI);
          
          completeProgressTracking();
          
          // Pass the extracted text, file, and parsed report to the parent component
          onPDFUploaded(file, extractedText, parsedReport);
          
          if (useAI) {
            toast.success("PDF successfully processed with AI analysis!");
          } else {
            toast.success("PDF successfully processed!");
          }
        } catch (error) {
          console.error("Error parsing PDF content:", error);
          // Fall back to basic processing
          onPDFUploaded(file, extractedText);
          toast.success("PDF processed (analysis unavailable)");
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

