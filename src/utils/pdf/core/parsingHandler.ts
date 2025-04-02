
// Core parsing functionality for PDF content
import { toast } from "sonner";
import { parsePDFContent } from "../parseExtractedText";
import { CreditReport } from "@/lib/types/creditReport";
import { setExtractedReportData } from "../extractText";
import { parsingLogger } from "@/utils/parsingLogger";

// Function to handle PDF content parsing with worker-like processing
export async function handleParsing(
  extractedText: string,
  uniqueReportId: string, 
  file: File,
  useAI: boolean,
  updateProgress: (value: number) => void,
): Promise<CreditReport | null> {
  try {
    // Yield control before parsing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    updateProgress(70);
    
    // Add toast to indicate parsing has started
    toast.info("Analyzing credit data...", { duration: 5000 });
    
    // Parse the extracted text with the unique report ID
    // but don't let it block UI for too long
    const parsePromise = async () => {
      try {
        // Wrap in a worker-like structure using setTimeout to prevent UI blocking
        return await new Promise<CreditReport | null>((resolve) => {
          // Use setTimeout to move parsing off the main thread
          setTimeout(async () => {
            try {
              const result = await parsePDFContent(extractedText, useAI);
              resolve(result);
            } catch (parseError) {
              console.error("Error in parse promise:", parseError);
              resolve(null);
            }
          }, 10); // Very small timeout, just to get off the main thread
        });
      } catch (error) {
        console.error("Parsing error:", error);
        throw error;
      }
    };
    
    // Wait for parsing with a longer timeout - this is where most freezes happen
    const parsedReport = await Promise.race([
      parsePromise(),
      new Promise<CreditReport | null>((resolve) => 
        setTimeout(() => {
          console.log("Parsing taking too long, continuing with basic data");
          resolve(null);
        }, 40000) // 40 second timeout
      )
    ]);
    
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
      if (window) {
        window.currentPdfData = {
          reportId: uniqueReportId,
          fileName: file.name,
          extractedText: extractedText.substring(0, 1000) // Store preview
        };
      }
      
      // Log successful parsing
      parsingLogger.logEvent("PDF processing complete", { 
        reportId: uniqueReportId,
        bureau: parsedReport.bureau,
        accountSummaries: parsedReport.accountSummaries ? parsedReport.accountSummaries.length : 0
      });
    }
    
    return parsedReport;
  } catch (error) {
    console.error("Error parsing PDF content:", error);
    parsingLogger.logEvent("PDF parsing error", { error: String(error) });
    return null;
  }
}
