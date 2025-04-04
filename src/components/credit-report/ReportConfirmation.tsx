
import React from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { CreditReport } from "@/lib/creditReportParser";
import ReportConfirmationHeader from "./confirmation/ReportConfirmationHeader";
import ReportConfirmationDetails from "./confirmation/ReportConfirmationDetails";
import ContactInfoComponent from "./contact-info/ContactInfoComponent";

interface ReportConfirmationProps {
  report: CreditReport;
}

const ReportConfirmation: React.FC<ReportConfirmationProps> = ({ report }) => {
  return (
    <Card>
      <CardHeader className="bg-credit-blue bg-opacity-10">
        <ReportConfirmationHeader />
      </CardHeader>
      <ReportConfirmationDetails report={report} />
    </Card>
  );
};

export default ReportConfirmation;
