
import React from 'react';
import { Account } from '@/lib/types/creditReport';
import { 
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  CreditCard, 
  DollarSign,
} from "lucide-react";

interface AccountSummarySectionProps {
  account: Account;
  isNegative: boolean;
}

const AccountSummarySection: React.FC<AccountSummarySectionProps> = ({ account, isNegative }) => {
  // Helper to format text color based on account status
  const textColorClass = isNegative ? "text-red-700" : "text-credit-blue";
  
  // Summary data to display
  const summaryItems = [
    { 
      label: 'Reported Balance', 
      value: account.reportedBalance || account.balance || '$0',
      icon: <DollarSign className={`h-4 w-4 ${textColorClass}`} /> 
    },
    { 
      label: 'Available Credit', 
      value: account.availableCredit || account.creditLimit || 'N/A',
      icon: <CreditCard className={`h-4 w-4 ${textColorClass}`} /> 
    },
    { 
      label: 'Account Status', 
      value: account.status || 'Unknown',
      icon: isNegative ? 
        <AlertTriangle className="h-4 w-4 text-red-600" /> : 
        <CheckCircle2 className="h-4 w-4 text-green-600" />
    },
    { 
      label: 'Date Opened', 
      value: account.openDate || 'Unknown',
      icon: <Calendar className={`h-4 w-4 ${textColorClass}`} /> 
    },
  ];

  // Description based on account type
  const getAccountDescription = () => {
    const type = account.accountType?.toLowerCase() || '';
    
    if (type.includes('revolving')) {
      return "This is a revolving credit account, such as a credit card or a line of credit.";
    } else if (type.includes('mortgage')) {
      return "This is a mortgage loan used to finance the purchase of real estate.";
    } else if (type.includes('installment')) {
      return "This is an installment loan with fixed payments over a set period of time.";
    } else {
      return "This account appears on your credit report and may affect your credit score.";
    }
  };

  return (
    <div className="py-4 space-y-6">
      <div>
        <h3 className="font-medium text-lg mb-2">Account Summary</h3>
        <p className="text-muted-foreground text-sm">
          {getAccountDescription()}
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {summaryItems.map((item, index) => (
          <div key={index} className="flex items-center space-x-4 p-4 border rounded-lg">
            <div className="p-2 rounded-full bg-muted">
              {item.icon}
            </div>
            <div>
              <div className="text-sm text-muted-foreground">{item.label}</div>
              <div className="font-medium">{item.value}</div>
            </div>
          </div>
        ))}
      </div>
      
      {account.activityDesignator && (
        <div className={`p-4 border rounded-lg ${isNegative ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-200"}`}>
          <h4 className="font-medium mb-1">Account Activity Status</h4>
          <p className={isNegative ? "text-red-700" : "text-blue-700"}>
            {account.activityDesignator}
          </p>
        </div>
      )}
      
      {account.contactInfo && (
        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-2">Creditor Information</h4>
          <div className="text-sm">
            <p className="font-medium">{account.contactInfo.name || account.accountName}</p>
            {account.contactInfo.address && (
              <p className="text-muted-foreground">
                {account.contactInfo.address}<br />
                {account.contactInfo.city && `${account.contactInfo.city}, `}
                {account.contactInfo.state && `${account.contactInfo.state} `}
                {account.contactInfo.zip && account.contactInfo.zip}
              </p>
            )}
            {account.contactInfo.phone && (
              <p className="text-muted-foreground mt-1">{account.contactInfo.phone}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountSummarySection;
