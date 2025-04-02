
import React from 'react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { AccountData } from '@/types/accountData';

interface NewCreditAccountTableProps {
  accountData: AccountData[];
}

const NewCreditAccountTable: React.FC<NewCreditAccountTableProps> = ({ accountData }) => {
  if (!accountData || accountData.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 rounded-md">
        <p className="text-gray-500">No account data available.</p>
      </div>
    );
  }
  
  // Define the consistent columns we want to display
  const columns = [
    { key: 'accountType', label: 'Account Type' },
    { key: 'open', label: 'Open' },
    { key: 'withBalance', label: 'With Balance' },
    { key: 'totalBalance', label: 'Total Balance' },
    { key: 'available', label: 'Available' },
    { key: 'creditLimit', label: 'Credit Limit' },
    { key: 'debtToCredit', label: 'Debt-to-Credit' },
    { key: 'payment', label: 'Payment' }
  ];
  
  return (
    <div className="w-full overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map(column => (
              <TableHead key={column.key} className="font-medium">
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {accountData.map((row, index) => {
            // Check if this is the Total row for highlighting
            const isTotal = row.accountType === 'Total';
            
            return (
              <TableRow key={`${row.accountType}-${index}`} isHighlighted={isTotal}>
                {columns.map(column => (
                  <TableCell key={column.key} className={isTotal ? 'font-medium' : ''}>
                    {row[column.key as keyof AccountData] || '—'}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default NewCreditAccountTable;
