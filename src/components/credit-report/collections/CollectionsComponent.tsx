
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { CreditReport, Collection } from "@/lib/types/creditReport";
import CollectionsHeader from "./CollectionsHeader";
import CollectionsList from "./CollectionsList";
import CollapsibleCard from "../common/CollapsibleCard";

interface CollectionsComponentProps {
  report: CreditReport;
}

const CollectionsComponent: React.FC<CollectionsComponentProps> = ({ report }) => {
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const handleRetryExtraction = () => {
    setIsProcessing(true);
    toast.info("Retrying collections extraction...");
    
    // Simulate processing
    setTimeout(() => {
      setIsProcessing(false);
      toast.success("Collections extraction completed");
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

  // Use collections if they exist, otherwise an empty array
  const collections = report.collections && report.collections.length > 0 
    ? report.collections 
    : [];
  
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
      ) : collections.length > 0 ? (
        <CollectionsList 
          collections={collections} 
          showDebugInfo={showDebugInfo} 
        />
      ) : (
        <div className="py-8 text-center bg-muted/20 rounded-md">
          <p className="text-sm font-medium">No collection accounts found</p>
          <p className="text-xs text-muted-foreground mt-1">
            Good news! We didn't detect any collections in your credit report.
          </p>
        </div>
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
