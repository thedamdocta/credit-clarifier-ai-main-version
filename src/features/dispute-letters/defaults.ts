import type { CreditReport } from "@/lib/types/creditReport";
import { DisputeLetterIntake } from "./types";
import { getReportReference } from "@/utils/reportDisplay";

const bureauDefaults: Record<CreditReport["bureau"], Pick<DisputeLetterIntake, "bureauRecipientName" | "bureauAddressLine1" | "bureauAddressLine2" | "bureauCity" | "bureauState" | "bureauZip">> = {
  Equifax: {
    bureauRecipientName: "Equifax Information Services LLC",
    bureauAddressLine1: "P.O. Box 740256",
    bureauAddressLine2: "",
    bureauCity: "Atlanta",
    bureauState: "GA",
    bureauZip: "30374",
  },
  Experian: {
    bureauRecipientName: "Experian",
    bureauAddressLine1: "P.O. Box 4500",
    bureauAddressLine2: "",
    bureauCity: "Allen",
    bureauState: "TX",
    bureauZip: "75013",
  },
  TransUnion: {
    bureauRecipientName: "TransUnion Consumer Solutions",
    bureauAddressLine1: "P.O. Box 2000",
    bureauAddressLine2: "",
    bureauCity: "Chester",
    bureauState: "PA",
    bureauZip: "19016-2000",
  },
  Unknown: {
    bureauRecipientName: "Credit Bureau",
    bureauAddressLine1: "",
    bureauAddressLine2: "",
    bureauCity: "",
    bureauState: "",
    bureauZip: "",
  },
};

const toIsoDate = (value: Date) => value.toISOString().slice(0, 10);

const normalizeName = (value?: string | null) => String(value ?? "").trim();
const selectPreferredName = (report: CreditReport) => {
  const consumerName = normalizeName(report.consumerName);
  const personalName = normalizeName(report.personalInfo.name);

  if (!consumerName) {
    return personalName;
  }

  if (!personalName) {
    return consumerName;
  }

  const consumerWords = consumerName.toLowerCase().split(/\s+/).filter(Boolean);
  const personalWords = personalName.toLowerCase().split(/\s+/).filter(Boolean);
  const consumerCovered = consumerWords.every((word) => personalWords.includes(word));

  if (consumerCovered && personalName.length >= consumerName.length) {
    return personalName;
  }

  return consumerName.length >= personalName.length ? consumerName : personalName;
};

const firstAddress = (report: CreditReport) =>
  report.personalInfo.currentAddresses?.[0] ?? report.personalInfo.addresses?.[0] ?? "";

const splitAddress = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return {
      line1: "",
      city: "",
      state: "",
      zip: "",
    };
  }

  const parts = trimmed.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 3) {
    const line1 = parts[0];
    const city = parts[1];
    const trailing = parts[2];
    const trailingMatch = trailing.match(/^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);
    if (line1 && city && trailingMatch) {
      return {
        line1,
        city,
        state: trailingMatch[1].toUpperCase(),
        zip: trailingMatch[2],
      };
    }
  }

  return {
    line1: trimmed,
    city: "",
    state: "",
    zip: "",
  };
};

export const buildDefaultIntake = (report: CreditReport): DisputeLetterIntake => {
  const address = splitAddress(firstAddress(report));
  const bureau = report.bureau ?? "Unknown";
  const recipient = bureauDefaults[bureau];
  const reportNumber = getReportReference(report, "");

  return {
    fullLegalName: selectPreferredName(report),
    dateOfBirth: report.personalInfo.dob ?? "",
    socialSecurityNumber: report.personalInfo.ssn ?? report.personalInfo.socialSecurityNumbers?.[0] ?? "",
    mailingAddressLine1: address.line1,
    mailingAddressLine2: "",
    mailingCity: address.city,
    mailingState: address.state,
    mailingZip: address.zip,
    reportNumber,
    reportDate: report.reportDate ?? "",
    letterDate: toIsoDate(new Date()),
    certifiedMailTrackingNumber: "",
    responsePreference: "mail_only",
    bureauRecipientName: recipient.bureauRecipientName,
    bureauAddressLine1: recipient.bureauAddressLine1,
    bureauAddressLine2: recipient.bureauAddressLine2,
    bureauCity: recipient.bureauCity,
    bureauState: recipient.bureauState,
    bureauZip: recipient.bureauZip,
    enclosures: ["Identification", "Proof of address", "Marked report pages"],
  };
};
