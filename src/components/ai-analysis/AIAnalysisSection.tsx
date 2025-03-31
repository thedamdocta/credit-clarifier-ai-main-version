
import React from "react";

interface AIAnalysisSectionProps {
  title: string;
  children: React.ReactNode;
}

const AIAnalysisSection: React.FC<AIAnalysisSectionProps> = ({ title, children }) => {
  return (
    <div className="border rounded-md p-4 bg-white shadow-sm">
      <h3 className="font-medium text-base mb-2 pb-2 border-b">{title}</h3>
      <div className="mt-1">
        {children}
      </div>
    </div>
  );
};

export default AIAnalysisSection;
