import type { CreditReport } from "@/lib/types/creditReport";

export type DisputeSeverity = "high" | "medium" | "low";
export type DisputeReasonCategory =
  | "account_identity"
  | "payment_history"
  | "balance_amount"
  | "charge_off_collection"
  | "legal_public_record"
  | "date_reporting_timeline"
  | "personal_information"
  | "tradeline_integrity"
  | "attorney_escalation"
  | "report_review";

export type DisputeSelectionBasis =
  | "negative_account"
  | "positive_account"
  | "non_account_default"
  | "attorney_escalation"
  | "explicit";

export type AccountPosture = "negative" | "positive";
export type DisputeRuleStatus = "triggered" | "not_triggered" | "insufficient_evidence" | "not_applicable";

export type DisputeEntityType =
  | "account"
  | "personal_information"
  | "public_record"
  | "consumer_information_indicator"
  | "inquiry"
  | "summary"
  | "report";

export interface DisputeReasonScalarEvidence {
  label: string;
  value: string;
}

export interface DisputeReasonMonthlyEvidence {
  month: string;
  leftLabel: string;
  leftValue: string;
  rightLabel: string;
  rightValue: string;
}

export type DisputeEvidenceRefKind =
  | "field"
  | "history_cell"
  | "history_gap"
  | "history_latest"
  | "history_max";

export interface DisputeReasonEvidenceRef {
  refId: string;
  kind: DisputeEvidenceRefKind;
  fieldName: string;
  label: string;
  slideId: string;
  slideLabel: string;
  year?: string;
  month?: string;
  expectedValue?: string;
}

export interface DisputeReasonEvidence {
  comparedFields?: string[];
  scalarComparisons?: DisputeReasonScalarEvidence[];
  monthlyComparisons?: DisputeReasonMonthlyEvidence[];
}

export interface AccountFact {
  displayName: string;
  accountTypeText: string;
  accountCategoryText: string;
  accountNumber: string;
  entityKey: string;
  sourcePages: number[];
  statusText: string;
  responsibilityText: string;
  addressText: string;
  phoneText: string;
  comments: string[];
  paymentHistory: string[];
  paymentHistoryYears: string[];
  balanceHistoryValues: string[];
  amountPastDueHistoryValues: string[];
  creditLimitHistoryValues: string[];
  balanceValue: string;
  originalBalanceValue: string;
  amountPastDueValue: string;
  chargeOffAmountValue: string;
  creditLimitValue: string;
  highestBalanceValue: string;
  originalCreditorText: string;
  paymentAmountValue: string;
  scheduledPaymentAmountValue: string;
  recentPaymentValue: string;
  lastPaymentDateValue: string;
  dateOfFirstDelinquencyValue: string;
  dateOpenedValue: string;
  dateReportedValue: string;
  dateClosedValue: string;
  closureTimingValue: string;
  closureMonthKey: string;
  closureMonthPaymentStatus: string;
  closureMonthActualPaymentValue: string;
  closureMonthHasTableActivity: boolean;
  lastPaymentSignalValue: string;
  lastPaymentSignalKind: string;
  statusUpdatedValue: string;
  balanceUpdatedValue: string;
  estimatedRemovalValue: string;
  termsFrequencyValue: string;
  termDurationValue: string;
  monthsReviewedValue: string;
  isClosed: boolean;
}

export interface DisputeReason {
  id: string;
  bureau: CreditReport["bureau"];
  profileId?: string;
  component: string;
  entityType: DisputeEntityType;
  entityKey: string;
  issueType: string;
  issueLabel: string;
  reasonSummary: string;
  supportingFacts: string[];
  supportingFields: string[];
  sourcePages: number[];
  requestedAction: string;
  severity: DisputeSeverity;
  category?: DisputeReasonCategory;
  defaultSelected?: boolean;
  selectionBasis?: DisputeSelectionBasis;
  selected: boolean;
  isAttorneyEscalation?: boolean;
  evidence?: DisputeReasonEvidence;
  evidenceRefs?: DisputeReasonEvidenceRef[];
  operatorNotes?: string;
}

export interface DisputeRuleEvaluation {
  key: string;
  ruleId: string;
  issueType: string;
  issueLabel: string;
  category: DisputeReasonCategory;
  status: DisputeRuleStatus;
  selectable: boolean;
  selected: boolean;
  defaultSelected: boolean;
  selectionBasis?: DisputeSelectionBasis;
  explanation: string;
  severity?: DisputeSeverity;
  supportingFacts: string[];
  supportingFields: string[];
  evidence?: DisputeReasonEvidence;
  evidenceRefs?: DisputeReasonEvidenceRef[];
  sourcePages: number[];
  requestedAction?: string;
  operatorNotes?: string;
}

export interface ManualAccountReason {
  id: string;
  entityKey: string;
  category: DisputeReasonCategory;
  issueLabel: string;
  reasonSummary: string;
  sourcePages: number[];
  operatorNotes?: string;
  selected: boolean;
}

export interface AccountRuleCategoryGroup {
  category: DisputeReasonCategory;
  label: string;
  entries: DisputeRuleEvaluation[];
}

export interface AccountRuleCatalogGroup {
  key: string;
  label: string;
  entityKey: string;
  entityType: "account";
  accountPosture: AccountPosture;
  categories: AccountRuleCategoryGroup[];
}

export interface ReasonGroup {
  key: string;
  label: string;
  reasons: DisputeReason[];
  entityType: DisputeEntityType;
  entityKey: string;
  accountPosture?: AccountPosture;
}

export interface DisputeLetterIntake {
  fullLegalName: string;
  dateOfBirth: string;
  socialSecurityNumber: string;
  mailingAddressLine1: string;
  mailingAddressLine2?: string;
  mailingCity: string;
  mailingState: string;
  mailingZip: string;
  reportNumber: string;
  reportDate: string;
  letterDate: string;
  certifiedMailTrackingNumber: string;
  responsePreference: "mail_only" | "mail_and_email";
  bureauRecipientName: string;
  bureauAddressLine1: string;
  bureauAddressLine2?: string;
  bureauCity: string;
  bureauState: string;
  bureauZip: string;
  enclosures: string[];
}

export interface DisputeLetterSection {
  id: string;
  key: string;
  label: string;
  title?: string;
  html: string;
  enabled: boolean;
  order: number;
  entityKey?: string;
  reasonIds?: string[];
}

export interface DisputeExhibitManifestSlide {
  file: string;
  pageNumber: number;
  label?: string | null;
  widthPx?: number;
  heightPx?: number;
}

export interface DisputeExhibitManifestEntry {
  exhibit: string;
  reasonId: string;
  issueType?: string;
  issueLabel?: string | null;
  entityKey?: string | null;
  sourcePages?: number[];
  slides: DisputeExhibitManifestSlide[];
}

export interface DisputeExhibitsManifest {
  numberingStyle: "numeric" | "alpha";
  exhibitCount: number;
  exhibits: DisputeExhibitManifestEntry[];
  warnings?: string[];
}

export interface DisputeEvidenceOptions {
  inlineExhibits: boolean;
  memorandum: boolean;
  highlightedReport: boolean;
}

export interface DisputeLetterRenderState {
  previewHtml: string;
  docxPath?: string | null;
  docxUrl?: string | null;
  pdfPath?: string | null;
  pdfUrl?: string | null;
  highlightedReportPdfPath?: string | null;
  highlightedReportPdfUrl?: string | null;
  memorandumDocxPath?: string | null;
  memorandumDocxUrl?: string | null;
  memorandumPdfPath?: string | null;
  memorandumPdfUrl?: string | null;
  draftDirty: boolean;
  documentOverride: boolean;
  evidenceGeneratedAt?: string | null;
  lastGeneratedFromSectionsAt?: string | null;
  lastFullDocumentEditAt?: string | null;
}

export interface DisputeEvidenceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DisputeEvidencePdfBox {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface DisputeEvidenceHighlight extends DisputeEvidenceBox {
  label: string;
  confidence: number;
  source?: "layout" | "inferred_gap" | "pdf" | "ocr" | string;
  kind?: "evidence" | "history" | "history_gap" | "account_field" | "timeline" | "field" | "summary" | "identity" | string;
  pdfBox?: DisputeEvidencePdfBox;
  provenanceId?: string;
}

export interface DisputeEvidenceSlide {
  id: string;
  pageNumber: number;
  label: string;
  confidence: number;
  pageImageWidth: number;
  pageImageHeight: number;
  cropBox: DisputeEvidenceBox;
  highlightBoxes: DisputeEvidenceHighlight[];
  matchedText?: string;
}

export interface DisputeReasonEvidenceBundle {
  reasonId: string;
  issueLabel: string;
  reasonSummary: string;
  entityKey: string;
  sourcePages: number[];
  status: "ready" | "unresolved";
  requiresCanonicalProvenance: boolean;
  exportGrade: boolean;
  resolutionMode: "canonical" | "quality" | "legacy";
  slides: DisputeEvidenceSlide[];
  blockedByValidation?: boolean;
  validationVerdict?: "pass" | "review" | "fail" | string;
  validationConfidence?: number;
  validationProblems?: string[];
  retryCount?: number;
  retryMode?: string | null;
}

export interface DisputeEvidenceManifest {
  generatedAt: string;
  sessionId: string;
  reasonCount: number;
  pageCount: number;
  unresolvedReasonIds: string[];
  blockingUnresolvedReasonIds?: string[];
  exportableReasonIds?: string[];
  reasons: DisputeReasonEvidenceBundle[];
}

export interface DisputeLetterDraftMetadata {
  bureau: CreditReport["bureau"];
  profileId?: string;
  reportId: string;
  reportNumber: string;
  reportDate: string;
  letterDate: string;
  certifiedMailTrackingNumber: string;
  responsePreference: string;
  enclosureSelections: string[];
}

export interface DisputeLetterIdentity {
  fullLegalName: string;
  dateOfBirth: string;
  socialSecurityNumber: string;
  mailingAddress: string[];
}

export interface DisputeLetterRecipient {
  bureauName: string;
  mailingBlock: string[];
}

export interface DisputeLetterSections {
  senderBlock: DisputeLetterSection;
  dateBlock: DisputeLetterSection;
  recipientBlock: DisputeLetterSection;
  reportMetadataBlock: DisputeLetterSection;
  openingRequest: DisputeLetterSection;
  reinvestigationRequest: DisputeLetterSection;
  accountDisputes: DisputeLetterSection[];
  personalInformationDisputes: DisputeLetterSection[];
  recordsRequest: DisputeLetterSection;
  responseInstructions: DisputeLetterSection;
  closing: DisputeLetterSection;
  enclosures: DisputeLetterSection;
}

export interface DisputeLetterDraft {
  id: string;
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  metadata: DisputeLetterDraftMetadata;
  identity: DisputeLetterIdentity;
  recipient: DisputeLetterRecipient;
  sections: DisputeLetterSections;
  reasonRefs: string[];
  selectedReasons: DisputeReason[];
  variantSelection: Record<string, number>;
  renderState: DisputeLetterRenderState;
  evidenceManifest?: DisputeEvidenceManifest | null;
  evidenceOptions?: DisputeEvidenceOptions | null;
  exhibitsManifest?: DisputeExhibitsManifest | null;
  letterMode?: "inline" | "memorandum" | null;
  exhibitNumbering?: "numeric" | "alpha" | null;
  fullDocumentHtml: string;
  reportSummary: {
    fileName?: string;
    consumerName?: string | null;
  };
}

export interface CreateDisputeLetterDraftRequest {
  sessionId: string;
  report: CreditReport;
  intake: DisputeLetterIntake;
  reasons: DisputeReason[];
  requestKey?: string;
  hydrateEvidence?: boolean;
}

export interface UpdateDisputeLetterSectionRequest {
  group: keyof DisputeLetterSections;
  sectionId: string;
  patch: Partial<Pick<DisputeLetterSection, "html" | "title" | "enabled" | "order" | "label">>;
}

export interface UpdateDisputeLetterFullDocumentRequest {
  html: string;
}
