
import { enhanceCreditReportWithAI, parseWithAI } from './ai';
import { extractReportSummaryWithAI } from './ai/summaryExtraction';
import { CreditReport } from './types/creditReport';
import { identifyBureau } from './parsers/bureauIdentifier';
import { extractDate } from './parsers/dateParser';
import { extractPersonalInfo } from './parsers/personalInfoParser';
import { extractCreditScores } from './parsers/creditScoreParser';
import { extractAccounts } from './parsers/accountsParser';
import { parseEquifaxReport } from './parsers/equifax/equifaxParser';
import { parsingLogger } from '@/utils/parsingLogger';

export * from './types/creditReport';

export const parseCreditReport = async (text: string, useAIFirst = true): Promise<CreditReport> => {
  const reportId = parsingLogger.startParsing();
  parsingLogger.logTextExtraction(text.length);
  
  try {
    // Identify bureau first to determine parsing approach
    const bureau = identifyBureau(text);
    parsingLogger.logBureauIdentification(bureau, 'traditional');
    console.log(`Identified bureau: ${bureau}`);
    
    // If AI-first approach is enabled, try that first
    if (useAIFirst) {
      try {
        console.log("Using AI-first approach for parsing credit report...");
        
        // Get initial AI parsing results
        const aiResults = await parseWithAI(text);
        
        // Get focused summary extraction
        const summaryData = await extractReportSummaryWithAI(text);
        parsingLogger.logSummaryExtraction(true, { 
          fieldsExtracted: Object.keys(summaryData).length 
        });
        
        // Extract personal information using AI
        const personalInfo = aiResults.personalInfo || await extractPersonalInfo(text);
        parsingLogger.logPersonalInfoExtraction(true, {
          nameFound: personalInfo.name !== 'Not Found',
          addressesFound: personalInfo.addresses.length
        });
        
        // Extract accounts and scores with traditional methods
        const accounts = extractAccounts(text);
        parsingLogger.logAccountsExtraction(accounts.length);
        
        const creditScores = extractCreditScores(text);
        parsingLogger.logCreditScoresExtraction(creditScores.length);
        
        // Initialize a combined report
        let combinedReport: CreditReport = {
          bureau: aiResults.bureau || bureau,
          reportDate: summaryData.reportDate || aiResults.reportDate || extractDate(text),
          personalInfo,
          accounts,
          inquiries: [],
          publicRecords: [],
          collections: [],
          creditScores,
          rawText: text,
          // Add summary data directly
          ...summaryData
        };
        
        // Add bureau-specific processing
        if (bureau === 'Equifax') {
          const equifaxSpecific = await parseEquifaxReport(text);
          combinedReport = {
            ...combinedReport,
            ...equifaxSpecific
          };
        }
        
        // Track the report in the logger
        parsingLogger.trackReport(combinedReport);
        
        parsingLogger.completeParsing();
        console.log("AI-first parsing complete");
        return combinedReport;
      } catch (error) {
        parsingLogger.logError('ai-parsing', error);
        console.error("Error in AI-first parsing approach:", error);
        console.log("Falling back to traditional parsing...");
      }
    }
    
    // Traditional parsing approach (used as fallback or if AI-first is disabled)
    const reportDate = extractDate(text);
    const personalInfo = await extractPersonalInfo(text);
    parsingLogger.logPersonalInfoExtraction(true, {
      nameFound: personalInfo.name !== 'Not Found',
      addressesFound: personalInfo.addresses.length
    });
    
    const accounts = extractAccounts(text);
    parsingLogger.logAccountsExtraction(accounts.length);
    
    const creditScores = extractCreditScores(text);
    parsingLogger.logCreditScoresExtraction(creditScores.length);
    
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
    
    // Track the report in the logger
    parsingLogger.trackReport(initialReport);
    
    try {
      const enhancedReport = await enhanceCreditReportWithAI(text, initialReport);
      parsingLogger.completeParsing();
      return enhancedReport;
    } catch (error) {
      parsingLogger.logError('report-enhancement', error);
      console.error("Error enhancing report with AI:", error);
      parsingLogger.completeParsing();
      return initialReport;
    }
  } catch (error) {
    parsingLogger.logError('parsing', error);
    console.error("Critical error in credit report parsing:", error);
    parsingLogger.completeParsing();
    
    // Return a minimal report with error information
    return {
      bureau: 'Unknown',
      reportDate: new Date().toLocaleDateString(),
      personalInfo: {
        name: 'Not Found',
        addresses: ['Not Found']
      },
      accounts: [],
      inquiries: [],
      publicRecords: [],
      collections: [],
      creditScores: [],
      rawText: text,
      parsingError: String(error)
    };
  }
};
