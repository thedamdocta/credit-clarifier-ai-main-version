
import { pipeline } from '@huggingface/transformers';
import { preprocessImageForOCR, compressImage } from './imagePreprocessing';

// Lazily loaded OCR pipeline
let ocrPipelinePromise: Promise<any> | null = null;

// Disable AI features if they're causing performance issues
const USE_SIMULATION = true; // For development purposes only
const COMPRESS_IMAGES = true; // Enable image compression for better performance

/**
 * Extract text from an image using OCR
 * Optimized version with better compression and performance
 */
export async function extractTextFromImage(imageUrl: string): Promise<string | null> {
  if (USE_SIMULATION) {
    // Simulate OCR processing for development
    console.log('Simulating OCR processing for', imageUrl);
    await new Promise(resolve => setTimeout(resolve, 200)); // Reduced simulation time
    
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
    
    // Preprocess the image for better OCR results - with compression
    let imageToProcess = cacheBustUrl;
    
    if (COMPRESS_IMAGES) {
      // Compress image first for better performance
      const compressedImage = await compressImage(cacheBustUrl, 0.7, 1024);
      if (compressedImage) {
        console.log('Using compressed image for OCR');
        imageToProcess = compressedImage;
      } else {
        // Fall back to basic preprocessing
        const processedImageUrl = await preprocessImageForOCR(cacheBustUrl);
        imageToProcess = processedImageUrl || cacheBustUrl;
      }
    } else {
      // Use standard preprocessing without compression
      const processedImageUrl = await preprocessImageForOCR(cacheBustUrl);
      imageToProcess = processedImageUrl || cacheBustUrl;
    }
    
    // Initialize the OCR pipeline with timeout - reduced from 15s to 10s
    const ocrPromise = async () => {
      if (!ocrPipelinePromise) {
        console.log('Loading OCR model...');
        ocrPipelinePromise = pipeline('image-to-text', 'onnx-community/caption-it', { 
          quantized: true // Use quantized model for better performance
        });
      }
      
      // Get the OCR pipeline
      const ocrPipeline = await ocrPipelinePromise;
      
      // Process the image
      return await ocrPipeline(imageToProcess);
    };
    
    // Add timeout to prevent hanging - reduced from 15s to 10s
    const result = await Promise.race([
      ocrPromise(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('OCR processing timed out')), 10000)
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
 * With performance improvements
 */
export async function extractTableTextFromImage(imageUrl: string): Promise<string | null> {
  try {
    // For table extraction, we want to optimize OCR for structured data
    // With added compression for better performance
    if (COMPRESS_IMAGES) {
      const compressedImage = await compressImage(imageUrl, 0.7, 1024);
      if (compressedImage) {
        console.log('Using compressed image for table OCR');
        return extractTextFromImage(compressedImage);
      }
    }
    
    // Fall back to standard extraction
    return extractTextFromImage(imageUrl);
  } catch (error) {
    console.error('Error in table OCR processing:', error);
    return null;
  }
}
