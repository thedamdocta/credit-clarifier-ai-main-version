import { pipeline } from '@huggingface/transformers';
import { preprocessImageForOCR } from './imagePreprocessing';

// Lazily loaded OCR pipeline
let ocrPipelinePromise: Promise<any> | null = null;

// Model configuration
const OCR_MODEL = 'Xenova/trocr-base-handwritten';
const USE_SIMULATION = true; // For development purposes only

/**
 * Enhanced two-stage OCR processing:
 * 1. Extract all text from image
 * 2. Apply template-based structure recognition
 */
export async function extractTextFromImageWithOCR(imageUrl: string): Promise<string | null> {
  console.log('OCR processing started for image:', imageUrl?.substring(0, 100) + '...');
  
  if (USE_SIMULATION) {
    // Simulate OCR processing for development
    console.log('Simulating OCR processing for', imageUrl?.substring(0, 50) + '...');
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate processing time
    return "Simulated OCR output for development purposes.";
  }
  
  try {
    console.log('Starting OCR on image:', imageUrl?.substring(0, 50) + '...');
    
    // Add a cache-busting parameter to ensure we're using the latest image
    const cacheBustUrl = `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
    
    // Stage 1: Preprocess the image for better OCR results
    const processedImageUrl = await preprocessImageForOCR(cacheBustUrl);
    const imageToProcess = processedImageUrl || cacheBustUrl;
    
    // Initialize the OCR pipeline
    if (!ocrPipelinePromise) {
      console.log('Loading OCR model...');
      ocrPipelinePromise = pipeline('image-to-text', OCR_MODEL);
    }
    
    // Get the OCR pipeline
    const ocrPipeline = await ocrPipelinePromise;
    
    // Process the image
    const result = await ocrPipeline(imageToProcess);
    
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
 * Two-stage enhanced OCR processing:
 * 1. Extract all text with high accuracy
 * 2. Apply template matching to organize into structure
 */
export async function processImageWithEnhancedOCR(imageUrl: string): Promise<string | null> {
  try {
    console.log('Starting enhanced OCR processing for', imageUrl);
    
    // Add a timestamp to ensure we're using the latest image
    const uniqueUrl = `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}unique=${Date.now()}`;
    
    if (USE_SIMULATION) {
      await new Promise(resolve => setTimeout(resolve, 800)); // Simulate longer processing time
      return "Enhanced OCR simulation with improved table structure detection and character recognition.";
    }
    
    // Stage 1: Extract all text from the image
    const basicText = await extractTextFromImageWithOCR(uniqueUrl);
    if (!basicText) return null;
    
    // Stage 2: Apply template matching to organize text into structured format
    const structuredText = await applyTemplateMatching(basicText, uniqueUrl);
    
    return structuredText;
  } catch (error) {
    console.error('Error in enhanced OCR processing:', error);
    return null;
  }
}

/**
 * Apply template matching to organize extracted text
 * This is the second stage of the two-stage OCR process
 */
async function applyTemplateMatching(extractedText: string, imageUrl: string): Promise<string> {
  console.log('Applying template matching to extracted text');
  
  // For now, we'll apply some basic pattern recognition
  // In a production system, this would use more advanced template matching
  
  // Look for account types in the text
  const revolving = extractedText.match(/revolving/i);
  const mortgage = extractedText.match(/mortgage/i);
  const installment = extractedText.match(/installment/i);
  const total = extractedText.match(/total/i);
  
  // If we found at least some of the expected row headers, we can try to extract the table
  if (revolving || mortgage || installment || total) {
    console.log('Found table structure indicators');
    // In a real implementation, we would now extract columns of data
    // by looking at spatial relationships in the original image
    
    return extractedText;
  }
  
  // If template matching fails, return the original text
  return extractedText;
}

/**
 * Process image regions for specific data extraction
 * Useful for extracting data from specific parts of the credit report
 */
export async function extractTextFromImageRegion(
  imageUrl: string, 
  region: { x: number, y: number, width: number, height: number }
): Promise<string | null> {
  // In a production environment, this would:
  // 1. Crop the image to the specified region
  // 2. Apply OCR to the cropped region
  // 3. Return the extracted text
  
  console.log(`Extracting text from region (${region.x}, ${region.y}, ${region.width}, ${region.height})`);
  
  // Add a timestamp to ensure we're using the latest image
  const uniqueUrl = `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}unique=${Date.now()}`;
  
  // Simulation for development purposes
  if (USE_SIMULATION) {
    await new Promise(resolve => setTimeout(resolve, 300)); // Simulate processing time
    return `Simulated region extraction from (${region.x}, ${region.y})`;
  }
  
  try {
    // This would use canvas or image processing libraries to crop the region
    // Then apply OCR to the cropped image
    return null;
  } catch (error) {
    console.error('Error extracting text from image region:', error);
    return null;
  }
}

/**
 * Debug function to validate that an image URL is valid and accessible
 * Returns true if the image can be loaded, false otherwise
 */
export async function validateImageUrl(imageUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!imageUrl) {
      console.error('Empty image URL provided for validation');
      resolve(false);
      return;
    }
    
    console.log('Validating image URL:', imageUrl.substring(0, 50) + '...');
    
    const img = new Image();
    img.onload = () => {
      console.log('Image validated successfully');
      resolve(true);
    };
    img.onerror = () => {
      console.error('Image validation failed');
      resolve(false);
    };
    
    // Add cache-busting to ensure fresh load
    const cacheBustUrl = `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}v=${Date.now()}`;
    img.src = cacheBustUrl;
  });
}
