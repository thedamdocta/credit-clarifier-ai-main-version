# 3 Bureau Extractor (Equifax V1 Revamp)

This repo now uses a backend-first extraction pipeline for old Equifax (AnnualCreditReport format):
- Node API orchestrator (`/api/sessions/*`)
- Python worker (dual text + image ingestion)
- Local model routing through Ollama (`gpt-oss:20b`)
- Fail-closed component validation

## Run locally

1. Install Node dependencies:
```bash
npm install
```

2. Ensure local runtime tools are available:
- `ollama` running at `http://127.0.0.1:11434`
- `pdftotext`, `pdftoppm` (Poppler)
- `tesseract`

3. Optional Python dependencies for enhanced PageIndex integration:
```bash
python3 -m pip install -r python_worker/requirements.txt
```

4. Start frontend + API together:
```bash
npm run dev:full
```

Frontend: `http://127.0.0.1:8080`  
API: `http://127.0.0.1:8787`

## Environment variables

- `OLLAMA_BASE_URL` (default `http://127.0.0.1:11434`)
- `OLLAMA_MODEL` (default `gpt-oss:20b`)
- `REPORT_RETENTION_SECONDS` (default `0`, delete-on-read behavior)
- `REPORT_PROFILE_DEFAULT` (default `equifax_old_v1`)
- `MAX_PDF_PAGES` (default `240`)
- `MAX_UPLOAD_BYTES` (default `41943040`)
- `PAGEINDEX_ROOT` (default `../PageIndex`)

## API endpoints

- `POST /api/sessions`
- `POST /api/sessions/:sessionId/upload`
- `POST /api/sessions/:sessionId/process`
- `GET /api/sessions/:sessionId/result`
- `DELETE /api/sessions/:sessionId`

## Notes

- Equifax extraction is limited to the 8 scoped components for V1.
- Equifax UI now renders backend contract data only (no client-side re-extraction loops).
- Fail-closed rules mark components as `failed` when required integrity checks are not met.
