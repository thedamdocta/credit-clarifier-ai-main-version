---
title: "Product Vision — Consumer Grade & Business Grade"
aliases: [product-vision, product-roadmap, consumer-grade, business-grade]
type: planning
status: draft
tags: [type/planning, topic/product, topic/architecture]
created: 2026-03-25
updated: 2026-03-25
related:
  - "[[application-overview]]"
  - "[[acquisition-pipeline]]"
  - "[[dispute-generation]]"
  - "[[mailer-pipeline]]"
summary: >
  Two-tier product vision: Consumer Grade (self-service credit repair) and Business Grade
  (CRM for credit repair companies). Defines the full pipeline from report acquisition
  through dispute tracking and resolution comparison.
---

# Product Vision — Consumer Grade & Business Grade

> **Source:** operator, Session 13 (2026-03-25). This is the canonical product roadmap.

---

## Core Architectural Principle

> **Build on top of extraction. Never modify how it extracts.**

The system has two distinct layers with a clean boundary:

```
┌─────────────────────────────────────────────┐
│  ACQUISITION SERVICE (separate, being built) │
│  Browser automation → ACR → 3 bureau PDFs   │
└──────────────────┬──────────────────────────┘
                   │ 3 PDFs (the handoff artifact)
                   ▼
┌─────────────────────────────────────────────┐
│  PROCESSING PIPELINE (existing, sacred)      │
│  Extract → Analyze → Dispute → Highlight →  │
│  Letter → Package → Mail → Track → Compare  │
└─────────────────────────────────────────────┘
```

**The acquisition service** pulls all 3 reports from AnnualCreditReport.com in a single session (all bureaus selected at once). It produces 3 PDF files — one per bureau. That's its only job: deliver PDFs into the system.

**The processing pipeline** receives those 3 PDFs and runs the full lifecycle: extraction (untouched, 11 months of Codex's work), dispute analysis, letter creation, highlighting, package assembly, mailing, tracking, and month-over-month comparison.

**The boundary is the PDF.** Everything above the line (acquisition) is being built new. Everything below the line (processing) builds ON TOP of the existing extraction engine without modifying how it extracts. New features (tracking, comparison, mailing) extend the pipeline downstream — they don't change extraction.

This separation means:
- Extraction stays sacred — proven, tested, 100% accuracy
- New features are additive, not invasive
- The acquisition service can evolve independently (browser extension, server-side automation, manual upload — all produce the same PDFs)
- The processing pipeline doesn't care HOW the PDFs arrived — just that they're valid bureau reports

### What Exists vs What Needs Building

The extraction engine already handles each bureau's PDF individually — it detects the bureau, applies the correct profile, and extracts all data. What the system does NOT do yet is process all 3 in a single connected workflow.

**Current flow (one at a time):**
```
Upload 1 PDF → Create session → Extract → View results
(repeat for each bureau separately)
```

**Target flow (3-bureau orchestration):**
```
ACR pull delivers 3 PDFs
  → Create linked session group (1 per bureau)
  → Extract each bureau's PDF (existing engine, untouched)
  → Aggregate 3 bureau results into unified client view
  → Cross-bureau dispute analysis (same account across bureaus)
  → Generate per-bureau dispute packages
  → Mail, track, compare per bureau
```

The new work is the **orchestration wrapper** — linking 3 extraction sessions together, aggregating results, and enabling cross-bureau analysis. Extraction itself is not modified.

---

## Tier 1: Consumer Grade (Self-Service)

The consumer does everything themselves. The product guides them through the full credit repair lifecycle.

### Pipeline Steps

| Step | What Happens | Status |
|------|-------------|--------|
| **1. Pull All 3 Reports** | Consumer pulls Equifax, Experian, TransUnion from AnnualCreditReport.com. All 3 selected at once. | Phase 1 complete (EQ+TU working), Phase 2 in planning |
| **2. Download & Extract** | Reports downloaded as PDFs. Extraction engine parses all data with 100% accuracy. | Extraction engine mature (11 months) |
| **3. Dispute Analysis** | System identifies material inaccuracies and incompleteness across all 3 reports. | Reason engine built (45+ rules), needs materiality classifier |
| **4. Create & Edit Letters** | CFPB-standard dispute letters generated. Consumer can review and edit as needed. | Letter generation built, needs FCRA citations |
| **5. Highlight Report** | Original credit report PDF highlighted with bounding boxes pointing to each disputed item. | Evidence generator built |
| **6. Package Assembly** | Full dispute package assembled: highlighted PDF + dispute letter + uploaded identity documents (ID, SSN card, proof of address). | Partially built — needs ID doc upload + assembly |
| **7. Mail via Certified Mail** | Package sent to CRAs via certified mail with tracking numbers. | Not started — [[mailer-pipeline]] |
| **8. Track Delivery** | Tracking system monitors when letters arrive at each CRA. | Not started |
| **9. Track Response Window** | System tracks the 30-45 day investigation period per CRA (FCRA § 611 requires reinvestigation within 30 days, extendable to 45). | Not started |
| **10. Receive & Upload Responses** | Consumer uploads CRA response letters (verified mail). | Not started |
| **11. Re-Pull Reports** | Consumer pulls fresh reports the month after disputes were sent. | Same as Step 1 |
| **12. Month-Over-Month Comparison** | System compares Month 1 reports to Month 2 reports. Confirms which disputed items were modified, deleted, verified, or unchanged. | Not started |
| **13. Resolution Report** | System generates a summary: what changed, what didn't, what the consumer's next steps are (re-dispute, escalate, attorney referral). | Not started |

### Consumer-Facing Features
- Self-service web interface (no downloads required — see Deployment Architecture below)
- Guided workflow with progress tracking
- Document upload (ID, SSN card, proof of address)
- Dispute letter editor with CFPB formatting
- Highlighted report viewer
- Mailing status dashboard
- Response period countdown
- Report comparison viewer (before/after)
- FICO score display (informational)

---

## Tier 2: Business Grade (CRM for Credit Repair Companies)

Everything in Consumer Grade, PLUS tools for companies managing clients at scale.

### Additional Business Features

| Category | Features |
|----------|----------|
| **Client Management (CRM)** | Client intake, client list, status tracking, notes, document history |
| **Secure Document Portal** | Encrypted portal for clients to upload identity documents, credit reports, response letters |
| **Report Pulling on Behalf** | Company pulls reports after receiving client info and identity documents |
| **Contract & Legal Docs** | Send contracts, Powers of Attorney (POA), notary signature requests, disclosures on behalf of companies |
| **Mail on Behalf** | Mail dispute packages on behalf of clients (certified mail + tracking) |
| **Tracking & Updates** | Same tracking/comparison pipeline as consumer, managed at company level |
| **Client Communication** | Email and text updates to clients — status changes, follow-ups, report changes |
| **Invoicing & Payments** | Charge invoices, payment plans, service cancellation for non-payment |
| **FICO Score Display** | Client-facing FICO score check (common credit repair company feature) |
| **Internal Reporting** | Company-level dashboards — clients by status, dispute success rates, revenue |

---

## Deployment Architecture (OPEN QUESTION)

### The Core Question

> Does the consumer need to download this project (including a vision model) to pull reports locally? Or can they go to a hosted site?

### Option Analysis

#### Option A: Fully Local (Consumer Downloads Everything)
- **What:** Consumer installs desktop app + local model
- **Pros:** Maximum privacy — SSN/PII never leaves their machine
- **Cons:** Terrible UX barrier. Requires Node.js, Python, Ollama, 6GB model download. Limits market to technical users only.
- **Verdict:** Not viable for consumer grade.

#### Option B: Fully Hosted (SaaS Web App)
- **What:** Consumer logs into web app. Everything runs server-side including browser automation for report pulling.
- **Pros:** Zero install, standard SaaS UX, works on any device
- **Cons:** Server handles SSNs, credit reports, identity documents. Requires SOC 2 compliance, encryption at rest, data retention policies, potential regulatory scrutiny. Browser automation running server-side with consumer credentials = significant security/compliance burden.
- **Verdict:** Viable but requires serious security infrastructure. This is how most credit repair SaaS companies operate.

#### Option C: Hybrid — Consumer Pulls, System Processes
- **What:** Consumer goes to ACR themselves (manually or guided), downloads their own PDFs, uploads them to the hosted platform. All processing (extraction, analysis, disputes, mailing) happens server-side.
- **Pros:** Avoids handling SSNs/login credentials server-side. Consumer controls their own report acquisition. Lower compliance burden for the platform.
- **Cons:** Consumer must navigate ACR themselves (the hardest step). Loses the automation value proposition.
- **Verdict:** Simpler compliance story but weaker product.

#### Option D: Browser Extension + Hosted Backend
- **What:** Consumer installs a lightweight browser extension. Extension automates the ACR flow in the consumer's own browser. PDFs are captured locally and uploaded to the hosted platform for processing.
- **Pros:** Automation runs client-side (no server-side SSN handling). Extension is lightweight (no model needed — just navigation scripting). Processing happens server-side with clean SaaS UX.
- **Cons:** Browser extension review/approval process (Chrome Web Store). Extension maintenance as ACR UI changes. Consumer still needs to trust the extension with their browser session.
- **Verdict:** Strong middle ground. Preserves automation while keeping PII client-side.

### Model Implications by Deployment

| Deployment | Where Model Runs | Model Choice |
|------------|-----------------|--------------|
| **Fully Local** | Consumer's machine | Need lightweight model (Moondream 2B or skip vision entirely) |
| **Fully Hosted** | Company's server | Any model — Llama 3.2 Vision, qwen, or even cloud API (OpenAI, Anthropic) |
| **Hybrid (manual pull)** | Company's server | Any model (only used for extraction/analysis, not acquisition) |
| **Browser Extension** | Extension = no model needed (scripted nav). Server = any model for processing | Best of both worlds |
| **Business Grade** | Always company's server | Full model flexibility |

### Decision Needed
operator to decide deployment strategy. This decision affects:
1. Whether we need a local vision model at all for consumers
2. What compliance/security infrastructure is required
3. How the Phase 2 agent is architected (server-side vs client-side)
4. Whether qwen2.5vl:7b stays or gets swapped for a US-developed model

---

## Model Strategy

### Current Models (Dev Environment)

| Model | Role | Origin | License | Runs On | Data Leaves Machine? |
|-------|------|--------|---------|---------|---------------------|
| `gpt-oss:20b` | Text extraction, analysis, account inventory | Open-source (Apache 2.0), GPT-style prompt template | Apache 2.0 | Ollama local | **No** |
| `qwen2.5vl:7b` | Vision (page classification, dispute validation) | Alibaba (China) | Apache 2.0 | Ollama local | **No** |

**Origin story:** The extraction pipeline was built by Codex (GPT-4 5.4 model) over 11 months. Codex used `gpt-oss:20b` as the extraction LLM because it matched Codex's own prompt format. Both models run 100% locally via Ollama — no data goes to any external service in the current dev setup.

### Production Model Requirements

For a consumer/business product, model choice matters for:
1. **Brand trust** — Consumers handling credit data need to trust the technology. "Alibaba" and "gpt-oss" are liabilities.
2. **Legal defensibility** — If a dispute is generated based on model output, the model's provenance may matter in legal proceedings.
3. **Performance** — Extraction accuracy is non-negotiable. Any model swap must be regression-tested.

### Recommended Production Models

| Role | Current | Recommended Swap | Developer | License | Why |
|------|---------|-----------------|-----------|---------|-----|
| **Text (extraction)** | `gpt-oss:20b` | **Llama 3.2 8B** or **Mistral 7B** | Meta (US) / Mistral (EU) | Llama License / Apache 2.0 | Trusted provenance, strong reasoning, self-hosted via Ollama |
| **Vision (classification)** | `qwen2.5vl:7b` | **Llama 3.2 Vision 11B** | Meta (US) | Llama License | Best open vision model from US developer, runs on Ollama |
| **Alternative text** | — | **Phi-4 14B** | Microsoft (US) | MIT | Strong reasoning, MIT licensed, smaller footprint |

**Swap complexity:** Low. The `OllamaClient` in `main.py` and `requestOllamaJson()` in the acquisition agent are model-agnostic — they send chat requests to Ollama's API. Changing models is a config change (`OLLAMA_MODEL` and `OLLAMA_VISION_MODEL` env vars). The critical work is regression testing extraction accuracy with the new model.

### Model Deployment in Production

All models run **server-side** in production. Consumers never download or interact with models directly.

| Tier | Where Models Run | Infrastructure |
|------|-----------------|----------------|
| **Consumer Grade** | Company's server (self-hosted Ollama) | GPU VPS: 8 vCPUs, 32-64GB RAM, T4/L4 GPU optional |
| **Business Grade** | Company's server (self-hosted Ollama) | Same, scaled for concurrent clients |
| **Dev (current)** | operator's local machine | Ollama on localhost:11434 |

**Cost estimate:** GPU instance (T4) for inference: ~$200-400/mo. Non-GPU with quantized models: ~$100-200/mo.

---

## Current Build Status (Mapped to Vision)

| Vision Step | Current Status | What Exists |
|-------------|---------------|-------------|
| Pull reports | Phase 1 done (EQ+TU), Phase 2 planning | agent-browser flows, decision maps, anti-detection |
| Download & Extract | Mature | Python extraction engine (11 months) |
| Dispute analysis | Built, needs hardening | Reason engine (45+ rules) |
| Create letters | Built, needs FCRA citations | Letter builder + workflow |
| Highlight report | Built | Evidence generator with bounding boxes |
| Package assembly | Partial | Letter + highlighted report. Missing: ID doc upload, package bundling |
| Mail via certified mail | Not started | — |
| Track delivery | Not started | — |
| Track response window | Not started | — |
| Upload responses | Not started | — |
| Re-pull reports | Same as Step 1 | — |
| Month-over-month comparison | Not started | — |
| Resolution report | Not started | — |
| CRM (Business Grade) | Not started | — |
| Client portal | Not started | — |
| Invoicing/payments | Not started | — |
