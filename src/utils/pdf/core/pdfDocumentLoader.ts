
// PDF document loading functionality
import { toast } from "sonner";

// Function to read a file as an ArrayBuffer with Promise
export async function readFileAsArrayBuffer(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    
    fileReader.onload = function() {
      resolve(new Uint8Array(this.result as ArrayBuffer));
    };
    
    fileReader.onerror = () => {
      reject(new Error("Error reading the file."));
    };
    
    fileReader.readAsArrayBuffer(file);
  });
}

// Function to load a PDF document from array buffer
export async function loadPdfDocument(typedarray: Uint8Array): Promise<any> {
  try {
    // Dynamically load PDF.js library
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = 
      `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    
    // Create a loading process
    const loadingPromise = pdfjsLib.getDocument({ data: typedarray }).promise;
    return await loadingPromise;
  } catch (error) {
    console.error("Error loading PDF:", error);
    throw error;
  }
}

// Simple function to check file exists (no size warning)
export function checkFileSizeAndWarn(file: File): number {
  const fileSizeMB = file.size / (1024 * 1024);
  return fileSizeMB;
}
