
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { 
  FileText, 
  Table as TableIcon, 
  Image as ImageIcon, 
  AlertCircle,
  RefreshCw,
  Check,
  X,
  Loader2
} from 'lucide-react';
import { usePdfImageExtraction } from '@/hooks/usePdfImageExtraction';
import { extractTableFromImage, convertTableToAccountData, validateAccountData } from '@/utils/tableExtraction';
import CreditTableImageDisplay from './CreditTableImageDisplay';
import NewCreditAccountTable from './NewCreditAccountTable';
import { AccountData } from '@/utils/tableExtraction';
import { extractTextFromImage } from '@/lib/ai/ocrExtraction';

interface NewCreditAccountsProps {
  reportId?: string;
}

const NewCreditAccounts: React.FC<NewCreditAccountsProps> = ({ reportId }) => {
  const [showImage, setShowImage] = useState(true);
  const [isExtracting, setIsExtracting] = useState(false);
  const [accountData, setAccountData] = useState<AccountData[]>([]);
  const [extractionAttempts, setExtractionAttempts] = useState(0);
  const [validationStatus, setValidationStatus] = useState<'none' | 'success' | 'error'>('none');
  const [processingTimeout, setProcessingTimeout] = useState<NodeJS.Timeout | null>(null);
  
  const { 
    isProcessing: isProcessingImages,
    pageImages,
    selectedPage,
    setSelectedPage,
    error: imageError,
    extractCurrentPdfImages,
    getAccountTableImage
  } = usePdfImageExtraction();
  
  // Get the current table image
  const tableImage = getAccountTableImage();
  
  // Function to extract account data from the current PDF page image
  const extractAccountData = async () => {
    // Clear any existing timeout
    if (processingTimeout) {
      clearTimeout(processingTimeout);
    }
    
    const imageUrl = getAccountTableImage();
    
    if (!imageUrl) {
      // If no image available, try to extract images from the PDF first
      try {
        toast.info("Extracting images from PDF...");
        const images = await extractCurrentPdfImages();
        if (images.length === 0) {
          toast.error("No PDF image available. Please upload a credit report PDF first.");
          return;
        }
      } catch (error) {
        console.error("Error extracting PDF images:", error);
        toast.error("Failed to extract images from PDF");
        return;
      }
    }
    
    try {
      setIsExtracting(true);
      setExtractionAttempts(prev => prev + 1);
      
      const updatedImageUrl = getAccountTableImage(); // Get the latest image after possible extraction
      if (!updatedImageUrl) {
        toast.error("Could not get image from PDF.");
        setIsExtracting(false);
        return;
      }
      
      // Set a timeout to prevent UI from freezing for too long
      const timeout = setTimeout(() => {
        setIsExtracting(false);
        toast.error("Extraction taking too long and was cancelled. Try again with a smaller PDF.");
      }, 30000); // 30 second timeout
      
      setProcessingTimeout(timeout);
      
      // Extract table data from the image
      console.log("Starting table extraction from image");
      const tableData = await extractTableFromImage(updatedImageUrl);
      
      // Clear the timeout since extraction completed
      clearTimeout(timeout);
      setProcessingTimeout(null);
      
      if (tableData && tableData.rows.length > 0) {
        // Convert to account data structure
        const newAccountData = convertTableToAccountData(tableData);
        setAccountData(newAccountData);
        
        // Validate the extracted data
        const isValid = validateAccountData(newAccountData);
        setValidationStatus(isValid ? 'success' : 'error');
        
        if (isValid) {
          toast.success("Successfully extracted credit account data!");
        } else {
          toast.warning("Extracted data might be incomplete. Try adjusting the page or extraction method.");
        }
      } else {
        toast.error("Could not detect account table in the image.");
        setValidationStatus('error');
      }
    } catch (error) {
      console.error("Error extracting account data:", error);
      toast.error("Failed to extract account data from image");
      setValidationStatus('error');
    } finally {
      setIsExtracting(false);
      if (processingTimeout) {
        clearTimeout(processingTimeout);
        setProcessingTimeout(null);
      }
    }
  };
  
  // Function to validate extracted data against original image using AI
  const validateExtractedData = async () => {
    const imageUrl = getAccountTableImage();
    if (!imageUrl || accountData.length === 0) {
      toast.error("Need both image and extracted data to validate");
      return;
    }
    
    try {
      toast.info("Validating extracted data with AI...");
      
      // Set a timeout for validation
      const validationTimeout = setTimeout(() => {
        toast.error("Validation is taking too long and was cancelled");
      }, 20000); // 20 seconds timeout
      
      // Extract text from image again for cross-validation
      const extractedText = await extractTextFromImage(imageUrl);
      
      clearTimeout(validationTimeout);
      
      if (!extractedText) {
        toast.error("Could not extract text from image for validation");
        setValidationStatus('error');
        return;
      }
      
      // Check if key elements are present in both datasets
      const totalRow = accountData.find(row => row.accountType === 'Total');
      
      if (totalRow && totalRow.totalBalance) {
        // Check if the total balance appears in the extracted text
        const cleanTotalBalance = totalRow.totalBalance.replace(/[$,]/g, '');
        const totalBalanceRegex = new RegExp(`\\b${cleanTotalBalance}\\b`);
        
        if (extractedText.match(totalBalanceRegex)) {
          toast.success("AI validation confirms accuracy of extracted data!");
          setValidationStatus('success');
        } else {
          toast.warning("AI validation found discrepancies in the data");
          setValidationStatus('error');
        }
      } else {
        toast.warning("Incomplete data prevents proper validation");
        setValidationStatus('error');
      }
    } catch (error) {
      console.error("Error validating data:", error);
      toast.error("Data validation failed");
      setValidationStatus('error');
    }
  };
  
  // Effect to run when reportId changes, with improved error handling
  useEffect(() => {
    if (reportId && pageImages.length === 0) {
      const extractImages = async () => {
        try {
          await extractCurrentPdfImages();
        } catch (error) {
          console.error("Failed to extract PDF images:", error);
          toast.error("Could not extract PDF pages. The file might be too large.");
        }
      };
      
      extractImages();
    }
    
    // Cleanup function to clear any timeouts when component unmounts
    return () => {
      if (processingTimeout) {
        clearTimeout(processingTimeout);
      }
    };
  }, [reportId]);
  
  // Create default empty account rows if we have no data
  useEffect(() => {
    if (accountData.length === 0) {
      const defaultRows: AccountData[] = [
        'Revolving', 'Mortgage', 'Installment', 'Other', 'Total'
      ].map(type => ({
        accountType: type,
        open: null,
        withBalance: null,
        totalBalance: null,
        available: null,
        creditLimit: null,
        debtToCredit: null,
        payment: null
      }));
      
      setAccountData(defaultRows);
    }
  }, []);
  
  // Function to trigger PDF upload
  const triggerPdfUpload = () => {
    const fileInput = document.querySelector('input[type="file"][accept=".pdf"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    } else {
      toast.warning("PDF upload button not found. Please use the upload button in the navigation bar.");
    }
  };
  
  // Button to navigate through pages
  const handlePageChange = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && selectedPage > 0) {
      setSelectedPage(selectedPage - 1);
    } else if (direction === 'next' && selectedPage < pageImages.length - 1) {
      setSelectedPage(selectedPage + 1);
    }
  };
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Credit Accounts</CardTitle>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={showImage ? "default" : "outline"}
            onClick={() => setShowImage(true)}
          >
            <ImageIcon className="h-4 w-4 mr-1" />
            Image
          </Button>
          <Button
            size="sm"
            variant={!showImage ? "default" : "outline"}
            onClick={() => setShowImage(false)}
          >
            <TableIcon className="h-4 w-4 mr-1" />
            Table
          </Button>
          
          <Button 
            size="sm" 
            variant="outline" 
            onClick={extractAccountData} 
            disabled={isExtracting || isProcessingImages}
          >
            {isExtracting ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Extracting...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-1" />
                Extract
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="mb-4">
          Your credit report includes information about activity on your credit accounts that may affect your credit score and rating.
        </p>
        
        {/* Status alerts */}
        {validationStatus === 'success' && (
          <Alert className="mb-4 bg-green-50 border-green-100">
            <Check className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-600">
              Data extraction validated successfully
            </AlertDescription>
          </Alert>
        )}
        
        {validationStatus === 'error' && (
          <Alert className="mb-4 bg-red-50 border-red-100">
            <X className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-600">
              Data validation failed. Try a different page or upload a clearer PDF.
            </AlertDescription>
          </Alert>
        )}
        
        {/* No PDF alert */}
        {!tableImage && (
          <Alert className="mb-4">
            <FileText className="h-4 w-4" />
            <AlertDescription>
              No PDF detected. Please upload a credit report PDF first.
              <Button variant="link" className="p-0 h-auto ml-2" onClick={triggerPdfUpload}>
                Upload PDF
              </Button>
            </AlertDescription>
          </Alert>
        )}
        
        {/* For very large PDFs, show performance warning */}
        {pageImages.length > 50 && (
          <Alert className="mb-4 bg-yellow-50 border-yellow-100">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-600">
              Large document detected ({pageImages.length} pages). Processing might be slower than usual.
            </AlertDescription>
          </Alert>
        )}
        
        {/* Multiple pages controls */}
        {pageImages.length > 1 && (
          <div className="flex justify-between items-center mb-4">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handlePageChange('prev')}
              disabled={selectedPage === 0}
            >
              Previous Page
            </Button>
            <span>
              Page {selectedPage + 1} of {pageImages.length}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handlePageChange('next')}
              disabled={selectedPage === pageImages.length - 1}
            >
              Next Page
            </Button>
          </div>
        )}
        
        {/* Display image or table based on toggle */}
        {showImage ? (
          <CreditTableImageDisplay 
            imageUrl={tableImage} 
            isProcessing={isProcessingImages || isExtracting} 
          />
        ) : (
          <NewCreditAccountTable accountData={accountData} />
        )}
        
        {/* Action buttons */}
        <div className="flex justify-end gap-2 mt-4">
          <Button 
            variant="outline" 
            onClick={extractCurrentPdfImages} 
            disabled={isProcessingImages}
          >
            {isProcessingImages ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <ImageIcon className="h-4 w-4 mr-2" />
                Re-extract PDF Pages
              </>
            )}
          </Button>
          
          <Button 
            onClick={validateExtractedData} 
            disabled={accountData.length === 0 || !tableImage || isExtracting || isProcessingImages}
          >
            <Check className="h-4 w-4 mr-2" />
            Validate with AI
          </Button>
        </div>
        
        {/* Extraction attempts counter for debugging */}
        {extractionAttempts > 0 && (
          <p className="text-xs text-gray-400 text-right mt-2">
            Extraction attempts: {extractionAttempts}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default NewCreditAccounts;
