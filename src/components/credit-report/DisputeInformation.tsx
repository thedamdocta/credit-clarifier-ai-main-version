
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";

const DisputeInformation: React.FC = () => {
  return (
    <Card>
      <CardHeader className="bg-gray-50">
        <CardTitle className="text-sm flex items-center">
          <CalendarDays className="h-4 w-4 mr-2" />
          Dispute Information
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm pt-4">
        <p className="mb-2">
          If you believe any information in this report is inaccurate or incomplete, you may dispute it by:
        </p>
        <ul className="list-disc pl-5 mb-4 space-y-1">
          <li>
            <span className="font-medium">Online:</span>{" "}
            <a href="https://www.equifax.com/personal/credit-report-services/credit-dispute/" className="text-blue-600 hover:underline">
              www.equifax.com/personal/credit-report-services/credit-dispute/
            </a>
          </li>
          <li>
            <span className="font-medium">Mail:</span> Equifax Information Services LLC, P.O. Box 740241, Atlanta, GA 30374
          </li>
          <li>
            <span className="font-medium">Phone:</span> 866-349-5186
          </li>
        </ul>
        <p>
          For information about your credit score, call: <span className="font-medium">1-877-SCORE-11</span>
        </p>
      </CardContent>
    </Card>
  );
};

export default DisputeInformation;
