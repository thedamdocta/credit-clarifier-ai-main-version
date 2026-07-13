# Extraction Accuracy Requirements

## Legal Extraction Rule
Extraction must preserve what the report actually shows, including:
- populated values,
- blank cells,
- explicitly unreported values,
- contradictory values across sections,
- missing payment information when another section implies payment data exists.

These are evidentiary facts. They are not parser gaps, cleanup targets, or safe defaults.

## Why This Matters
Attorneys and paralegals compare:
- summary tables,
- account detail tables,
- payment history grids,
- collection sections,
- inquiry sections,
- outside records and furnisher reporting.

If one part of the credit report conflicts with another, that mismatch can indicate inaccurate furnishing or reporting and can support a legal claim.

## Required Extraction Behavior
1. Blank table cells must be preserved as intentional report output when the layout proves the cell exists but contains no value.
2. Explicit "not reported" style values must be preserved distinctly from blank cells.
3. Fallback extraction must not overwrite a structured value that was proven blank or explicitly not reported.
4. Account, collection, inquiry, and summary extraction must keep source-level distinctions so later analysis can compare sections against each other.
5. Extraction logic must be layout- and profile-driven, not sample-specific or hardcoded to a reference file.
6. Account number is a strong identifier. Same account name with different masked account numbers must remain separate tradelines.
7. Cross-table inconsistency detection depends on exact extraction, so normalization must never erase contradictions.

## Engineering Implications
- Treat retrieval-augmented generation as context routing, not source-of-truth.
- Prefer structured layout parsing before model fallback.
- Attach parse concerns when geometry is uncertain.
- Fail closed when a field cannot be proven.
- Preserve enough evidence to compare one section of the report against another in a later analysis layer.
