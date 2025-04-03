
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

  return (
    <div>
      {!hasRealData && (
        <Alert className="mb-4 bg-amber-50 border-amber-300">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-800">
            No account data found in your credit report. 
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
            {accountSummaries.map((summary) => (
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
