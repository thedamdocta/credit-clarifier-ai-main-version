# LlamaParse Replication Notes

This file records what LlamaParse returned on a real Equifax sample and which parts of that behavior we should reproduce locally instead of depending on the API.

## Scope

- Benchmark sample: `REF-EQOLD-D.pdf`
- Goal: understand artifact shape, not adopt LlamaParse as a production dependency
- Local target: reproduce the same useful stages with our existing Node + Python + Ollama stack

## Probe Output

The probe script is:

- `python_worker/llama_parse_probe.py`

It requests:

- `markdown_full`
- `text_full`
- `markdown`
- `text`
- `items`
- `images_content_metadata`

It also enables:

- screenshots/layout images
- spatial text settings
- aggressive table extraction
- tables as spreadsheet

## What LlamaParse Returned

### 1. Full-document content

- `markdown_full.md`
- `text_full.txt`

This is useful for global search, section detection, and a fast baseline view of the report.

### 2. Page-level outputs

- `markdown_pages.json`
- `text_pages.json`

These are organized under `pages`, not flat strings. Each page has at least:

- `page_number`
- `markdown` or `text`
- `success`

This matters because the current local pipeline collapses too much into raw page text.

### 3. Structured page items

- `items.json`

This is the most important response. Each page contains `items`, and each item has a semantic type such as:

- `heading`
- `text`
- `list`
- `table`
- `footer`
- `header`

For Equifax, this is where the value is. It effectively converts the page into labeled blocks before extraction.

### 4. Table objects are rich

Each `table` item can include:

- `rows`
- `csv`
- `html`
- `md`
- `bbox`
- `parse_concerns`
- `merged_from_pages`
- `merged_into_page`

This is materially better than our current local artifact, which only stores page text plus a crude `table_quality` score.

### 5. Bounding boxes

Many items include `bbox` records with:

- `x`
- `y`
- `w`
- `h`
- `confidence`
- `label`
- `start_index`
- `end_index`

This gives a direct link between visual location and extracted content. That is one of the main missing ingredients in the current worker.

### 6. Parse warnings

Table items include `parse_concerns`, for example:

- header/value type mismatches
- multi-table page warnings

This is useful because it exposes uncertainty instead of hiding it. We should copy this behavior locally and feed it into fail-closed validation.

### 7. Image metadata

- `images_content_metadata.json`

The response includes image metadata and presigned URLs for generated images. That confirms the parser is producing image-based artifacts in addition to text/layout artifacts.

## What Worked Well On The Equifax Sample

### Summary table

The summary key-value table on page 3 was returned cleanly as:

- row arrays
- markdown table
- HTML table
- CSV table
- one bounding box

### Credit accounts summary table

The credit accounts summary was returned as a structured table with the exact columns:

- `Account Type`
- `Open`
- `With Balance`
- `Total Balance`
- `Available`
- `Credit Limit`
- `Debt-to-Credit`
- `Payment`

This is the behavior we want locally for component `#4`.

### Account history tables

Balance and payment history grids were returned as proper year/month tables. This is a strong signal that our local replacement needs an explicit grid/table layer instead of treating those pages as plain text.

### Collections table

The collection section was returned as a structured table with:

- collection agency
- original creditor
- dates
- masked account number
- amount
- status

This is directly useful for component `#7`.

### Inquiries tables

Hard and soft inquiries were returned as tables with columns like:

- `Date`
- `Company`
- `Request Originator`
- `Description`

This is directly useful for component `#8`.

## What LlamaParse Did Not Solve For Us

### Cross-page stitching is still required

On the REF-D sample, the hard inquiries section continues across a page break. LlamaParse did not fully merge that into one clean logical entity. Some continuation content landed as plain text at the top of the next page before the soft inquiries section.

Conclusion:

- better page parsing does not remove the need for our own cross-page entity stitcher

### Multi-table pages still need interpretation

Account pages often produce several separate tables:

- header/detail tables
- monthly history tables
- comments/contact tables

LlamaParse gives good pieces, but it does not assemble them into our exact component schema. That orchestration still belongs to our system.

### Parse concerns still exist

The API exposes its own uncertainty. That means even their parser is not a perfect truth engine. We still need deterministic validation and failure rules.

## Current Local Worker Gap

Current `python_worker/main.py` only stores per page:

- `text_layer`
- `ocr_text`
- `fused_text`
- `image_path`
- `text_quality`
- `table_quality`

That is not enough structure to match the useful parts of the LlamaParse output.

## Local Replication Plan

### Stage 1. Text extraction

Keep:

- `pdftotext -layout`
- `pdftotext -bbox-layout`

But persist actual positioned text spans, not just flattened strings.

### Stage 2. Layout segmentation

Build page blocks from:

- bbox text spans
- heading patterns
- whitespace gaps
- repeated footer/header detection
- image-region candidates

Target output:

- page items similar to `heading`, `text`, `table`, `list`, `footer`

### Stage 3. Table/grid extraction

For every detected table region:

- detect row/column boundaries from geometry
- assign text tokens to cells
- return `rows`, `csv`, `md`, `html`, `bbox`
- add `parse_concerns`

This is the missing core for components `#4`, `#6`, `#7`, and `#8`.

### Stage 4. Image-assisted fallback

Only when geometry/text assignment is incomplete:

- send table crops or page crops to the local model
- use the model to fill missing cells or classify ambiguous regions

The model should be an assist layer, not the primary parser.

### Stage 5. Entity assembly

Use section routing plus deterministic merge logic to assemble:

- one account from several account-page tables
- one inquiry list from split pages
- one collection from several related blocks

This is where PageIndex helps. It should route the right windows and neighbors, but it should not be treated as the source of truth.

### Stage 6. Validation and failure reporting

Add local `parse_concerns` and validator issues:

- missing required fields
- broken row counts
- impossible date order
- count mismatches
- suspicious cross-page merges

This should feed component-level `failed` states.

## Practical Conclusion

The LlamaParse benchmark confirms the direction:

- text only is not enough
- image only is not enough
- the winning approach is a hybrid artifact pipeline

But the benchmark also confirms that we still need our own:

- cross-page stitching
- schema assembly
- deterministic validation
- fail-closed logic

So the local system should aim to reproduce the artifact layer, not copy the vendor API.
