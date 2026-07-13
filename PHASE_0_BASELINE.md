# Phase 0 Baseline and Security Cleanup

## Scope
- Workspace copy only: `~/credit clarify - gain equity/3 Bureau Extractor`
- Goal: remove client-side secrets and disable browser-to-provider AI calls without breaking upload/report rendering.

## Security Cleanup Completed
- Removed hardcoded provider keys from client code.
- Removed browser `fetch` calls to `https://api.openai.com/v1/chat/completions`.
- Disabled client-side provider execution paths with explicit Phase 0 guardrails.
- Replaced API-key configuration UI with a local-only security notice.

## Files Updated
- `~/credit clarify - gain equity/3 Bureau Extractor/src/lib/ai/openai/openaiService.tsx`
- `~/credit clarify - gain equity/3 Bureau Extractor/src/lib/ai/accountsExtraction.ts`
- `~/credit clarify - gain equity/3 Bureau Extractor/src/components/OpenAIConfigSection.tsx`
- `~/credit clarify - gain equity/3 Bureau Extractor/src/components/PDFUploader.tsx`
- `~/credit clarify - gain equity/3 Bureau Extractor/src/components/credit-report/accounts/AccountDataExtractor.tsx`
- `~/credit clarify - gain equity/3 Bureau Extractor/src/features/node-editor/nodes/ai/OpenAICallerNode.ts`
- `~/credit clarify - gain equity/3 Bureau Extractor/src/features/node-editor/nodes/ai/OpenAIVisionNode.ts`
- `~/credit clarify - gain equity/3 Bureau Extractor/src/features/node-editor/nodes/ai/OpenAITableExtractNode.ts`
- `~/credit clarify - gain equity/3 Bureau Extractor/src/features/node-editor/nodes/control/APIKeyValidatorNode.ts`
- `~/credit clarify - gain equity/3 Bureau Extractor/src/pages/Index.tsx`
- `~/credit clarify - gain equity/3 Bureau Extractor/src/lib/parsers/equifax/equifaxParser.ts`

## Baseline Validation
- `npm run build`: pass
- `npx tsc --noEmit`: pass
- `npm run lint`: fail (`453` issues total in current codebase)

## Playwright Headed Validation
- Skill path used: `~/.codex/skills/playwright/SKILL.md`
- Browser mode: headed (`chrome`)
- URL: `http://127.0.0.1:4174/`
- Uploaded test file copy:
  - `~/credit clarify - gain equity/3 Bureau Extractor/tmp/playwright-upload/REF-EQOLD-D2.pdf`
  - source file: `~/Desktop/Projects/credit report references/REF-EQOLD-D.pdf`
- Outcome:
  - Upload succeeds.
  - App auto-navigates to Report tab.
  - Equifax header and summary render.
  - Account details extraction remains limited (fallback/sample account still shown).
  - No network calls to OpenAI endpoints observed in Playwright network logs.

## Artifacts
- Snapshot (upload page): `~/credit clarify - gain equity/3 Bureau Extractor/.playwright-cli/page-2026-02-26T23-33-36-961Z.yml`
- Snapshot (report page after upload): `~/credit clarify - gain equity/3 Bureau Extractor/.playwright-cli/page-2026-02-26T23-34-26-960Z.yml`
- Screenshot (report page): `~/credit clarify - gain equity/3 Bureau Extractor/.playwright-cli/page-2026-02-26T23-34-47-264Z.png`
- Network log checked for provider calls: `~/credit clarify - gain equity/3 Bureau Extractor/.playwright-cli/network-2026-02-26T23-33-01-208Z.log`

## Remaining High-Priority Gaps (Expected for Next Phase)
- No backend session API yet.
- No page-index retrieval/stitching pipeline yet.
- Existing local transformer entity model load errors still appear in browser console.
