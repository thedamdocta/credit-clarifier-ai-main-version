
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

  // Status code explanations - expanded with more codes from reference image
  const statusCodes = {
    "OK": "Payment made on time",
    "30": "30 days late",
    "60": "60 days late",
    "90": "90 days late",
    "120": "120 days late",
    "150": "150 days past due",
    "180": "180 days past due",
    "COL": "In collections",
    "C": "Collection account",
    "CO": "Charge-off",
    "B": "Included in bankruptcy",
    "R": "Repossession",
    "V": "Voluntary surrender",
    "F": "Foreclosure",
    "TNT": "Too new to rate",
    "X": "No data available"
  };

  const getStatusBadgeVariant = (status: string) => {
    if (status === "OK" || status === "Current") return "outline";
    if (status === "X" || status === "N/A") return "secondary";
    return "destructive";
  };

  // Use "-" for years when no data is available
  const years = ["-", "-", "-"];

  return (
    <div className="space-y-6">
      <Card className="border border-gray-200">
        <CardHeader className="py-3">
          <CardTitle className="text-md font-medium">Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 text-sm">
            <p className="mb-2">Payment history is a key factor in your credit score. This shows your payment status for each month.</p>
            <p className="text-xs text-muted-foreground mb-4">View up to 7 years of monthly payment history on this account. The numbers indicate days a payment was past due; letters indicate other account events.</p>
          </div>

          {/* Status Code Legend with uniform badge style */}
          <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {Object.entries(statusCodes).map(([code, description]) => (
              <div key={code} className="flex items-center space-x-2">
                <Badge 
                  variant={code === "OK" ? "outline" : code === "X" ? "secondary" : "destructive"}
                  className={`min-w-[50px] text-center py-0.5 font-medium flex justify-center items-center ${
                    code === "OK" ? "bg-green-100 text-green-600 hover:bg-green-100 hover:text-green-600" :
                    code === "X" ? "bg-gray-100 hover:bg-gray-100" : 
                    "bg-red-500 hover:bg-red-500"
                  }`}
                >
                  {code}
                </Badge>
                <span className="text-xs">{description}</span>
              </div>
            ))}
          </div>

          {/* Payment History Table with uniform badge style */}
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
              {years.map((year, yearIndex) => (
                <TableRow key={yearIndex}>
                  <TableCell className="font-medium">{year}</TableCell>
                  {Array(12).fill(null).map((_, index) => (
                    <TableCell key={`${yearIndex}-${index}`} className="p-2 text-center">
                      <Badge 
                        variant="secondary" 
                        className="min-w-[40px] w-10 py-0.5 flex justify-center items-center bg-gray-100 hover:bg-gray-100 font-medium"
                      >
                        X
                      </Badge>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Day Ranges Legend with uniform badge style */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="flex items-center">
              <Badge 
                variant="outline" 
                className="min-w-[40px] py-0.5 mr-2 bg-green-100 text-green-600 hover:bg-green-100 hover:text-green-600 flex justify-center items-center"
              >
                OK
              </Badge>
              <span>Paid on Time</span>
            </div>
            <div className="flex items-center">
              <Badge 
                variant="destructive" 
                className="min-w-[40px] py-0.5 mr-2 bg-red-500 hover:bg-red-500 flex justify-center items-center"
              >
                30
              </Badge>
              <span>30 Days Past Due</span>
            </div>
            <div className="flex items-center">
              <Badge 
                variant="destructive" 
                className="min-w-[40px] py-0.5 mr-2 bg-red-500 hover:bg-red-500 flex justify-center items-center"
              >
                60
              </Badge>
              <span>60 Days Past Due</span>
            </div>
            <div className="flex items-center">
              <Badge 
                variant="destructive" 
                className="min-w-[40px] py-0.5 mr-2 bg-red-500 hover:bg-red-500 flex justify-center items-center"
              >
                90
              </Badge>
              <span>90 Days Past Due</span>
            </div>
          </div>

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
