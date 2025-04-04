
import React, { useState, useEffect } from "react";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import ContactInfoHeader from "./ContactInfoHeader";
import AddressesTable from "./AddressesTable";
import EmploymentTable from "./EmploymentTable";
import { CreditReport } from "@/lib/types/creditReport";
import { extractContactInfoTables, getContactTableImages, AddressInfo, EmploymentInfo } from "@/lib/ai/contactInfoExtraction";

interface ContactInfoComponentProps {
  report: CreditReport;
}

const ContactInfoComponent: React.FC<ContactInfoComponentProps> = ({ report }) => {
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [addresses, setAddresses] = useState<AddressInfo[]>([]);
  const [employments, setEmployments] = useState<EmploymentInfo[]>([]);
  const [tableImages, setTableImages] = useState<string[]>([]);
  
  // Extract contact information on component mount
  useEffect(() => {
    const extractContactInfo = async () => {
      const pdfDocument = (window as any).currentPdfDocument;
      if (pdfDocument) {
        setIsProcessing(true);
        try {
          const { addresses, employments } = await extractContactInfoTables(pdfDocument);
          setAddresses(addresses);
          setEmployments(employments);
          setTableImages(getContactTableImages());
        } catch (error) {
          console.error("Error extracting contact information:", error);
        } finally {
          setIsProcessing(false);
        }
      }
    };
    
    extractContactInfo();
  }, [report]);
  
  const handleRetryExtraction = async () => {
    setIsProcessing(true);
    toast.info("Retrying contact information extraction...");
    
    // Attempt to extract contact information
    try {
      const pdfDocument = (window as any).currentPdfDocument;
      if (pdfDocument) {
        const { addresses, employments } = await extractContactInfoTables(pdfDocument);
        setAddresses(addresses);
        setEmployments(employments);
        setTableImages(getContactTableImages());
        toast.success("Contact information extraction completed");
      } else {
        toast.error("PDF document not available. Please upload a PDF file first.");
      }
    } catch (error) {
      console.error("Failed to extract contact information:", error);
      toast.error("Failed to extract contact information");
    }
    
    setIsProcessing(false);
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
          <div className="space-y-4 mb-6">
            <h3 className="font-medium">Previous Addresses</h3>
            <AddressesTable addresses={addresses} />
          </div>
          
          <div className="space-y-4">
            <h3 className="font-medium">Employment History</h3>
            <EmploymentTable employments={employments} />
          </div>
          
          {showDebugInfo && (
            <div className="mt-6 p-4 bg-muted/50 rounded-md border border-dashed space-y-4">
              <h4 className="text-sm font-medium mb-2">Debug Information</h4>
              
              {tableImages.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-xs font-medium">Extracted Table Images:</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tableImages.map((imageUrl, index) => (
                      <div key={`table-image-${index}`} className="border rounded-md overflow-hidden">
                        <img 
                          src={imageUrl} 
                          alt={`Extracted contact information table ${index + 1}`}
                          className="max-w-full h-auto"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <h5 className="text-xs font-medium">Parsed Data:</h5>
                <pre className="text-xs overflow-x-auto p-2 bg-muted/30 rounded-md">
                  {JSON.stringify({
                    addresses,
                    employments,
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
    <div>
      <div className="flex justify-end mb-4">
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
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDebugInfo(!showDebugInfo)}
          >
            {showDebugInfo ? "Hide Debug Info" : "Show Debug Info"}
          </Button>
        </div>
      </div>
      
      {content}
    </div>
  );
};

export default ContactInfoComponent;
