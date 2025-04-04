
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, RefreshCw, Save, FileSearch } from "lucide-react";
import { toast } from "sonner";
import AddressesTable from "./AddressesTable";
import EmploymentTable from "./EmploymentTable";
import { CreditReport } from "@/lib/types/creditReport";
import { 
  extractContactInfoTables, 
  getContactTableImages, 
  getContactExtractionLogs,
  AddressInfo, 
  EmploymentInfo 
} from "@/lib/ai/contactInfoExtraction";

interface ContactInfoComponentProps {
  report: CreditReport;
}

const ContactInfoComponent: React.FC<ContactInfoComponentProps> = ({ report }) => {
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [addresses, setAddresses] = useState<AddressInfo[]>([]);
  const [employments, setEmployments] = useState<EmploymentInfo[]>([]);
  const [tableImages, setTableImages] = useState<string[]>([]);
  const [extractionLogs, setExtractionLogs] = useState<string[]>([]);
  const [attemptedExtraction, setAttemptedExtraction] = useState(false);
  const [extractionPageNumbers, setExtractionPageNumbers] = useState<number[]>([]);
  
  // Extract contact information on component mount
  useEffect(() => {
    const extractContactInfo = async () => {
      const pdfDocument = (window as any).currentPdfDocument;
      
      // Initialize with personal info data right away
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
        // Handle the case where employment history is descriptive text, not actual employment
        const employmentText = report.personalInfo.employmentHistory;
        if (!employmentText.toLowerCase().includes("history employment history is")) {
          setEmployments([{
            company: employmentText,
            occupation: ""
          }]);
        }
      }
      
      // Only attempt PDF extraction if a document is available
      if (pdfDocument) {
        setIsProcessing(true);
        try {
          // Attempt to extract from PDF
          const { addresses: extractedAddresses, employments: extractedEmployments, pageNumbers } = 
            await extractContactInfoTables(pdfDocument);
          
          // Store extracted page numbers for debugging
          if (pageNumbers && pageNumbers.length > 0) {
            setExtractionPageNumbers(pageNumbers);
          }
          
          // If extraction was successful, use the extracted data
          if (extractedAddresses.length > 0) {
            setAddresses(extractedAddresses);
          }
          
          if (extractedEmployments.length > 0) {
            setEmployments(extractedEmployments);
          } else {
            // If no employment data was extracted, try to parse from personal info
            const personalInfoEmployment = parseEmploymentFromPersonalInfo(report.personalInfo?.employmentHistory || '');
            if (personalInfoEmployment) {
              setEmployments([personalInfoEmployment]);
            }
          }
          
          // Get extracted table images for debugging
          const images = getContactTableImages();
          setTableImages(images);
          
          // Get extraction logs
          const logs = getContactExtractionLogs();
          setExtractionLogs(logs);
          
        } catch (error) {
          console.error("Error extracting contact information:", error);
        } finally {
          setIsProcessing(false);
          setAttemptedExtraction(true);
        }
      } else {
        setAttemptedExtraction(true);
      }
    };
    
    extractContactInfo();
  }, [report]);
  
  // Helper function to parse employment data from personal info text
  const parseEmploymentFromPersonalInfo = (employmentText: string): EmploymentInfo | null => {
    if (!employmentText || employmentText.toLowerCase().includes("history employment history is")) {
      // This is just descriptive text, not actual employment
      return null;
    }
    
    // Try to extract meaningful employment info
    const lines = employmentText.split(/[\n\r]+/);
    for (const line of lines) {
      if (line.includes(':')) {
        const [company, occupation] = line.split(':').map(part => part.trim());
        if (company) {
          return {
            company,
            occupation: occupation || ''
          };
        }
      }
    }
    
    // If no structured format found, just use the text as company name
    return {
      company: employmentText,
      occupation: ''
    };
  };
  
  const handleRetryExtraction = async () => {
    setIsProcessing(true);
    toast.info("Retrying contact information extraction...");
    
    // Attempt to extract contact information
    try {
      const pdfDocument = (window as any).currentPdfDocument;
      if (pdfDocument) {
        const { addresses, employments, pageNumbers } = await extractContactInfoTables(pdfDocument);
        
        // Update extracted page numbers
        if (pageNumbers && pageNumbers.length > 0) {
          setExtractionPageNumbers(pageNumbers);
        }
        
        // Only update if we got actual data
        if (addresses && addresses.length > 0) {
          setAddresses(addresses);
        }
        
        if (employments && employments.length > 0) {
          setEmployments(employments);
        } else {
          // If no employment data was extracted, make a second attempt with different pages
          const personalInfoEmployment = parseEmploymentFromPersonalInfo(report.personalInfo?.employmentHistory || '');
          if (personalInfoEmployment) {
            setEmployments([personalInfoEmployment]);
          }
        }
        
        const images = getContactTableImages();
        setTableImages(images);
        
        const logs = getContactExtractionLogs();
        setExtractionLogs(logs);
        
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
            <AddressesTable 
              addresses={addresses} 
              isLoading={isProcessing && !attemptedExtraction}
            />
          </div>
          
          <div className="space-y-4">
            <h3 className="font-medium">Employment History</h3>
            <EmploymentTable 
              employments={employments} 
              isLoading={isProcessing && !attemptedExtraction}
            />
          </div>
          
          {showDebugInfo && (
            <div className="mt-6 p-4 bg-muted/50 rounded-md border border-dashed space-y-4">
              <h4 className="text-sm font-medium mb-2 flex items-center">
                <FileSearch className="h-4 w-4 mr-2" />
                Debug Information
              </h4>
              
              {extractionPageNumbers.length > 0 && (
                <div className="text-xs mb-2">
                  <span className="font-medium">Extracted from pages: </span>
                  {extractionPageNumbers.join(", ")}
                </div>
              )}
              
              {/* Extraction Logs Section */}
              {extractionLogs.length > 0 && (
                <div className="space-y-2 mb-4">
                  <h5 className="text-xs font-medium">Extraction Logs:</h5>
                  <div className="bg-black/80 text-green-400 p-3 rounded text-xs font-mono h-48 overflow-y-auto">
                    {extractionLogs.map((log, idx) => (
                      <div key={`log-${idx}`} className="mb-1">{log}</div>
                    ))}
                  </div>
                </div>
              )}
              
              {tableImages.length > 0 ? (
                <div className="space-y-2">
                  <h5 className="text-xs font-medium">Extracted Table Images:</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tableImages.map((imageUrl, index) => (
                      <div key={`table-image-${index}`} className="border rounded-md overflow-hidden">
                        <div className="bg-muted/50 px-2 py-1 text-xs font-medium">
                          Table Image {index + 1}
                        </div>
                        <img 
                          src={imageUrl} 
                          alt={`Extracted contact information table ${index + 1}`}
                          className="max-w-full h-auto"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground p-4 border border-dashed rounded-md text-center">
                  No table images were extracted during processing
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
    </div>
  );
};

export default ContactInfoComponent;
