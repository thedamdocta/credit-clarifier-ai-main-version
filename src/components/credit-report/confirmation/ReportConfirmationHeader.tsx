
import React from "react";
import { CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

const ReportConfirmationHeader: React.FC = () => {
  return (
    <>
      <CardTitle className="text-credit-blue flex items-center">
        <ShieldCheck className="h-5 w-5 mr-2" />
        Equifax Credit Report
      </CardTitle>
      <CardDescription>
        Report confirmation details
      </CardDescription>
    </>
  );
};

export default ReportConfirmationHeader;
