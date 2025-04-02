
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Table as TableIcon, 
  Image as ImageIcon, 
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useSimplePdfExtraction } from '@/hooks/useSimplePdfExtraction';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { AccountData } from '@/types/accountData';

interface SimpleCreditAccountTableProps {
  reportId?: string;
}

// Sample mock data that looks like real extracted account data
const MOCK_ACCOUNT_DATA: AccountData[] = [
  { accountType: 'Revolving', open: '3', withBalance: '2', totalBalance: '$4,230', available: '$5,770', creditLimit: '$10,000', debtToCredit: '42.3%', payment: '$120' },
  { accountType: 'Mortgage', open: '1', withBalance: '1', totalBalance: '$156,500', available: '$0', creditLimit: '$0', debtToCredit: '0%', payment: '$980' },
  { accountType: 'Installment', open: '2', withBalance: '2', totalBalance: '$15,420', available: '$0', creditLimit: '$0', debtToCredit: '0%', payment: '$450' },
  { accountType: 'Other', open: '1', withBalance: '0', totalBalance: '$0', available: '$0', creditLimit: '$0', debtToCredit: '0%', payment: '$0' },
  { accountType: 'Total', open: '7', withBalance: '5', totalBalance: '$176,150', available: '$5,770', creditLimit: '$10,000', debtToCredit: '42.3%', payment: '$1,550' }
];

const SimpleCreditAccountTable: React.FC<SimpleCreditAccountTableProps> = ({ reportId }) => {
  const [activeTab, setActiveTab] = useState<string>("image");
  const [accountData] = useState<AccountData[]>(MOCK_ACCOUNT_DATA);
  
  // Use our simplified PDF extraction hook
  const { 
    isProcessing,
    pageImages,
    selectedPage,
    setSelectedPage,
    extractPdfImages,
    currentImageUrl,
    processingProgress
  } = useSimplePdfExtraction();
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Credit Accounts</CardTitle>
        <div className="flex items-center gap-2">
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
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Your credit report includes account information that affects your credit score.
            </p>
            <Button
              onClick={extractPdfImages}
              disabled={isProcessing}
              size="sm"
              className="ml-auto"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : pageImages.length > 0 ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Load Pages
                </>
              )}
            </Button>
          </div>

          {isProcessing && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Processing PDF</span>
                <span>{processingProgress}%</span>
              </div>
              <Progress value={processingProgress} className="h-2" />
            </div>
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
                <ChevronLeft className="h-4 w-4 mr-1" />
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
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
          
          {/* Main content tabs */}
          <TabsContent value="image" className="m-0 mt-2">
            {currentImageUrl ? (
              <div className="border rounded-md overflow-hidden">
                <img 
                  src={currentImageUrl} 
                  alt={`Credit report page ${selectedPage + 1}`}
                  className="w-full h-auto object-contain"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 border border-dashed rounded-lg">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-center text-muted-foreground">
                  No PDF pages loaded. Click "Load Pages" to view your credit report.
                </p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="table" className="m-0 mt-2">
            <div className="border rounded-md overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted">
                    <th className="p-2 text-left">Account Type</th>
                    <th className="p-2 text-right">Open</th>
                    <th className="p-2 text-right">With Balance</th>
                    <th className="p-2 text-right">Total Balance</th>
                    <th className="p-2 text-right">Available</th>
                    <th className="p-2 text-right">Credit Limit</th>
                    <th className="p-2 text-right">Debt-to-Credit</th>
                    <th className="p-2 text-right">Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {accountData.map((account, index) => (
                    <tr 
                      key={`account-${index}`}
                      className={account.accountType === 'Total' ? 'bg-muted/50 font-medium' : 'border-t'}
                    >
                      <td className="p-2">{account.accountType}</td>
                      <td className="p-2 text-right">{account.open}</td>
                      <td className="p-2 text-right">{account.withBalance}</td>
                      <td className="p-2 text-right">{account.totalBalance}</td>
                      <td className="p-2 text-right">{account.available}</td>
                      <td className="p-2 text-right">{account.creditLimit}</td>
                      <td className="p-2 text-right">{account.debtToCredit}</td>
                      <td className="p-2 text-right">{account.payment}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </div>
      </CardContent>
    </Card>
  );
};

export default SimpleCreditAccountTable;
