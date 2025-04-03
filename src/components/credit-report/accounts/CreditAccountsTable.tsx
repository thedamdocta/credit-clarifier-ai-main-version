
import React from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { AccountSummary } from "@/lib/types/creditReport";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CreditAccountsTableProps {
  accountSummaries: AccountSummary[];
  onRequestUpload?: () => void;
}

const CreditAccountsTable: React.FC<CreditAccountsTableProps> = ({ 
  accountSummaries,
  onRequestUpload
}) => {
  // Check if we have any real data
  const hasRealData = accountSummaries.some(summary => 
    (summary.open && summary.open !== "0") || 
    (summary.withBalance && summary.withBalance !== "0") || 
    (summary.totalBalance && summary.totalBalance !== "$0" && summary.totalBalance !== "0")
  );

  // Debug log the data we're getting
  React.useEffect(() => {
    console.log("CreditAccountsTable received summaries:", accountSummaries);
    console.log("Has real data:", hasRealData);
  }, [accountSummaries, hasRealData]);

  // Use sample data instead of showing empty table
  const useSampleData = !hasRealData;
  
  const sampleData: AccountSummary[] = [
    {
      accountType: "Revolving",
      open: "4",
      withBalance: "3",
      totalBalance: "$16,355",
      available: "$18,645",
      creditLimit: "$35,000",
      payment: "$627"
    },
    {
      accountType: "Mortgage",
      open: "1",
      withBalance: "1",
      totalBalance: "$245,678",
      available: "$0",
      creditLimit: "$245,678",
      payment: "$1,856"
    },
    {
      accountType: "Installment",
      open: "2",
      withBalance: "2",
      totalBalance: "$204,150",
      available: "$15,455",
      creditLimit: "$219,605",
      payment: "$1,289"
    },
    {
      accountType: "Other",
      open: "0",
      withBalance: "0",
      totalBalance: "$0",
      available: "$0",
      creditLimit: "$0",
      payment: "$0"
    },
    {
      accountType: "Total",
      open: "7",
      withBalance: "6",
      totalBalance: "$466,183",
      available: "$34,100",
      creditLimit: "$500,283",
      payment: "$3,772"
    }
  ];

  // Determine which data to show
  const dataToDisplay = useSampleData ? sampleData : accountSummaries;

  return (
    <div>
      {!hasRealData && (
        <Alert className="mb-4 bg-amber-50 border-amber-300">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-800">
            No account data found in your credit report. Showing sample data for demonstration.
            {onRequestUpload && (
              <Button 
                variant="link" 
                className="p-0 h-auto text-amber-600 underline ml-1"
                onClick={onRequestUpload}
              >
                Try uploading a better PDF or click "Retry Extraction".
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account Type</TableHead>
              <TableHead className="text-right">Open</TableHead>
              <TableHead className="text-right">With Balance</TableHead>
              <TableHead className="text-right">Total Balance</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="text-right">Credit Limit</TableHead>
              <TableHead className="text-right">Payment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dataToDisplay.map((summary) => (
              <TableRow key={summary.accountType}>
                <TableCell className="font-medium">{summary.accountType}</TableCell>
                <TableCell className="text-right">{summary.open || '-'}</TableCell>
                <TableCell className="text-right">{summary.withBalance || '-'}</TableCell>
                <TableCell className="text-right">{summary.totalBalance || '-'}</TableCell>
                <TableCell className="text-right">{summary.available || '-'}</TableCell>
                <TableCell className="text-right">{summary.creditLimit || '-'}</TableCell>
                <TableCell className="text-right">{summary.payment || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default CreditAccountsTable;
