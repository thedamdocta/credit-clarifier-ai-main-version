
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { 
  FileText, 
  Table as TableIcon, 
  Image as ImageIcon, 
  AlertCircle,
  RefreshCw,
  Check,
  Loader2,
  Eye
} from 'lucide-react';
import { usePdfExtraction } from '@/hooks/usePdfExtraction';
import { extractTableData } from '@/utils/tableExtraction';
import TableImageView from './TableImageView';
import AccountDataTable from './AccountDataTable';
import { AccountData } from '@/types/accountData';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface CreditAccountTableProps {
  reportId?: string;
}

const CreditAccountTable: React.FC<CreditAccountTableProps> = ({ reportId }) => {
  const [isExtracting, setIsExtracting] = useState(false);
  const [accountData, setAccountData] = useState<AccountData[]>([]);
  const [validationStatus, setValidationStatus] = useState<'none' | 'success' | 'error'>('none');
  const [extractionAttempts, setExtractionAttempts] = useState(0);
  const [activeTab, setActiveTab] = useState<string>("image");
  
  // Use our simplified PDF extraction hook
  const { 
    isProcessing,
    pageImages,
    selectedPage,
    setSelectedPage,
    extractPdfImages,
    currentImageUrl
  } = usePdfExtraction();
  
  // Function to extract account data from the current PDF page image
  const extractAccountData = async () => {
    if (!currentImageUrl) {
      toast.error("No image available. Please select a page first.");
      return;
    }
    
    try {
      setIsExtracting(true);
      setExtractionAttempts(prev => prev + 1);
      
      toast.info("Analyzing credit account table...");
      
      // Use our AI-powered table extraction utility
      const result = await extractTableData(currentImageUrl);
      
      if (result && result.data.length > 0) {
        setAccountData(result.data);
        setValidationStatus(result.confidence > 0.7 ? 'success' : 'error');
        
        toast.success("Successfully extracted credit account data!");
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
    }
  };
  
  // Function to validate the extracted data
  const validateExtractedData = async () => {
    if (!currentImageUrl || accountData.length === 0) {
      toast.error("Need both image and extracted data to validate");
      return;
    }
    
    try {
      toast.info("Validating extracted data with AI...");
      setIsExtracting(true);
      
      // Re-extract the data for validation
      const result = await extractTableData(currentImageUrl, true);
      
      if (result) {
        // Compare the new extraction with the current data
        const matchScore = compareExtractions(accountData, result.data);
        
        if (matchScore > 0.8) {
          toast.success("AI validation confirms accuracy of extracted data!");
          setValidationStatus('success');
        } else {
          toast.warning("AI validation found discrepancies in the data");
          setValidationStatus('error');
        }
      } else {
        toast.error("Validation failed - could not extract data for comparison");
        setValidationStatus('error');
      }
    } catch (error) {
      console.error("Error validating data:", error);
      toast.error("Data validation failed");
      setValidationStatus('error');
    } finally {
      setIsExtracting(false);
    }
  };
  
  // Helper function to compare two extractions
  const compareExtractions = (data1: AccountData[], data2: AccountData[]): number => {
    if (!data1.length || !data2.length) return 0;
    
    let matches = 0;
    let total = 0;
    
    // Find the Total row in both datasets for key comparison
    const totalRow1 = data1.find(row => row.accountType === 'Total');
    const totalRow2 = data2.find(row => row.accountType === 'Total');
    
    if (totalRow1 && totalRow2) {
      // Compare key fields
      if (totalRow1.totalBalance === totalRow2.totalBalance) matches++;
      if (totalRow1.open === totalRow2.open) matches++;
      if (totalRow1.withBalance === totalRow2.withBalance) matches++;
      if (totalRow1.payment === totalRow2.payment) matches++;
      total = 4;
    }
    
    return matches / (total || 1); // Avoid division by zero
  };
  
  // Effect to load images when reportId changes
  useEffect(() => {
    if (reportId) {
      extractPdfImages();
    }
    
    // Initialize with default empty data
    if (accountData.length === 0) {
      setAccountData([
        { accountType: 'Revolving', open: '0', withBalance: '0', totalBalance: '$0', available: '$0', creditLimit: '$0', debtToCredit: '0%', payment: '$0' },
        { accountType: 'Mortgage', open: '0', withBalance: '0', totalBalance: '$0', available: '$0', creditLimit: '$0', debtToCredit: '0%', payment: '$0' },
        { accountType: 'Installment', open: '0', withBalance: '0', totalBalance: '$0', available: '$0', creditLimit: '$0', debtToCredit: '0%', payment: '$0' },
        { accountType: 'Other', open: '0', withBalance: '0', totalBalance: '$0', available: '$0', creditLimit: '$0', debtToCredit: '0%', payment: '$0' },
        { accountType: 'Total', open: '0', withBalance: '0', totalBalance: '$0', available: '$0', creditLimit: '$0', debtToCredit: '0%', payment: '$0' }
      ]);
    }
  }, [reportId]);

  // Handler for the refresh button
  const handleRefreshPages = () => {
    extractPdfImages();
  };
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Credit Accounts</CardTitle>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="image" className="flex items-center gap-1">
              <ImageIcon className="h-4 w-4" />
              Image
            </TabsTrigger>
            <TabsTrigger value="table" className="flex items-center gap-1">
              <TableIcon className="h-4 w-4" />
              Table
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          <p>
            Your credit report includes information about activity on your credit accounts that may affect your credit score and rating.
          </p>
          
          {/* Status alerts */}
          {validationStatus === 'success' && (
            <Alert className="bg-green-50 border-green-200">
              <Check className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">Validation Successful</AlertTitle>
              <AlertDescription className="text-green-700">
                Data extraction validated successfully
              </AlertDescription>
            </Alert>
          )}
          
          {validationStatus === 'error' && (
            <Alert className="bg-red-50 border-red-200">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertTitle className="text-red-800">Validation Failed</AlertTitle>
              <AlertDescription className="text-red-700">
                Data validation found discrepancies. Try a different page or extraction method.
              </AlertDescription>
            </Alert>
          )}
          
          {/* No PDF alert */}
          {pageImages.length === 0 && (
            <Alert>
              <FileText className="h-4 w-4" />
              <AlertTitle>No PDF Detected</AlertTitle>
              <AlertDescription>
                Please upload a credit report PDF first to analyze account data.
              </AlertDescription>
            </Alert>
          )}
          
          {/* Page navigation controls */}
          {pageImages.length > 0 && (
            <div className="flex justify-between items-center">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedPage(Math.max(0, selectedPage - 1))}
                disabled={selectedPage === 0 || isProcessing}
              >
                Previous Page
              </Button>
              <span className="text-sm">
                Page {selectedPage + 1} of {pageImages.length}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedPage(Math.min(pageImages.length - 1, selectedPage + 1))}
                disabled={selectedPage === pageImages.length - 1 || isProcessing}
              >
                Next Page
              </Button>
            </div>
          )}
          
          {/* Main content tabs */}
          <Tabs value={activeTab} className="pt-2">
            <TabsContent value="image" className="m-0">
              <TableImageView 
                imageUrl={currentImageUrl} 
                isProcessing={isProcessing || isExtracting} 
              />
            </TabsContent>
            <TabsContent value="table" className="m-0">
              <AccountDataTable data={accountData} />
            </TabsContent>
          </Tabs>
          
          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-4 justify-end">
            <Button 
              variant="outline" 
              onClick={handleRefreshPages}
              disabled={isProcessing || isExtracting}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Pages
                </>
              )}
            </Button>
            
            <Button 
              variant="outline"
              onClick={extractAccountData}
              disabled={!currentImageUrl || isProcessing || isExtracting}
            >
              {isExtracting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Extracting...
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Extract Data
                </>
              )}
            </Button>
            
            <Button 
              onClick={validateExtractedData} 
              disabled={!currentImageUrl || accountData.length === 0 || isProcessing || isExtracting}
            >
              <Check className="h-4 w-4 mr-2" />
              Validate Data
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CreditAccountTable;
