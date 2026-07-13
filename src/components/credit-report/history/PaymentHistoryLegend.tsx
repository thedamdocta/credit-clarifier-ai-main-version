import React from "react";
import { Badge } from "@/components/ui/badge";

const STATUS_ORDER = [
  "OK",
  "CUR",
  "X",
  "ND",
  "TNT",
  "CLS",
  "30",
  "60",
  "90",
  "120",
  "150",
  "180",
  "COL",
  "C",
  "CO",
  "C/O",
  "B",
  "R",
  "V",
  "VS",
  "F",
  "RPO",
] as const;

const STATUS_DESCRIPTIONS: Record<string, string> = {
  OK: "Current / paid as agreed",
  CUR: "Current / paid as agreed",
  X: "No data available",
  ND: "No data reported",
  TNT: "Too new to rate",
  CLS: "Closed / no active rating",
  "30": "30 days late",
  "60": "60 days late",
  "90": "90 days late",
  "120": "120 days late",
  "150": "150 days past due",
  "180": "180 days past due",
  COL: "In collections",
  C: "Collection account",
  CO: "Charge-off",
  "C/O": "Charge-off",
  B: "Included in bankruptcy",
  R: "Repossession",
  V: "Voluntary surrender",
  VS: "Voluntary surrender",
  F: "Foreclosure",
  RPO: "Repossession",
};

const POSITIVE_CODES = new Set(["OK", "CUR"]);
const EMPTY_CODES = new Set(["", "-", "—", "X", "ND", "TNT", "CLS"]);
const NEGATIVE_CODES = new Set(["30", "60", "90", "120", "150", "180", "COL", "C", "CO", "C/O", "B", "R", "V", "VS", "F", "RPO"]);
const BASE_LEGEND_CODES = ["OK", "X"] as const;

export const normalizePaymentHistoryCode = (value: unknown) => {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim().toUpperCase();
  if (!normalized || normalized === "-" || normalized === "—") {
    return "X";
  }
  if (normalized === "CURRENT") {
    return "CUR";
  }
  return normalized;
};

export const isRecognizedPaymentHistoryCode = (value: unknown) => {
  const normalized = normalizePaymentHistoryCode(value);
  return (
    POSITIVE_CODES.has(normalized) ||
    EMPTY_CODES.has(normalized) ||
    NEGATIVE_CODES.has(normalized)
  );
};

const badgeClassName = (normalized: string) => {
  if (POSITIVE_CODES.has(normalized)) {
    return "min-w-[40px] justify-center border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (EMPTY_CODES.has(normalized)) {
    return "min-w-[40px] justify-center border-black/15 bg-[var(--dossier-gray-pill)] text-slate-600";
  }
  return "min-w-[40px] justify-center border-[#ffb3ae] bg-[#fff1ef] text-[#b42318]";
};

export const collectPaymentHistoryLegendCodes = (values: Iterable<unknown>) => {
  const seen = new Set<string>();
  const present: string[] = [];

  for (const baseCode of BASE_LEGEND_CODES) {
    seen.add(baseCode);
    present.push(baseCode);
  }

  for (const value of values) {
    const normalized = normalizePaymentHistoryCode(value);
    if (!isRecognizedPaymentHistoryCode(normalized) || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    present.push(normalized);
  }

  return present.sort((left, right) => {
    const leftIndex = STATUS_ORDER.indexOf(left as (typeof STATUS_ORDER)[number]);
    const rightIndex = STATUS_ORDER.indexOf(right as (typeof STATUS_ORDER)[number]);
    return (leftIndex === -1 ? STATUS_ORDER.length : leftIndex) - (rightIndex === -1 ? STATUS_ORDER.length : rightIndex);
  });
};

export const PaymentHistoryStatusBadge: React.FC<{ value: unknown }> = ({ value }) => {
  const normalized = normalizePaymentHistoryCode(value);
  if (!isRecognizedPaymentHistoryCode(normalized)) {
    const display = String(value ?? "").trim() || "-";
    return <span className={display === "-" ? "text-slate-400" : "text-slate-900"}>{display}</span>;
  }

  return (
    <Badge variant="outline" className={badgeClassName(normalized)}>
      {normalized}
    </Badge>
  );
};

interface PaymentHistoryLegendProps {
  codes: string[];
  helperText?: string;
}

const PaymentHistoryLegend: React.FC<PaymentHistoryLegendProps> = ({
  codes,
  helperText = "Green means current or paid as agreed. Red means derogatory or adverse reporting. Gray means missing, unavailable, closed, or not yet rated. The legend always shows the full supported code set; entries used in this account stay fully emphasized.",
}) => {
  const activeCodes = new Set(codes.map((code) => normalizePaymentHistoryCode(code)));
  const legendCodes = [...STATUS_ORDER];

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
      <p className="text-xs leading-5 text-slate-600">{helperText}</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-3 text-[11px] sm:grid-cols-3 sm:text-xs lg:grid-cols-4">
        {legendCodes.map((code) => (
          <div
            key={code}
            className={`flex min-w-0 items-start gap-2 transition-opacity ${activeCodes.size === 0 || activeCodes.has(code) ? "opacity-100" : "opacity-45"}`}
          >
            <PaymentHistoryStatusBadge value={code} />
            <span className="min-w-0 leading-4 text-slate-700">{STATUS_DESCRIPTIONS[code] ?? "Reported status"}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PaymentHistoryLegend;
