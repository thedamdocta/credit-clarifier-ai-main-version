import React from "react";
import { CreditReport } from "@/lib/types/creditReport";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldAlert, Bell, CalendarClock, CalendarRange, AlertCircle, History, Clock } from "lucide-react";

interface ReportSummaryContentProps {
  report: CreditReport;
  showDebugInfo: boolean;
}

const ReportSummaryContent: React.FC<ReportSummaryContentProps> = ({ report, showDebugInfo }) => {
  // Determine if there's any alert contact information
  const hasAlertContacts = report.alertContacts && report.alertContacts.length > 0;

  // Update items to use the correct property names
  const items = [
    {
      label: "Credit File Status",
      value: report.creditFileStatus || "Not Available",
      icon: <ShieldAlert className="h-5 w-5" />,
    },
    {
      label: "Alert Contacts",
      value: report.alertContacts || "Not Available",
      icon: <Bell className="h-5 w-5" />,
    },

    {
      label: "Average Account Age",
      value: report.averageAccountAge || "Not Available",
      icon: <CalendarClock className="h-5 w-5" />,
    },
    {
      label: "Length of Credit History",
      value: report.lengthOfCreditHistory || "Not Available",
      icon: <CalendarRange className="h-5 w-5" />,
    },

    {
      label: "Accounts with Negative Info",
      value: report.accountsWithNegativeInfo?.toString() || "Not Available",
      icon: <AlertCircle className="h-5 w-5" />,
    },
    {
      label: "Oldest Account",
      value: report.oldestAccount 
        ? `${report.oldestAccount.name} (${report.oldestAccount.date})` 
        : "Not Available",
      icon: <History className="h-5 w-5" />,
    },
    {
      label: "Most Recent Account",
      value: report.recentAccount 
        ? `${report.recentAccount.name} (${report.recentAccount.date})` 
        : "Not Available",
      icon: <Clock className="h-5 w-5" />,
    },
  ];

  return (
    <Card className="col-span-2">
      <CardContent className="grid gap-4">
        <h2 className="text-lg font-semibold">Report Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <div key={item.label} className="flex items-center space-x-4">
              {item.icon}
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-sm text-muted-foreground">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
        
        {showDebugInfo && (
          <div className="mt-4 p-4 bg-muted/50 rounded-md border border-dashed">
            <h4 className="text-sm font-medium mb-2">Debug Information</h4>
            <pre className="text-xs overflow-x-auto">
              {JSON.stringify(report, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReportSummaryContent;
