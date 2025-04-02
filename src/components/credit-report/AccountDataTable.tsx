
import React from 'react';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { AccountData } from '@/types/accountData';

interface AccountDataTableProps {
  data: AccountData[];
}

const AccountDataTable: React.FC<AccountDataTableProps> = ({ data }) => {
  const headers = [
    "Account Type", 
    "Open", 
    "With Balance", 
    "Total Balance", 
    "Available", 
    "Credit Limit", 
    "Debt-to-Credit", 
    "Payment"
  ];
  
  const getRowClassName = (accountType: string) => {
    if (accountType.toLowerCase() === 'total') {
      return "bg-blue-50 font-medium";
    }
    return "";
  };
  
  const getCellValue = (row: AccountData, header: string): string => {
    // Map the header to the corresponding property in AccountData
    switch(header) {
      case "Account Type": return row.accountType || '';
      case "Open": return row.open || '';
      case "With Balance": return row.withBalance || '';
      case "Total Balance": return row.totalBalance || '';
      case "Available": return row.available || '';
      case "Credit Limit": return row.creditLimit || '';
      case "Debt-to-Credit": return row.debtToCredit || '';
      case "Payment": return row.payment || '';
      default: return '';
    }
  };

  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((header) => (
              <TableHead key={header} className="whitespace-nowrap">
                {header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, index) => (
            <TableRow key={index} className={getRowClassName(row.accountType || '')}>
              {headers.map((header) => (
                <TableCell key={`${index}-${header}`}>
                  {getCellValue(row, header)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default AccountDataTable;
