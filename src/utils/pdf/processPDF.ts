
import { toast } from "sonner";
import { extractTextFromPDF, setCurrentPDFData, setExtractedReportData } from "./extractText";
import { parsePDFContent } from "./parseExtractedText";
import { setupProgressTracking } from "./progressHandling";

interface PDFProcessingCallbacks {
  setCurrentFile: (file: File) => void;
  setUploadProgress: (value: number | ((prev: number) => number)) => void;
  onPDFUploaded: (file: File, text: string, parsedReport?: any) => void;
  useImageExtraction?: boolean;
  targetTable?: string; 
  onError?: (error: Error | null) => void;
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
    targetTable = "Credit Accounts",
    onError
  } = callbacks;
  
  try {
    setCurrentFile(file);
    console.log(`Processing PDF document with file: ${file.name}, targeting table: ${targetTable}`);
    
    // Store this file as the current PDF being processed with a unique ID
    const uniqueReportId = setCurrentPDFData(file, { targetTable });
    console.log(`Set unique report ID: ${uniqueReportId}`);
    
    // Setup progress tracking - but make it slower to match full processing time
    const { 
      clearProgressTracking, 
      completeProgressTracking, 
      handleProgressError,
      updateProgress
    } = setupProgressTracking({
      ...callbacks,
      slowDownProgress: true, // Signal to slow down progress updates
    });
    
    // Load the PDF.js library dynamically
    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = 
        `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
      
      // Read the PDF file
      const fileReader = new FileReader();
      
      fileReader.onload = async function() {
        try {
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
            updateProgress(30); // Slow down progress to match actual processing time
            
            try {
              // Parse the extracted text with the unique report ID
              console.log("Starting PDF content parsing...");
              const parsedReport = await parsePDFContent(extractedText, useAI);
              updateProgress(50); // Slow down progress to match actual processing time
              
              // Ensure the report has a unique ID and filename
              if (parsedReport) {
                parsedReport.reportId = uniqueReportId;
                parsedReport.fileName = file.name;
                parsedReport.rawText = extractedText; // Store the raw text for later use
                
                // Store this parsed data in our cache to prevent overriding with sample data
                setExtractedReportData(parsedReport);
                updateProgress(70); // Slow down progress to match actual processing time
                
                // Create a global reference to this PDF for better extraction
                (window as any).currentPdfData = {
                  reportId: uniqueReportId,
                  fileName: file.name,
                  extractedText: extractedText.substring(0, 1000) // Store preview
                };
                
                // Make sure all necessary extraction is performed before completing
                // Try to extract account tables and other data here instead of waiting until later
                try {
                  // Force account extraction if it wasn't done during parsing
                  if (!parsedReport.accountSummaries || parsedReport.accountSummaries.length === 0) {
                    console.log("No account summaries found in initial parsing, attempting additional extraction");
                    updateProgress(75);
                    
                    // Import only if needed to avoid circular dependencies
                    const { extractEquifaxAccountSummaries } = await import("@/lib/parsers/equifax/equifaxAccountSummary");
                    if (parsedReport.bureau === 'Equifax') {
                      console.log("Extracting Equifax account summaries");
                      const accountSummaries = await extractEquifaxAccountSummaries(extractedText);
                      if (accountSummaries && accountSummaries.length > 0) {
                        parsedReport.accountSummaries = accountSummaries;
                      }
                    }
                  }
                  
                  // Update progress to 85% to indicate we're almost done
                  updateProgress(85);
                  
                  // Longer delay to ensure account data is fully processed
                  setTimeout(async () => {
                    try {
                      // Attempt additional data extraction if needed
                      if (parsedReport.bureau === 'Equifax' && (!parsedReport.accountSummaries || parsedReport.accountSummaries.length === 0)) {
                        console.log("Final attempt at extracting account data");
                        
                        // Last attempt to extract account data
                        const { extractEquifaxAccountSummaries } = await import("@/lib/parsers/equifax/equifaxAccountSummary");
                        const accountSummaries = await extractEquifaxAccountSummaries(extractedText);
                        if (accountSummaries && accountSummaries.length > 0) {
                          parsedReport.accountSummaries = accountSummaries;
                          console.log("Successfully extracted account data in final attempt");
                        }
                      }
                      
                      // Slowly update to 95% as we're processing final data
                      updateProgress(95);
                      
                      // Additional delay before calling complete
                      setTimeout(() => {
                        // Complete processing and pass data to the parent before navigation
                        updateProgress(100);
                        console.log("PDF processing fully complete with all data extraction");
                        completeProgressTracking();
                        
                        // Pass the extracted text, file, and parsed report to the parent component
                        onPDFUploaded(file, extractedText, parsedReport);
                        
                        toast.success("PDF successfully processed!");
                      }, 1000);
                      
                    } catch (extractionError) {
                      console.error("Additional extraction error:", extractionError);
                      // Non-critical error, continue with what we have
                      updateProgress(100);
                      completeProgressTracking();
                      onPDFUploaded(file, extractedText, parsedReport);
                    }
                  }, 3000); // Longer delay to ensure data extraction completes
                  
                } catch (extractionError) {
                  console.error("Additional extraction error:", extractionError);
                  // Non-critical error, continue with what we have
                  updateProgress(100);
                  completeProgressTracking();
                  onPDFUploaded(file, extractedText, parsedReport);
                }
              } else {
                // If we don't have a parsed report, use basic processing
                updateProgress(90);
                setTimeout(() => {
                  updateProgress(100);
                  handleBasicProcessing(uniqueReportId, file, extractedText, targetTable, onPDFUploaded);
                  completeProgressTracking();
                }, 2000); // Longer delay to match expected processing time
              }
              
            } catch (error) {
              console.error("Error parsing PDF content:", error);
              // Fall back to basic processing
              updateProgress(90);
              
              setTimeout(() => {
                updateProgress(100);
                handleBasicProcessing(uniqueReportId, file, extractedText, targetTable, onPDFUploaded);
                completeProgressTracking();
              }, 2000); // Longer delay to match expected processing time
            }
            
          } catch (error) {
            console.error("Error processing PDF:", error);
            toast.error("Failed to process PDF. Please try another file.");
            clearProgressTracking();
            if (onError) onError(error instanceof Error ? error : new Error("PDF processing failed"));
          }
        } catch (error) {
          console.error("Error in FileReader onload handler:", error);
          handleProgressError(error);
          if (onError) onError(error instanceof Error ? error : new Error("Error processing PDF content"));
        }
      };

      fileReader.onerror = (event) => {
        const error = new Error("Error reading the PDF file");
        toast.error("Error reading the file.");
        handleProgressError(error);
        if (onError) onError(error);
      };

      fileReader.readAsArrayBuffer(file);
    } catch (error) {
      console.error("Error loading PDF library:", error);
      toast.error("Failed to load PDF processing library. Please try refreshing the page.");
      callbacks.setUploadProgress(0);
      if (onError) onError(error instanceof Error ? error : new Error("Failed to load PDF library"));
    }
  } catch (error) {
    console.error("Error in PDF processing:", error);
    toast.error("An error occurred while processing the PDF.");
    callbacks.setUploadProgress(0);
    if (onError) onError(error instanceof Error ? error : new Error("PDF processing failed"));
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
  (window as any).currentPdfData = {
    reportId: reportId,
    fileName: file.name,
    extractedText: extractedText.substring(0, 1000)
  };
  
  // Store this parsed data in our cache
  setExtractedReportData(basicReport);
  
  // Add delay before completing to ensure UI is fully updated
  setTimeout(() => {
    onPDFUploaded(file, extractedText, basicReport);
    toast.success("PDF processed with basic extraction");
  }, 2000); // Longer delay to match expected processing time
}
