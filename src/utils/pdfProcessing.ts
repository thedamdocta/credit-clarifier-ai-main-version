
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
        const tablePattern = /Account\s+Type\s+(?:Total\s+Accounts|Open|With\s+Balance|Total\s+Balance|Available|Credit\s+Limit|Debt-to-Credit|Payment)/i;
        if (tablePattern.test(extractedText)) {
          console.log("Identified potential Equifax account summary table");
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
