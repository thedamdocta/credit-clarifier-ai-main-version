import React from "react";
import { User } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CreditReport } from "@/lib/types/creditReport";
import PersonalInfoCard from "@/components/PersonalInfoCard";
import ExtractedSourceTabs from "./source/ExtractedSourceTabs";

interface PersonalInformationProps {
  report: CreditReport;
}

const PersonalInformation: React.FC<PersonalInformationProps> = ({ report }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <User className="mr-2 h-5 w-5" />
          Personal Information
        </CardTitle>
        <CardDescription>Personal details from your credit report</CardDescription>
      </CardHeader>
      <ExtractedSourceTabs
        sessionId={report.sourceSessionId}
        pageNumbers={report.sourceComponents?.personalInformation?.pages}
        sourceTitle="Personal Information Source Pages"
        tabsClassName="mx-6 mt-5 sm:mt-6"
      >
        <PersonalInfoCard personalInfo={report.personalInfo} embedded />
      </ExtractedSourceTabs>
    </Card>
  );
};

export default PersonalInformation;
