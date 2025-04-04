
import { toast } from "sonner";
import { getContactTableImages, extractContactInfoTables } from "@/lib/ai/contactInfoExtraction";

/**
 * Extract table images from the PDF document
 */
export const extractContactTableImages = async (): Promise<string[]> => {
  toast.info("Attempting to extract contact information tables...");
  
  try {
    const pdfData = (window as any).currentPdfDocument;
    
    if (!pdfData) {
      toast.error("PDF document not available for extraction");
      console.error("No PDF document available in window.currentPdfDocument");
      return [];
    }

    console.log("Starting contact table extraction from PDF");
    await extractContactInfoTables(pdfData);
    
    const newImages = getContactTableImages();
    
    if (newImages.length > 0) {
      toast.success(`Successfully extracted ${newImages.length} contact table images`);
      console.log("Contact table images extracted:", newImages.length);
    } else {
      toast.warning("No contact table images could be extracted");
      console.warn("No contact table images were extracted");
    }
    
    return newImages;
  } catch (error) {
    console.error("Error extracting contact table images:", error);
    toast.error("Failed to extract contact table images");
    return [];
  }
};
