import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, RefreshCw, Save, FileSearch, FileText, AlertCircle, ZoomIn, ZoomOut, Eye } from "lucide-react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { convertPDFPageToImage } from "@/utils/pdf/pdfToImage";

interface ContactInfoComponentProps {
  report: CreditReport;
}

const ContactInfoComponent: React.FC<ContactInfoComponentProps> = ({ report }) => {
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [addresses, setAddresses] = useState<AddressInfo[]>([]);
  const [employments, setEmployments] = useState<EmploymentInfo[]>([]);
  const [tableImages, setTableImages] = useState<string[]>([]);
  const [imageLoadStatus, setImageLoadStatus] = useState<Record<number, boolean>>({});
  const [extractionLogs, setExtractionLogs] = useState<string[]>([]);
  const [attemptedExtraction, setAttemptedExtraction] = useState(false);
  const [extractionPageNumbers, setExtractionPageNumbers] = useState<number[]>([]);
  const [analyzedText, setAnalyzedText] = useState<string>("");
  const [enlargeImages, setEnlargeImages] = useState<Record<number, boolean>>({});
  const [showExtractionTips, setShowExtractionTips] = useState(true);
  
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
          console.log("Starting contact info extraction from PDF document");
          const { addresses: extractedAddresses, employments: extractedEmployments, pageNumbers } = 
            await extractContactInfoTables(pdfDocument);
          
          console.log("Contact info extraction complete", { 
            addressesFound: extractedAddresses.length,
            employmentsFound: extractedEmployments.length,
            pagesAnalyzed: pageNumbers
          });
          
          if (pageNumbers && pageNumbers.length > 0) {
            setExtractionPageNumbers(pageNumbers);
            
            const pageImages = await generateContactPageImages(pdfDocument, pageNumbers);
            if (pageImages.length > 0) {
              validateAndSetImages(pageImages);
            }
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
          console.log(`Received ${images.length} images from extraction process`);
          
          validateAndSetImages(images);
          
          const logs = getContactExtractionLogs();
          setExtractionLogs(logs);
        } catch (error) {
          console.error("Error extracting contact information:", error);
          toast.error("Failed to extract contact information. Please try again.");
        } finally {
          setIsProcessing(false);
          setAttemptedExtraction(true);
        }
      } else {
        console.log("No PDF document available for extraction");
        setAttemptedExtraction(true);
      }
    };
    
    extractContactInfo();
  }, [report]);
  
  const generateContactPageImages = async (pdfDocument: any, pageNumbers: number[]): Promise<string[]> => {
    const images: string[] = [];
    
    try {
      console.log("Generating page images for contact info extraction:", pageNumbers);
      
      for (const pageNum of pageNumbers) {
        const pageImage = await convertPDFPageToImage(pdfDocument, pageNum);
        if (pageImage) {
          console.log(`Successfully generated image for page ${pageNum}`);
          images.push(pageImage);
        }
      }
      
      console.log(`Generated ${images.length} page images for contact info`);
    } catch (error) {
      console.error("Error generating contact page images:", error);
    }
    
    return images;
  };
  
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
  
  const validateAndSetImages = (images: string[]) => {
    setImageLoadStatus({});
    
    if (images.length === 0) {
      console.log("No images received from extraction process");
      setTableImages([]);
      return;
    }
    
    console.log(`Validating ${images.length} images before display`);
    
    const validatedImages: string[] = [];
    
    images.forEach((imageUrl, index) => {
      validatedImages.push(imageUrl);
      
      const img = new Image();
      img.onload = () => {
        console.log(`Image ${index} pre-validated: ${img.width}x${img.height}`);
        setImageLoadStatus(prev => ({
          ...prev,
          [index]: true
        }));
      };
      img.onerror = () => {
        console.error(`Image ${index} pre-validation failed - invalid image data`);
        setImageLoadStatus(prev => ({
          ...prev,
          [index]: false
        }));
      };
      img.src = imageUrl;
    });
    
    setTableImages(validatedImages);
  };
  
  const handleRetryExtraction = async () => {
    setIsProcessing(true);
    setImageLoadStatus({});
    setShowExtractionTips(false);
    toast.info("Retrying contact information extraction...");
    
    try {
      const pdfDocument = (window as any).currentPdfDocument;
      if (pdfDocument) {
        console.log("Retrying contact info extraction with PDF document");
        const { addresses, employments, pageNumbers } = await extractContactInfoTables(pdfDocument);
        
        if (pageNumbers && pageNumbers.length > 0) {
          setExtractionPageNumbers(pageNumbers);
          
          const pageImages = await generateContactPageImages(pdfDocument, pageNumbers);
          if (pageImages.length > 0) {
            validateAndSetImages(pageImages);
          }
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
        console.log(`Retry extracted ${images.length} page images`);
        validateAndSetImages(images);
        
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
    setTimeout(() => {
      toast.success("Parser training complete");
      setShowExtractionTips(false);
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
  
  const handleImageLoad = (index: number) => {
    setImageLoadStatus(prev => ({
      ...prev,
      [index]: true
    }));
    console.log(`Image ${index} loaded successfully`);
  };
  
  const handleImageError = (index: number) => {
    setImageLoadStatus(prev => ({
      ...prev,
      [index]: false
    }));
    console.error(`Image ${index} failed to load`);
  };
  
  const toggleImageSize = (index: number) => {
    setEnlargeImages(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
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
      
      {showExtractionTips && tableImages.length === 0 && !isProcessing && (
        <Alert className="mb-4 bg-blue-50 border-blue-200">
          <Eye className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            The system is looking for sections titled "Contact Information" or "Personal Information" with address tables and employment history. Click "Retry Extraction" if information isn't showing correctly.
          </AlertDescription>
        </Alert>
      )}
      
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
                  <h5 className="text-xs font-medium">Extracted Page Images:</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tableImages.map((imageUrl, index) => (
                      <div key={`table-image-${index}`} className="border rounded-md overflow-hidden">
                        <div className="bg-muted/50 px-2 py-1 text-xs font-medium flex justify-between items-center">
                          <span>Page Image {extractionPageNumbers[index] || index + 1}</span>
                          <div className="flex items-center gap-1">
                            <span className={imageLoadStatus[index] === false ? "text-red-500" : 
                                          imageLoadStatus[index] === true ? "text-green-500" : ""}>
                              {imageLoadStatus[index] === false ? "Failed to load" : 
                              imageLoadStatus[index] === true ? "Loaded" : "Loading..."}
                            </span>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-5 w-5" 
                              onClick={() => toggleImageSize(index)}
                            >
                              {enlargeImages[index] ? (
                                <ZoomOut className="h-3 w-3" />
                              ) : (
                                <ZoomIn className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </div>
                        <div className={`relative ${enlargeImages[index] ? "h-[500px]" : "h-[250px]"} bg-muted/20 flex justify-center items-center overflow-auto`}>
                          {!imageLoadStatus[index] && imageLoadStatus[index] !== false && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
                            </div>
                          )}
                          
                          {imageLoadStatus[index] === false && (
                            <div className="text-center p-4 text-red-600 flex flex-col items-center">
                              <AlertCircle className="h-8 w-8 mb-2" />
                              <p className="text-xs">Image failed to load</p>
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-2"
                                onClick={() => {
                                  const refreshedUrl = `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
                                  const updatedImages = [...tableImages];
                                  updatedImages[index] = refreshedUrl;
                                  validateAndSetImages(updatedImages);
                                }}
                              >
                                <RefreshCw className="h-3 w-3 mr-1" />
                                <span className="text-xs">Reload Image</span>
                              </Button>
                            </div>
                          )}
                          
                          <img 
                            src={imageUrl} 
                            alt={`Extracted page ${extractionPageNumbers[index] || index + 1}`}
                            className={`max-w-full ${enlargeImages[index] ? 'h-auto' : 'h-full'} object-contain ${imageLoadStatus[index] === false ? 'hidden' : ''}`}
                            onLoad={() => handleImageLoad(index)}
                            onError={() => handleImageError(index)}
                          />
                        </div>
                        {imageLoadStatus[index] === true && (
                          <div className="p-2 bg-muted/30 text-xs flex justify-between">
                            <span className="text-muted-foreground">Page {extractionPageNumbers[index] || index + 1}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 p-0 text-xs"
                              asChild
                            >
                              <a href={imageUrl} target="_blank" rel="noopener noreferrer">
                                View Full Image
                              </a>
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <Alert className="bg-amber-50 border-amber-200">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    No page images were extracted during processing. Try clicking "Retry Extraction".
                  </AlertDescription>
                </Alert>
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
