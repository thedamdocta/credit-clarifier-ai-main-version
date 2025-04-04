
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { CreditReport, Collection } from "@/lib/types/creditReport";
import CollectionsHeader from "./CollectionsHeader";
import CollectionsList from "./CollectionsList";
import CollapsibleCard from "../common/CollapsibleCard";
import { extractCollectionsTableImage, resetCollectionsTableImage } from "@/utils/pdf/extractCollectionsTableImage";
import { extractCollectionsFromImage } from "@/lib/ai/collectionExtraction";

interface CollectionsComponentProps {
  report: CreditReport;
}

const CollectionsComponent: React.FC<CollectionsComponentProps> = ({ report }) => {
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [tableImageUrl, setTableImageUrl] = useState<string | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  
  useEffect(() => {
    // Reset state when report changes
    if (report && report.reportId) {
      resetCollectionsTableImage();
      setTableImageUrl(null);
      
      // Initialize collections from the report data
      if (report.collections && report.collections.length > 0) {
        setCollections(report.collections);
      } else {
        setCollections([]);
      }
      
      // Auto-extract table image on component mount
      const extractImage = async () => {
        try {
          const imageUrl = await extractCollectionsTableImage(report);
          if (imageUrl) {
            console.log("Successfully extracted collections table image");
            setTableImageUrl(imageUrl);
          }
        } catch (error) {
          console.error("Error extracting collections table image:", error);
        }
      };
      
      extractImage();
    }
  }, [report?.reportId]);
  
  const handleRetryExtraction = async () => {
    setIsProcessing(true);
    toast.info("Retrying collections extraction...");
    
    try {
      // First, ensure we have a table image
      if (!tableImageUrl) {
        const imageUrl = await extractCollectionsTableImage(report);
        if (imageUrl) {
          setTableImageUrl(imageUrl);
        } else {
          toast.error("Could not extract the collections table image");
          setIsProcessing(false);
          return;
        }
      }
      
      // Extract collections from the image
      const extractedCollections = await extractCollectionsFromImage(tableImageUrl);
      
      if (extractedCollections && extractedCollections.length > 0) {
        setCollections(extractedCollections);
        toast.success("Successfully extracted collection accounts");
      } else {
        // If no collections found, check if report already has any
        if (report.collections && report.collections.length > 0) {
          setCollections(report.collections);
          toast.success("Using collections from report data");
        } else {
          setCollections([]);
          toast.info("No collection accounts found in your report");
        }
      }
    } catch (error) {
      console.error("Error during collections extraction:", error);
      toast.error("Error extracting collection accounts");
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleTrainParser = () => {
    toast.info("Training parser with current collections data...");
    // Add training logic here
  };
  
  const triggerPdfUpload = () => {
    const fileInput = document.querySelector('input[type="file"][accept=".pdf"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    } else {
      toast.warning("PDF upload button not found. Please use the upload button in the navigation bar.");
    }
  };

  // Use collections if they exist, otherwise an empty array
  const pdfAvailable = report && report.rawText && report.rawText.length > 0;
  
  const header = (
    <div className="flex flex-row items-center justify-between w-full">
      <CollectionsHeader 
        showDebugInfo={showDebugInfo} 
        toggleDebug={() => setShowDebugInfo(!showDebugInfo)} 
      />
      
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRetryExtraction}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry Extraction
            </>
          )}
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={triggerPdfUpload}
          disabled={isProcessing}
        >
          <Upload className="h-4 w-4 mr-1" />
          Upload Better PDF
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleTrainParser}
          disabled={isProcessing}
        >
          <Save className="h-4 w-4 mr-1" />
          Train Parser
        </Button>
      </div>
    </div>
  );

  const content = (
    <>
      <p className="mb-4">
        This section shows all collection accounts found in your credit report, including agency information and collection details.
      </p>
      
      {!pdfAvailable && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-yellow-700">
            No PDF data available. Please upload a credit report PDF to view collection accounts.
          </p>
        </div>
      )}
      
      {isProcessing ? (
        <div className="py-8 flex flex-col items-center justify-center">
          <Loader2 className="h-12 w-12 text-credit-blue animate-spin mb-4" />
          <p className="text-sm font-medium">
            Extracting collection data...
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Please wait while we analyze your collection accounts
          </p>
        </div>
      ) : (
        <CollectionsList 
          collections={collections} 
          showDebugInfo={showDebugInfo}
          tableImageUrl={tableImageUrl}
        />
      )}
    </>
  );
  
  return (
    <CollapsibleCard header={header}>
      {content}
    </CollapsibleCard>
  );
};

export default CollectionsComponent;
