# Dispute Rule Synthesis From Training Video

## Source
- Video: `~/Downloads/video1698282717.mp4`
- Working audio: `~/credit clarify - gain equity/3 Bureau Extractor/output/video-rules/video1698282717-audio.mp3`
- Working transcripts: `~/credit clarify - gain equity/3 Bureau Extractor/output/video-rules/video1698282717/transcripts-mlx/`
- Combined transcript: `~/credit clarify - gain equity/3 Bureau Extractor/output/video-rules/video1698282717/combined-transcript.txt`

## Purpose
This document captures the dispute-logic framework taught in the long training video so the application can reference it later when expanding the dispute reason engine.

This is not a final legal memo. It is an implementation-facing rulebook distilled from the training material.

## Core principle
The bureau report is treated as a reported story. The dispute process tests whether that story is:
- complete
- accurate
- internally consistent
- logically supportable from the fields and history shown on the same report

The point is not to dispute everything. The point is to identify where the bureau's reported story is incomplete, inaccurate, or internally contradictory.

## Governing comparison rule
Do not compare one bureau report to another bureau report.

Compare sections within the same report:
- account details vs payment history
- payment history vs balance history
- payment history vs 24 month history
- status vs status updated
- balance vs balance updated
- date of first delinquency vs on-record-until date
- responsibility vs the way the tradeline is being challenged
- personal information counts vs listed personal information items

## Primary dispute categories
The training repeatedly treats problems as one of these:

### 1. Incomplete reporting
Use this when the report leaves out information that should be present to make the tradeline understandable.

Examples from the training:
- partial account number only
- missing recent payment
- missing monthly payment where a payment amount should logically exist
- missing original creditor or lender identity when that information should be supplied
- missing balance updated date
- missing balance amount where the reporting story implies a balance should be shown

### 2. Inaccurate reporting
Use this when the reported facts do not logically line up with each other.

Examples from the training:
- status updated date does not make sense with the payment or charge-off story
- date of first delinquency does not match the reported payment progression
- on-record-until date does not line up with the date of first delinquency
- balance history and payment history tell different stories

### 3. Direct legal escalation issues
Some issues are treated as immediate legal problems rather than ordinary dispute-letter items.

Example from the training:
- multiple Social Security numbers on the report

The training explicitly treats this as an attorney issue that may bypass ordinary dispute-letter workflow.

## Rule framework by component

## Personal Information rules

### Multiple Social Security numbers
- If the report shows multiple Social Security numbers, this is treated as a major legal issue.
- The training treats this as an immediate attorney escalation item, not just a routine dispute paragraph.

### Names, addresses, employers
- Counts at the top of the section matter.
- If the section says there are multiple names, addresses, or employers, the listed items should support that count.
- Missing or conflicting identity items should be challenged as incomplete or inaccurate depending on the mismatch.

## Account-level rules

## 1. Account number completeness
- If only a partial account number is shown, the training treats that as incomplete reporting.
- The reasoning is: without the full account number, the consumer does not have the full story of the tradeline.

Implementation implication:
- this should remain a standard candidate dispute reason
- this can coexist with multiple other reasons on the same account

## 2. Original creditor / lender identity
- If the furnisher is itself the original creditor, the absence of a separate original creditor field may not be a problem
- Example taught: if the tradeline is Capital One, Capital One may itself be the original creditor
- But if the report is showing a servicing or department label instead of the actual lender identity, that may be inaccurate or incomplete
- Example taught: student loan reporting should identify the lender/bank name properly

Implementation implication:
- do not fire a weak missing-original-creditor reason blindly
- evaluate whether the tradeline already identifies the original creditor by name
- student-loan and serviced-loan naming should have stronger logic than a generic missing-creditor rule

## 3. Balance and balance-updated logic
- If an account is paid and closed, the balance should be zero and the balance-updated date should align with when the account was paid off / closed
- The training repeatedly uses the payment-history timeline to infer what the balance-updated date should logically look like
- If the account story says the account was paid and closed in a specific month, but the balance-updated field does not align, that is a contradiction

Implementation implication:
- compare close/paid status against:
  - balance
  - balance updated
  - payment history endpoint

## 4. Recent payment vs monthly payment vs payment received
These are not interchangeable.

### Recent payment
- If a payment was made, recent payment should make sense
- The training treats a dashed or missing recent-payment field as incomplete when the account story implies a last payment exists

### Monthly payment
- Monthly payment must be read in context
- On a paid and closed account, monthly payment may be zero
- On a charged-off or closed account, monthly payment being zero can be correct

### Payment received
- The training distinguishes payment received / last payment made from monthly payment
- For closed or charged-off accounts, the monthly payment can be zero while payment received still matters
- The operator must not confuse a required payment-received field with the separate monthly-payment field

Implementation implication:
- the dispute engine should not treat every zero monthly-payment field as defective
- it should instead branch by account state:
  - open installment
  - revolving
  - paid/closed
  - charged off
  - collection

## 5. Terms logic
Terms are account-type dependent.

### Revolving accounts
- Revolving accounts do not have fixed terms
- Empty terms can be correct on credit cards and other revolving lines
- A one-month term on a revolving credit card does not make sense

### Installment accounts
- Installment accounts should have a meaningful term
- If a contract is a multi-month account, a zero or nonsensical term can be incomplete or inaccurate
- The training explicitly ties installment logic to divisibility by months and years

### Charged-off installment accounts
- If the account became late and charged off, a zero-dollar term can be suspicious because the contract had to have a payment structure at some point

Implementation implication:
- terms should be validated against account type before firing a dispute reason
- do not generate a generic terms rule without account-type context

## 6. Responsibility logic
Responsibility changes how the case should be handled.

### Individual
- Standard single-consumer treatment

### Joint
- If responsibility is joint, both parties should be handled
- The training treats this as operationally important because clearing one party without the other can leave the co-obligor exposed

### Authorized user
- Authorized-user reporting is treated differently from joint responsibility
- The training stresses that negative authorized-user reporting cannot be analyzed the same way as a primary tradeline
- Fixing the primary account may be necessary to clear the authorized-user reporting

Implementation implication:
- responsibility is not just display data
- it should influence dispute routing, case handling, and possibly whether the engine suggests attorney review or special handling

## Payment History rules

## 1. Payment history is a first-class logic source
- The training repeatedly treats payment history as the core timeline of the tradeline
- You do not skip it
- You do not assume it says the same thing as balance history

## 2. Payment history and balance history are different tables
- The training explicitly says they do not carry the same information
- They are separate stories that must still make sense together

Implementation implication:
- the dispute engine must never collapse payment history and balance history into one generic history concept

## 3. Start from the beginning of the payment history
- The lecture stresses not to jump into the middle
- Read the timeline from the beginning and follow the progression

Implementation implication:
- the rule engine should evaluate sequences, not just isolated cells

## 4. Missing or incomplete payment history
- If the table is missing months or the payment story is not fully reported, that can support an incomplete-reporting reason
- This is especially important where a later status implies a delinquency progression that the table does not fully show
- The lecture explicitly calls out skipped months as a defect
- If a month inside the expected reporting span is missing, that should be treated as part of the incompleteness analysis

## 5. Delinquency progression matters
- The training follows sequences like:
  - late
  - 30
  - 60
  - 90
  - 120
  - 180
  - charge off
- That sequence is used to test whether the rest of the account fields make sense

Implementation implication:
- the dispute engine should reason over delinquency progression, not just presence/absence of derogatory marks

## Balance History rules

## 1. Balance history is separate evidence
- Balance history should be used to test whether the tradeline story is complete and accurate
- It should not be assumed to mirror payment history

## 2. Unsupported balance story
- If the account details claim a balance / past due / charge-off story that the balance history does not support, that can be inaccurate or incomplete
- The lecture repeatedly treats "payment history says one thing, balance history says another" as a core contradiction pattern

## 3. High balance and credit limit logic
- High balance and credit limit must be read carefully
- Going over the credit limit is not automatically a reporting error because fees and interest can cause an over-limit balance
- So a simple "high balance exceeds credit limit" rule is too weak by itself

Implementation implication:
- only fire high-balance / credit-limit reasons when the reported history fails to support the story, not merely because the amount is larger than the limit

## Status and date rules

## 1. Status vs status updated
- These two fields must tell a coherent story
- If status says one thing and the status-updated date points to a different timeline, that is a contradiction

## 2. Date of first delinquency
- The date of first delinquency is a major anchor
- The training repeatedly treats it as a field that must line up with the actual payment progression

## 3. On-record-until date
- The on-record-until date is taught as deriving from the date of first delinquency
- If those dates do not make sense together, that is a dispute issue

Implementation implication:
- add rule families that explicitly compare:
  - payment-history progression
  - date of first delinquency
  - on-record-until date
  - status updated date

## Collection and charge-off rules

## 1. Closed or charged-off accounts
- Closed or charged-off accounts can legitimately show monthly payment as zero
- Do not mistake that for a defect automatically

## 2. Payment received still matters
- Even where monthly payment is legitimately zero, payment received or last payment made can still be relevant

## 3. Collection-specific reasoning must be contextual
- The lecture distinguishes collection-like status from ordinary delinquency progression
- A status line saying collection must still line up with the actual monthly story
- Severe delinquency or collection comments are not enough by themselves if the payment history does not support them
- Example taught: a comment saying over 120 days past due is defective when nothing in the payment history supports that level of delinquency

Implementation implication:
- the engine should not blindly say every collection account with thin payment history is wrong
- it should check whether the specific reported collection / charge-off story is logically supported

## 4. Collection accounts reported in the wrong section
- The lecture states that where the report has a true collection section, collection accounts reported under another section are a problem
- Example taught: collection accounts reported under `other` instead of the collection section are treated as automatically wrong

Implementation implication:
- the engine should include profile-aware placement rules
- only apply them where the layout actually provides a native collection section

## 5. Collection account completeness
- When a collection account is being reported, the original creditor still matters
- The lecture also points out that collection reporting can be defective when key monetary or history fields are missing and the reporting story does not make sense
- Missing fields called out in the lecture include:
  - balance
  - scheduled payment
  - actual payment
  - amount past due
  - high credit / credit-limit analogues where the report story implies they should exist

## 6. Collection date contradictions
- Collection reporting is especially vulnerable to date contradictions
- The lecture gives examples where:
  - date of first delinquency conflicts with payment history
  - date of first delinquency conflicts with the date the account was actually opened
  - date of first delinquency conflicts with a current or paid-on-time monthly story

## Student-loan-specific rule from the lecture
- If a student loan is reporting something other than the actual lender/bank identity, the naming may be inaccurate
- The lecture specifically points to lender identity as a student-loan issue
- The lecture also teaches that student-loan disputes often need the original lender name, not just the servicer or department label
- If a student loan was in forbearance or deferment, outside documentation may be needed to compare the reported deferment / forbearance timing against the report

Implementation implication:
- student-loan tradelines need a naming/identity rule family distinct from generic credit-card logic
- student-loan rules should eventually support external corroboration where the report references deferment or forbearance dates

## Direct attorney-escalation triggers
These should not be treated as ordinary auto-generated dispute paragraphs by default:
- multiple Social Security numbers
- likely identity-mix / file-mix situations

These should be flagged for higher review.

## Practical build implications for the application

## 1. One account can have multiple dispute reasons
The training does not treat the account as having only one problem.

The engine should support multiple concurrent reasons per account, including:
- incomplete account number
- incomplete recent payment
- incomplete monthly payment
- status/date contradiction
- date-of-first-delinquency contradiction
- unsupported balance story

The operator then decides which ones to keep.

## 2. Evidence must be visible
The training logic is evidence-driven.

The review UI should show:
- the exact fields compared
- the relevant account section
- the supporting pages
- the factual mismatch being alleged

The operator should not be forced to trust a reason without seeing the evidence chain.

## 3. Account-type-aware rules are mandatory
The same field can mean different things depending on whether the account is:
- revolving
- installment
- paid and closed
- charged off
- collection
- student loan
- joint
- authorized user

The engine should not use flat rules across all tradelines.

## 4. Do not fire weak reasons just because a field is missing
The lecture repeatedly implies that missing data only matters when that field should logically be there.

Examples:
- empty terms on revolving credit can be fine
- zero monthly payment on a closed or charged-off account can be fine
- missing original creditor may be fine if the named furnisher is itself the original creditor

## 5. The dispute letter is downstream from the rule engine
The training logic reinforces that the real work is identifying:
- what is incomplete
- what is inaccurate
- what does not make sense in the reported story

The letter should be built from those findings, not from generic template filler.

## Letter-generation observations from the lecture

## 1. The letter should demand a real investigation
- The lecture emphasizes requesting a proper reinvestigation and complete, accurate, verified reporting
- It also warns about bureaus sending stall or form letters instead of meaningfully investigating

## 2. The packet matters
- The mail packet described in the lecture includes:
  - dispute letter
  - marked credit report pages
  - identification
  - proof of address
  - Social Security support material where appropriate

## 3. Similar tradelines can be grouped strategically
- The lecture suggests grouping multiple student-loan tradelines from the same lender or reporting context into one bureau letter rather than scattering them into disconnected mini-letters
- The point is to present the creditor-specific inaccuracies clearly

## 4. Wording does not need to be identical every time
- The lecture confirms the practical need to vary letters slightly while preserving the same core legal request and factual challenge
- That supports the controlled-clause-variation approach planned for the generator

## Recommended next rule families for implementation
Based on the training material already processed, the next dispute-engine expansions should be:

1. `status_updated_timeline_conflict`
- status and status-updated date do not make sense with the payment progression

2. `balance_updated_timeline_conflict`
- balance-updated date does not match the paid/closed or delinquency story

3. `recent_payment_missing_when_history_implies_payment`
- recent payment missing even though the account story implies a last payment exists

4. `monthly_payment_missing_for_open_installment`
- monthly payment missing where the account type and term imply a scheduled payment should exist

5. `date_of_first_delinquency_conflict`
- DOFD does not match the first derogatory point in the monthly timeline

6. `on_record_until_conflict`
- on-record-until date does not logically derive from the DOFD

7. `unsupported_severe_delinquency_comment`
- comments such as over 120 days past due are not supported by the payment history

8. `collection_reported_in_wrong_section`
- collection tradeline is reported outside the report's native collection section where the layout requires a collection section

9. `student_loan_lender_identity_mismatch`
- student loan reports a servicer/department label instead of the actual lender identity

10. `responsibility_requires_multi_party_review`
- joint or authorized-user status should affect downstream case workflow, not just display

11. `payment_history_missing_months`
- expected months inside the reporting span are absent from the payment history table

12. `forbearance_deferment_date_support_needed`
- student-loan deferment / forbearance timing needs outside date support to verify the report story

## Current status
This document is the first completed synthesis artifact from the full processed lecture. It is strong enough to guide the next expansion of the dispute reason engine, especially around:
- payment history
- balance history
- status/date contradictions
- account-type-aware logic
- joint / authorized-user handling

It should be updated again if later training videos add more bureau- or furnisher-specific logic.
