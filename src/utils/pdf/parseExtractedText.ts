import { toast } from "sonner";
import { parseCreditReport } from "@/lib/creditReportParser";
// Import the table extraction utilities
import { extractTableFromImage, convertTableToAccountSummaries } from "@/lib/ai/tableExtraction";
import { extractCreditAccountsTableImage, resetCurrentReportImage } from "./extractText";
import { devDiagnostics } from "@/lib/security/devDiagnostics";

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
    
    devDiagnostics.log("Regex extraction found matches:", {
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
    devDiagnostics.error('Error extracting account summaries with regex:', error);
    return [];
  }
};

// Create realistic sample data for testing/development 
export const createSampleAccountSummaries = () => {
  return [
    {
      accountType: 'Revolving',
      totalAccounts: 6,
      open: "5",
      withBalance: "3",
      closed: 1,
      balance: null,
      totalBalance: "$12,500",
      available: "$25,000",
      creditLimit: "$37,500",
      debtToCredit: "33.3%",
      payment: "$250"
    },
    {
      accountType: 'Mortgage',
      totalAccounts: 1,
      open: "1",
      withBalance: "1",
      closed: 0,
      balance: null,
      totalBalance: "$180,000",
      available: null,
      creditLimit: null,
      debtToCredit: null,
      payment: "$1,200"
    },
    {
      accountType: 'Installment',
      totalAccounts: 2,
      open: "2",
      withBalance: "2",
      closed: 0,
      balance: null,
      totalBalance: "$22,500",
      available: null,
      creditLimit: null,
      debtToCredit: null,
      payment: "$650"
    },
    {
      accountType: 'Other',
      totalAccounts: 0,
      open: "0",
      withBalance: "0",
      closed: 0,
      balance: null,
      totalBalance: "$0",
      available: null,
      creditLimit: null,
      debtToCredit: null,
      payment: "$0"
    },
    {
      accountType: 'Total',
      totalAccounts: 9,
      open: "8",
      withBalance: "6",
      closed: 1,
      balance: null,
      totalBalance: "$215,000",
      available: null,
      creditLimit: null,
      debtToCredit: null,
      payment: "$2,100"
    }
  ];
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
    devDiagnostics.log('Attempting to extract account summaries from image...');
    const tableImageUrl = await extractCreditAccountsTableImage(parsedReport);
    
    if (tableImageUrl) {
      devDiagnostics.log('Found table image URL for extraction:', tableImageUrl);
      const tableData = await extractTableFromImage(tableImageUrl);
      if (tableData) {
        const accountSummaries = convertTableToAccountSummaries(tableData);
        devDiagnostics.log('Successfully extracted account summaries from image:', accountSummaries);
        
        // If no real data was extracted (all null values), use sample data instead
        const hasRealData = accountSummaries.some(summary => 
          summary.open !== null || summary.withBalance !== null || summary.totalBalance !== null);
        
        if (hasRealData) {
          devDiagnostics.log('Using extracted data from image');
          return accountSummaries;
        } else {
          devDiagnostics.log('Extracted data had no real values, trying regex');
        }
      }
    } else {
      devDiagnostics.log('No table image found for extraction');
    }
    
    // Second attempt: Use regex on extracted text
    devDiagnostics.log('Falling back to regex extraction for account summaries...');
    const regexSummaries = extractAccountSummariesWithRegex(extractedText);
    
    // Check if regex extraction found any data
    const hasRegexData = regexSummaries.some(summary => 
      summary.open !== null || summary.withBalance !== null);
    
    if (hasRegexData) {
      devDiagnostics.log('Using account data from regex extraction');
      return regexSummaries;
    }
    
    // Third attempt: Determine if we need sample data for development or empty data for production
    if (process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost') {
      devDiagnostics.log('Development environment detected: using sample account summaries');
      return createSampleAccountSummaries();
    } else {
      devDiagnostics.log('Production environment: using empty account summaries');
      return createDefaultAccountSummaries();
    }
  } catch (error) {
    devDiagnostics.error('Error in improved account summary extraction:', error);
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
        parsedReport.accountSummaries = await improvedAccountSummaryExtraction(parsedReport, extractedText);
      } catch (error) {
        devDiagnostics.error("Error extracting account summaries:", error);
        // Always ensure we have account summaries
        parsedReport.accountSummaries = createDefaultAccountSummaries();
      }
    } else {
      devDiagnostics.log('Report already has account summaries, not overwriting');
    }
    
    // Additional Equifax-specific enhancements can be added here
    return parsedReport;
  } catch (error) {
    devDiagnostics.error('Error enhancing Equifax report:', error);
    return parsedReport;
  }
};

// Main parsing function that combines all aspects of credit report processing
export const parsePDFContent = async (extractedText: string, useEnhanced: boolean = false) => {
  try {
    devDiagnostics.log('Parsing PDF content...');
    // Reset the current report image for each new PDF processing
    resetCurrentReportImage();
    
    if (!extractedText || extractedText.length < 100) {
      devDiagnostics.error('Extracted text is too short for parsing');
      toast.error('The PDF content could not be processed correctly');
      return null;
    }
    
    // Identify document patterns to determine bureau and other features
    const patterns = identifyDocumentPatterns(extractedText);
    devDiagnostics.log('Document patterns identified:', patterns);
    
    // Parse the basic credit report structure
    let parsedReport = await parseCreditReport(extractedText);
    devDiagnostics.log('Basic report parsing complete:', parsedReport?.bureau);
    
    if (!parsedReport) {
      devDiagnostics.error('Failed to parse credit report');
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
      devDiagnostics.log('No account summaries found, creating default ones');
      parsedReport.accountSummaries = createDefaultAccountSummaries();
    }
    
    devDiagnostics.log('Enhanced parsing complete!');
    return parsedReport;
  } catch (error) {
    devDiagnostics.error('Error parsing PDF content:', error);
    toast.error('There was an error processing the PDF content');
    return null;
  }
};
