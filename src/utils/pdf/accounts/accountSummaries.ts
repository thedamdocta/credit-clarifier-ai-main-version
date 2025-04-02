
import { AccountSummary } from "@/lib/types/creditReport";
import { extractTableFromImage, convertTableToAccountSummaries } from "@/lib/ai/tableExtraction";
import { extractCreditAccountsTableImage } from "../extractText";

/**
 * Extract account summaries from text with regex
 */
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

/**
 * Create default empty account summaries
 */
export const createDefaultAccountSummaries = (): AccountSummary[] => {
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

/**
 * Improved account summary extraction logic that combines image-based and regex-based approaches
 */
export const improvedAccountSummaryExtraction = async (parsedReport: any, extractedText: string) => {
  try {
    console.log('Attempting to extract account summaries from image...');
    const tableImageUrl = await extractCreditAccountsTableImage(parsedReport);
    
    if (tableImageUrl) {
      console.log('Found table image URL for extraction:', tableImageUrl);
      const tableData = await extractTableFromImage(tableImageUrl);
      if (tableData) {
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
    
    console.log('No real data found, using empty account summaries');
    return createDefaultAccountSummaries();
  } catch (error) {
    console.error('Error in improved account summary extraction:', error);
    return createDefaultAccountSummaries();
  }
};
