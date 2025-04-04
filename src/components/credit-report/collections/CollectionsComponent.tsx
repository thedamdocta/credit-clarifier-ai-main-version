
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { CreditReport, Collection } from "@/lib/types/creditReport";
import CollectionsHeader from "./CollectionsHeader";
import CollectionsList from "./CollectionsList";
import CollapsibleCard from "../common/CollapsibleCard";
import { extractCollectionsFromText, getCurrentPDFData } from "@/utils/pdf/extractText";

interface CollectionsComponentProps {
  report: CreditReport;
}

const CollectionsComponent: React.FC<CollectionsComponentProps> = ({ report }) => {
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [collections, setCollections] = useState<Collection[]>(report.collections || []);
  const [extractionAttempted, setExtractionAttempted] = useState(false);
  
  // Attempt to extract collections when component mounts
  useEffect(() => {
    if (!report.collections || report.collections.length === 0) {
      console.log("No collection data found in report, attempting automatic extraction");
      handleRetryExtraction();
    } else {
      console.log("Using existing collection data from report", report.collections);
      setCollections(report.collections);
    }
  }, [report.reportId]); // Re-run this effect when a new report is loaded
  
  const handleRetryExtraction = () => {
    setIsProcessing(true);
    toast.info("Extracting collections data...");
    
    // Get current PDF data
    const currentPdfData = getCurrentPDFData();
    
    if (!currentPdfData.extractedText) {
      toast.error("No PDF text available for extraction");
      setIsProcessing(false);
      return;
    }
    
    setTimeout(() => {
      try {
        // Use the collection extraction function
        const extractedCollections = extractCollectionsFromText(currentPdfData.extractedText!);
        
        if (extractedCollections && extractedCollections.length > 0) {
          console.log("Successfully extracted collections:", extractedCollections);
          setCollections(extractedCollections);
          toast.success(`Found ${extractedCollections.length} collection account(s)`);
          
          // Update the report object with the collections
          if (report && typeof report === 'object') {
            report.collections = extractedCollections;
          }
        } else {
          console.log("No collections found in PDF");
          toast.info("No collection accounts found in your report");
          setCollections([]);
        }
      } catch (error) {
        console.error("Error extracting collections:", error);
        toast.error("Error extracting collection data");
      } finally {
        setExtractionAttempted(true);
        setIsProcessing(false);
      }
    }, 1500);
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
          extractionAttempted={extractionAttempted}
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
