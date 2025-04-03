
import React from "react";
import { Account } from "@/lib/types/creditReport";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface AccountHistoryProps {
  account: Account;
  showDebugInfo: boolean;
}

const AccountHistory: React.FC<AccountHistoryProps> = ({ account, showDebugInfo }) => {
  // Sample years and months for the payment history grid
  const years = ['2024', '2023', '2022', '2021', '2020'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  // Legend items for payment history
  const legend = [
    { code: "✓", description: "Paid as agreed", color: "bg-green-100 text-green-800" },
    { code: "30", description: "30 days late", color: "bg-yellow-100 text-yellow-800" },
    { code: "60", description: "60 days late", color: "bg-orange-100 text-orange-800" },
    { code: "90", description: "90 days late", color: "bg-red-100 text-red-800" },
    { code: "120", description: "120 days late", color: "bg-red-200 text-red-800" },
    { code: "150", description: "150 days late", color: "bg-red-300 text-red-900" },
    { code: "180", description: "180 days late", color: "bg-red-400 text-red-900" },
    { code: "CO", description: "Charge Off", color: "bg-red-500 text-white" },
    { code: "C", description: "Closed", color: "bg-gray-100 text-gray-800" },
    { code: "", description: "No data available", color: "bg-gray-50 text-gray-500" },
  ];

  return (
    <div className="space-y-4">
      <h3 className="font-medium">Payment History</h3>
      
      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-20">Year</TableHead>
              {months.map(month => (
                <TableHead key={month} className="text-center">
                  {month}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {years.map(year => (
              <TableRow key={year}>
                <TableCell className="font-medium">{year}</TableCell>
                {months.map(month => (
                  <TableCell key={`${year}-${month}`} className="text-center">
                    {/* This would come from actual payment history data */}
                    {Math.random() > 0.8 ? (
                      <Badge variant="outline" className={
                        Math.random() > 0.7 ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"
                      }>
                        {Math.random() > 0.7 ? "30" : "✓"}
                      </Badge>
                    ) : "—"}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      <div className="bg-muted/20 p-4 rounded-md border mt-4">
        <h4 className="text-sm font-semibold mb-2">Legend</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
          {legend.map(item => (
            <div key={item.code} className="flex items-center space-x-2">
              <Badge variant="outline" className={item.color}>
                {item.code || "—"}
              </Badge>
              <span className="text-xs">{item.description}</span>
            </div>
          ))}
        </div>
      </div>
      
      {showDebugInfo && (
        <div className="mt-4 p-4 bg-muted/50 rounded-md border border-dashed">
          <h4 className="text-sm font-medium mb-2">Debug Information</h4>
          <pre className="text-xs overflow-x-auto">
            {JSON.stringify(account.paymentHistory || [], null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default AccountHistory;
