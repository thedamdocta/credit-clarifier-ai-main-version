
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

// Extract credit account table as image for AI processing
export const extractCreditAccountsTableImage = async (pdf: any): Promise<string | null> => {
  try {
    // For now, we use the uploaded image, but in a production environment
    // we would extract the table region from the PDF using heuristics or ML
    const imageUrl = '/lovable-uploads/458643ea-a052-40a4-a3fd-e8a38ddec467.png';
    console.log('Using table image from:', imageUrl);
    return imageUrl;
  } catch (error) {
    console.error('Error extracting table image:', error);
    return null;
  }
};

// New function to extract text directly from an image using Hugging Face OCR
export const extractTextFromImage = async (imageUrl: string): Promise<string | null> => {
  try {
    console.log('Starting OCR on image:', imageUrl);
    // Here we would call a proper OCR model with Hugging Face
    // For now, we'll use a simple simulation for demonstration purposes
    
    // Simulate processing delay that would occur with real ML processing
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('OCR process completed');
    return "Simulated OCR text extraction - would be replaced by actual HF model results";
  } catch (error) {
    console.error('Error running OCR on image:', error);
    return null;
  }
};
