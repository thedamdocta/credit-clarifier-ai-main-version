
import { toast } from "sonner";
import { parseCreditReport } from "@/lib/creditReportParser";
import { extractTableFromImage, convertTableToAccountSummaries } from "@/lib/ai/tableExtraction";
import { extractCreditAccountsTableImage, resetCurrentReportImage } from "./extractText";

export const identifyDocumentPatterns = (extractedText: string) => {
  const lowercaseText = extractedText.toLowerCase();
  
  const hasEquifaxPatterns = lowercaseText.includes('equifax credit report') || 
                             lowercaseText.includes('equifax credit file');
                             
  const hasExperianPatterns = lowercaseText.includes('experian credit report') ||
                              lowercaseText.includes('experian credit score');
                              
  const hasTransUnionPatterns = lowercaseText.includes('transunion credit report') ||
                                lowercaseText.includes('transunion credit file');
  
  const hasAccountTable = lowercaseText.includes('account type') && 
                         (lowercaseText.includes('revolving') || 
                          lowercaseText.includes('installment') ||
                          lowercaseText.includes('mortgage'));
  
  return {
    hasEquifaxPatterns,
    hasExperianPatterns,
    hasTransUnionPatterns,
    hasAccountTable
  };
};

export const extractAccountSummariesWithRegex = (text: string) => {
  try {
    const revolvingMatch = text.match(/revolving\s+(\d+)\s+(\d+)/i);
    const mortgageMatch = text.match(/mortgage\s+(\d+)\s+(\d+)/i);
    const installmentMatch = text.match(/installment\s+(\d+)\s+(\d+)/i);
    const totalMatch = text.match(/total\s+(\d+)\s+(\d+)/i);
    
    console.log("Regex extraction found matches:", {
      revolvingMatch: revolvingMatch ? true : false,
      mortgageMatch: mortgageMatch ? true : false,
      installmentMatch: installmentMatch ? true : false,
      totalMatch: totalMatch ? true : false
    });
    
    const accountSummaries = [
      {
        accountType: 'Revolving',
        totalAccounts: null,
        open: revolvingMatch ? revolvingMatch[1] : null,
        withBalance: revolvingMatch ? revolvingMatch[2] : null,
        closed: null,
        balance: null,
        totalBalance: null,
        available: null,
        creditLimit: null,
        debtToCredit: null,
        payment: null
      },
      {
        accountType: 'Mortgage',
        totalAccounts: null,
        open: mortgageMatch ? mortgageMatch[1] : null,
        withBalance: mortgageMatch ? mortgageMatch[2] : null,
        closed: null,
        balance: null,
        totalBalance: null,
        available: null,
        creditLimit: null,
        debtToCredit: null,
        payment: null
      },
      {
        accountType: 'Installment',
        totalAccounts: null,
        open: installmentMatch ? installmentMatch[1] : null,
        withBalance: installmentMatch ? installmentMatch[2] : null,
        closed: null,
        balance: null,
        totalBalance: null,
        available: null,
        creditLimit: null,
        debtToCredit: null,
        payment: null
      },
      {
        accountType: 'Other',
        totalAccounts: null,
        open: null,
        withBalance: null,
        closed: null,
        balance: null,
        totalBalance: null,
        available: null,
        creditLimit: null,
        debtToCredit: null,
        payment: null
      },
      {
        accountType: 'Total',
        totalAccounts: null,
        open: totalMatch ? totalMatch[1] : null,
        withBalance: totalMatch ? totalMatch[2] : null,
        closed: null,
        balance: null,
        totalBalance: null,
        available: null,
        creditLimit: null,
        debtToCredit: null,
        payment: null
      }
    ];
    
    return accountSummaries;
  } catch (error) {
    console.error('Error extracting account summaries with regex:', error);
    return [];
  }
};

export const createDefaultAccountSummaries = () => {
  return [
    {
      accountType: 'Revolving',
      totalAccounts: null,
      open: null,
      withBalance: null,
      closed: null,
      balance: null,
      totalBalance: null,
      available: null,
      creditLimit: null,
      debtToCredit: null,
      payment: null
    },
    {
      accountType: 'Mortgage',
      totalAccounts: null,
      open: null,
      withBalance: null,
      closed: null,
      balance: null,
      totalBalance: null,
      available: null,
      creditLimit: null,
      debtToCredit: null,
      payment: null
    },
    {
      accountType: 'Installment',
      totalAccounts: null,
      open: null,
      withBalance: null,
      closed: null,
      balance: null,
      totalBalance: null,
      available: null,
      creditLimit: null,
      debtToCredit: null,
      payment: null
    },
    {
      accountType: 'Other',
      totalAccounts: null,
      open: null,
      withBalance: null,
      closed: null,
      balance: null,
      totalBalance: null,
      available: null,
      creditLimit: null,
      debtToCredit: null,
      payment: null
    },
    {
      accountType: 'Total',
      totalAccounts: null,
      open: null,
      withBalance: null,
      closed: null,
      balance: null,
      totalBalance: null,
      available: null,
      creditLimit: null,
      debtToCredit: null,
      payment: null
    }
  ];
};

export const improvedAccountSummaryExtraction = async (parsedReport: any, extractedText: string) => {
  try {
    console.log('Attempting to extract account summaries from image...');
    const tableImageUrl = await extractCreditAccountsTableImage(parsedReport);
    
    if (tableImageUrl) {
      console.log('Found table image URL for extraction:', tableImageUrl);
      const tableData = await extractTableFromImage(tableImageUrl);
      if (tableData && tableData.rows) {
        const accountSummaries = convertTableToAccountSummaries(tableData);
        console.log('Successfully extracted account summaries from image:', accountSummaries);
        
        const hasRealData = accountSummaries.some(summary => 
          summary.open !== null || summary.withBalance !== null || summary.totalBalance !== null);
        
        if (hasRealData) {
          console.log('Using extracted data from image');
          return accountSummaries;
        } else {
          console.log('Extracted data had no real values, trying regex');
        }
      }
    } else {
      console.log('No table image found for extraction');
    }
    
    console.log('Falling back to regex extraction for account summaries...');
    const regexSummaries = extractAccountSummariesWithRegex(extractedText);
    
    const hasRegexData = regexSummaries.some(summary => 
      summary.open !== null || summary.withBalance !== null);
    
    if (hasRegexData) {
      console.log('Using account data from regex extraction');
      return regexSummaries;
    }
    
    console.log('No account data could be extracted, using empty summaries');
    return createDefaultAccountSummaries();
  } catch (error) {
    console.error('Error in improved account summary extraction:', error);
    return createDefaultAccountSummaries();
  }
};

const enhanceEquifaxReport = async (parsedReport: any, extractedText: string) => {
  try {
    if (!parsedReport.accountSummaries || parsedReport.accountSummaries.length === 0) {
      try {
        parsedReport.accountSummaries = await improvedAccountSummaryExtraction(parsedReport, extractedText);
      } catch (error) {
        console.error("Error extracting account summaries:", error);
        parsedReport.accountSummaries = createDefaultAccountSummaries();
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

export const parsePDFContent = async (extractedText: string, useEnhanced: boolean = false) => {
  try {
    console.log('Parsing PDF content...');
    resetCurrentReportImage();
    
    if (!extractedText || extractedText.length < 100) {
      console.error('Extracted text is too short for parsing');
      toast.error('The PDF content could not be processed correctly');
      return null;
    }
    
    const patterns = identifyDocumentPatterns(extractedText);
    console.log('Document patterns identified:', patterns);
    
    let parsedReport = await parseCreditReport(extractedText);
    console.log('Basic report parsing complete:', parsedReport?.bureau);
    
    if (!parsedReport) {
      console.error('Failed to parse credit report');
      toast.error('Unable to parse the credit report');
      return null;
    }
    
    parsedReport.rawText = extractedText;
    
    if (!parsedReport.reportId) {
      parsedReport.reportId = `report-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }
    
    if (parsedReport.bureau === 'Equifax') {
      parsedReport = await enhanceEquifaxReport(parsedReport, extractedText);
    }
    
    if (!parsedReport.accountSummaries || parsedReport.accountSummaries.length === 0) {
      console.log('No account summaries found, creating default ones');
      parsedReport.accountSummaries = createDefaultAccountSummaries();
    }
    
    console.log('Enhanced parsing complete!');
    return parsedReport;
  } catch (error) {
    console.error('Error parsing PDF content:', error);
    toast.error('There was an error processing the PDF content');
    return null;
  }
};
