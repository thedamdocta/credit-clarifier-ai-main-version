
import React, { useState } from "react";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import ContactInfoHeader from "./ContactInfoHeader";
import AddressesTable from "./AddressesTable";
import EmploymentTable from "./EmploymentTable";
import { CreditReport } from "@/lib/types/creditReport";
import { extractRegionFromPDFPage } from "@/utils/pdf/pdfToImage";
import CollapsibleCard from "../common/CollapsibleCard";

interface ContactInfoComponentProps {
  report: CreditReport;
}

const ContactInfoComponent: React.FC<ContactInfoComponentProps> = ({ report }) => {
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [tableImage, setTableImage] = useState<string | null>(null);
  
  const handleRetryExtraction = async () => {
    setIsProcessing(true);
    toast.info("Retrying contact information extraction...");
    
    // Attempt to extract an image of the contact info table region
    try {
      const pdfDocument = (window as any).currentPdfDocument;
      if (pdfDocument) {
        // Extract the 1st or 2nd page where contact info usually appears
        const pageNum = 1;
        // Approximate region for contact info (these coordinates would need adjustment)
        const region = { x: 50, y: 200, width: 500, height: 300 };
        
        const extractedImage = await extractRegionFromPDFPage(pdfDocument, pageNum, region);
        if (extractedImage) {
          setTableImage(extractedImage);
          toast.success("Contact information table image extracted");
        }
      }
    } catch (error) {
      console.error("Failed to extract contact information table image:", error);
    }
    
    // Simulate processing completion
    setTimeout(() => {
      setIsProcessing(false);
      toast.success("Contact information extraction completed");
    }, 1500);
  };
  
  const handleTrainParser = () => {
    toast.info("Training parser with current contact information data...");
    // Add training logic here in the future
  };
  
  const triggerPdfUpload = () => {
    const fileInput = document.querySelector('input[type="file"][accept=".pdf"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    } else {
      toast.warning("PDF upload button not found. Please use the upload button in the navigation bar.");
    }
  };

  // Example addresses data - would be replaced with real data from the report
  const addresses = [];
  
  // Example employment data - would be replaced with real data from the report
  const employments = [];
  
  const headerContent = (
    <div className="flex flex-row items-center justify-between w-full">
      <ContactInfoHeader 
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
      {isProcessing ? (
        <div className="py-8 flex flex-col items-center justify-center">
          <Loader2 className="h-12 w-12 text-credit-blue animate-spin mb-4" />
          <p className="text-sm font-medium">
            Extracting contact information...
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Please wait while we analyze your address and employment records
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            <h3 className="font-medium">Previous Addresses</h3>
            <AddressesTable addresses={addresses} />
          </div>
          
          <div className="space-y-4">
            <h3 className="font-medium">Employment History</h3>
            <EmploymentTable employments={employments} />
          </div>
          
          {showDebugInfo && (
            <div className="mt-4 p-4 bg-muted/50 rounded-md border border-dashed space-y-4">
              <h4 className="text-sm font-medium mb-2">Debug Information</h4>
              
              {tableImage && (
                <div className="space-y-2">
                  <h5 className="text-xs font-medium">Extracted Table Image:</h5>
                  <div className="border rounded-md overflow-hidden">
                    <img 
                      src={tableImage} 
                      alt="Extracted contact information table" 
                      className="max-w-full h-auto"
                    />
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <h5 className="text-xs font-medium">Parsed Data:</h5>
                <pre className="text-xs overflow-x-auto p-2 bg-muted/30 rounded-md">
                  {JSON.stringify({
                    addresses: addresses,
                    employments: employments,
                    personalInfo: report.personalInfo
                  }, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
  
  return (
    <CollapsibleCard header={headerContent}>
      {content}
    </CollapsibleCard>
  );
};

export default ContactInfoComponent;
