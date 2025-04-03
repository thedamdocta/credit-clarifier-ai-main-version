
import React, { useState } from 'react';
import { Account } from '@/lib/types/creditReport';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  AlertCircle, 
  CheckCircle2, 
  CreditCard, 
  Calendar, 
  Phone, 
  MapPin, 
  Clock,
  DollarSign
} from "lucide-react";

import AccountSummarySection from './detail/AccountSummarySection';
import AccountHistorySection from './detail/AccountHistorySection';
import AccountPaymentHistorySection from './detail/AccountPaymentHistorySection';
import AccountDetailsSection from './detail/AccountDetailsSection';
import AccountCommentSection from './detail/AccountCommentSection';

interface AccountDetailProps {
  account: Account;
}

const AccountDetail: React.FC<AccountDetailProps> = ({ account }) => {
  // Determine if this is a negative account
  const isNegative = 
    account.isNegative || 
    account.status?.toLowerCase().includes('charge') || 
    account.status?.toLowerCase().includes('collection') ||
    account.status?.toLowerCase().includes('foreclosure');

  return (
    <Card className={isNegative ? "border-red-400" : ""}>
      <CardHeader className={isNegative ? "bg-red-50" : ""}>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className={isNegative ? "text-red-500" : "text-credit-blue"} />
              <span>{account.accountName}</span>
              {account.status && (
                <Badge className={isNegative ? "bg-red-500" : ""}>
                  {account.status}
                </Badge>
              )}
              {isNegative && (
                <Badge variant="destructive" className="ml-2">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Negative Account
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1">
              Account #{account.accountNumber}
            </CardDescription>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Date Opened</div>
              <div className="font-medium">{account.openDate || 'Unknown'}</div>
            </div>
            {account.dateClosed && (
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Date Closed</div>
                <div className="font-medium">{account.dateClosed}</div>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className={isNegative ? "bg-red-50/30" : ""}>
        <Tabs defaultValue="summary" className="mt-2">
          <TabsList className="grid grid-cols-5">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="payment-history">Payment History</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="comments">Comments</TabsTrigger>
          </TabsList>
          
          <TabsContent value="summary">
            <AccountSummarySection account={account} isNegative={isNegative} />
          </TabsContent>
          
          <TabsContent value="history">
            <AccountHistorySection account={account} isNegative={isNegative} />
          </TabsContent>
          
          <TabsContent value="payment-history">
            <AccountPaymentHistorySection account={account} isNegative={isNegative} />
          </TabsContent>
          
          <TabsContent value="details">
            <AccountDetailsSection account={account} isNegative={isNegative} />
          </TabsContent>
          
          <TabsContent value="comments">
            <AccountCommentSection account={account} isNegative={isNegative} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default AccountDetail;
