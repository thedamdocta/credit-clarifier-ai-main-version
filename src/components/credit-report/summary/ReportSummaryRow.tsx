
import React from "react";

interface ReportSummaryRowProps {
  label: string;
  value: React.ReactNode;
  highlighted?: boolean;
}

const ReportSummaryRow: React.FC<ReportSummaryRowProps> = ({ 
  label, 
  value, 
  highlighted = false 
}) => {
  return (
    <div className={`flex justify-between items-center ${highlighted ? 'bg-muted/20' : ''} p-2`}>
      <span className="font-medium">{label}</span>
      <span className={value ? 'text-right' : ''}>{value || "Not Available"}</span>
    </div>
  );
};

export default ReportSummaryRow;
