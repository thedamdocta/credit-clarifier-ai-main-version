
import React from 'react';
import { Account } from '@/lib/types/creditReport';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertCircle, CheckCircle, Clock, XCircle } from "lucide-react";
import { Badge } from '@/components/ui/badge';

interface AccountPaymentHistorySectionProps {
  account: Account;
  isNegative: boolean;
}

const AccountPaymentHistorySection: React.FC<AccountPaymentHistorySectionProps> = ({ account, isNegative }) => {
  // Define months for column headers
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  // Payment history legend items
  const legendItems = [
    { key: '✓', label: 'Paid on Time', icon: <CheckCircle className="h-3 w-3 text-green-600" /> },
    { key: '30', label: '30 Days Late', icon: <Clock className="h-3 w-3 text-amber-600" /> },
    { key: '60', label: '60 Days Late', icon: <Clock className="h-3 w-3 text-orange-600" /> },
    { key: '90', label: '90+ Days Late', icon: <XCircle className="h-3 w-3 text-red-600" /> },
    { key: 'CO', label: 'Charge-off', icon: <XCircle className="h-3 w-3 text-red-800" /> },
    { key: ' ', label: 'No Data Available', icon: <span className="h-3 w-3 block bg-gray-200 rounded-full" /> },
  ];

  // Helper function to get display value for payment history
  const getPaymentStatusDisplay = (value: string | boolean | undefined) => {
    if (value === '✓' || value === true) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    } else if (value === '30') {
      return <Badge variant="outline" className="text-amber-600 border-amber-600">30</Badge>;
    } else if (value === '60') {
      return <Badge variant="outline" className="text-orange-600 border-orange-600">60</Badge>;
    } else if (value === '90') {
      return <Badge variant="outline" className="text-red-600 border-red-600">90</Badge>;
    } else if (typeof value === 'string' && value.toLowerCase().includes('co')) {
      return <Badge variant="destructive">CO</Badge>;
    } else {
      return <span className="inline-block w-4 h-4 bg-gray-200 rounded-full"></span>;
    }
  };
  
  if (!account.paymentHistoryPatterns || Object.keys(account.paymentHistoryPatterns).length === 0) {
    return (
      <div className="py-8 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <h3 className="font-medium text-lg mb-1">No Payment History Available</h3>
        <p className="text-muted-foreground text-sm">
          No payment history data was found for this account.
        </p>
      </div>
    );
  }

  return (
    <div className="py-4">
      <div className="mb-4">
        <h3 className="font-medium text-lg">Payment History</h3>
        <p className="text-muted-foreground text-sm">
          {account.monthsReviewed 
            ? `View up to ${account.monthsReviewed} months of payment history on this account.` 
            : 'View payment history for this account.'}
        </p>
      </div>
      
      <div className="overflow-x-auto">
        <Table className="w-full">
          <TableHeader>
            <TableRow>
              <TableHead>Year</TableHead>
              {months.map((month) => (
                <TableHead key={month} className="text-center">{month}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.keys(account.paymentHistoryPatterns).map((year) => (
              <TableRow key={year}>
                <TableCell className="font-medium">{year}</TableCell>
                {months.map((month) => {
                  const value = account.paymentHistoryPatterns?.[year]?.[month];
                  
                  return (
                    <TableCell key={`${year}-${month}`} className="text-center p-2">
                      {getPaymentStatusDisplay(value)}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      <div className="mt-6 p-3 bg-muted rounded-md">
        <h4 className="text-sm font-medium mb-2">Legend</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {legendItems.map((item) => (
            <div key={item.key} className="flex items-center space-x-2">
              <div className="flex items-center justify-center w-6 h-6">
                {item.icon}
              </div>
              <span className="text-xs">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AccountPaymentHistorySection;
