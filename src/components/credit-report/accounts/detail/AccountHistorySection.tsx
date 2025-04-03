
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
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";
import { AlertCircle, DollarSign } from "lucide-react";
import { cn } from '@/lib/utils';

interface AccountHistorySectionProps {
  account: Account;
  isNegative: boolean;
}

const AccountHistorySection: React.FC<AccountHistorySectionProps> = ({ account, isNegative }) => {
  // Define available history types
  const historyTypes = [
    { 
      id: 'balanceHistory', 
      name: 'Balance', 
      data: account.balanceHistory,
      icon: <DollarSign className="h-4 w-4" />
    },
    { 
      id: 'scheduledPaymentHistory', 
      name: 'Scheduled Payment', 
      data: account.scheduledPaymentHistory 
    },
    { 
      id: 'actualPaymentHistory', 
      name: 'Actual Payment', 
      data: account.actualPaymentHistory 
    },
    { 
      id: 'creditLimitHistory', 
      name: 'Credit Limit', 
      data: account.creditLimitHistory 
    },
    { 
      id: 'pastDueHistory', 
      name: 'Amount Past Due', 
      data: account.pastDueHistory 
    },
  ].filter(type => type.data && Object.keys(type.data || {}).length > 0);

  // Helper function to get months in order
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  // Create helper function to determine if a cell has data
  const hasValue = (value: string | undefined): boolean => {
    return value !== undefined && value !== null && value !== '';
  };
  
  if (historyTypes.length === 0) {
    return (
      <div className="py-8 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <h3 className="font-medium text-lg mb-1">No History Available</h3>
        <p className="text-muted-foreground text-sm">
          No account history data was found for this account.
        </p>
      </div>
    );
  }
  
  return (
    <div className="py-4">
      <div className="mb-4">
        <h3 className="font-medium text-lg">Account History</h3>
        <p className="text-muted-foreground text-sm">
          The tables below show up to 24 months of historical data. If a cell is blank, this data was not provided to the credit bureau.
        </p>
      </div>
      
      <Accordion type="single" collapsible className="w-full">
        {historyTypes.map((historyType, index) => (
          <AccordionItem key={index} value={historyType.id}>
            <AccordionTrigger className={cn(
              "font-medium",
              isNegative && historyType.id === 'pastDueHistory' ? "text-red-600" : ""
            )}>
              {historyType.icon && <span className="mr-2">{historyType.icon}</span>}
              {historyType.name} History
            </AccordionTrigger>
            <AccordionContent>
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
                    {Object.keys(historyType.data || {}).map((year) => (
                      <TableRow key={year}>
                        <TableCell className="font-medium">{year}</TableCell>
                        {months.map((month) => {
                          const value = historyType.data?.[year]?.[month];
                          const isPastDue = historyType.id === 'pastDueHistory' && hasValue(value);
                          
                          return (
                            <TableCell 
                              key={`${year}-${month}`} 
                              className={cn(
                                "text-center",
                                isPastDue && isNegative ? "text-red-600 font-medium" : ""
                              )}
                            >
                              {value || '-'}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};

export default AccountHistorySection;
