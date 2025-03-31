
import React from "react";

interface AIAnalysisSectionProps {
  title: string;
  children: React.ReactNode;
}

const AIAnalysisSection: React.FC<AIAnalysisSectionProps> = ({ title, children }) => {
  return (
    <div>
      <h3 className="font-medium mb-1">{title}</h3>
      {children}
    </div>
  );
};

export default AIAnalysisSection;
