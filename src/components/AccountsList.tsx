
import React, { useState } from "react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  CreditCard, 
  Search, 
  MoreHorizontal, 
  AlertCircle,
  ChevronDown,
  Filter,
  X,
  Check
} from "lucide-react";
import { Account } from "@/lib/types/creditReport";

interface AccountsListProps {
  accounts: Account[];
  showDebugInfo?: boolean;
}

const AccountsList: React.FC<AccountsListProps> = ({ accounts, showDebugInfo = false }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  if (!accounts || accounts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <CreditCard className="mr-2 h-5 w-5" />
            Accounts
          </CardTitle>
          <CardDescription>No accounts found in the report</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center py-6">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No account data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const filteredAccounts = accounts.filter(account => {
    // Apply search filter
    const matchesSearch = searchTerm === "" || 
      account.accountName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.accountType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.accountNumber.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Apply status filter if active
    const matchesStatus = statusFilter === null || 
      account.status.toLowerCase().includes(statusFilter.toLowerCase());
    
    return matchesSearch && matchesStatus;
  });

  // Get unique statuses for the filter
  const uniqueStatuses = Array.from(
    new Set(accounts.map(account => account.status))
  ).filter(status => status !== '');

  const getStatusBadge = (status: string) => {
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes("open")) return <Badge>Open</Badge>;
    if (lowerStatus.includes("closed")) return <Badge variant="outline">Closed</Badge>;
    if (lowerStatus.includes("paid")) return <Badge className="bg-credit-green">Paid</Badge>;
    if (lowerStatus.includes("charged off") || lowerStatus.includes("collection")) {
      return <Badge variant="destructive">Negative</Badge>;
    }
    return <Badge variant="secondary">{status}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <CreditCard className="mr-2 h-5 w-5" />
          Accounts ({filteredAccounts.length})
        </CardTitle>
        <CardDescription>Summary of all accounts in your credit report</CardDescription>
        
        <div className="flex flex-col sm:flex-row gap-2 mt-4">
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
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="sm:w-auto">
                <Filter className="mr-2 h-4 w-4" />
                Filter
                {statusFilter && <Badge variant="secondary" className="ml-2">{statusFilter}</Badge>}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setStatusFilter(null)}>
                <span className="flex items-center">
                  All Statuses
                  {statusFilter === null && <Check className="ml-auto h-4 w-4" />}
                </span>
              </DropdownMenuItem>
              {uniqueStatuses.map((status, i) => (
                <DropdownMenuItem key={i} onClick={() => setStatusFilter(status)}>
                  <span className="flex items-center">
                    {status}
                    {statusFilter === status && <Check className="ml-auto h-4 w-4" />}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Open Date</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAccounts.map((account, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="font-medium">{account.accountName}</div>
                    <div className="text-xs text-muted-foreground hidden sm:block">
                      {account.accountNumber}
                    </div>
                  </TableCell>
                  <TableCell>{account.accountType}</TableCell>
                  <TableCell>{getStatusBadge(account.status)}</TableCell>
                  <TableCell className="hidden md:table-cell">{account.openDate}</TableCell>
                  <TableCell className="text-right font-medium">{account.balance}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>View Details</DropdownMenuItem>
                        <DropdownMenuItem>Payment History</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>Dispute Information</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default AccountsList;
