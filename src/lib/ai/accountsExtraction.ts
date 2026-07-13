import { Account, CreditReport } from "@/lib/types/creditReport";
import { createDefaultAccount, mergeAccountWithDefaults } from "@/lib/ai/accountTemplates";
import { getCurrentPdfDocument, getCurrentPdfPageOffsets } from "@/utils/pdf/extractText";
import { convertPDFPageToImage } from "@/utils/pdf/pdfToImage";
import { devDiagnostics } from "@/lib/security/devDiagnostics";

interface AccountDetection {
  accountName: string;
  accountNumber?: string;
  anchorText?: string;
  snippet?: string;
}

interface AccountExtractionLog {
  stage: string;
  timestamp: number;
  details?: Record<string, unknown>;
  error?: string;
}

const MAX_SNIPPET_LENGTH = 6500;
const SNIPPET_PADDING = 2200;
const ACCOUNT_RESULT_LIMIT = 20;
const DEFAULT_DEBUG_PAGE_COUNT = 3;
const CLIENT_SIDE_ACCOUNT_EXTRACTION_DISABLED = true;
const CLIENT_SIDE_ACCOUNT_EXTRACTION_DISABLED_REASON =
  "Phase 0 security lock: account extraction calls are disabled in the browser.";

const normalizeWhitespace = (value: string) => value.replace(/\r/g, "");

const splitOnPageBoundaries = (text: string): string[] => {
  const byFormFeed = text.split(/\f+/).map((chunk) => chunk.trim()).filter(Boolean);
  if (byFormFeed.length >= DEFAULT_DEBUG_PAGE_COUNT) {
    return byFormFeed;
  }

  const byPageLabel = text.split(/(?:\n|\r)\s*page\s+\d+/i).map((chunk) => chunk.trim()).filter(Boolean);
  if (byPageLabel.length >= DEFAULT_DEBUG_PAGE_COUNT) {
    return byPageLabel;
  }

  return [];
};

const chunkSnippet = (text: string, count: number): string[] => {
  if (!text) return [];
  const clean = text.trim();
  if (!clean) return [];

  const chunkLength = Math.max(Math.ceil(clean.length / count), 900);
  const chunks: string[] = [];
  for (let i = 0; i < count; i++) {
    const start = i * chunkLength;
    if (start >= clean.length) {
      break;
    }
    const end = Math.min(clean.length, start + chunkLength);
    chunks.push(clean.slice(start, end).trim());
  }
  return chunks;
};

const createDebugPages = (snippet: string, pageCount: number = DEFAULT_DEBUG_PAGE_COUNT): string[] => {
  if (!snippet) return [];
  const normalized = normalizeWhitespace(snippet);

  const pageSegments = splitOnPageBoundaries(normalized);
  if (pageSegments.length >= pageCount) {
    return pageSegments.slice(0, pageCount);
  }

  const chunks = chunkSnippet(normalized, pageCount);
  const filled = chunks.slice(0, pageCount);

  while (filled.length < pageCount) {
    filled.push("");
  }

  return filled;
};

const derivePageNumbersForAnchor = (anchorIndex: number, totalPages: number): number[] => {
  const offsets = getCurrentPdfPageOffsets();
  if (!offsets || offsets.length === 0) {
    return [];
  }

  let anchorPage = offsets[0].page;
  for (const entry of offsets) {
    if (anchorIndex >= entry.start && anchorIndex < entry.end) {
      anchorPage = entry.page;
      break;
    }
  }

  const pages = [anchorPage];
  if (anchorPage + 1 <= totalPages) pages.push(anchorPage + 1);
  if (anchorPage + 2 <= totalPages) pages.push(anchorPage + 2);
  return pages;
};

const buildDebugPageImages = async (pageNumbers: number[]): Promise<string[]> => {
  if (!pageNumbers || pageNumbers.length === 0) {
    return [];
  }

  const pdfDocument = getCurrentPdfDocument();
  if (!pdfDocument) {
    return [];
  }

  const validPages = Array.from(new Set(pageNumbers)).filter(
    (page) => page >= 1 && page <= pdfDocument.numPages
  );

  const pageImageMap = new Map<number, string>();

  for (const page of validPages) {
    try {
      const image = await convertPDFPageToImage(pdfDocument, page);
      if (image) {
        pageImageMap.set(page, image);
      } else {
        pageImageMap.set(page, "");
      }
    } catch (error) {
      devDiagnostics.error(`Failed to generate image for page ${page}`, error);
      pageImageMap.set(page, "");
    }
  }

  return pageNumbers.map((page) => pageImageMap.get(page) ?? "");
};

const callOpenAI = async (messages: any[], options: Record<string, unknown> = {}) => {
  void messages;
  void options;
  throw new Error(CLIENT_SIDE_ACCOUNT_EXTRACTION_DISABLED_REASON);
};

const extractJsonFromResponse = (content: string): any => {
  if (!content) throw new Error("Empty response from OpenAI");

  const jsonFenceMatch = content.match(/```json([\s\S]*?)```/i);
  const raw = jsonFenceMatch ? jsonFenceMatch[1] : content;

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Could not locate JSON object in response");
  }

  const jsonText = raw.slice(start, end + 1);
  return JSON.parse(jsonText);
};

export const DETECTION_PROMPT_TEMPLATE = [
  {
    role: "system",
    content:
      "You are an expert credit report analyst. Identify every individual credit account (tradeline) in the provided credit report text."
  },
  {
    role: "user",
    content: [
      {
        type: "text",
        text: `Scan the credit report below and return JSON describing every account/tradeline that belongs in the Accounts section.

Rules:
- Only include credit accounts (tradelines). Do not include collections, inquiries, public records, or summaries.
- For each account provide:
  * accountName: The creditor name exactly as it appears in the report.
  * accountNumber: The masked account number if shown. If unavailable use "Not reported".
  * anchorText: A short excerpt (<= 220 characters) copied verbatim from the report that uniquely identifies this account. Preserve spacing exactly so it can be matched.
- Return JSON in this format:
{
  "accounts": [
    {
      "accountName": "string",
      "accountNumber": "string",
      "anchorText": "string"
    }
  ]
}
- The response must be valid JSON with double quotes and no comments.
- Limit the list to at most {{LIMIT}} accounts.

Credit report text:
<<<REPORT_TEXT_START>>>
{{TEXT}}
<<<REPORT_TEXT_END>>>`
      }
    ]
  }
];

const detectionPrompt = (text: string, customTemplate?: any[]) => {
  const template = customTemplate || DETECTION_PROMPT_TEMPLATE;
  // Deep copy to avoid mutating the template
  const messages = JSON.parse(JSON.stringify(template));

  // Replace variables in the last user message
  const lastMsg = messages[messages.length - 1];
  if (lastMsg.content && Array.isArray(lastMsg.content)) {
    for (const item of lastMsg.content) {
      if (item.type === 'text') {
        item.text = item.text
          .replace('{{LIMIT}}', String(ACCOUNT_RESULT_LIMIT))
          .replace('{{TEXT}}', text.slice(0, 25000));
      }
    }
  } else if (lastMsg.content && typeof lastMsg.content === 'string') {
    lastMsg.content = lastMsg.content
      .replace('{{LIMIT}}', String(ACCOUNT_RESULT_LIMIT))
      .replace('{{TEXT}}', text.slice(0, 25000));
  }

  return messages;
};

export const EXTRACTION_PROMPT_TEMPLATE = [
  {
    role: "system",
    content:
      "You extract structured JSON for a single credit account from a credit report excerpt."
  },
  {
    role: "user",
    content: [
      {
        type: "text",
        text: `Given the credit report excerpt below, produce a JSON object describing ONLY the account named "{{ACCOUNT_NAME}}" (account number: "{{ACCOUNT_NUMBER}}").

Output requirements:
- Respond with JSON only, no markdown or extra commentary.
- Use double quotes on all keys.
- If a value is unknown or not present, use "Not reported" for descriptive fields or "-" for monthly values.
- For month-by-month history arrays (e.g., balanceHistory) return exactly three yearly records, each with keys year, jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec.
- The paymentHistory array must contain 12 entries per detected payment-history year row (most recent year first if available). Use "-" for missing months.
- paymentStatusCodes must include every standard code even if the meanings are default.

Required JSON structure:
{
  "accountName": "string",
  "accountNumber": "string",
  "accountType": "string",
  "accountCategory": "string",
  "accountOwnership": "string",
  "openDate": "string",
  "status": "string",
  "balance": "string",
  "balanceHistory": [ { "year": "...", "jan": "-", ..., "dec": "-" }, ... ],
  "scheduledPaymentHistory": [ { ... }, { ... }, { ... } ],
  "actualPaymentHistory": [ { ... }, { ... }, { ... } ],
  "creditLimitHistory": [ { ... }, { ... }, { ... } ],
  "amountPastDueHistory": [ { ... }, { ... }, { ... } ],
  "activityDesignatorHistory": [ { ... }, { ... }, { ... } ],
  "paymentHistory": ["-", "...", ...],
  "paymentStatusCodes": {
    "30": "...",
    "60": "...",
    "90": "...",
    "120": "...",
    "150": "...",
    "180": "...",
    "OK": "...",
    "COL": "...",
    "C": "...",
    "CO": "...",
    "R": "...",
    "F": "...",
    "V": "...",
    "B": "...",
    "TNT": "...",
    "X": "..."
  },
  "creditLimit": "string",
  "highestBalance": "string",
  "highCredit": "string",
  "paymentStatus": "string",
  "dateOpened": "string",
  "dateReported": "string",
  "dateClosed": "string",
  "lastPaymentDate": "string",
  "dateOfLastActivity": "string",
  "dateOfFirstDelinquency": "string",
  "delinquencyFirstReported": "string",
  "deferredPaymentStartDate": "string",
  "balloonPaymentDate": "string",
  "currentBalance": "string",
  "paymentAmount": "string",
  "actualPaymentAmount": "string",
  "scheduledPaymentAmount": "string",
  "amountPastDue": "string",
  "chargeOffAmount": "string",
  "balloonPaymentAmount": "string",
  "creditType": "string",
  "loanType": "string",
  "responsibility": "string",
  "paymentResponsibility": "string",
  "termsFrequency": "string",
  "termDuration": "string",
  "monthsReviewed": "string",
  "activityDesignator": "string",
  "creditorClassification": "string",
  "accountStatus": "string",
  "comments": ["string"],
  "totalAccounts": 0,
  "openAccounts": 0,
  "closedAccounts": 0
}

Credit report excerpt:
<<<EXCERPT_START>>>
{{SNIPPET}}
<<<EXCERPT_END>>>`
      }
    ]
  }
];

const accountExtractionPrompt = (
  snippet: string,
  accountName: string,
  accountNumber: string | undefined,
  customTemplate?: any[]
) => {
  const template = customTemplate || EXTRACTION_PROMPT_TEMPLATE;
  const messages = JSON.parse(JSON.stringify(template));

  const lastMsg = messages[messages.length - 1];
  if (lastMsg.content && Array.isArray(lastMsg.content)) {
    for (const item of lastMsg.content) {
      if (item.type === 'text') {
        item.text = item.text
          .replace('{{ACCOUNT_NAME}}', accountName)
          .replace('{{ACCOUNT_NUMBER}}', accountNumber ?? "Not reported")
          .replace('{{SNIPPET}}', snippet);
      }
    }
  } else if (lastMsg.content && typeof lastMsg.content === 'string') {
    lastMsg.content = lastMsg.content
      .replace('{{ACCOUNT_NAME}}', accountName)
      .replace('{{ACCOUNT_NUMBER}}', accountNumber ?? "Not reported")
      .replace('{{SNIPPET}}', snippet);
  }

  return messages;
};

const escapeForRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const findAnchorIndex = (text: string, anchor?: string, fallback?: string): number => {
  if (anchor) {
    const pattern = new RegExp(escapeForRegex(anchor).replace(/\s+/g, "\\s+"), "i");
    const match = pattern.exec(text);
    if (match) return match.index;
  }

  if (fallback) {
    const fallbackPattern = new RegExp(escapeForRegex(fallback).replace(/\s+/g, "\\s+"), "i");
    const fallbackMatch = fallbackPattern.exec(text);
    if (fallbackMatch) return fallbackMatch.index;
  }

  return 0;
};

const buildSnippet = (text: string, index: number): string => {
  const start = Math.max(0, index - SNIPPET_PADDING);
  const end = Math.min(text.length, index + MAX_SNIPPET_LENGTH);
  return text.slice(start, end);
};

const detectAccounts = async (text: string, logs: AccountExtractionLog[], customTemplate?: any[]): Promise<AccountDetection[]> => {
  logs.push({ stage: "detect:start", timestamp: Date.now() });

  try {
    const content = await callOpenAI(detectionPrompt(text, customTemplate));
    const parsed = extractJsonFromResponse(content);
    const accounts: AccountDetection[] = Array.isArray(parsed?.accounts) ? parsed.accounts : [];
    logs.push({
      stage: "detect:success",
      timestamp: Date.now(),
      details: { count: accounts.length }
    });
    return accounts.slice(0, ACCOUNT_RESULT_LIMIT);
  } catch (error) {
    logs.push({
      stage: "detect:error",
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
};

const extractSingleAccount = async (
  detection: AccountDetection,
  rawText: string,
  logs: AccountExtractionLog[],
  customTemplate?: any[]
): Promise<Account> => {
  const accountLogs: AccountExtractionLog[] = [];
  const { accountName, accountNumber } = detection;

  const anchorIndex = findAnchorIndex(rawText, detection.anchorText, accountName);
  const snippet = buildSnippet(rawText, anchorIndex);
  const debugPages = createDebugPages(snippet);
  const pdfDocument = getCurrentPdfDocument();
  const totalPages = pdfDocument?.numPages ?? 0;
  const pageNumbers = totalPages > 0 ? derivePageNumbersForAnchor(anchorIndex, totalPages) : [];
  const debugPageImages = await buildDebugPageImages(pageNumbers);

  accountLogs.push({
    stage: "account:start",
    timestamp: Date.now(),
    details: { accountName, accountNumber, anchorIndex }
  });

  try {
    const templateBase = createDefaultAccount({
      accountName,
      accountNumber: accountNumber ?? "Not reported"
    });

    const response = await callOpenAI(accountExtractionPrompt(snippet, accountName, accountNumber, customTemplate), {
      max_tokens: 2500
    });

    const parsed = extractJsonFromResponse(response);
    const merged = mergeAccountWithDefaults(
      {
        ...parsed,
        debugPages,
        debugPageImages,
        debugSnippet: snippet
      },
      templateBase
    );

    accountLogs.push({
      stage: "account:success",
      timestamp: Date.now(),
      details: { accountName }
    });

    logs.push(...accountLogs);
    return merged;
  } catch (error) {
    accountLogs.push({
      stage: "account:error",
      timestamp: Date.now(),
      details: { accountName },
      error: error instanceof Error ? error.message : String(error)
    });
    logs.push(...accountLogs);
    return createDefaultAccount({
      accountName,
      accountNumber: accountNumber ?? "Not reported",
      comments: ["Failed to extract account data automatically"],
      debugPages,
      debugPageImages,
      debugSnippet: snippet
    });
  }
};

export const extractAccountsFromReport = async (
  report: CreditReport,
  detectionPromptTemplate?: string,
  extractionPromptTemplate?: string
): Promise<{ accounts: Account[]; logs: AccountExtractionLog[] }> => {
  const { rawText } = report;
  const logs: AccountExtractionLog[] = [];

  if (CLIENT_SIDE_ACCOUNT_EXTRACTION_DISABLED) {
    const fallbackAccounts =
      report.accounts && report.accounts.length > 0 ? report.accounts : [createDefaultAccount()];
    logs.push({
      stage: "extract:disabled",
      timestamp: Date.now(),
      details: { reason: CLIENT_SIDE_ACCOUNT_EXTRACTION_DISABLED_REASON }
    });
    return { accounts: fallbackAccounts, logs };
  }

  let parsedDetectionTemplate;
  let parsedExtractionTemplate;

  try {
    if (detectionPromptTemplate) parsedDetectionTemplate = JSON.parse(detectionPromptTemplate);
    if (extractionPromptTemplate) parsedExtractionTemplate = JSON.parse(extractionPromptTemplate);
  } catch (e) {
    devDiagnostics.error("Failed to parse prompt templates", e);
    logs.push({
      stage: "extract:config_error",
      timestamp: Date.now(),
      error: "Invalid JSON in prompt template"
    });
  }

  if (!rawText || rawText.length < 500) {
    return {
      accounts: report.accounts ?? [],
      logs: [
        {
          stage: "extract:skipped",
          timestamp: Date.now(),
          details: { reason: "Missing or insufficient raw text" }
        }
      ]
    };
  }

  try {
    const detections = await detectAccounts(rawText, logs, parsedDetectionTemplate);

    if (!detections || detections.length === 0) {
      logs.push({
        stage: "extract:none-detected",
        timestamp: Date.now()
      });
      return {
        accounts: report.accounts ?? [],
        logs
      };
    }

    const results: Account[] = [];

    for (const detection of detections) {
      const account = await extractSingleAccount(detection, rawText, logs, parsedExtractionTemplate);
      results.push(account);
    }

    logs.push({
      stage: "extract:complete",
      timestamp: Date.now(),
      details: { count: results.length }
    });

    return { accounts: results, logs };
  } catch (error) {
    logs.push({
      stage: "extract:failed",
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : String(error)
    });

    if (report.accounts && report.accounts.length > 0) {
      return { accounts: report.accounts, logs };
    }

    return {
      accounts: [createDefaultAccount()],
      logs
    };
  }
};
