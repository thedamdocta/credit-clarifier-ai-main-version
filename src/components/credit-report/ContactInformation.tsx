
import React, { useState } from "react";
import { CreditReport } from "@/lib/types/creditReport";
import ContactInfoComponent from "./contact-info/ContactInfoComponent";
import CollapsibleCard from "./common/CollapsibleCard";
import ContactInfoHeader from "./contact-info/ContactInfoHeader";

interface ContactInformationProps {
  report: CreditReport;
}

const ContactInformation: React.FC<ContactInformationProps> = ({ report }) => {
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  
  const toggleDebug = () => {
    setShowDebugInfo(!showDebugInfo);
  };
  
  const header = (
    <ContactInfoHeader 
      personalInfo={report.personalInfo} 
      showDebugInfo={showDebugInfo}
      toggleDebug={toggleDebug}
    />
  );

  return (
    <CollapsibleCard header={header}>
      <ContactInfoComponent report={report} />
    </CollapsibleCard>
  );
};

export default ContactInformation;
