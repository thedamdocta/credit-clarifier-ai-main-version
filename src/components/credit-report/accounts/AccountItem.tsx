
import React, { useState } from "react";
import { Account } from "@/lib/types/creditReport";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Calendar, InfoIcon, MessageSquare } from "lucide-react";
import AccountSummary from "./AccountSummary";
import AccountHistory from "./AccountHistory";
import AccountDetails from "./AccountDetails";
import AccountComments from "./AccountComments";

interface AccountItemProps {
  account: Account;
  showDebugInfo: boolean;
}

const AccountItem: React.FC<AccountItemProps> = ({ account, showDebugInfo }) => {
  const [activeTab, setActiveTab] = useState("summary");
  
  // Determine if account has negative information
  const hasNegativeInfo = 
    account.status?.toLowerCase().includes('late') || 
    account.status?.toLowerCase().includes('charge') ||
    account.status?.toLowerCase().includes('collection') ||
    account.status?.toLowerCase().includes('delinquent') ||
    account.paymentHistory?.some(history => {
      // Check if history is a string with delinquency codes
      if (typeof history === 'string') {
        return ['30', '60', '90', '120', '150', '180'].some(code => history.includes(code));
      }
      // If it's an object with a status property (for future compatibility)
      return false;
    });
  
  // Set card styling based on account status
  const cardStyle = hasNegativeInfo 
    ? "border-red-200 bg-red-50/50" 
    : "border-green-100 bg-green-50/20";

  // Set title style based on account status
  const titleStyle = hasNegativeInfo 
    ? "text-red-700" 
    : "text-credit-blue";

  return (
    <Card className={cardStyle}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className={`text-lg flex items-center ${titleStyle}`}>
            <CreditCard className="h-5 w-5 mr-2" />
            {account.accountName}
            <Badge variant={hasNegativeInfo ? "destructive" : "outline"} className="ml-2">
              {account.accountNumber || "Unknown #"}
            </Badge>
          </CardTitle>
          
          <Badge 
            variant={hasNegativeInfo ? "destructive" : "outline"}
            className={`${hasNegativeInfo ? 'bg-red-100 text-red-800 hover:bg-red-200' : ''}`}
          >
            {account.status || "Unknown Status"}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="summary" onValueChange={setActiveTab} value={activeTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="summary">
              <InfoIcon className="h-4 w-4 mr-1" />
              Summary
            </TabsTrigger>
            <TabsTrigger value="history">
              <Calendar className="h-4 w-4 mr-1" />
              Payment History
            </TabsTrigger>
            <TabsTrigger value="details">
              <CreditCard className="h-4 w-4 mr-1" />
              Account Details
            </TabsTrigger>
            <TabsTrigger value="comments">
              <MessageSquare className="h-4 w-4 mr-1" />
              Comments
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="summary">
            <AccountSummary account={account} showDebugInfo={showDebugInfo} />
          </TabsContent>
          
          <TabsContent value="history">
            <AccountHistory account={account} showDebugInfo={showDebugInfo} />
          </TabsContent>
          
          <TabsContent value="details">
            <AccountDetails account={account} showDebugInfo={showDebugInfo} />
          </TabsContent>
          
          <TabsContent value="comments">
            <AccountComments account={account} showDebugInfo={showDebugInfo} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default AccountItem;
