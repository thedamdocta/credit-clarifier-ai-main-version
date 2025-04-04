
import React, { useState, useEffect } from "react";
import { CreditReport } from "@/lib/types/creditReport";
import { Table, TableHead, TableHeader, TableRow, TableBody, TableCell } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, RefreshCw, Upload, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getContactTableImages, extractContactInfoTables } from "@/lib/ai/contactInfoExtraction";
import { toast } from "sonner";
import AddressesTable from "./AddressesTable";
import EmploymentTable from "./EmploymentTable";

interface ContactInfoComponentProps {
  report: CreditReport;
}

const ContactInfoComponent: React.FC<ContactInfoComponentProps> = ({ report }) => {
  const [tableImages, setTableImages] = useState<string[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionAttempted, setExtractionAttempted] = useState(false);
  const [imageLoadStatus, setImageLoadStatus] = useState<Record<number, boolean>>({});

  useEffect(() => {
    // Get any existing extracted images on component mount
    const existingImages = getContactTableImages();
    if (existingImages.length > 0) {
      console.log("Found existing contact table images:", existingImages.length);
      setTableImages(existingImages);
      setExtractionAttempted(true);
    }
  }, []);

  // Track image load status
  const handleImageLoad = (index: number) => {
    setImageLoadStatus(prev => ({ ...prev, [index]: true }));
    console.log(`Contact table image ${index} loaded successfully`);
  };

  const handleImageError = (index: number) => {
    setImageLoadStatus(prev => ({ ...prev, [index]: false }));
    console.error(`Contact table image ${index} failed to load`);
  };

  const handleExtractTableImages = async () => {
    if (isExtracting) return;
    
    setIsExtracting(true);
    toast.info("Attempting to extract contact information tables...");
    
    try {
      // Access the PDF document from the window object (set during PDF processing)
      const pdfData = (window as any).currentPdfDocument;
      
      if (!pdfData) {
        toast.error("PDF document not available for extraction");
        console.error("No PDF document available in window.currentPdfDocument");
        setIsExtracting(false);
        setExtractionAttempted(true);
        return;
      }

      console.log("Starting contact table extraction from PDF");
      const result = await extractContactInfoTables(pdfData);
      
      // Update the images array after extraction
      const newImages = getContactTableImages();
      setTableImages(newImages);
      
      if (newImages.length > 0) {
        toast.success(`Successfully extracted ${newImages.length} contact table images`);
        console.log("Contact table images extracted:", newImages.length);
      } else {
        toast.warning("No contact table images could be extracted");
        console.warn("No contact table images were extracted");
      }
    } catch (error) {
      console.error("Error extracting contact table images:", error);
      toast.error("Failed to extract contact table images");
    } finally {
      setIsExtracting(false);
      setExtractionAttempted(true);
    }
  };

  // Format address for display - fixed to handle null values
  const formatAddress = (address: string | null): string => {
    if (!address) return ""; // Return empty string for null addresses
    
    // Remove any "Current" or "Former" prefixes that might have been captured
    return address.replace(/^(current|former)\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2},\s+\d{4}\s+/i, '');
  };

  // Prepare addresses in the format expected by AddressesTable
  const prepareAddresses = () => {
    if (!report.personalInfo || !report.personalInfo.addresses) {
      return [];
    }

    return report.personalInfo.addresses.map((address, index) => {
      // Check if this is actually an address with status info
      const isAddressObj = typeof address === 'object' && address !== null && 'address' in address;
      
      if (isAddressObj) {
        const addressObj = address as any;
        return {
          address: formatAddress(addressObj.address),
          status: addressObj.status || 'Unknown',
          dateReported: addressObj.dateReported || ''
        };
      } else {
        // Simple string address without status info
        let status = 'Unknown';
        let dateReported = '';
        
        // Try to extract status from the address string
        if (typeof address === 'string') {
          if (address.toLowerCase().includes('current')) {
            status = 'Current';
          } else if (address.toLowerCase().includes('former')) {
            status = 'Former';
          }
          
          // Fixed the null check issue - ensure address is a string before calling match
          const dateMatch = typeof address === 'string' && address 
            ? address.match(/(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2},\s+\d{4}/i) 
            : null;
            
          if (dateMatch) {
            dateReported = dateMatch[0];
          }
        }
        
        return {
          address: typeof address === 'string' ? formatAddress(address) : '',
          status,
          dateReported
        };
      }
    });
  };

  // Prepare employment data
  const prepareEmployment = () => {
    if (!report.personalInfo || !report.personalInfo.employmentHistory) {
      return [];
    }

    // For now we're just wrapping the string in an object
    return [{
      company: "History",
      occupation: "Employment history is the information in your credit file that indicates your current and former employment as reported to Equifax"
    }];
  };

  const addresses = prepareAddresses();
  const employment = prepareEmployment();

  return (
    <div className="space-y-8">
      {/* Previous Addresses Section */}
      <div>
        <h3 className="text-lg font-medium mb-4">Previous Addresses</h3>
        <AddressesTable addresses={addresses} />
      </div>

      {/* Employment History Section */}
      <div>
        <h3 className="text-lg font-medium mb-4">Employment History</h3>
        <EmploymentTable employments={employment} />
      </div>
      
      {/* Contact Information Images Section */}
      <div className="mt-6 border rounded-lg p-3 bg-gray-50 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-medium">Contact Information Images</h3>
          <Button
            variant="default"
            size="sm"
            onClick={handleExtractTableImages}
            disabled={isExtracting}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isExtracting ? 'animate-spin' : ''}`} />
            <span className="text-xs">{isExtracting ? 'Extracting...' : 'Extract Tables'}</span>
          </Button>
        </div>
        
        {tableImages.length > 0 ? (
          <div className="space-y-4">
            {tableImages.map((imageUrl, index) => (
              <div key={`contact-img-${index}`} className="border rounded-md overflow-hidden bg-white">
                <div className="bg-muted/30 p-2 flex justify-between items-center">
                  <span className="text-xs font-medium">Contact Table Image {index + 1}</span>
                  <span className="text-xs">
                    {imageLoadStatus[index] === true && (
                      <span className="text-green-600">✓ Loaded</span>
                    )}
                    {imageLoadStatus[index] === false && (
                      <span className="text-red-500">✗ Failed</span>
                    )}
                    {imageLoadStatus[index] === undefined && (
                      <span className="text-amber-500">⋯ Loading</span>
                    )}
                  </span>
                </div>
                <div className="relative overflow-auto h-[250px]">
                  <img 
                    src={imageUrl} 
                    alt={`Contact information table ${index + 1}`} 
                    className="h-full object-contain mx-auto"
                    onLoad={() => handleImageLoad(index)}
                    onError={() => handleImageError(index)}
                  />
                </div>
                <div className="p-2 flex justify-end">
                  <Button variant="outline" size="sm" asChild>
                    <a href={imageUrl} target="_blank" rel="noopener noreferrer">
                      View Full Image
                    </a>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 border rounded-md bg-white">
            {isExtracting ? (
              <div className="text-center py-4">
                <Loader2 className="h-6 w-6 text-muted-foreground animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Extracting contact information tables...</p>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  Click "Extract Tables" to extract contact information tables from the PDF.
                </p>
              </div>
            )}
          </div>
        )}
        
        <div className="mt-2 text-xs text-muted-foreground">
          <p>This feature extracts contact information tables from the PDF to improve data accuracy.</p>
        </div>
      </div>
    </div>
  );
};

export default ContactInfoComponent;
