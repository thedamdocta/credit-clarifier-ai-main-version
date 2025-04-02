
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { 
  FileText, 
  Table as TableIcon, 
  AlertCircle,
  Info,
  RefreshCw,
  ImageIcon,
  ChevronLeft,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AccountData } from '@/types/accountData';
import { useSimplePdfExtraction } from '@/hooks/useSimplePdfExtraction';

// Mock data for testing without AI
const DEFAULT_ACCOUNT_DATA: AccountData[] = [
  { accountType: 'Revolving', open: '7', withBalance: '6', totalBalance: '$18,533', available: '$4,447', creditLimit: '$22,980', debtToCredit: '80.6%', payment: '$425' },
  { accountType: 'Mortgage', open: '0', withBalance: '0', totalBalance: '$0', available: '$0', creditLimit: '$0', debtToCredit: '0.0%', payment: '$0' },
  { accountType: 'Installment', open: '2', withBalance: '2', totalBalance: '$31,533', available: '-$4,447', creditLimit: '$27,086', debtToCredit: '116.5%', payment: '$543' },
  { accountType: 'Other', open: '3', withBalance: '3', totalBalance: '$1,433', available: '$0', creditLimit: '$1,433', debtToCredit: '100.0%', payment: '$25' },
  { accountType: 'Total', open: '12', withBalance: '11', totalBalance: '$51,499', available: '$0', creditLimit: '$51,499', debtToCredit: '66.0%', payment: '$993' }
];

interface SimpleCreditAccountTableProps {
  reportId?: string;
}

const SimpleCreditAccountTable: React.FC<SimpleCreditAccountTableProps> = ({ reportId }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [accountData, setAccountData] = useState<AccountData[]>([]);
  const [activeTab, setActiveTab] = useState<string>("table");
  
  // Use the simple PDF extraction hook
  const { 
    isProcessing, 
    pageImages, 
    selectedPage, 
    setSelectedPage, 
    currentImageUrl, 
    extractPdfImages 
  } = useSimplePdfExtraction();
  
  // Simple function to load mock data - replace with real data fetching as needed
  const loadAccountData = () => {
    setIsLoading(true);
    
    // Simulate loading time
    setTimeout(() => {
      setAccountData(DEFAULT_ACCOUNT_DATA);
      setIsLoading(false);
      toast.success("Account data loaded successfully");
    }, 500); // Short delay to simulate loading
  };
  
  // Load initial data
  useEffect(() => {
    if (reportId) {
      loadAccountData();
      extractPdfImages();
    }
  }, [reportId]);
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <TableIcon className="h-5 w-5" />
          Credit Accounts
        </CardTitle>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="hidden sm:block">
          <TabsList>
            <TabsTrigger value="table" className="flex items-center gap-1">
              <TableIcon className="h-4 w-4" />
              Table
            </TabsTrigger>
            <TabsTrigger value="image" className="flex items-center gap-1">
              <ImageIcon className="h-4 w-4" />
              Image
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          <p>
            Your credit report includes information about activity on your credit accounts that may affect your credit score and rating.
          </p>
          
          {/* Show info alert when no data is available */}
          {accountData.length === 0 && !isLoading && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>No Account Data</AlertTitle>
              <AlertDescription>
                No account data is currently available. Click the "Load Data" button to view your account summary.
              </AlertDescription>
            </Alert>
          )}
          
          {/* Image navigation controls */}
          {activeTab === 'image' && pageImages.length > 0 && (
            <div className="flex justify-between items-center mb-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedPage(Math.max(0, selectedPage - 1))}
                disabled={selectedPage === 0 || isProcessing}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
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
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
          
          {/* Main content tabs */}
          <Tabs value={activeTab} className="pt-2">
            <TabsContent value="table" className="m-0">
              <div className="border rounded-md overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account Type</TableHead>
                      <TableHead>Open</TableHead>
                      <TableHead>With Balance</TableHead>
                      <TableHead>Total Balance</TableHead>
                      <TableHead>Available</TableHead>
                      <TableHead>Credit Limit</TableHead>
                      <TableHead>Debt-to-Credit</TableHead>
                      <TableHead>Payment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-24 text-center">
                          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                          <div className="text-muted-foreground mt-2">Loading account data...</div>
                        </TableCell>
                      </TableRow>
                    ) : accountData.length > 0 ? (
                      accountData.map((row, index) => (
                        <TableRow 
                          key={`${row.accountType}-${index}`} 
                          className={row.accountType === 'Total' ? 'bg-muted/30 font-medium' : ''}
                        >
                          <TableCell>{row.accountType}</TableCell>
                          <TableCell>{row.open}</TableCell>
                          <TableCell>{row.withBalance}</TableCell>
                          <TableCell>{row.totalBalance}</TableCell>
                          <TableCell>{row.available}</TableCell>
                          <TableCell>{row.creditLimit}</TableCell>
                          <TableCell>{row.debtToCredit}</TableCell>
                          <TableCell>{row.payment}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="h-24 text-center">
                          <div className="text-muted-foreground">No account data available</div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            <TabsContent value="image" className="m-0">
              <div className="border rounded-md p-4 min-h-[300px] flex items-center justify-center">
                {isProcessing ? (
                  <div className="text-center">
                    <Loader2 className="h-12 w-12 animate-spin mx-auto mb-2 text-muted-foreground" />
                    <p className="text-muted-foreground">Loading PDF pages...</p>
                  </div>
                ) : currentImageUrl ? (
                  <img 
                    src={currentImageUrl} 
                    alt={`Credit report page ${selectedPage + 1}`}
                    className="max-h-[500px] max-w-full object-contain"
                  />
                ) : (
                  <div className="text-center text-muted-foreground">
                    <ImageIcon className="h-12 w-12 mx-auto mb-2" />
                    <p>No PDF pages available</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
          
          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={extractPdfImages}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Load PDF Pages
                </>
              )}
            </Button>
            <Button
              variant="default"
              onClick={loadAccountData}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Load Account Data
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SimpleCreditAccountTable;
