
import React from "react";
import { CreditReport } from "@/lib/creditReportParser";
import OtherItemsHeader from "./other-items/OtherItemsHeader";
import OtherItemsTable from "./other-items/OtherItemsTable";
import CollapsibleCard from "./common/CollapsibleCard";

interface OtherItemsProps {
  report: CreditReport;
}

const OtherItems: React.FC<OtherItemsProps> = ({ report }) => {
  const header = <OtherItemsHeader />;

  const content = (
    <>
      <p className="mb-4">Your credit report includes your Personal Information and, if applicable, Consumer Statements, and could include other items that may affect your credit score and rating.</p>
      
      <OtherItemsTable report={report} />
    </>
  );

  return <CollapsibleCard header={header}>{content}</CollapsibleCard>;
};

export default OtherItems;
