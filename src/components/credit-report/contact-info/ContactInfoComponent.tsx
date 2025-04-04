
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
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
  const [attemptedExtraction, setAttemptedExtraction] = useState(false);
  
  // Extract contact information on component mount
  useEffect(() => {
    const extractContactInfo = async () => {
      const pdfDocument = (window as any).currentPdfDocument;
      if (pdfDocument) {
        setIsProcessing(true);
        try {
          // Attempt to extract from PDF
          const { addresses, employments } = await extractContactInfoTables(pdfDocument);
          
          // If extraction was successful, use the extracted data
          if (addresses.length > 0) {
            setAddresses(addresses);
          } else if (report.personalInfo && report.personalInfo.addresses) {
            // Convert personal info addresses to the correct format if PDF extraction failed
            const formattedAddresses = report.personalInfo.addresses
              .filter(addr => addr !== 'Not Found' && addr.length > 5)
              .map((address, index) => ({
                address: address,
                status: index === 0 ? "Current" : "Former",
                dateReported: ""
              }));
            
            if (formattedAddresses.length > 0) {
              setAddresses(formattedAddresses);
            }
          }
          
          if (employments.length > 0) {
            setEmployments(employments);
          } else if (report.personalInfo && report.personalInfo.employmentHistory) {
            // Convert employment history to the correct format if PDF extraction failed
            setEmployments([{
              company: report.personalInfo.employmentHistory,
              occupation: ""
            }]);
          }
          
          // Get extracted table images for debugging
          setTableImages(getContactTableImages());
          
        } catch (error) {
          console.error("Error extracting contact information:", error);
        } finally {
          setIsProcessing(false);
          setAttemptedExtraction(true);
        }
      } else {
        // If no PDF document is available, try to use data from the report
        if (report.personalInfo && report.personalInfo.addresses) {
          const formattedAddresses = report.personalInfo.addresses
            .filter(addr => addr !== 'Not Found' && addr.length > 5)
            .map((address, index) => ({
              address: address,
              status: index === 0 ? "Current" : "Former",
              dateReported: ""
            }));
          
          if (formattedAddresses.length > 0) {
            setAddresses(formattedAddresses);
          }
        }
        
        if (report.personalInfo && report.personalInfo.employmentHistory) {
          setEmployments([{
            company: report.personalInfo.employmentHistory,
            occupation: ""
          }]);
        }
        
        setAttemptedExtraction(true);
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
    setTimeout(() => {
      toast.success("Parser training complete");
    }, 1500);
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
            {addresses.length > 0 ? (
              <AddressesTable addresses={addresses} />
            ) : attemptedExtraction ? (
              <div className="py-4 text-center bg-muted/20 rounded-md">
                <p className="text-sm text-muted-foreground">
                  No address information found in the report
                </p>
              </div>
            ) : (
              <div className="py-4 text-center bg-muted/20 rounded-md">
                <p className="text-sm text-muted-foreground">
                  Loading address information...
                </p>
              </div>
            )}
          </div>
          
          <div className="space-y-4">
            <h3 className="font-medium">Employment History</h3>
            {employments.length > 0 ? (
              <EmploymentTable employments={employments} />
            ) : attemptedExtraction ? (
              <div className="py-4 text-center bg-muted/20 rounded-md">
                <p className="text-sm text-muted-foreground">
                  No employment information found in the report
                </p>
              </div>
            ) : (
              <div className="py-4 text-center bg-muted/20 rounded-md">
                <p className="text-sm text-muted-foreground">
                  Loading employment information...
                </p>
              </div>
            )}
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
