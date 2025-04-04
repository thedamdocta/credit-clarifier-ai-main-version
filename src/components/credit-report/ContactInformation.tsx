
import React from "react";
import { CreditReport } from "@/lib/creditReportParser";
import ContactInfoComponent from "./contact-info/ContactInfoComponent";
import CollapsibleCard from "./common/CollapsibleCard";

interface ContactInformationProps {
  report: CreditReport;
}

const ContactInformation: React.FC<ContactInformationProps> = ({ report }) => {
  return (
    <ContactInfoComponent report={report} />
  );
};

export default ContactInformation;
