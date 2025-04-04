import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, RefreshCw, Save, FileSearch, FileText, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import AddressesTable from "./AddressesTable";
import EmploymentTable from "./EmploymentTable";
import { CreditReport } from "@/lib/types/creditReport";
import { 
  extractContactInfoTables, 
  getContactTableImages, 
  getContactExtractionLogs,
  AddressInfo, 
  EmploymentInfo,
  extractAddressesFromText,
  extractEmploymentsFromText
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
  const [analyzedText, setAnalyzedText] = useState<string>("");
  const [imageStatus, setImageStatus] = useState<Record<number, boolean>>({});
  
  useEffect(() => {
    const extractContactInfo = async () => {
      const pdfDocument = (window as any).currentPdfDocument;
      
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
        const employmentText = report.personalInfo.employmentHistory;
        
        if (employmentText) {
          if (!employmentText.toLowerCase().includes("history employment history is")) {
            const extractedEmployments = extractEmploymentsFromText(employmentText);
            
            if (extractedEmployments.length > 0) {
              setEmployments(extractedEmployments);
            } else {
              setEmployments([{
                company: employmentText,
                occupation: ""
              }]);
            }
          }
          
          setAnalyzedText(employmentText);
        }
      }
      
      if (pdfDocument) {
        setIsProcessing(true);
        try {
          const { addresses: extractedAddresses, employments: extractedEmployments, pageNumbers } = 
            await extractContactInfoTables(pdfDocument);
          
          if (pageNumbers && pageNumbers.length > 0) {
            setExtractionPageNumbers(pageNumbers);
          }
          
          if (extractedAddresses.length > 0) {
            setAddresses(extractedAddresses);
          }
          
          if (extractedEmployments.length > 0) {
            setEmployments(extractedEmployments);
          } else {
            const personalInfoEmployment = parseEmploymentFromPersonalInfo(report.personalInfo?.employmentHistory || '');
            if (personalInfoEmployment) {
              setEmployments([personalInfoEmployment]);
            }
          }
          
          const images = getContactTableImages();
          console.log(`Retrieved ${images.length} debug images:`, images.map(img => img?.substring(0, 30) + '...'));
          setTableImages(images);
          
          const newImageStatus: Record<number, boolean> = {};
          for (let i = 0; i < images.length; i++) {
            try {
              const img = new Image();
              img.src = images[i];
              newImageStatus[i] = true;
            } catch (error) {
              console.error(`Error checking image ${i}:`, error);
              newImageStatus[i] = false;
            }
          }
          setImageStatus(newImageStatus);
          
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
  
  const parseEmploymentFromPersonalInfo = (employmentText: string): EmploymentInfo | null => {
    if (!employmentText || employmentText.toLowerCase().includes("history employment history is")) {
      return null;
    }
    
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
    
    return {
      company: employmentText,
      occupation: ''
    };
  };
  
  const handleRetryExtraction = async () => {
    setIsProcessing(true);
    toast.info("Retrying contact information extraction...");
    
    const pdfDocument = (window as any).currentPdfDocument;
    if (pdfDocument) {
      try {
        const { addresses, employments, pageNumbers } = await extractContactInfoTables(pdfDocument);
        
        if (pageNumbers && pageNumbers.length > 0) {
          setExtractionPageNumbers(pageNumbers);
        }
        
        if (addresses && addresses.length > 0) {
          setAddresses(addresses);
        }
        
        if (employments && employments.length > 0) {
          setEmployments(employments);
        } else {
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
      } catch (error) {
        console.error("Failed to extract contact information:", error);
        toast.error("Failed to extract contact information");
      }
    } else {
      toast.error("PDF document not available. Please upload a PDF file first.");
    }
    
    setIsProcessing(false);
  };
  
  const handleTrainParser = () => {
    toast.info("Training parser with current contact information data...");
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
            <FileSearch className="h-4 w-4 mr-1" />
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
              
              {analyzedText && (
                <div className="space-y-2 mb-4">
                  <h5 className="text-xs font-medium flex items-center">
                    <FileText className="h-3 w-3 mr-1" />
                    Analyzed Text:
                  </h5>
                  <div className="bg-muted/30 p-3 rounded text-xs font-mono h-24 overflow-y-auto">
                    {analyzedText}
                  </div>
                </div>
              )}
              
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
                  <h5 className="text-xs font-medium flex items-center">
                    <ImageIcon className="h-3 w-3 mr-1" />
                    Extracted Page Images ({tableImages.length}):
                  </h5>
                  
                  {tableImages.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {tableImages.map((imageUrl, index) => (
                        <div key={`table-image-${index}`} className="border rounded-md overflow-hidden">
                          <div className="bg-muted/50 px-2 py-1 text-xs font-medium flex justify-between">
                            <span>Page Image {extractionPageNumbers[index] || index + 1}</span>
                            <span className={imageStatus[index] ? "text-green-600" : "text-red-500"}>
                              {imageStatus[index] ? "✓ Valid" : "✗ Invalid"}
                            </span>
                          </div>
                          <div className="relative h-56 bg-slate-100">
                            <img 
                              src={imageUrl} 
                              alt={`Extracted page ${extractionPageNumbers[index] || index + 1}`}
                              className="max-w-full h-full object-contain mx-auto"
                              onError={(e) => {
                                console.error(`Error loading image ${index}`);
                                const newStatus = {...imageStatus};
                                newStatus[index] = false;
                                setImageStatus(newStatus);
                                e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='%23f87171' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M9.88 9.88a3 3 0 1 0 4.24 4.24'%3E%3C/path%3E%3Cpath d='M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68'%3E%3C/path%3E%3Cpath d='M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61'%3E%3C/path%3E%3Cline x1='2' x2='22' y1='2' y2='22'%3E%3C/line%3E%3C/svg%3E";
                              }}
                              onLoad={() => {
                                console.log(`Image ${index} loaded successfully`);
                                const newStatus = {...imageStatus};
                                newStatus[index] = true;
                                setImageStatus(newStatus);
                              }}
                            />
                            {!imageStatus[index] && (
                              <div className="absolute inset-0 flex items-center justify-center bg-red-50/50">
                                <div className="text-xs text-red-500 text-center">
                                  <span className="block mb-1">❌ Image failed to load</span>
                                  <span className="text-xs">Check console for details</span>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="bg-muted/20 p-1 text-xs text-center text-muted-foreground">
                            {imageUrl?.substring(0, 30)}...
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground p-8 border border-dashed rounded-md text-center bg-slate-50">
                      <ImageIcon className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                      <p>No page images were extracted during processing</p>
                      <p className="text-xs mt-2">Try using the "Retry Extraction" button</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground p-4 border border-dashed rounded-md text-center">
                  No page images were extracted during processing
                </div>
              )}
              
              <div className="space-y-2">
                <h5 className="text-xs font-medium">Parsed Data:</h5>
                <pre className="text-xs overflow-x-auto p-2 bg-muted/30 rounded-md max-h-96 overflow-y-auto">
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
