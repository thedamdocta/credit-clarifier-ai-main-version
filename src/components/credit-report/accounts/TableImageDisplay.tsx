
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RefreshCw } from "lucide-react";
import { extractTableFromImage, convertTableToAccountSummaries } from "@/lib/ai/tableExtraction";
import { toast } from "sonner";
import { devDiagnostics } from "@/lib/security/devDiagnostics";

interface TableImageDisplayProps {
  imageUrl: string | null;
  showDebugInfo: boolean;
  onDataExtracted?: (data: any) => void;
}

const TableImageDisplay: React.FC<TableImageDisplayProps> = ({ 
  imageUrl, 
  showDebugInfo,
  onDataExtracted
}) => {
  const [enlargeImage, setEnlargeImage] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  // Automatically attempt extraction once when the image is loaded
  useEffect(() => {
    if (imageUrl && imageLoaded && onDataExtracted) {
      devDiagnostics.log("Image loaded, attempting automatic extraction");
      handleExtractData();
    }
  }, [imageUrl, imageLoaded]);
  
  const handleExtractData = async () => {
    if (!imageUrl) return;
    
    try {
      setIsExtracting(true);
      toast.info("Extracting data from table image...");
      
      // Add a cache-busting parameter to ensure we're using fresh image data
      const cacheBustUrl = `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
      
      devDiagnostics.log("Extracting data from image:", cacheBustUrl);
      const tableData = await extractTableFromImage(cacheBustUrl);
      
      if (tableData && tableData.rows && tableData.rows.length > 0) {
        devDiagnostics.log("Successfully extracted table data:", tableData);
        
        const accountSummaries = convertTableToAccountSummaries(tableData);
        devDiagnostics.log("Converted to account summaries:", accountSummaries);
        
        if (accountSummaries && accountSummaries.length > 0 && onDataExtracted) {
          // Check if we have actual data
          const hasRealData = accountSummaries.some(summary => 
            (summary.open && summary.open !== "0") || 
            (summary.withBalance && summary.withBalance !== "0") || 
            (summary.totalBalance && summary.totalBalance !== "$0" && summary.totalBalance !== "0")
          );
          
          if (hasRealData) {
            devDiagnostics.log("Extracted real data from image, applying to table");
            onDataExtracted(accountSummaries);
            toast.success("Successfully extracted data from table image");
          } else {
            devDiagnostics.log("No real data found in extracted account summaries");
            toast.error("Couldn't extract meaningful data from the image");
          }
        } else {
          toast.error("Extraction failed - no account data found");
        }
      } else {
        toast.error("Failed to extract table data from the image");
      }
    } catch (error) {
      devDiagnostics.error("Error extracting data from image:", error);
      toast.error("Error during data extraction");
    } finally {
      setIsExtracting(false);
    }
  };
  
  if (!showDebugInfo || !imageUrl) return null;
  
  return (
    <div className="mb-6 border rounded-lg p-3 bg-gray-50 shadow-sm">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium">Extracted Table Image</h3>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setEnlargeImage(!enlargeImage)}
          >
            {enlargeImage ? (
              <>
                <ZoomOut className="h-3.5 w-3.5 mr-1" />
                <span className="text-xs">Reduce</span>
              </>
            ) : (
              <>
                <ZoomIn className="h-3.5 w-3.5 mr-1" />
                <span className="text-xs">Enlarge</span>
              </>
            )}
          </Button>
          
          <Button
            variant="default"
            size="sm"
            onClick={handleExtractData}
            disabled={isExtracting || !imageUrl}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isExtracting ? 'animate-spin' : ''}`} />
            <span className="text-xs">Extract Data</span>
          </Button>
        </div>
      </div>
      <div className={`relative overflow-auto border ${enlargeImage ? 'h-[500px]' : 'h-[250px]'}`}>
        <img 
          src={imageUrl} 
          alt="Extracted Account Table" 
          className={`max-w-full ${enlargeImage ? 'h-auto' : 'h-full'} object-contain mx-auto`}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            setImageLoaded(false);
            devDiagnostics.error("Error loading table image");
          }}
          onLoad={() => {
            devDiagnostics.log("Table image loaded successfully");
            setImageLoaded(true);
          }}
        />
      </div>
      <div className="mt-2 text-xs text-muted-foreground flex justify-between">
        <span>This image is used for extracting the account data table</span>
        <span className="text-xs font-medium">
          {imageLoaded ? (
            <span className="text-green-600">✓ Image loaded</span>
          ) : (
            <span className="text-red-500">✗ Image failed to load</span>
          )}
        </span>
      </div>
    </div>
  );
};

export default TableImageDisplay;
