
import React from "react";
import { CreditReport } from "@/lib/types/creditReport";
import ContactInfoComponent from "./contact-info/ContactInfoComponent";
import CollapsibleCard from "./common/CollapsibleCard";
import { User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ContactInformationProps {
  report: CreditReport;
}

const ContactInformation: React.FC<ContactInformationProps> = ({ report }) => {
  const getAddressCount = () => {
    if (!report.personalInfo || !report.personalInfo.addresses) {
      return 0;
    }
    return report.personalInfo.addresses.length;
  };

  const header = (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center space-x-2">
        <User className="h-5 w-5 text-muted-foreground" />
        <div>
          <h3 className="text-base font-medium">Contact Information</h3>
          <p className="text-sm text-muted-foreground">Address history and employment details</p>
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        <Badge variant="outline" className="bg-muted/50 hover:bg-muted">
          {getAddressCount()} Address{getAddressCount() !== 1 ? 'es' : ''}
        </Badge>
      </div>
    </div>
  );

  return (
    <CollapsibleCard header={header}>
      <ContactInfoComponent report={report} />
    </CollapsibleCard>
  );
};

export default ContactInformation;
