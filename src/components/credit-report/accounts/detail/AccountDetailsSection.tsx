
import React from 'react';
import { Account } from '@/lib/types/creditReport';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface AccountDetailsSectionProps {
  account: Account;
  isNegative: boolean;
}

const AccountDetailsSection: React.FC<AccountDetailsSectionProps> = ({ account, isNegative }) => {
  // Define all possible detail fields
  const detailFields = [
    { 
      label: 'High Credit', 
      value: account.highCredit,
      isNegative: false 
    },
    { 
      label: 'Credit Limit', 
      value: account.creditLimit,
      isNegative: false 
    },
    { 
      label: 'Terms Frequency', 
      value: account.termsFrequency,
      isNegative: false 
    },
    { 
      label: 'Term Duration',
      value: account.termDuration,
      isNegative: false 
    },
    { 
      label: 'Balance', 
      value: account.balance,
      isNegative: false 
    },
    { 
      label: 'Amount Past Due', 
      value: account.amountPastDue,
      isNegative: !!account.amountPastDue && account.amountPastDue !== '$0'
    },
    { 
      label: 'Date Opened', 
      value: account.openDate,
      isNegative: false 
    },
    { 
      label: 'Date Reported', 
      value: account.dateReported,
      isNegative: false 
    },
    { 
      label: 'Date of Last Payment', 
      value: account.dateLastPayment,
      isNegative: false 
    },
    { 
      label: 'Date of Last Activity', 
      value: account.dateLastActivity,
      isNegative: false 
    },
    { 
      label: 'Scheduled Payment Amount', 
      value: account.scheduledPaymentAmount,
      isNegative: false 
    },
    { 
      label: 'Months Reviewed', 
      value: account.monthsReviewed?.toString(),
      isNegative: false 
    },
    { 
      label: 'Activity Designator', 
      value: account.activityDesignator,
      isNegative: account.activityDesignator?.toLowerCase().includes('charged') || 
                  account.activityDesignator?.toLowerCase().includes('collection')
    },
    { 
      label: 'Delinquency First Reported', 
      value: account.delinquencyFirstReported,
      isNegative: true
    },
    { 
      label: 'Creditor Classification', 
      value: account.creditorClassification,
      isNegative: false 
    },
    { 
      label: 'Charge Off Amount', 
      value: account.chargeOffAmount,
      isNegative: true
    },
    { 
      label: 'Date of First Delinquency', 
      value: account.dateOfFirstDelinquency,
      isNegative: true
    },
    { 
      label: 'Date Closed', 
      value: account.dateClosed,
      isNegative: false 
    },
    { 
      label: 'Loan Type', 
      value: account.loanType,
      isNegative: false 
    },
    { 
      label: 'Payment Responsibility', 
      value: account.paymentResponsibility,
      isNegative: false 
    },
    { 
      label: 'Deferred Payment Start Date', 
      value: account.deferredPaymentStartDate,
      isNegative: false 
    },
    { 
      label: 'Balloon Payment Date', 
      value: account.balloonPaymentDate,
      isNegative: false 
    },
    { 
      label: 'Balloon Payment Amount', 
      value: account.balloonPaymentAmount,
      isNegative: false 
    }
  ];
  
  // Filter out undefined values
  const displayFields = detailFields.filter(field => field.value !== undefined && field.value !== null);
  
  if (displayFields.length === 0) {
    return (
      <div className="py-4 text-center">
        <p className="text-muted-foreground">No additional details available for this account.</p>
      </div>
    );
  }
  
  // Split into two columns
  const halfwayIndex = Math.ceil(displayFields.length / 2);
  const leftColumnFields = displayFields.slice(0, halfwayIndex);
  const rightColumnFields = displayFields.slice(halfwayIndex);
  
  return (
    <div className="py-4">
      <div className="mb-4">
        <h3 className="font-medium text-lg">Account Details</h3>
        <p className="text-muted-foreground text-sm">
          View detailed information about this account as reported to the credit bureau.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          {leftColumnFields.map((field, index) => (
            <div key={index} className="space-y-1">
              <div className="text-sm text-muted-foreground">{field.label}</div>
              <div className={cn(
                "font-medium",
                isNegative && field.isNegative ? "text-red-600" : ""
              )}>
                {field.value || 'N/A'}
              </div>
              {index < leftColumnFields.length - 1 && <Separator />}
            </div>
          ))}
        </div>
        
        <div className="space-y-3">
          {rightColumnFields.map((field, index) => (
            <div key={index} className="space-y-1">
              <div className="text-sm text-muted-foreground">{field.label}</div>
              <div className={cn(
                "font-medium",
                isNegative && field.isNegative ? "text-red-600" : ""
              )}>
                {field.value || 'N/A'}
              </div>
              {index < rightColumnFields.length - 1 && <Separator />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AccountDetailsSection;
