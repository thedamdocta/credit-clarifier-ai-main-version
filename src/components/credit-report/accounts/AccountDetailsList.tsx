
import React, { useState } from 'react';
import { Account } from '@/lib/types/creditReport';
import { Input } from "@/components/ui/input";
import { Button } from '@/components/ui/button';
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Filter, 
  X, 
  AlertCircle, 
  CreditCard,
  ChevronDown,
  ArrowUpDown
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import AccountDetail from './AccountDetail';

interface AccountsDetailListProps {
  accounts: Account[];
}

const AccountDetailsList: React.FC<AccountsDetailListProps> = ({ accounts }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'default' | 'asc' | 'desc'>('default');
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

  // Extract all unique statuses and account types
  const uniqueStatuses = Array.from(
    new Set(accounts.map(account => account.status))
  ).filter(status => status);
  
  const uniqueTypes = Array.from(
    new Set(accounts.map(account => account.accountType))
  ).filter(type => type);

  // Check if account has negative markings
  const isNegativeAccount = (account: Account): boolean => {
    return (
      (account.isNegative === true) ||
      (account.status?.toLowerCase()?.includes('charge') || false) ||
      (account.status?.toLowerCase()?.includes('collection') || false) ||
      (account.amountPastDue && account.amountPastDue !== '$0')
    );
  };
  
  // Apply filters and sorting
  const filteredAccounts = accounts
    .filter(account => {
      // Apply search filter
      const matchesSearch = searchTerm === "" || 
        account.accountName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.accountType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.accountNumber?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Apply status filter if active
      const matchesStatus = statusFilter === null || 
        account.status?.toLowerCase().includes(statusFilter.toLowerCase());
      
      // Apply type filter if active
      const matchesType = typeFilter === null || 
        account.accountType?.toLowerCase().includes(typeFilter.toLowerCase());
      
      return matchesSearch && matchesStatus && matchesType;
    })
    .sort((a, b) => {
      if (sortOrder === 'default') {
        // Default sort: negative accounts first, then by name
        const aIsNegative = isNegativeAccount(a);
        const bIsNegative = isNegativeAccount(b);
        
        if (aIsNegative && !bIsNegative) return -1;
        if (!aIsNegative && bIsNegative) return 1;
        return (a.accountName || '').localeCompare(b.accountName || '');
      } else if (sortOrder === 'asc') {
        return (a.accountName || '').localeCompare(b.accountName || '');
      } else {
        return (b.accountName || '').localeCompare(a.accountName || '');
      }
    });
  
  if (!accounts || accounts.length === 0) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <h3 className="font-medium text-lg mb-1">No Accounts Found</h3>
        <p className="text-muted-foreground">
          No account data is available in your credit report.
        </p>
      </div>
    );
  }

  // If an account is selected, show its details
  if (selectedAccount) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setSelectedAccount(null)}
            className="mb-2"
          >
            ← Back to Accounts List
          </Button>
          
          {filteredAccounts.length > 1 && (
            <div className="flex space-x-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  const currentIndex = filteredAccounts.findIndex(a => a === selectedAccount);
                  if (currentIndex > 0) {
                    setSelectedAccount(filteredAccounts[currentIndex - 1]);
                  }
                }}
                disabled={filteredAccounts.indexOf(selectedAccount) === 0}
              >
                ← Previous Account
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  const currentIndex = filteredAccounts.findIndex(a => a === selectedAccount);
                  if (currentIndex < filteredAccounts.length - 1) {
                    setSelectedAccount(filteredAccounts[currentIndex + 1]);
                  }
                }}
                disabled={filteredAccounts.indexOf(selectedAccount) === filteredAccounts.length - 1}
              >
                Next Account →
              </Button>
            </div>
          )}
        </div>
        
        <AccountDetail account={selectedAccount} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search accounts..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-9 w-9 p-0"
              onClick={() => setSearchTerm("")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="sm:w-auto">
                <Filter className="mr-2 h-4 w-4" />
                Filter
                {(statusFilter || typeFilter) && (
                  <Badge variant="secondary" className="ml-2">
                    {(statusFilter && typeFilter) ? '2' : '1'}
                  </Badge>
                )}
                <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Filter Accounts</DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  Status
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setStatusFilter(null)}>
                  <span className="flex items-center justify-between w-full">
                    All Statuses
                    {statusFilter === null && <Badge variant="outline">✓</Badge>}
                  </span>
                </DropdownMenuItem>
                {uniqueStatuses.map((status, i) => (
                  <DropdownMenuItem key={i} onClick={() => setStatusFilter(status || null)}>
                    <span className="flex items-center justify-between w-full">
                      {status || 'Unknown'}
                      {statusFilter === status && <Badge variant="outline">✓</Badge>}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              
              <DropdownMenuSeparator />
              
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  Account Type
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setTypeFilter(null)}>
                  <span className="flex items-center justify-between w-full">
                    All Types
                    {typeFilter === null && <Badge variant="outline">✓</Badge>}
                  </span>
                </DropdownMenuItem>
                {uniqueTypes.map((type, i) => (
                  <DropdownMenuItem key={i} onClick={() => setTypeFilter(type || null)}>
                    <span className="flex items-center justify-between w-full">
                      {type || 'Unknown'}
                      {typeFilter === type && <Badge variant="outline">✓</Badge>}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="sm:w-auto">
                <ArrowUpDown className="mr-2 h-4 w-4" />
                Sort
                <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSortOrder('default')}>
                <span className="flex items-center justify-between w-full">
                  Default (Negative First)
                  {sortOrder === 'default' && <Badge variant="outline">✓</Badge>}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOrder('asc')}>
                <span className="flex items-center justify-between w-full">
                  A-Z
                  {sortOrder === 'asc' && <Badge variant="outline">✓</Badge>}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOrder('desc')}>
                <span className="flex items-center justify-between w-full">
                  Z-A
                  {sortOrder === 'desc' && <Badge variant="outline">✓</Badge>}
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      <div className="space-y-4">
        {filteredAccounts.map((account, index) => {
          const isNegative = isNegativeAccount(account);
          const accountStatus = account.status || "Not Specified";
          const extraInfo = account.activityDesignator || 
                           (account.paymentHistory && account.paymentHistory.length > 0 ? "Payment history available" : "");
          
          return (
            <div
              key={index}
              className={`border rounded-lg p-4 hover:bg-muted/50 cursor-pointer transition-colors ${
                isNegative ? 'border-red-300 bg-red-50/50' : ''
              }`}
              onClick={() => setSelectedAccount(account)}
            >
              <div className="flex flex-col lg:flex-row lg:justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium text-lg">
                      {account.accountName || 'Unknown Account'}
                    </h3>
                    {isNegative && (
                      <Badge variant="destructive" className="uppercase text-xs">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Negative
                      </Badge>
                    )}
                    {accountStatus && (
                      <Badge variant={isNegative ? "outline" : "secondary"}>
                        {accountStatus}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="text-sm text-muted-foreground">
                    {account.accountType || 'Unknown Type'} • #{account.accountNumber || 'Unknown'}
                  </div>
                  
                  {extraInfo && (
                    <div className="text-sm mt-1">{extraInfo}</div>
                  )}
                  
                  {account.termsFrequency && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Terms Frequency: {account.termsFrequency} {account.termDuration ? `• Term Duration: ${account.termDuration}` : ''}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center space-x-8">
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Balance</div>
                    <div className="font-medium">
                      {account.balance || account.reportedBalance || '$0'}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Opened</div>
                    <div className="font-medium">{account.openDate || 'Not Found'}</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        
        {filteredAccounts.length === 0 && (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
            <h3 className="font-medium text-lg mb-1">No matching accounts</h3>
            <p className="text-muted-foreground text-sm">
              Try adjusting your search or filters
            </p>
            <Button 
              variant="ghost" 
              className="mt-4"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter(null);
                setTypeFilter(null);
              }}
            >
              Reset Filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountDetailsList;
