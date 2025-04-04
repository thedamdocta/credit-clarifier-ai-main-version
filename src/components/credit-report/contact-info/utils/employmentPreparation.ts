
import { CreditReport } from "@/lib/types/creditReport";
import { EmploymentInfo } from "@/lib/ai/contactInfoExtraction";

/**
 * Prepare employment information from the credit report for display
 */
export const prepareEmployment = (report: CreditReport): EmploymentInfo[] => {
  if (!report.personalInfo || !report.personalInfo.employmentHistory) {
    return [];
  }

  return [{
    company: "History",
    occupation: "Employment history is the information in your credit file that indicates your current and former employment as reported to Equifax"
  }];
};
