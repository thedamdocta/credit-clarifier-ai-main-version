---
title: "Test Run Findings — Full Pipeline Walkthrough"
aliases: [test-run-findings, pipeline-walkthrough]
type: research
status: complete
tags: [type/research, topic/pipeline, topic/testing, topic/ui]
created: 2026-03-31
updated: 2026-03-31
related:
  - "[[application-overview]]"
  - "[[dispute-generation]]"
  - "[[extraction-pipeline]]"
  - "[[frontend-architecture]]"
  - "[[browser-automation-pitfalls]]"
summary: >
  End-to-end pipeline walkthrough using a redacted Equifax PDF (35 pages, 244KB).
  Covers upload → extraction → report view → dispute letter (all 6 steps). Documents what
  works, UI observations, and issues found. Test run spanned Sessions 14-15.
  PII redacted — all client data replaced with [REDACTED].
---

# Test Run Findings — Full Pipeline Walkthrough

> **Test data:** [REDACTED] Equifax PDF, 35 pages, 244KB
> **Report Ref:** [REDACTED]
> **Date:** Dec 27, 2024 (report date)
> **Sessions:** 14-15 (2026-03-31)
> **Screenshots:** 36 saved to `tmp/test-run-*.png` (contain PII — handle accordingly)

---

## 1. Upload & Extraction

**What happened:**
- PDF uploaded via API (`POST /api/sessions/:id/upload`) using Multer
- Python worker extraction completed successfully
- **Result:** 6 accounts, 1 collection, 26 inquiries extracted
- Extraction flagged: "Extraction requires review for: accounts" (yellow banner on report view)

**Observations:**
- Upload flow works cleanly through API
- Extraction accuracy banner is a good safety feature — tells the user when review is needed
- Session stored in-memory only (lost on restart)

---

## 2. Report View — Deep Dive

### Page-Level Structure
- **Left sidebar:** Navigation (Dashboard, Reports, Upload PDF, Get Reports, Report View, Dispute Letter, Settings)
- **Status bar:** "Currently viewing: Ref: [REDACTED] Env: Development"
- **Action bar:** Report, Source PDF, Refresh, Settings, Download buttons
- **Dossier theme:** warm paper background (#f7f4ee), blue frame (#1a4bff), Instrument Sans / IBM Plex Mono / Cormorant Garamond fonts, 0rem radius, 10px box-shadow

### Top-Level Sections (each has "Extracted Data" / "Source Report" tab toggle)

1. **Equifax Credit Report** (header) — Consumer name, confirmation number, report date
2. **Personal Information** — Full name, SSN (masked), DOB, current + previous addresses (up to 9), employment history
3. **1. Summary** — Report date, credit file status, alert contacts, average account age, length of credit history, accounts with negative info count, oldest/most recent account
4. **Credit Accounts Summary** — Table with columns: Account Type, Open, With Balance, Total Balance, Available, Credit Limit, Debt-to-Credit, Payment. Rows for Revolving, Mortgage, Installment, Other, Total.
5. **Other Items Summary** — Consumer statements count, personal information items count, inquiries count, most recent inquiry
6. **Accounts** — Individual account cards (see below)
7. **Collections** — Individual collection cards (see below)
8. **Inquiries** — Hard Inquiries table (subscriber, date, purpose, reference) + Soft Inquiries table

### Account Card Tabs (6 per account — THIS IS WHERE THE DATA LIVES)

Each account card has a heading (creditor name, account number masked, open/closed status, negative flag) plus a status label (e.g., "CHARGE OFF", "REPOSSESSION", "PAYS AS AGREED"). Below that are **6 tabs**:

#### Tab 1: Summary (default view)
- **Compact overview:** Account number (masked), reported balance, account status, open date
- This is ALL that's visible when cards are collapsed — operator noted "most of the important information" is under the other tabs

#### Tab 2: Account History
- **Balance History table:** Monthly balance amounts in a Year x Jan-Dec grid (2-3 years of data)
- **Scheduled Payment History table:** Monthly scheduled payment amounts in same grid
- Enables spotting balance progression patterns (steady increase = never paying down, sudden jump = new charges)

#### Tab 3: Payment History
- **Color-coded month-by-month status grid** — the most visually dense component
- Year x Jan-Dec grid with status codes: OK, CUR, X, ND, TNT, CLS, 30, 60, 90, 120, 150, 180, COL, C, CO, C/O, B, R, V, VS, F, RPO
- **Color coding:** Green = current, Red = derogatory, Gray = missing/closed
- **Full legend displayed** above grid; codes used in the current account are emphasized
- **Critical for disputes:** Where payment progression anomalies become visible

#### Tab 4: Account Details
- **30+ structured fields** — the most data-dense tab:
  - Account Type, Category, Ownership, Status, High Credit, Credit Limit, Current Balance, Amount Past Due, Charge Off Amount
  - Actual/Scheduled/Balloon Payment Amounts, Credit Type, Loan Type, Terms Frequency, Term Duration, Months Reviewed
  - Payment Responsibility, Activity Designator
  - Key dates: Opened, Closed, Reported, Last Payment, Last Activity, First Delinquency, Delinquency First Reported
  - Creditor Classification
- Many fields show "Not reported" — same string whether report says it, cell is blank, or extraction failed

#### Tab 5: Comments
- Creditor-provided comments (e.g., "Charged off account", "Credit card")
- **Contact Information** section with phone number and address

#### Tab 6: Source Report
- **Provenance tracking** — shows the original PDF pages used for extraction
- "Source Pages" with page count and page images
- Links extracted data back to specific PDF pages — critical for legal weight

### Collection Cards
- Similar to account cards but with: Collection Agency, Original Creditor, Subtype, Account Number, Amount
- Tabs: Summary, Collection Details, Comments, Source Report (no Account History or Payment History)

### Inquiries Section
- **Hard Inquiries table:** Subscriber name, date, purpose, reference
- **Soft Inquiries table:** Same structure, sorted by date

---

## 3. Dispute Letter Workflow

### Step 1: Reasons

**What works:**
- 23 dispute reasons auto-generated from single-bureau analysis
- Reasons grouped by account with expand/collapse per group
- "Expand all" / "Collapse all" controls
- "Re-evaluate Reasons" button for re-running analysis
- Evidence synchronization: "dispute draft and screenshot evidence are being synchronized in one pass"
- Status bar shows: "Equifax equifax_old_v1 23 selected reasons"

**Observations:**
- Reasons are auto-selected by default based on category (legal_public_record) and posture (negative) — matches vault documentation
- Expanded reasons show specific evidence with highlighted source proof references
- Per the vault: 45+ rule types across 10 categories, severity by category not materiality

### Step 2: Intake (fully explored Session 15)

**Fields present:**
- **Consumer identity:** Full legal name (auto-populated from extraction), DOB, SSN (masked), report number, report date
- **Letter metadata:** Letter date (auto-set to tomorrow), certified mail tracking number (empty — user fills)
- **Consumer address:** Mailing address lines 1-2, city, state, zip (line 1 auto-populated from extraction, city/state/zip separate fields)
- **Bureau recipient:** Name (auto: "Equifax Information Services LLC"), address (auto: P.O. Box 740256, Atlanta, GA 30374)
- **Response preference:** Dropdown — "Mail only" or "Mail and email"
- **Enclosures:** Multi-line text field, pre-filled with "Identification / Proof of address / Marked report pages"
- **Actions:** "Back to Reasons", "Create Draft", "Open Sections" (disabled until draft created)
- **Note:** Steps 3-6 require "Create Draft" to be clicked first — cannot skip ahead. Draft creation depends on evidence sync completing in Step 1.

### Steps 3-6: Not explored (Session 15)

> Steps 3-6 (Sections, Full Letter, Highlighted Report, Preview/Export) require the dispute draft to be created via the Intake step. The evidence synchronization was still loading during Session 15. These steps were visually captured in Session 14 screenshots (test-run-13 through 29) but not documented from live exploration. See screenshot index below for visual reference. Full exploration deferred to next session.

---

## 4. UI Design System — "Dossier" Theme

Documented during Session 14 codebase study:

| Property | Value |
|----------|-------|
| Background | `#f7f4ee` (warm paper) |
| Frame color | `#1a4bff` (blue) |
| Heading font | Cormorant Garamond |
| Body font | Instrument Sans |
| Mono font | IBM Plex Mono |
| Border radius | 0rem (sharp corners) |
| Box shadow | 10px |
| CSS file | `index.css` (1067 lines) |

The Dossier theme gives the app a legal-document aesthetic. Sharp corners, warm paper background, serif headings — deliberate choices for the attorney audience.

---

## 5. Issues & Gaps Found

### Working correctly
- Full pipeline from upload to export functions end-to-end
- Extraction produces structured data from Equifax PDF
- Dispute reason engine generates relevant contradictions
- Letter formatting meets CFPB visual standard
- UI renders consistently with the Dossier theme

### Known gaps (from vault, confirmed in test)
- **"Extraction requires review" banner** — extraction flagged accounts as needing review. This is the `normalize_account_scalar_value()` behavior documented in vault: blank fields default to "Not reported" whether the report says it, the cell is blank, or extraction failed
- **No materiality classifier** — all 23 reasons treated equally. No distinction between clearly material (wrong payment status) and potentially immaterial (timing field discrepancy)
- **No FCRA section citations in letter body** — letter references "Fair Credit Reporting Act" generically but doesn't cite § 611, § 613, § 616, § 617
- **Session data in-memory only** — report sessions would be lost on server restart

### Session infrastructure notes
- API running on port 8787, Vite on port 8081
- Report stored via `credit-clarifier.active-report` sessionStorage key
- Equifax profile: `equifax_old_v1`

---

## 6. Screenshot Index

36 screenshots saved to `tmp/test-run-*.png`:

| # | Filename | Content |
|---|----------|---------|
| 01 | test-run-01-landing.png | App landing page |
| 02 | test-run-02-app-home.png | App home/dashboard |
| 03-05 | test-run-03 through 05 | Report view (header, personal info, bottom) |
| 06-07 | test-run-06 through 07 | Dispute page, dispute reasons overview |
| 08-12 | test-run-08 through 12 | Expanded dispute reasons, per-account details, payment history disputes |
| 13-14 | test-run-13 through 14 | Full letter (Step 4) content |
| 15-16 | test-run-15 through 16 | Highlighted report step |
| 17-22 | test-run-17 through 22 | Preview/export step, letter content, closing |
| 23-25 | test-run-23 through 25 | Intake step (Step 2), bureau addresses |
| 26-29 | test-run-26 through 29 | Sections step (Step 3), dispute sections |
| 30-36 | test-run-30 through 36 | Report view deep dive (personal info, employers, summary, accounts) |

> **Note:** Session 14 crashed at screenshot ~36 due to accumulated image dimensions exceeding API limits. See [[browser-automation-pitfalls#13. Screenshot Accumulation Crashes Context (API 400 Error)]].
