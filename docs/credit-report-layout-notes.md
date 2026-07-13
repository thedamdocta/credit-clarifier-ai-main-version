## Credit Report Layout Notes

### Experian Annual Credit Report

- Collection entries appear within the `Accounts` section.
- The application should not create a separate Experian `Collections` section in the UI.
- Collection-specific details for Experian should be extracted and displayed from the account entry itself so the extracted structure stays aligned with the source report.
- `Additional Info` is an account-level subsection inside each account, not a top-level report section.
- Rights/disclosure pages may contain the phrase `additional information`, but that text should not be treated as an extractable report component.

### Old Equifax Annual Credit Report

- `ADDITIONAL INFORMATION - ...` appears inside account detail lines as an account-level field.
- It should be preserved with the account itself rather than treated as a standalone top-level report section.

### Public Record Identity and Reference Numbers

- Public-record identifiers are not tradeline account numbers.
- If a bureau shows a court line with a trailing docket, case, or reference-style identifier and does not label that identifier separately, the extractor should split it out into `referenceNumber` instead of leaving it attached to the `court` value.
- This rule is currently applied as a safe fallback only when:
  - the court value contains the word `court`
  - the trailing token looks like a docket/reference identifier
  - the explicit `referenceNumber` field is still empty
- Title/identity display should prefer the best available record identifier for that report:
  - `court`
  - otherwise `recordType`
  - otherwise `summary`
