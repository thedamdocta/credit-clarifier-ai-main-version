
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

// New function to extract credit account table as image for AI processing
export const extractCreditAccountsTableImage = async (pdf: any): Promise<string | null> => {
  try {
    // For now, we'll use a placeholder URL for the sample image
    // In a real implementation, this would extract the table area from the PDF and convert it to an image
    return 'public/lovable-uploads/4aaea5c8-6809-4f4f-8b46-22dc5514db9c.png';
  } catch (error) {
    console.error('Error extracting table image:', error);
    return null;
  }
};
