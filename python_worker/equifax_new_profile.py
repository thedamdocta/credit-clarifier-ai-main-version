import re
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

try:
    from PIL import Image, ImageOps
except ImportError:  # pragma: no cover - optional runtime dependency
    Image = None
    ImageOps = None


EQUIFAX_NEW_COMPONENT_NAMES = [
    "reportConfirmationDetails",
    "summary",
    "personalInformation",
    "accounts",
    "collections",
    "publicRecords",
    "inquiries",
]

HEADER_SKIP_PREFIXES = (
    "prepared for:",
    "date:",
    "confirmation #",
)

FOOTER_SKIP_PATTERN = re.compile(r"page\s+\d+\s+of\s+\d+|000000001-disc", re.IGNORECASE)
DATE_PATTERN = re.compile(r"\d{2}/\d{2}/\d{4}|[A-Z][a-z]+ \d{1,2}, \d{4}")
PHONE_PATTERN = re.compile(r"(?:\(\s*\d{3}\s*\)|\d{3})[\s.-]*\d{3}[\s.-]*\d{4}")
MONTH_TOKEN_PATTERN = re.compile(r"^\d{2}/\d{2}$")
ACCOUNT_HEADING_IGNORE = {
    "credit accounts",
    "payment history",
    "24 month history",
    "narrative code",
    "narrative code description",
    "narrative code(s)",
    "inquiries",
}
MONTH_KEYS = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
]
MONTH_LABEL_TO_KEY = {
    "jan": "jan",
    "feb": "feb",
    "mar": "mar",
    "apr": "apr",
    "may": "may",
    "jun": "jun",
    "jul": "jul",
    "aug": "aug",
    "sep": "sep",
    "oct": "oct",
    "nov": "nov",
    "dec": "dec",
}
MONTH_NUMBER_TO_KEY = {
    "01": "jan",
    "02": "feb",
    "03": "mar",
    "04": "apr",
    "05": "may",
    "06": "jun",
    "07": "jul",
    "08": "aug",
    "09": "sep",
    "10": "oct",
    "11": "nov",
    "12": "dec",
}
PAYMENT_STATUS_CODES = {
    "OK",
    "30",
    "60",
    "90",
    "120",
    "150",
    "180",
    "COL",
    "C",
    "CO",
    "B",
    "R",
    "V",
    "F",
    "TNT",
    "X",
}
MONTH24_FIELD_ORDER: List[Tuple[str, str]] = [
    ("balance", "Balance"),
    ("paymentAmount", "Scheduled / Actual Payment Amount"),
    ("lastPaymentDate", "Last Payment Date"),
    ("pastDueAmount", "Past Due Amount"),
    ("highCredit", "High Credit"),
    ("creditLimit", "Credit Limit"),
    ("narrativeCodes", "Narrative Codes"),
]

ACCOUNT_FIELD_LABELS: List[Tuple[str, str]] = [
    ("Date Reported", "dateReported"),
    ("Balance", "balance"),
    ("Account Number", "accountNumber"),
    ("Owner", "owner"),
    ("Credit Limit", "creditLimit"),
    ("High Credit", "highCredit"),
    ("Loan/Account Type", "loanAccountType"),
    ("Status", "status"),
    ("Date Opened", "dateOpened"),
    ("Date of 1st Delinquency", "dateOfFirstDelinquency"),
    ("Terms Frequency", "termsFrequency"),
    ("Date of Last Activity", "dateOfLastActivity"),
    ("Date Major Delinquency 1st Reported", "dateMajorDelinquencyFirstReported"),
    ("Months Reviewed", "monthsReviewed"),
    ("Scheduled Payment Amount", "scheduledPaymentAmount"),
    ("Amount Past Due", "amountPastDue"),
    ("Deferred Payment Start Date", "deferredPaymentStartDate"),
    ("Actual Payment Amount", "actualPaymentAmount"),
    ("Charge Off Amount", "chargeOffAmount"),
    ("Balloon Payment Amount", "balloonPaymentAmount"),
    ("Date of Last Payment", "dateOfLastPayment"),
    ("Date Closed", "dateClosed"),
    ("Balloon Payment Date", "balloonPaymentDate"),
    ("Term Duration", "termDuration"),
    ("Activity Designator", "activityDesignator"),
    ("Narrative Code(s)", "narrativeCodeList"),
]
ACCOUNT_SECTION_MARKERS = ["Payment History", "24 Month History", "Narrative Code", "Narrative Code Description"]
ACCOUNT_CONTACT_STOP_MARKERS = [
    "Account Number:",
    "Date Reported:",
    "Balance:",
    "Owner:",
    "Credit Limit:",
    "High Credit:",
    "Loan/Account Type:",
    "Status:",
]
INQUIRY_START_PATTERN = re.compile(
    r"^(?P<company>.+?)\s+(?P<inquiryType>Hard|Soft)\s+(?P<dates>\d{2}/\d{2}/\d{4}.*)$",
    re.IGNORECASE,
)
EQUIFAX_NEW_COLLECTION_FIELD_LABELS = {
    "date reported": "dateReported",
    "collection agency": "collectionAgency",
    "balance date": "balanceDate",
    "original creditor name": "originalCreditorName",
    "account designator code": "accountDesignatorCode",
    "date assigned": "dateAssigned",
    "account number": "accountNumber",
    "original amount owed": "originalAmountOwed",
    "creditor classification": "creditorClassification",
    "amount": "amount",
    "last payment date": "lastPaymentDate",
    "status date": "statusDate",
    "date of first delinquency": "dateOfFirstDelinquency",
    "status": "status",
    "comments": "comments",
    "contact": "contact",
}
EQUIFAX_NEW_PUBLIC_RECORD_FIELD_LABELS = {
    "reference number": "referenceNumber",
    "status": "status",
    "date filed": "dateFiled",
    "type": "type",
    "verified date": "verifiedDate",
    "filer": "filer",
    "subject": "subject",
    "liability": "liability",
    "court": "court",
    "exempt amount": "exemptAmount",
    "asset amount": "assetAmount",
    "prior disposition": "priorDisposition",
    "comments": "comments",
}
EQUIFAX_NEW_PUBLIC_RECORD_CATEGORIES = {
    "bankruptcies": "Bankruptcy",
    "judgments": "Judgment",
    "liens": "Lien",
}
MONTH24_LABEL_MAP = {
    "balance": ("balance", "Balance"),
    "scheduled actual payment payment amount amount": ("paymentAmount", "Scheduled / Actual Payment Amount"),
    "last payment date": ("lastPaymentDate", "Last Payment Date"),
    "past due amount": ("pastDueAmount", "Past Due Amount"),
    "high credit": ("highCredit", "High Credit"),
    "credit limit": ("creditLimit", "Credit Limit"),
    "narrative codes": ("narrativeCodes", "Narrative Codes"),
}


def normalize_spaces(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def canonical_heading(value: Any) -> str:
    cleaned = normalize_spaces(value).strip(":")
    cleaned = re.sub(r"^[^A-Za-z0-9]+", "", cleaned)
    return cleaned.lower()


def unique_preserve_order(values: Iterable[Any]) -> List[Any]:
    seen = set()
    result: List[Any] = []
    for value in values:
        key = repr(value)
        if key in seen:
            continue
        seen.add(key)
        result.append(value)
    return result


def split_trailing_public_record_identifier(value: Any) -> Tuple[str, str]:
    normalized = normalize_spaces(value)
    if not normalized:
        return "", ""
    match = re.match(r"^(.*?)(?:\s+)([A-Z0-9\-]*\d[A-Z0-9\-]{3,})$", normalized)
    if not match:
        return normalized, ""
    court_name = normalize_spaces(match.group(1))
    identifier = normalize_spaces(match.group(2))
    if not court_name or not identifier:
        return normalized, ""
    if "court" not in court_name.lower():
        return normalized, ""
    return court_name, identifier


def split_labeled_segments(line: str, field_labels: Dict[str, str]) -> List[Tuple[str, str]]:
    labels = sorted(field_labels.keys(), key=len, reverse=True)
    pattern = re.compile(
        r"(?i)(?<!\w)(" + "|".join(re.escape(label) for label in labels) + r")(?:\s*:)?"
    )
    matches = list(pattern.finditer(line))
    if not matches:
        return []

    segments: List[Tuple[str, str]] = []
    for index, match in enumerate(matches):
        label_text = normalize_spaces(match.group(1))
        field_key = field_labels.get(canonical_heading(label_text))
        if not field_key:
            continue
        value_start = match.end()
        value_end = matches[index + 1].start() if index + 1 < len(matches) else len(line)
        value = normalize_spaces(line[value_start:value_end])
        segments.append((field_key, value))
    return segments


def merge_field_text(record: Dict[str, Any], field_key: str, value: str) -> None:
    normalized = normalize_spaces(value)
    if not normalized:
        return
    existing = normalize_spaces(record.get(field_key) or "")
    if not existing:
        record[field_key] = normalized
        return
    if normalized in existing:
        return
    record[field_key] = f"{existing} {normalized}"


def raw_page_lines(page: Any) -> List[str]:
    return [line.rstrip() for line in str(getattr(page, "text_layer", "") or "").splitlines() if line.strip()]


def cleaned_page_lines(page: Any) -> List[str]:
    lines: List[str] = []
    for raw_line in raw_page_lines(page):
        line = normalize_spaces(raw_line)
        lowered = line.lower()
        if not line or FOOTER_SKIP_PATTERN.search(line):
            continue
        if lowered.startswith(HEADER_SKIP_PREFIXES):
            continue
        if lowered == "your credit report":
            continue
        lines.append(line)
    return lines


def page_text(page: Any) -> str:
    return "\n".join(cleaned_page_lines(page))


def page_contains_all(page: Any, phrases: List[str]) -> bool:
    text = page_text(page).lower()
    return all(phrase.lower() in text for phrase in phrases)


def page_has_heading(page: Any, target: str) -> bool:
    normalized_target = canonical_heading(target)
    return any(canonical_heading(line) == normalized_target for line in cleaned_page_lines(page))


def discover_section_pages(page_artifacts: List[Any]) -> Dict[str, List[int]]:
    total_pages = len(page_artifacts)
    report_page = [1] if page_artifacts else []
    summary_page = next(
        (
            page.page_number
            for page in page_artifacts
            if page_contains_all(page, ["summary", "personal information", "consumer file notices"])
        ),
        1,
    )
    accounts_start = next(
        (
            page.page_number
            for page in page_artifacts
            if "credit accounts" in page_text(page).lower()
        ),
        summary_page + 1,
    )
    collections_start = next(
        (
            page.page_number
            for page in page_artifacts[max(accounts_start - 1, 0):]
            if page_has_heading(page, "10. Collections")
        ),
        next(
            (
                page.page_number
                for page in page_artifacts[max(accounts_start - 1, 0):]
                if any(marker in page_text(page).lower() for marker in ["collections", "collection accounts", "collection agency"])
            ),
            total_pages + 1,
        ),
    )
    public_records_start = next(
        (
            page.page_number
            for page in page_artifacts[max(accounts_start - 1, 0):]
            if page_has_heading(page, "9. Public Records")
        ),
        next(
            (
                page.page_number
                for page in page_artifacts[max(accounts_start - 1, 0):]
                if "public records" in page_text(page).lower()
            ),
            total_pages + 1,
        ),
    )
    inquiries_start = next(
        (
            page.page_number
            for page in page_artifacts
            if page_has_heading(page, "8. Inquiries")
        ),
        next(
            (
                page.page_number
                for page in page_artifacts
                if page_contains_all(page, ["company information", "inquiry type", "inquiry date(s)"])
            ),
            total_pages + 1,
        ),
    )
    rights_start = next(
        (
            page.page_number
            for page in page_artifacts[inquiries_start:]
            if page_has_heading(page, "12. A Summary of Your Rights Under the Fair Credit Reporting Act")
            or any(
                marker in page_text(page).lower()
                for marker in [
                    "know your rights",
                    "fair credit reporting act",
                    "summary of your rights",
                ]
            )
        ),
        total_pages + 1,
    )
    def section_end(start_page: int, *candidates: int) -> int:
        valid = [candidate for candidate in candidates if candidate > start_page]
        return min(valid) if valid else total_pages + 1

    accounts_pages = (
        list(range(accounts_start, section_end(accounts_start, collections_start, public_records_start, inquiries_start, rights_start)))
        if accounts_start <= total_pages
        else []
    )
    collection_pages = (
        list(range(collections_start, section_end(collections_start, public_records_start, inquiries_start, rights_start)))
        if collections_start <= total_pages
        else []
    )
    public_record_pages = (
        list(range(public_records_start, section_end(public_records_start, inquiries_start, rights_start)))
        if public_records_start <= total_pages
        else []
    )
    inquiry_pages = list(range(inquiries_start, rights_start)) if inquiries_start <= total_pages and rights_start > inquiries_start else []
    return {
        "reportConfirmationDetails": report_page,
        "summary": [summary_page] if summary_page else [],
        "personalInformation": [summary_page] if summary_page else [],
        "accounts": accounts_pages,
        "collections": collection_pages,
        "publicRecords": public_record_pages,
        "inquiries": inquiry_pages,
    }


def clean_field_value(value: str) -> str:
    return normalize_spaces(value).strip("| ").strip()


def normalize_phone_number(value: str) -> str:
    digits = re.sub(r"\D", "", str(value or ""))
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    if len(digits) == 10:
        return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
    return normalize_spaces(value)


def extract_phone_numbers(value: str) -> List[str]:
    if not value:
        return []
    matches = [normalize_phone_number(match.group(0)) for match in PHONE_PATTERN.finditer(value)]
    return unique_preserve_order([match for match in matches if match])


def split_phone_suffix(value: str) -> Tuple[str, List[str]]:
    matches = list(PHONE_PATTERN.finditer(value or ""))
    if not matches:
        return normalize_spaces(value), []

    cleaned_parts: List[str] = []
    cursor = 0
    for match in matches:
        cleaned_parts.append(value[cursor : match.start()])
        cursor = match.end()
    cleaned_parts.append(value[cursor:])

    cleaned_value = normalize_spaces(" ".join(cleaned_parts).replace("|", " ").strip(", "))
    phone_numbers = extract_phone_numbers(value)
    return cleaned_value, phone_numbers


def extract_report_confirmation(page_artifacts: List[Any], page_numbers: List[int]) -> Dict[str, Any]:
    if not page_numbers:
        return {
            "consumerName": "",
            "confirmationNumber": "",
            "reportDate": "",
        }

    page = page_artifacts[page_numbers[0] - 1]
    lines = cleaned_page_lines(page)
    text = str(getattr(page, "text_layer", "") or "")
    consumer_name = lines[1] if len(lines) > 1 and canonical_heading(lines[0]) == "credit report" else ""
    confirmation_match = re.search(r"Confirmation #\s*([A-Z0-9-]+)", text, re.IGNORECASE)
    report_date_match = re.search(r"Date:\s*([A-Z][a-z]+ \d{1,2}, \d{4})", text, re.IGNORECASE)

    return {
        "consumerName": normalize_spaces(consumer_name),
        "confirmationNumber": normalize_spaces(confirmation_match.group(1)) if confirmation_match else "",
        "reportDate": normalize_spaces(report_date_match.group(1)) if report_date_match else "",
    }


def extract_summary(page_artifacts: List[Any], page_numbers: List[int]) -> Dict[str, Any]:
    if not page_numbers:
        return {
            "reportDate": "",
            "averageAccountAge": "",
            "lengthOfCreditHistory": "",
            "oldestAccount": {"accountName": "", "openDate": ""},
            "mostRecentAccount": {"accountName": "", "openDate": ""},
        }

    text = page_text(page_artifacts[page_numbers[0] - 1])

    def extract_line(label: str) -> str:
        match = re.search(rf"{re.escape(label)}\s+(.+)", text, re.IGNORECASE)
        return normalize_spaces(match.group(1)) if match else ""

    def extract_account_line(label: str) -> Dict[str, str]:
        match = re.search(rf"{re.escape(label)}\s+(.+?)\s+\|\s+(.+)", text, re.IGNORECASE)
        if not match:
            return {"accountName": "", "openDate": ""}
        return {
            "accountName": normalize_spaces(match.group(1)),
            "openDate": normalize_spaces(match.group(2)),
        }

    return {
        "reportDate": extract_line("Report Date"),
        "averageAccountAge": extract_line("Average Account Age"),
        "lengthOfCreditHistory": extract_line("Length of Credit History"),
        "oldestAccount": extract_account_line("Oldest Account"),
        "mostRecentAccount": extract_account_line("Most Recent Account"),
    }


def extract_personal_information(page_artifacts: List[Any], page_numbers: List[int]) -> Dict[str, Any]:
    if not page_numbers:
        return {
            "name": "",
            "currentAddress": "",
            "socialSecurityNumber": "",
            "dateOfBirth": "",
            "formerNames": [],
            "employmentInformation": [],
            "consumerFileNotices": [],
            "formerAddresses": [],
            "formerPhoneNumbers": [],
            "consumerStatement": "",
        }

    page = page_artifacts[page_numbers[0] - 1]
    lines = cleaned_page_lines(page)
    text = str(getattr(page, "text_layer", "") or "")

    ssn_index = next((index for index, line in enumerate(lines) if "Social Security Number:" in line), -1)
    name = lines[ssn_index - 2] if ssn_index >= 2 else ""
    current_address = lines[ssn_index - 1] if ssn_index >= 1 else ""
    ssn_match = re.search(r"Social Security Number:\s*([A-Z0-9X*-]+)", text, re.IGNORECASE)
    dob_match = re.search(r"Date of Birth:\s*([0-9/]+)", text, re.IGNORECASE)
    label_line_one = next((line for line in lines if line.startswith("Former Name(s):")), "")
    label_line_two = next((line for line in lines if line.startswith("Former Address(es):")), "")
    consumer_statement = ""
    if "Consumer Statement:" in lines:
        statement_index = lines.index("Consumer Statement:")
        if statement_index + 1 < len(lines):
            consumer_statement = normalize_spaces(lines[statement_index + 1])

    label_one_values: List[str] = []
    label_two_first_line = ""
    label_two_block_lines: List[str] = []
    if label_line_one:
        idx = lines.index(label_line_one)
        if idx + 1 < len(lines):
            label_one_values = normalize_spaces(lines[idx + 1]).split(" ", 2)
    if label_line_two:
        idx = lines.index(label_line_two)
        end_idx = lines.index("Consumer Statement:") if "Consumer Statement:" in lines else len(lines)
        label_two_block_lines = [normalize_spaces(line) for line in lines[idx + 1 : end_idx] if normalize_spaces(line)]
        if label_two_block_lines:
            label_two_first_line = label_two_block_lines[0]

    former_names_raw = label_one_values[0] if len(label_one_values) >= 1 else ""
    employment_raw = label_one_values[1] if len(label_one_values) >= 2 else ""
    consumer_notice_raw = label_one_values[2] if len(label_one_values) >= 3 else ""
    former_address_raw, first_line_phone_numbers = split_phone_suffix(label_two_first_line)
    former_phone_numbers_raw = extract_phone_numbers(" ".join(label_two_block_lines)) or first_line_phone_numbers

    def normalize_optional_values(values: List[str]) -> List[str]:
        normalized_values = [normalize_spaces(value) for value in values if normalize_spaces(value)]
        return [
            value
            for value in unique_preserve_order(normalized_values)
            if value.lower() not in {"none", "no statement on file."}
        ]

    return {
        "name": normalize_spaces(name),
        "currentAddress": normalize_spaces(current_address),
        "socialSecurityNumber": normalize_spaces(ssn_match.group(1)) if ssn_match else "",
        "dateOfBirth": normalize_spaces(dob_match.group(1)) if dob_match else "",
        "formerNames": normalize_optional_values([former_names_raw]),
        "employmentInformation": normalize_optional_values([employment_raw]),
        "consumerFileNotices": normalize_optional_values([consumer_notice_raw]),
        "formerAddresses": normalize_optional_values([former_address_raw]),
        "formerPhoneNumbers": normalize_optional_values(former_phone_numbers_raw),
        "consumerStatement": consumer_statement,
    }


def create_month_row(year: str = "-") -> Dict[str, str]:
    row = {"year": year}
    for month in MONTH_KEYS:
        row[month] = "-"
    return row


def lines_from_block(block: Dict[str, Any]) -> List[str]:
    return [normalize_spaces(line) for line in str(block.get("text") or "").splitlines() if normalize_spaces(line)]


def normalize_row_text(row: Dict[str, Any]) -> str:
    return normalize_spaces(row.get("text", ""))


def visible_account_rows(page: Any) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for row in getattr(page, "layout_rows", []) or []:
        text = normalize_row_text(row)
        lowered = text.lower()
        if not text or FOOTER_SKIP_PATTERN.search(text):
            continue
        if lowered.startswith(HEADER_SKIP_PREFIXES):
            continue
        if lowered == "your credit report":
            continue
        if canonical_heading(text) == "credit accounts":
            continue
        if lowered.startswith("this includes all types of credit accounts"):
            continue
        rows.append(row)
    return rows


def is_possible_account_heading(line: str) -> bool:
    lowered = canonical_heading(line)
    if not line or ":" in line:
        return False
    if "|" in line or "$" in line:
        return False
    if line == line.lower():
        return False
    if lowered in ACCOUNT_HEADING_IGNORE:
        return False
    if lowered.startswith(("year", "paid on time", "company information", "prepared for", "date")):
        return False
    if re.fullmatch(r"\d{4}", line):
        return False
    return True


def split_account_row_blocks(rows: List[Dict[str, Any]]) -> List[List[Dict[str, Any]]]:
    account_number_indices = [index for index, row in enumerate(rows) if "Account Number:" in normalize_row_text(row)]
    if not account_number_indices:
        return []

    heading_indices: List[int] = []
    for position, account_index in enumerate(account_number_indices):
        previous_account_index = account_number_indices[position - 1] if position > 0 else -1
        heading_index = account_index
        for candidate_index in range(account_index - 1, previous_account_index, -1):
            candidate_text = normalize_row_text(rows[candidate_index])
            if not is_possible_account_heading(candidate_text):
                continue
            heading_index = candidate_index
            break
        heading_indices.append(heading_index)

    blocks: List[List[Dict[str, Any]]] = []
    for offset, start in enumerate(heading_indices):
        end = heading_indices[offset + 1] if offset + 1 < len(heading_indices) else len(rows)
        blocks.append(rows[start:end])
    return blocks


def extract_account_fields(block_flat: str) -> Dict[str, str]:
    markers: List[Tuple[int, int, Optional[str]]] = []
    for label, key in ACCOUNT_FIELD_LABELS:
        marker = f"{label}:"
        match = re.search(re.escape(marker), block_flat, re.IGNORECASE)
        if match:
            markers.append((match.start(), match.end(), key))
    for marker_text in ACCOUNT_SECTION_MARKERS:
        match = re.search(rf"\b{re.escape(marker_text)}\b", block_flat, re.IGNORECASE)
        if match:
            markers.append((match.start(), match.end(), None))

    result: Dict[str, str] = {}
    ordered = sorted(markers, key=lambda item: item[0])
    for index, (_, end, key) in enumerate(ordered):
        if key is None:
            continue
        next_start = len(block_flat)
        for future_start, _, _ in ordered[index + 1 :]:
            if future_start >= end:
                next_start = future_start
                break
        result[key] = clean_field_value(block_flat[end:next_start])
    return result


def month_key_from_label(value: str) -> Optional[str]:
    cleaned = canonical_heading(value)
    if not cleaned:
        return None
    return MONTH_LABEL_TO_KEY.get(cleaned[:3])


def normalize_payment_history_code(value: str) -> str:
    token = re.sub(r"[^A-Za-z0-9]", "", value or "").upper()
    if not token:
        return "-"
    if token in PAYMENT_STATUS_CODES:
        return token
    if token.startswith("COL"):
        return "COL"
    if token.startswith("CO"):
        return "CO"
    if token.startswith("OK") or token in {"0K", "DK", "GK"}:
        return "OK"
    if token.startswith("TNT") or token == "TN":
        return "TNT"
    if token in {"3", "30"}:
        return "30"
    if token in {"6", "60"}:
        return "60"
    if token in {"9", "90"}:
        return "90"
    if token.startswith("12"):
        return "120"
    if token.startswith("15"):
        return "150"
    if token.startswith("18"):
        return "180"
    if token in {"B", "C", "R", "F", "V", "X"}:
        return token
    return "-"


def create_history_evidence_row(year: str, page_number: int) -> Dict[str, Any]:
    return {
        "year": year,
        "months": {
            month: {
                "value": "-",
                "pageNumber": page_number,
                "sourceType": "blank",
            }
            for month in MONTH_KEYS
        },
    }


def set_history_cell(
    history_rows: Dict[str, Dict[str, str]],
    history_evidence: Dict[str, Dict[str, Any]],
    year: Optional[str],
    month: Optional[str],
    value: str,
    page_number: int,
    source_type: str,
    bbox: Optional[Dict[str, float]] = None,
) -> None:
    if not year or not month or year not in history_rows or month not in MONTH_KEYS:
        return
    history_rows[year][month] = value
    cell: Dict[str, Any] = {
        "value": value,
        "pageNumber": page_number,
        "sourceType": source_type,
    }
    # Additive geometry (2026-07-12): per-cell PDF-point bbox enables
    # meta.accountHistoryEvidence parity with equifax_old so the dispute
    # evidence generator can highlight measured cells. Existing keys unchanged.
    if bbox:
        cell["bbox"] = bbox
    history_evidence[year]["months"][month] = cell


def detect_green_checkmark(crop: "Image.Image") -> bool:
    analysis_crop = crop.convert("RGB")
    analysis_crop.thumbnail((96, 48))
    width, height = analysis_crop.size
    if width <= 0 or height <= 0:
        return False

    green_pixels = 0
    min_x = width
    min_y = height
    max_x = -1
    max_y = -1

    for y in range(height):
        for x in range(width):
            red, green, blue = analysis_crop.getpixel((x, y))
            if green >= 105 and green >= red + 15 and green >= blue + 15:
                green_pixels += 1
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)

    if green_pixels < 6 or max_x < min_x or max_y < min_y:
        return False

    bbox_width = max_x - min_x + 1
    bbox_height = max_y - min_y + 1
    total_pixels = width * height
    coverage = green_pixels / max(total_pixels, 1)
    bbox_coverage = green_pixels / max(bbox_width * bbox_height, 1)

    if bbox_width < max(3, int(width * 0.1)) or bbox_height < max(3, int(height * 0.15)):
        return False
    if coverage < 0.002 or coverage > 0.18:
        return False
    if bbox_coverage > 0.6:
        return False
    return True


def ocr_payment_history_cell(page: Any, crop_box_pdf: Tuple[float, float, float, float]) -> Tuple[str, str]:
    if Image is None or ImageOps is None:
        return "-", "blank"
    image_path = Path(getattr(page, "image_path", "") or "")
    if not image_path.exists() or getattr(page, "page_width", 0) <= 0 or getattr(page, "page_height", 0) <= 0:
        return "-", "blank"

    with Image.open(image_path) as image:
        scale_x = image.width / max(float(page.page_width), 1.0)
        scale_y = image.height / max(float(page.page_height), 1.0)
        left = max(int(crop_box_pdf[0] * scale_x), 0)
        top = max(int(crop_box_pdf[1] * scale_y), 0)
        right = min(int(crop_box_pdf[2] * scale_x), image.width)
        bottom = min(int(crop_box_pdf[3] * scale_y), image.height)
        if right <= left or bottom <= top:
            return "-", "blank"

        crop = image.crop((left, top, right, bottom))
        if detect_green_checkmark(crop):
            return "OK", "image_checkmark"

        crop = ImageOps.grayscale(crop)
        crop = ImageOps.autocontrast(crop)
        crop = crop.resize((max(crop.width * 5, 20), max(crop.height * 5, 20)))
        crop = crop.point(lambda value: 255 if value > 170 else 0)

        with tempfile.TemporaryDirectory(dir=str(image_path.parent)) as temp_dir:
            crop_path = Path(temp_dir) / "cell.png"
            output_base = Path(temp_dir) / "cell-ocr"
            crop.save(crop_path)
            command = [
                "tesseract",
                str(crop_path),
                str(output_base),
                "--psm",
                "10",
                "-c",
                "tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ",
            ]
            completed = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            if completed.returncode != 0:
                return "-", "blank"
            text_path = output_base.with_suffix(".txt")
            if not text_path.exists():
                return "-", "blank"
            raw = text_path.read_text(encoding="utf-8", errors="ignore").strip()
            value = normalize_payment_history_code(raw)
            return value, ("ocr" if value != "-" else "blank")


def year_block_from_section(section_rows: List[Dict[str, Any]]) -> Tuple[List[str], Optional[Dict[str, Any]]]:
    for row in section_rows:
        for block in row.get("blocks", []):
            lines = lines_from_block(block)
            years = [line for line in lines if re.fullmatch(r"\d{4}", line)]
            if years and any(canonical_heading(line) == "year" for line in lines):
                return years, block
    for row in section_rows:
        text = normalize_row_text(row)
        years = re.findall(r"\b(19|20)\d{2}\b", text)
        if years:
            return [match for match in re.findall(r"\b\d{4}\b", text)], None
    return [], None


def year_ranges_from_block(year_block: Optional[Dict[str, Any]], years: List[str], fallback_top: float, fallback_bottom: float) -> Dict[str, Tuple[float, float]]:
    if year_block:
        lines = lines_from_block(year_block)
        if lines:
            height = float(year_block["bbox"]["yMax"]) - float(year_block["bbox"]["yMin"])
            line_height = height / max(len(lines), 1)
            ranges: Dict[str, Tuple[float, float]] = {}
            for index, line in enumerate(lines):
                if line in years:
                    top = float(year_block["bbox"]["yMin"]) + (index * line_height)
                    bottom = float(year_block["bbox"]["yMin"]) + ((index + 1) * line_height)
                    ranges[line] = (top, bottom)
            if len(ranges) == len(years):
                return ranges

    if not years or fallback_bottom <= fallback_top:
        return {}

    row_height = (fallback_bottom - fallback_top) / max(len(years), 1)
    return {
        year: (fallback_top + (index * row_height), fallback_top + ((index + 1) * row_height))
        for index, year in enumerate(years)
    }


def year_center_map(year_ranges: Dict[str, Tuple[float, float]]) -> Dict[str, float]:
    return {
        year: (row_top + row_bottom) / 2.0
        for year, (row_top, row_bottom) in year_ranges.items()
        if row_bottom > row_top
    }


def nearest_year_for_y(target_y: float, year_ranges: Dict[str, Tuple[float, float]]) -> Optional[str]:
    if not year_ranges:
        return None

    for year, (row_top, row_bottom) in year_ranges.items():
        if row_top <= target_y <= row_bottom:
            return year

    centers = year_center_map(year_ranges)
    if not centers:
        return None
    return min(centers, key=lambda year: abs(centers[year] - target_y))


def nearest_key_by_center(target_x: float, anchors: Dict[str, Dict[str, Any]]) -> Optional[str]:
    if not anchors:
        return None
    return min(anchors, key=lambda key: abs(float(anchors[key]["xCenter"]) - target_x))


def month_spans_from_blocks(month_blocks: Dict[str, Dict[str, Any]]) -> Dict[str, Tuple[float, float]]:
    ordered = sorted(
        ((month, block) for month, block in month_blocks.items() if block),
        key=lambda entry: float(entry[1]["bbox"]["xMin"]),
    )
    if len(ordered) != 12:
        return {}

    spans: Dict[str, Tuple[float, float]] = {}
    for index, (month, block) in enumerate(ordered):
        bbox = block["bbox"]
        left = float(bbox["xMin"])
        right = float(bbox["xMax"])
        if index > 0:
            prev_bbox = ordered[index - 1][1]["bbox"]
            left = (float(prev_bbox["xMax"]) + float(bbox["xMin"])) / 2.0
        if index < len(ordered) - 1:
            next_bbox = ordered[index + 1][1]["bbox"]
            right = (float(bbox["xMax"]) + float(next_bbox["xMin"])) / 2.0
        spans[month] = (left, right)
    return spans


def month_spans_from_table(table: Dict[str, Any]) -> Dict[str, Tuple[float, float]]:
    columns = table.get("columns") or []
    if not columns:
        return {}

    month_indices: Dict[str, int] = {}
    for row in (table.get("rows") or [])[:2]:
        for index, cell in enumerate(row):
            month_key = month_key_from_label(str(cell))
            if month_key and month_key not in month_indices:
                month_indices[month_key] = index
    if len(month_indices) != 12:
        return {}

    bbox = table.get("bbox") or {}
    boundaries = [float(bbox.get("xMin") or columns[0])]
    for index in range(1, len(columns)):
        boundaries.append((float(columns[index - 1]) + float(columns[index])) / 2.0)
    boundaries.append(float(bbox.get("xMax") or columns[-1]))

    spans: Dict[str, Tuple[float, float]] = {}
    for month, index in month_indices.items():
        if index + 1 < len(boundaries):
            spans[month] = (float(boundaries[index]), float(boundaries[index + 1]))
    return spans


def parse_payment_history(section_rows: List[Dict[str, Any]], page: Any) -> Tuple[List[Dict[str, str]], List[Dict[str, Any]]]:
    if not section_rows:
        return [], []

    years, year_block = year_block_from_section(section_rows)
    if not years:
        return [], []

    next_heading_y = min(
        (float(row["bbox"]["yMin"]) for row in section_rows if canonical_heading(normalize_row_text(row)) == "24 month history"),
        default=float(page.page_height),
    )
    legend_top = min(
        (
            float(row["bbox"]["yMin"])
            for row in section_rows
            if "paid on time" in normalize_row_text(row).lower() or "days past due" in normalize_row_text(row).lower()
        ),
        default=next_heading_y,
    )

    month_blocks: Dict[str, Dict[str, Any]] = {}
    for row in section_rows:
        if float(row["bbox"]["yMin"]) >= legend_top:
            continue
        for block in row.get("blocks", []):
            lines = lines_from_block(block)
            if not lines:
                continue
            month_key = month_key_from_label(lines[0])
            if month_key:
                month_blocks[month_key] = block

    spans = month_spans_from_blocks(month_blocks)
    payment_table = next(
        (
            table
            for table in getattr(page, "layout_tables", []) or []
            if len(table.get("columns") or []) >= 13
            and float((table.get("bbox") or {}).get("yMin") or 0.0) >= float(section_rows[0]["bbox"]["yMin"]) - 2.0
            and float((table.get("bbox") or {}).get("yMax") or 0.0) <= next_heading_y + 8.0
        ),
        None,
    )
    if len(spans) != 12 and payment_table:
        spans = month_spans_from_table(payment_table)

    page_number = int(getattr(page, "page_number", 0) or 0)
    history_rows = {year: create_month_row(year) for year in years}
    history_evidence = {
        year: create_history_evidence_row(year, page_number)
        for year in years
    }
    year_ranges = year_ranges_from_block(year_block, years, float(section_rows[0]["bbox"]["yMax"]), legend_top)

    def month_cell_bbox(month_key: str, block: Dict[str, Any], line_center: float, line_height: float) -> Dict[str, float]:
        span = spans.get(month_key)
        x_min = float(span[0]) if span else float(block["bbox"]["xMin"])
        x_max = float(span[1]) if span else float(block["bbox"]["xMax"])
        half = max(line_height, 4.0) / 2.0
        return {"xMin": x_min, "xMax": x_max, "yMin": line_center - half, "yMax": line_center + half}

    for month_key, block in month_blocks.items():
        lines = lines_from_block(block)
        if len(lines) <= 1:
            continue
        line_height = (float(block["bbox"]["yMax"]) - float(block["bbox"]["yMin"])) / max(len(lines), 1)
        for line_index, line in enumerate(lines[1:], start=1):
            value = normalize_payment_history_code(line)
            if value == "-":
                continue
            line_center = float(block["bbox"]["yMin"]) + ((line_index + 0.5) * line_height)
            year = nearest_year_for_y(line_center, year_ranges)
            if year and history_rows[year][month_key] == "-":
                set_history_cell(
                    history_rows, history_evidence, year, month_key, value, page_number, "text",
                    bbox=month_cell_bbox(month_key, block, line_center, line_height),
                )

    month_centers = {
        month: (float(block["bbox"]["xMin"]) + float(block["bbox"]["xMax"])) / 2.0
        for month, block in month_blocks.items()
    }
    for row in section_rows:
        row_text = normalize_row_text(row).lower()
        if "paid on time" in row_text or "days past due" in row_text:
            continue
        for block in row.get("blocks", []):
            if block is year_block or block in month_blocks.values():
                continue
            if float(block["bbox"]["yMin"]) >= legend_top:
                continue
            lines = lines_from_block(block)
            if not lines:
                continue
            values = [normalize_payment_history_code(line) for line in lines if normalize_payment_history_code(line) != "-"]
            if not values:
                continue
            month_key = nearest_key_by_center((float(block["bbox"]["xMin"]) + float(block["bbox"]["xMax"])) / 2.0, {
                month: {"xCenter": center} for month, center in month_centers.items()
            })
            if not month_key:
                continue
            line_height = (float(block["bbox"]["yMax"]) - float(block["bbox"]["yMin"])) / max(len(lines), 1)
            for line_index, line in enumerate(lines):
                value = normalize_payment_history_code(line)
                if value == "-":
                    continue
                line_center = float(block["bbox"]["yMin"]) + ((line_index + 0.5) * line_height)
                year = nearest_year_for_y(line_center, year_ranges)
                if year and history_rows[year][month_key] == "-":
                    set_history_cell(
                        history_rows, history_evidence, year, month_key, value, page_number, "text",
                        bbox=month_cell_bbox(month_key, block, line_center, line_height),
                    )

    if spans:
        for year in years:
            row_top, row_bottom = year_ranges.get(year, (0.0, 0.0))
            if row_bottom <= row_top:
                continue
            for month in MONTH_KEYS:
                if history_rows[year][month] != "-":
                    continue
                span = spans.get(month)
                if not span:
                    continue
                value, source_type = ocr_payment_history_cell(
                    page,
                    (span[0], row_top, span[1], row_bottom),
                )
                if value != "-":
                    set_history_cell(
                        history_rows, history_evidence, year, month, value, page_number, source_type,
                        bbox={"xMin": float(span[0]), "xMax": float(span[1]), "yMin": float(row_top), "yMax": float(row_bottom)},
                    )

    # Blank cells still get measured geometry (month span x year band) so absence
    # is highlightable downstream — mirrors equifax_old's column-boundary fallback.
    if spans:
        for year in years:
            row_top, row_bottom = year_ranges.get(year, (0.0, 0.0))
            if row_bottom <= row_top:
                continue
            for month in MONTH_KEYS:
                cell = history_evidence[year]["months"][month]
                if cell.get("bbox"):
                    continue
                span = spans.get(month)
                if not span:
                    continue
                cell["bbox"] = {"xMin": float(span[0]), "xMax": float(span[1]), "yMin": float(row_top), "yMax": float(row_bottom)}

    return [history_rows[year] for year in years], [history_evidence[year] for year in years]


def map_month24_label(text: str) -> Optional[Tuple[str, str]]:
    normalized = canonical_heading(text)
    for label, mapping in MONTH24_LABEL_MAP.items():
        if label in normalized:
            return mapping
    return None


def month_centers_from_block(month_block: Dict[str, Any]) -> Tuple[List[str], List[float]]:
    lines = lines_from_block(month_block)
    month_tokens = [line for line in lines if MONTH_TOKEN_PATTERN.match(line)]
    if not month_tokens:
        return [], []

    bbox = month_block["bbox"]
    height = float(bbox["yMax"]) - float(bbox["yMin"])
    line_height = height / max(len(lines), 1)
    centers: List[float] = []
    for index, line in enumerate(lines):
        if MONTH_TOKEN_PATTERN.match(line):
            centers.append(float(bbox["yMin"]) + ((index + 0.5) * line_height))
    return month_tokens, centers


def extract_labeled_field_lines(lines: List[str]) -> Tuple[Optional[str], Optional[str], List[int]]:
    for line_count in range(min(4, len(lines)), 0, -1):
        label = map_month24_label(" ".join(lines[:line_count]))
        if label:
            return label[0], label[1], list(range(line_count, len(lines)))
    return None, None, list(range(len(lines)))


def token_to_year_month(token: str) -> Optional[Tuple[str, str]]:
    match = re.match(r"^(?P<month>\d{2})/(?P<year>\d{2})$", token)
    if not match:
        return None
    month_key = MONTH_NUMBER_TO_KEY.get(match.group("month"))
    if not month_key:
        return None
    return (f"20{match.group('year')}", month_key)


def month_values_to_rows(month_tokens: List[str], values: List[str]) -> List[Dict[str, str]]:
    rows_by_year: Dict[str, Dict[str, str]] = {}
    year_order: List[str] = []
    for index, token in enumerate(month_tokens):
        mapped = token_to_year_month(token)
        if not mapped:
            continue
        year, month_key = mapped
        if year not in rows_by_year:
            rows_by_year[year] = create_month_row(year)
            year_order.append(year)
        row_value = normalize_spaces(values[index]) if index < len(values) else ""
        rows_by_year[year][month_key] = row_value or "-"
    return [rows_by_year[year] for year in year_order]


def parse_month24_history(section_rows: List[Dict[str, Any]], page: Any) -> Tuple[Dict[str, Any], Dict[str, List[Dict[str, Any]]]]:
    if not section_rows:
        return {"sections": []}, {}

    month_block = next(
        (
            block
            for row in section_rows
            for block in row.get("blocks", [])
            if len([line for line in lines_from_block(block) if MONTH_TOKEN_PATTERN.match(line)]) >= 6
        ),
        None,
    )
    if not month_block:
        return {"sections": []}, {}

    month_tokens, month_centers = month_centers_from_block(month_block)
    if not month_tokens or not month_centers:
        return {"sections": []}, {}

    label_row = next(
        (
            row
            for row in section_rows
            if "balance" in normalize_row_text(row).lower() and "narrative codes" in normalize_row_text(row).lower()
        ),
        None,
    )
    field_anchors: Dict[str, Dict[str, Any]] = {}
    if label_row:
        for block in label_row.get("blocks", []):
            label = map_month24_label(block.get("text", ""))
            if not label:
                continue
            field_anchors[label[0]] = {
                "label": label[1],
                "xCenter": (float(block["bbox"]["xMin"]) + float(block["bbox"]["xMax"])) / 2.0,
            }

    field_values = {field_key: ["-"] * len(month_tokens) for field_key, _ in MONTH24_FIELD_ORDER}
    page_number = int(getattr(page, "page_number", 0) or 0)
    field_evidence = {
        field_key: [
            create_history_evidence_row(year, page_number)
            for year in [row["year"] for row in month_values_to_rows(month_tokens, ["-"] * len(month_tokens))]
        ]
        for field_key, _ in MONTH24_FIELD_ORDER
    }
    evidence_row_maps = {
        field_key: {row["year"]: row for row in rows}
        for field_key, rows in field_evidence.items()
    }
    value_row_maps = {
        field_key: {row["year"]: row for row in month_values_to_rows(month_tokens, field_values[field_key])}
        for field_key, _ in MONTH24_FIELD_ORDER
    }

    for row in section_rows:
        if row is label_row:
            continue
        row_text = normalize_row_text(row)
        if canonical_heading(row_text).startswith("narrative code"):
            continue
        for block in row.get("blocks", []):
            if block is month_block:
                continue
            lines = lines_from_block(block)
            if not lines:
                continue

            field_key, _, value_indexes = extract_labeled_field_lines(lines)
            if not field_key:
                field_key = nearest_key_by_center(
                    (float(block["bbox"]["xMin"]) + float(block["bbox"]["xMax"])) / 2.0,
                    field_anchors,
                )
            if not field_key:
                continue

            line_height = (float(block["bbox"]["yMax"]) - float(block["bbox"]["yMin"])) / max(len(lines), 1)
            for line_index in value_indexes:
                value = normalize_spaces(lines[line_index])
                if not value:
                    continue
                if map_month24_label(value):
                    continue
                y_center = float(block["bbox"]["yMin"]) + ((line_index + 0.5) * line_height)
                month_index = min(range(len(month_centers)), key=lambda idx: abs(month_centers[idx] - y_center))
                mapped = token_to_year_month(month_tokens[month_index])
                if not mapped:
                    continue
                year, month_key = mapped
                if value_row_maps[field_key][year][month_key] == "-":
                    half_line = max(line_height, 4.0) / 2.0
                    set_history_cell(
                        value_row_maps[field_key],
                        evidence_row_maps[field_key],
                        year,
                        month_key,
                        value,
                        page_number,
                        "text",
                        bbox={
                            "xMin": float(block["bbox"]["xMin"]),
                            "xMax": float(block["bbox"]["xMax"]),
                            "yMin": y_center - half_line,
                            "yMax": y_center + half_line,
                        },
                    )

    sections = []
    for field_key, label in MONTH24_FIELD_ORDER:
        sections.append(
            {
                "key": field_key,
                "label": label,
                "rows": [value_row_maps[field_key][row["year"]] for row in field_evidence[field_key]],
            }
        )

    return {
        "sections": sections,
    }, {f"month24:{field_key}": rows for field_key, rows in field_evidence.items()}


def extract_narrative_codes(block_rows: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    header_index = next(
        (
            index
            for index, row in enumerate(block_rows)
            if "narrative code description" in canonical_heading(normalize_row_text(row))
        ),
        -1,
    )
    if header_index == -1 or header_index + 1 >= len(block_rows):
        return []

    data_row = block_rows[header_index + 1]
    blocks = data_row.get("blocks", [])
    if len(blocks) < 2:
        return []

    codes = re.findall(r"\b\d{3}\b", str(blocks[0].get("text") or ""))
    description = normalize_spaces(blocks[1].get("text") or "")
    if not codes or not description:
        return []
    return [{"code": code, "description": description} for code in codes]


def parse_account_block(block_rows: List[Dict[str, Any]], page: Any) -> Dict[str, Any]:
    heading = normalize_row_text(block_rows[0]) if block_rows else ""
    is_closed = heading.lower().endswith("- closed")
    account_name = heading[:-9].strip() if is_closed else heading
    block_flat = normalize_spaces("\n".join(normalize_row_text(row) for row in block_rows))
    field_values = extract_account_fields(block_flat)

    account_number_row_index = next(
        (index for index, row in enumerate(block_rows) if "Account Number:" in normalize_row_text(row)),
        len(block_rows),
    )
    details_row_start = next(
        (
            index
            for index, row in enumerate(block_rows[1:], start=1)
            if "Date Opened:" in normalize_row_text(row)
            or canonical_heading(normalize_row_text(row)) in {"payment history", "24 month history"}
        ),
        len(block_rows),
    )
    contact_rows = block_rows[1:details_row_start]
    contact_text = normalize_spaces(" ".join(normalize_row_text(row) for row in contact_rows))

    stop_positions = [
        contact_text.find(marker)
        for marker in ACCOUNT_CONTACT_STOP_MARKERS
        if marker in contact_text
    ]
    first_stop = min((position for position in stop_positions if position >= 0), default=-1)
    contact_prefix = contact_text[:first_stop] if first_stop != -1 else contact_text
    if not contact_prefix and account_number_row_index < len(block_rows):
        account_header_row = normalize_row_text(block_rows[account_number_row_index])
        stop_positions = [
            account_header_row.find(marker)
            for marker in ACCOUNT_CONTACT_STOP_MARKERS
            if marker in account_header_row
        ]
        first_stop = min((position for position in stop_positions if position >= 0), default=-1)
        if first_stop != -1:
            contact_prefix = account_header_row[:first_stop]
    phone_match = PHONE_PATTERN.search(contact_prefix)
    phone_number = normalize_phone_number(phone_match.group(0)) if phone_match else ""
    address = normalize_spaces(re.sub(PHONE_PATTERN, "", contact_prefix).replace("|", " ").strip(", "))

    payment_history_start = next(
        (index for index, row in enumerate(block_rows) if canonical_heading(normalize_row_text(row)) == "payment history"),
        -1,
    )
    month24_start = next(
        (index for index, row in enumerate(block_rows) if canonical_heading(normalize_row_text(row)) == "24 month history"),
        -1,
    )
    narrative_start = next(
        (
            index
            for index, row in enumerate(block_rows)
            if canonical_heading(normalize_row_text(row)).startswith("narrative code")
        ),
        len(block_rows),
    )

    payment_history_rows: List[Dict[str, str]] = []
    payment_history_evidence: List[Dict[str, Any]] = []
    if payment_history_start != -1:
        payment_history_rows, payment_history_evidence = parse_payment_history(
            block_rows[
                payment_history_start + 1 : (
                    month24_start
                    if month24_start != -1 and month24_start > payment_history_start
                    else narrative_start
                )
            ],
            page,
        )
    month24_rows = []
    if month24_start != -1:
        month24_end = next(
            (
                index
                for index in range(month24_start + 1, len(block_rows))
                if canonical_heading(normalize_row_text(block_rows[index])).startswith("narrative code")
            ),
            len(block_rows),
        )
        month24_rows = block_rows[month24_start + 1 : month24_end]
    month24_history, month24_history_evidence = parse_month24_history(month24_rows, page)

    history_evidence: Dict[str, Any] = {}
    if payment_history_evidence:
        history_evidence["paymentHistory"] = payment_history_evidence
    if month24_history_evidence:
        history_evidence.update(month24_history_evidence)

    account: Dict[str, Any] = {
        "accountName": account_name,
        "accountNumber": field_values.get("accountNumber", ""),
        "isClosed": is_closed,
        "address": address,
        "phoneNumber": phone_number,
        "owner": field_values.get("owner", ""),
        "loanAccountType": field_values.get("loanAccountType", ""),
        "status": field_values.get("status", ""),
        "dateReported": field_values.get("dateReported", ""),
        "balance": field_values.get("balance", ""),
        "creditLimit": field_values.get("creditLimit", ""),
        "highCredit": field_values.get("highCredit", ""),
        "dateOpened": field_values.get("dateOpened", ""),
        "dateOfFirstDelinquency": field_values.get("dateOfFirstDelinquency", ""),
        "termsFrequency": field_values.get("termsFrequency", ""),
        "dateOfLastActivity": field_values.get("dateOfLastActivity", ""),
        "dateMajorDelinquencyFirstReported": field_values.get("dateMajorDelinquencyFirstReported", ""),
        "monthsReviewed": field_values.get("monthsReviewed", ""),
        "scheduledPaymentAmount": field_values.get("scheduledPaymentAmount", ""),
        "amountPastDue": field_values.get("amountPastDue", ""),
        "deferredPaymentStartDate": field_values.get("deferredPaymentStartDate", ""),
        "actualPaymentAmount": field_values.get("actualPaymentAmount", ""),
        "chargeOffAmount": field_values.get("chargeOffAmount", ""),
        "balloonPaymentAmount": field_values.get("balloonPaymentAmount", ""),
        "dateOfLastPayment": field_values.get("dateOfLastPayment", ""),
        "dateClosed": field_values.get("dateClosed", ""),
        "balloonPaymentDate": field_values.get("balloonPaymentDate", ""),
        "termDuration": field_values.get("termDuration", ""),
        "activityDesignator": field_values.get("activityDesignator", ""),
        "narrativeCodeList": field_values.get("narrativeCodeList", ""),
        "paymentHistory": payment_history_rows,
        "month24History": month24_history,
        "narrativeCodes": extract_narrative_codes(block_rows),
        "sourcePages": [page.page_number],
        "_sourcePages": [page.page_number],
    }
    if history_evidence:
        account["_historyEvidence"] = history_evidence
    return account


def extract_accounts(page_artifacts: List[Any], page_numbers: List[int]) -> Tuple[Dict[str, Any], List[Dict[str, Any]], List[Dict[str, Any]]]:
    accounts: List[Dict[str, Any]] = []
    validation_issues: List[Dict[str, Any]] = []
    account_sources: List[Dict[str, Any]] = []

    for page_number in page_numbers:
        page = page_artifacts[page_number - 1]
        rows = visible_account_rows(page)
        account_number_count = sum(1 for row in rows if "Account Number:" in normalize_row_text(row))
        blocks = split_account_row_blocks(rows)

        if account_number_count != len(blocks):
            validation_issues.append(
                {
                    "component": "accounts",
                    "severity": "error",
                    "code": "account_inventory_mismatch",
                    "message": f"Account page {page_number} has {account_number_count} account markers but {len(blocks)} account headings.",
                }
            )

        for block in blocks:
            parsed = parse_account_block(block, page)
            if not parsed.get("accountName") or not parsed.get("accountNumber"):
                validation_issues.append(
                    {
                        "component": "accounts",
                        "severity": "error",
                        "code": "account_identity_missing",
                        "message": f"Account on page {page_number} is missing a heading or masked account number.",
                    }
                )
            accounts.append(parsed)
            account_sources.append(
                {
                    "accountName": parsed.get("accountName"),
                    "accountNumber": parsed.get("accountNumber"),
                    "pages": [page_number],
                }
            )

    if page_numbers and not accounts:
        validation_issues.append(
            {
                "component": "accounts",
                "severity": "error",
                "code": "no_accounts_detected",
                "message": "No account headings were detected in the Equifax new-layout accounts section.",
            }
        )

    return {"accountCount": len(accounts), "accounts": accounts}, validation_issues, account_sources


def extract_inquiries(page_artifacts: List[Any], page_numbers: List[int]) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    entries: List[Dict[str, Any]] = []
    issues: List[Dict[str, Any]] = []
    current: Optional[Dict[str, Any]] = None
    table_started = False

    def finish_current() -> None:
        nonlocal current
        if not current:
            return
        current["addressLines"] = unique_preserve_order(
            [normalize_spaces(line) for line in current.get("addressLines", []) if normalize_spaces(line)]
        )
        date_text = normalize_spaces(current.get("_dateText", ""))
        current["inquiryDates"] = unique_preserve_order(DATE_PATTERN.findall(date_text))
        current.pop("_dateText", None)
        current["sourcePages"] = sorted(unique_preserve_order(current.get("sourcePages", [])))
        entries.append(current)
        current = None

    for page_number in page_numbers:
        lines = cleaned_page_lines(page_artifacts[page_number - 1])
        for line in lines:
            lowered = canonical_heading(line)
            if "company information" in lowered and "inquiry type" in lowered and "inquiry date" in lowered:
                table_started = True
                continue
            if not table_started:
                continue

            start_match = INQUIRY_START_PATTERN.match(line)
            if start_match:
                finish_current()
                current = {
                    "companyName": normalize_spaces(start_match.group("company")),
                    "inquiryType": normalize_spaces(start_match.group("inquiryType")),
                    "addressLines": [],
                    "phoneNumber": "",
                    "_dateText": normalize_spaces(start_match.group("dates")),
                    "sourcePages": [page_number],
                }
                continue

            if not current:
                continue

            current["sourcePages"].append(page_number)

            if lowered.startswith("phone"):
                current["phoneNumber"] = normalize_phone_number(
                    clean_field_value(line.split(":", 1)[1] if ":" in line else line)
                )
                continue

            date_match = DATE_PATTERN.search(line)
            if date_match:
                address_prefix = normalize_spaces(line[: date_match.start()])
                if address_prefix:
                    current["addressLines"].append(address_prefix)
                current["_dateText"] = normalize_spaces(f"{current.get('_dateText', '')}, {line[date_match.start():]}")
                continue

            if line:
                current["addressLines"].append(line)

    finish_current()

    if page_numbers and not entries:
        issues.append(
            {
                "component": "inquiries",
                "severity": "error",
                "code": "no_inquiries_detected",
                "message": "No inquiry rows were parsed from the Equifax new-layout inquiries section.",
            }
        )

    for entry in entries:
        if not entry.get("inquiryType") or not entry.get("inquiryDates"):
            issues.append(
                {
                    "component": "inquiries",
                    "severity": "error",
                    "code": "inquiry_row_incomplete",
                    "message": f"Inquiry row for {entry.get('companyName') or 'unknown company'} is missing an inquiry type or inquiry dates.",
                }
            )

    return {"inquiryCount": len(entries), "inquiries": entries}, issues


def extract_public_records(page_artifacts: List[Any], page_numbers: List[int]) -> Dict[str, Any]:
    if not page_numbers:
        return {"publicRecordCount": 0, "records": [], "status": "Section not present."}

    lines_with_pages: List[Tuple[int, str]] = []
    for page_number in page_numbers:
        page = page_artifacts[page_number - 1]
        for line in cleaned_page_lines(page):
            if canonical_heading(line) in {"public records", "credit report", "know your rights"}:
                continue
            lines_with_pages.append((page_number, line))

    joined = " ".join(line for _, line in lines_with_pages).lower()
    if (
        "you currently do not have any bankruptcies in your file." in joined
        and "you currently do not have any judgments in your file." in joined
        and "you currently do not have any liens in your file." in joined
        and "reference number" not in joined
    ):
        return {"publicRecordCount": 0, "records": [], "status": "No public records reported."}

    records: List[Dict[str, Any]] = []
    current_category: Optional[str] = None
    current: Optional[Dict[str, Any]] = None
    current_label: Optional[str] = None
    current_value_lines: List[str] = []
    detail_lines: List[str] = []

    def flush_label() -> None:
        nonlocal current_label, current_value_lines
        if not current or not current_label:
            current_label = None
            current_value_lines = []
            return
        value = normalize_spaces(" ".join(current_value_lines))
        if value:
            current[current_label] = value
        current_label = None
        current_value_lines = []

    def finalize_current() -> None:
        nonlocal current, detail_lines
        flush_label()
        if not current:
            detail_lines = []
            return
        details = [line for line in unique_preserve_order(detail_lines) if line]
        record_type = normalize_spaces(current.get("type") or current_category or "")
        summary = (
            record_type
            or normalize_spaces(current.get("status") or "")
            or (details[0] if details else "")
            or "Public record"
        )
        court = normalize_spaces(current.get("court") or "")
        reference_number = normalize_spaces(current.get("referenceNumber") or "")
        if court and not reference_number:
            split_court, split_reference = split_trailing_public_record_identifier(court)
            if split_reference:
                court = split_court
                reference_number = split_reference
        records.append(
            {
                "recordType": record_type or None,
                "referenceNumber": reference_number or None,
                "status": normalize_spaces(current.get("status") or "") or None,
                "dateFiled": normalize_spaces(current.get("dateFiled") or "") or None,
                "court": court or None,
                "summary": summary,
                "details": details,
                "sourcePages": unique_preserve_order(current.get("sourcePages") or []),
            }
        )
        current = None
        detail_lines = []

    for page_number, line in lines_with_pages:
        lowered = canonical_heading(line)
        if lowered in {"this section includes public record items equifax obtained from local state and federal courts through a third party vendor lexisnexis", "they can be contacted at httpsequifaxconsumerslexisnexiscom"}:
            continue
        if line.startswith("LexisNexis Consumer Center") or line.startswith("P.O. Box 105615") or line.startswith("Atlanta, GA 30348-5108"):
            continue

        category = EQUIFAX_NEW_PUBLIC_RECORD_CATEGORIES.get(lowered)
        if category:
            finalize_current()
            current_category = category
            continue
        if re.match(r"^you currently do not have any (bankruptcies|judgments|liens) in your file\.$", line, re.IGNORECASE):
            continue
        if lowered.startswith("bankruptcies are ") or lowered.startswith("judgments are ") or lowered.startswith("a lien is "):
            continue
        if line.startswith("Page ") or "| Apr " in line or "| Mar " in line or "| Jun " in line or "| Jul " in line:
            continue

        labeled_segments = split_labeled_segments(line, EQUIFAX_NEW_PUBLIC_RECORD_FIELD_LABELS)
        if labeled_segments:
            if current is None:
                current = {"sourcePages": [page_number]}
            current["sourcePages"] = unique_preserve_order([*(current.get("sourcePages") or []), page_number])
            detail_lines.append(line)
            for field_key, inline_value in labeled_segments:
                flush_label()
                current_label = field_key
                current_value_lines = [inline_value] if inline_value else []
            continue

        field_key = EQUIFAX_NEW_PUBLIC_RECORD_FIELD_LABELS.get(lowered)
        if field_key:
            if current is None:
                current = {"sourcePages": [page_number]}
            current["sourcePages"] = unique_preserve_order([*(current.get("sourcePages") or []), page_number])
            flush_label()
            current_label = field_key
            current_value_lines = []
            detail_lines.append(line)
            continue

        if current_label is not None:
            current_value_lines.append(line)
            detail_lines.append(line)
            continue

        if current is not None and current.get("referenceNumber") and current_category:
            finalize_current()
        if current is None:
            current = {"sourcePages": [page_number]}
        current["sourcePages"] = unique_preserve_order([*(current.get("sourcePages") or []), page_number])
        detail_lines.append(line)

    finalize_current()

    return {
        "publicRecordCount": len(records),
        "records": records,
        "status": "Records extracted from Equifax public records pages." if records else "No public records detected.",
    }


def extract_collections(page_artifacts: List[Any], page_numbers: List[int]) -> Dict[str, Any]:
    if not page_numbers:
        return {"collectionCount": 0, "collections": []}

    collections: List[Dict[str, Any]] = []
    current: Optional[Dict[str, Any]] = None
    current_label: Optional[str] = None
    current_value_lines: List[str] = []
    detail_lines: List[str] = []
    pending_comment_contact = False

    def flush_label() -> None:
        nonlocal current_label, current_value_lines
        if not current or not current_label:
            current_label = None
            current_value_lines = []
            return
        value = normalize_spaces(" ".join(current_value_lines))
        if value:
            merge_field_text(current, current_label, value)
        current_label = None
        current_value_lines = []

    def finalize_current() -> None:
        nonlocal current, detail_lines, pending_comment_contact
        flush_label()
        if not current:
            detail_lines = []
            pending_comment_contact = False
            return
        comments_text = normalize_spaces(current.get("comments") or "")
        contact_text = normalize_spaces(current.get("contact") or "")
        collections.append(
            {
                "dateReported": normalize_spaces(current.get("dateReported") or "") or None,
                "collectionAgency": normalize_spaces(current.get("collectionAgency") or "") or None,
                "balanceDate": normalize_spaces(current.get("balanceDate") or "") or None,
                "originalCreditorName": normalize_spaces(current.get("originalCreditorName") or "") or None,
                "accountDesignatorCode": normalize_spaces(current.get("accountDesignatorCode") or "") or None,
                "dateAssigned": normalize_spaces(current.get("dateAssigned") or "") or None,
                "accountNumber": normalize_spaces(current.get("accountNumber") or "") or None,
                "originalAmountOwed": normalize_spaces(current.get("originalAmountOwed") or "") or None,
                "creditorClassification": normalize_spaces(current.get("creditorClassification") or "") or None,
                "amount": normalize_spaces(current.get("amount") or "") or None,
                "lastPaymentDate": normalize_spaces(current.get("lastPaymentDate") or "") or None,
                "statusDate": normalize_spaces(current.get("statusDate") or "") or None,
                "dateOfFirstDelinquency": normalize_spaces(current.get("dateOfFirstDelinquency") or "") or None,
                "status": normalize_spaces(current.get("status") or "") or None,
                "comments": [comments_text] if comments_text else [],
                "contact": contact_text.split(" | ") if contact_text else [],
                "details": detail_lines[:],
                "sourceText": normalize_spaces(" ".join(detail_lines)),
                "sourcePages": unique_preserve_order(current.get("sourcePages") or []),
            }
        )
        current = None
        detail_lines = []
        pending_comment_contact = False

    for page_number in page_numbers:
        page = page_artifacts[page_number - 1]
        row_entries = []
        layout_rows = list(getattr(page, "layout_rows", []) or [])
        if layout_rows:
            for row in layout_rows:
                text = normalize_spaces((row or {}).get("text") or "")
                if not text or FOOTER_SKIP_PATTERN.search(text):
                    continue
                lowered = text.lower()
                if lowered.startswith(HEADER_SKIP_PREFIXES) or text == "Your credit report":
                    continue
                row_entries.append({"text": text, "bbox": (row or {}).get("bbox") or {}})
        else:
            row_entries = [{"text": line, "bbox": {}} for line in cleaned_page_lines(page)]

        for entry in row_entries:
            line = entry["text"]
            lowered = canonical_heading(line)
            if lowered in {"10. collections", "collections", "collection accounts", "credit report", "know your rights"}:
                continue
            if lowered.startswith("collections are accounts with outstanding debt"):
                continue
            if "credit report for up to 7 years" in line.lower():
                continue
            if lowered.startswith("11. dispute file information") or lowered.startswith("12. a summary of your rights"):
                finalize_current()
                return {
                    "collectionCount": len(collections),
                    "collections": collections,
                }
            if line.startswith("Page ") or "| Apr " in line or "| Mar " in line or "| Jun " in line or "| Jul " in line:
                continue

            labeled_segments: List[Tuple[str, str]] = []
            if "|" in line:
                raw_segments = [normalize_spaces(part) for part in line.split("|") if normalize_spaces(part)]
                index = 0
                while index < len(raw_segments):
                    field_key = EQUIFAX_NEW_COLLECTION_FIELD_LABELS.get(canonical_heading(raw_segments[index]))
                    if not field_key:
                        index += 1
                        continue
                    next_segment = raw_segments[index + 1] if index + 1 < len(raw_segments) else ""
                    next_key = EQUIFAX_NEW_COLLECTION_FIELD_LABELS.get(canonical_heading(next_segment)) if next_segment else None
                    if next_key:
                        labeled_segments.append((field_key, ""))
                        index += 1
                    else:
                        labeled_segments.append((field_key, next_segment))
                        index += 2 if next_segment else 1
            if not labeled_segments:
                labeled_segments = split_labeled_segments(line, EQUIFAX_NEW_COLLECTION_FIELD_LABELS)

            if labeled_segments:
                if labeled_segments[0][0] == "dateReported" and current and current.get("collectionAgency"):
                    finalize_current()
                if current is None:
                    current = {"sourcePages": [page_number]}
                current["sourcePages"] = unique_preserve_order([*(current.get("sourcePages") or []), page_number])
                detail_lines.append(line)
                for field_key, inline_value in labeled_segments:
                    flush_label()
                    if inline_value:
                        merge_field_text(current, field_key, inline_value)
                        current_label = None
                        current_value_lines = []
                    else:
                        current_label = field_key
                        current_value_lines = []
                pending_comment_contact = any(field_key in {"comments", "contact"} for field_key, _ in labeled_segments)
                continue

            field_key = EQUIFAX_NEW_COLLECTION_FIELD_LABELS.get(lowered)
            if field_key == "dateReported" and current and current.get("collectionAgency"):
                finalize_current()

            if field_key:
                if current is None:
                    current = {"sourcePages": [page_number]}
                current["sourcePages"] = unique_preserve_order([*(current.get("sourcePages") or []), page_number])
                flush_label()
                current_label = field_key
                current_value_lines = []
                detail_lines.append(line)
                pending_comment_contact = field_key in {"comments", "contact"}
                continue

            if pending_comment_contact and current is not None:
                bbox = entry.get("bbox") or {}
                try:
                    x_min = float(bbox.get("xMin") or 0.0)
                except (TypeError, ValueError):
                    x_min = 0.0
                target_field = "contact" if x_min >= 250 or PHONE_PATTERN.search(line) else "comments"
                merge_field_text(current, target_field, line)
                detail_lines.append(line)
                continue

            if current_label is not None:
                current_value_lines.append(line)
                detail_lines.append(line)

    finalize_current()

    return {
        "collectionCount": len(collections),
        "collections": collections,
    }


def extract_equifax_new_components(
    page_artifacts: List[Any],
) -> Tuple[Dict[str, Any], List[Dict[str, Any]], Dict[str, List[int]], Dict[str, Dict[str, List[int]]]]:
    page_windows = discover_section_pages(page_artifacts)
    components = {
        "reportConfirmationDetails": extract_report_confirmation(page_artifacts, page_windows["reportConfirmationDetails"]),
        "summary": extract_summary(page_artifacts, page_windows["summary"]),
        "personalInformation": extract_personal_information(page_artifacts, page_windows["personalInformation"]),
    }
    accounts_component, account_issues, account_sources = extract_accounts(page_artifacts, page_windows["accounts"])
    collections_component = extract_collections(page_artifacts, page_windows.get("collections", []))
    public_records_component = extract_public_records(page_artifacts, page_windows.get("publicRecords", []))
    inquiries_component, inquiry_issues = extract_inquiries(page_artifacts, page_windows["inquiries"])

    components["accounts"] = accounts_component
    components["collections"] = collections_component
    components["publicRecords"] = public_records_component
    components["inquiries"] = inquiries_component

    validation_issues = [*account_issues, *inquiry_issues]

    component_sources: Dict[str, Dict[str, List[int]]] = {
        "reportConfirmationDetails": {"pages": page_windows["reportConfirmationDetails"]},
        "summary": {"pages": page_windows["summary"]},
        "personalInformation": {"pages": page_windows["personalInformation"]},
        "accounts": {"pages": sorted(unique_preserve_order(page_windows["accounts"]))},
        "collections": {"pages": sorted(unique_preserve_order(page_windows.get("collections", [])))},
        "publicRecords": {"pages": sorted(unique_preserve_order(page_windows.get("publicRecords", [])))},
        "inquiries": {"pages": sorted(unique_preserve_order(page_windows["inquiries"]))},
    }
    if account_sources:
        component_sources["accounts"]["pages"] = sorted(
            unique_preserve_order(page for source in account_sources for page in source.get("pages", []))
        )

    return components, validation_issues, page_windows, component_sources
