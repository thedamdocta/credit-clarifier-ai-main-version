import React from "react";
import { CreditReport, PublicRecord } from "@/lib/types/creditReport";

const normalizeText = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

const valueClassName = (value: unknown) =>
  /^(?:not reported|none|no public records reported\.?|x)?$/i.test(normalizeText(value)) ? "text-slate-400" : "text-slate-900";

const displayValue = (value: unknown) => {
  const normalized = normalizeText(value);
  return normalized || "Not reported";
};

const DefinitionRows: React.FC<{ rows: Array<{ label: string; value: React.ReactNode }> }> = ({ rows }) => (
  <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
    {rows.map((row) => (
      <div key={row.label} className="grid gap-3 px-4 py-4 md:grid-cols-[220px_minmax(0,1fr)] md:items-start">
        <div className="text-sm font-semibold text-slate-900">{row.label}</div>
        <div className="text-sm leading-6">{row.value}</div>
      </div>
    ))}
  </div>
);

const ListValue: React.FC<{ values: string[]; emptyLabel?: string }> = ({ values, emptyLabel = "Not reported" }) => {
  if (!values.length) {
    return <span className="text-slate-400">{emptyLabel}</span>;
  }

  return (
    <div className="space-y-1">
      {values.map((value, index) => (
        <p key={`${value}-${index}`} className={valueClassName(value)}>
          {value}
        </p>
      ))}
    </div>
  );
};

const buildPublicRecordDisplayTitle = (record: PublicRecord) =>
  normalizeText(record.court) || normalizeText(record.recordType) || normalizeText(record.summary) || "Public record";

const buildPublicRecordRows = (record: PublicRecord) => {
  const rows: Array<{ label: string; value: React.ReactNode }> = [
    { label: "Record Type", value: <span className={valueClassName(record.recordType)}>{displayValue(record.recordType)}</span> },
    { label: "Status", value: <span className={valueClassName(record.status)}>{displayValue(record.status)}</span> },
    { label: "Court", value: <span className={valueClassName(record.court)}>{displayValue(record.court)}</span> },
    { label: "Reference Number", value: <span className={valueClassName(record.referenceNumber)}>{displayValue(record.referenceNumber)}</span> },
    { label: "Amount", value: <span className={valueClassName(record.amount)}>{displayValue(record.amount)}</span> },
    { label: "Date Filed", value: <span className={valueClassName(record.dateFiled)}>{displayValue(record.dateFiled)}</span> },
    { label: "Date Resolved", value: <span className={valueClassName(record.dateResolved)}>{displayValue(record.dateResolved)}</span> },
  ];

  const optionalRows: Array<[string, unknown]> = [
    ["Date Paid", record.datePaid],
    ["Address", record.address],
    ["Phone Number", record.phoneNumber],
    ["Court Type", record.courtType],
    ["Date Updated", record.dateUpdated],
    ["Estimated Removal", record.estimatedRemoval],
    ["Plaintiff Attorney", record.plaintiffAttorney],
    ["Responsibility", record.responsibility],
    ["Liability", record.liability],
  ];

  for (const [label, value] of optionalRows) {
    if (!normalizeText(value)) {
      continue;
    }
    rows.push({
      label,
      value: <span className={valueClassName(value)}>{displayValue(value)}</span>,
    });
  }

  const normalizedSummary = normalizeText(record.summary);
  const normalizedRecordType = normalizeText(record.recordType);
  if (normalizedSummary && normalizedSummary.toLowerCase() !== normalizedRecordType.toLowerCase()) {
    rows.push({
      label: "Summary",
      value: <span className={valueClassName(record.summary)}>{displayValue(record.summary)}</span>,
    });
  }

  const residualDetails = (record.details ?? []).filter((detail) => {
    const normalized = normalizeText(detail);
    if (!normalized) {
      return false;
    }
    return normalized.toLowerCase() !== normalizedSummary.toLowerCase();
  });

  if (residualDetails.length > 0) {
    rows.push({
      label: "Details",
      value: <ListValue values={residualDetails} />,
    });
  }

  return rows;
};

const PublicRecordList: React.FC<{ records: CreditReport["publicRecords"] }> = ({ records }) => {
  if (!records.length) {
    return <span className="text-slate-400">No public records extracted.</span>;
  }

  return (
    <div className="space-y-4">
      {records.map((record, index) => (
        <div
          key={`${record.recordType ?? record.summary ?? "public-record"}-${index}`}
          className="rounded-lg border border-[#f0a8a0] bg-[#fff7f6] p-4"
        >
          <div className="mb-4 border-b border-[#f0c9c4] pb-3">
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Record</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">{buildPublicRecordDisplayTitle(record)}</div>
          </div>
          <DefinitionRows rows={buildPublicRecordRows(record)} />
        </div>
      ))}
    </div>
  );
};

export default PublicRecordList;
