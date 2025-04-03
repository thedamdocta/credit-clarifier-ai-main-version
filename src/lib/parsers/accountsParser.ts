
import { Account } from "../types/creditReport";

export const extractAccounts = (text: string): Account[] => {
  const accounts: Account[] = [];
  
  // Log the start of account extraction for debugging
  console.log("Starting detailed account extraction from text");
  
  // Find account sections using headings
  const accountSectionRegex = /\d+\.?\d*\s+([A-Za-z\s\/.,&]+(?:BANK|CREDIT|CARD|LOAN|MORTGAGE|FINANCE|SERVICES|LLC|INC|CORP|AMERICA|EXPRESS|DISCOVER|CAPITAL|ONE|N\.A\.|CHASE))(?:\s*\(.*?\))?/g;
  let match;
  let accountSections = [];
  
  // Find all potential account sections with their starting positions
  while ((match = accountSectionRegex.exec(text)) !== null) {
    accountSections.push({
      name: match[1].trim(),
      startPos: match.index,
      text: ""
    });
  }
  
  // Determine the text for each account section (until the next account section)
  for (let i = 0; i < accountSections.length; i++) {
    const currentSection = accountSections[i];
    const nextSection = accountSections[i + 1];
    
    if (nextSection) {
      currentSection.text = text.substring(currentSection.startPos, nextSection.startPos);
    } else {
      // For the last section, include text until potential end markers
      const endMarkerRegex = /(?:other items|summary of|consumer statement|public records|end of report|inquiries|collections)/i;
      const endMarkerMatch = text.substring(currentSection.startPos).match(endMarkerRegex);
      
      if (endMarkerMatch) {
        const endPos = currentSection.startPos + endMarkerMatch.index;
        currentSection.text = text.substring(currentSection.startPos, endPos);
      } else {
        // If no end marker found, take a reasonable chunk
        currentSection.text = text.substring(currentSection.startPos, currentSection.startPos + 5000);
      }
    }
  }
  
  console.log(`Found ${accountSections.length} potential account sections`);
  
  // Process each account section
  accountSections.forEach((section, index) => {
    const accountText = section.text;
    
    // Basic account information
    const accountName = section.name;
    
    // Extract account number
    let accountNumber = '';
    const numberMatch = accountText.match(/account\s*(?:\#|number):?\s*([*x\dX-]+)/i) || 
                       accountText.match(/([*x]{4,}[-\s]?\d{4})/);
    if (numberMatch && numberMatch[1]) {
      accountNumber = numberMatch[1].trim();
    }
    
    // Extract account type
    let accountType = '';
    const typeMatch = accountText.match(/account\s+type:?\s*([A-Za-z\s]+)/i) ||
                     accountText.match(/type:?\s*([A-Za-z\s]+)/i) ||
                     accountText.match(/(credit card|mortgage|auto loan|student loan|personal loan|revolving|installment)/i);
    if (typeMatch && typeMatch[1]) {
      accountType = typeMatch[1].trim();
    }
    
    // Extract open date
    let openDate = '';
    const openMatch = accountText.match(/(?:date\s+opened|open(?:ed)?\s*(?:date|on)):?\s*(\d{1,2}\/\d{1,2}\/\d{2,4}|[A-Za-z]+\s+\d{1,2},?\s*\d{2,4})/i);
    if (openMatch && openMatch[1]) {
      openDate = openMatch[1].trim();
    }
    
    // Extract account status
    let status = '';
    const statusMatch = accountText.match(/(?:account\s+)?status:?\s*([A-Za-z\s_]+)/i) ||
                       accountText.match(/(open|closed|paid|charged off|pays_as_agreed)/i);
    if (statusMatch && statusMatch[1]) {
      status = statusMatch[1].trim();
      // Clean up some common status formats
      status = status.replace(/_/g, ' ').replace(/pays as agreed/i, 'PAYS AS AGREED');
    }
    
    // Extract balance
    let balance = null;
    const balanceMatch = accountText.match(/(?:reported\s+)?balance:?\s*\$?([\d,.]+)/i) ||
                        accountText.match(/(?:current|outstanding)\s*balance:?\s*\$?([\d,.]+)/i);
    if (balanceMatch && balanceMatch[1]) {
      balance = `$${balanceMatch[1].trim()}`;
    }
    
    // Extract credit limit
    let creditLimit = null;
    const limitMatch = accountText.match(/(?:credit\s+)?limit:?\s*\$?([\d,.]+)/i);
    if (limitMatch && limitMatch[1]) {
      creditLimit = `$${limitMatch[1].trim()}`;
    }
    
    // Extract available credit
    let availableCredit = null;
    const availableMatch = accountText.match(/available\s+credit:?\s*\$?([\d,.]+)/i);
    if (availableMatch && availableMatch[1]) {
      availableCredit = `$${availableMatch[1].trim()}`;
    }
    
    // Extract high credit
    let highCredit = null;
    const highCreditMatch = accountText.match(/high\s+credit:?\s*\$?([\d,.]+)/i);
    if (highCreditMatch && highCreditMatch[1]) {
      highCredit = `$${highCreditMatch[1].trim()}`;
    }
    
    // Extract payment history data
    const paymentHistory: string[] = [];
    const paymentHistoryMatch = accountText.match(/payment\s+history.*?(\d{1,2}\/\d{1,2}\/\d{2,4}|[A-Za-z]+\s+\d{4}).*?/is);
    if (paymentHistoryMatch) {
      const paymentHistorySection = paymentHistoryMatch[0];
      const paymentEntries = paymentHistorySection.match(/\d{1,2}\/\d{1,2}\/\d{2,4}|[A-Za-z]+\s+\d{4}/g);
      if (paymentEntries) {
        paymentHistory.push(...paymentEntries);
      }
    }
    
    // Extract activity designator
    let activityDesignator = null;
    const activityMatch = accountText.match(/activity\s+designator:?\s*([A-Za-z_\s]+)/i);
    if (activityMatch && activityMatch[1]) {
      activityDesignator = activityMatch[1].trim().replace(/_/g, ' ');
    }
    
    // Extract comments
    const comments: string[] = [];
    if (accountText.includes('Comments:') || accountText.includes('Comment:')) {
      const commentsMatch = accountText.match(/comments?:?\s*(.*?)(?=contact:|$)/is);
      if (commentsMatch && commentsMatch[1]) {
        const commentText = commentsMatch[1].trim();
        const commentLines = commentText.split(/\n/).map(line => line.trim()).filter(line => line);
        comments.push(...commentLines);
      }
    }
    
    // Extract contact information
    let contactInfo = null;
    const contactMatch = accountText.match(/contact:?\s*(.*?)\s*(?=\d+\.\d+|$)/is);
    if (contactMatch && contactMatch[1]) {
      const contactText = contactMatch[1].trim();
      
      // Extract name (usually the first line)
      let name = contactText.split(/\n/)[0].trim();
      
      // Extract address
      let address = '';
      const addressMatch = contactText.match(/([0-9]+\s+[A-Za-z\.\s]+(?:street|st|avenue|ave|road|rd|blvd|boulevard|lane|ln|drive|dr|circle|cir|court|ct|place|pl|suite|ste|apt|unit).+)/i);
      if (addressMatch) address = addressMatch[1].trim();
      
      // Extract city, state, zip
      let city = '', state = '', zip = '';
      const cityStateZipMatch = contactText.match(/([A-Za-z\s\.]+),?\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)/i);
      if (cityStateZipMatch) {
        city = cityStateZipMatch[1].trim();
        state = cityStateZipMatch[2];
        zip = cityStateZipMatch[3];
      }
      
      // Extract phone
      let phone = '';
      const phoneMatch = contactText.match(/(?:\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/);
      if (phoneMatch) phone = phoneMatch[0];
      
      contactInfo = { name, address, city, state, zip, phone };
    }
    
    // Create basic account
    const account: Account = {
      accountName,
      accountNumber: accountNumber || 'Not Found',
      accountType: accountType || 'Not Specified',
      openDate: openDate || 'Not Found',
      status: status || 'Not Specified',
      balance,
      paymentHistory,
      creditLimit,
      availableCredit,
      highCredit,
      activityDesignator,
      comments,
      contactInfo,
      
      // Check if this is a negative account
      isNegative: 
        status?.toLowerCase().includes('charge') || 
        status?.toLowerCase().includes('collection') ||
        status?.toLowerCase().includes('foreclosure') ||
        activityDesignator?.toLowerCase().includes('charge') ||
        activityDesignator?.toLowerCase().includes('collection')
    };
    
    // Parse account history tables if present
    if (accountText.includes('Account History') || accountText.includes('Balance')) {
      try {
        extractAccountHistory(accountText, account);
      } catch (e) {
        console.error('Error extracting account history:', e);
      }
    }
    
    // Parse account details
    if (accountText.includes('Account Details')) {
      try {
        extractAccountDetails(accountText, account);
      } catch (e) {
        console.error('Error extracting account details:', e);
      }
    }
    
    // Log each successfully extracted account
    console.log(`Extracted account: ${account.accountName} (${account.accountType})`);
    
    accounts.push(account);
  });
  
  console.log(`Total accounts extracted: ${accounts.length}`);
  return accounts;
};

// Helper function to extract account history tables
function extractAccountHistory(accountText: string, account: Account): void {
  // Define the table patterns we want to extract
  const tableTypes = [
    { name: 'Balance', pattern: /Balance[\s\n]+Year/i },
    { name: 'Scheduled Payment', pattern: /Scheduled\s+Payment[\s\n]+Year/i },
    { name: 'Actual Payment', pattern: /Actual\s+Payment[\s\n]+Year/i },
    { name: 'Credit Limit', pattern: /Credit\s+Limit[\s\n]+Year/i },
    { name: 'Past Due', pattern: /Past\s+Due[\s\n]+Year/i },
  ];
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  // Initialize history objects if not already present
  account.balanceHistory = account.balanceHistory || {};
  account.scheduledPaymentHistory = account.scheduledPaymentHistory || {};
  account.actualPaymentHistory = account.actualPaymentHistory || {};
  account.creditLimitHistory = account.creditLimitHistory || {};
  account.pastDueHistory = account.pastDueHistory || {};
  
  // Try to extract each table
  for (const tableType of tableTypes) {
    const tableMatch = accountText.match(new RegExp(`${tableType.name}(?:.*?\\n)+.*?Year.*?(?:\\n.*?){1,10}`, 'is'));
    
    if (tableMatch) {
      const tableText = tableMatch[0];
      const tableLines = tableText.split('\n').filter(line => line.trim());
      
      // For each line that starts with a year
      const yearLines = tableLines.filter(line => /^\d{4}/.test(line.trim()));
      
      yearLines.forEach(yearLine => {
        const yearMatch = yearLine.match(/^(\d{4})/);
        if (yearMatch) {
          const year = yearMatch[1];
          const values = yearLine.match(/\$?\d+|\$\d+\.\d+|\d+\.\d+/g) || [];
          
          // Map values to months (considering there might be fewer values than months)
          // This is a simplified approach - a more robust solution would parse the table structure
          let targetHistory: { [key: string]: { [key: string]: string } } = {};
          
          switch (tableType.name) {
            case 'Balance':
              targetHistory = account.balanceHistory!;
              break;
            case 'Scheduled Payment':
              targetHistory = account.scheduledPaymentHistory!;
              break;
            case 'Actual Payment':
              targetHistory = account.actualPaymentHistory!;
              break;
            case 'Credit Limit':
              targetHistory = account.creditLimitHistory!;
              break;
            case 'Past Due':
              targetHistory = account.pastDueHistory!;
              break;
          }
          
          // Initialize year object if not present
          targetHistory[year] = targetHistory[year] || {};
          
          // Map values to months - this is a simplistic approach
          // In a real implementation, we would need to determine the exact column positions
          values.forEach((value, index) => {
            if (index < months.length) {
              targetHistory[year][months[index]] = value.startsWith('$') ? value : `$${value}`;
            }
          });
        }
      });
    }
  }
}

// Helper function to extract payment history patterns
function extractPaymentHistory(accountText: string, account: Account): void {
  // Initialize payment history patterns
  account.paymentHistoryPatterns = {};
  
  // Look for the payment history section
  const paymentHistoryMatch = accountText.match(/Payment\s+History.*?(?:Year.*?)?((?:\n.*?){1,20})/is);
  
  if (paymentHistoryMatch) {
    const paymentHistorySection = paymentHistoryMatch[1];
    const historyLines = paymentHistorySection.split('\n').filter(line => line.trim());
    
    // Process lines that look like year rows
    historyLines.forEach(line => {
      const yearMatch = line.match(/^(\d{4})/);
      if (yearMatch) {
        const year = yearMatch[1];
        account.paymentHistoryPatterns![year] = account.paymentHistoryPatterns![year] || {};
        
        // Look for payment status indicators (✓, 30, 60, 90, etc.)
        const statusMatches = line.match(/[✓✔]|\d{1,3}|[A-Z]{1,2}/g);
        if (statusMatches) {
          // Simplistic mapping to months - in reality would need better position detection
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          
          statusMatches.slice(1).forEach((status, index) => {
            if (index < months.length) {
              // Map checkmarks to true for "paid on time"
              if (status === '✓' || status === '✔') {
                account.paymentHistoryPatterns![year][months[index]] = true;
              } else {
                account.paymentHistoryPatterns![year][months[index]] = status;
              }
            }
          });
        }
      }
    });
  }
}

// Helper function to extract detailed account information
function extractAccountDetails(accountText: string, account: Account): void {
  // Look for various account details with regex
  const detailsMatch = accountText.match(/Account\s+Details.*?(?:\n.*?){1,50}/is);
  
  if (detailsMatch) {
    const detailsSection = detailsMatch[0];
    
    // Helper function to extract labeled values
    const extractLabeledValue = (label: string, pattern?: RegExp): string | null => {
      const defaultPattern = new RegExp(`${label}\\s*:?\\s*([^\\n]+)`, 'i');
      const match = detailsSection.match(pattern || defaultPattern);
      return match ? match[1].trim() : null;
    };
    
    // Extract various details
    account.termsFrequency = extractLabeledValue('Terms Frequency');
    account.termDuration = extractLabeledValue('Term Duration');
    account.dateReported = extractLabeledValue('Date Reported');
    account.dateLastPayment = extractLabeledValue('Date of Last Payment');
    account.dateLastActivity = extractLabeledValue('Date of Last Activity');
    account.scheduledPaymentAmount = extractLabeledValue('Scheduled Payment Amount');
    account.actualPaymentAmount = extractLabeledValue('Actual Payment Amount');
    account.amountPastDue = extractLabeledValue('Amount Past Due');
    account.delinquencyFirstReported = extractLabeledValue('Delinquency First Reported');
    account.creditorClassification = extractLabeledValue('Creditor Classification');
    account.chargeOffAmount = extractLabeledValue('Charge Off Amount');
    account.dateOfFirstDelinquency = extractLabeledValue('Date of First Delinquency');
    account.dateClosed = extractLabeledValue('Date Closed');
    account.loanType = extractLabeledValue('Loan Type');
    account.paymentResponsibility = extractLabeledValue('Payment Responsibility');
    account.deferredPaymentStartDate = extractLabeledValue('Deferred Payment Start Date');
    account.balloonPaymentDate = extractLabeledValue('Balloon Payment Date');
    account.balloonPaymentAmount = extractLabeledValue('Balloon Payment Amount');
    
    // Extract months reviewed
    const monthsReviewedMatch = detailsSection.match(/Months\s+Reviewed\s*:?\s*(\d+)/i);
    if (monthsReviewedMatch) {
      account.monthsReviewed = parseInt(monthsReviewedMatch[1], 10);
    }
  }
}
