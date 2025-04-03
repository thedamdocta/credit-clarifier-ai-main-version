import { toast } from "sonner";
import { extractTextFromPDF, setCurrentPDFData, setExtractedReportData } from "./extractText";
import { parsePDFContent } from "./parseExtractedText";
import { setupProgressTracking, ProgressCallbacks } from "./progressHandling";

interface PDFProcessingCallbacks extends ProgressCallbacks {
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
    onError,
    onCompleteCallback
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
      updateProgress,
      updateProgressStage
    } = setupProgressTracking({
      ...callbacks,
      slowDownProgress: true, // Signal to slow down progress updates
      onCompleteCallback // Pass through the completion callback
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
            updateProgress(15);
            
            // Use standard text extraction for the main content with table targeting
            const extractedText = await extractTextFromPDF(pdf);
            console.log("Successfully extracted text from PDF, length:", extractedText.length);
            updateProgressStage('initialExtraction'); // Update to 50%
            
            try {
              // Parse the extracted text with the unique report ID
              console.log("Starting PDF content parsing...");
              const parsedReport = await parsePDFContent(extractedText, useAI);
              updateProgressStage('parsing'); // Update to 70%
              
              // Ensure the report has a unique ID and filename
              if (parsedReport) {
                parsedReport.reportId = uniqueReportId;
                parsedReport.fileName = file.name;
                parsedReport.rawText = extractedText; // Store the raw text for later use
                
                // Store this parsed data in our cache to prevent overriding with sample data
                setExtractedReportData(parsedReport);
                
                // Create a global reference to this PDF for better extraction
                (window as any).currentPdfData = {
                  reportId: uniqueReportId,
                  fileName: file.name,
                  extractedText: extractedText.substring(0, 1000) // Store preview
                };
                
                // Provide the basic report data to the parent component
                // before continuing with additional extraction
                onPDFUploaded(file, extractedText, parsedReport);
                
                // Move to the table extraction stage
                updateProgressStage('tableExtraction'); // Update to 85%
                
                // Make sure all necessary extraction is performed before completing
                try {
                  // Force account extraction if it wasn't done during parsing
                  if (!parsedReport.accountSummaries || parsedReport.accountSummaries.length === 0) {
                    console.log("No account summaries found in initial parsing, attempting additional extraction");
                    
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
                  
                  // Update progress to indicate we're almost done
                  updateProgressStage('finalProcessing'); // Update to 95%
                  
                  // Ensure we spend enough time in the final stage for good UX
                  setTimeout(async () => {
                    try {
                      // Last attempt at extracting account data if still needed
                      if (parsedReport.bureau === 'Equifax' && 
                          (!parsedReport.accountSummaries || parsedReport.accountSummaries.length === 0)) {
                        console.log("Final attempt at extracting account data");
                        
                        const { extractEquifaxAccountSummaries } = await import("@/lib/parsers/equifax/equifaxAccountSummary");
                        const accountSummaries = await extractEquifaxAccountSummaries(extractedText);
                        if (accountSummaries && accountSummaries.length > 0) {
                          parsedReport.accountSummaries = accountSummaries;
                          console.log("Successfully extracted account data in final attempt");
                        }
                      }
                      
                      // Wait a bit to ensure all account extraction has time to complete
                      setTimeout(() => {
                        // Complete processing - this will trigger navigation
                        console.log("PDF processing fully complete with all data extraction");
                        completeProgressTracking(); // This will call onCompleteCallback
                        
                        toast.success("PDF successfully processed!");
                      }, 1500);
                      
                    } catch (extractionError) {
                      console.error("Additional extraction error:", extractionError);
                      // If extraction fails, still complete the process
                      completeProgressTracking();
                    }
                  }, 2000);
                  
                } catch (extractionError) {
                  console.error("Additional extraction error:", extractionError);
                  // If extraction fails, still complete the process
                  completeProgressTracking();
                }
              } else {
                // If we don't have a parsed report, use basic processing
                updateProgressStage('finalProcessing');
                setTimeout(() => {
                  handleBasicProcessing(uniqueReportId, file, extractedText, targetTable, onPDFUploaded);
                  completeProgressTracking();
                }, 2000);
              }
              
            } catch (error) {
              console.error("Error parsing PDF content:", error);
              // Fall back to basic processing
              updateProgressStage('finalProcessing');
              
              setTimeout(() => {
                handleBasicProcessing(uniqueReportId, file, extractedText, targetTable, onPDFUploaded);
                completeProgressTracking();
              }, 2000);
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
