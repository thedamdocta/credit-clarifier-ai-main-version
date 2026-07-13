import React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BadgeAlert, CheckCircle2 } from "lucide-react";
import { CreditReport } from "@/lib/types/creditReport";

interface ExtractionStatusProps {
  report: CreditReport;
}

const ExtractionStatus: React.FC<ExtractionStatusProps> = ({ report }) => {
  const failedComponents = Object.entries(report.componentStatus ?? {}).filter(([, value]) => value === "failed");
  const bureauLabel = report.bureau === "Unknown" ? "scoped" : `${report.bureau} scoped`;

  if (failedComponents.length === 0) {
    return (
      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertTitle>Extraction Status</AlertTitle>
        <AlertDescription>
          All {bureauLabel} components passed validation.
        </AlertDescription>
      </Alert>
    );
  }

  const issueMessages = (report.validationIssues ?? []).map((issue) => issue.message).slice(0, 5);

  return (
    <Alert variant="destructive">
      <BadgeAlert className="h-4 w-4" />
      <AlertTitle>Extraction Requires Review</AlertTitle>
      <AlertDescription>
        <div className="mb-2">
          Failed components: {failedComponents.map(([name]) => name).join(", ")}
        </div>
        {issueMessages.length > 0 ? (
          <ul className="list-disc pl-5 space-y-1 text-xs">
            {issueMessages.map((message, idx) => (
              <li key={`${message}-${idx}`}>{message}</li>
            ))}
          </ul>
        ) : null}
      </AlertDescription>
    </Alert>
  );
};

export default ExtractionStatus;
