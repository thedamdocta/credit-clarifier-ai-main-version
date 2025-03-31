
// This file now serves as the export point for the refactored account summary extraction logic
import { AccountSummary } from "../../types/creditReport";
import { extractEquifaxAccountSummaries } from "./accounts/accountSummaryExtractor";

// Re-export the main function
export { extractEquifaxAccountSummaries };
