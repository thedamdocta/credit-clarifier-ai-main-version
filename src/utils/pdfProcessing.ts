
import { toast } from "sonner";
import { parseCreditReport } from "@/lib/creditReportParser";

export const processPDFDocument = async (
  file: File,
  useAI: boolean,
  callbacks: {
    setCurrentFile: (file: File) => void;
    setUploadProgress: (value: number | ((prev: number) => number)) => void;
    onPDFUploaded: (file: File, text: string, parsedReport?: any) => void;
  }
) => {
  const { setCurrentFile, setUploadProgress, onPDFUploaded } = callbacks;
  
  try {
    setCurrentFile(file);
    
    // Simulate progress for better UX
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        const newProgress = prev + 5;
        return newProgress > 90 ? 90 : newProgress;
      });
    }, 100);

    // Load the PDF.js library dynamically
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = 
      `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    
    // Read the PDF file
    const fileReader = new FileReader();
    
    fileReader.onload = async function() {
      const typedarray = new Uint8Array(this.result as ArrayBuffer);
      
      try {
        // Load the PDF document
        const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
        
        // Extract text from all pages
        let extractedText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageText = content.items
            .map((item: any) => item.str)
            .join(' ');
          extractedText += pageText + ' ';
          
          // Log progress for debugging
          console.log(`Processed page ${i} of ${pdf.numPages}`);
        }
        
        console.log('Text extraction complete. Text length:', extractedText.length);
        console.log('Sample text:', extractedText.substring(0, 300) + '...');
        
        // Pre-process text to better identify account tables
        // Look for Equifax specific table patterns
        const tablePattern = /Account\s+Type\s+(?:Total\s+Accounts|Open|Closed|Balance)/i;
        if (tablePattern.test(extractedText)) {
          console.log("Identified potential Equifax account summary table");
        }
        
        // Look for the expanded table format
        const expandedTablePattern = /Account\s+Type\s+Open\s+With\s+Balance\s+Total\s+Balance\s+Available\s+Credit\s+Limit\s+Debt-to-Credit\s+Payment/i;
        if (expandedTablePattern.test(extractedText)) {
          console.log("Identified expanded Equifax account summary table");
        }
        
        // Extract confirmation number
        const confirmationPattern = /confirmation\s+number[:\s]*(\d+)/i;
        const confirmationMatch = extractedText.match(confirmationPattern);
        if (confirmationMatch && confirmationMatch[1]) {
          console.log("Found confirmation number:", confirmationMatch[1]);
        }
        
        // Look for credit file status
        const statusPattern = /credit\s+file\s+status[:\s]*(.*?)(?:\n|$)/i;
        const statusMatch = extractedText.match(statusPattern);
        if (statusMatch && statusMatch[1]) {
          console.log("Found credit file status:", statusMatch[1].trim());
        }
        
        // Extract most recent inquiry in the format "COMPANY NAME (CODE) Date"
        const recentInquiryPattern = /Most\s+Recent\s+Inquiry[:\s]+([^\n]+?)(?:\n|$)/i;
        const recentInquiryMatch = extractedText.match(recentInquiryPattern);
        if (recentInquiryMatch && recentInquiryMatch[1]) {
          console.log("Found most recent inquiry:", recentInquiryMatch[1].trim());
        }
        
        // Show appropriate processing toast
        if (useAI) {
          toast.info("Processing with AI analysis...");
        } else {
          toast.info("Processing credit report...");
        }
        
        // Parse the report with or without AI-first approach
        try {
          console.log("Beginning report parsing...");
          const parsedReport = await parseCreditReport(extractedText, useAI);
          console.log("Report parsing complete:", parsedReport.bureau);
          
          // Extract additional information for display
          if (parsedReport.bureau === 'Equifax') {
            // Try to extract confirmation number
            if (confirmationMatch && confirmationMatch[1]) {
              parsedReport.confirmationNumber = confirmationMatch[1].trim();
            }
            
            // Try to extract credit file status
            if (statusMatch && statusMatch[1]) {
              parsedReport.creditFileStatus = statusMatch[1].trim();
            }
            
            // Extract most recent inquiry in a cleaner format
            if (recentInquiryMatch && recentInquiryMatch[1]) {
              const inquiryText = recentInquiryMatch[1].trim();
              // Only use the inquiry if it's not too long (likely not the whole report)
              if (inquiryText.length < 100) {
                parsedReport.recentInquiry = inquiryText;
              }
            }
            
            // Extract expanded account table data if available
            if (expandedTablePattern.test(extractedText)) {
              console.log("Attempting to extract expanded account summaries");
              
              // Update the account summaries with additional data columns
              if (parsedReport.accountSummaries) {
                for (const summary of parsedReport.accountSummaries) {
                  // Try to find with balance counts
                  const withBalancePattern = new RegExp(`${summary.accountType}[\\s\\S]*?\\b(\\d+)\\s+with\\s+balance\\b`, 'i');
                  const withBalanceMatch = extractedText.match(withBalancePattern);
                  if (withBalanceMatch && withBalanceMatch[1]) {
                    summary.withBalance = parseInt(withBalanceMatch[1]);
                  }
                  
                  // Try to find total balance
                  const totalBalancePattern = new RegExp(`${summary.accountType}[\\s\\S]*?\\btotal\\s+balance\\s*[:\\$]\\s*([\\d,.]+)\\b`, 'i');
                  const totalBalanceMatch = extractedText.match(totalBalancePattern);
                  if (totalBalanceMatch && totalBalanceMatch[1]) {
                    summary.totalBalance = `$${totalBalanceMatch[1]}`;
                  }
                  
                  // Try to find available credit
                  const availablePattern = new RegExp(`${summary.accountType}[\\s\\S]*?\\bavailable\\s*[:\\$]\\s*([\\d,.]+)\\b`, 'i');
                  const availableMatch = extractedText.match(availablePattern);
                  if (availableMatch && availableMatch[1]) {
                    summary.available = `$${availableMatch[1]}`;
                  }
                  
                  // Try to find credit limit
                  const creditLimitPattern = new RegExp(`${summary.accountType}[\\s\\S]*?\\bcredit\\s+limit\\s*[:\\$]\\s*([\\d,.]+)\\b`, 'i');
                  const creditLimitMatch = extractedText.match(creditLimitPattern);
                  if (creditLimitMatch && creditLimitMatch[1]) {
                    summary.creditLimit = `$${creditLimitMatch[1]}`;
                  }
                  
                  // Try to find debt to credit ratio
                  const debtToCreditPattern = new RegExp(`${summary.accountType}[\\s\\S]*?\\bdebt-to-credit\\s*:?\\s*(\\d+%)\\b`, 'i');
                  const debtToCreditMatch = extractedText.match(debtToCreditPattern);
                  if (debtToCreditMatch && debtToCreditMatch[1]) {
                    summary.debtToCredit = debtToCreditMatch[1];
                  }
                  
                  // Try to find payment amount
                  const paymentPattern = new RegExp(`${summary.accountType}[\\s\\S]*?\\bpayment\\s*[:\\$]\\s*([\\d,.]+)\\b`, 'i');
                  const paymentMatch = extractedText.match(paymentPattern);
                  if (paymentMatch && paymentMatch[1]) {
                    summary.payment = `$${paymentMatch[1]}`;
                  }
                }
              }
            }
            
            // Try to find oldest and most recent accounts
            if (parsedReport.accounts && parsedReport.accounts.length > 0) {
              // Sort accounts by open date
              const sortedAccounts = [...parsedReport.accounts]
                .filter(account => account.openDate && account.openDate !== 'Not Found')
                .sort((a, b) => {
                  const dateA = new Date(a.openDate).getTime();
                  const dateB = new Date(b.openDate).getTime();
                  return dateA - dateB;
                });
              
              if (sortedAccounts.length > 0) {
                parsedReport.oldestAccount = {
                  accountName: sortedAccounts[0].accountName,
                  openDate: sortedAccounts[0].openDate
                };
                
                parsedReport.recentAccount = {
                  accountName: sortedAccounts[sortedAccounts.length - 1].accountName,
                  openDate: sortedAccounts[sortedAccounts.length - 1].openDate
                };
              }
            }
            
            // Extract account age metrics
            const agePattern = /average\s+account\s+age[:\s]*(.*?)(?:\n|$)/i;
            const ageMatch = extractedText.match(agePattern);
            if (ageMatch && ageMatch[1]) {
              parsedReport.averageAccountAge = ageMatch[1].trim();
            }
            
            const historyPattern = /length\s+of\s+credit\s+history[:\s]*(.*?)(?:\n|$)/i;
            const historyMatch = extractedText.match(historyPattern);
            if (historyMatch && historyMatch[1]) {
              parsedReport.lengthOfCreditHistory = historyMatch[1].trim();
            }
            
            const negativeInfoPattern = /accounts\s+with\s+negative\s+information[:\s]*(\d+)/i;
            const negativeMatch = extractedText.match(negativeInfoPattern);
            if (negativeMatch && negativeMatch[1]) {
              parsedReport.accountsWithNegativeInfo = negativeMatch[1].trim();
            }
            
            const alertPattern = /alert\s+contacts[:\s]*(.*?)(?:\n|$)/i;
            const alertMatch = extractedText.match(alertPattern);
            if (alertMatch && alertMatch[1]) {
              parsedReport.alertContacts = alertMatch[1].trim();
            }

            // Extract statement count
            const statementPattern = /statement[:\s]*(\d+)(?:\s*Records?)?\s*Found/i;
            const statementMatch = extractedText.match(statementPattern);
            if (statementMatch && statementMatch[1]) {
              parsedReport.statementCount = parseInt(statementMatch[1]);
            } else {
              parsedReport.statementCount = 0;
            }
          }
          
          // Log account summary info for debugging
          if (parsedReport.accountSummaries) {
            console.log("Account summaries extracted:", parsedReport.accountSummaries.length);
            console.log("Account summaries:", parsedReport.accountSummaries);
          }
          
          clearInterval(progressInterval);
          setUploadProgress(100);

          // Pass the extracted text, file, and parsed report to the parent component
          onPDFUploaded(file, extractedText, parsedReport);
          
          if (useAI) {
            toast.success("PDF successfully processed with AI analysis!");
          } else {
            toast.success("PDF successfully processed!");
          }
        } catch (error) {
          console.error("Error in processing:", error);
          // Fall back to basic processing
          onPDFUploaded(file, extractedText);
          toast.success("PDF processed (analysis unavailable)");
        }
        
        // Reset progress after a delay
        setTimeout(() => {
          setUploadProgress(0);
        }, 1000);
        
      } catch (error) {
        console.error("Error processing PDF:", error);
        toast.error("Failed to process PDF. Please try another file.");
        clearInterval(progressInterval);
        setUploadProgress(0);
      }
    };

    fileReader.onerror = () => {
      toast.error("Error reading the file.");
      clearInterval(progressInterval);
      setUploadProgress(0);
    };

    fileReader.readAsArrayBuffer(file);
  } catch (error) {
    console.error("Error in PDF processing:", error);
    toast.error("An error occurred while processing the PDF.");
    setUploadProgress(0);
  }
};
