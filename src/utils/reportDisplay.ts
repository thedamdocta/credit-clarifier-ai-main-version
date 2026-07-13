import type { CreditReport } from "@/lib/types/creditReport";

const normalizeReference = (value: unknown) => {
  const normalized = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized || /^(?:not reported|null|undefined|n\/a|na)$/i.test(normalized)) {
    return "";
  }

  return normalized;
};

export const getReportReference = (
  report?: CreditReport | null,
  fallback: string = "Not reported",
) => {
  if (!report) {
    return fallback;
  }

  const components = (report.components ?? {}) as Record<string, any>;
  const reportOverview = components.reportOverview ?? {};
  const reportConfirmation = components.reportConfirmationDetails ?? {};

  return (
    [
      reportOverview.reportNumber,
      reportConfirmation.reportNumber,
      reportConfirmation.confirmationNumber,
      report.confirmationNumber,
      report.fileName,
      report.reportId,
    ]
      .map((value) => normalizeReference(value))
      .find(Boolean) ?? fallback
  );
};
