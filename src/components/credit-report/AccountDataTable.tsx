
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
    const key = header.toLowerCase().replace(/-/g, '').replace(/ /g, '') as keyof AccountData;
    
    if (key === 'accounttype') return row.accountType || '';
    if (key === 'open') return row.open || '';
    if (key === 'withbalance') return row.withBalance || '';
    if (key === 'totalbalance') return row.totalBalance || '';
    if (key === 'available') return row.available || '';
    if (key === 'creditlimit') return row.creditLimit || '';
    if (key === 'debttocredit') return row.debtToCredit || '';
    if (key === 'payment') return row.payment || '';
    
    return '';
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
