const normalizeArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    return value
      .split(/\n|;|\|/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const normalizeUniqueStrings = (value) => {
  const seen = new Set();
  const result = [];
  for (const entry of normalizeArray(value)) {
    const normalized = String(entry ?? "").trim();
    if (!normalized) {
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(normalized);
  }
  return result;
};

const uniquePositiveNumbers = (value) => {
  const seen = new Set();
  const result = [];
  for (const entry of Array.isArray(value) ? value : []) {
    const page = Number(entry);
    if (!Number.isInteger(page) || page <= 0 || seen.has(page)) {
      continue;
    }
    seen.add(page);
    result.push(page);
  }
  return result;
};

const normalizeMaskedAccountNumber = (value) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

const normalizeMatchText = (value) => String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();

const accountKey = (value) =>
  `${normalizeMatchText(value?.accountName)}::${normalizeMaskedAccountNumber(value?.accountNumber)}`;

const buildComponentSourceMap = (pageWindows) => {
  const result = {};
  if (!pageWindows || typeof pageWindows !== "object") {
    return result;
  }
  for (const [componentName, value] of Object.entries(pageWindows)) {
    const normalizedPages = uniquePositiveNumbers(
      Array.isArray(value)
        ? value
        : value && typeof value === "object" && !Array.isArray(value)
          ? value.pages
          : []
    );
    if (normalizedPages.length > 0) {
      result[componentName] = {
        pages: normalizedPages,
      };
    }
  }
  return result;
};

const attachAccountSources = (accounts, sources, fallbackPages, historyEvidence) => {
  const sourceMap = new Map();
  for (const source of Array.isArray(sources) ? sources : []) {
    const key = accountKey(source);
    const pages = uniquePositiveNumbers(source?.pages);
    if (key !== "::" && pages.length > 0) {
      sourceMap.set(key, pages);
    }
  }

  const paymentHistoryYearMap = new Map();
  for (const source of Array.isArray(historyEvidence) ? historyEvidence : []) {
    const key = accountKey(source);
    const rows = Array.isArray(source?.fields?.paymentHistory) ? source.fields.paymentHistory : [];
    const years = rows
      .map((row) => String(row?.year ?? "").trim())
      .filter((year) => /^\d{4}$/.test(year));
    if (key !== "::" && years.length > 0) {
      paymentHistoryYearMap.set(key, years);
    }
  }

  const normalizedFallbackPages = uniquePositiveNumbers(fallbackPages);

  return (Array.isArray(accounts) ? accounts : []).map((account) => {
    const key = accountKey(account);
    const sourcePages = sourceMap.get(key) ?? normalizedFallbackPages;
    const paymentHistoryYears = paymentHistoryYearMap.get(key);
    const nextAccount = {
      ...account,
      ...(sourcePages.length > 0 ? { sourcePages } : {}),
      ...(paymentHistoryYears?.length ? { paymentHistoryYears } : {}),
    };
    return nextAccount;
  });
};

const attachCollectionSources = (collections, sources, fallbackPages) => {
  const sourceMap = new Map();
  for (const source of Array.isArray(sources) ? sources : []) {
    const key = [
      normalizeMatchText(source?.collectionAgency),
      normalizeMaskedAccountNumber(source?.accountNumber),
      normalizeMatchText(source?.originalCreditorName),
    ].join("::");
    const pages = uniquePositiveNumbers(source?.pages);
    if (pages.length > 0) {
      sourceMap.set(key, pages);
    }
  }

  const normalizedFallbackPages = uniquePositiveNumbers(fallbackPages);

  return (Array.isArray(collections) ? collections : []).map((collection) => {
    const key = [
      normalizeMatchText(collection?.collectionAgency),
      normalizeMaskedAccountNumber(collection?.accountNumber),
      normalizeMatchText(collection?.originalCreditorName),
    ].join("::");
    const sourcePages = sourceMap.get(key) ?? normalizedFallbackPages;
    return sourcePages.length > 0 ? { ...collection, sourcePages } : collection;
  });
};

const firstMeaningfulText = (...values) => {
  for (const value of values) {
    const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
    if (!normalized || /^(not reported|null|undefined|n\/a|none)$/i.test(normalized)) {
      continue;
    }
    return normalized;
  }
  return undefined;
};

const accountContextText = (account) => {
  const values = [
    account?.accountName,
    account?.accountType,
    account?.accountCategory,
    account?.loanType,
    account?.creditorClassification,
    account?.status,
    account?.accountStatus,
    account?.remarks,
    account?.originalCreditorName,
    ...(Array.isArray(account?.additionalInformation) ? account.additionalInformation : []),
    ...(Array.isArray(account?.consumerStatement) ? account.consumerStatement : []),
    ...(Array.isArray(account?.reinvestigationInfo) ? account.reinvestigationInfo : []),
    ...(Array.isArray(account?.comments) ? account.comments : []),
  ];
  return values
    .map((value) => String(value ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" | ");
};

const inferAccountSubtype = (account) => {
  const context = accountContextText(account).toLowerCase();
  if (!context) {
    return {};
  }
  const rules = [
    { subtype: "Auto Lease", pattern: /\bauto lease\b|\bvehicle lease\b/ },
    { subtype: "Child Support", legalCategory: "child_support", pattern: /\bchild support\b/ },
    { subtype: "Family Support", legalCategory: "family_support", pattern: /\bfamily support\b|\balimony\b|\bspousal support\b/ },
    {
      subtype: "Medical Debt",
      legalCategory: "medical_debt",
      pattern: /\bmedical\b|\bhospital\b|\bclinic\b|\bhealth\b|\bphysician\b|\bdoctor\b/,
    },
    {
      subtype: "Rental Agreement",
      legalCategory: "rental_obligation",
      pattern: /\brental agreement\b|\brent(?:track|report|reporting)?\b|\brental history\b|\blandlord\b|\bproperty management\b|\bapartment\b/,
    },
  ];
  for (const rule of rules) {
    const match = context.match(rule.pattern);
    if (!match) {
      continue;
    }
    return {
      accountSubtype: rule.subtype,
      accountSubtypeSourceText: match[0],
      legalCategory: rule.legalCategory,
    };
  }
  return {};
};

const inferReportingCategory = (account, fallback = "tradeline") => {
  const context = accountContextText(account).toLowerCase();
  if (
    account?.collectionAgency ||
    account?.originalCreditorName ||
    /\bcollection\b|\bdebt collector\b/.test(context)
  ) {
    return "collection";
  }
  return fallback;
};

const inferLegalCategory = (account) => {
  const context = accountContextText(account).toLowerCase();
  if (/\bbankruptcy\b|included in bankruptcy/.test(context)) {
    return "bankruptcy";
  }
  return inferAccountSubtype(account).legalCategory;
};

const enrichAccount = (account, reportingCategory = "tradeline") => {
  const subtype = inferAccountSubtype(account);
  const legalCategory = firstMeaningfulText(account?.legalCategory, subtype.legalCategory, inferLegalCategory(account));
  return {
    ...account,
    accountSubtype: firstMeaningfulText(account?.accountSubtype, subtype.accountSubtype),
    accountSubtypeSourceText: firstMeaningfulText(account?.accountSubtypeSourceText, subtype.accountSubtypeSourceText),
    reportingCategory: firstMeaningfulText(account?.reportingCategory, inferReportingCategory(account, reportingCategory)),
    legalCategory,
    portfolioType: firstMeaningfulText(account?.portfolioType),
    specialCommentCode: firstMeaningfulText(account?.specialCommentCode),
    complianceConditionCode: firstMeaningfulText(account?.complianceConditionCode),
    consumerInformationIndicator: firstMeaningfulText(account?.consumerInformationIndicator),
    paymentRating: firstMeaningfulText(account?.paymentRating),
    ecoaCode: firstMeaningfulText(account?.ecoaCode),
  };
};

const enrichCollection = (collection) => {
  const subtype = inferAccountSubtype(collection);
  const legalCategory = firstMeaningfulText(collection?.legalCategory, subtype.legalCategory);
  return {
    ...collection,
    accountSubtype: firstMeaningfulText(collection?.accountSubtype, subtype.accountSubtype),
    reportingCategory: "collection",
    legalCategory,
  };
};

const collectionIdentityKey = (collection) =>
  [
    normalizeMatchText(collection?.collectionAgency),
    normalizeMaskedAccountNumber(collection?.accountNumber),
    normalizeMatchText(collection?.originalCreditorName),
    normalizeMatchText(collection?.amount),
    normalizeMatchText(collection?.status),
  ].join("::");

const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_NAME_TO_KEY = {
  jan: "jan",
  january: "jan",
  feb: "feb",
  february: "feb",
  mar: "mar",
  march: "mar",
  apr: "apr",
  april: "apr",
  may: "may",
  jun: "jun",
  june: "jun",
  jul: "jul",
  july: "jul",
  aug: "aug",
  august: "aug",
  sep: "sep",
  sept: "sep",
  september: "sep",
  oct: "oct",
  october: "oct",
  nov: "nov",
  november: "nov",
  dec: "dec",
  december: "dec",
};

const normalizeHistoryCellValue = (value, fallback = "-") => {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  return normalized || fallback;
};

const normalizeMonthlyHistoryRow = (row, fallback = "-") => ({
  year: normalizeHistoryCellValue(row?.year, ""),
  ...Object.fromEntries(MONTH_KEYS.map((monthKey) => [monthKey, normalizeHistoryCellValue(row?.[monthKey], fallback)])),
});

const extractMonthlyHistoryRows = (value, fallback = "-") => {
  const rows = Array.isArray(value)
    ? value
    : Array.isArray(value?.rows)
      ? value.rows
      : [];
  return rows
    .map((row) => normalizeMonthlyHistoryRow(row, fallback))
    .filter((row) => row.year || MONTH_KEYS.some((monthKey) => row[monthKey] !== fallback));
};

const historyRowsFromEvidence = (value, fallback = "-") =>
  (Array.isArray(value) ? value : [])
    .map((entry) => ({
      year: normalizeHistoryCellValue(entry?.year, ""),
      ...Object.fromEntries(
        MONTH_KEYS.map((monthKey) => [
          monthKey,
          normalizeHistoryCellValue(entry?.months?.[monthKey]?.value, fallback),
        ]),
      ),
    }))
    .filter((row) => row.year || MONTH_KEYS.some((monthKey) => row[monthKey] !== fallback));

const flattenMonthlyHistoryRows = (rows, fallback = "-") => {
  const paymentHistory = [];
  const paymentHistoryYears = [];
  for (const row of rows) {
    paymentHistoryYears.push(normalizeHistoryCellValue(row?.year, ""));
    for (const monthKey of MONTH_KEYS) {
      paymentHistory.push(normalizeHistoryCellValue(row?.[monthKey], fallback));
    }
  }
  return { paymentHistory, paymentHistoryYears };
};

const parseMonthYearLabel = (value) => {
  const match = String(value ?? "").trim().match(/([A-Za-z]{3,9})\s+(\d{4})/);
  if (!match) {
    return null;
  }
  const monthKey = MONTH_NAME_TO_KEY[match[1].toLowerCase()];
  if (!monthKey) {
    return null;
  }
  return {
    year: match[2],
    monthKey,
  };
};

const historyRowsFromDatedEntries = (entries, valueKey, fallback = "-") => {
  const yearMap = new Map();
  for (const entry of Array.isArray(entries) ? entries : []) {
    const date = parseMonthYearLabel(entry?.date);
    if (!date) {
      continue;
    }
    if (!yearMap.has(date.year)) {
      yearMap.set(date.year, {
        year: date.year,
        ...Object.fromEntries(MONTH_KEYS.map((monthKey) => [monthKey, fallback])),
      });
    }
    yearMap.get(date.year)[date.monthKey] = normalizeHistoryCellValue(entry?.[valueKey], fallback);
  }

  return Array.from(yearMap.values()).sort((left, right) => Number(right.year) - Number(left.year));
};

const deriveCollectionsFromAccounts = (accounts) =>
  (Array.isArray(accounts) ? accounts : [])
    .filter((account) => {
      const reportingCategory = firstMeaningfulText(account?.reportingCategory, inferReportingCategory(account));
      return normalizeMatchText(reportingCategory) === "collection";
    })
    .map((account) =>
      enrichCollection({
        dateReported: firstMeaningfulText(account?.dateReported),
        collectionAgency: firstMeaningfulText(account?.accountName),
        balanceDate: firstMeaningfulText(account?.dateReported),
        originalCreditorName: firstMeaningfulText(account?.originalCreditorName, account?.creditorClassification),
        accountDesignatorCode: null,
        dateAssigned: firstMeaningfulText(account?.dateOpened),
        accountNumber: firstMeaningfulText(account?.accountNumber),
        originalAmountOwed: firstMeaningfulText(account?.originalBalance, account?.highCredit),
        creditorClassification: firstMeaningfulText(account?.creditorClassification, account?.accountCategory),
        amount: firstMeaningfulText(account?.currentBalance, account?.balance),
        lastPaymentDate: firstMeaningfulText(account?.lastPaymentDate),
        statusDate: firstMeaningfulText(account?.dateReported),
        dateOfFirstDelinquency: firstMeaningfulText(account?.dateOfFirstDelinquency, account?.delinquencyFirstReported),
        status: firstMeaningfulText(account?.status, account?.accountStatus),
        comments: normalizeUniqueStrings(account?.comments),
        contact: normalizeUniqueStrings(account?.contact),
        accountSubtype: firstMeaningfulText(account?.accountSubtype),
        legalCategory: firstMeaningfulText(account?.legalCategory),
        sourceText: accountContextText(account),
        details: normalizeUniqueStrings([account?.status, account?.accountStatus, ...(Array.isArray(account?.comments) ? account.comments : [])]),
        sourcePages: uniquePositiveNumbers(account?.sourcePages),
      })
    );

const mergeCollections = (...groups) => {
  const seen = new Set();
  const merged = [];
  for (const group of groups) {
    for (const collection of Array.isArray(group) ? group : []) {
      const key = collectionIdentityKey(collection);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      merged.push(collection);
    }
  }
  return merged;
};

const PUBLIC_RECORD_DETAIL_LABELS = [
  ["record type", "recordType"],
  ["type", "recordType"],
  ["court name", "court"],
  ["court", "court"],
  ["reference number", "referenceNumber"],
  ["file number", "referenceNumber"],
  ["status", "status"],
  ["amount", "amount"],
  ["date filed", "dateFiled"],
  ["filed date", "dateFiled"],
  ["date resolved", "dateResolved"],
  ["resolved date", "dateResolved"],
  ["date paid", "datePaid"],
  ["paid date", "datePaid"],
  ["address", "address"],
  ["phone number", "phoneNumber"],
  ["phone", "phoneNumber"],
  ["court type", "courtType"],
  ["date updated", "dateUpdated"],
  ["estimated month and year that this item will be removed", "estimatedRemoval"],
  ["estimated month and year this item will be removed", "estimatedRemoval"],
  ["estimated removal", "estimatedRemoval"],
  ["on record until", "estimatedRemoval"],
  ["plaintiff attorney", "plaintiffAttorney"],
  ["responsibility", "responsibility"],
  ["liability", "liability"],
];

const normalizePublicRecordDetailLabel = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[|:]+$/g, "")
    .trim();

const parseStructuredPublicRecordDetails = (details) => {
  const extracted = {};
  for (const rawDetail of Array.isArray(details) ? details : []) {
    const detail = String(rawDetail ?? "").replace(/\s+/g, " ").trim();
    if (!detail) continue;
    const normalizedDetail = normalizePublicRecordDetailLabel(detail);
    for (const [label, fieldName] of PUBLIC_RECORD_DETAIL_LABELS) {
      const normalizedLabel = normalizePublicRecordDetailLabel(label);
      const delimitedMatch = detail.match(new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*(?:\\||:)\\s*(.+)$`, "i"));
      if (delimitedMatch?.[1]?.trim()) {
        extracted[fieldName] ??= delimitedMatch[1].trim();
        break;
      }
      if (normalizedDetail.startsWith(`${normalizedLabel} `)) {
        const value = detail.slice(detail.toLowerCase().indexOf(label) + label.length).trim();
        if (value) {
          extracted[fieldName] ??= value;
          break;
        }
      }
    }
  }
  return extracted;
};

const splitTrailingPublicRecordIdentifier = (value) => {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!normalized || !/\bcourt\b/i.test(normalized)) {
    return { court: normalized || null, referenceNumber: null };
  }
  const match = normalized.match(/^(.*?\bcourt\b.*?)(?:\s+)([A-Z0-9-]*\d[A-Z0-9-]{3,})$/i);
  if (!match) {
    return { court: normalized || null, referenceNumber: null };
  }
  return {
    court: match[1].replace(/\s+/g, " ").trim() || normalized,
    referenceNumber: match[2].trim() || null,
  };
};

const normalizePublicRecordEntry = (entry, fallbackPages = []) => {
  if (typeof entry === "string") {
    const summary = entry.replace(/\s+/g, " ").trim();
    return summary
      ? {
          summary,
          details: [summary],
          sourcePages: uniquePositiveNumbers(fallbackPages),
        }
      : null;
  }
  if (!entry || typeof entry !== "object") {
    return null;
  }
  const details = normalizeUniqueStrings(entry.details ?? entry.lines ?? []);
  const extractedDetailFields = parseStructuredPublicRecordDetails(details);
  const mappedFields = {
    recordType: firstMeaningfulText(entry.recordType, entry.type, extractedDetailFields.recordType),
    court: firstMeaningfulText(entry.court, extractedDetailFields.court),
    referenceNumber: firstMeaningfulText(entry.referenceNumber, entry.fileNumber, extractedDetailFields.referenceNumber),
    status: firstMeaningfulText(entry.status, extractedDetailFields.status),
    amount: firstMeaningfulText(entry.amount, extractedDetailFields.amount),
    dateFiled: firstMeaningfulText(entry.dateFiled, entry.filedDate, extractedDetailFields.dateFiled),
    dateResolved: firstMeaningfulText(entry.dateResolved, entry.resolvedDate, extractedDetailFields.dateResolved),
    datePaid: firstMeaningfulText(entry.datePaid, extractedDetailFields.datePaid),
    address: firstMeaningfulText(entry.address, extractedDetailFields.address),
    phoneNumber: firstMeaningfulText(entry.phoneNumber, extractedDetailFields.phoneNumber),
    courtType: firstMeaningfulText(entry.courtType, extractedDetailFields.courtType),
    dateUpdated: firstMeaningfulText(entry.dateUpdated, extractedDetailFields.dateUpdated),
    estimatedRemoval: firstMeaningfulText(entry.estimatedRemoval, extractedDetailFields.estimatedRemoval),
    plaintiffAttorney: firstMeaningfulText(entry.plaintiffAttorney, extractedDetailFields.plaintiffAttorney),
    responsibility: firstMeaningfulText(entry.responsibility, extractedDetailFields.responsibility),
    liability: firstMeaningfulText(entry.liability, extractedDetailFields.liability),
  };
  if (!mappedFields.referenceNumber && mappedFields.court) {
    const splitCourt = splitTrailingPublicRecordIdentifier(mappedFields.court);
    mappedFields.court = firstMeaningfulText(splitCourt.court, mappedFields.court);
    mappedFields.referenceNumber = firstMeaningfulText(splitCourt.referenceNumber);
  }
  const structuredValues = new Set(
    Object.values(mappedFields)
      .map((value) => String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase())
      .filter(Boolean),
  );
  const residualDetails = details.filter((detail) => {
    const normalizedDetail = String(detail ?? "").replace(/\s+/g, " ").trim().toLowerCase();
    if (!normalizedDetail || structuredValues.has(normalizedDetail)) {
      return false;
    }
    return !PUBLIC_RECORD_DETAIL_LABELS.some(
      ([label]) =>
        normalizedDetail === label ||
        normalizedDetail.startsWith(`${label} |`) ||
        normalizedDetail.startsWith(`${label}:`) ||
        normalizedDetail.startsWith(`${label} `),
    );
  });
  const summary = firstMeaningfulText(
    entry.summary,
    entry.recordType,
    residualDetails[0],
    details[0]
  );
  return {
    ...mappedFields,
    summary: summary ?? "Public record",
    details: residualDetails.length > 0 ? residualDetails : summary ? [summary] : [],
    sourcePages: uniquePositiveNumbers(entry.sourcePages ?? fallbackPages),
  };
};

const normalizePublicRecords = (component, fallbackPages = []) => {
  const rawRecords = Array.isArray(component?.records) ? component.records : [];
  return rawRecords
    .map((entry) => normalizePublicRecordEntry(entry, fallbackPages))
    .filter(Boolean);
};

const publicRecordContextText = (record) =>
  [
    record?.recordType,
    record?.summary,
    record?.status,
    ...(Array.isArray(record?.details) ? record.details : []),
  ]
    .map((value) => String(value ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" | ")
    .toLowerCase();

const buildConsumerInformationIndicators = (rawIndicators, accounts, fallbackPages = [], publicRecords = []) => {
  const result = [];
  const seen = new Set();
  const pushIndicator = (indicator) => {
    if (!indicator) return;
    const key = [
      normalizeMatchText(indicator.code),
      normalizeMatchText(indicator.description),
      normalizeMatchText(indicator.linkedAccountName),
      normalizeMaskedAccountNumber(indicator.linkedAccountNumber),
    ].join("::");
    if (seen.has(key)) return;
    seen.add(key);
    result.push(indicator);
  };

  for (const entry of Array.isArray(rawIndicators) ? rawIndicators : []) {
    if (!entry || typeof entry !== "object") continue;
    pushIndicator({
      code: firstMeaningfulText(entry.code),
      description: firstMeaningfulText(entry.description, entry.summary, entry.code) ?? "Consumer information indicator",
      category: firstMeaningfulText(entry.category),
      sourcePages: uniquePositiveNumbers(entry.sourcePages ?? fallbackPages),
      linkedAccountName: firstMeaningfulText(entry.linkedAccountName),
      linkedAccountNumber: firstMeaningfulText(entry.linkedAccountNumber),
    });
  }

  for (const account of Array.isArray(accounts) ? accounts : []) {
    const indicator = firstMeaningfulText(account?.consumerInformationIndicator);
    const context = accountContextText(account).toLowerCase();
    if (indicator) {
      pushIndicator({
        code: indicator,
        description: indicator,
        sourcePages: uniquePositiveNumbers(account?.sourcePages ?? fallbackPages),
        linkedAccountName: firstMeaningfulText(account?.accountName),
        linkedAccountNumber: firstMeaningfulText(account?.accountNumber),
      });
      continue;
    }
    if (/\bbankruptcy\b|included in bankruptcy/.test(context)) {
      pushIndicator({
        code: null,
        description: "Bankruptcy-related account condition",
        category: "bankruptcy",
        sourcePages: uniquePositiveNumbers(account?.sourcePages ?? fallbackPages),
        linkedAccountName: firstMeaningfulText(account?.accountName),
        linkedAccountNumber: firstMeaningfulText(account?.accountNumber),
      });
    }
  }

  for (const record of Array.isArray(publicRecords) ? publicRecords : []) {
    const context = publicRecordContextText(record);
    if (!/\bbankruptcy\b|\bchapter\s+\d+\b/.test(context)) {
      continue;
    }
    pushIndicator({
      code: null,
      description: firstMeaningfulText(record?.recordType, record?.summary) ?? "Bankruptcy public record",
      category: "bankruptcy",
      sourcePages: uniquePositiveNumbers(record?.sourcePages ?? fallbackPages),
    });
  }

  return result;
};

const mapEquifaxResultToCreditReport = ({ session, workerResult }) => {
  const { components = {}, componentStatus = {}, validationIssues = [], readyForAttorney = false, meta = {} } =
    workerResult;

  const reportConfirmation = components.reportConfirmationDetails ?? {};
  const personalInformation = components.personalInformation ?? {};
  const summary = components.summary ?? {};
  const otherItemsSummary = components.otherItemsSummary ?? {};
  const accountsContainer = components.accounts ?? { accounts: [] };
  const collectionsContainer = components.collections ?? { collections: [], collectionCount: 0 };
  const inquiriesContainer = components.inquiries ?? {
    hardInquiries: [],
    softInquiries: [],
    hardInquiryCount: 0,
    softInquiryCount: 0,
  };

  const hardInquiries = Array.isArray(inquiriesContainer.hardInquiries)
    ? inquiriesContainer.hardInquiries.map((entry) => ({ ...entry, inquiryType: "hard" }))
    : [];
  const softInquiries = Array.isArray(inquiriesContainer.softInquiries)
    ? inquiriesContainer.softInquiries.map((entry) => ({ ...entry, inquiryType: "soft" }))
    : [];

  const inquiries = [...hardInquiries, ...softInquiries];
  const sourceComponents = buildComponentSourceMap(meta.componentSources ?? meta.pageWindows);
  const accounts = attachAccountSources(
    Array.isArray(accountsContainer.accounts) ? accountsContainer.accounts : [],
    meta.accountSources,
    sourceComponents.accounts?.pages,
    meta.accountHistoryEvidence
  ).map((account) => enrichAccount(account, "tradeline"));
  const collections = attachCollectionSources(
    Array.isArray(collectionsContainer.collections) ? collectionsContainer.collections : [],
    meta.collectionSources,
    sourceComponents.collections?.pages
  ).map((collection) => enrichCollection(collection));
  const publicRecordsComponent = components.publicRecords ?? { publicRecordCount: 0, records: [] };
  const publicRecords = normalizePublicRecords(publicRecordsComponent, sourceComponents.publicRecords?.pages);
  const consumerInformationIndicators = buildConsumerInformationIndicators(
    components.consumerInformationIndicators?.indicators,
    accounts,
    sourceComponents.consumerInformationIndicators?.pages,
    publicRecords
  );

  const reportDate =
    reportConfirmation.reportDate ??
    summary.reportDate ??
    meta.reportDate ??
    "";

  return {
    bureau: "Equifax",
    profileId: meta.profileId ?? workerResult.profile ?? "equifax_old_v1",
    reportDate,
    personalInfo: {
      name: personalInformation.name ?? reportConfirmation.consumerName ?? "Not reported",
      addresses: normalizeArray(personalInformation.addresses),
      currentAddresses: normalizeArray(personalInformation.currentAddresses),
      previousAddresses: normalizeArray(personalInformation.previousAddresses),
      ssn: personalInformation.socialSecurityNumber ?? undefined,
      socialSecurityNumbers: normalizeUniqueStrings([
        ...normalizeArray(personalInformation.socialSecurityNumbers),
        personalInformation.socialSecurityNumber ?? "",
      ]),
      dob: personalInformation.dateOfBirth ?? undefined,
      employmentHistory: personalInformation.employmentHistory ?? undefined,
    },
    accounts,
    collections,
    accountSummaries: Array.isArray(components.creditAccountsSummary)
      ? components.creditAccountsSummary
      : [],
    inquiries,
    publicRecords,
    consumerInformationIndicators,
    creditScores: [],
    rawText: meta.fullText ?? "",
    reportId: session.id,
    fileName: session.uploadedFileName,
    confirmationNumber: reportConfirmation.confirmationNumber ?? null,
    consumerName: reportConfirmation.consumerName ?? null,
    creditFileStatus: summary.creditFileStatus ?? null,
    alertContacts: summary.alertContacts ?? null,
    averageAccountAge: summary.averageAccountAge ?? null,
    lengthOfCreditHistory: summary.lengthOfCreditHistory ?? null,
    accountsWithNegativeInfo: summary.accountsWithNegativeInfo ?? null,
    oldestAccount: summary.oldestAccount ?? null,
    recentAccount: summary.recentAccount ?? null,
    recentInquiry: otherItemsSummary.recentInquiry ?? null,
    personalInfoItemCount: otherItemsSummary.personalInfoItemCount ?? 0,
    inquiryCount:
      otherItemsSummary.inquiryCount ??
      (inquiriesContainer.hardInquiryCount ?? 0) + (inquiriesContainer.softInquiryCount ?? 0),
    publicRecordCount: publicRecordsComponent.publicRecordCount ?? otherItemsSummary.publicRecordCount ?? publicRecords.length,
    collectionCount:
      collectionsContainer.collectionCount ?? otherItemsSummary.collectionCount ?? 0,
    statementCount: otherItemsSummary.statementCount ?? 0,
    componentStatus,
    validationIssues,
    readyForAttorney,
    components,
    sourceSessionId: meta.sessionId ?? session.id,
    sourceComponents,
    inquiryBuckets: {
      hardInquiries,
      softInquiries,
      hardInquiryCount: inquiriesContainer.hardInquiryCount ?? hardInquiries.length,
      softInquiryCount: inquiriesContainer.softInquiryCount ?? softInquiries.length,
    },
  };
};

const mapExperianInquiriesToLegacy = (entries, inquiryType) =>
  (Array.isArray(entries) ? entries : []).map((entry) => ({
    subscriberName: entry?.subscriberName ?? null,
    inquiryDate: Array.isArray(entry?.inquiredOnDates) ? entry.inquiredOnDates[0] ?? null : entry?.inquiryDate ?? null,
    purpose: entry?.description ?? null,
    permissiblePurpose: null,
    contact: [
      ...normalizeArray(entry?.address),
      entry?.phoneNumber ?? "",
    ]
      .filter(Boolean)
      .join(" | ") || null,
    referenceNumber: null,
    inquiryType,
  }));

const mapExperianRawAccountToLegacy = (account) => {
  const header = account?.header ?? {};
  const accountInfo = account?.accountInfo ?? {};
  const contactInfo = account?.contactInfo ?? {};
  const historyEvidence = account?._historyEvidence ?? {};
  const paymentHistoryRows = extractMonthlyHistoryRows(account?.paymentHistory);
  const { paymentHistory, paymentHistoryYears } = flattenMonthlyHistoryRows(paymentHistoryRows);
  const balanceHistory = historyRowsFromDatedEntries(account?.balanceHistories, "balance");
  const scheduledPaymentHistoryFromEvidence = historyRowsFromEvidence(historyEvidence?.scheduledPaymentHistory);
  const actualPaymentHistoryFromEvidence = historyRowsFromEvidence(historyEvidence?.actualPaymentHistory);
  const scheduledPaymentHistory =
    scheduledPaymentHistoryFromEvidence.length > 0
      ? scheduledPaymentHistoryFromEvidence
      : historyRowsFromDatedEntries(account?.balanceHistories, "scheduledPayment");
  const actualPaymentHistory =
    actualPaymentHistoryFromEvidence.length > 0
      ? actualPaymentHistoryFromEvidence
      : historyRowsFromDatedEntries(account?.balanceHistories, "paid");

  return {
    accountName: firstMeaningfulText(accountInfo?.accountName, header?.accountName, account?.accountName, "Not reported"),
    accountNumber: firstMeaningfulText(accountInfo?.accountNumber, header?.accountNumber, account?.accountNumber, "Not reported"),
    accountType: firstMeaningfulText(accountInfo?.accountType, account?.accountType, "Not reported"),
    loanType: firstMeaningfulText(accountInfo?.loanType, account?.loanType),
    responsibility: firstMeaningfulText(accountInfo?.responsibility, account?.responsibility, "Not reported"),
    openDate: firstMeaningfulText(accountInfo?.dateOpened, account?.dateOpened, "Not reported"),
    dateOpened: firstMeaningfulText(accountInfo?.dateOpened, account?.dateOpened, "Not reported"),
    status: firstMeaningfulText(accountInfo?.status, account?.status, "Not reported"),
    accountStatus: firstMeaningfulText(accountInfo?.status, account?.status, "Not reported"),
    statusUpdated: firstMeaningfulText(accountInfo?.statusUpdated, account?.statusUpdated),
    balance: firstMeaningfulText(accountInfo?.balance, account?.balance, "Not reported"),
    balanceUpdated: firstMeaningfulText(accountInfo?.balanceUpdated, account?.balanceUpdated),
    recentPayment: firstMeaningfulText(accountInfo?.recentPayment, account?.recentPayment, "Not reported"),
    monthlyPayment: firstMeaningfulText(accountInfo?.monthlyPayment, account?.monthlyPayment, "Not reported"),
    paymentAmount: firstMeaningfulText(accountInfo?.monthlyPayment, account?.monthlyPayment, "Not reported"),
    actualPaymentAmount: firstMeaningfulText(accountInfo?.recentPayment, account?.recentPayment),
    originalBalance: firstMeaningfulText(accountInfo?.originalBalance, account?.originalBalance),
    highestBalance: firstMeaningfulText(accountInfo?.highestBalance, account?.highestBalance),
    terms: firstMeaningfulText(accountInfo?.terms, account?.terms),
    onRecordUntil: firstMeaningfulText(accountInfo?.onRecordUntil, account?.onRecordUntil),
    balanceHistory,
    scheduledPaymentHistory,
    actualPaymentHistory,
    paymentHistory,
    paymentHistoryYears,
    paymentStatusCodes:
      account?.paymentHistory && typeof account.paymentHistory === "object" && !Array.isArray(account.paymentHistory)
        ? account.paymentHistory.paymentStatusCodes ?? {}
        : {},
    additionalInformation: normalizeUniqueStrings(normalizeArray(account?.additionalInfo)),
    consumerStatement: normalizeUniqueStrings(normalizeArray(account?.consumerStatement)),
    reinvestigationInfo: normalizeUniqueStrings(normalizeArray(account?.reinvestigationInfo)),
    comments: normalizeUniqueStrings([
      ...normalizeArray(accountInfo?.comments),
      ...normalizeArray(account?.comments),
      ...normalizeArray(contactInfo?.comments),
    ]),
    contact: normalizeUniqueStrings([
      ...normalizeArray(contactInfo?.addressLines),
      ...normalizeArray(contactInfo?.phoneNumbers),
      ...normalizeArray(account?.contact),
    ]),
    isClosed: Boolean(header?.isClosed ?? account?.isClosed),
    sourcePages: uniquePositiveNumbers(account?.sourcePages),
  };
};

const mapExperianResultToCreditReport = ({ session, workerResult }) => {
  const { components = {}, componentStatus = {}, validationIssues = [], readyForAttorney = false, meta = {} } =
    workerResult;

  const reportOverview = components.reportOverview ?? {};
  const personalInformation = components.personalInformation ?? {};
  const accountsComponent = components.accounts ?? { accountCount: 0, accounts: [] };
  const publicRecords = components.publicRecords ?? { publicRecordCount: 0, records: [] };
  const hardInquiryComponent = components.hardInquiries ?? { inquiryCount: 0, inquiries: [] };
  const softInquiryComponent = components.softInquiries ?? { inquiryCount: 0, inquiries: [] };
  const sourceComponents = buildComponentSourceMap(meta.componentSources ?? meta.pageWindows);
  const hardInquiries = mapExperianInquiriesToLegacy(hardInquiryComponent.inquiries, "hard");
  const softInquiries = mapExperianInquiriesToLegacy(softInquiryComponent.inquiries, "soft");
  const inquiries = [...hardInquiries, ...softInquiries];
  const accounts = (Array.isArray(accountsComponent.accounts) ? accountsComponent.accounts : [])
    .map(mapExperianRawAccountToLegacy)
    .map((account) => enrichAccount(account, "tradeline"));
  // Experian Annual Credit Reports present collection entries inside Accounts.
  // Do not split collection-like tradelines into a separate Collections section.
  const collections = [];
  const normalizedPublicRecords = normalizePublicRecords(publicRecords, sourceComponents.publicRecords?.pages);
  const consumerInformationIndicators = buildConsumerInformationIndicators(
    components.consumerInformationIndicators?.indicators,
    accounts,
    sourceComponents.consumerInformationIndicators?.pages,
    normalizedPublicRecords
  );

  return {
    bureau: "Experian",
    profileId: meta.profileId ?? workerResult.profile ?? "experian_acr_v1",
    reportDate: reportOverview.dateGenerated ?? meta.reportDate ?? "",
    personalInfo: {
      name:
        reportOverview.consumerName ??
        (Array.isArray(personalInformation.names) ? personalInformation.names[0] : null) ??
        "Not reported",
      addresses: normalizeArray(personalInformation.addresses),
      currentAddresses: [],
      previousAddresses: [],
      ssn: undefined,
      socialSecurityNumbers: normalizeUniqueStrings(personalInformation.socialSecurityNumbers),
      dob: personalInformation.yearOfBirth ?? undefined,
      employmentHistory: normalizeArray(personalInformation.employers).join("; ") || undefined,
    },
    accounts,
    collections,
    accountSummaries: [],
    inquiries,
    publicRecords: normalizedPublicRecords,
    consumerInformationIndicators,
    creditScores: [],
    rawText: meta.fullText ?? "",
    reportId: session.id,
    fileName: session.uploadedFileName,
    confirmationNumber: reportOverview.reportNumber ?? null,
    consumerName: reportOverview.consumerName ?? null,
    inquiryCount:
      (hardInquiryComponent.inquiryCount ?? hardInquiries.length) +
      (softInquiryComponent.inquiryCount ?? softInquiries.length),
    publicRecordCount: publicRecords.publicRecordCount ?? normalizedPublicRecords.length,
    componentStatus,
    validationIssues,
    readyForAttorney,
    components,
    sourceSessionId: meta.sessionId ?? session.id,
    sourceComponents,
    inquiryBuckets: {
      hardInquiries,
      softInquiries,
      hardInquiryCount: hardInquiryComponent.inquiryCount ?? hardInquiries.length,
      softInquiryCount: softInquiryComponent.inquiryCount ?? softInquiries.length,
    },
  };
};

const mapEquifaxNewRawAccountToLegacy = (account) => {
  const paymentHistoryRows = Array.isArray(account?.paymentHistory) ? account.paymentHistory : [];
  const paymentHistory = [];
  const paymentHistoryYears = [];
  for (const row of paymentHistoryRows) {
    paymentHistoryYears.push(String(row?.year ?? "").trim());
    for (const monthKey of ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]) {
      paymentHistory.push(String(row?.[monthKey] ?? "-").trim() || "-");
    }
  }

  const month24Sections = Array.isArray(account?.month24History?.sections) ? account.month24History.sections : [];
  const rowsForSection = (key) =>
    month24Sections.find((section) => normalizeMatchText(section?.key) === normalizeMatchText(key))?.rows ?? [];

  return {
    accountName: account?.accountName ?? "Not reported",
    accountNumber: account?.accountNumber ?? "Not reported",
    accountType: account?.loanAccountType ?? "Not reported",
    openDate: account?.dateOpened ?? "Not reported",
    status: account?.status ?? "Not reported",
    balance: account?.balance ?? "Not reported",
    monthlyPayment: account?.scheduledPaymentAmount || "Not reported",
    paymentAmount: account?.scheduledPaymentAmount || "Not reported",
    recentPayment: account?.actualPaymentAmount || "Not reported",
    actualPaymentAmount: account?.actualPaymentAmount || "Not reported",
    paymentHistory,
    paymentHistoryYears,
    balanceHistory: rowsForSection("balance"),
    creditLimitHistory: rowsForSection("creditLimit"),
    amountPastDueHistory: rowsForSection("pastDueAmount"),
    creditLimit: account?.creditLimit ?? "Not reported",
    highCredit: account?.highCredit ?? "Not reported",
    dateOpened: account?.dateOpened ?? "Not reported",
    dateReported: account?.dateReported ?? "Not reported",
    dateClosed: account?.dateClosed ?? "Not reported",
    lastPaymentDate: account?.dateOfLastPayment ?? "Not reported",
    amountPastDue: account?.amountPastDue ?? "Not reported",
    chargeOffAmount: account?.chargeOffAmount ?? "Not reported",
    terms: account?.termDuration || "Not reported",
    termFrequency: account?.termsFrequency || "Not reported",
    monthsReviewed: account?.monthsReviewed || "Not reported",
    dateOfFirstDelinquency: account?.dateOfFirstDelinquency || "Not reported",
    dateOfLastActivity: account?.dateOfLastActivity || "Not reported",
    responsibility: account?.owner ?? "Not reported",
    accountStatus: account?.status ?? "Not reported",
    comments: Array.isArray(account?.narrativeCodes)
      ? account.narrativeCodes.map((entry) => entry?.description).filter(Boolean)
      : [],
    contact: [account?.address ?? "", account?.phoneNumber ?? ""].filter(Boolean),
    isClosed: Boolean(account?.isClosed),
    sourcePages: uniquePositiveNumbers(account?.sourcePages),
  };
};

const mapEquifaxNewInquiryToLegacy = (entries) =>
  (Array.isArray(entries) ? entries : []).map((entry) => ({
    subscriberName: entry?.companyName ?? null,
    inquiryDate: Array.isArray(entry?.inquiryDates) ? entry.inquiryDates[0] ?? null : null,
    purpose: null,
    permissiblePurpose: null,
    contact: [...normalizeArray(entry?.addressLines), entry?.phoneNumber ?? ""].filter(Boolean).join(" | ") || null,
    referenceNumber: null,
    inquiryType: normalizeMatchText(entry?.inquiryType) === "hard" ? "hard" : "soft",
  }));

const mapGenericCollectionToLegacy = (entry) => ({
  dateReported: firstMeaningfulText(entry?.dateReported),
  collectionAgency: firstMeaningfulText(entry?.collectionAgency, entry?.agencyName, entry?.summary),
  balanceDate: firstMeaningfulText(entry?.balanceDate),
  originalCreditorName: firstMeaningfulText(entry?.originalCreditorName),
  accountDesignatorCode: firstMeaningfulText(entry?.accountDesignatorCode),
  dateAssigned: firstMeaningfulText(entry?.dateAssigned),
  accountNumber: firstMeaningfulText(entry?.accountNumber),
  originalAmountOwed: firstMeaningfulText(entry?.originalAmountOwed),
  creditorClassification: firstMeaningfulText(entry?.creditorClassification),
  amount: firstMeaningfulText(entry?.amount, entry?.balance),
  lastPaymentDate: firstMeaningfulText(entry?.lastPaymentDate),
  statusDate: firstMeaningfulText(entry?.statusDate),
  dateOfFirstDelinquency: firstMeaningfulText(entry?.dateOfFirstDelinquency),
  status: firstMeaningfulText(entry?.status),
  comments: normalizeUniqueStrings(entry?.comments ?? entry?.details ?? entry?.lines ?? []),
  contact: normalizeUniqueStrings(entry?.contact ?? entry?.addressLines ?? []),
  sourceText: firstMeaningfulText(entry?.sourceText, entry?.summary),
  details: normalizeUniqueStrings(entry?.details ?? entry?.lines ?? []),
  sourcePages: uniquePositiveNumbers(entry?.sourcePages),
});

const mapEquifaxNewResultToCreditReport = ({ session, workerResult }) => {
  const { components = {}, componentStatus = {}, validationIssues = [], readyForAttorney = false, meta = {} } =
    workerResult;

  const reportConfirmation = components.reportConfirmationDetails ?? {};
  const summary = components.summary ?? {};
  const personalInformation = components.personalInformation ?? {};
  const accountsComponent = components.accounts ?? { accountCount: 0, accounts: [] };
  const collectionsComponent = components.collections ?? { collectionCount: 0, collections: [] };
  const publicRecordsComponent = components.publicRecords ?? { publicRecordCount: 0, records: [] };
  const inquiriesComponent = components.inquiries ?? { inquiryCount: 0, inquiries: [] };
  const sourceComponents = buildComponentSourceMap(meta.componentSources ?? meta.pageWindows);
  const rawAccounts = Array.isArray(accountsComponent.accounts) ? accountsComponent.accounts : [];
  const accounts = rawAccounts.map(mapEquifaxNewRawAccountToLegacy).map((account) => enrichAccount(account, "tradeline"));
  const collections = attachCollectionSources(
    (Array.isArray(collectionsComponent.collections) ? collectionsComponent.collections : []).map(mapGenericCollectionToLegacy),
    meta.collectionSources,
    sourceComponents.collections?.pages
  ).map((collection) => enrichCollection(collection));
  const publicRecords = normalizePublicRecords(publicRecordsComponent, sourceComponents.publicRecords?.pages);
  const consumerInformationIndicators = buildConsumerInformationIndicators(
    components.consumerInformationIndicators?.indicators,
    accounts,
    sourceComponents.consumerInformationIndicators?.pages,
    publicRecords
  );
  const inquiries = mapEquifaxNewInquiryToLegacy(inquiriesComponent.inquiries);

  return {
    bureau: "Equifax",
    profileId: meta.profileId ?? workerResult.profile ?? "equifax_new_v1",
    reportDate: reportConfirmation.reportDate ?? summary.reportDate ?? meta.reportDate ?? "",
    personalInfo: {
      name: personalInformation.name ?? reportConfirmation.consumerName ?? "Not reported",
      addresses: [
        personalInformation.currentAddress,
        ...normalizeArray(personalInformation.formerAddresses),
      ].filter(Boolean),
      currentAddresses: normalizeArray(personalInformation.currentAddress ? [personalInformation.currentAddress] : []),
      previousAddresses: normalizeArray(personalInformation.formerAddresses),
      ssn: personalInformation.socialSecurityNumber ?? undefined,
      socialSecurityNumbers: normalizeUniqueStrings([
        ...normalizeArray(personalInformation.socialSecurityNumbers),
        personalInformation.socialSecurityNumber ?? "",
      ]),
      dob: personalInformation.dateOfBirth ?? undefined,
      employmentHistory: normalizeArray(personalInformation.employmentInformation).join("; ") || undefined,
    },
    accounts,
    collections,
    accountSummaries: [],
    inquiries,
    publicRecords,
    consumerInformationIndicators,
    creditScores: [],
    rawText: meta.fullText ?? "",
    reportId: session.id,
    fileName: session.uploadedFileName,
    confirmationNumber: reportConfirmation.confirmationNumber ?? null,
    consumerName: reportConfirmation.consumerName ?? null,
    averageAccountAge: summary.averageAccountAge ?? null,
    lengthOfCreditHistory: summary.lengthOfCreditHistory ?? null,
    oldestAccount: summary.oldestAccount ?? null,
    recentAccount: summary.mostRecentAccount ?? null,
    inquiryCount: inquiriesComponent.inquiryCount ?? inquiries.length,
    publicRecordCount: publicRecordsComponent.publicRecordCount ?? publicRecords.length,
    collectionCount: collectionsComponent.collectionCount ?? collections.length,
    componentStatus,
    validationIssues,
    readyForAttorney,
    components,
    sourceSessionId: meta.sessionId ?? session.id,
    sourceComponents,
  };
};

const mapTransunionInquiryToLegacy = (entries, inquiryType) =>
  (Array.isArray(entries) ? entries : []).map((entry) => ({
    subscriberName: entry?.subscriberName ?? null,
    inquiryDate: entry?.requestedOn ?? null,
    purpose: null,
    permissiblePurpose: null,
    contact: [
      ...normalizeArray(entry?.location),
      entry?.phoneNumber ?? "",
    ]
      .filter(Boolean)
      .join(" | ") || null,
    referenceNumber: null,
    inquiryType,
  }));

const mapTransunionRawAccountToLegacy = (account) => {
  const accountInfo = account?.accountInfo ?? {};
  const contactInfo = account?.contactInfo ?? {};
  const paymentHistoryRows = Array.isArray(account?.paymentHistory) ? account.paymentHistory : [];
  const balanceHistories = Array.isArray(account?.balanceHistories) ? account.balanceHistories : [];
  const findHistoryRows = (label) =>
    balanceHistories.find((entry) => normalizeMatchText(entry?.label) === normalizeMatchText(label))?.rows ?? [];

  const paymentHistory = [];
  const paymentHistoryYears = [];
  for (const row of paymentHistoryRows) {
    paymentHistoryYears.push(String(row?.year ?? "").trim());
    for (const monthKey of ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]) {
      paymentHistory.push(String(row?.[monthKey] ?? "---").trim() || "---");
    }
  }

  const contactLines = [
    ...normalizeArray(contactInfo?.address),
    contactInfo?.phoneNumber ?? "",
  ].filter(Boolean);

  return {
    accountName: account?.accountName ?? accountInfo?.accountName ?? "Not reported",
    accountNumber: account?.accountNumber ?? accountInfo?.accountNumber ?? "Not reported",
    accountType: accountInfo?.accountType ?? "Not reported",
    accountCategory: accountInfo?.loanType ?? undefined,
    openDate: accountInfo?.dateOpened ?? "Not reported",
    status: accountInfo?.payStatus ?? "Not reported",
    balance: accountInfo?.balance ?? "Not reported",
    paymentHistory,
    paymentHistoryYears,
    balanceHistory: findHistoryRows("Balance"),
    scheduledPaymentHistory: findHistoryRows("Scheduled Payment"),
    amountPastDueHistory: findHistoryRows("Past Due"),
    dateOpened: accountInfo?.dateOpened ?? "Not reported",
    dateReported: accountInfo?.dateUpdated ?? "Not reported",
    dateClosed: accountInfo?.dateClosed ?? "Not reported",
    lastPaymentDate: accountInfo?.lastPaymentMade ?? "Not reported",
    paymentAmount: accountInfo?.monthlyPayment ?? accountInfo?.paymentReceived ?? "Not reported",
    amountPastDue: accountInfo?.amountPastDue ?? "Not reported",
    creditLimit: accountInfo?.creditLimit ?? accountInfo?.creditLimitHistory ?? "Not reported",
    highestBalance: accountInfo?.highBalance ?? accountInfo?.highCredit ?? "Not reported",
    responsibility: accountInfo?.responsibility ?? "Not reported",
    accountStatus: accountInfo?.payStatus ?? "Not reported",
    comments: accountInfo?.remarks && accountInfo?.remarks !== "Not reported" ? [accountInfo.remarks] : [],
    contact: contactLines,
    isClosed: Boolean(account?.isClosed),
    sourcePages: uniquePositiveNumbers(account?.sourcePages),
  };
};

const mapTransunionResultToCreditReport = ({ session, workerResult }) => {
  const { components = {}, componentStatus = {}, validationIssues = [], readyForAttorney = false, meta = {} } =
    workerResult;

  const reportOverview = components.reportOverview ?? {};
  const personalInformation = components.personalInformation ?? {};
  const adverseAccounts = components.adverseAccounts ?? { accountCount: 0, accounts: [] };
  const satisfactoryAccounts = components.satisfactoryAccounts ?? { accountCount: 0, accounts: [] };
  const collectionsComponent = components.collections ?? { collectionCount: 0, collections: [] };
  const publicRecordsComponent = components.publicRecords ?? { publicRecordCount: 0, records: [] };
  const inquiriesComponent = components.inquiries ?? { inquiryCount: 0, inquiries: [] };
  const accountReviewComponent = components.accountReviewInquiries ?? { inquiryCount: 0, inquiries: [] };
  const sourceComponents = buildComponentSourceMap(meta.componentSources ?? meta.pageWindows);
  if (!sourceComponents.accounts) {
    sourceComponents.accounts = {
      pages: uniquePositiveNumbers([
        ...(sourceComponents.adverseAccounts?.pages ?? []),
        ...(sourceComponents.satisfactoryAccounts?.pages ?? []),
      ]),
    };
  }

  const rawAccounts = [
    ...(Array.isArray(adverseAccounts.accounts) ? adverseAccounts.accounts : []),
    ...(Array.isArray(satisfactoryAccounts.accounts) ? satisfactoryAccounts.accounts : []),
  ];
  const accounts = rawAccounts.map(mapTransunionRawAccountToLegacy).map((account) => enrichAccount(account, "tradeline"));
  const explicitCollections = attachCollectionSources(
    (Array.isArray(collectionsComponent.collections) ? collectionsComponent.collections : []).map(mapGenericCollectionToLegacy),
    meta.collectionSources,
    sourceComponents.collections?.pages
  ).map((collection) => enrichCollection(collection));
  const collections = mergeCollections(explicitCollections, deriveCollectionsFromAccounts(accounts));
  const publicRecords = normalizePublicRecords(publicRecordsComponent, sourceComponents.publicRecords?.pages);
  const consumerInformationIndicators = buildConsumerInformationIndicators(
    components.consumerInformationIndicators?.indicators,
    accounts,
    sourceComponents.consumerInformationIndicators?.pages,
    publicRecords
  );
  const hardInquiries = mapTransunionInquiryToLegacy(inquiriesComponent.inquiries, "hard");
  const softInquiries = mapTransunionInquiryToLegacy(accountReviewComponent.inquiries, "soft");
  const inquiries = [...hardInquiries, ...softInquiries];

  return {
    bureau: "TransUnion",
    profileId: meta.profileId ?? workerResult.profile ?? "transunion_acr_v1",
    reportDate: reportOverview.creditReportDate ?? reportOverview.dateCreated ?? meta.reportDate ?? "",
    personalInfo: {
      name: personalInformation.name ?? reportOverview.consumerName ?? "Not reported",
      addresses: normalizeArray(personalInformation.addresses),
      currentAddresses: normalizeArray(personalInformation.currentAddresses),
      previousAddresses: normalizeArray(personalInformation.previousAddresses),
      ssn: personalInformation.socialSecurityNumber ?? undefined,
      socialSecurityNumbers: normalizeUniqueStrings([
        ...normalizeArray(personalInformation.socialSecurityNumbers),
        personalInformation.socialSecurityNumber ?? "",
      ]),
      dob: personalInformation.dateOfBirth ?? undefined,
      employmentHistory: normalizeArray(personalInformation.employers).join("; ") || undefined,
    },
    accounts,
    accountSummaries: [],
    collections,
    inquiries,
    publicRecords,
    consumerInformationIndicators,
    creditScores: [],
    rawText: meta.fullText ?? "",
    reportId: session.id,
    fileName: session.uploadedFileName,
    confirmationNumber: reportOverview.fileNumber ?? null,
    consumerName: reportOverview.consumerName ?? null,
    inquiryCount:
      (inquiriesComponent.inquiryCount ?? hardInquiries.length) +
      (accountReviewComponent.inquiryCount ?? softInquiries.length),
    publicRecordCount: publicRecordsComponent.publicRecordCount ?? publicRecords.length,
    collectionCount: collectionsComponent.collectionCount ?? collections.length,
    componentStatus,
    validationIssues,
    readyForAttorney,
    components,
    sourceSessionId: meta.sessionId ?? session.id,
    sourceComponents,
    inquiryBuckets: {
      hardInquiries,
      softInquiries,
      hardInquiryCount: inquiriesComponent.inquiryCount ?? hardInquiries.length,
      softInquiryCount: accountReviewComponent.inquiryCount ?? softInquiries.length,
    },
  };
};

export const mapWorkerResultToCreditReport = ({ session, workerResult }) => {
  const profileId = workerResult?.meta?.profileId ?? workerResult?.profile ?? "equifax_old_v1";
  if (profileId === "equifax_new_v1") {
    return mapEquifaxNewResultToCreditReport({ session, workerResult });
  }
  if (profileId === "experian_acr_v1") {
    return mapExperianResultToCreditReport({ session, workerResult });
  }
  if (profileId === "transunion_acr_v1") {
    return mapTransunionResultToCreditReport({ session, workerResult });
  }
  return mapEquifaxResultToCreditReport({ session, workerResult });
};
