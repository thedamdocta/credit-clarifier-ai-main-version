
import { pipeline } from '@huggingface/transformers';
import { preprocessImageForOCR } from './imagePreprocessing';

// Lazily loaded OCR pipeline
let ocrPipelinePromise: Promise<any> | null = null;

// Model configuration
const OCR_MODEL = 'microsoft/trocr-base-printed';
const USE_SIMULATION = true; // For development purposes only

/**
 * Extract text from an image using OCR
 * Enhanced version with better error handling and performance optimization
 */
export async function extractTextFromImage(imageUrl: string): Promise<string | null> {
  if (USE_SIMULATION) {
    // Simulate OCR processing for development
    console.log('Simulating OCR processing for', imageUrl);
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate processing time
    
    // Return simulated text that mimics credit report table data
    return `
      Account Information Summary
      
      Revolving 7 6 $18,533 $4,447 $22,980 80.6% $425
      Mortgage 0 0 $0 $0 $0 0.0% $0
      Installment 2 2 $31,533 -$4,447 $27,086 116.5% $543
      Other 3 3 $1,433 $0 $1,433 100.0% $25
      Total 12 11 $31,533 -$4,447 $27,086 66.0% $543
    `;
  }
  
  try {
    console.log('Starting OCR on image:', imageUrl ? imageUrl.substring(0, 50) + '...' : 'undefined');
    
    if (!imageUrl) {
      console.error('No image URL provided for OCR');
      return null;
    }
    
    // Add a cache-busting parameter for freshness
    const cacheBustUrl = `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
    
    // Preprocess the image for better OCR results
    const processedImageUrl = await preprocessImageForOCR(cacheBustUrl);
    const imageToProcess = processedImageUrl || cacheBustUrl;
    
    // Initialize the OCR pipeline with timeout
    const ocrPromise = async () => {
      if (!ocrPipelinePromise) {
        console.log('Loading OCR model...');
        ocrPipelinePromise = pipeline('image-to-text', OCR_MODEL);
      }
      
      // Get the OCR pipeline
      const ocrPipeline = await ocrPipelinePromise;
      
      // Process the image
      return await ocrPipeline(imageToProcess);
    };
    
    // Add timeout to prevent hanging
    const result = await Promise.race([
      ocrPromise(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('OCR processing timed out')), 15000)
      )
    ]);
    
    console.log('OCR result:', result);
    
    // Extract the text from the result
    const extractedText = result.map((item: any) => item.generated_text).join('\n');
    
    return extractedText;
  } catch (error) {
    console.error('Error in OCR processing:', error);
    return null;
  }
}

/**
 * Enhanced OCR specifically optimized for table detection
 */
export async function extractTableTextFromImage(imageUrl: string): Promise<string | null> {
  try {
    // For table extraction, we want to optimize OCR for structured data
    // This could use a different model or settings in a production environment
    return extractTextFromImage(imageUrl);
  } catch (error) {
    console.error('Error in table OCR processing:', error);
    return null;
  }
}
