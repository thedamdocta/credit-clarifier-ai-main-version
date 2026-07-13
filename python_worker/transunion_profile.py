import re
from typing import Any, Dict, Iterable, List, Optional, Tuple


TRANSUNION_COMPONENT_NAMES = [
    "reportOverview",
    "personalInformation",
    "publicRecords",
    "adverseAccounts",
    "satisfactoryAccounts",
    "inquiries",
    "accountReviewInquiries",
    "creditReportMessages",
    "additionalInformation",
    "collections",
    "consumerInformationIndicators",
]

MONTH_KEYS = [
    ("January", "jan"),
    ("February", "feb"),
    ("March", "mar"),
    ("April", "apr"),
    ("May", "may"),
    ("June", "jun"),
    ("July", "jul"),
    ("August", "aug"),
    ("September", "sep"),
    ("October", "oct"),
    ("November", "nov"),
    ("December", "dec"),
]
MONTH_LOOKUP = {name.lower(): key for name, key in MONTH_KEYS}
MONTH_PATTERN = re.compile(rf"^({'|'.join(name for name, _ in MONTH_KEYS)})\s+(\d{{4}})$", re.IGNORECASE)
MASKED_ACCOUNT_PATTERN = re.compile(r"^(?P<name>.+?)\s+(?P<number>[A-Z0-9][A-Z0-9/\-]*\*{2,})$")

TRANSUNION_ACCOUNT_FIELD_LABELS = {
    "address": "address",
    "phone": "phoneNumber",
    "date opened": "dateOpened",
    "responsibility": "responsibility",
    "account type": "accountType",
    "loan type": "loanType",
    "balance": "balance",
    "date updated": "dateUpdated",
    "payment received": "paymentReceived",
    "last payment made": "lastPaymentMade",
    "last payment made/paid": "lastPaymentMade",
    "pay status": "payStatus",
    "terms": "terms",
    "date closed": "dateClosed",
    "credit limit (hist)": "creditLimitHistory",
    "credit limit (hist.)": "creditLimitHistory",
    "credit limit": "creditLimit",
    "estimated month and year this item will be removed": "estimatedRemoval",
    "past due": "amountPastDue",
    "monthly payment": "monthlyPayment",
    "high balance (hist)": "highBalance",
    "high balance (hist.)": "highBalance",
    "high balance": "highBalance",
    "high credit": "highCredit",
    "original creditor": "originalCreditor",
    "remarks": "remarks",
}

TRANSUNION_ACCOUNT_FIELD_LABEL_METADATA = {
    "highBalance": "highBalanceDisplayLabel",
    "creditLimit": "creditLimitDisplayLabel",
    "creditLimitHistory": "creditLimitHistoryDisplayLabel",
}

TRANSUNION_HISTORY_LABELS = {
    "balance": "Balance",
    "high credit": "High Credit",
    "past due": "Past Due",
    "amount paid": "Amount Paid",
    "scheduled payment": "Scheduled Payment",
    "remarks": "Remarks",
    "rating": "Rating",
}

TRANSUNION_STOP_HEADINGS = {
    "public records",
    "accounts with adverse information",
    "satisfactory accounts",
    "inquiries",
    "account review inquiries",
    "credit report messages",
    "additional information",
}

TRANSUNION_IGNORE_HEADER_LINES = {
    "accounts with adverse information",
    "satisfactory accounts",
    "account name",
    "account information",
    "payment history",
    "name",
    "location",
    "requested on",
    "phone",
    "personal information",
    "addresses",
    "phone numbers",
    "employers",
    "date reported",
    "occupation",
    "date verified",
}

TRANSUNION_MESSAGE_SKIP_LINES = {
    "your credit report contains the following messages",
}

TRANSUNION_ADDITIONAL_SKIP_PREFIXES = (
    "the following disclosure of information",
    "authorized parties may also receive",
)

TRANSUNION_PUBLIC_RECORD_FIELD_LABELS = {
    "court name": "court",
    "address": "address",
    "phone": "phoneNumber",
    "type": "recordType",
    "date filed": "dateFiled",
    "court type": "courtType",
    "date updated": "dateUpdated",
    "date paid": "dateResolved",
    "estimated month and year that this item will be removed": "estimatedRemoval",
    "estimated month and year this item will be removed": "estimatedRemoval",
    "plaintiff attorney": "plaintiffAttorney",
    "responsibility": "responsibility",
    "court": "court",
    "reference number": "referenceNumber",
    "liability": "liability",
    "status": "status",
}

TRANSUNION_NON_LEGAL_PUBLIC_RECORD_TITLES = {
    "supplemental public records and residential information",
}


def normalize_spaces(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def is_transunion_non_legal_public_record_title(value: Any) -> bool:
    normalized = normalize_spaces(value).lower()
    return normalized in TRANSUNION_NON_LEGAL_PUBLIC_RECORD_TITLES


def looks_like_transunion_legal_public_record(value: Any) -> bool:
    normalized = normalize_spaces(value).lower()
    if not normalized or is_transunion_non_legal_public_record_title(normalized):
        return False
    return any(
        token in normalized
        for token in (
            "bankrupt",
            "judgment",
            "tax lien",
            "lien",
            "foreclosure",
            "eviction",
            "civil claim",
            "public record",
        )
    )


def split_trailing_transunion_public_record_identifier(value: Any) -> Tuple[str, str]:
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



def is_url_or_page_counter(text: str) -> bool:
    lowered = text.lower()
    return bool(
        lowered.startswith("http://")
        or lowered.startswith("https://")
        or re.fullmatch(r"\d+\s*/\s*\d+", text)
        or "annualcreditreport.transunion.com/dss/disclosure.page" in lowered
    )



def row_entries(page_artifacts: List[Any], page_numbers: List[int]) -> List[Dict[str, Any]]:
    entries: List[Dict[str, Any]] = []
    for page_number in page_numbers:
        if page_number <= 0 or page_number > len(page_artifacts):
            continue
        page = page_artifacts[page_number - 1]
        for row in getattr(page, "layout_rows", []) or []:
            text = normalize_spaces(row.get("text") or "")
            if not text or is_url_or_page_counter(text):
                continue
            entries.append({"page": page_number, "text": text, "row": row})
    return entries


def collect_rows_until_heading(
    page_artifacts: List[Any],
    page_numbers: List[int],
    stop_headings: Iterable[str],
) -> List[Dict[str, Any]]:
    entries = row_entries(page_artifacts, page_numbers)
    stop_set = {canonical_heading(value) for value in stop_headings}
    collected: List[Dict[str, Any]] = []
    started = False
    for entry in entries:
        heading = canonical_heading(entry["text"])
        if heading == "public records":
            started = True
        if started and heading in stop_set:
            break
        collected.append(entry)
    return collected


def find_first_page_with_heading(page_artifacts: List[Any], heading: str) -> Optional[int]:
    target = heading.lower()
    for page in page_artifacts:
        for row in getattr(page, "layout_rows", []) or []:
            text = normalize_spaces(row.get("text") or "")
            if canonical_heading(text) == target:
                return int(getattr(page, "page_number"))
    return None



def split_pipe_columns(text: str) -> List[str]:
    return [normalize_spaces(part) for part in text.split("|") if normalize_spaces(part)]



def is_transunion_account_field_line(text: str) -> bool:
    columns = split_pipe_columns(text)
    if not columns:
        return False
    return canonical_heading(columns[0]) in TRANSUNION_ACCOUNT_FIELD_LABELS



def month_meta(token: str) -> Optional[Tuple[str, str]]:
    match = MONTH_PATTERN.match(normalize_spaces(token))
    if not match:
        return None
    month_name = match.group(1).lower()
    year = match.group(2)
    month_key = MONTH_LOOKUP.get(month_name)
    if not month_key:
        return None
    return year, month_key



def is_month_row(parts: List[str]) -> bool:
    return bool(parts) and all(month_meta(part) for part in parts)



def normalize_history_value(raw_value: str) -> str:
    value = normalize_spaces(raw_value)
    if not value:
        return "---"
    if re.fullmatch(r"(?:-\s*){2,}", value):
        return "---"
    return value



def detect_uniform_history_label(parts: List[str]) -> Optional[str]:
    labels = {detect_inline_history_label(part) for part in parts}
    labels.discard(None)
    if len(labels) != 1:
        return None
    label = next(iter(labels), None)
    if not label:
        return None
    if all(canonical_heading(part) == label for part in parts):
        return label
    if all(canonical_heading(part).startswith(f"{label} ") for part in parts):
        return label
    return None



def detect_inline_history_label(cell: str) -> Optional[str]:
    heading = canonical_heading(cell)
    for label in TRANSUNION_HISTORY_LABELS:
        if heading == label or heading.startswith(f"{label} "):
            return label
    return None



def strip_history_label(cell: str, label: str) -> str:
    display_label = TRANSUNION_HISTORY_LABELS[label]
    value = re.sub(rf"^{re.escape(display_label)}\s*", "", normalize_spaces(cell), flags=re.IGNORECASE)
    return normalize_history_value(value)



def build_monthly_rows(entries: List[Tuple[str, str, str]]) -> List[Dict[str, str]]:
    year_map: Dict[str, Dict[str, str]] = {}
    for year, month_key, value in entries:
        row = year_map.setdefault(
            year,
            {
                "year": year,
                "jan": "---",
                "feb": "---",
                "mar": "---",
                "apr": "---",
                "may": "---",
                "jun": "---",
                "jul": "---",
                "aug": "---",
                "sep": "---",
                "oct": "---",
                "nov": "---",
                "dec": "---",
            },
        )
        row[month_key] = value

    return [year_map[year] for year in sorted(year_map.keys(), reverse=True)]



def discover_section_pages(page_artifacts: List[Any]) -> Dict[str, List[int]]:
    total_pages = len(page_artifacts)
    personal_start = find_first_page_with_heading(page_artifacts, "personal information") or 1
    public_records_start = find_first_page_with_heading(page_artifacts, "public records") or total_pages + 1
    adverse_start = find_first_page_with_heading(
        page_artifacts,
        "accounts with adverse information",
    ) or total_pages + 1
    satisfactory_start = find_first_page_with_heading(page_artifacts, "satisfactory accounts") or total_pages + 1
    inquiries_start = find_first_page_with_heading(page_artifacts, "inquiries") or total_pages + 1
    account_review_start = find_first_page_with_heading(page_artifacts, "account review inquiries") or total_pages + 1
    messages_start = find_first_page_with_heading(page_artifacts, "credit report messages") or total_pages + 1
    additional_start = find_first_page_with_heading(page_artifacts, "additional information") or total_pages + 1
    account_review_end = (
        min(messages_start + 1, total_pages + 1)
        if messages_start <= total_pages
        else total_pages + 1
    )

    return {
        "reportOverview": [1],
        "personalInformation": list(range(personal_start, min(public_records_start, adverse_start, total_pages + 1))),
        "publicRecords": list(range(public_records_start, min(adverse_start, total_pages + 1)))
        if public_records_start <= total_pages
        else [],
        "adverseAccounts": list(range(adverse_start, min(satisfactory_start, total_pages + 1))) if adverse_start <= total_pages else [],
        "satisfactoryAccounts": list(range(satisfactory_start, min(inquiries_start, total_pages + 1))) if satisfactory_start <= total_pages else [],
        "inquiries": list(range(inquiries_start, min(account_review_start, total_pages + 1))) if inquiries_start <= total_pages else [],
        "accountReviewInquiries": list(range(account_review_start, account_review_end)) if account_review_start <= total_pages else [],
        "creditReportMessages": list(range(messages_start, min(additional_start, total_pages + 1))) if messages_start <= total_pages else [],
        "additionalInformation": list(range(additional_start, total_pages + 1)) if additional_start <= total_pages else [],
    }



def extract_report_overview(page_artifacts: List[Any], page_numbers: List[int]) -> Dict[str, Any]:
    text = "\n".join(
        entry["text"]
        for entry in row_entries(page_artifacts, page_numbers)
    )
    lines = [entry["text"] for entry in row_entries(page_artifacts, page_numbers)]

    def value_after(label: str) -> str:
        target = canonical_heading(label)
        for index, line in enumerate(lines):
            if canonical_heading(line) == target and index + 1 < len(lines):
                return lines[index + 1]
        return ""

    consumer_name = value_after("Personal Credit Report for") or value_after("Name") or "Not reported"
    file_number = value_after("File Number") or "Not reported"
    date_created = value_after("Date Created") or "Not reported"
    credit_report_date = value_after("Credit Report Date") or "Not reported"

    return {
        "consumerName": consumer_name,
        "fileNumber": file_number,
        "dateCreated": date_created,
        "creditReportDate": credit_report_date,
    }



def is_personal_information_meta_line(text: str) -> bool:
    lowered = normalize_spaces(text).lower()
    return (
        not lowered
        or lowered.startswith("visit transunion.com/dispute")
        or lowered.startswith("if you are experiencing a financial hardship")
        or lowered.startswith("you have been on our files since")
    )


def is_transunion_employer_value_line(text: str) -> bool:
    normalized = normalize_spaces(text)
    if not normalized or is_url_or_page_counter(normalized):
        return False
    heading = canonical_heading(normalized)
    if heading in TRANSUNION_STOP_HEADINGS:
        return False
    if heading in {
        "employers",
        "employer",
        "addresses",
        "phone numbers",
        "phone number",
        "current address",
        "other address",
        "also known as",
        "aka",
        "name",
        "social security number",
        "date of birth",
        "date reported",
    }:
        return False
    lowered = normalized.lower()
    if lowered.startswith("occupation ") or lowered.startswith("date verified"):
        return False
    if "date verified" in lowered or "|" in normalized:
        return False
    if re.search(r"\b\d{1,2}/\d{1,2}/\d{4}\b", normalized):
        return False
    if normalized.endswith("."):
        return False
    return len(normalized) <= 80


def extract_personal_information(page_artifacts: List[Any], page_numbers: List[int]) -> Tuple[Dict[str, Any], List[int], List[Dict[str, Any]]]:
    name = "Not reported"
    also_known_as: List[str] = []
    current_addresses: List[str] = []
    previous_addresses: List[str] = []
    phone_numbers: List[str] = []
    employers: List[str] = []
    social_security_number = "Not reported"
    date_of_birth = "Not reported"
    source_pages: List[int] = []
    issues: List[Dict[str, Any]] = []

    pending_key: Optional[str] = None
    in_personal_section = False
    active_section: Optional[str] = None
    employer_block_count = 0

    for row_entry in row_entries(page_artifacts, page_numbers):
        page = row_entry["page"]
        line = row_entry["text"]
        heading = canonical_heading(line)
        lowered = normalize_spaces(line).lower()

        if heading == "accounts":
            break
        if is_personal_information_meta_line(line):
            continue
        if heading == "personal information":
            in_personal_section = True
            active_section = None
            pending_key = None
            continue
        if not in_personal_section and page_numbers:
            in_personal_section = True
        if not in_personal_section:
            continue

        if heading == "name":
            pending_key = "name"
            active_section = None
            continue
        if heading in {"also known as", "aka"}:
            pending_key = None
            active_section = "aka"
            continue
        if heading == "addresses":
            pending_key = None
            active_section = "addresses"
            continue
        if heading == "current address":
            pending_key = "currentAddress"
            continue
        if heading == "other address":
            pending_key = "otherAddress"
            continue
        if heading == "phone numbers":
            pending_key = None
            active_section = "phoneNumbers"
            continue
        if heading == "phone number":
            pending_key = "phoneNumber"
            continue
        if heading == "employers":
            pending_key = None
            active_section = "employers"
            continue
        if heading == "employer":
            pending_key = None
            active_section = "employers"
            continue
        if heading == "social security number":
            pending_key = "socialSecurityNumber"
            active_section = None
            continue
        if heading == "date of birth":
            pending_key = "dateOfBirth"
            active_section = None
            continue
        if heading == "date reported":
            pending_key = None
            continue
        if lowered.startswith("occupation ") and "date verified" in lowered:
            employer_block_count += 1
            pending_key = None
            continue

        if pending_key == "name":
            name = line
            source_pages.append(page)
            pending_key = None
            continue
        if pending_key == "currentAddress":
            current_addresses.append(line)
            source_pages.append(page)
            pending_key = None
            continue
        if pending_key == "otherAddress":
            previous_addresses.append(line)
            source_pages.append(page)
            pending_key = None
            continue
        if pending_key == "phoneNumber":
            phone_numbers.append(line)
            source_pages.append(page)
            pending_key = None
            continue
        if pending_key == "socialSecurityNumber":
            social_security_number = line
            source_pages.append(page)
            pending_key = None
            continue
        if pending_key == "dateOfBirth":
            date_of_birth = line
            source_pages.append(page)
            pending_key = None
            continue

        if active_section == "aka" and heading not in TRANSUNION_STOP_HEADINGS:
            also_known_as.append(line)
            source_pages.append(page)
            continue
        if active_section == "employers" and is_transunion_employer_value_line(line):
            employers.append(line)
            source_pages.append(page)
            continue

    employers = unique_preserve_order(employers)
    if employer_block_count and len(employers) < employer_block_count:
        issues.append(
            {
                "component": "personalInformation",
                "severity": "error",
                "code": "employer_block_mismatch",
                "message": f"Expected {employer_block_count} TransUnion employer entries but extracted {len(employers)}.",
            }
        )

    return {
        "name": name,
        "alsoKnownAs": unique_preserve_order(also_known_as),
        "currentAddresses": unique_preserve_order(current_addresses),
        "previousAddresses": unique_preserve_order(previous_addresses),
        "addresses": unique_preserve_order(current_addresses + previous_addresses),
        "phoneNumbers": unique_preserve_order(phone_numbers),
        "employers": employers,
        "socialSecurityNumber": social_security_number,
        "dateOfBirth": date_of_birth,
    }, unique_preserve_order(source_pages), issues



def extract_account_header(header_context: List[str]) -> Tuple[str, str]:
    for line in reversed(header_context):
        normalized = normalize_spaces(line)
        if not normalized or is_url_or_page_counter(normalized):
            continue
        if canonical_heading(normalized) in TRANSUNION_IGNORE_HEADER_LINES:
            continue
        match = MASKED_ACCOUNT_PATTERN.match(normalized)
        if match:
            return normalize_spaces(match.group("name")), normalize_spaces(match.group("number"))
    for line in reversed(header_context):
        normalized = normalize_spaces(line)
        if not normalized or is_url_or_page_counter(normalized):
            continue
        if canonical_heading(normalized) in TRANSUNION_IGNORE_HEADER_LINES:
            continue
        return normalized, "Not reported"
    return "Not reported", "Not reported"



def parse_transunion_account_fields(lines: List[str]) -> Dict[str, str]:
    fields: Dict[str, str] = {}
    pending_key: Optional[str] = None
    orphan_value_lines: List[str] = []

    def remember_label(field_key: str, raw_label: str) -> None:
        label_key = TRANSUNION_ACCOUNT_FIELD_LABEL_METADATA.get(field_key)
        if not label_key:
            return
        fields[label_key] = normalize_spaces(raw_label).strip(":")

    for line in lines:
        if not line or is_url_or_page_counter(line):
            continue
        heading = canonical_heading(line)
        if heading in TRANSUNION_STOP_HEADINGS:
            break
        if heading == "payment history":
            break

        columns = split_pipe_columns(line)
        if len(columns) > 1:
            label = TRANSUNION_ACCOUNT_FIELD_LABELS.get(canonical_heading(columns[0]))
            if label:
                value = normalize_spaces(" ".join(columns[1:])) or "Not reported"
                fields[label] = value
                remember_label(label, columns[0])
                pending_key = label if label in {"highBalance", "creditLimitHistory"} else None
                orphan_value_lines = []
                continue

        label = TRANSUNION_ACCOUNT_FIELD_LABELS.get(heading)
        if label:
            remember_label(label, line)
            pending_key = label
            if pending_key not in fields:
                if orphan_value_lines and pending_key in {"highBalance", "creditLimitHistory"}:
                    fields[pending_key] = normalize_spaces(" ".join(orphan_value_lines))
                    orphan_value_lines = []
                else:
                    fields[pending_key] = ""
            continue

        if pending_key:
            existing = fields.get(pending_key, "")
            fields[pending_key] = normalize_spaces(f"{existing} {line}") if existing else line
            orphan_value_lines = []
        else:
            orphan_value_lines.append(line)
            if len(orphan_value_lines) > 4:
                orphan_value_lines = orphan_value_lines[-4:]

    return {key: (normalize_spaces(value) or "Not reported") for key, value in fields.items()}


def page_has_stop_heading(page_artifacts: List[Any], page_number: int) -> bool:
    if page_number <= 0 or page_number > len(page_artifacts):
        return False
    page = page_artifacts[page_number - 1]
    for row in getattr(page, "layout_rows", []) or []:
        text = normalize_spaces(row.get("text") or "")
        if not text or is_url_or_page_counter(text):
            continue
        if canonical_heading(text) in TRANSUNION_STOP_HEADINGS:
            return True
    return False


def looks_like_account_continuation_page(page_artifacts: List[Any], page_number: int) -> bool:
    if page_number <= 0 or page_number > len(page_artifacts):
        return False

    meaningful_rows: List[str] = []
    for entry in row_entries(page_artifacts, [page_number]):
        text = entry["text"]
        heading = canonical_heading(text)
        if heading in TRANSUNION_STOP_HEADINGS:
            break
        meaningful_rows.append(text)

    if not meaningful_rows:
        return False

    for line in meaningful_rows:
        normalized = normalize_spaces(line)
        if MASKED_ACCOUNT_PATTERN.match(normalized):
            return False
        if canonical_heading(line) == "account name":
            return False

    for line in meaningful_rows:
        if is_transunion_account_field_line(line):
            return True
        columns = split_pipe_columns(line)
        if columns and (is_month_row(columns) or detect_uniform_history_label(columns)):
            return True
        if canonical_heading(line).startswith("total months"):
            return True

    return False


def extend_account_section_pages(page_artifacts: List[Any], page_numbers: List[int]) -> List[int]:
    extended = unique_preserve_order(page_numbers)
    if not extended:
        return extended

    next_page = extended[-1] + 1
    while next_page <= len(page_artifacts):
        if not looks_like_account_continuation_page(page_artifacts, next_page):
            break
        extended.append(next_page)
        if page_has_stop_heading(page_artifacts, next_page):
            break
        next_page += 1

    return extended



def parse_transunion_payment_history_rows(history_rows: List[List[str]]) -> Dict[str, Any]:
    series_entries: Dict[str, List[Tuple[str, str, str]]] = {label: [] for label in TRANSUNION_HISTORY_LABELS}
    row_index = 0
    current_months: List[Tuple[str, str]] = []

    while row_index < len(history_rows):
        columns = [normalize_spaces(column) for column in history_rows[row_index]]
        if not any(columns):
            row_index += 1
            continue
        columns = [column for column in columns if column]
        if is_month_row(columns):
            current_months = [month_meta(column) for column in columns if month_meta(column)]
            row_index += 1
            continue
        if normalize_spaces(" ".join(columns)).lower().startswith("total months"):
            row_index += 1
            continue
        if canonical_heading(" ".join(columns)) in TRANSUNION_STOP_HEADINGS:
            break
        if not current_months:
            row_index += 1
            continue

        uniform_label = detect_uniform_history_label(columns)
        if uniform_label and len(columns) == len(current_months) and all(canonical_heading(column) == uniform_label for column in columns):
            if row_index + 1 < len(history_rows):
                value_columns = [normalize_spaces(column) for column in history_rows[row_index + 1]]
                value_columns = [column for column in value_columns if column]
                if value_columns and not is_month_row(value_columns) and detect_uniform_history_label(value_columns) != uniform_label:
                    for (year, month_key), raw_value in zip(current_months, value_columns):
                        series_entries[uniform_label].append((year, month_key, normalize_history_value(raw_value)))
                    row_index += 2
                    continue

        inline_label = detect_uniform_history_label(columns)
        if inline_label:
            for (year, month_key), raw_value in zip(current_months, columns):
                series_entries[inline_label].append((year, month_key, strip_history_label(raw_value, inline_label)))
            row_index += 1
            continue

        row_index += 1

    payment_history_rows = build_monthly_rows(series_entries["rating"])
    balance_histories = []
    for key, display_label in TRANSUNION_HISTORY_LABELS.items():
        if key == "rating":
            continue
        rows = build_monthly_rows(series_entries[key])
        if rows:
            balance_histories.append({"label": display_label, "rows": rows})

    flattened_payment_history: List[str] = []
    payment_history_years: List[str] = []
    for row in payment_history_rows:
        payment_history_years.append(row["year"])
        for month_key in ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]:
            flattened_payment_history.append(row[month_key])

    return {
        "paymentHistoryRows": payment_history_rows,
        "paymentHistory": flattened_payment_history,
        "paymentHistoryYears": payment_history_years,
        "balanceHistories": balance_histories,
    }


def parse_transunion_payment_history(page_artifacts: List[Any], page_numbers: List[int], history_lines: List[str]) -> Dict[str, Any]:
    history_rows: List[List[str]] = []
    for page_number in page_numbers:
        if page_number <= 0 or page_number > len(page_artifacts):
            continue
        page = page_artifacts[page_number - 1]
        for table in getattr(page, "layout_tables", []) or []:
            table_rows = table.get("rows") or []
            if not table_rows:
                continue
            header_row = [normalize_spaces(cell) for cell in (table_rows[0] or []) if normalize_spaces(cell)]
            if not is_month_row(header_row):
                continue
            for raw_row in table_rows:
                normalized = [normalize_spaces(cell) for cell in raw_row]
                if any(normalized):
                    history_rows.append(normalized)

    if history_rows:
        return parse_transunion_payment_history_rows(history_rows)

    fallback_rows = [split_pipe_columns(line) for line in history_lines if split_pipe_columns(line)]
    return parse_transunion_payment_history_rows(fallback_rows)



def extract_transunion_account_section(
    page_artifacts: List[Any],
    page_numbers: List[int],
    section_type: str,
) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    scan_page_numbers = extend_account_section_pages(page_artifacts, page_numbers)
    section_heading = {
        "adverse": "accounts with adverse information",
        "satisfactory": "satisfactory accounts",
    }.get(section_type, "")
    entries: List[Dict[str, Any]] = []
    lookback: List[str] = []
    current: Optional[Dict[str, Any]] = None

    for row_entry in row_entries(page_artifacts, scan_page_numbers):
        text = row_entry["text"]
        heading = canonical_heading(text)
        if heading in TRANSUNION_STOP_HEADINGS and heading != section_heading:
            break
        if heading == "account information":
            if current:
                entries.append(current)
            current = {
                "headerContext": list(lookback[-20:]),
                "rows": [],
                "sourcePages": [row_entry["page"]],
            }
            continue
        if current is not None:
            current["rows"].append(row_entry)
            if row_entry["page"] not in current["sourcePages"]:
                current["sourcePages"].append(row_entry["page"])
        lookback.append(text)
        if len(lookback) > 40:
            lookback = lookback[-40:]

    if current:
        entries.append(current)

    issues: List[Dict[str, Any]] = []
    accounts: List[Dict[str, Any]] = []

    for entry in entries:
        account_name, account_number = extract_account_header(entry["headerContext"])
        lines = [row["text"] for row in entry["rows"]]
        info_lines: List[str] = []
        history_lines: List[str] = []
        in_history = False
        for line in lines:
            if canonical_heading(line) == "payment history":
                in_history = True
                continue
            if in_history:
                history_lines.append(line)
            else:
                info_lines.append(line)

        account_info = parse_transunion_account_fields(info_lines)
        history = parse_transunion_payment_history(page_artifacts, entry["sourcePages"], history_lines)

        if account_name == "Not reported":
            issues.append(
                {
                    "component": f"{section_type}Accounts",
                    "severity": "error",
                    "code": "missing_account_name",
                    "message": f"TransUnion {section_type} account entry is missing an account name on pages {entry['sourcePages']}.",
                }
            )
        if account_number == "Not reported":
            issues.append(
                {
                    "component": f"{section_type}Accounts",
                    "severity": "error",
                    "code": "missing_account_number",
                    "message": f"TransUnion {section_type} account '{account_name}' is missing a masked account number.",
                }
            )

        pay_status = account_info.get("payStatus", "Not reported")
        remarks_value = account_info.get("remarks", "Not reported")
        date_closed = account_info.get("dateClosed", "Not reported")
        contact_address = account_info.get("address", "Not reported")
        contact_phone = account_info.get("phoneNumber", "Not reported")

        accounts.append(
            {
                "accountName": account_name,
                "accountNumber": account_number,
                "sectionType": section_type,
                "isPotentiallyNegative": section_type == "adverse" or "<" in pay_status or ">" in pay_status,
                "isClosed": (
                    "closed" in pay_status.lower()
                    or "closed" in remarks_value.lower()
                    or date_closed != "Not reported"
                ),
                "accountInfo": {
                    "accountName": account_name,
                    "accountNumber": account_number,
                    **account_info,
                },
                "contactInfo": {
                    "address": [contact_address] if contact_address != "Not reported" else [],
                    "phoneNumber": contact_phone,
                },
                "paymentHistory": history["paymentHistoryRows"],
                "paymentHistoryYears": history["paymentHistoryYears"],
                "balanceHistories": history["balanceHistories"],
                "sourcePages": entry["sourcePages"],
            }
        )

    if not accounts and page_numbers:
        issues.append(
            {
                "component": f"{section_type}Accounts",
                "severity": "error",
                "code": "no_accounts_detected",
                "message": f"No TransUnion {section_type} accounts were detected.",
            }
        )

    component = {
        "accountCount": len(accounts),
        "accounts": accounts,
    }
    return component, issues



def looks_like_inquiry_name(text: str) -> bool:
    heading = canonical_heading(text)
    if not text or is_url_or_page_counter(text):
        return False
    if heading in TRANSUNION_STOP_HEADINGS or heading in {"name", "location", "requested on", "phone"}:
        return False
    if text.startswith("Location "):
        return False
    if text.lower().startswith("the listing of"):
        return False
    return len(text) <= 80



def parse_transunion_inquiry_row(text: str) -> Dict[str, str]:
    normalized = normalize_spaces(text)
    location = "Not reported"
    requested_on = "Not reported"
    phone_number = "Not reported"

    if normalized.lower().startswith("location "):
        remainder = re.sub(r"^Location\s+", "", normalized, flags=re.IGNORECASE).strip()
        requested_split = re.split(r"\s*\|\s*Requested On\s+|\s+Requested On\s+", remainder, maxsplit=1, flags=re.IGNORECASE)
        if len(requested_split) == 2:
            location = requested_split[0].strip() or "Not reported"
            requested_segment = requested_split[1].strip()
        else:
            phone_split = re.split(r"\s*\|\s*Phone\s+|\s+Phone\s+", remainder, maxsplit=1, flags=re.IGNORECASE)
            location = phone_split[0].strip() or "Not reported"
            requested_segment = ""
            if len(phone_split) == 2:
                phone_number = phone_split[1].strip() or "Not reported"

        if requested_segment:
            phone_split = re.split(r"\s*\|\s*Phone\s+|\s+Phone\s+", requested_segment, maxsplit=1, flags=re.IGNORECASE)
            requested_on = phone_split[0].strip() or "Not reported"
            if len(phone_split) == 2:
                phone_number = phone_split[1].strip() or "Not reported"
    elif normalized.lower().startswith("requested on "):
        requested_on = re.sub(r"^Requested On\s+", "", normalized, flags=re.IGNORECASE).strip() or "Not reported"
    elif normalized.lower().startswith("phone "):
        phone_number = re.sub(r"^Phone\s+", "", normalized, flags=re.IGNORECASE).strip() or "Not reported"

    return {"location": location, "requestedOn": requested_on, "phoneNumber": phone_number}


def count_transunion_inquiry_cards(
    page_artifacts: List[Any],
    page_numbers: List[int],
    section_heading: str,
) -> int:
    count = 0
    in_section = False
    target_heading = canonical_heading(section_heading)
    has_heading = any(
        canonical_heading(entry["text"]) == target_heading
        for entry in row_entries(page_artifacts, page_numbers)
    )

    for row_entry in row_entries(page_artifacts, page_numbers):
        text = row_entry["text"]
        heading = canonical_heading(text)
        if heading == target_heading:
            in_section = True
            continue
        if not in_section:
            if has_heading:
                continue
            in_section = True
        if heading in TRANSUNION_STOP_HEADINGS and heading != target_heading:
            break
        if looks_like_inquiry_name(text):
            count += 1
    return count



def extract_transunion_inquiries(
    page_artifacts: List[Any],
    page_numbers: List[int],
    section_heading: str,
    component_name: str,
) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    entries: List[Dict[str, Any]] = []
    issues: List[Dict[str, Any]] = []
    in_section = False
    target_heading = canonical_heading(section_heading)
    has_heading = any(
        canonical_heading(entry["text"]) == target_heading
        for entry in row_entries(page_artifacts, page_numbers)
    )
    current_entry: Optional[Dict[str, Any]] = None

    def finalize_current_entry() -> None:
        nonlocal current_entry
        if not current_entry:
            return

        location = normalize_spaces(" ".join(current_entry.get("locationParts") or [])) or "Not reported"
        requested_on = normalize_spaces(" ".join(current_entry.get("requestedOnParts") or [])) or "Not reported"
        phone_number = normalize_spaces(current_entry.get("phoneNumber") or "") or "Not reported"
        subscriber_name = current_entry.get("subscriberName") or "Not reported"
        source_pages = unique_preserve_order(current_entry.get("sourcePages") or [])

        entry = {
            "subscriberName": subscriber_name,
            "requestedOn": requested_on,
            "location": location,
            "phoneNumber": phone_number,
            "sourcePages": source_pages,
        }
        entries.append(entry)

        if subscriber_name == "Not reported":
            issues.append(
                {
                    "component": component_name,
                    "severity": "error",
                    "code": "missing_inquiry_name",
                    "message": f"A TransUnion {component_name} entry is missing a subscriber name on pages {source_pages}.",
                }
            )
        if re.search(r"\bphone\b", requested_on, re.IGNORECASE):
            issues.append(
                {
                    "component": component_name,
                    "severity": "error",
                    "code": "phone_leaked_into_requested_on",
                    "message": f"TransUnion {component_name} entry '{subscriber_name}' has phone text embedded in Requested On.",
                }
            )
        current_entry = None

    for row_entry in row_entries(page_artifacts, page_numbers):
        text = row_entry["text"]
        heading = canonical_heading(text)
        page = row_entry["page"]
        if heading == target_heading:
            in_section = True
            continue
        if not in_section:
            if has_heading:
                continue
            in_section = True
        if heading in TRANSUNION_STOP_HEADINGS and heading != target_heading:
            finalize_current_entry()
            break
        if heading in {"name", "location", "requested on", "phone"}:
            continue
        if text.lower().startswith("the listing of"):
            continue

        if looks_like_inquiry_name(text):
            finalize_current_entry()
            current_entry = {
                "subscriberName": text,
                "locationParts": [],
                "requestedOnParts": [],
                "phoneNumber": "",
                "sourcePages": [page],
            }
            continue

        if not current_entry:
            continue

        if page not in current_entry["sourcePages"]:
            current_entry["sourcePages"].append(page)

        if text.startswith("Location "):
            parsed = parse_transunion_inquiry_row(text)
            if parsed["location"] != "Not reported":
                current_entry["locationParts"].append(parsed["location"])
            if parsed["requestedOn"] != "Not reported":
                current_entry["requestedOnParts"].append(parsed["requestedOn"])
            if parsed["phoneNumber"] != "Not reported":
                current_entry["phoneNumber"] = parsed["phoneNumber"]
            continue

        if text.startswith("Requested On "):
            parsed = parse_transunion_inquiry_row(text)
            if parsed["requestedOn"] != "Not reported":
                current_entry["requestedOnParts"].append(parsed["requestedOn"])
            if parsed["phoneNumber"] != "Not reported":
                current_entry["phoneNumber"] = parsed["phoneNumber"]
            continue

        if text.startswith("Phone "):
            parsed = parse_transunion_inquiry_row(text)
            if parsed["phoneNumber"] != "Not reported":
                current_entry["phoneNumber"] = parsed["phoneNumber"]

    finalize_current_entry()

    expected_count = count_transunion_inquiry_cards(page_artifacts, page_numbers, section_heading)
    if expected_count != len(entries):
        issues.append(
            {
                "component": component_name,
                "severity": "error",
                "code": "inquiry_count_mismatch",
                "message": f"Expected {expected_count} TransUnion {component_name} entries but extracted {len(entries)}.",
            }
        )

    return {"inquiryCount": len(entries), "inquiries": entries}, issues



def is_message_title(text: str) -> bool:
    stripped = normalize_spaces(text)
    if not stripped:
        return False
    lowered = stripped.lower()
    if lowered in TRANSUNION_MESSAGE_SKIP_LINES:
        return False
    if lowered.startswith("to add, remove"):
        return False
    if stripped.endswith("."):
        return False
    return len(stripped) <= 80



def extract_credit_report_messages(page_artifacts: List[Any], page_numbers: List[int]) -> Dict[str, Any]:
    lines = [entry["text"] for entry in row_entries(page_artifacts, page_numbers)]
    messages: List[Dict[str, Any]] = []
    current_title: Optional[str] = None
    current_lines: List[str] = []
    in_section = False

    for line in lines:
        heading = canonical_heading(line)
        if heading == "credit report messages":
            in_section = True
            continue
        if heading == "additional information":
            break
        if not in_section:
            continue
        if is_message_title(line):
            if current_title is not None:
                messages.append({"title": current_title, "details": normalize_spaces(" ".join(current_lines))})
            current_title = line
            current_lines = []
            continue
        if current_title is not None:
            current_lines.append(line)

    if current_title is not None:
        messages.append({"title": current_title, "details": normalize_spaces(" ".join(current_lines))})

    return {"messageCount": len(messages), "messages": messages}



def is_additional_section_title(text: str) -> bool:
    stripped = normalize_spaces(text)
    lowered = stripped.lower()
    if not stripped or stripped.endswith(":"):
        return False
    if stripped.startswith("http") or "|" in stripped:
        return False
    if re.search(r"\d", stripped):
        return False
    if any(lowered.startswith(prefix) for prefix in TRANSUNION_ADDITIONAL_SKIP_PREFIXES):
        return False
    if stripped.endswith("."):
        return False
    return len(stripped) <= 120 and len(stripped.split()) >= 2



def extract_additional_information(page_artifacts: List[Any], page_numbers: List[int]) -> Dict[str, Any]:
    lines = [entry["text"] for entry in row_entries(page_artifacts, page_numbers)]
    intro_lines: List[str] = []
    sections: List[Dict[str, Any]] = []
    current_title: Optional[str] = None
    current_lines: List[str] = []
    in_section = False

    for line in lines:
        heading = canonical_heading(line)
        if heading == "additional information":
            in_section = True
            continue
        if not in_section:
            continue
        if is_additional_section_title(line):
            if current_title is not None:
                sections.append({"title": current_title, "details": current_lines[:]})
            else:
                intro_lines = unique_preserve_order(intro_lines)
            current_title = line
            current_lines = []
            continue
        if current_title is None:
            intro_lines.append(line)
        else:
            current_lines.append(line)

    if current_title is not None:
        sections.append({"title": current_title, "details": current_lines[:]})

    return {
        "intro": normalize_spaces(" ".join(unique_preserve_order(intro_lines))),
        "sectionCount": len(sections),
        "sections": sections,
    }


def finalize_transunion_public_record(
    current: Optional[Dict[str, Any]],
    prelude_lines: List[str],
    detail_lines: List[str],
) -> Optional[Dict[str, Any]]:
    if not current:
        return None

    summary = normalize_spaces(" ".join(prelude_lines[:1])) or normalize_spaces(current.get("recordType") or "")
    court_reference = normalize_spaces(" ".join(prelude_lines[1:])) if len(prelude_lines) > 1 else ""
    if not summary and court_reference:
        summary, court_reference = court_reference, ""

    if court_reference and not current.get("referenceNumber"):
        match = re.search(r"(\d{4,}[A-Z0-9\-]*)$", court_reference)
        if match:
            current["referenceNumber"] = match.group(1)
            court_reference = normalize_spaces(court_reference[: match.start()])

    if court_reference and not current.get("court"):
        current["court"] = court_reference

    if current.get("court") and not current.get("referenceNumber"):
        court_name, reference_number = split_trailing_transunion_public_record_identifier(current.get("court"))
        if reference_number:
            current["court"] = court_name
            current["referenceNumber"] = reference_number

    details = [line for line in unique_preserve_order(detail_lines) if line]
    if not summary and details:
        summary = details[0]

    record_type = normalize_spaces(current.get("recordType") or summary)
    if not record_type and summary:
        record_type = summary

    if is_transunion_non_legal_public_record_title(record_type or summary):
        return None

    result = {
        "recordType": record_type or None,
        "court": normalize_spaces(current.get("court") or "") or None,
        "referenceNumber": normalize_spaces(current.get("referenceNumber") or "") or None,
        "status": normalize_spaces(current.get("status") or "") or None,
        "dateFiled": normalize_spaces(current.get("dateFiled") or "") or None,
        "dateResolved": normalize_spaces(current.get("dateResolved") or "") or None,
        "summary": summary or record_type or "Public record",
        "details": details,
        "sourcePages": unique_preserve_order(current.get("sourcePages") or []),
    }

    optional_fields = [
        "address",
        "phoneNumber",
        "courtType",
        "dateUpdated",
        "estimatedRemoval",
        "plaintiffAttorney",
        "responsibility",
        "liability",
    ]
    for field_name in optional_fields:
        value = normalize_spaces(current.get(field_name) or "")
        if value:
            result[field_name] = value

    return result


def extract_transunion_public_records(page_artifacts: List[Any], page_numbers: List[int]) -> Dict[str, Any]:
    if not page_numbers:
        return {"publicRecordCount": 0, "records": []}

    rows = collect_rows_until_heading(
        page_artifacts,
        page_numbers,
        {
            "accounts",
            "accounts with adverse information",
            "satisfactory accounts",
            "inquiries",
            "account review inquiries",
            "credit report messages",
            "additional information",
        },
    )

    in_section = False
    section_lines: List[Dict[str, Any]] = []
    for entry in rows:
        heading = canonical_heading(entry["text"])
        if heading == "public records":
            in_section = True
            continue
        if not in_section:
            continue
        section_lines.append(entry)

    if not section_lines:
        return {"publicRecordCount": 0, "records": []}

    joined = " ".join(entry["text"] for entry in section_lines)
    if re.search(r"no public records reported", joined, re.IGNORECASE):
        return {
            "publicRecordCount": 0,
            "records": [],
            "status": "No public records reported.",
        }

    records: List[Dict[str, Any]] = []
    current: Optional[Dict[str, Any]] = None
    current_label: Optional[str] = None
    current_label_lines: List[str] = []
    prelude_lines: List[str] = []
    detail_lines: List[str] = []

    def flush_label() -> None:
        nonlocal current_label, current_label_lines
        if not current or not current_label:
            current_label = None
            current_label_lines = []
            return
        value = normalize_spaces(" ".join(current_label_lines))
        if value:
            current[current_label] = value
        current_label = None
        current_label_lines = []

    def finalize_current() -> None:
        nonlocal current, prelude_lines, detail_lines
        flush_label()
        finalized = finalize_transunion_public_record(current, prelude_lines, detail_lines)
        if finalized:
            records.append(finalized)
        current = None
        prelude_lines = []
        detail_lines = []

    for entry in section_lines:
        line = normalize_spaces(entry["text"])
        if not line:
            continue
        lowered = line.lower()
        if lowered.startswith("this section includes public record items") or lowered.startswith("may have obtained itself") or lowered.startswith("collected the public record item") or lowered.endswith("remains on your file for up to 10 years."):
            continue

        heading = canonical_heading(line)
        label_segments: List[Tuple[str, str]] = []
        columns = split_pipe_columns(line)
        if columns:
            index = 0
            while index < len(columns):
                label_key = TRANSUNION_PUBLIC_RECORD_FIELD_LABELS.get(canonical_heading(columns[index]))
                if not label_key:
                    index += 1
                    continue
                next_value = columns[index + 1] if index + 1 < len(columns) else ""
                next_key = TRANSUNION_PUBLIC_RECORD_FIELD_LABELS.get(canonical_heading(next_value)) if next_value else None
                if next_key:
                    label_segments.append((label_key, ""))
                    index += 1
                else:
                    label_segments.append((label_key, next_value))
                    index += 2 if next_value else 1
        if not label_segments:
            inline_match = re.match(r"^(.*?):\s*(.+)$", line)
            if inline_match:
                label_key = TRANSUNION_PUBLIC_RECORD_FIELD_LABELS.get(canonical_heading(inline_match.group(1)))
                if label_key:
                    label_segments = [(label_key, normalize_spaces(inline_match.group(2)))]
        if not label_segments:
            label_key = TRANSUNION_PUBLIC_RECORD_FIELD_LABELS.get(heading)
            if label_key:
                label_segments = [(label_key, "")]

        if label_segments:
            if current is None:
                current = {"sourcePages": [entry["page"]]}
            current["sourcePages"] = unique_preserve_order([*(current.get("sourcePages") or []), entry["page"]])
            detail_lines.append(line)
            for label_key, inline_value in label_segments:
                flush_label()
                current_label = label_key
                current_label_lines = [inline_value] if inline_value else []
            continue

        if current_label is not None:
            current_label_lines.append(line)
            detail_lines.append(line)
            continue

        if current is not None and (current.get("recordType") or current.get("dateFiled") or current.get("referenceNumber")):
            looks_like_next_record = (
                line == line.upper()
                and len(line.split()) <= 10
                and not re.search(r"https?://", line, re.IGNORECASE)
            )
            if looks_like_next_record:
                finalize_current()

        if current is None:
            current = {"sourcePages": [entry["page"]]}
        current["sourcePages"] = unique_preserve_order([*(current.get("sourcePages") or []), entry["page"]])
        prelude_lines.append(line)
        detail_lines.append(line)

    finalize_current()

    return {
        "publicRecordCount": len(records),
        "records": records,
        "status": "Records extracted from TransUnion public records section." if records else "No public records detected.",
    }


def derive_structured_sections_from_additional_information(
    additional_information: Dict[str, Any],
    source_pages: List[int],
) -> Tuple[Dict[str, Any], Dict[str, Any], Dict[str, Any]]:
    public_records: List[Dict[str, Any]] = []
    collections: List[Dict[str, Any]] = []
    consumer_indicators: List[Dict[str, Any]] = []

    for section in additional_information.get("sections") or []:
        if not isinstance(section, dict):
            continue
        title = normalize_spaces(section.get("title") or "")
        details = [normalize_spaces(line) for line in section.get("details") or [] if normalize_spaces(line)]
        lowered = title.lower()

        if looks_like_transunion_legal_public_record(title):
            public_records.append(
                {
                    "recordType": title,
                    "summary": title,
                    "details": details,
                    "sourcePages": source_pages,
                }
            )

        if "collection" in lowered:
            collections.append(
                {
                    "collectionAgency": title,
                    "comments": details,
                    "sourceText": " ".join(details),
                    "sourcePages": source_pages,
                }
            )

        if "consumer information" in lowered or "bankruptcy" in lowered:
            consumer_indicators.append(
                {
                    "code": None,
                    "description": title,
                    "category": "bankruptcy" if "bankruptcy" in lowered else "consumer_information",
                    "sourcePages": source_pages,
                }
            )

    return (
        {"publicRecordCount": len(public_records), "records": public_records},
        {"collectionCount": len(collections), "collections": collections},
        {"indicatorCount": len(consumer_indicators), "indicators": consumer_indicators},
    )



def extract_transunion_components(page_artifacts: List[Any]) -> Tuple[Dict[str, Any], List[Dict[str, Any]], Dict[str, List[int]], Dict[str, Dict[str, Any]]]:
    page_windows = discover_section_pages(page_artifacts)

    report_overview = extract_report_overview(page_artifacts, page_windows["reportOverview"] + page_windows["personalInformation"][:1])
    personal_information, personal_information_source_pages, personal_information_issues = extract_personal_information(
        page_artifacts,
        page_windows["personalInformation"],
    )
    adverse_accounts, adverse_issues = extract_transunion_account_section(page_artifacts, page_windows["adverseAccounts"], "adverse")
    satisfactory_accounts, satisfactory_issues = extract_transunion_account_section(page_artifacts, page_windows["satisfactoryAccounts"], "satisfactory")
    inquiries_component, inquiry_issues = extract_transunion_inquiries(page_artifacts, page_windows["inquiries"], "inquiries", "inquiries")
    account_review_component, account_review_issues = extract_transunion_inquiries(
        page_artifacts,
        page_windows["accountReviewInquiries"],
        "account review inquiries",
        "accountReviewInquiries",
    )
    credit_report_messages = extract_credit_report_messages(page_artifacts, page_windows["creditReportMessages"])
    additional_information = extract_additional_information(page_artifacts, page_windows["additionalInformation"])
    derived_public_records_component, collections_component, consumer_indicator_component = derive_structured_sections_from_additional_information(
        additional_information,
        unique_preserve_order(page_windows["additionalInformation"]),
    )
    public_records_component = extract_transunion_public_records(page_artifacts, page_windows["publicRecords"])
    if not (public_records_component.get("records") or []):
        public_records_component = derived_public_records_component
    components = {
        "reportOverview": report_overview,
        "personalInformation": personal_information,
        "publicRecords": public_records_component,
        "adverseAccounts": adverse_accounts,
        "satisfactoryAccounts": satisfactory_accounts,
        "inquiries": inquiries_component,
        "accountReviewInquiries": account_review_component,
        "creditReportMessages": credit_report_messages,
        "additionalInformation": additional_information,
        "collections": collections_component,
        "consumerInformationIndicators": consumer_indicator_component,
    }

    def source_pages_from_accounts(component: Dict[str, Any], fallback: List[int]) -> List[int]:
        pages = [page for account in component.get("accounts") or [] for page in account.get("sourcePages") or []]
        return unique_preserve_order(pages) or fallback

    def source_pages_from_inquiries(component: Dict[str, Any], fallback: List[int]) -> List[int]:
        pages = [page for inquiry in component.get("inquiries") or [] for page in inquiry.get("sourcePages") or []]
        return unique_preserve_order(pages) or fallback

    component_sources = {
        "reportOverview": {"pages": page_windows["reportOverview"]},
        "personalInformation": {"pages": personal_information_source_pages or page_windows["personalInformation"]},
        "publicRecords": {
            "pages": public_records_component.get("records") and unique_preserve_order(page_windows["publicRecords"]) or []
        },
        "adverseAccounts": {"pages": source_pages_from_accounts(adverse_accounts, page_windows["adverseAccounts"])},
        "satisfactoryAccounts": {"pages": source_pages_from_accounts(satisfactory_accounts, page_windows["satisfactoryAccounts"])},
        "accounts": {"pages": unique_preserve_order(source_pages_from_accounts(adverse_accounts, []) + source_pages_from_accounts(satisfactory_accounts, []))},
        "inquiries": {"pages": source_pages_from_inquiries(inquiries_component, page_windows["inquiries"])},
        "accountReviewInquiries": {"pages": source_pages_from_inquiries(account_review_component, page_windows["accountReviewInquiries"])},
        "creditReportMessages": {"pages": page_windows["creditReportMessages"]},
        "additionalInformation": {"pages": page_windows["additionalInformation"]},
        "collections": {"pages": collections_component.get("collections") and unique_preserve_order(page_windows["additionalInformation"]) or []},
        "consumerInformationIndicators": {"pages": consumer_indicator_component.get("indicators") and unique_preserve_order(page_windows["additionalInformation"]) or []},
    }
    public_record_pages = unique_preserve_order(
        [
            page
            for record in public_records_component.get("records") or []
            for page in record.get("sourcePages") or []
        ]
    )
    component_sources["publicRecords"] = {
        "pages": public_record_pages or component_sources["publicRecords"]["pages"]
    }

    validation_issues = personal_information_issues + adverse_issues + satisfactory_issues + inquiry_issues + account_review_issues
    if not ((adverse_accounts.get("accountCount") or 0) + (satisfactory_accounts.get("accountCount") or 0)):
        validation_issues.append(
            {
                "component": "adverseAccounts",
                "severity": "error",
                "code": "no_accounts_detected",
                "message": "No TransUnion accounts were detected.",
            }
        )

    return components, validation_issues, page_windows, component_sources
