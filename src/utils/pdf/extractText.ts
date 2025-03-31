
import { toast } from "sonner";

export const extractTextFromPDF = async (pdf: any): Promise<string> => {
  let extractedText = '';
  
  // Extract text from all pages
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
  
  return extractedText;
};

