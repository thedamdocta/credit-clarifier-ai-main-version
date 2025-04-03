import React from "react";
import { Account } from "@/lib/types/creditReport";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AccountPaymentHistoryProps {
  account: Account;
  showDebugInfo: boolean;
}

const AccountPaymentHistory: React.FC<AccountPaymentHistoryProps> = ({ account, showDebugInfo }) => {
  // Sample payment history data that would come from the account in a real implementation
  const paymentHistory = account.paymentHistory || [];

  // Status code explanations
  const statusCodes = {
    "OK": "Payment made on time",
    "30": "30 days late",
    "60": "60 days late",
    "90": "90 days late",
    "120": "120 days late",
    "COL": "In collections",
    "X": "No data available"
  };

  const getStatusBadgeVariant = (status: string) => {
    if (status === "OK" || status === "Current") return "outline";
    if (status === "X" || status === "N/A") return "secondary";
    return "destructive";
  };

  return (
    <div className="space-y-6">
      <Card className="border border-gray-200">
        <CardHeader className="py-3">
          <CardTitle className="text-md font-medium">Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 text-sm">
            <p>Payment history is a key factor in your credit score. This shows your payment status for each month.</p>
          </div>

          {/* Status Code Legend */}
          <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {Object.entries(statusCodes).map(([code, description]) => (
              <div key={code} className="flex items-center space-x-2">
                <Badge variant={getStatusBadgeVariant(code)} className="w-10 text-center">
                  {code}
                </Badge>
                <span className="text-xs">{description}</span>
              </div>
            ))}
          </div>

          {/* Payment History Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Year</TableHead>
                <TableHead>Jan</TableHead>
                <TableHead>Feb</TableHead>
                <TableHead>Mar</TableHead>
                <TableHead>Apr</TableHead>
                <TableHead>May</TableHead>
                <TableHead>Jun</TableHead>
                <TableHead>Jul</TableHead>
                <TableHead>Aug</TableHead>
                <TableHead>Sep</TableHead>
                <TableHead>Oct</TableHead>
                <TableHead>Nov</TableHead>
                <TableHead>Dec</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* If no real payment history data, show placeholder row */}
              {paymentHistory.length === 0 ? (
                <TableRow>
                  <TableCell className="font-medium">2024</TableCell>
                  {Array(12).fill(null).map((_, index) => (
                    <TableCell key={index}>
                      <Badge variant="secondary" className="w-10 text-center">X</Badge>
                    </TableCell>
                  ))}
                </TableRow>
              ) : (
                // Otherwise show real payment history data
                // This would need to be structured based on the actual data format
                <TableRow>
                  <TableCell className="font-medium">2024</TableCell>
                  {Array(12).fill(null).map((_, index) => {
                    const status = paymentHistory[index] || "X";
                    return (
                      <TableCell key={index}>
                        <Badge 
                          variant={getStatusBadgeVariant(status)} 
                          className="w-10 text-center"
                        >
                          {status}
                        </Badge>
                      </TableCell>
                    );
                  })}
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="mt-4 text-xs text-muted-foreground">
            <p>Data reported by creditor. Contact your creditor for more details or to dispute any errors.</p>
          </div>
        </CardContent>
      </Card>

      {showDebugInfo && (
        <div className="mt-4 p-4 bg-muted/50 rounded-md border border-dashed">
          <h4 className="text-sm font-medium mb-2">Debug Information</h4>
          <pre className="text-xs overflow-x-auto">
            {JSON.stringify(account, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default AccountPaymentHistory;
