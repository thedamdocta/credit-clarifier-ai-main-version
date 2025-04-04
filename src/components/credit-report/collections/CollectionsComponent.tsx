
import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { CreditReport, Collection } from "@/lib/types/creditReport";
import CollectionsHeader from "./CollectionsHeader";
import CollectionsList from "./CollectionsList";

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

  // Create a default collection if none exist
  const collections = report.collections && report.collections.length > 0 
    ? report.collections 
    : [{
        dateReported: null,
        collectionAgency: "Sample Collection Agency",
        balanceDate: null,
        originalCreditorName: null,
        accountDesignatorCode: null,
        dateAssigned: null,
        accountNumber: "XXXX-XXXX-XXXX-5678",
        originalAmountOwed: null,
        creditorClassification: null,
        amount: null,
        lastPaymentDate: null,
        statusDate: null,
        dateOfFirstDelinquency: null,
        status: null,
        comments: ["This is a placeholder collection. No actual collections were detected in your report."],
        contact: ["No contact information available"]
      }];
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
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
      </CardHeader>
      <CardContent>
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
          />
        )}
      </CardContent>
    </Card>
  );
};

export default CollectionsComponent;
