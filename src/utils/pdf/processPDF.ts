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

interface PDFJSLib {
  getDocument: (source: { data: Uint8Array }) => { promise: Promise<PDFDocumentProxy> };
  GlobalWorkerOptions: { workerSrc: string };
  version: string;
}

interface PDFDocumentProxy {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PDFPageProxy>;
}

interface PDFPageProxy {
  getTextContent: () => Promise<{ items: Array<{ str: string }> }>;
}

let pdfJsLoadingWarned = false;

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
    
    const uniqueReportId = setCurrentPDFData(file, { targetTable });
    console.log(`Set unique report ID: ${uniqueReportId}`);
    
    const { 
      clearProgressTracking, 
      completeProgressTracking, 
      handleProgressError,
      updateProgress,
      updateProgressStage
    } = setupProgressTracking({
      ...callbacks,
      slowDownProgress: true,
      onCompleteCallback
    });
    
    try {
      const pdfLoadingTimeout = setTimeout(() => {
        console.warn("PDF.js loading is taking longer than expected");
        toast.warning("PDF library is loading slowly. Please be patient.");
      }, 3000);
      
      const pdfjsLib = await Promise.race([
        import("pdfjs-dist").then(module => module as unknown as PDFJSLib).catch(error => {
          console.error("Error loading pdfjs-dist package:", error);
          throw new Error("Failed to load PDF processing library. Please check your network connection and try again.");
        }),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error("PDF library loading timed out. Please refresh the page and try again.")), 15000)
        )
      ]);
      
      clearTimeout(pdfLoadingTimeout);
      
      const workerVersion = pdfjsLib.version || '3.11.174';
      const workerUrls = [
        `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${workerVersion}/pdf.worker.min.js`,
        `https://unpkg.com/pdfjs-dist@${workerVersion}/build/pdf.worker.min.js`,
        `https://cdn.jsdelivr.net/npm/pdfjs-dist@${workerVersion}/build/pdf.worker.min.js`
      ];
      
      let workerSet = false;
      for (const workerUrl of workerUrls) {
        try {
          pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
          console.log(`Using PDF.js worker from: ${workerUrl}`);
          workerSet = true;
          break;
        } catch (workerError) {
          console.warn(`Failed to set worker from ${workerUrl}:`, workerError);
        }
      }
      
      if (!workerSet) {
        console.error("Could not set PDF.js worker from any source");
        throw new Error("Failed to load PDF processing components");
      }
      
      const fileReader = new FileReader();
      
      fileReader.onload = async function() {
        try {
          const typedarray = new Uint8Array(this.result as ArrayBuffer);
          
          try {
            console.log("Loading PDF document from array buffer");
            const loadPdfPromise = pdfjsLib.getDocument({ data: typedarray }).promise;
            
            const pdf = await Promise.race([
              loadPdfPromise,
              new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error("PDF document loading timed out")), 10000)
              )
            ]);
            
            const numPages = pdf.numPages;
            console.log(`PDF loaded with ${numPages} pages`);
            updateProgress(15);
            
            const extractedText = await extractTextFromPDF(pdf);
            console.log("Successfully extracted text from PDF, length:", extractedText.length);
            updateProgressStage('initialExtraction');
            
            try {
              const parsedReport = await parsePDFContent(extractedText, useAI);
              updateProgressStage('parsing');
              
              if (parsedReport) {
                parsedReport.reportId = uniqueReportId;
                parsedReport.fileName = file.name;
                parsedReport.rawText = extractedText;
                
                setExtractedReportData(parsedReport);
                
                (window as any).currentPdfData = {
                  reportId: uniqueReportId,
                  fileName: file.name,
                  extractedText: extractedText.substring(0, 1000)
                };
                
                onPDFUploaded(file, extractedText, parsedReport);
                
                updateProgressStage('tableExtraction');
                
                try {
                  if (!parsedReport.accountSummaries || parsedReport.accountSummaries.length === 0) {
                    console.log("No account summaries found in initial parsing, attempting additional extraction");
                    
                    const { extractEquifaxAccountSummaries } = await import("@/lib/parsers/equifax/equifaxAccountSummary");
                    if (parsedReport.bureau === 'Equifax') {
                      console.log("Extracting Equifax account summaries");
                      const accountSummaries = await extractEquifaxAccountSummaries(extractedText);
                      if (accountSummaries && accountSummaries.length > 0) {
                        parsedReport.accountSummaries = accountSummaries;
                      }
                    }
                  }
                  
                  updateProgressStage('finalProcessing');
                  
                  setTimeout(async () => {
                    try {
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
                      
                      setTimeout(() => {
                        completeProgressTracking();
                        toast.success("PDF successfully processed!");
                      }, 1500);
                    } catch (extractionError) {
                      console.error("Additional extraction error:", extractionError);
                      completeProgressTracking();
                    }
                  }, 2000);
                } catch (extractionError) {
                  console.error("Additional extraction error:", extractionError);
                  completeProgressTracking();
                }
              } else {
                updateProgressStage('finalProcessing');
                setTimeout(() => {
                  handleBasicProcessing(uniqueReportId, file, extractedText, targetTable, onPDFUploaded);
                  completeProgressTracking();
                }, 2000);
              }
            } catch (error) {
              console.error("Error parsing PDF content:", error);
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
      
      if (!pdfJsLoadingWarned) {
        toast.error("Failed to load PDF processing library. Please try refreshing the page or using a different browser.");
        pdfJsLoadingWarned = true;
      }
      
      callbacks.setUploadProgress(0);
      
      const basicText = `Filename: ${file.name}\nFile size: ${Math.round(file.size / 1024)} KB\nFile type: ${file.type}`;
      
      const errorMessage = error instanceof Error 
        ? `PDF library loading error: ${error.message}` 
        : "Failed to load PDF processing library. Please try refreshing the page.";
        
      if (onError) onError(new Error(errorMessage));
      
      handleBasicProcessing(uniqueReportId, file, basicText, targetTable, onPDFUploaded);
      
      setTimeout(() => {
        updateProgressStage('finalProcessing');
        setTimeout(() => {
          completeProgressTracking();
        }, 2000);
      }, 1500);
    }
  } catch (error) {
    console.error("Error in PDF processing:", error);
    toast.error("An error occurred while processing the PDF.");
    callbacks.setUploadProgress(0);
    if (onError) onError(error instanceof Error ? error : new Error("PDF processing failed"));
  }
};

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
  
  (window as any).currentPdfData = {
    reportId: reportId,
    fileName: file.name,
    extractedText: extractedText.substring(0, 1000)
  };
  
  setExtractedReportData(basicReport);
  
  setTimeout(() => {
    onPDFUploaded(file, extractedText, basicReport);
    toast.success("PDF processed with basic extraction");
  }, 2000);
}
