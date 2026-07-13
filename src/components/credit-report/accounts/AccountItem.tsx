
import React, { useEffect, useState } from "react";
import { Account } from "@/lib/types/creditReport";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Calendar, InfoIcon, MessageSquare, Bug, CreditCard as PaymentIcon, FileImage } from "lucide-react";
import { humanizeExtractedText } from "@/utils/formatters/accountValueFormatters";
import { isNegativeAccountState } from "@/utils/accountNegativeState";
import { useReportWorkspace } from "@/features/workspace/ReportWorkspaceContext";
import AccountSummary from "./AccountSummary";
import AccountHistory from "./AccountHistory";
import AccountDetails from "./AccountDetails";
import AccountComments from "./AccountComments";
import AccountPaymentHistory from "./AccountPaymentHistory";
import SourceReportViewer from "../source/SourceReportViewer";

interface AccountItemProps {
  account: Account;
  sourceSessionId?: string | null;
}

const AccountItem: React.FC<AccountItemProps> = ({ account, sourceSessionId }) => {
  const [activeTab, setActiveTab] = useState("summary");
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const { advancedUiEnabled } = useReportWorkspace();
  const normalizedStatus = (account.status ?? "").toLowerCase();
  const normalizedAccountStatus = (account.accountStatus ?? "").toLowerCase();
  const hasReportedDateClosed = Boolean(
    account.dateClosed &&
    account.dateClosed.trim() &&
    account.dateClosed.trim().toLowerCase() !== "not reported"
  );
  const isClosedAccount =
    Boolean(account.isClosed) ||
    hasReportedDateClosed ||
    normalizedStatus.includes("closed") ||
    normalizedAccountStatus.includes("closed");
  
  const hasNegativeInfo = isNegativeAccountState({
    status: account.status,
    accountStatus: account.accountStatus,
    accountType: account.accountType,
    loanType: account.loanType,
    creditorClassification: account.creditorClassification,
    reportingCategory: account.reportingCategory,
    legalCategory: account.legalCategory,
    comments: account.comments,
    paymentHistoryList: account.paymentHistory,
    paymentHistoryRows: account.balanceHistory,
    paymentStatusCodes: account.paymentStatusCodes,
  });
  
  // Set card styling based on account status
  const cardStyle = hasNegativeInfo
    ? "border-[#f0a8a0] bg-[#fff7f6]"
    : "border-black/80 bg-white";

  useEffect(() => {
    if (!advancedUiEnabled) {
      setShowDebugInfo(false);
    }
  }, [advancedUiEnabled]);

  return (
    <Card className={cardStyle}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="flex items-center text-lg text-slate-900">
            <CreditCard className="h-5 w-5 mr-2" />
            {account.accountName}
            <Badge variant="outline" className="ml-2">
              {account.accountNumber || "Unknown #"}
            </Badge>
            {isClosedAccount && (
              <Badge variant="secondary" className="ml-2">
                Closed
              </Badge>
            )}
            {hasNegativeInfo && (
              <Badge variant="destructive" className="ml-2">
                Negative Account
              </Badge>
            )}
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline"
            >
              {humanizeExtractedText(account.status) || "Unknown Status"}
            </Badge>
            {advancedUiEnabled ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDebugInfo((prev) => !prev)}
                className="text-xs"
              >
                <Bug className="h-3 w-3 mr-1" />
                {showDebugInfo ? "Hide Debug" : "Show Debug"}
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="summary" onValueChange={setActiveTab} value={activeTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="summary">
              <InfoIcon className="h-4 w-4 mr-1" />
              Summary
            </TabsTrigger>
            <TabsTrigger value="account-history">
              <Calendar className="h-4 w-4 mr-1" />
              Account History
            </TabsTrigger>
            <TabsTrigger value="payment-history">
              <PaymentIcon className="h-4 w-4 mr-1" />
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
            <TabsTrigger value="source-report">
              <FileImage className="h-4 w-4 mr-1" />
              Source Report
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="summary">
            <AccountSummary account={account} showDebugInfo={advancedUiEnabled && showDebugInfo} />
          </TabsContent>
          
          <TabsContent value="account-history">
            <AccountHistory account={account} showDebugInfo={advancedUiEnabled && showDebugInfo} />
          </TabsContent>
          
          <TabsContent value="payment-history">
            <AccountPaymentHistory account={account} showDebugInfo={advancedUiEnabled && showDebugInfo} />
          </TabsContent>
          
          <TabsContent value="details">
            <AccountDetails account={account} showDebugInfo={advancedUiEnabled && showDebugInfo} />
          </TabsContent>
          
          <TabsContent value="comments">
            <AccountComments account={account} showDebugInfo={advancedUiEnabled && showDebugInfo} />
          </TabsContent>

          <TabsContent value="source-report">
            {activeTab === "source-report" ? (
              <SourceReportViewer
                sessionId={sourceSessionId}
                pageNumbers={account.sourcePages}
                title={`${account.accountName || "Account"} Source Pages`}
                description="These are the report pages used to extract this account. A page may appear in more than one account or component when Equifax reuses section space."
              />
            ) : null}
          </TabsContent>
        </Tabs>

        {advancedUiEnabled && showDebugInfo && (
          <div className="mt-4 space-y-4">
            {account.debugPageImages && account.debugPageImages.some((img) => img && img.length > 0) && (
              <div className="space-y-3">
                {account.debugPageImages.slice(0, 3).map((image, index) => (
                  <div key={index} className="border rounded-md overflow-hidden">
                    <div className="px-3 py-2 border-b text-xs font-semibold text-slate-500 bg-slate-100">
                      Source Page Image #{index + 1}
                    </div>
                    {image ? (
                      <img
                        src={image}
                        alt={`Account page ${index + 1}`}
                        className="w-full bg-slate-200 object-contain"
                      />
                    ) : (
                      <div className="p-3 text-xs text-slate-500 bg-slate-100 text-center">
                        Image not available
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {account.debugPages && account.debugPages.some((page) => page && page.trim().length > 0) && (
              <div className="space-y-3">
                {account.debugPages.slice(0, 3).map((page, index) => (
                  <div key={index} className="border rounded-md">
                    <div className="px-3 py-2 border-b text-xs font-semibold text-slate-500 bg-slate-100">
                      Source Page Snippet #{index + 1}
                    </div>
                    <div className="p-3 bg-slate-950 text-slate-200 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                      {page && page.trim().length > 0 ? page : "(No additional content available)"}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {account.debugSnippet && (
              <div className="border rounded-md">
                <div className="px-3 py-2 border-b text-xs font-semibold text-slate-500 bg-slate-100">
                  Full Extraction Snippet
                </div>
                <div className="p-3 bg-slate-950 text-slate-200 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                  {account.debugSnippet}
                </div>
              </div>
            )}

            <div className="bg-slate-900 text-slate-100 p-4 rounded-md text-xs font-mono overflow-x-auto">
              <pre>{JSON.stringify(account, null, 2)}</pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AccountItem;
