---
title: "ACR Navigation Guide — Plan"
aliases: [acr-guide-plan, navigation-guide]
type: research
status: draft
tags: [type/research, topic/acquisition, topic/documentation, topic/canva]
created: 2026-03-25
updated: 2026-03-25
related:
  - "[[equifax-decision-map]]"
  - "[[experian-decision-map]]"
  - "[[transunion-decision-map]]"
  - "[[browser-automation-pitfalls]]"
summary: >
  Plan to create a visual step-by-step PDF guide for navigating AnnualCreditReport.com, similar to the Vance Dotson guide but updated with Phase 1 findings. Will use Canva MCP integration to design it.
---

# ACR Navigation Guide — Plan

## What This Is

A visual, designed PDF guide for navigating AnnualCreditReport.com to pull all three credit bureau reports. Modeled after the **Vance Dotson guide** (`tmp/pdfs/annual-credit-report-guide.txt`) but updated with everything discovered during Phase 1 browser automation.

## Why It Matters

- Clients need a guide they can follow if doing manual pulls
- The Phase 2 agent needs a human-readable reference alongside the decision maps
- The 7-day cooldown means mistakes are expensive — a clear guide reduces errors
- operator originally created a similar guide for client Vance Huffman using Canva

## Reference Material

- **Vance Dotson guide:** `tmp/pdfs/annual-credit-report-guide.txt` — the template/inspiration
- **Equifax decision map:** `docs/equifax-decision-map.md` — Pages 1-8 + error page
- **Experian decision map:** `docs/experian-decision-map.md` — captcha, confirmation link, error page
- **TransUnion decision map:** `docs/transunion-decision-map.md` — pre-verified info, landscape PDF
- **Browser pitfalls:** `docs/browser-automation-pitfalls.md` — 10 categorized issues
- **Screenshots:** `tmp/` directory — 16+ screenshots across all bureaus

## Screenshots Available for Guide

### ACR Shared Pages
- `tmp/acr-landing-blocked.png` — Landing page
- `tmp/acr-form-filled.png` — Personal info form (filled)

### Equifax
- `tmp/equifax-verify-filled.png` — Identity verification
- `tmp/equifax-otp-page.png` — OTP entry
- `tmp/equifax-report-summary.png` — Credit report loaded
- `tmp/equifax-after-print-click.png` — Print button behavior

### Experian
- `tmp/after-captcha-click.png` — Captcha interaction
- `tmp/experian-post-captcha.png` — Post-captcha state

### TransUnion
- `tmp/tu-form-filled.png` — TU verify identity form
- `tmp/tu-page1.png` / `tmp/tu-page2.png` — Navigation pages
- `tmp/tu-otp-entry.png` — OTP code entry
- `tmp/tu-order-complete.png` — Intermediate confirmation
- `tmp/tu-disclosure.png` — Credit report loaded
- `tmp/tu-cooldown-error.png` — 7-day rate limit page

### Missing Screenshots (capture on next browser run)
- ACR Homepage (Page 1)
- ACR Bureau Selection (Page 4)
- Equifax privacy banner (before dismissal)
- Experian verify identity page
- Experian check-device (confirmation link) page

## Guide Structure (Based on Vance Dotson Format)

1. **Cover page** — Title, branding
2. **Warning section** — Desktop only, 7-day lockout if errors, have phone ready for OTP
3. **Getting Started** — Go to annualcreditreport.com, click "Request your free credit reports"
4. **Personal Info Form** — Fill out all fields (screenshot + callouts)
5. **Bureau Selection** — Check all three OR one at a time (explain trade-offs)
6. **TransUnion Flow** (Report #1)
   - Enter email + phone
   - Choose OTP delivery (text message)
   - Enter 5-digit passcode
   - Click Continue through order complete
   - **CRITICAL: Save as PDF in LANDSCAPE mode** (screenshot of print dialog with landscape selected)
7. **Equifax Flow** (Report #2)
   - Navigate back via "Get your next report or finish"
   - Enter phone + email
   - Dismiss privacy banner
   - Send OTP, enter code
   - Click "Print Credit Report" (downloads PDF automatically)
8. **Experian Flow** (Report #3)
   - Navigate back via "Get your next report or finish"
   - Enter email + phone, choose verification method
   - Complete captcha if shown
   - Check phone for confirmation LINK (not code)
   - Save report as PDF
9. **Troubleshooting** — Common errors, 7-day cooldown, wrong info lockout

## Key Differences from Vance Dotson Guide

| Topic | Vance's Guide | Our Updated Guide |
|-------|--------------|-------------------|
| Bureau order | TU → EQ → EX (all selected at once) | Same order, but document both approaches (all-at-once vs one-at-a-time) |
| TransUnion save | "Select Landscape" in print dialog | Same — landscape is mandatory |
| Experian verification | "Answer 3 questions" | Confirmation LINK via text + possible captcha (site may have changed) |
| Equifax save | "Save as PDF" in print dialog | Click "Print Credit Report" — downloads PDF automatically |
| Warnings | "Don't use phone" | Add: have phone ready for OTP, exact info required, 7-day cooldown details |

## Canva MCP Setup

To create the designed PDF, connect Canva MCP to Claude Code:

```bash
# Option 1: Canva Dev MCP (no auth needed)
claude mcp add canva-dev -- npx -y @canva/cli@latest mcp

# Option 2: Composio integration (connects to operator's Canva account)
# Requires: Composio API key + OAuth login to Canva
# pip install composio-core python-dotenv
# Then generate MCP URL and register with claude mcp add
```

**References:**
- [Canva Dev MCP Server](https://www.canva.dev/docs/connect/mcp-server/)
- [Canva + Claude Code via Composio](https://composio.dev/toolkits/canva/framework/claude-code)
- [Canva MCP Actions](https://www.canva.com/help/mcp-canva-usage/)

## Status

- [ ] Capture missing screenshots on next browser run
- [ ] Set up Canva MCP integration
- [ ] Auth operator's Canva account
- [ ] Design guide pages with screenshots + callouts
- [ ] Export as PDF
- [ ] Save to `docs/acr-navigation-guide.pdf`
