const normalizeContext = (values: unknown[]) =>
  values
    .flatMap((value) => {
      if (Array.isArray(value)) {
        return value;
      }
      return [value];
    })
    .map((value) => String(value ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" | ")
    .toLowerCase();

export type StructuredAccountClassification = {
  accountSubtype?: string;
  reportingCategory?: string;
  legalCategory?: string;
};

export const inferStructuredAccountClassification = (
  values: unknown[],
  fallbackReportingCategory = "tradeline",
): StructuredAccountClassification => {
  const context = normalizeContext(values);
  const reportingCategory = /\bcollection\b|\bdebt collector\b/.test(context)
    ? "collection"
    : fallbackReportingCategory;

  if (!context) {
    return {
      reportingCategory,
    };
  }

  if (/\bauto lease\b|\bvehicle lease\b/.test(context)) {
    return {
      accountSubtype: "Auto Lease",
      reportingCategory,
    };
  }

  if (/\bchild support\b/.test(context)) {
    return {
      accountSubtype: "Child Support",
      legalCategory: "child_support",
      reportingCategory,
    };
  }

  if (/\bfamily support\b|\balimony\b|\bspousal support\b/.test(context)) {
    return {
      accountSubtype: "Family Support",
      legalCategory: "family_support",
      reportingCategory,
    };
  }

  if (/\bmedical\b|\bhospital\b|\bclinic\b|\bhealth\b|\bphysician\b|\bdoctor\b/.test(context)) {
    return {
      accountSubtype: "Medical Debt",
      legalCategory: "medical_debt",
      reportingCategory,
    };
  }

  if (/\brental agreement\b|\brent(?:track|report|reporting)?\b|\brental history\b|\blandlord\b|\bproperty management\b|\bapartment\b/.test(context)) {
    return {
      accountSubtype: "Rental Agreement",
      legalCategory: "rental_obligation",
      reportingCategory,
    };
  }

  if (/\bbankruptcy\b|included in bankruptcy/.test(context)) {
    return {
      legalCategory: "bankruptcy",
      reportingCategory,
    };
  }

  return {
    reportingCategory,
  };
};
