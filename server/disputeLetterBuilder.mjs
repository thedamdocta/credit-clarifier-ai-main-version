import path from "node:path";
import { createHash } from "node:crypto";
import { DISPUTE_LETTER_LAYOUT, buildDisputeLetterPreviewCss, buildDisputeLetterPreviewPaginationScript } from "../shared/disputeLetterLayout.mjs";

const normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const normalizeMatchText = (value) => normalizeText(value).toLowerCase();
const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const ensureSentence = (value) => {
  const text = normalizeText(value);
  if (!text) return "";
  return /[.!?]$/.test(text) ? text : `${text}.`;
};

const toSentenceCaseStart = (value) => {
  const text = normalizeText(value);
  if (!text) return "";
  return text.charAt(0).toLowerCase() + text.slice(1);
};

const formatHumanDate = (value) => {
  const text = normalizeText(value);
  if (!text) return "";

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const [, year, month, day] = iso;
    return `${MONTH_NAMES[Number(month) - 1]} ${Number(day)}, ${year}`;
  }

  const slash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash) {
    let [, month, day, year] = slash;
    if (year.length === 2) {
      year = `${Number(year) >= 70 ? "19" : "20"}${year}`;
    }
    return `${MONTH_NAMES[Number(month) - 1]} ${Number(day)}, ${year}`;
  }

  const parsed = Date.parse(text);
  if (!Number.isNaN(parsed)) {
    const date = new Date(parsed);
    return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  }

  return text;
};

const buildLineBreakMarkup = (lines) => {
  return lines
    .map((line) => (line === "" ? "" : escapeHtml(line)))
    .join("<br/>");
};

const blockParagraph = (lines, className = "") => {
  const classAttribute = normalizeText(className) ? ` class="${escapeHtml(className)}"` : "";
  return `<p${classAttribute}>${buildLineBreakMarkup(lines)}</p>`;
};
const nonEmptyLines = (lines) => lines.map((line) => normalizeText(line)).filter(Boolean);

const clauseLibrary = {
  openingRequest: [
    ({ bureau }) => `<p>I am formally requesting a complete file disclosure as required under the Fair Credit Reporting Act, and I ask that you ensure only accurate, complete, verifiable, timely, and properly attributable information is reported about me in my ${escapeHtml(bureau)} file.</p>`,
    ({ bureau }) => `<p>I am requesting a complete file disclosure under the Fair Credit Reporting Act and ask that you ensure the information appearing in my ${escapeHtml(bureau)} file is accurate, complete, verifiable, timely, and properly attributable to me.</p>`,
  ],
  reinvestigationRequest: [
    ({ bureau, certifiedMailTrackingNumber }) => {
      const certifiedMail = certifiedMailTrackingNumber
        ? ` I am submitting this correspondence by certified mail tracking number ${escapeHtml(certifiedMailTrackingNumber)}.`
        : "";
      return `<p>I recently accessed my ${escapeHtml(bureau)} credit report and identified items that I dispute as inaccurate, incomplete, or otherwise not fully verifiable. I request that you and any furnisher involved conduct a full and thorough reinvestigation of each disputed item below, review each associated data field, and correct or delete any information that cannot be verified as complete and accurate. I have enclosed identifying documents and marked copies of the relevant report pages for reference.${certifiedMail} Please do not reject this dispute, and if your review reveals any additional unverifiable, inaccurate, or incomplete information, please correct it or delete it from my file.</p>`;
    },
    ({ bureau, certifiedMailTrackingNumber }) => {
      const certifiedMail = certifiedMailTrackingNumber
        ? ` This dispute is being sent by certified mail tracking number ${escapeHtml(certifiedMailTrackingNumber)}.`
        : "";
      return `<p>After accessing my ${escapeHtml(bureau)} credit report, I identified information that I dispute as inaccurate, incomplete, or not reported with enough detail to be verified. I am requesting a full and thorough reinvestigation of each item listed below, a complete updated disclosure of my file, and correction or deletion of any information that cannot be verified as complete and accurate. I have enclosed identifying documents and marked copies of the report pages at issue for your review.${certifiedMail} Please do not reject this dispute for any reason.</p>`;
    },
  ],
  recordsRequest: [
    ({ seed }) => buildAlternatingIndentedListSection(
      `Once your investigation is complete, please send me:`,
      [
        `A written copy of the investigation results.`,
        `A complete copy of my credit file, including all information you maintain about me.`,
        `All hard and soft inquiries, including the reason for each and the certification provided by each entity that accessed my report.`,
        `The name, address, and telephone number of each furnisher or source contacted during your reinvestigation.`,
        `A description of the procedures used to determine the accuracy and completeness of the disputed information.`,
      ],
      seed,
      "records-request-a",
    ),
    ({ seed }) => buildAlternatingIndentedListSection(
      `Please provide the following once your investigation is complete:`,
      [
        `A written copy of the investigation results.`,
        `A complete copy of my credit file, including all information you maintain about me.`,
        `All hard and soft inquiries, including the reason for each inquiry and the certification provided by each party that accessed my report.`,
        `The name, address, and telephone number of each furnisher or source you contacted regarding these disputes.`,
        `A description of the procedures you used to determine the accuracy and completeness of the disputed information.`,
      ],
      seed,
      "records-request-b",
    ),
  ],
  responseInstructions: [
    ({ responsePreference }) => {
      const mailSentence = responsePreference === "mail_and_email"
        ? `Please provide your written response by mail and, if available, any matching electronic notice through the contact information I provide separately.`
        : `Please provide all responses by mail only. Do not email my results.`;
      return `<p>${mailSentence}</p>`;
    },
  ],
  closing: [
    ({ fullLegalName }) => `<p>Thank you in advance for your cooperation. I expect full compliance in accordance with the Fair Credit Reporting Act and related consumer-protection law.</p><p>Sincerely,</p><p>${escapeHtml(fullLegalName)}</p>`,
    ({ fullLegalName }) => `<p>Thank you for your prompt attention to this matter. I expect a full and lawful reinvestigation of the disputed information identified above.</p><p>Sincerely,</p><p>${escapeHtml(fullLegalName)}</p>`,
  ],
};

const reasonBodyLibrary = [
  ({ summary, requestedAction, exampleSentence }) => `${escapeHtml(ensureSentence(summary))}${exampleSentence}${requestedAction}`,
  ({ summary, requestedAction, exampleSentence }) => `I dispute this reporting because ${escapeHtml(ensureSentence(toSentenceCaseStart(summary)))}${exampleSentence}${requestedAction}`,
  ({ summary, requestedAction, exampleSentence }) => `This tradeline appears inaccurate or incomplete because ${escapeHtml(ensureSentence(toSentenceCaseStart(summary)))}${exampleSentence}${requestedAction}`,
];

const LIST_MARKERS = ["-", "•"];

const chooseVariantIndex = (seed, key, size) => {
  const hash = createHash("sha1").update(`${seed}:${key}`).digest("hex");
  const value = Number.parseInt(hash.slice(0, 8), 16);
  return value % size;
};

const bureauReportId = (report) => report.confirmationNumber ?? report.reportId ?? report.fileName ?? report.bureau ?? "report";
const combineCityStateZip = (city, state, zip) => {
  const parts = [];
  if (normalizeText(city)) parts.push(normalizeText(city));
  const stateZip = [normalizeText(state), normalizeText(zip)].filter(Boolean).join(" ");
  if (stateZip) parts.push(stateZip);
  return parts.join(", ");
};

const accountDisplayName = (account) =>
  normalizeText(account?.accountName ?? account?.header?.accountName ?? account?.accountInfo?.accountName);
const accountDisplayNumber = (account) =>
  normalizeText(account?.accountNumber ?? account?.header?.accountNumber ?? account?.accountInfo?.accountNumber);
const accountKey = (account) => `${normalizeMatchText(accountDisplayName(account))}::${accountDisplayNumber(account)}`;
const accountLookup = (report) => {
  const lookup = new Map();
  for (const account of report.accounts ?? []) {
    lookup.set(accountKey(account), account);
  }
  return lookup;
};

const buildRecipientBlock = (intake) => nonEmptyLines([
  intake.bureauRecipientName,
  intake.bureauAddressLine1,
  intake.bureauAddressLine2,
  combineCityStateZip(intake.bureauCity, intake.bureauState, intake.bureauZip),
]);

const buildSenderBlock = (intake) => nonEmptyLines([
  intake.fullLegalName,
  intake.mailingAddressLine1,
  intake.mailingAddressLine2,
  combineCityStateZip(intake.mailingCity, intake.mailingState, intake.mailingZip),
]);

const buildSenderBlockHtml = (intake) => {
  const senderLines = buildSenderBlock(intake);
  return senderLines.length ? blockParagraph(senderLines, "letter-block sender-block") : "";
};

const buildDateBlockHtml = (intake) => {
  const letterDate = formatHumanDate(intake.letterDate);
  return letterDate ? blockParagraph([letterDate], "letter-block date-block") : "";
};

const buildRecipientBlockHtml = (intake) => {
  const recipientLines = buildRecipientBlock(intake);
  return recipientLines.length ? blockParagraph(recipientLines, "letter-block recipient-block") : "";
};

const buildReportMetadataBlockHtml = (intake) => {
  const reportLines = nonEmptyLines([
    intake.reportNumber ? `Report #: ${intake.reportNumber}` : "",
    intake.reportDate ? `Generated on: ${formatHumanDate(intake.reportDate)}` : "",
  ]);
  return reportLines.length ? blockParagraph(reportLines, "letter-block report-metadata-block") : "";
};

const buildReasonExampleSentence = (reason) => {
  const examples = (reason.supportingFacts ?? [])
    .map((fact) => ensureSentence(fact))
    .filter(Boolean)
    .slice(0, 2);
  if (!examples.length) return "";
  if (examples.length === 1) {
    return ` For example, ${escapeHtml(examples[0])}`;
  }
  return ` For example, ${escapeHtml(examples[0])} In addition, ${escapeHtml(examples[1])}`;
};

const buildReasonBodyText = (reason, seed) => {
  const variant = reasonBodyLibrary[chooseVariantIndex(seed, `reason:${reason.id}`, reasonBodyLibrary.length)];
  const requestedAction = ensureSentence(reason.requestedAction);
  const exampleSentence = buildReasonExampleSentence(reason);
  return variant({
    summary: reason.reasonSummary,
    requestedAction: requestedAction ? ` ${escapeHtml(requestedAction)}` : "",
    exampleSentence,
  });
};

const buildReasonBody = (reason, seed, heading = "") => {
  const body = buildReasonBodyText(reason, seed);
  const headingMarkup = normalizeText(heading)
    ? `<strong>${escapeHtml(heading)}</strong><br/><br/>`
    : "";
  return `<p>${headingMarkup}${body}</p>`;
};

const buildAlternatingIndentedListSection = (intro, items, seed, key) => {
  const startIndex = chooseVariantIndex(seed, key, LIST_MARKERS.length);
  const listMarkup = items
    .map((item, index) => {
      const marker = LIST_MARKERS[(startIndex + index) % LIST_MARKERS.length];
      const markerClass = marker === "-" ? "list-item-dash" : "list-item-dot";
      return `<p class="list-item ${markerClass}">${escapeHtml(marker)} ${escapeHtml(item)}</p>`;
    })
    .join("");

  return `<p>${escapeHtml(intro)}</p>${listMarkup}`;
};

const createSection = ({ id, key, label, title, html, enabled = true, order = 0, entityKey, reasonIds = [] }) => ({
  id,
  key,
  label,
  title,
  html,
  enabled,
  order,
  entityKey,
  reasonIds,
});

const groupReasonsByEntity = (reasons, entityTypes) => {
  const wanted = new Set(Array.isArray(entityTypes) ? entityTypes : [entityTypes]);
  const groups = new Map();
  for (const reason of reasons.filter((entry) => entry.selected && wanted.has(entry.entityType))) {
    const existing = groups.get(reason.entityKey) ?? [];
    existing.push(reason);
    groups.set(reason.entityKey, existing);
  }
  return groups;
};

const formatConsumerIndicatorHeading = (entityKey) => {
  // entityKey shape: consumer_information_indicator::::<descriptor>::<n> —
  // mirror dispute_memorandum_generator.format_entity so letter and
  // memorandum print the same human heading (never raw '::' tokens).
  // Trailing whitespace/em-dashes are stripped to stay in lockstep with the
  // memo's rstrip (panel F2); a digit-only token is the enumeration index,
  // not a descriptor, and must not print in a mailed heading (panel F3).
  const parts = String(entityKey || "").split("::").filter(Boolean);
  const raw = (parts[1] ?? "").replace(/[\s—]+$/u, "").trim();
  const descriptor = /^\d+$/.test(raw) ? "" : raw;
  return descriptor ? `Consumer Information Indicator — ${descriptor}` : "Consumer Information Indicator";
};

const buildAccountDisputeSections = (report, reasons, seed) => {
  const lookup = accountLookup(report);
  const groups = groupReasonsByEntity(reasons, "account");
  let order = 0;
  return [...groups.entries()].map(([entityKey, groupedReasons]) => {
    const account = lookup.get(entityKey);
    const heading = buildAccountHeading(account, groupedReasons[0].issueLabel || "Disputed Tradeline");
    const html = [
      ...groupedReasons.map((reason, index) => buildReasonBody(reason, seed, index === 0 ? heading : "")),
    ].join("");
    order += 1;
    return createSection({
      id: `account-dispute-${order}`,
      key: "accountDispute",
      label: heading,
      title: heading,
      html,
      enabled: true,
      order,
      entityKey,
      reasonIds: groupedReasons.map((reason) => reason.id),
    });
  });
};

const buildPersonalInformationSections = (reasons, seed) => {
  // consumer_information_indicator disputes (e.g. bankruptcy-flag conflicts,
  // category legal_public_record) previously had NO letter section at all —
  // they reached the memorandum and report chips but the mailed letter never
  // stated them (Session-23 Exhibit-28 finding; operator ruled: include them).
  const groups = groupReasonsByEntity(reasons, ["personal_information", "consumer_information_indicator"]);
  let order = 0;
  return [...groups.entries()].map(([entityKey, groupedReasons]) => {
    order += 1;
    const isIndicator = groupedReasons[0].entityType === "consumer_information_indicator";
    const heading = isIndicator ? formatConsumerIndicatorHeading(entityKey) : "";
    return createSection({
      id: `personal-dispute-${order}`,
      key: "personalInformationDispute",
      label: groupedReasons[0].issueLabel,
      title: groupedReasons[0].issueLabel,
      html: groupedReasons.map((reason, index) => buildReasonBody(reason, seed, index === 0 ? heading : "")).join(""),
      enabled: true,
      order,
      entityKey,
      reasonIds: groupedReasons.map((reason) => reason.id),
    });
  });
};

const buildAccountHeading = (account, fallbackTitle) => {
  if (!account) {
    return fallbackTitle;
  }

  const primary = [accountDisplayName(account), accountDisplayNumber(account)].filter(Boolean).join(" - ");
  const balance = normalizeText(
    account?.balance
      ?? account?.currentBalance
      ?? account?.accountInfo?.balance
  );
  const dateOpened = normalizeText(account?.dateOpened ?? account?.openDate ?? account?.accountInfo?.dateOpened);
  const originalCreditor = normalizeText(account?.originalCreditorName ?? account?.accountInfo?.originalCreditor);

  const details = [];
  if (balance) details.push(`Balance: ${balance}`);
  if (dateOpened) details.push(`Date Opened: ${dateOpened}`);
  if (!dateOpened && originalCreditor) details.push(`Original Creditor: ${originalCreditor}`);

  return [primary || fallbackTitle, ...details].join(", ");
};

const buildPersonalInformationReferenceHtml = (draft) => {
  if (!draft.sections.personalInformationDisputes.some((section) => section.enabled)) {
    return "";
  }

  const identityLines = [];
  if (normalizeText(draft.identity.fullLegalName)) identityLines.push(`My Name: ${draft.identity.fullLegalName}`);
  if (normalizeText(draft.identity.dateOfBirth)) identityLines.push(`My Date of Birth: ${draft.identity.dateOfBirth}`);
  if (normalizeText(draft.identity.socialSecurityNumber)) identityLines.push(`My Social Security Number: ${draft.identity.socialSecurityNumber}`);
  if (draft.identity.mailingAddress?.length) identityLines.push(`My Current Address: ${draft.identity.mailingAddress.join(", ")}`);

  if (!identityLines.length) {
    return "";
  }

  return [
    `<p>In addition, I request that you correct and standardize my personal identification information. There should be no inaccurate, incomplete, or outdated personal identifiers associated with my file. The only correct personal information that should remain associated with my file is as follows:</p>`,
    blockParagraph(identityLines),
  ].join("");
};

const buildSenderBlockFromDraft = (draft) => nonEmptyLines([
  draft.identity?.fullLegalName,
  ...(Array.isArray(draft.identity?.mailingAddress) ? draft.identity.mailingAddress : []),
]);

const buildRecipientBlockFromDraft = (draft) => nonEmptyLines([
  draft.recipient?.bureauName,
  ...(Array.isArray(draft.recipient?.mailingBlock) ? draft.recipient.mailingBlock : []),
]);

const buildDateBlockHtmlFromDraft = (draft) => {
  const letterDate = formatHumanDate(draft.metadata?.letterDate);
  return letterDate ? blockParagraph([letterDate], "letter-block date-block") : "";
};

const buildReportMetadataBlockHtmlFromDraft = (draft) => {
  const reportLines = nonEmptyLines([
    draft.metadata?.reportNumber ? `Report #: ${draft.metadata.reportNumber}` : "",
    draft.metadata?.reportDate ? `Generated on: ${formatHumanDate(draft.metadata.reportDate)}` : "",
  ]);
  return reportLines.length ? blockParagraph(reportLines, "letter-block report-metadata-block") : "";
};

export const normalizeDraftStructure = (draft) => {
  const renderState = draft?.renderState ?? {};
  const sections = draft?.sections ?? {};
  const needsHeaderNormalization = !sections.dateBlock || !sections.reportMetadataBlock;
  const needsEvidenceNormalization =
    !Array.isArray(draft?.selectedReasons) ||
    !Object.prototype.hasOwnProperty.call(renderState, "highlightedReportPdfPath") ||
    !Object.prototype.hasOwnProperty.call(renderState, "evidenceGeneratedAt") ||
    !Object.prototype.hasOwnProperty.call(draft ?? {}, "evidenceManifest") ||
    !Object.prototype.hasOwnProperty.call(draft ?? {}, "exhibitsManifest") ||
    !Object.prototype.hasOwnProperty.call(draft ?? {}, "letterMode");

  if (!needsHeaderNormalization && !needsEvidenceNormalization) {
    return draft;
  }

  const nextDraft = structuredClone(draft);
  nextDraft.selectedReasons = Array.isArray(nextDraft.selectedReasons) ? nextDraft.selectedReasons : [];
  nextDraft.evidenceManifest = nextDraft.evidenceManifest ?? null;
  nextDraft.exhibitsManifest = nextDraft.exhibitsManifest ?? null;
  nextDraft.letterMode = nextDraft.letterMode ?? null;
  nextDraft.exhibitNumbering = nextDraft.exhibitNumbering ?? null;
  nextDraft.renderState = {
    ...nextDraft.renderState,
    highlightedReportPdfPath: nextDraft.renderState?.highlightedReportPdfPath ?? null,
    highlightedReportPdfUrl: nextDraft.renderState?.highlightedReportPdfUrl ?? null,
    evidenceGeneratedAt: nextDraft.renderState?.evidenceGeneratedAt ?? null,
  };

  if (!needsHeaderNormalization) {
    return nextDraft;
  }

  const senderLines = buildSenderBlockFromDraft(nextDraft);
  const recipientLines = buildRecipientBlockFromDraft(nextDraft);

  nextDraft.sections.senderBlock = createSection({
    id: "sender-block",
    key: "senderBlock",
    label: "Sender",
    html: senderLines.length ? blockParagraph(senderLines, "letter-block sender-block") : "",
    enabled: nextDraft.sections.senderBlock?.enabled ?? true,
    order: 0,
  });
  nextDraft.sections.dateBlock = createSection({
    id: "date-block",
    key: "dateBlock",
    label: "Date",
    html: buildDateBlockHtmlFromDraft(nextDraft),
    enabled: nextDraft.sections.dateBlock?.enabled ?? true,
    order: 0,
  });
  nextDraft.sections.recipientBlock = createSection({
    id: "recipient-block",
    key: "recipientBlock",
    label: "Recipient",
    html: recipientLines.length ? blockParagraph(recipientLines, "letter-block recipient-block") : "",
    enabled: nextDraft.sections.recipientBlock?.enabled ?? true,
    order: 0,
  });
  nextDraft.sections.reportMetadataBlock = createSection({
    id: "report-metadata-block",
    key: "reportMetadataBlock",
    label: "Report Metadata",
    html: buildReportMetadataBlockHtmlFromDraft(nextDraft),
    enabled: nextDraft.sections.reportMetadataBlock?.enabled ?? true,
    order: 0,
  });

  return nextDraft;
};

const exhibitsForSection = (section, exhibitsManifest) => {
  const exhibits = exhibitsManifest?.exhibits;
  if (!section?.reasonIds?.length || !Array.isArray(exhibits) || !exhibits.length) {
    return [];
  }
  const wanted = new Set(section.reasonIds);
  return exhibits.filter((exhibit) => wanted.has(exhibit.reasonId));
};

const formatExhibitRefText = (exhibits) => {
  if (exhibits.length === 1) {
    return `(See Exhibit ${exhibits[0].exhibit})`;
  }
  return `(See Exhibits ${exhibits[0].exhibit}–${exhibits[exhibits.length - 1].exhibit})`;
};

const buildSectionExhibitFiguresHtml = (exhibits, draft) => {
  // Heading and each slide are emitted as SIBLING top-level nodes (no wrapping
  // div): the preview paginator treats each top-level node as one unbreakable
  // unit, so a wrapper around a multi-slide exhibit clipped tall stacks and
  // left pages mostly blank (Phase-3 QC FAIL). Per-slide divs let pages break
  // between slides while each image stays glued to its own caption.
  const parts = [];
  for (const exhibit of exhibits) {
    const slides = Array.isArray(exhibit.slides) ? exhibit.slides : [];
    if (!slides.length) {
      continue;
    }
    parts.push(
      `<p class="exhibit-heading"><strong>Exhibit ${escapeHtml(String(exhibit.exhibit))} — ${escapeHtml(exhibit.issueLabel || "Disputed item")}</strong></p>`
    );
    for (const slide of slides) {
      if (!slide?.file) {
        continue;
      }
      // Pre-scale to the DISPLAY size (CSS px @96dpi): content width bound +
      // the same 8in height cap DOCX/PDF use (scaled_image_size). Emitting
      // final dims lets the preview paginator measure exactly, pre-load.
      let dims = "";
      if (Number.isFinite(slide.widthPx) && Number.isFinite(slide.heightPx) && slide.widthPx > 0 && slide.heightPx > 0) {
        const contentWidthCssPx = (DISPUTE_LETTER_LAYOUT.pageWidthInches - 2 * DISPUTE_LETTER_LAYOUT.marginInches) * 96;
        const maxHeightCssPx = 8 * 96;
        let displayW = Math.min(contentWidthCssPx, (slide.widthPx * 96) / 300);
        let displayH = (slide.heightPx * displayW) / slide.widthPx;
        if (displayH > maxHeightCssPx) {
          displayW = (displayW * maxHeightCssPx) / displayH;
          displayH = maxHeightCssPx;
        }
        dims = ` width="${Math.max(1, Math.round(displayW))}" height="${Math.max(1, Math.round(displayH))}"`;
      }
      const src = draft?.id ? `/api/dispute-drafts/${draft.id}/artifacts/exhibits/${encodeURIComponent(slide.file)}` : "";
      const caption = `Source: Credit report, page ${slide.pageNumber}${slide.label ? ` — ${slide.label}` : ""}`;
      parts.push(
        `<div class="exhibit-slide">` +
          `<img src="${escapeHtml(src)}"${dims} data-exhibit-file="${escapeHtml(slide.file)}" alt="Exhibit ${escapeHtml(String(exhibit.exhibit))} evidence">` +
          `<p class="exhibit-caption"><em>${escapeHtml(caption)}</em></p>` +
          `</div>`
      );
    }
  }
  return parts.join("");
};

// Letter modes (Phase 3): decorate each dispute section at RENDER time only —
// figures/refs are never baked into section.html (exhibits post-date the draft,
// and the rich-text sanitizer strips them on edit). Absent letterMode = legacy
// output, byte-stable with pre-Phase-3 drafts.
const buildSectionExhibitDecorationHtml = (section, draft) => {
  const letterMode = draft?.letterMode;
  if (letterMode !== "inline" && letterMode !== "memorandum") {
    return "";
  }
  const exhibits = exhibitsForSection(section, draft?.exhibitsManifest);
  if (!exhibits.length) {
    return "";
  }
  if (letterMode === "memorandum") {
    return `<p class="letter-block exhibit-reference"><em>${escapeHtml(formatExhibitRefText(exhibits))}</em></p>`;
  }
  return buildSectionExhibitFiguresHtml(exhibits, draft);
};

const renderStructuredDocumentBody = (draft) => {
  const normalizedDraft = normalizeDraftStructure(draft);
  const sections = [
    normalizedDraft.sections.senderBlock?.enabled ? normalizedDraft.sections.senderBlock.html : "",
    normalizedDraft.sections.dateBlock?.enabled ? normalizedDraft.sections.dateBlock.html : "",
    normalizedDraft.sections.recipientBlock?.enabled ? normalizedDraft.sections.recipientBlock.html : "",
    normalizedDraft.sections.reportMetadataBlock?.enabled ? normalizedDraft.sections.reportMetadataBlock.html : "",
    normalizedDraft.sections.openingRequest?.enabled ? normalizedDraft.sections.openingRequest.html : "",
    normalizedDraft.sections.reinvestigationRequest?.enabled ? normalizedDraft.sections.reinvestigationRequest.html : "",
    ...normalizedDraft.sections.accountDisputes.filter((section) => section.enabled).sort((a, b) => a.order - b.order).map((section) => section.html + buildSectionExhibitDecorationHtml(section, normalizedDraft)),
    buildPersonalInformationReferenceHtml(normalizedDraft),
    ...normalizedDraft.sections.personalInformationDisputes.filter((section) => section.enabled).sort((a, b) => a.order - b.order).map((section) => section.html + buildSectionExhibitDecorationHtml(section, normalizedDraft)),
    normalizedDraft.sections.recordsRequest?.enabled ? normalizedDraft.sections.recordsRequest.html : "",
    normalizedDraft.sections.responseInstructions?.enabled ? normalizedDraft.sections.responseInstructions.html : "",
    normalizedDraft.sections.closing?.enabled ? normalizedDraft.sections.closing.html : "",
    normalizedDraft.sections.enclosures?.enabled ? normalizedDraft.sections.enclosures.html : "",
  ];
  return sections.filter(Boolean).join("");
};

export const renderPreviewHtml = (draft) => {
  const normalizedDraft = normalizeDraftStructure(draft);
  const structuredBody = renderStructuredDocumentBody(normalizedDraft);
  const documentBody = normalizedDraft.renderState.documentOverride ? normalizedDraft.fullDocumentHtml : structuredBody;

  return {
    documentHtml: documentBody,
    previewHtml: `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Dispute Letter Draft</title>
    <style>
      ${buildDisputeLetterPreviewCss()}
    </style>
  </head>
  <body>
    <div id="preview-shell" class="preview-shell"></div>
    <div id="document-source">${documentBody}</div>
    <script>
      ${buildDisputeLetterPreviewPaginationScript()}
    </script>
  </body>
</html>`,
  };
};

export const buildDisputeLetterDraft = ({ sessionId, report, intake, reasons, draftId = null }) => {
  const seed = `${bureauReportId(report)}:${intake.letterDate}:${reasons.length}`;
  const variantSelection = Object.fromEntries(
    Object.entries(clauseLibrary).map(([key, variants]) => [key, chooseVariantIndex(seed, key, variants.length)])
  );

  const accountDisputes = buildAccountDisputeSections(report, reasons, seed);
  const personalInformationDisputes = buildPersonalInformationSections(reasons, seed);
  const enclosureLines = [];
  if (Array.isArray(intake.enclosures) && intake.enclosures.length) {
    enclosureLines.push(`Enclosed: ${intake.enclosures.join(", ")}`);
  }
  if (normalizeText(intake.certifiedMailTrackingNumber)) {
    enclosureLines.push(`Certified Mail Tracking #: ${intake.certifiedMailTrackingNumber}`);
  }
  const sections = {
    senderBlock: createSection({ id: "sender-block", key: "senderBlock", label: "Sender", html: buildSenderBlockHtml(intake), enabled: true, order: 0 }),
    dateBlock: createSection({ id: "date-block", key: "dateBlock", label: "Date", html: buildDateBlockHtml(intake), enabled: true, order: 0 }),
    recipientBlock: createSection({ id: "recipient-block", key: "recipientBlock", label: "Recipient", html: buildRecipientBlockHtml(intake), enabled: true, order: 0 }),
    reportMetadataBlock: createSection({ id: "report-metadata-block", key: "reportMetadataBlock", label: "Report Metadata", html: buildReportMetadataBlockHtml(intake), enabled: true, order: 0 }),
    openingRequest: createSection({ id: "opening-request", key: "openingRequest", label: "Opening Request", title: "Opening Request", html: clauseLibrary.openingRequest[variantSelection.openingRequest]({ bureau: report.bureau }), enabled: true, order: 1 }),
    reinvestigationRequest: createSection({ id: "reinvestigation-request", key: "reinvestigationRequest", label: "Reinvestigation Request", title: "Reinvestigation Request", html: clauseLibrary.reinvestigationRequest[variantSelection.reinvestigationRequest]({ bureau: report.bureau, certifiedMailTrackingNumber: intake.certifiedMailTrackingNumber }), enabled: true, order: 2 }),
    accountDisputes,
    personalInformationDisputes,
    recordsRequest: createSection({ id: "records-request", key: "recordsRequest", label: "Records Request", title: "Records Request", html: clauseLibrary.recordsRequest[variantSelection.recordsRequest]({ bureau: report.bureau, seed }), enabled: true, order: 3 }),
    responseInstructions: createSection({ id: "response-instructions", key: "responseInstructions", label: "Response Instructions", title: "Response Instructions", html: clauseLibrary.responseInstructions[variantSelection.responseInstructions]({ responsePreference: intake.responsePreference, certifiedMailTrackingNumber: intake.certifiedMailTrackingNumber }), enabled: true, order: 4 }),
    closing: createSection({ id: "closing", key: "closing", label: "Closing", title: "Closing", html: clauseLibrary.closing[variantSelection.closing]({ fullLegalName: intake.fullLegalName }), enabled: true, order: 5 }),
    enclosures: createSection({ id: "enclosures", key: "enclosures", label: "Enclosures", title: "Enclosures", html: enclosureLines.length ? blockParagraph(enclosureLines) : "", enabled: enclosureLines.length > 0, order: 6 }),
  };

  const draft = {
    id: draftId,
    sessionId,
    metadata: {
      bureau: report.bureau,
      profileId: report.profileId,
      reportId: report.reportId ?? sessionId,
      reportNumber: intake.reportNumber,
      reportDate: intake.reportDate,
      letterDate: intake.letterDate,
      certifiedMailTrackingNumber: intake.certifiedMailTrackingNumber,
      responsePreference: intake.responsePreference,
      enclosureSelections: intake.enclosures,
    },
    identity: {
      fullLegalName: intake.fullLegalName,
      dateOfBirth: intake.dateOfBirth,
      socialSecurityNumber: intake.socialSecurityNumber,
      mailingAddress: buildSenderBlock(intake).slice(1),
    },
    recipient: {
      bureauName: intake.bureauRecipientName,
      mailingBlock: buildRecipientBlock(intake).slice(1),
    },
    sections,
    reasonRefs: reasons.filter((reason) => reason.selected).map((reason) => reason.id),
    selectedReasons: reasons.filter((reason) => reason.selected),
    variantSelection,
    renderState: {
      previewHtml: "",
      docxPath: null,
      docxUrl: null,
      pdfPath: null,
      pdfUrl: null,
      highlightedReportPdfPath: null,
      highlightedReportPdfUrl: null,
      draftDirty: false,
      documentOverride: false,
      evidenceGeneratedAt: null,
      lastGeneratedFromSectionsAt: null,
      lastFullDocumentEditAt: null,
    },
    evidenceManifest: null,
    exhibitsManifest: null,
    letterMode: null,
    exhibitNumbering: null,
    fullDocumentHtml: "",
    reportSummary: {
      fileName: report.fileName,
      consumerName: report.consumerName ?? report.personalInfo.name ?? null,
    },
  };

  return withRenderedPreview(draft, { rebuildFromSections: true });
};

export const withRenderedPreview = (draft, { rebuildFromSections = false } = {}) => {
  const normalizedDraft = normalizeDraftStructure(draft);
  const shouldRebuild = rebuildFromSections || !normalizedDraft.renderState.documentOverride;
  const nextDraft = structuredClone(normalizedDraft);
  if (shouldRebuild) {
    nextDraft.renderState.documentOverride = false;
  }

  const { documentHtml, previewHtml } = renderPreviewHtml(nextDraft);
  nextDraft.fullDocumentHtml = documentHtml;
  nextDraft.renderState.previewHtml = previewHtml;
  nextDraft.renderState.lastGeneratedFromSectionsAt = new Date().toISOString();
  nextDraft.renderState.draftDirty = false;
  return nextDraft;
};

export const updateDraftSection = (draft, group, sectionId, patch) => {
  const nextDraft = structuredClone(normalizeDraftStructure(draft));
  const container = nextDraft.sections[group];
  if (!container) {
    throw new Error(`Unknown section group '${group}'.`);
  }

  if (Array.isArray(container)) {
    const section = container.find((entry) => entry.id === sectionId);
    if (!section) {
      throw new Error(`Section '${sectionId}' was not found.`);
    }
    Object.assign(section, patch);
  } else {
    if (container.id !== sectionId) {
      throw new Error(`Section '${sectionId}' was not found.`);
    }
    Object.assign(container, patch);
  }

  // Exhibit numbering derives from section order/enabled state — a persisted
  // exhibits manifest is stale the moment either changes. Null it so the
  // preview degrades honestly (no decoration) instead of rendering figures
  // with wrong numbers; the next mode-aware export regenerates it.
  if (Object.prototype.hasOwnProperty.call(patch, "enabled") || Object.prototype.hasOwnProperty.call(patch, "order")) {
    nextDraft.exhibitsManifest = null;
  }

  nextDraft.renderState.draftDirty = nextDraft.renderState.documentOverride ? true : false;
  return nextDraft.renderState.documentOverride ? nextDraft : withRenderedPreview(nextDraft);
};

export const updateDraftFullDocument = (draft, html) => {
  const nextDraft = structuredClone(normalizeDraftStructure(draft));
  nextDraft.fullDocumentHtml = html;
  nextDraft.renderState.documentOverride = true;
  nextDraft.renderState.lastFullDocumentEditAt = new Date().toISOString();
  nextDraft.renderState.draftDirty = false;
  const { previewHtml } = renderPreviewHtml(nextDraft);
  nextDraft.renderState.previewHtml = previewHtml;
  nextDraft.renderState.docxPath = null;
  nextDraft.renderState.docxUrl = null;
  nextDraft.renderState.pdfPath = null;
  nextDraft.renderState.pdfUrl = null;
  return nextDraft;
};

export const attachArtifactUrls = (draft, outputRoot) => {
  const nextDraft = structuredClone(normalizeDraftStructure(draft));
  if (nextDraft.renderState.docxPath) {
    nextDraft.renderState.docxUrl = `/api/dispute-drafts/${nextDraft.id}/artifacts/${path.basename(nextDraft.renderState.docxPath)}`;
  }
  if (nextDraft.renderState.pdfPath) {
    nextDraft.renderState.pdfUrl = `/api/dispute-drafts/${nextDraft.id}/artifacts/${path.basename(nextDraft.renderState.pdfPath)}`;
  }
  if (nextDraft.renderState.highlightedReportPdfPath) {
    nextDraft.renderState.highlightedReportPdfUrl = `/api/dispute-drafts/${nextDraft.id}/artifacts/${path.basename(nextDraft.renderState.highlightedReportPdfPath)}`;
  }
  return nextDraft;
};
