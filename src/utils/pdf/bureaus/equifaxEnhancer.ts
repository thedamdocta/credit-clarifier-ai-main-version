
import { improvedAccountSummaryExtraction } from "../accounts/accountSummaries";
import { resetCurrentReportImage } from "../extractText";

/**
 * Enhance Equifax report with additional data extraction
 */
export const enhanceEquifaxReport = async (parsedReport: any, extractedText: string) => {
  try {
    if (!parsedReport.accountSummaries || parsedReport.accountSummaries.length === 0) {
      try {
        parsedReport.accountSummaries = await improvedAccountSummaryExtraction(parsedReport, extractedText);
      } catch (error) {
        console.error("Error extracting account summaries:", error);
        // Account summaries will be added by the main parser if this fails
      }
    } else {
      console.log('Report already has account summaries, not overwriting');
    }
    
    return parsedReport;
  } catch (error) {
    console.error('Error enhancing Equifax report:', error);
    return parsedReport;
  }
};
