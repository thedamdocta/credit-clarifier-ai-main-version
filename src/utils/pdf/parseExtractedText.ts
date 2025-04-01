
import { toast } from "sonner";
import { parseCreditReport } from "@/lib/creditReportParser";
// Import the table extraction utilities
import { extractTableFromImage, convertTableToAccountSummaries } from "@/lib/ai/tableExtraction";
import { extractCreditAccountsTableImage, resetCurrentReportImage } from "./extractText";

export const identifyDocumentPatterns = (extractedText: string) => {
  // Pre-process text to better identify account tables
  const lowercaseText = extractedText.toLowerCase();
  
  // Use regex patterns to identify document features
  const hasEquifaxPatterns = lowercaseText.includes('equifax credit report') || 
                             lowercaseText.includes('equifax credit file');
                             
  const hasExperianPatterns = lowercaseText.includes('experian credit report') ||
                              lowercaseText.includes('experian credit score');
                              
  const hasTransUnionPatterns = lowercaseText.includes('transunion credit report') ||
                                lowercaseText.includes('transunion credit file');
  
  // Detect account table patterns
  const hasAccountTable = lowercaseText.includes('account type') && 
                         (lowercaseText.includes('revolving') || 
                          lowercaseText.includes('installment') ||
                          lowercaseText.includes('mortgage'));
  
  // Return pattern analysis
  return {
    hasEquifaxPatterns,
    hasExperianPatterns,
    hasTransUnionPatterns,
    hasAccountTable
  };
};

// Function to extract account summaries using regex
// This is a fallback when image extraction fails
export const extractAccountSummariesWithRegex = (text: string) => {
  try {
    // Example regex patterns for account table rows
    const revolvingMatch = text.match(/revolving\s+(\d+)\s+(\d+)/i);
    const mortgageMatch = text.match(/mortgage\s+(\d+)\s+(\d+)/i);
    const installmentMatch = text.match(/installment\s+(\d+)\s+(\d+)/i);
    const totalMatch = text.match(/total\s+(\d+)\s+(\d+)/i);
    
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

// Create default account summaries when all extraction methods fail
export const createDefaultAccountSummaries = () => {
  // Return a complete set of empty account summaries in the required format
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

// Enhanced account summary extraction function that attempts multiple methods
export const improvedAccountSummaryExtraction = async (parsedReport: any, extractedText: string) => {
  try {
    // First attempt: Try to extract the table image
    console.log('Attempting to extract account summaries from image...');
    const tableImageUrl = await extractCreditAccountsTableImage(parsedReport);
    
    if (tableImageUrl) {
      const tableData = await extractTableFromImage(tableImageUrl);
      if (tableData) {
        const accountSummaries = convertTableToAccountSummaries(tableData);
        console.log('Successfully extracted account summaries from image:', accountSummaries);
        return accountSummaries;
      }
    }
    
    // Second attempt: Use regex on extracted text
    console.log('Falling back to regex extraction for account summaries...');
    const regexSummaries = extractAccountSummariesWithRegex(extractedText);
    
    if (regexSummaries.length > 0) {
      return regexSummaries;
    }
    
    // Final fallback: Create default empty summaries
    console.log('Creating default empty account summaries...');
    return createDefaultAccountSummaries();
  } catch (error) {
    console.error('Error in improved account summary extraction:', error);
    // Always return something valid, even if extraction completely fails
    return createDefaultAccountSummaries();
  }
};

// Enhanced analysis for Equifax reports
const enhanceEquifaxReport = async (parsedReport: any, extractedText: string) => {
  try {
    // We don't want to overwrite account summaries if they already have values
    // (including null values that will be displayed as "x")
    if (!parsedReport.accountSummaries || parsedReport.accountSummaries.length === 0) {
      try {
        // Attempt to extract the table image
        const tableImageUrl = await extractCreditAccountsTableImage(parsedReport);
        
        if (tableImageUrl) {
          const tableData = await extractTableFromImage(tableImageUrl);
          if (tableData) {
            parsedReport.accountSummaries = convertTableToAccountSummaries(tableData);
            console.log('Successfully extracted account summaries from image:', parsedReport.accountSummaries);
          } else {
            // Fall back to regex extraction if image analysis fails
            parsedReport.accountSummaries = extractAccountSummariesWithRegex(extractedText);
          }
        } else {
          // No image available, use regex extraction
          parsedReport.accountSummaries = extractAccountSummariesWithRegex(extractedText);
          
          // If regex also fails, use default empty summaries
          if (!parsedReport.accountSummaries || parsedReport.accountSummaries.length === 0) {
            parsedReport.accountSummaries = createDefaultAccountSummaries();
          }
        }
      } catch (error) {
        console.error("Error extracting account summaries:", error);
        // Always ensure we have account summaries
        parsedReport.accountSummaries = createDefaultAccountSummaries();
      }
    }
    
    // Additional Equifax-specific enhancements can be added here
    return parsedReport;
  } catch (error) {
    console.error('Error enhancing Equifax report:', error);
    return parsedReport;
  }
};

// Main parsing function that combines all aspects of credit report processing
export const parsePDFContent = async (extractedText: string, useAI: boolean = false) => {
  try {
    console.log('Parsing PDF content...');
    // Reset the current report image for each new PDF processing
    resetCurrentReportImage();
    
    if (!extractedText || extractedText.length < 100) {
      console.error('Extracted text is too short for parsing');
      toast.error('The PDF content could not be processed correctly');
      return null;
    }
    
    // Identify document patterns to determine bureau and other features
    const patterns = identifyDocumentPatterns(extractedText);
    console.log('Document patterns identified:', patterns);
    
    // Parse the basic credit report structure
    let parsedReport = await parseCreditReport(extractedText);
    console.log('Basic report parsing complete:', parsedReport?.bureau);
    
    if (!parsedReport) {
      console.error('Failed to parse credit report');
      toast.error('Unable to parse the credit report');
      return null;
    }
    
    // Store the raw text in the report
    parsedReport.rawText = extractedText;
    
    // Add a unique report ID for tracking
    if (!parsedReport.reportId) {
      parsedReport.reportId = `report-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }
    
    // Apply bureau-specific enhancements
    if (parsedReport.bureau === 'Equifax') {
      parsedReport = await enhanceEquifaxReport(parsedReport, extractedText);
    }
    // Add similar blocks for other bureaus if needed
    
    // Always ensure we have account summaries, no matter what
    if (!parsedReport.accountSummaries || parsedReport.accountSummaries.length === 0) {
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
