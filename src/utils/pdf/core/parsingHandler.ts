
// Core parsing functionality for PDF content
import { toast } from "sonner";
import { parsePDFContent } from "../parseExtractedText";
import { CreditReport } from "@/lib/types/creditReport";
import { setExtractedReportData } from "../extractText";
import { parsingLogger } from "@/utils/parsingLogger";
import { createDefaultAccountSummaries } from "../accounts/accountSummaries";

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
    
    // For extremely large text, truncate it to prevent browser freezing
    let textToProcess = extractedText;
    if (textToProcess.length > 300000) { // ~300KB
      console.log(`Text is very large (${textToProcess.length} chars), truncating for processing`);
      textToProcess = textToProcess.substring(0, 300000);
      toast.warning("Document was very large, analyzing first portion only", { duration: 5000 });
    }
    
    // Parse the extracted text with a shorter timeout
    const parsePromise = async () => {
      try {
        return await parsePDFContent(textToProcess, useAI);
      } catch (parseError) {
        console.error("Error in parse promise:", parseError);
        return null;
      }
    };
    
    // Use a timeout for parsing to prevent UI freezing
    const parsedReport = await Promise.race([
      parsePromise(),
      new Promise<CreditReport | null>((resolve) => 
        setTimeout(() => {
          console.log("Parsing taking too long, continuing with basic data");
          resolve(null);
        }, 25000) // 25s timeout
      )
    ]);
    
    updateProgress(80);
    
    // Yield control to UI
    await new Promise(resolve => setTimeout(resolve, 50));
    
    if (parsedReport) {
      // Ensure required properties exist before accessing them
      parsedReport.reportId = uniqueReportId;
      parsedReport.fileName = file.name;
      
      // Store only a reasonable amount of raw text to prevent memory issues
      if (extractedText && extractedText.length > 500000) { // ~500KB
        parsedReport.rawText = extractedText.substring(0, 500000) + 
          "\n[Text truncated due to size limitations]";
      } else {
        parsedReport.rawText = extractedText;
      }
      
      // Make sure accountSummaries exists to prevent errors
      if (!parsedReport.accountSummaries) {
        parsedReport.accountSummaries = createDefaultAccountSummaries();
      }
      
      // Store this parsed data in our cache to prevent overriding with sample data
      setExtractedReportData(parsedReport);
      
      // Create a global reference to this PDF for better extraction
      if (window) {
        window.currentPdfData = {
          reportId: uniqueReportId,
          fileName: file.name,
          // Only store a preview of text to reduce memory usage
          extractedText: extractedText.substring(0, 500) 
        };
      }
      
      // Log successful parsing with safe access to accountSummaries
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
