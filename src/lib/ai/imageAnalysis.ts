
/**
 * Image analysis utilities for better OCR and table extraction
 */
import { toast } from "sonner";
import Tesseract from 'tesseract.js';
import { devDiagnostics } from "@/lib/security/devDiagnostics";

/**
 * Analyze image quality and provide diagnostic feedback
 * @param imageUrl URL of the image to analyze
 * @returns Object with analysis results
 */
export async function analyzeImageQuality(imageUrl: string): Promise<{
  qualityScore: number;
  isGoodForOcr: boolean;
  diagnostics: string[];
}> {
  try {
    const diagnostics: string[] = [];
    let qualityScore = 0;
    
    // Load image for analysis
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = imageUrl;
    });
    
    // Check dimensions - larger is generally better for OCR
    const width = img.width;
    const height = img.height;
    diagnostics.push(`Image dimensions: ${width}x${height}`);
    
    // Score based on size (larger is better for OCR)
    if (width >= 1000 && height >= 1000) {
      qualityScore += 30;
      diagnostics.push("✓ Good image resolution");
    } else if (width >= 600 && height >= 600) {
      qualityScore += 20;
      diagnostics.push("⚠ Medium image resolution");
    } else {
      qualityScore += 10;
      diagnostics.push("❌ Low image resolution");
    }
    
    // Run quick OCR to check text detectability
    try {
      const worker = await Tesseract.createWorker();
      await worker.loadLanguage('eng');
      await worker.initialize('eng');
      const result = await worker.recognize(imageUrl);
      
      // Add confidence score
      const confidence = result.data.confidence;
      diagnostics.push(`OCR confidence: ${confidence.toFixed(1)}%`);
      
      if (confidence > 80) {
        qualityScore += 40;
        diagnostics.push("✓ High OCR confidence");
      } else if (confidence > 60) {
        qualityScore += 30;
        diagnostics.push("⚠ Medium OCR confidence");
      } else {
        qualityScore += 15;
        diagnostics.push("❌ Low OCR confidence");
      }
      
      // Check if common table keywords were detected
      const text = result.data.text.toLowerCase();
      const tableKeywords = ['account', 'type', 'balance', 'credit', 'revolving', 'mortgage'];
      const foundKeywords = tableKeywords.filter(keyword => text.includes(keyword));
      
      diagnostics.push(`Keywords found: ${foundKeywords.length} of ${tableKeywords.length}`);
      qualityScore += foundKeywords.length * 5;
      
      await worker.terminate();
    } catch (error) {
      devDiagnostics.error("Error in OCR quality check:", error);
      diagnostics.push("❌ Failed to analyze text detectability");
    }
    
    // Calculate if image is good for OCR
    const isGoodForOcr = qualityScore >= 60;
    
    return {
      qualityScore,
      isGoodForOcr,
      diagnostics
    };
  } catch (error) {
    devDiagnostics.error("Error analyzing image quality:", error);
    return {
      qualityScore: 0,
      isGoodForOcr: false,
      diagnostics: ["Failed to analyze image quality"]
    };
  }
}

/**
 * Detect potential issues with table extraction based on image analysis
 * @param imageUrl URL of the image containing the table
 * @returns An array of potential issues and suggestions
 */
export async function detectTableExtractionIssues(imageUrl: string): Promise<string[]> {
  try {
    const issues: string[] = [];
    
    // Analyze image quality first
    const qualityAnalysis = await analyzeImageQuality(imageUrl);
    
    if (!qualityAnalysis.isGoodForOcr) {
      issues.push("Image quality may be too low for accurate table extraction");
    }
    
    // Create a temporary canvas to analyze the image pixels
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = imageUrl;
    });
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      issues.push("Failed to analyze image pixels");
      return issues;
    }
    
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    
    // Check for common issues:
    
    // 1. Low contrast
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Sample pixels to calculate histogram and contrast
    const pixelValues: number[] = [];
    for (let i = 0; i < data.length; i += 40) { // Sample every 10th pixel
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Convert to grayscale
      const value = 0.299 * r + 0.587 * g + 0.114 * b;
      pixelValues.push(value);
    }
    
    // Calculate min, max and contrast
    const min = Math.min(...pixelValues);
    const max = Math.max(...pixelValues);
    const contrast = (max - min) / 255;
    
    if (contrast < 0.5) {
      issues.push("Low contrast detected - text may not be clearly distinguishable");
    }
    
    // 2. Check if there are likely table grid lines
    // Grid lines help with table structure detection
    let horizontalLineCount = 0;
    let verticalLineCount = 0;
    
    // Sample rows for horizontal lines
    for (let y = 0; y < canvas.height; y += 10) {
      let linePixels = 0;
      for (let x = 0; x < canvas.width; x += 5) {
        const index = (y * canvas.width + x) * 4;
        const value = (data[index] + data[index + 1] + data[index + 2]) / 3;
        if (value < 100) linePixels++; // Dark pixel, potential line
      }
      
      if (linePixels > canvas.width * 0.7 / 5) horizontalLineCount++;
    }
    
    // Sample columns for vertical lines
    for (let x = 0; x < canvas.width; x += 10) {
      let linePixels = 0;
      for (let y = 0; y < canvas.height; y += 5) {
        const index = (y * canvas.width + x) * 4;
        const value = (data[index] + data[index + 1] + data[index + 2]) / 3;
        if (value < 100) linePixels++; // Dark pixel, potential line
      }
      
      if (linePixels > canvas.height * 0.7 / 5) verticalLineCount++;
    }
    
    if (horizontalLineCount < 3 || verticalLineCount < 3) {
      issues.push("Few table grid lines detected - structure may be difficult to extract");
    }
    
    // 3. Check if the image might be rotated
    // This is a simplified check and may not catch all rotation issues
    const worker = await Tesseract.createWorker();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    
    // Use correct options for Tesseract.js v4
    const result = await worker.recognize(imageUrl);
    
    // Check if result has rotation information from alternate methods
    const degree = result.data.confidence < 70 ? 'unknown' : 'aligned';
    if (degree === 'unknown') {
      issues.push("Image might be rotated or skewed");
    }
    
    await worker.terminate();
    
    return issues;
  } catch (error) {
    devDiagnostics.error("Error detecting table extraction issues:", error);
    return ["Failed to analyze table extraction issues"];
  }
}

/**
 * Use multiple OCR approaches and combine results for more accurate extraction
 * @param imageUrl URL of the image containing the text to extract
 * @returns The extracted text from the best approach
 */
export async function multiEngineOcrAnalysis(imageUrl: string): Promise<string | null> {
  try {
    // First try Tesseract OCR with default settings
    const tesseractWorker = await Tesseract.createWorker();
    await tesseractWorker.loadLanguage('eng');
    await tesseractWorker.initialize('eng');
    
    // Default Tesseract settings approach
    const defaultResult = await tesseractWorker.recognize(imageUrl);
    const defaultText = defaultResult.data.text;
    const defaultConfidence = defaultResult.data.confidence;
    
    // Optimize settings for table structure
    await tesseractWorker.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
      preserve_interword_spaces: '1',
    });
    
    // Table-optimized approach
    const tableResult = await tesseractWorker.recognize(imageUrl);
    const tableText = tableResult.data.text;
    const tableConfidence = tableResult.data.confidence;
    
    // Optimize settings for digits and currency detection
    await tesseractWorker.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
      tessedit_char_whitelist: '0123456789$,.%',
    });
    
    // Digit-optimized approach
    const digitResult = await tesseractWorker.recognize(imageUrl);
    const digitText = digitResult.data.text;
    const digitConfidence = digitResult.data.confidence;
    
    await tesseractWorker.terminate();
    
    // Now compare results from the different approaches
    // Use the approach with the highest confidence, but prefer table
    // structure for certain patterns
    
    // Define a scoring system for detecting a credit account table
    const scoreTableDetection = (text: string): number => {
      let score = 0;
      
      // Keywords specific to credit account tables
      const keywords = [
        'revolving', 'mortgage', 'installment', 'total',
        'account type', 'balance', 'credit limit', 'payment'
      ];
      
      keywords.forEach(keyword => {
        if (text.toLowerCase().includes(keyword)) {
          score += 1;
        }
      });
      
      // Patterns that strongly indicate a table with numeric data
      if (/revolving.*?\d+.*?\d+.*?\$/i.test(text)) score += 3;
      if (/mortgage.*?\d+.*?\d+/i.test(text)) score += 3;
      if (/total.*?\d+.*?\d+.*?\$/i.test(text)) score += 3;
      
      return score;
    };
    
    const defaultScore = scoreTableDetection(defaultText) * 0.8 + defaultConfidence * 0.2;
    const tableScore = scoreTableDetection(tableText) * 0.9 + tableConfidence * 0.1;
    const digitScore = scoreTableDetection(digitText) * 0.5 + digitConfidence * 0.5;
    
    devDiagnostics.log("OCR Analysis Scores:");
    devDiagnostics.log(`- Default: ${defaultScore.toFixed(2)} (confidence: ${defaultConfidence.toFixed(1)}%)`);
    devDiagnostics.log(`- Table: ${tableScore.toFixed(2)} (confidence: ${tableConfidence.toFixed(1)}%)`);
    devDiagnostics.log(`- Digit: ${digitScore.toFixed(2)} (confidence: ${digitConfidence.toFixed(1)}%)`);
    
    // Return the best result
    if (tableScore > defaultScore && tableScore > digitScore) {
      return tableText;
    } else if (defaultScore > digitScore) {
      return defaultText;
    } else {
      return digitText;
    }
  } catch (error) {
    devDiagnostics.error("Error in multi-engine OCR analysis:", error);
    return null;
  }
}
