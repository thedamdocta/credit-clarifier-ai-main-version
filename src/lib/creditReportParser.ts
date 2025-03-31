
import { enhanceCreditReportWithAI, parseWithAI } from './ai';
import { CreditReport } from './types/creditReport';
import { identifyBureau } from './parsers/bureauIdentifier';
import { extractDate } from './parsers/dateParser';
import { extractPersonalInfo } from './parsers/personalInfoParser';
import { extractCreditScores } from './parsers/creditScoreParser';
import { extractAccounts } from './parsers/accountsParser';
import { parseEquifaxReport } from './parsers/equifax/equifaxParser';

export * from './types/creditReport';

export const parseCreditReport = async (text: string, useAIFirst = true): Promise<CreditReport> => {
  // Identify bureau first to determine parsing approach
  const bureau = identifyBureau(text);
  console.log(`Identified bureau: ${bureau}`);
  
  // If AI-first approach is enabled, try that first
  if (useAIFirst) {
    try {
      console.log("Using AI-first approach for parsing credit report...");
      
      // Get initial AI parsing results
      const aiResults = await parseWithAI(text);
      console.log("AI initial parsing complete");
      
      // Extract additional information using traditional methods
      const accounts = extractAccounts(text);
      const creditScores = extractCreditScores(text);
      
      // Initialize a combined report
      let combinedReport: CreditReport = {
        bureau: aiResults.bureau || bureau,
        reportDate: aiResults.reportDate || extractDate(text),
        personalInfo: aiResults.personalInfo || await extractPersonalInfo(text),
        accounts,
        inquiries: [],
        publicRecords: [],
        collections: [],
        creditScores,
        rawText: text
      };
      
      // Add bureau-specific processing
      if (bureau === 'Equifax') {
        const equifaxSpecific = await parseEquifaxReport(text);
        combinedReport = {
          ...combinedReport,
          ...equifaxSpecific
        };
      }
      
      console.log("AI-first parsing complete");
      return combinedReport;
    } catch (error) {
      console.error("Error in AI-first parsing approach:", error);
      console.log("Falling back to traditional parsing...");
    }
  }
  
  // Traditional parsing approach (used as fallback or if AI-first is disabled)
  const reportDate = extractDate(text);
  const personalInfo = await extractPersonalInfo(text);
  const accounts = extractAccounts(text);
  const creditScores = extractCreditScores(text);
  
  // Initialize report with basic information
  let initialReport: CreditReport = {
    bureau,
    reportDate,
    personalInfo,
    accounts,
    inquiries: [],
    publicRecords: [],
    collections: [],
    creditScores,
    rawText: text
  };
  
  // Add bureau-specific processing
  if (bureau === 'Equifax') {
    const equifaxSpecific = await parseEquifaxReport(text);
    initialReport = {
      ...initialReport,
      ...equifaxSpecific
    };
  }
  
  try {
    const enhancedReport = await enhanceCreditReportWithAI(text, initialReport);
    return enhancedReport;
  } catch (error) {
    console.error("Error enhancing report with AI:", error);
    return initialReport;
  }
};
