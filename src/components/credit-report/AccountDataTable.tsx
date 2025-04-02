
import React from 'react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { AccountData } from '@/types/accountData';

interface AccountDataTableProps {
  data: AccountData[];
}

const AccountDataTable: React.FC<AccountDataTableProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 rounded-md">
        <p className="text-gray-500">No account data available.</p>
      </div>
    );
  }
  
  // Define the columns we want to display
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

  // Helper function to format values with currency symbol if needed
  const formatValue = (key: keyof AccountData, value: string | number | undefined | null): string => {
    if (value === undefined || value === null) return '—';
    
    // Properly format currency fields
    if (
      key === 'totalBalance' || 
      key === 'available' || 
      key === 'creditLimit' || 
      key === 'payment'
    ) {
      // If it's already a formatted string with currency symbol
      if (typeof value === 'string' && value.startsWith('$')) return value;
      
      // If it's a number or numeric string that needs formatting
      const numValue = typeof value === 'number' ? value : Number(value.replace(/[^0-9.-]/g, ''));
      if (!isNaN(numValue)) {
        return `$${numValue.toLocaleString()}`;
      }
    }
    
    // Ensure percentage has % symbol
    if (key === 'debtToCredit' && typeof value === 'string' && !value.includes('%')) {
      return `${value}%`;
    }
    
    return String(value);
  };
  
  return (
    <div className="w-full overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.key} className="font-medium">
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, index) => {
            // Check if this is the Total row for highlighting
            const isTotal = row.accountType === 'Total';
            
            return (
              <TableRow key={`${row.accountType}-${index}`} className={isTotal ? 'bg-muted/30 font-medium' : ''}>
                {columns.map((column) => (
                  <TableCell key={column.key}>
                    {formatValue(column.key as keyof AccountData, row[column.key as keyof AccountData])}
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

export default AccountDataTable;
