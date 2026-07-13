import re
from typing import Any, Dict, Iterable, List, Optional, Tuple

EXPERIAN_COMPONENT_NAMES = [
    "reportOverview",
    "personalInformation",
    "accounts",
    "publicRecords",
    "hardInquiries",
    "softInquiries",
]

MONTH_COLUMNS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
EXPERIAN_PAYMENT_STATUS_CODES = {
    "30": "30 days late",
    "60": "60 days late",
    "90": "90 days late",
    "120": "120 days past due",
    "150": "150 days past due",
    "180": "180 days past due",
    "OK": "Paid on time",
    "ND": "No data for this period",
    "CO": "Charge-off",
    "COL": "In collections",
    "C": "Collection account",
    "CLS": "Closed",
    "R": "Repossession",
    "F": "Foreclosure",
    "V": "Voluntary surrender",
    "VS": "Voluntary surrender",
    "TNT": "Too new to rate",
    "B": "Included in bankruptcy",
    "X": "No data available",
}

BLANK_PAYMENT_STATUS_CODES = {"ND", "X"}
MISSING_SLOT_PAYMENT_STATUS_CODES = {"X"}

KNOWN_TOP_LEVEL_HEADINGS = {
    "prepared for",
    "at a glance",
    "personal information",
    "names",
    "addresses",
    "social security numbers",
    "ssn variations",
    "year of birth",
    "phone numbers",
    "spouse or co-applicant",
    "employers",
    "personal statements",
    "other records",
    "accounts",
    "public records",
    "hard inquiries",
    "soft inquiries",
    "know your rights",
    "contact experian",
    "public records information",
    "important messages",
    "medical information",
}

ACCOUNT_SECTION_HEADINGS = {
    "account info": "accountInfo",
    "payment history": "paymentHistory",
    "balance histories": "balanceHistories",
    "additional info": "additionalInfo",
    "historical info": "historicalInfo",
    "contact info": "contactInfo",
    "comment": "comment",
    "your statement": "consumerStatement",
    "reinvestigation info": "reinvestigationInfo",
}
PERSONAL_INFO_ALERT_PATTERNS = re.compile(
    r"\b(victim alert|fraud|file locked|security freeze|locked at consumer'?s request|consumer request)\b",
    re.IGNORECASE,
)

DATE_PATTERN = r"(?:[A-Z][a-z]{2,8}\s+\d{1,2},\s+\d{4}|[A-Z][a-z]{2,8}\s+\d{4}|\d{1,2}/\d{1,2}/\d{2,4})"
ADDRESS_TYPE_LINES = {
    "single family",
    "apartment",
    "multifamily",
    "complex",
    "condominium",
    "townhouse",
    "duplex",
    "cellular",
    "residential",
}
ACCOUNT_INFO_LABEL_MAP = {
    "account name": "accountName",
    "balance": "balance",
    "account number": "accountNumber",
    "balance updated": "balanceUpdated",
    "account type": "accountType",
    "recent payment": "recentPayment",
    "responsibility": "responsibility",
    "monthly payment": "monthlyPayment",
    "date opened": "dateOpened",
    "original balance": "originalBalance",
    "status": "status",
    "highest balance": "highestBalance",
    "status updated": "statusUpdated",
    "terms": "terms",
    "on record until": "onRecordUntil",
}
HISTORICAL_INFO_LABEL_MAP = {
    "original creditor": "originalCreditor",
}


def normalize_spaces(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


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


def parse_currency(value: Any) -> Optional[str]:
    cleaned = normalize_spaces(value)
    if not cleaned or cleaned in {"-", "—"}:
        return cleaned or None
    match = re.search(r"\$\s*[\d,]+(?:\.\d{2})?", cleaned)
    if match:
        return match.group(0).replace(" ", "")
    return cleaned


def canonical_heading(text: Any) -> str:
    clean = normalize_spaces(text)
    clean = re.sub(r"^[^A-Za-z0-9]+", "", clean)
    return clean.lower()


def titleized_label(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip().title()


def page_text_lines(page: Any) -> List[str]:
    raw_text = getattr(page, "text_layer", None) or getattr(page, "fused_text", "")
    lines: List[str] = []
    for raw_line in str(raw_text).splitlines():
        line = normalize_spaces(raw_line)
        if not line:
            continue
        lowered = line.lower()
        if lowered == "annual credit report - experian":
            continue
        if "annual credit report - experian" in lowered:
            continue
        if "experian.com/acr/printreport" in lowered:
            continue
        if re.fullmatch(r"https?://\S+", line):
            continue
        if re.fullmatch(r"page\s+\d+\s+of\s+\d+", lowered):
            continue
        if re.fullmatch(r"\d{1,2}/\d{1,2}/\d{2,4},\s+\d{1,2}:\d{2}\s*(?:am|pm)", lowered):
            continue
        lines.append(line)
    return lines


def page_rows(page: Any) -> List[Dict[str, Any]]:
    result: List[Dict[str, Any]] = []
    for row in getattr(page, "layout_rows", []) or []:
        text = normalize_spaces(row.get("text") or "")
        if not text:
            continue
        lowered = text.lower()
        if lowered == "annual credit report - experian":
            continue
        if "annual credit report - experian" in lowered:
            continue
        if "experian.com/acr/printreport" in lowered:
            continue
        if re.fullmatch(r"https?://\S+", text):
            continue
        if re.fullmatch(r"page\s+\d+\s+of\s+\d+", lowered):
            continue
        if re.fullmatch(r"\d{1,2}/\d{1,2}/\d{2,4},\s+\d{1,2}:\d{2}\s*(?:am|pm)", lowered):
            continue
        result.append({**row, "text": text})
    return result


def page_has_heading(page: Any, heading: str) -> bool:
    target = heading.lower()
    for line in page_text_lines(page):
        if canonical_heading(line) == target:
            return True
    return False


def first_page_with_heading(page_artifacts: List[Any], heading: str, start_page: int = 1) -> Optional[int]:
    for page in page_artifacts[start_page - 1 :]:
        if page_has_heading(page, heading):
            return int(getattr(page, "page_number"))
    return None


def discover_section_pages(page_artifacts: List[Any]) -> Dict[str, List[int]]:
    total_pages = len(page_artifacts)
    accounts_start = first_page_with_heading(page_artifacts, "accounts") or 1
    public_records_start = first_page_with_heading(page_artifacts, "public records", start_page=accounts_start) or total_pages
    hard_start = first_page_with_heading(page_artifacts, "hard inquiries", start_page=public_records_start) or public_records_start
    soft_start = first_page_with_heading(page_artifacts, "soft inquiries", start_page=hard_start) or hard_start
    rights_start = (
        first_page_with_heading(page_artifacts, "know your rights", start_page=soft_start)
        or first_page_with_heading(page_artifacts, "contact experian", start_page=soft_start)
        or total_pages + 1
    )

    return {
        "reportOverview": [1],
        "personalInformation": list(range(1, min(accounts_start, total_pages) + 1)),
        "accounts": list(range(accounts_start, min(public_records_start, total_pages) + 1)),
        "publicRecords": list(range(public_records_start, min(hard_start, total_pages) + 1)),
        "hardInquiries": list(range(hard_start, min(soft_start, total_pages) + 1)),
        "softInquiries": list(range(soft_start, min(max(soft_start, rights_start - 1), total_pages) + 1)),
    }


def extract_report_overview(page_artifacts: List[Any], page_numbers: List[int]) -> Dict[str, Any]:
    page_number = page_numbers[0] if page_numbers else 1
    page = page_artifacts[max(0, page_number - 1)]
    text = "\n".join(page_text_lines(page))

    def extract_first(patterns: List[str]) -> str:
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
            if match:
                return normalize_spaces(match.group(1))
        return ""

    return {
        "consumerName": extract_first([
            r"Prepared For\s+([A-Z][A-Z\s\.'\-]{3,})\s+Personal",
            r"Prepared For\s+([A-Z][A-Z\s\.'\-]{3,})",
        ]),
        "dateGenerated": extract_first([
            rf"Date Generated\s+({DATE_PATTERN})",
        ]),
        "reportNumber": extract_first([
            r"Report Number\s+([A-Z0-9\-]{6,})",
        ]),
        "atAGlance": {
            "accountCount": int(extract_first([r"At a(?:\s+|\n+)Glance\s+(\d+)\s+Accounts", r"(\d+)\s+Accounts"]) or 0),
            "publicRecordCount": int(extract_first([r"(\d+)\s+Public Records"]) or 0),
            "hardInquiryCount": int(extract_first([r"(\d+)\s+Hard Inquiries"]) or 0),
        },
        "personalInfoCounts": {
            "nameCount": int(extract_first([r"(\d+)\s+Names"]) or 0),
            "addressCount": int(extract_first([r"(\d+)\s+Addresses"]) or 0),
            "employerCount": int(extract_first([r"(\d+)\s+Employers"]) or 0),
            "personalStatementCount": int(extract_first([r"(\d+)\s+Personal Statements"]) or 0),
            "otherRecordCount": int(extract_first([r"(\d+)\s+Other Records"]) or 0),
        },
    }


def collect_lines_until_heading(page_artifacts: List[Any], page_numbers: List[int], stop_headings: Iterable[str]) -> List[Dict[str, Any]]:
    stop = {heading.lower() for heading in stop_headings}
    collected: List[Dict[str, Any]] = []
    for page_number in page_numbers:
        page = page_artifacts[page_number - 1]
        for line in page_text_lines(page):
            heading = canonical_heading(line)
            if heading in stop or any(heading.startswith(f"{entry} ") for entry in stop):
                return collected
            collected.append({"page": page_number, "text": line})
    return collected


def collect_rows_until_heading(page_artifacts: List[Any], page_numbers: List[int], stop_headings: Iterable[str]) -> List[Dict[str, Any]]:
    stop = {heading.lower() for heading in stop_headings}
    collected: List[Dict[str, Any]] = []
    for page_number in page_numbers:
        page = page_artifacts[page_number - 1]
        for row in page_rows(page):
            heading = canonical_heading(row.get("text"))
            if heading in stop or any(heading.startswith(f"{entry} ") for entry in stop):
                return collected
            collected.append({"page": page_number, "text": row["text"], "row": row})
    return collected


def slice_personal_sections(page_artifacts: List[Any], page_numbers: List[int]) -> Dict[str, List[Dict[str, Any]]]:
    known_sections = {
        "names": "names",
        "addresses": "addresses",
        "social security numbers": "socialSecurityNumbers",
        "ssn variations": "socialSecurityNumbers",
        "year of birth": "yearOfBirth",
        "phone numbers": "phoneNumbers",
        "spouse or co-applicant": "spouseOrCoApplicant",
        "employers": "employers",
        "personal statements": "personalStatements",
        "other records": "otherRecords",
    }
    sections: Dict[str, List[Dict[str, Any]]] = {
        "names": [],
        "addresses": [],
        "socialSecurityNumbers": [],
        "yearOfBirth": [],
        "phoneNumbers": [],
        "spouseOrCoApplicant": [],
        "employers": [],
        "personalStatements": [],
        "otherRecords": [],
    }
    current_section: Optional[str] = None
    in_personal_information = False

    for entry in collect_rows_until_heading(page_artifacts, page_numbers, {"accounts"}):
        line = entry["text"]
        heading = canonical_heading(line)
        if heading == "personal information":
            in_personal_information = True
            current_section = None
            continue
        if not in_personal_information:
            continue
        if heading in known_sections:
            current_section = known_sections[heading]
            continue
        if current_section:
            sections[current_section].append(entry)

    return sections


def parse_name_entries(rows: List[Dict[str, Any]]) -> List[str]:
    columns: List[float] = []
    active: Dict[int, List[str]] = {}
    names: List[str] = []

    def column_index(x_position: float) -> int:
        for index, existing in enumerate(columns):
            if abs(existing - x_position) <= 45:
                return index
        columns.append(x_position)
        return len(columns) - 1

    def flush_column(index: int) -> None:
        current = normalize_spaces(" ".join(active.get(index) or []))
        if current and not re.fullmatch(r"#\d{3,}", current):
            names.append(current)
        active[index] = []

    for entry in rows:
        row = entry.get("row") or {}
        blocks = sorted(row.get("blocks") or [], key=lambda item: item.get("bbox", {}).get("xMin", 0.0))
        for block in blocks:
            text = normalize_spaces(block.get("text") or "")
            if not text:
                continue
            index = column_index(block.get("bbox", {}).get("xMin", 0.0))
            lowered = canonical_heading(text)
            if lowered.startswith("name id") or re.fullmatch(r"#\d{3,}", text):
                flush_column(index)
                continue
            active.setdefault(index, [])
            active[index].append(text)

    for index in range(len(columns)):
        flush_column(index)

    return [name for name in names if name]


def parse_address_entries(rows: List[Dict[str, Any]]) -> List[str]:
    def is_metadata(text: str) -> bool:
        lowered = canonical_heading(text)
        if not lowered:
            return True
        if lowered.startswith("address id"):
            return True
        if re.fullmatch(r"#?\d{6,}", text):
            return True
        if lowered in ADDRESS_TYPE_LINES:
            return True
        return False

    columns: List[float] = []
    active: Dict[int, List[str]] = {}
    addresses: List[str] = []

    def column_index(x_position: float) -> int:
        for index, existing in enumerate(columns):
            if abs(existing - x_position) <= 45:
                return index
        columns.append(x_position)
        return len(columns) - 1

    def flush_column(index: int) -> None:
        current = normalize_spaces(" ".join(active.get(index) or []))
        if current:
            addresses.append(current)
        active[index] = []

    for entry in rows:
        row = entry.get("row") or {}
        blocks = sorted(row.get("blocks") or [], key=lambda item: item.get("bbox", {}).get("xMin", 0.0))
        if not blocks:
            continue
        for block in blocks:
            text = normalize_spaces(block.get("text") or "")
            if not text:
                continue
            index = column_index(block.get("bbox", {}).get("xMin", 0.0))
            if is_metadata(text):
                flush_column(index)
                continue
            active.setdefault(index, [])
            active[index].append(text)

    for index in range(len(columns)):
        flush_column(index)

    return unique_preserve_order([address for address in addresses if address])


def parse_employer_entries(rows: List[Dict[str, Any]]) -> List[str]:
    columns: List[float] = []
    values: Dict[int, List[str]] = {}

    def column_index(x_position: float) -> int:
        for index, existing in enumerate(columns):
            if abs(existing - x_position) <= 45:
                return index
        columns.append(x_position)
        return len(columns) - 1

    for entry in rows:
        row = entry.get("row") or {}
        blocks = sorted(row.get("blocks") or [], key=lambda item: item.get("bbox", {}).get("xMin", 0.0))
        for block in blocks:
            text = normalize_spaces(block.get("text") or "")
            if not text:
                continue
            index = column_index(block.get("bbox", {}).get("xMin", 0.0))
            values.setdefault(index, [])
            values[index].append(text)

    employers = [normalize_spaces(" ".join(values.get(index) or [])) for index in range(len(columns))]
    return unique_preserve_order([employer for employer in employers if employer])


def parse_tagged_personal_entries(rows: List[Dict[str, Any]], label: str) -> List[str]:
    columns: List[float] = []
    values: Dict[int, List[str]] = {}

    def column_index(x_position: float) -> int:
        for index, existing in enumerate(columns):
            if abs(existing - x_position) <= 45:
                return index
        columns.append(x_position)
        return len(columns) - 1

    for entry in rows:
        row = entry.get("row") or {}
        blocks = sorted(row.get("blocks") or [], key=lambda item: item.get("bbox", {}).get("xMin", 0.0))
        if not blocks:
            text = normalize_spaces(entry.get("text") or "")
            if text:
                values.setdefault(0, []).append(text)
            continue
        for block in blocks:
            text = normalize_spaces(block.get("text") or "")
            if not text:
                continue
            lowered = canonical_heading(text)
            if lowered.startswith("name id") or lowered.startswith("address id"):
                continue
            if re.fullmatch(r"#?\d{6,}", text):
                continue
            if lowered in ADDRESS_TYPE_LINES:
                continue
            index = column_index(block.get("bbox", {}).get("xMin", 0.0))
            values.setdefault(index, []).append(text)

    tagged_values: List[str] = []
    for index in range(max(len(columns), len(values))):
        entry_value = normalize_spaces(" ".join(values.get(index) or []))
        if entry_value:
            tagged_values.append(f"{label}: {entry_value}")
    return unique_preserve_order(tagged_values)


def extract_personal_information(page_artifacts: List[Any], page_numbers: List[int]) -> Dict[str, Any]:
    sections = slice_personal_sections(page_artifacts, page_numbers)
    year_of_birth = next(
        (
            normalize_spaces(entry.get("text") or "")
            for entry in sections["yearOfBirth"]
            if re.fullmatch(r"\d{4}", normalize_spaces(entry.get("text") or ""))
        ),
        "",
    )
    phone_numbers = re.findall(
        r"\(\d{3}\)\s*\d{3}-?\d{4}",
        "\n".join(normalize_spaces(entry.get("text") or "") for entry in sections["phoneNumbers"]),
    )
    other_records = unique_preserve_order(
        parse_tagged_personal_entries(sections["socialSecurityNumbers"], "Social Security Number Variation")
        + parse_tagged_personal_entries(sections["spouseOrCoApplicant"], "Spouse or Co-Applicant")
        + parse_tagged_personal_entries(sections["otherRecords"], "Other Record")
    )
    personal_statements: List[str] = []
    if sections["personalStatements"]:
        statement_text = normalize_spaces(
            " ".join(normalize_spaces(entry.get("text") or "") for entry in sections["personalStatements"])
        )
        if statement_text and not PERSONAL_INFO_ALERT_PATTERNS.search(statement_text):
            personal_statements = [statement_text]
    employers = parse_employer_entries(sections["employers"])

    return {
        "names": parse_name_entries(sections["names"]),
        "addresses": parse_address_entries(sections["addresses"]),
        "yearOfBirth": year_of_birth,
        "phoneNumbers": unique_preserve_order(phone_numbers),
        "employers": employers,
        "personalStatements": personal_statements,
        "otherRecords": other_records,
    }


def parse_key_value_lines(lines: List[str], label_map: Dict[str, str]) -> Dict[str, str]:
    result: Dict[str, str] = {}
    current_key: Optional[str] = None
    buffer: List[str] = []

    def flush() -> None:
        nonlocal current_key, buffer
        if current_key is not None:
            result[current_key] = normalize_spaces(" ".join(buffer)) if buffer else "Not reported"
        current_key = None
        buffer = []

    for line in lines:
        heading = canonical_heading(line)
        mapped = label_map.get(heading)
        if mapped:
            flush()
            current_key = mapped
            continue
        if current_key is not None:
            buffer.append(line)
    flush()
    return result


def normalize_payment_token(token: str) -> Optional[str]:
    clean = token.strip().strip(",")
    if not clean:
        return None
    icon_only = "".join(character for character in clean if not character.isspace())
    if icon_only and all("\ue000" <= character <= "\uf8ff" for character in icon_only):
        return "OK"
    if clean in {"", "✓", "✔"}:
        return "OK"
    if clean in {"—", "-", "–"}:
        return "X"
    clean = clean.upper()
    if clean in {"OK", "ND", "CO", "COL", "C", "R", "F", "V", "VS", "B", "CLS", "TNT", "X"}:
        return clean
    if clean.isdigit() and clean in {"30", "60", "90", "120", "150", "180"}:
        return clean
    return None


def is_blank_payment_token(token: str) -> bool:
    normalized = normalize_payment_token(token)
    return normalized in BLANK_PAYMENT_STATUS_CODES


def expand_payment_tokens(tokens: Iterable[str]) -> List[str]:
    expanded: List[str] = []
    for token in tokens:
        pieces = [piece for piece in re.split(r"\s+", normalize_spaces(token)) if piece]
        if not pieces:
            continue
        recognized_any = False
        for piece in pieces:
            normalized = normalize_payment_token(piece)
            if normalized is not None:
                expanded.append(normalized)
                recognized_any = True
        if recognized_any:
            continue
        normalized = normalize_payment_token(token)
        if normalized is not None:
            expanded.append(normalized)
    return expanded


def is_payment_month_header_token(token: str) -> bool:
    clean = normalize_spaces(token).lower().strip(".")
    return clean in {
        "j",
        "f",
        "m",
        "a",
        "s",
        "o",
        "n",
        "d",
        "jan",
        "feb",
        "mar",
        "apr",
        "may",
        "jun",
        "jul",
        "aug",
        "sep",
        "sept",
        "oct",
        "nov",
        "dec",
        "january",
        "february",
        "march",
        "april",
        "june",
        "july",
        "august",
        "september",
        "october",
        "november",
        "december",
    }


def extract_payment_month_columns(blocks: List[Dict[str, Any]], row_entry: Dict[str, Any]) -> Optional[Dict[str, Dict[str, float]]]:
    header_blocks = [
        block
        for block in sorted(blocks, key=lambda item: (item["bbox"]["xMin"], item["bbox"]["yMin"]))
        if is_payment_month_header_token(block.get("text") or "")
    ]
    if len(header_blocks) < 12:
        return None
    header_blocks = header_blocks[:12]
    centers = [
        (float(block["bbox"]["xMin"]) + float(block["bbox"]["xMax"])) / 2.0
        for block in header_blocks
    ]
    boundaries = build_month_boundaries(centers, row_entry)
    if len(boundaries) != len(MONTH_COLUMNS) + 1:
        return None
    return {
        month: {
            "centerX": centers[index],
            "xMin": float(boundaries[index]),
            "xMax": float(boundaries[index + 1]),
        }
        for index, month in enumerate(MONTH_COLUMNS)
    }


def payment_month_columns_from_section_rows(rows: List[Dict[str, Any]]) -> Optional[Dict[str, Dict[str, float]]]:
    for row_entry in rows:
        blocks = [
            block
            for block in sorted((row_entry.get("row") or {}).get("blocks") or [], key=lambda item: (item["bbox"]["xMin"], item["bbox"]["yMin"]))
            if normalize_spaces(block.get("text") or "")
        ]
        if not blocks:
            continue
        month_hits = sum(1 for block in blocks if is_payment_month_header_token(block.get("text") or ""))
        if month_hits >= 8:
            columns = extract_payment_month_columns(blocks, row_entry)
            if columns:
                return columns
    return None


def align_payment_blocks_to_months(
    blocks: List[Dict[str, Any]],
    month_columns: Dict[str, Dict[str, float]],
) -> Dict[str, Dict[str, Any]]:
    assignments: Dict[str, Dict[str, Any]] = {}
    remaining_months = list(MONTH_COLUMNS)
    ordered_blocks = sorted(blocks, key=lambda item: (item["bbox"]["xMin"], item["bbox"]["yMin"]))
    for block in ordered_blocks:
        bbox = block.get("bbox") or {}
        center_x = (float(bbox.get("xMin") or 0.0) + float(bbox.get("xMax") or 0.0)) / 2.0
        candidates = []
        for month in remaining_months:
            column = month_columns.get(month) or {}
            width = max(10.0, float(column.get("xMax") or 0.0) - float(column.get("xMin") or 0.0))
            distance = abs(center_x - float(column.get("centerX") or 0.0))
            candidates.append((distance, width, month))
        if not candidates:
            break
        distance, width, month = min(candidates, key=lambda item: item[0])
        if distance > max(24.0, width * 0.9):
            continue
        assignments[month] = block
        remaining_months.remove(month)
    return assignments


def row_vertical_bbox(blocks: List[Dict[str, Any]], row_entry: Dict[str, Any]) -> Optional[Dict[str, float]]:
    row_bbox = (row_entry.get("row") or {}).get("bbox")
    if isinstance(row_bbox, dict):
        return {
            "xMin": float(row_bbox.get("xMin") or 0.0),
            "xMax": float(row_bbox.get("xMax") or 0.0),
            "yMin": float(row_bbox.get("yMin") or 0.0),
            "yMax": float(row_bbox.get("yMax") or 0.0),
        }
    merged = merge_block_bboxes(blocks)
    if not merged:
        return None
    return {
        "xMin": float(merged.get("xMin") or 0.0),
        "xMax": float(merged.get("xMax") or 0.0),
        "yMin": float(merged.get("yMin") or 0.0),
        "yMax": float(merged.get("yMax") or 0.0),
    }


def build_payment_history_gap_slots(
    year: str,
    row_entry: Dict[str, Any],
    blocks: List[Dict[str, Any]],
    month_columns: Dict[str, Dict[str, float]],
    assigned_months: Dict[str, Dict[str, Any]],
) -> List[Dict[str, Any]]:
    if not month_columns:
        return []
    vertical_bbox = row_vertical_bbox(blocks, row_entry)
    if not vertical_bbox:
        return []
    y_min = float(vertical_bbox["yMin"])
    y_max = float(vertical_bbox["yMax"])
    if y_max <= y_min:
        return []

    gap_slots: List[Dict[str, Any]] = []
    row_index = int((row_entry.get("row") or {}).get("rowIndex") or 0)
    page_number = int(row_entry.get("page") or 0)
    if page_number <= 0:
        return []

    for month in MONTH_COLUMNS:
        if month in assigned_months:
            continue
        column = month_columns.get(month)
        if not column:
            continue
        x_min = float(column["xMin"])
        x_max = float(column["xMax"])
        if x_max <= x_min:
            continue
        horizontal_inset = max(1.5, (x_max - x_min) * 0.08)
        vertical_inset = max(0.8, (y_max - y_min) * 0.08)
        bbox = {
            "xMin": x_min + horizontal_inset,
            "xMax": x_max - horizontal_inset,
            "yMin": y_min + vertical_inset,
            "yMax": y_max - vertical_inset,
        }
        gap_slots.append(make_gap_slot_cell(year, month, page_number, row_index, bbox))
    return gap_slots


def parse_payment_history(lines: List[str]) -> Dict[str, Any]:
    rows: List[Dict[str, str]] = []
    current_year: Optional[str] = None
    current_values: List[str] = []
    month_header_seen = False

    for line in lines:
        heading = canonical_heading(line)
        if heading in {"balance histories", "historical info", "contact info", "comment", "public records"}:
            break
        tokens = [token for token in re.split(r"\s+", line) if token]
        if not month_header_seen:
            month_hits = sum(1 for token in tokens if token.lower() in {"j", "f", "m", "a", "s", "o", "n", "d", *MONTH_COLUMNS})
            if month_hits >= 8:
                month_header_seen = True
                continue
        year_match = re.match(r"^(\d{4})(?:\s+(.*))?$", line)
        if year_match:
            if current_year and current_values:
                row = {"year": current_year}
                for index, month in enumerate(MONTH_COLUMNS):
                    row[month] = current_values[index] if index < len(current_values) else "X"
                rows.append(row)
            current_year = year_match.group(1)
            current_values = expand_payment_tokens((year_match.group(2) or "").split())
            continue
        if current_year is None:
            continue
        if line.lower().startswith("payment history guide") or line.lower().startswith("this account is scheduled"):
            continue
        for normalized in expand_payment_tokens(tokens):
            if len(current_values) < 12:
                current_values.append(normalized)
    if current_year:
        row = {"year": current_year}
        for index, month in enumerate(MONTH_COLUMNS):
            row[month] = current_values[index] if index < len(current_values) else "X"
        rows.append(row)

    return {
        "rows": rows,
        "paymentStatusCodes": EXPERIAN_PAYMENT_STATUS_CODES,
    }


def collect_account_section_text_lines(
    page_artifacts: List[Any],
    source_pages: List[int],
    start_heading: str,
    stop_headings: Iterable[str],
) -> List[str]:
    lines: List[str] = []
    collecting = False
    saw_year_row = False
    stop_set = {normalize_spaces(str(heading)).lower() for heading in stop_headings}

    for page_number in source_pages:
        if not 1 <= page_number <= len(page_artifacts):
            continue
        for line in page_text_lines(page_artifacts[page_number - 1]):
            heading = canonical_heading(line)
            if not collecting:
                if heading == start_heading:
                    collecting = True
                continue
            if saw_year_row and (
                heading in stop_set
                or heading == "account info"
                or is_meaningful_account_header(line)
            ):
                return lines
            if re.match(r"^\d{4}(?:\s+.+)?$", line):
                saw_year_row = True
            lines.append(line)
    return lines


def payment_history_year_row_entry(row_entry: Dict[str, Any]) -> Optional[str]:
    row = row_entry.get("row") or {}
    blocks = [
        block
        for block in sorted(row.get("blocks") or [], key=lambda item: (item["bbox"]["xMin"], item["bbox"]["yMin"]))
        if normalize_spaces(block.get("text") or "")
    ]
    if blocks:
        first_text = normalize_spaces(blocks[0].get("text") or "")
        year_match = re.match(r"^(\d{4})$", first_text)
        if year_match:
            return year_match.group(1)
    text = normalize_spaces(str(row_entry.get("text") or ""))
    year_match = re.match(r"^(\d{4})\b", text)
    return year_match.group(1) if year_match else None


def payment_history_year_bbox(row_entry: Dict[str, Any], year: str) -> Optional[Dict[str, float]]:
    row = row_entry.get("row") or {}
    blocks = sorted(row.get("blocks") or [], key=lambda item: (item["bbox"]["xMin"], item["bbox"]["yMin"]))
    for block in blocks:
        text = normalize_spaces(block.get("text") or "")
        if text == year:
            bbox = block.get("bbox") or {}
            return {
                "xMin": float(bbox.get("xMin") or 0.0),
                "xMax": float(bbox.get("xMax") or 0.0),
                "yMin": float(bbox.get("yMin") or 0.0),
                "yMax": float(bbox.get("yMax") or 0.0),
            }
    row_bbox = row.get("bbox") or {}
    if not row_bbox:
        return None
    return {
        "xMin": float(row_bbox.get("xMin") or 0.0),
        "xMax": float(row_bbox.get("xMax") or 0.0),
        "yMin": float(row_bbox.get("yMin") or 0.0),
        "yMax": float(row_bbox.get("yMax") or 0.0),
    }


def merge_missing_payment_history_rows(
    parsed_rows: List[Dict[str, str]],
    evidence_rows: Dict[str, Dict[str, Dict[str, Dict[str, Any]]]],
    row_entries: List[Dict[str, Any]],
    month_columns: Optional[Dict[str, Dict[str, float]]],
    fallback_rows: List[Dict[str, str]],
) -> Tuple[List[Dict[str, str]], Dict[str, Dict[str, Dict[str, Dict[str, Any]]]]]:
    if not fallback_rows or not month_columns:
        return parsed_rows, evidence_rows

    parsed_by_year = {str(row.get("year") or ""): row for row in parsed_rows if row.get("year")}
    row_entry_by_year: Dict[str, Dict[str, Any]] = {}
    for row_entry in row_entries:
        year = payment_history_year_row_entry(row_entry)
        if year and year not in row_entry_by_year:
            row_entry_by_year[year] = row_entry

    for fallback_row in fallback_rows:
        year = str(fallback_row.get("year") or "")
        if not year or year in parsed_by_year:
            continue
        row_entry = row_entry_by_year.get(year)
        year_bbox = payment_history_year_bbox(row_entry, year) if row_entry else None
        if not row_entry or not year_bbox:
            continue

        projected_row = {"year": year}
        for month in MONTH_COLUMNS:
            value = str(fallback_row.get(month) or "X")
            projected_row[month] = value
            column = month_columns.get(month)
            if not column:
                continue
            horizontal_inset = max(1.5, (float(column["xMax"]) - float(column["xMin"])) * 0.08)
            vertical_inset = max(0.8, (float(year_bbox["yMax"]) - float(year_bbox["yMin"])) * 0.08)
            bbox = {
                "xMin": float(column["xMin"]) + horizontal_inset,
                "xMax": float(column["xMax"]) - horizontal_inset,
                "yMin": float(year_bbox["yMin"]) + vertical_inset,
                "yMax": float(year_bbox["yMax"]) - vertical_inset,
            }
            add_history_cell(
                evidence_rows,
                "paymentHistory",
                year,
                month,
                make_history_cell(
                    year,
                    month,
                    value,
                    row_entry,
                    bbox,
                    "text_projection",
                ),
            )
            if value in MISSING_SLOT_PAYMENT_STATUS_CODES:
                add_history_cell(
                    evidence_rows,
                    "paymentHistoryGapSlots",
                    year,
                    month,
                    make_gap_slot_cell(
                        year,
                        month,
                        int(row_entry.get("page") or 0),
                        int((row_entry.get("row") or {}).get("rowIndex") or 0),
                        bbox,
                        source="text_projection_blank_slot",
                    ),
                )
        parsed_by_year[year] = projected_row

    merged_rows = sorted(parsed_by_year.values(), key=lambda row: int(str(row.get("year") or 0)), reverse=True)
    return merged_rows, evidence_rows


def parse_balance_histories(lines: List[str]) -> List[Dict[str, str]]:
    entries: List[Dict[str, str]] = []
    current: Optional[Dict[str, str]] = None
    for line in lines:
        lowered = line.lower()
        if lowered.startswith("additional info"):
            break
        if re.fullmatch(r"[A-Z][a-z]{2,8}\s+\d{4}", line):
            if current:
                entries.append(current)
            current = {
                "date": line,
                "balance": "Not reported",
                "scheduledPayment": "Not reported",
                "paid": "Not reported",
            }
            continue
        if current is None:
            continue
        if current["balance"] == "Not reported":
            current["balance"] = parse_currency(line) or normalize_spaces(line)
        elif current["scheduledPayment"] == "Not reported":
            current["scheduledPayment"] = parse_currency(line) or normalize_spaces(line)
        elif current["paid"] == "Not reported":
            current["paid"] = normalize_spaces(line)
        else:
            current["paid"] = normalize_spaces(f"{current['paid']} {line}")
    if current:
        entries.append(current)
    return entries


def parse_contact_info(lines: List[str]) -> Dict[str, Any]:
    address: List[str] = []
    phone_number: Optional[str] = None
    current = None
    for line in lines:
        heading = canonical_heading(line)
        if heading == "address":
            current = "address"
            continue
        if heading == "phone number":
            current = "phone"
            continue
        if current == "address":
            address.append(line)
        elif current == "phone":
            phone_number = normalize_spaces(line)
            current = None
    return {
        "address": [normalize_spaces(" ".join(address))] if address else [],
        "phoneNumber": phone_number,
    }


def parse_comment_info(lines: List[str]) -> Dict[str, List[str]]:
    current_comments: List[str] = []
    previous_comments: List[str] = []
    target = None
    for line in lines:
        heading = canonical_heading(line)
        if heading == "current:":
            target = current_comments
            continue
        if heading == "previous:":
            target = previous_comments
            continue
        if target is not None:
            target.append(line)
    return {
        "current": current_comments,
        "previous": previous_comments,
    }


def is_meaningful_account_header(text: str) -> bool:
    clean = normalize_spaces(text)
    heading = canonical_heading(clean)
    if not clean:
        return False
    if heading in KNOWN_TOP_LEVEL_HEADINGS or heading in ACCOUNT_SECTION_HEADINGS:
        return False
    if heading in {"potentially negative", "your statement", "reinvestigation info", "current:", "previous:"}:
        return False
    if clean.lower().startswith("https://") or re.fullmatch(r"page\s+\d+\s+of\s+\d+", clean.lower()):
        return False
    if re.search(r"\binquired on\b", clean, re.IGNORECASE):
        return False
    if re.search(r"\b(?:payment history guide|this account is scheduled|includes credit cards)\b", clean, re.IGNORECASE):
        return False
    letters = re.findall(r"[A-Za-z]", clean)
    if not letters:
        return False
    uppercase_ratio = sum(1 for char in letters if char.isupper()) / len(letters)
    return uppercase_ratio >= 0.65 and len(clean) <= 72


def split_row_lanes(row: Dict[str, Any], split_x: float = 300.0) -> Tuple[List[str], List[str]]:
    left: List[str] = []
    right: List[str] = []
    for block in sorted(row.get("blocks") or [], key=lambda item: (item["bbox"]["xMin"], item["bbox"]["yMin"])):
        text = normalize_spaces(block.get("text") or "")
        if not text:
            continue
        if float(block["bbox"]["xMin"]) < split_x:
            left.append(text)
        else:
            right.append(text)
    return left, right


def merge_bbox_dicts(boxes: Iterable[Optional[Dict[str, Any]]]) -> Dict[str, float]:
    valid = [box for box in boxes if isinstance(box, dict)]
    if not valid:
        return {"xMin": 0.0, "xMax": 0.0, "yMin": 0.0, "yMax": 0.0}
    return {
        "xMin": min(float(box.get("xMin") or 0.0) for box in valid),
        "xMax": max(float(box.get("xMax") or 0.0) for box in valid),
        "yMin": min(float(box.get("yMin") or 0.0) for box in valid),
        "yMax": max(float(box.get("yMax") or 0.0) for box in valid),
    }


def row_entry_bbox(row_entry: Dict[str, Any]) -> Dict[str, float]:
    return merge_bbox_dicts([(row_entry.get("row") or {}).get("bbox")])


def merge_row_entry_bboxes(*row_entries: Dict[str, Any]) -> Dict[str, float]:
    return merge_bbox_dicts([row_entry_bbox(entry) for entry in row_entries if isinstance(entry, dict)])


def make_field_evidence(field_name: str, value: str, row_entry: Dict[str, Any], bbox: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    normalized_value = normalize_spaces(value)
    reported_value = normalized_value or "Not reported"
    return {
        "field": field_name,
        "value": reported_value,
        "rawText": normalized_value,
        "state": "reported" if normalized_value and reported_value != "Not reported" else "explicit_not_reported",
        "pageNumber": int(row_entry.get("page") or 0),
        "rowIndex": int((row_entry.get("row") or {}).get("rowIndex") or 0),
        "bbox": bbox or row_entry_bbox(row_entry),
        "source": "layout_row",
    }


def merge_field_evidence(existing: Dict[str, Any], value: str, row_entry: Dict[str, Any], bbox: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    next_detail = make_field_evidence(existing.get("field") or "", value, row_entry, bbox)
    existing_value = normalize_spaces(existing.get("value") or "")
    next_value = normalize_spaces(next_detail.get("value") or "")
    if existing_value and existing_value != "Not reported" and next_value and next_value != "Not reported" and existing_value != next_value:
        next_detail["value"] = normalize_spaces(f"{existing_value} {next_value}")
        next_detail["rawText"] = normalize_spaces(f"{normalize_spaces(existing.get('rawText') or '')} {normalize_spaces(next_detail.get('rawText') or '')}")
    else:
        next_detail["value"] = next_value or existing_value or "Not reported"
        next_detail["rawText"] = normalize_spaces(next_detail.get("rawText") or existing.get("rawText") or "")
    next_detail["bbox"] = merge_bbox_dicts([existing.get("bbox"), next_detail.get("bbox")])
    next_detail["pageNumber"] = int(existing.get("pageNumber") or next_detail.get("pageNumber") or 0)
    next_detail["rowIndex"] = int(existing.get("rowIndex") or next_detail.get("rowIndex") or 0)
    return next_detail


def build_month_boundaries(positions: List[float], row_entry: Dict[str, Any]) -> List[float]:
    if not positions:
        return []
    row_bbox = row_entry.get("row", {}).get("bbox") or {}
    boundaries = [float(row_bbox.get("xMin") or positions[0])]
    for idx in range(1, len(positions)):
        boundaries.append((float(positions[idx - 1]) + float(positions[idx])) / 2.0)
    boundaries.append(float(row_bbox.get("xMax") or positions[-1]))
    return boundaries


def merge_block_bboxes(blocks: Iterable[Optional[Dict[str, Any]]]) -> Dict[str, float]:
    return merge_bbox_dicts([(block or {}).get("bbox") for block in blocks if isinstance(block, dict)])


def make_history_cell(
    year: str,
    month: str,
    value: str,
    row_entry: Dict[str, Any],
    bbox: Optional[Dict[str, Any]],
    source: str,
) -> Dict[str, Any]:
    normalized_value = normalize_spaces(value)
    if normalized_value in {"—", "-", ""}:
        state = "blank"
    elif normalized_value.lower() == "not reported":
        state = "explicit_not_reported"
    else:
        state = "reported"
    return {
        "year": year,
        "month": month,
        "value": normalized_value or "-",
        "state": state,
        "pageNumber": int(row_entry.get("page") or 0),
        "rowIndex": int((row_entry.get("row") or {}).get("rowIndex") or 0),
        "bbox": bbox or row_entry_bbox(row_entry),
        "source": source,
    }


def add_history_cell(
    evidence_rows: Dict[str, Dict[str, Dict[str, Dict[str, Any]]]],
    field_name: str,
    year: str,
    month: str,
    cell: Dict[str, Any],
) -> None:
    evidence_rows.setdefault(field_name, {}).setdefault(year, {})[month] = cell


def finalize_history_evidence(
    evidence_rows: Dict[str, Dict[str, Dict[str, Dict[str, Any]]]]
) -> Dict[str, List[Dict[str, Any]]]:
    result: Dict[str, List[Dict[str, Any]]] = {}
    for field_name, rows_by_year in evidence_rows.items():
        normalized_rows: List[Dict[str, Any]] = []
        for year in sorted(rows_by_year.keys(), reverse=True):
            months = rows_by_year[year]
            normalized_rows.append(
                {
                    "year": year,
                    "months": {month: months[month] for month in MONTH_COLUMNS if month in months},
                }
            )
        if normalized_rows:
            result[field_name] = normalized_rows
    return result


def month_key_from_date_text(value: str) -> Optional[Tuple[str, str]]:
    clean = normalize_spaces(value)
    match = re.fullmatch(r"([A-Z][a-z]{2,8})\s+(\d{4})", clean)
    if not match:
        return None
    month_name, year = match.groups()
    month_lookup = {
        "jan": "jan",
        "january": "jan",
        "feb": "feb",
        "february": "feb",
        "mar": "mar",
        "march": "mar",
        "apr": "apr",
        "april": "apr",
        "may": "may",
        "jun": "jun",
        "june": "jun",
        "jul": "jul",
        "july": "jul",
        "aug": "aug",
        "august": "aug",
        "sep": "sep",
        "sept": "sep",
        "september": "sep",
        "oct": "oct",
        "october": "oct",
        "nov": "nov",
        "november": "nov",
        "dec": "dec",
        "december": "dec",
    }
    normalized_month = month_lookup.get(month_name.lower())
    if not normalized_month:
        return None
    return year, normalized_month


def history_month_sort_value(year: str, month: str) -> Optional[int]:
    if month not in MONTH_COLUMNS:
        return None
    try:
        parsed_year = int(year)
    except (TypeError, ValueError):
        return None
    return parsed_year * 12 + MONTH_COLUMNS.index(month)


def month_key_from_sort_value(sort_value: int) -> Tuple[str, str]:
    year, month_index = divmod(sort_value, 12)
    return str(year), MONTH_COLUMNS[month_index]


def history_cell_center_y(cell: Dict[str, Any]) -> float:
    bbox = (cell.get("pdfBBox") or cell.get("bbox") or {})
    return (float(bbox.get("yMin") or 0.0) + float(bbox.get("yMax") or 0.0)) / 2.0


def history_cell_height(cell: Dict[str, Any]) -> float:
    bbox = (cell.get("pdfBBox") or cell.get("bbox") or {})
    return max(1.0, float(bbox.get("yMax") or 0.0) - float(bbox.get("yMin") or 0.0))


def history_cell_width(cell: Dict[str, Any]) -> float:
    bbox = (cell.get("pdfBBox") or cell.get("bbox") or {})
    return max(1.0, float(bbox.get("xMax") or 0.0) - float(bbox.get("xMin") or 0.0))


def history_cell_x_center(cell: Dict[str, Any]) -> float:
    bbox = (cell.get("pdfBBox") or cell.get("bbox") or {})
    return (float(bbox.get("xMin") or 0.0) + float(bbox.get("xMax") or 0.0)) / 2.0


def median_float(values: List[float]) -> Optional[float]:
    if not values:
        return None
    ordered = sorted(values)
    middle = len(ordered) // 2
    if len(ordered) % 2:
        return ordered[middle]
    return (ordered[middle - 1] + ordered[middle]) / 2.0


def finalize_field_evidence(
    field_evidence: Dict[str, Dict[str, Any]],
    account_name: str,
    account_number: str,
) -> Dict[str, Dict[str, Any]]:
    normalized_account_name = normalize_spaces(account_name).lower()
    normalized_account_number = normalize_spaces(account_number)
    normalized: Dict[str, Dict[str, Any]] = {}
    for field_name, detail in field_evidence.items():
        if not isinstance(detail, dict):
            continue
        normalized[field_name] = {
            **detail,
            "id": detail.get("id")
            or f"account:{normalized_account_name}::{normalized_account_number}:field:{normalize_spaces(field_name)}",
            "pdfBBox": detail.get("pdfBBox") or detail.get("bbox"),
        }
    return normalized


def finalize_history_ids(
    history_evidence: Dict[str, List[Dict[str, Any]]],
    account_name: str,
    account_number: str,
) -> Dict[str, List[Dict[str, Any]]]:
    normalized_account_name = normalize_spaces(account_name).lower()
    normalized_account_number = normalize_spaces(account_number)
    normalized: Dict[str, List[Dict[str, Any]]] = {}
    for field_name, rows in history_evidence.items():
        if not isinstance(rows, list):
            continue
        normalized_rows: List[Dict[str, Any]] = []
        for row in rows:
            if not isinstance(row, dict):
                continue
            year = normalize_spaces(row.get("year") or "")
            months = row.get("months") or {}
            normalized_months: Dict[str, Any] = {}
            if isinstance(months, dict):
                for month, cell in months.items():
                    if not isinstance(cell, dict):
                        continue
                    normalized_months[month] = {
                        **cell,
                        "id": cell.get("id")
                        or f"account:{normalized_account_name}::{normalized_account_number}:history:{normalize_spaces(field_name)}:{year}:{normalize_spaces(month).lower()}",
                        "pdfBBox": cell.get("pdfBBox") or cell.get("bbox"),
                    }
            normalized_rows.append(
                {
                    **row,
                    "months": normalized_months,
                }
            )
        normalized[field_name] = normalized_rows
    return normalized


def flatten_history_cells(
    evidence_rows: Dict[str, Dict[str, Dict[str, Dict[str, Any]]]],
    field_name: str,
) -> List[Dict[str, Any]]:
    rows_by_year = evidence_rows.get(field_name) or {}
    flattened: List[Dict[str, Any]] = []
    for months in rows_by_year.values():
        if not isinstance(months, dict):
            continue
        for cell in months.values():
            if isinstance(cell, dict):
                flattened.append(cell)
    return flattened


def estimate_page_row_pitch(cells: List[Dict[str, Any]]) -> Dict[int, float]:
    by_page: Dict[int, List[float]] = {}
    ordered = sorted(
        cells,
        key=lambda cell: history_month_sort_value(str(cell.get("year") or ""), str(cell.get("month") or "")) or -1,
        reverse=True,
    )
    for upper, lower in zip(ordered, ordered[1:]):
        upper_sort = history_month_sort_value(str(upper.get("year") or ""), str(upper.get("month") or ""))
        lower_sort = history_month_sort_value(str(lower.get("year") or ""), str(lower.get("month") or ""))
        upper_page = int(upper.get("pageNumber") or 0)
        lower_page = int(lower.get("pageNumber") or 0)
        if upper_sort is None or lower_sort is None or upper_page <= 0 or upper_page != lower_page:
            continue
        if upper_sort - lower_sort != 1:
            continue
        pitch = history_cell_center_y(lower) - history_cell_center_y(upper)
        if pitch <= 0:
            continue
        by_page.setdefault(upper_page, []).append(pitch)
    return {
        page_number: median_float(values) or 0.0
        for page_number, values in by_page.items()
        if values
    }


def make_gap_slot_cell(
    year: str,
    month: str,
    page_number: int,
    row_index: int,
    bbox: Dict[str, float],
    source: str = "projected_gap_slot",
) -> Dict[str, Any]:
    return {
        "year": year,
        "month": month,
        "value": "Missing slot",
        "state": "missing_slot",
        "pageNumber": int(page_number),
        "rowIndex": int(row_index),
        "bbox": bbox,
        "pdfBBox": bbox,
        "source": source,
    }


def build_balance_history_gap_slots(
    evidence_rows: Dict[str, Dict[str, Dict[str, Dict[str, Any]]]]
) -> List[Dict[str, Any]]:
    visible_cells = [
        cell
        for cell in flatten_history_cells(evidence_rows, "balanceHistory")
        if isinstance(cell, dict)
        and str(cell.get("state") or "").lower() == "reported"
        and history_month_sort_value(str(cell.get("year") or ""), str(cell.get("month") or "")) is not None
        and isinstance(cell.get("pdfBBox") or cell.get("bbox"), dict)
    ]
    if len(visible_cells) < 2:
        return []

    page_pitches = estimate_page_row_pitch(visible_cells)
    ordered = sorted(
        visible_cells,
        key=lambda cell: history_month_sort_value(str(cell.get("year") or ""), str(cell.get("month") or "")) or -1,
        reverse=True,
    )

    gap_slots: List[Dict[str, Any]] = []
    for upper, lower in zip(ordered, ordered[1:]):
        upper_sort = history_month_sort_value(str(upper.get("year") or ""), str(upper.get("month") or ""))
        lower_sort = history_month_sort_value(str(lower.get("year") or ""), str(lower.get("month") or ""))
        upper_page = int(upper.get("pageNumber") or 0)
        lower_page = int(lower.get("pageNumber") or 0)
        if upper_sort is None or lower_sort is None or upper_page <= 0 or upper_page != lower_page:
            continue

        month_delta = upper_sort - lower_sort
        if month_delta <= 1:
            continue

        upper_bbox = upper.get("pdfBBox") or upper.get("bbox") or {}
        lower_bbox = lower.get("pdfBBox") or lower.get("bbox") or {}
        upper_center_x = history_cell_x_center(upper)
        lower_center_x = history_cell_x_center(lower)
        average_width = max(history_cell_width(upper), history_cell_width(lower))
        if abs(upper_center_x - lower_center_x) > max(24.0, average_width * 0.75):
            continue

        observed_pitch = (history_cell_center_y(lower) - history_cell_center_y(upper)) / month_delta
        reference_pitch = page_pitches.get(upper_page) or observed_pitch
        if observed_pitch <= 0 or reference_pitch <= 0:
            continue
        if observed_pitch < reference_pitch * 0.6 or observed_pitch > reference_pitch * 1.4:
            continue

        average_height = max(8.0, (history_cell_height(upper) + history_cell_height(lower)) / 2.0)
        average_x_min = (float(upper_bbox.get("xMin") or 0.0) + float(lower_bbox.get("xMin") or 0.0)) / 2.0
        average_x_max = (float(upper_bbox.get("xMax") or 0.0) + float(lower_bbox.get("xMax") or 0.0)) / 2.0
        upper_center_y = history_cell_center_y(upper)

        for offset in range(1, month_delta):
            slot_sort = upper_sort - offset
            slot_year, slot_month = month_key_from_sort_value(slot_sort)
            slot_center_y = upper_center_y + observed_pitch * offset
            bbox = {
                "xMin": average_x_min,
                "xMax": average_x_max,
                "yMin": slot_center_y - average_height / 2.0,
                "yMax": slot_center_y + average_height / 2.0,
            }
            gap_slots.append(
                make_gap_slot_cell(
                    slot_year,
                    slot_month,
                    upper_page,
                    int(upper.get("rowIndex") or 0) + offset,
                    bbox,
                )
            )

    return gap_slots


def parse_lane_key_value_rows_with_evidence(
    rows: List[Dict[str, Any]],
    label_map: Dict[str, str],
    split_x: float = 300.0,
) -> Tuple[Dict[str, str], Dict[str, Dict[str, Any]]]:
    result: Dict[str, str] = {}
    evidence: Dict[str, Dict[str, Any]] = {}
    pending_left: Optional[str] = None
    pending_right: Optional[str] = None

    def assign(pair: Optional[Tuple[str, str]], row_entry: Optional[Dict[str, Any]] = None, bbox: Optional[Dict[str, Any]] = None) -> None:
        if not pair:
            return
        key, value = pair
        if not value:
            value = "Not reported"
        existing = normalize_spaces(result.get(key) or "")
        if existing and existing != "Not reported" and existing != value:
            result[key] = normalize_spaces(f"{existing} {value}")
        else:
            result[key] = value
        if row_entry:
            if key in evidence:
                evidence[key] = merge_field_evidence(evidence[key], value, row_entry, bbox=bbox)
            else:
                evidence[key] = make_field_evidence(key, value, row_entry, bbox=bbox)

    for row_entry in rows:
        blocks = [
            block
            for block in sorted(row_entry["row"].get("blocks") or [], key=lambda item: (item["bbox"]["xMin"], item["bbox"]["yMin"]))
            if normalize_spaces(block.get("text") or "")
        ]
        texts = [normalize_spaces(block.get("text") or "") for block in blocks]
        headings = [canonical_heading(text.rstrip(":")) for text in texts]
        if not texts:
            continue

        if len(texts) == 1:
            if headings[0] in label_map:
                pending_left = label_map[headings[0]]
            elif pending_left:
                assign((pending_left, texts[0]), row_entry=row_entry)
                pending_left = None
            elif pending_right:
                assign((pending_right, texts[0]), row_entry=row_entry)
                pending_right = None
            continue

        if len(texts) == 2:
            if headings[0] in label_map:
                assign((label_map[headings[0]], texts[1]), row_entry=row_entry, bbox=merge_block_bboxes(blocks[1:]))
                pending_left = None
                continue
            if pending_left:
                assign((pending_left, normalize_spaces(" ".join(texts))), row_entry=row_entry)
                pending_left = None
                continue
            if pending_right:
                assign((pending_right, normalize_spaces(" ".join(texts))), row_entry=row_entry)
                pending_right = None
                continue

        if len(texts) == 3:
            first_is_label = headings[0] in label_map
            second_is_label = headings[1] in label_map
            if first_is_label and second_is_label:
                pending_left = label_map[headings[0]]
                assign((label_map[headings[1]], texts[2]), row_entry=row_entry, bbox=merge_block_bboxes(blocks[2:]))
                continue
            if pending_left and second_is_label:
                assign((pending_left, texts[0]), row_entry=row_entry, bbox=merge_block_bboxes(blocks[:1]))
                pending_left = None
                assign((label_map[headings[1]], texts[2]), row_entry=row_entry, bbox=merge_block_bboxes(blocks[2:]))
                continue
            if first_is_label and not second_is_label:
                assign((label_map[headings[0]], texts[1]), row_entry=row_entry, bbox=merge_block_bboxes(blocks[1:2]))
                if headings[2] in label_map:
                    pending_right = label_map[headings[2]]
                continue

        left_texts, right_texts = split_row_lanes(row_entry["row"], split_x=split_x)
        if left_texts:
            first_heading = canonical_heading(left_texts[0].rstrip(":"))
            if first_heading in label_map:
                label = label_map[first_heading]
                remainder = normalize_spaces(" ".join(left_texts[1:]))
                if remainder:
                    left_blocks = [block for block in blocks if float(block["bbox"]["xMin"]) < split_x]
                    assign((label, remainder), row_entry=row_entry, bbox=merge_block_bboxes(left_blocks[1:]))
                    pending_left = None
                else:
                    pending_left = label
            elif pending_left:
                assign((pending_left, normalize_spaces(" ".join(left_texts))), row_entry=row_entry)
                pending_left = None
        if right_texts:
            first_heading = canonical_heading(right_texts[0].rstrip(":"))
            if first_heading in label_map:
                label = label_map[first_heading]
                remainder = normalize_spaces(" ".join(right_texts[1:]))
                if remainder:
                    right_blocks = [block for block in blocks if float(block["bbox"]["xMin"]) >= split_x]
                    assign((label, remainder), row_entry=row_entry, bbox=merge_block_bboxes(right_blocks[1:]))
                    pending_right = None
                else:
                    pending_right = label
            elif pending_right:
                assign((pending_right, normalize_spaces(" ".join(right_texts))), row_entry=row_entry)
                pending_right = None

    for pending in [pending_left, pending_right]:
        if pending and pending not in result:
            result[pending] = "Not reported"
    return result, evidence


def parse_lane_key_value_rows(rows: List[Dict[str, Any]], label_map: Dict[str, str], split_x: float = 300.0) -> Dict[str, str]:
    values, _ = parse_lane_key_value_rows_with_evidence(rows, label_map, split_x=split_x)
    return values


def parse_payment_history_rows_with_evidence(
    rows: List[Dict[str, Any]],
    fallback_lines: Optional[List[str]] = None,
) -> Tuple[Dict[str, Any], Dict[str, List[Dict[str, Any]]]]:
    parsed_rows: List[Dict[str, str]] = []
    evidence_rows: Dict[str, Dict[str, Dict[str, Dict[str, Any]]]] = {}
    month_header_seen = False
    payment_month_columns: Optional[Dict[str, Dict[str, float]]] = None

    for row_entry in rows:
        blocks = [
            block
            for block in sorted(row_entry["row"].get("blocks") or [], key=lambda item: (item["bbox"]["xMin"], item["bbox"]["yMin"]))
            if normalize_spaces(block.get("text") or "")
        ]
        texts = [normalize_spaces(block.get("text") or "") for block in blocks]
        if not texts:
            continue
        if not month_header_seen:
            month_hits = sum(1 for token in texts if token.lower() in {"j", "f", "m", "a", "s", "o", "n", "d", *MONTH_COLUMNS})
            if month_hits >= 8:
                month_header_seen = True
                payment_month_columns = extract_payment_month_columns(blocks, row_entry)
                continue
        year = texts[0]
        if not re.fullmatch(r"\d{4}", year):
            continue
        assigned_months: Dict[str, Dict[str, Any]] = {}
        normalized_months: Dict[str, str] = {}
        month_value_blocks = blocks[1:]
        if payment_month_columns:
            for month, block in align_payment_blocks_to_months(month_value_blocks, payment_month_columns).items():
                normalized = normalize_payment_token(normalize_spaces(block.get("text") or ""))
                if normalized is None:
                    continue
                assigned_months[month] = block
                normalized_months[month] = normalized
        else:
            sequential_values: List[Tuple[str, Dict[str, Any]]] = []
            for block in month_value_blocks:
                normalized = normalize_payment_token(normalize_spaces(block.get("text") or ""))
                if normalized is None:
                    continue
                sequential_values.append((normalized, block))
                if len(sequential_values) >= 12:
                    break
            for index, (normalized, block) in enumerate(sequential_values):
                month = MONTH_COLUMNS[index]
                assigned_months[month] = block
                normalized_months[month] = normalized

        if not normalized_months:
            continue
        row = {"year": year}
        for month in MONTH_COLUMNS:
            row[month] = normalized_months.get(month, "X")
            block = assigned_months.get(month)
            if block is None:
                continue
            add_history_cell(
                evidence_rows,
                "paymentHistory",
                year,
                month,
                make_history_cell(
                    year,
                    month,
                    normalized_months[month],
                    row_entry,
                    block.get("bbox"),
                    "layout_block",
                ),
            )
            if normalized_months.get(month) in MISSING_SLOT_PAYMENT_STATUS_CODES:
                add_history_cell(
                    evidence_rows,
                    "paymentHistoryGapSlots",
                    year,
                    month,
                    make_gap_slot_cell(
                        year,
                        month,
                        int(row_entry.get("page") or 0),
                        int((row_entry.get("row") or {}).get("rowIndex") or 0),
                        block.get("bbox"),
                        source="layout_blank_slot",
                    ),
                )
        if payment_month_columns:
            for gap_slot in build_payment_history_gap_slots(year, row_entry, month_value_blocks or blocks, payment_month_columns, assigned_months):
                add_history_cell(
                    evidence_rows,
                    "paymentHistoryGapSlots",
                    str(gap_slot.get("year") or ""),
                    str(gap_slot.get("month") or ""),
                    gap_slot,
                )
        parsed_rows.append(row)

    fallback_payload = parse_payment_history(fallback_lines or [])
    parsed_rows, evidence_rows = merge_missing_payment_history_rows(
        parsed_rows,
        evidence_rows,
        rows,
        payment_month_columns,
        list(fallback_payload.get("rows") or []),
    )

    return (
        {
            "rows": parsed_rows,
            "paymentStatusCodes": EXPERIAN_PAYMENT_STATUS_CODES,
        },
        finalize_history_evidence(evidence_rows),
    )


def parse_payment_history_rows(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    payload, _ = parse_payment_history_rows_with_evidence(rows)
    return payload


def parse_balance_history_rows_with_evidence(
    rows: List[Dict[str, Any]],
    heading_row: Optional[Dict[str, Any]] = None,
) -> Tuple[List[Dict[str, str]], Dict[str, List[Dict[str, Any]]], Optional[Dict[str, Any]]]:
    entries: List[Dict[str, str]] = []
    evidence_rows: Dict[str, Dict[str, Dict[str, Dict[str, Any]]]] = {}
    current: Optional[Dict[str, str]] = None
    header_row: Optional[Dict[str, Any]] = None
    for row_entry in rows:
        text = row_entry["text"]
        heading = canonical_heading(text)
        if heading in {"additional info", "contact info", "historical info", "comment", "public records"}:
            break
        blocks = [
            block
            for block in sorted(row_entry["row"].get("blocks") or [], key=lambda item: (item["bbox"]["xMin"], item["bbox"]["yMin"]))
            if normalize_spaces(block.get("text") or "")
        ]
        texts = [normalize_spaces(block.get("text") or "") for block in blocks]
        if not texts:
            continue
        if texts[0] == "Scheduled" or texts[0] == "Date":
            header_row = row_entry
            continue
        if re.fullmatch(r"[A-Z][a-z]{2,8}\s+\d{4}", texts[0]):
            if current:
                entries.append(current)
            balance_value = parse_currency(texts[1]) if len(texts) > 1 else None
            scheduled_value = parse_currency(texts[2]) if len(texts) > 2 else None
            parsed_month = month_key_from_date_text(texts[0])
            current = {
                "date": texts[0],
                "balance": balance_value or (texts[1] if len(texts) > 1 else "Not reported"),
                "scheduledPayment": scheduled_value or (texts[2] if len(texts) > 2 else "Not reported"),
                "paid": normalize_spaces(" ".join(texts[3:])) if len(texts) > 3 else "Not reported",
            }
            if parsed_month:
                year, month = parsed_month
                if len(blocks) > 1:
                    add_history_cell(
                        evidence_rows,
                        "balanceHistory",
                        year,
                        month,
                        make_history_cell(year, month, current["balance"], row_entry, blocks[1].get("bbox"), "layout_block"),
                    )
                if len(blocks) > 2:
                    add_history_cell(
                        evidence_rows,
                        "scheduledPaymentHistory",
                        year,
                        month,
                        make_history_cell(year, month, current["scheduledPayment"], row_entry, blocks[2].get("bbox"), "layout_block"),
                    )
                if len(blocks) > 3:
                    add_history_cell(
                        evidence_rows,
                        "actualPaymentHistory",
                        year,
                        month,
                        make_history_cell(year, month, current["paid"], row_entry, merge_block_bboxes(blocks[3:]), "layout_block"),
                    )
            continue
        if current is not None:
            continuation = normalize_spaces(" ".join(texts))
            current["paid"] = normalize_spaces(f"{current['paid']} {continuation}".strip())
    if current:
        entries.append(current)
    section_evidence = None
    if heading_row or header_row:
        section_bbox = merge_row_entry_bboxes(*(entry for entry in [heading_row, header_row] if entry))
        source_entry = header_row or heading_row
        if source_entry:
            section_evidence = make_field_evidence("balanceHistorySection", "Present", source_entry, bbox=section_bbox)
            section_evidence["pdfBBox"] = section_evidence.get("bbox")
    for gap_slot in build_balance_history_gap_slots(evidence_rows):
        add_history_cell(
            evidence_rows,
            "balanceHistoryGapSlots",
            str(gap_slot.get("year") or ""),
            str(gap_slot.get("month") or ""),
            gap_slot,
        )
    return entries, finalize_history_evidence(evidence_rows), section_evidence


def parse_balance_history_rows(rows: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    payload, _, _ = parse_balance_history_rows_with_evidence(rows)
    return payload


def parse_additional_info_rows(rows: List[Dict[str, Any]]) -> List[str]:
    details: List[str] = []
    for row_entry in rows:
        text = normalize_spaces(row_entry.get("text") or "")
        if not text:
            continue
        details.append(text)
    return unique_preserve_order(details)


def parse_text_section_rows_with_evidence(rows: List[Dict[str, Any]], field_name: str) -> Tuple[List[str], Optional[Dict[str, Any]]]:
    details: List[str] = []
    evidence: Optional[Dict[str, Any]] = None
    for row_entry in rows:
        text = normalize_spaces(row_entry.get("text") or "")
        if not text:
            continue
        details.append(text)
        if evidence is None:
            evidence = make_field_evidence(field_name, text, row_entry)
        else:
            evidence = merge_field_evidence(evidence, text, row_entry)
    return unique_preserve_order(details), evidence


def parse_contact_rows(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    address_lines: List[str] = []
    phone_number: Optional[str] = None
    current_field: Optional[str] = None

    def clean_contact_value(value: str) -> str:
        return normalize_spaces(re.sub(r"^\|+\s*", "", value).strip())

    for row_entry in rows:
        row = row_entry["row"]
        left_texts: List[str] = []
        right_texts: List[str] = []

        for block in sorted(row.get("blocks") or [], key=lambda item: (item["bbox"]["xMin"], item["bbox"]["yMin"])):
            raw_text = str(block.get("text") or "")
            lines = [normalize_spaces(line) for line in raw_text.splitlines() if normalize_spaces(line)]
            if not lines:
                continue
            if float(block["bbox"]["xMin"]) < 220:
                left_texts.extend(lines)
            else:
                right_texts.extend(lines)

        left_label = canonical_heading(" ".join(left_texts).replace("|", " ").rstrip(":"))
        full_text = normalize_spaces(row_entry.get("text") or "")
        compact_text = re.sub(r"\s+", " ", full_text)

        address_match = re.match(r"^address\b[:\s]*(.*)$", compact_text, re.IGNORECASE)
        if address_match:
            current_field = "address"
            remainder = clean_contact_value(address_match.group(1))
            if remainder:
                address_lines.append(remainder)
            continue

        phone_match = re.match(r"^phone number\b[:\s]*(.*)$", compact_text, re.IGNORECASE)
        if phone_match:
            current_field = "phone"
            remainder = clean_contact_value(phone_match.group(1))
            phone_candidate = re.search(r"\(\d{3}\)\s*\d{3}-?\d{4}", remainder)
            if phone_candidate:
                phone_number = normalize_spaces(phone_candidate.group(0))
                current_field = None
            elif remainder:
                phone_number = remainder
                current_field = None
            continue

        if left_label == "address":
            current_field = "address"
            address_lines.extend(clean_contact_value(text) for text in right_texts if clean_contact_value(text))
            continue

        if left_label == "phone number":
            current_field = "phone"
            phone_candidate = next((text for text in right_texts if re.search(r"\(\d{3}\)\s*\d{3}-?\d{4}", text)), "")
            if phone_candidate:
                phone_number = normalize_spaces(phone_candidate)
                current_field = None
            elif right_texts:
                phone_number = normalize_spaces(" ".join(right_texts))
                current_field = None
            continue

        # Right-column continuation rows belong to the active field.
        if not left_texts and right_texts:
            if current_field == "address":
                address_lines.extend(clean_contact_value(text) for text in right_texts if clean_contact_value(text))
                continue
            if current_field == "phone":
                phone_candidate = next((text for text in right_texts if re.search(r"\(\d{3}\)\s*\d{3}-?\d{4}", text)), "")
                if phone_candidate:
                    phone_number = normalize_spaces(phone_candidate)
                elif right_texts:
                    phone_number = normalize_spaces(" ".join(right_texts))
                current_field = None
                continue

        # Merged rows and continuation-only rows are common in the Experian layout.
        if current_field == "address" and compact_text:
            if not re.match(r"^(phone number|current:|previous:)\b", compact_text, re.IGNORECASE):
                cleaned = clean_contact_value(compact_text)
                if cleaned:
                    address_lines.append(cleaned)
                continue

        # A phone-only row can still appear without an explicit left-side label.
        if current_field == "phone" and re.search(r"\(\d{3}\)\s*\d{3}-?\d{4}", full_text):
            match = re.search(r"\(\d{3}\)\s*\d{3}-?\d{4}", full_text)
            if match:
                phone_number = normalize_spaces(match.group(0))
                current_field = None
            continue

        # Stop carrying continuation rows once the section clearly shifts away from contact data.
        if left_texts and not right_texts:
            current_field = None

    return {
        "address": unique_preserve_order(address_lines),
        "phoneNumber": phone_number,
    }


def parse_comment_rows(rows: List[Dict[str, Any]]) -> Dict[str, List[str]]:
    current_comments: List[str] = []
    previous_comments: List[str] = []
    active: Optional[List[str]] = None
    for row_entry in rows:
        text = row_entry["text"]
        heading = canonical_heading(text.rstrip(":"))
        if heading == "current":
            active = current_comments
            continue
        if heading == "previous":
            active = previous_comments
            continue
        if active is not None and text:
            active.append(text)
    return {
        "current": [item for item in unique_preserve_order(current_comments) if item and canonical_heading(item) != "none"],
        "previous": [item for item in unique_preserve_order(previous_comments) if item and canonical_heading(item) != "none"],
    }


def merge_inquiry_address_lines(lines: List[str]) -> List[str]:
    cleaned = [normalize_spaces(line) for line in lines if normalize_spaces(line)]
    if not cleaned:
        return []
    ordered = unique_preserve_order(cleaned)
    zip_parts = [line for line in ordered if re.fullmatch(r"\d{5}(?:-\d{4})?", line)]
    core_parts = [line for line in ordered if line not in zip_parts]
    normalized_core: List[str] = []
    index = 0
    while index < len(core_parts):
        current = core_parts[index]
        nxt = core_parts[index + 1] if index + 1 < len(core_parts) else None
        if (
            nxt
            and re.search(r"\b[A-Z]{2},?\s*$", current)
            and re.fullmatch(r"[A-Z][A-Z\s\.-]{2,}", nxt)
        ):
            normalized_core.append(nxt)
            normalized_core.append(current)
            index += 2
            continue
        if (
            nxt
            and re.search(r"\b[A-Z]{2},?\s*\d{5}(?:-\d{4})?\b", current)
            and re.fullmatch(r"[A-Z][A-Z\s\.-]{2,}", nxt)
        ):
            normalized_core.append(nxt)
            normalized_core.append(current)
            index += 2
            continue
        normalized_core.append(current)
        index += 1
    merged = normalize_spaces(" ".join(normalized_core + zip_parts))
    return [merged] if merged else []


def merge_inquiry_description_lines(lines: List[str]) -> Optional[str]:
    cleaned = [normalize_spaces(line) for line in lines if normalize_spaces(line)]
    if not cleaned:
        return None
    lead_parts: List[str] = []
    tail_parts: List[str] = []
    for line in cleaned:
        lowered = line.lower()
        if lowered.startswith(("inquiry is scheduled", "continue on record", "until ")):
            tail_parts.append(line)
        else:
            lead_parts.append(line)
    merged = normalize_spaces(" ".join(lead_parts + tail_parts))
    return merged or None


def inquiry_card_ready_to_close(card: Dict[str, Any]) -> bool:
    lines = [normalize_spaces(line) for line in card.get("lines") or [] if normalize_spaces(line)]
    if not lines:
        return False
    for line in lines:
        lowered = line.lower()
        if re.search(r"\(\d{3}\)\s*\d{3}-?\d{4}", line):
            return True
        if re.search(r"\b[A-Z]{2},?\s*\d{5}(?:-\d{4})?\b", line):
            return True
        if re.fullmatch(r"\d{5}(?:-\d{4})?", line):
            return True
        if re.search(r"inquiry is scheduled|auto loan|credit card|charge card|unspecified|account review|personal loan|consumer finance|utility|mortgage|real estate|unsecured", lowered):
            return True
    return False


def is_inquiry_intro_line(text: str) -> bool:
    clean = normalize_spaces(text)
    lowered = clean.lower()
    return (
        lowered.startswith("hard inquiries are")
        or lowered.startswith("soft inquiries are")
        or "have no impact on your credit" in lowered
        or "are displayed to companies" in lowered
    )


def infer_inquiry_columns(rows: List[Dict[str, Any]]) -> List[float]:
    positions: List[float] = []
    for row_entry in rows:
        texts = [normalize_spaces(block.get("text") or "") for block in row_entry["row"].get("blocks") or []]
        if not any("inquired on" in text.lower() or "inquired by" in text.lower() for text in texts):
            continue
        for block in row_entry["row"].get("blocks") or []:
            text = normalize_spaces(block.get("text") or "")
            if not text:
                continue
            positions.append(float(block["bbox"]["xMin"]))
    if not positions:
        for row_entry in rows:
            for block in row_entry["row"].get("blocks") or []:
                text = normalize_spaces(block.get("text") or "")
                if text:
                    positions.append(float(block["bbox"]["xMin"]))
    positions.sort()
    clusters: List[List[float]] = []
    for position in positions:
        if not clusters or abs(position - clusters[-1][-1]) > 55:
            clusters.append([position])
        else:
            clusters[-1].append(position)
    return [sum(cluster) / len(cluster) for cluster in clusters]


def is_likely_inquiry_header_line(text: str) -> bool:
    clean = normalize_spaces(text)
    lowered = clean.lower()
    if not clean or is_inquiry_intro_line(clean):
        return False
    if re.search(DATE_PATTERN, clean):
        return False
    if re.search(r"\(\d{3}\)\s*\d{3}-?\d{4}", clean):
        return False
    if re.match(r"^\d+\s", clean) and "/" not in clean:
        return False
    if lowered.startswith("po box"):
        return False
    if re.search(r"\b[A-Z]{2},?\s*\d{5}\b", clean):
        return False
    if re.search(r"\b(?:road|rd|street|st|avenue|ave|blvd|boulevard|drive|dr|lane|ln|parkway|pkwy|place|pl|court|ct|suite|ste|box|center|ctr|tx|fl|ca|oh|ut|mi|de|ny)\b", lowered):
        return False
    if re.search(r"inquiry is scheduled|auto loan|credit card|charge card|unspecified|account review|promotional", lowered):
        return False
    letters = re.findall(r"[A-Za-z]", clean)
    if not letters:
        return False
    uppercase_ratio = sum(1 for char in letters if char.isupper()) / len(letters)
    return uppercase_ratio >= 0.55 and len(clean) <= 48


def parse_inquiry_card_payload(card: Dict[str, Any]) -> Dict[str, Any]:
    header_lines = [normalize_spaces(line) for line in card.get("headerLines") or [] if normalize_spaces(line)]
    lines = [normalize_spaces(line) for line in card.get("lines") or [] if normalize_spaces(line)]
    subscriber_name = normalize_spaces(" ".join(header_lines)) or "Not reported"
    joined = " ".join(lines)
    phone_match = re.search(r"\(\d{3}\)\s*\d{3}-?\d{4}", joined)

    address_parts: List[str] = []
    description_parts: List[str] = []
    dates: List[str] = []
    collecting_dates = False
    description_started = False
    for line in lines:
        marker = re.search(r"\bInquired (?:on|by)\b", line, re.IGNORECASE)
        if marker:
            collecting_dates = True
            dates.extend(re.findall(r"\d{1,2}/\d{1,2}/\d{2,4}", line[marker.end() :]))
            continue
        if collecting_dates:
            inline_dates = re.findall(r"\d{1,2}/\d{1,2}/\d{2,4}", line)
            remainder = re.sub(r"\d{1,2}/\d{1,2}/\d{2,4}", "", line)
            remainder = re.sub(r"(?i)\band\b", "", remainder)
            remainder = re.sub(r"[^\w]+", "", remainder)
            if inline_dates:
                dates.extend(inline_dates)
                if remainder.lower() in {"", "a", "an", "d", "nd"}:
                    continue
                if not remainder:
                    continue
                line = normalize_spaces(re.sub(r"\d{1,2}/\d{1,2}/\d{2,4}", "", line))
                line = normalize_spaces(re.sub(r"(?i)\band\b", "", line))
        collecting_dates = False
        if re.search(r"\(\d{3}\)\s*\d{3}-?\d{4}", line):
            line = normalize_spaces(re.sub(r"\(\d{3}\)\s*\d{3}-?\d{4}", "", line))
            if not line:
                continue
        lowered = line.lower()
        if re.search(r"inquiry is scheduled|auto loan|credit card|charge card|unspecified|account review|personal loan|consumer finance|utility|mortgage|continue on record|until [A-Z][a-z]{2,8} \d{4}", line, re.IGNORECASE):
            description_started = True
            description_parts.append(line)
            continue
        if not description_started:
            address_parts.append(line)
            continue
        if re.search(r"\b(?:po box|\d{3,}|[A-Z]{2}\s*,?\s*\d{5})\b", line, re.IGNORECASE):
            address_parts.append(line)
            continue
        description_parts.append(line)
    return {
        "subscriberName": subscriber_name,
        "inquiredOnDates": unique_preserve_order(dates),
        "address": merge_inquiry_address_lines(address_parts),
        "phoneNumber": phone_match.group(0) if phone_match else None,
        "description": merge_inquiry_description_lines(description_parts),
        "sourcePages": unique_preserve_order(card.get("sourcePages") or []),
    }


def extract_hard_inquiry_cards(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not rows:
        return []
    columns = infer_inquiry_columns(rows)
    if not columns:
        return []

    cards: List[Dict[str, Any]] = []
    header_buffers: Dict[int, List[str]] = {idx: [] for idx in range(len(columns))}
    current_cards: Dict[int, Optional[Dict[str, Any]]] = {idx: None for idx in range(len(columns))}

    for row_entry in sorted(rows, key=lambda item: (int(item["page"]), float(item["row"]["bbox"]["yMin"]))):
        heading = canonical_heading(row_entry["text"])
        if heading in {"hard inquiries", "soft inquiries"} or is_inquiry_intro_line(row_entry["text"]):
            continue
        lane_blocks: Dict[int, List[str]] = {}
        for block in sorted(row_entry["row"].get("blocks") or [], key=lambda item: (item["bbox"]["xMin"], item["bbox"]["yMin"])):
            text = normalize_spaces(block.get("text") or "")
            if not text:
                continue
            column_index = min(range(len(columns)), key=lambda idx: abs(columns[idx] - float(block["bbox"]["xMin"])))
            lane_blocks.setdefault(column_index, []).append(text)
        for column_index in sorted(lane_blocks):
            line = normalize_spaces(" ".join(lane_blocks[column_index]))
            if not line:
                continue
            marker = re.search(r"\bInquired (?:on|by)\b", line, re.IGNORECASE)
            if marker:
                if current_cards[column_index]:
                    cards.append(current_cards[column_index])
                prefix = normalize_spaces(line[: marker.start()])
                marker_line = normalize_spaces(line[marker.start() :])
                header_lines = list(header_buffers[column_index])
                if prefix:
                    header_lines.append(prefix)
                current_cards[column_index] = {
                    "headerLines": header_lines,
                    "lines": [marker_line],
                    "sourcePages": [int(row_entry["page"])],
                }
                header_buffers[column_index] = []
                continue
            if current_cards[column_index] is not None:
                if is_likely_inquiry_header_line(line) and inquiry_card_ready_to_close(current_cards[column_index]):
                    cards.append(current_cards[column_index])
                    current_cards[column_index] = None
                    header_buffers[column_index] = [line]
                    continue
                current_cards[column_index]["lines"].append(line)
                if int(row_entry["page"]) not in current_cards[column_index]["sourcePages"]:
                    current_cards[column_index]["sourcePages"].append(int(row_entry["page"]))
                continue
            if is_likely_inquiry_header_line(line):
                header_buffers[column_index].append(line)

    for current in current_cards.values():
        if current:
            cards.append(current)

    parsed = [parse_inquiry_card_payload(card) for card in cards]
    deduped: List[Dict[str, Any]] = []
    seen = set()
    for entry in parsed:
        key = (
            normalize_spaces(entry.get("subscriberName") or "").lower(),
            tuple(entry.get("inquiredOnDates") or []),
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(entry)
    return deduped


def is_soft_header_candidate(text: str) -> bool:
    clean = normalize_spaces(text)
    if not clean:
        return False
    lowered = clean.lower()
    if "inquired on" in lowered or "inquired by" in lowered:
        return False
    if is_inquiry_intro_line(clean):
        return False
    if re.search(DATE_PATTERN, clean):
        return False
    if re.search(r"\(\d{3}\)\s*\d{3}-?\d{4}", clean):
        return False
    if re.search(r"\b(?:po box|\d{2,}|[A-Z]{2}\s*,?\s*\d{5})\b", clean, re.IGNORECASE):
        return False
    if re.search(r"\b(?:road|rd|street|st|avenue|ave|blvd|boulevard|drive|dr|lane|ln|parkway|pkwy|place|pl|court|ct|suite|ste|center|ctr|floor|fl)\b", lowered):
        return False
    letters = re.findall(r"[A-Za-z]", clean)
    if not letters:
        return False
    uppercase_ratio = sum(1 for char in letters if char.isupper()) / len(letters)
    return uppercase_ratio >= 0.55 and len(clean) <= 52


def build_inquiry_lane_streams(rows: List[Dict[str, Any]]) -> List[List[Dict[str, Any]]]:
    if not rows:
        return []
    columns = infer_inquiry_columns(rows)
    if not columns:
        return []
    lanes: Dict[int, List[Dict[str, Any]]] = {idx: [] for idx in range(len(columns))}
    for row_entry in sorted(rows, key=lambda item: (int(item["page"]), float(item["row"]["bbox"]["yMin"]))):
        heading = canonical_heading(row_entry["text"])
        if heading in {"hard inquiries", "soft inquiries"} or is_inquiry_intro_line(row_entry["text"]):
            continue
        lane_blocks: Dict[int, List[str]] = {}
        for block in sorted(row_entry["row"].get("blocks") or [], key=lambda item: (item["bbox"]["xMin"], item["bbox"]["yMin"])):
            text = normalize_spaces(block.get("text") or "")
            if not text:
                continue
            column_index = min(range(len(columns)), key=lambda idx: abs(columns[idx] - float(block["bbox"]["xMin"])))
            lane_blocks.setdefault(column_index, []).append(text)
        for column_index, texts in lane_blocks.items():
            line = normalize_spaces(" ".join(texts))
            if not line:
                continue
            lanes[column_index].append({"page": int(row_entry["page"]), "text": line})
    return [lane for _, lane in sorted(lanes.items())]


def soft_header_group_length(stream: List[Dict[str, Any]], start_index: int, lookahead: int = 5) -> int:
    index = start_index
    while index < len(stream) and is_soft_header_candidate(stream[index]["text"]):
        index += 1
    if index == start_index:
        return 0
    if index < len(stream) and re.search(r"\bInquired (?:on|by)\b", stream[index]["text"], re.IGNORECASE):
        return index - start_index
    if index - start_index >= lookahead:
        return 0
    return 0


def extract_soft_inquiry_cards(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    lanes = build_inquiry_lane_streams(rows)
    cards: List[Dict[str, Any]] = []

    for lane in lanes:
        header_buffer: List[str] = []
        current: Optional[Dict[str, Any]] = None
        index = 0
        while index < len(lane):
            line = normalize_spaces(lane[index]["text"])
            page = int(lane[index]["page"])
            marker = re.search(r"\bInquired (?:on|by)\b", line, re.IGNORECASE)
            if marker:
                if current:
                    cards.append(current)
                prefix = normalize_spaces(line[: marker.start()])
                header_lines = list(header_buffer)
                if prefix:
                    header_lines.append(prefix)
                current = {
                    "headerLines": header_lines,
                    "lines": [normalize_spaces(line[marker.start() :])],
                    "sourcePages": [page],
                }
                header_buffer = []
                index += 1
                continue
            if current is not None:
                group_length = soft_header_group_length(lane, index)
                if group_length:
                    cards.append(current)
                    current = None
                    header_buffer = [normalize_spaces(item["text"]) for item in lane[index : index + group_length]]
                    index += group_length
                    continue
                current["lines"].append(line)
                if page not in current["sourcePages"]:
                    current["sourcePages"].append(page)
                index += 1
                continue
            if is_soft_header_candidate(line):
                header_buffer.append(line)
            index += 1
        if current:
            cards.append(current)

    parsed = [parse_inquiry_card_payload(card) for card in cards]
    deduped: List[Dict[str, Any]] = []
    seen = set()
    for entry in parsed:
        key = (
            normalize_spaces(entry.get("subscriberName") or "").lower(),
            tuple(entry.get("inquiredOnDates") or []),
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(entry)
    return deduped


def extract_account_entries(page_artifacts: List[Any], page_numbers: List[int]) -> List[Dict[str, Any]]:
    entries: List[Dict[str, Any]] = []
    lookback: List[Dict[str, Any]] = []
    current: Optional[Dict[str, Any]] = None
    stop_collection = False

    def account_prelude_rows(buffer: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        start_index: Optional[int] = None
        for idx in range(len(buffer) - 1, -1, -1):
            text = normalize_spaces(buffer[idx].get("text") or "")
            heading = canonical_heading(text)
            if is_meaningful_account_header(text) or heading in {"potentially negative", "your statement", "reinvestigation info"}:
                start_index = idx
                if is_meaningful_account_header(text):
                    break
        if start_index is None:
            return []
        return [entry for entry in buffer[start_index:] if canonical_heading(entry.get("text") or "") != "account info"]

    for page_number in page_numbers:
        if stop_collection:
            break
        page = page_artifacts[page_number - 1]
        for row in page_rows(page):
            text = row["text"]
            heading = canonical_heading(text)
            row_entry = {"page": page_number, "text": text, "row": row}
            if heading == "public records":
                stop_collection = True
                break
            if heading == "account info":
                if current:
                    entries.append(current)
                prelude_rows = account_prelude_rows(lookback)
                source_pages = unique_preserve_order([int(entry.get("page") or 0) for entry in prelude_rows] + [page_number])
                current = {
                    "headerContext": list(lookback[-8:]),
                    "rows": [*prelude_rows, row_entry],
                    "sourcePages": [page for page in source_pages if page > 0],
                }
            elif current is not None:
                current["rows"].append(row_entry)
                if page_number not in current["sourcePages"]:
                    current["sourcePages"].append(page_number)
            lookback.append(row_entry)
            if len(lookback) > 20:
                lookback = lookback[-20:]
    if current:
        entries.append(current)
    return entries


def extract_accounts(page_artifacts: List[Any], page_numbers: List[int]) -> Dict[str, Any]:
    entries = extract_account_entries(page_artifacts, page_numbers)
    parsed_accounts: List[Dict[str, Any]] = []
    for entry in entries:
        section_rows: Dict[str, List[Dict[str, Any]]] = {name: [] for name in ACCOUNT_SECTION_HEADINGS.values()}
        section_headings: Dict[str, Dict[str, Any]] = {}
        current_section: Optional[str] = None
        for row_entry in entry["rows"]:
            line = row_entry["text"]
            heading = canonical_heading(line)
            mapped = ACCOUNT_SECTION_HEADINGS.get(heading)
            if mapped:
                current_section = mapped
                section_headings[mapped] = row_entry
                continue
            if current_section:
                section_rows.setdefault(current_section, []).append(row_entry)

        account_info, account_info_evidence = parse_lane_key_value_rows_with_evidence(section_rows.get("accountInfo", []), ACCOUNT_INFO_LABEL_MAP)
        historical_info, historical_info_evidence = parse_lane_key_value_rows_with_evidence(
            section_rows.get("historicalInfo", []),
            HISTORICAL_INFO_LABEL_MAP,
            split_x=200.0,
        )
        header_lines = [item["text"] for item in entry["headerContext"] if is_meaningful_account_header(item["text"])]
        account_name = normalize_spaces(account_info.get("accountName") or "")
        if not account_name:
            account_name = next((line for line in reversed(header_lines) if canonical_heading(line) != "potentially negative"), "Not reported")
        account_number = normalize_spaces(account_info.get("accountNumber") or "Not reported")
        status = normalize_spaces(account_info.get("status") or "")
        if "amountPastDue" not in account_info_evidence:
            amount_past_due_match = re.search(r"(\$\s*[\d,]+(?:\.\d{2})?)\s+past due", status, re.IGNORECASE)
            status_detail = account_info_evidence.get("status")
            if amount_past_due_match and isinstance(status_detail, dict):
                amount_past_due_value = parse_currency(amount_past_due_match.group(1)) or normalize_spaces(amount_past_due_match.group(1))
                account_info_evidence["amountPastDue"] = {
                    **status_detail,
                    "field": "amountPastDue",
                    "value": amount_past_due_value,
                    "rawText": amount_past_due_value,
                    "state": "reported",
                }
        is_closed = bool(re.search(r"\bclosed\b", status, re.IGNORECASE) or re.search(r"\bclosed\b", account_name, re.IGNORECASE))
        payment_history_text_lines = collect_account_section_text_lines(
            page_artifacts,
            entry["sourcePages"],
            "payment history",
            {"contact info", "balance histories", "additional info", "historical info", "comment", "public records"},
        )
        payment_history_payload, payment_history_evidence = parse_payment_history_rows_with_evidence(
            section_rows.get("paymentHistory", []),
            fallback_lines=payment_history_text_lines,
        )
        balance_history_payload, balance_history_evidence, balance_history_section_evidence = parse_balance_history_rows_with_evidence(
            section_rows.get("balanceHistories", []),
            heading_row=section_headings.get("balanceHistories"),
        )
        consumer_statement, consumer_statement_evidence = parse_text_section_rows_with_evidence(
            section_rows.get("consumerStatement", []),
            "consumerStatement",
        )
        reinvestigation_info, reinvestigation_info_evidence = parse_text_section_rows_with_evidence(
            section_rows.get("reinvestigationInfo", []),
            "reinvestigationInfo",
        )
        field_evidence = finalize_field_evidence(
            {
                **account_info_evidence,
                **historical_info_evidence,
                **({"consumerStatement": consumer_statement_evidence} if consumer_statement_evidence else {}),
                **({"reinvestigationInfo": reinvestigation_info_evidence} if reinvestigation_info_evidence else {}),
                **({"balanceHistorySection": balance_history_section_evidence} if balance_history_section_evidence else {}),
            },
            account_name,
            account_number,
        )
        history_evidence = finalize_history_ids(
            {
                **payment_history_evidence,
                **balance_history_evidence,
            },
            account_name,
            account_number,
        )
        parsed_accounts.append(
            {
                "accountKey": f"{normalize_spaces(account_name).lower()}::{normalize_spaces(account_number).lower()}",
                "accountName": normalize_spaces(account_name),
                "accountNumber": account_number,
                "header": {
                    "accountName": normalize_spaces(account_name),
                    "accountNumber": account_number,
                    "isPotentiallyNegative": any("potentially negative" in item["text"].lower() for item in entry["headerContext"]),
                    "isClosed": is_closed,
                },
                "accountInfo": account_info,
                "paymentHistory": payment_history_payload,
                "balanceHistories": balance_history_payload,
                "additionalInfo": parse_additional_info_rows(section_rows.get("additionalInfo", [])),
                "consumerStatement": consumer_statement,
                "reinvestigationInfo": reinvestigation_info,
                "historicalInfo": historical_info,
                "contactInfo": parse_contact_rows(section_rows.get("contactInfo", [])),
                "comment": parse_comment_rows(section_rows.get("comment", [])),
                "_fieldEvidence": field_evidence,
                "_historyEvidence": history_evidence,
                "_sourcePages": entry["sourcePages"],
                "sourcePages": entry["sourcePages"],
            }
        )

    return {
        "accountCount": len(parsed_accounts),
        "accounts": parsed_accounts,
    }


def extract_public_records(page_artifacts: List[Any], page_numbers: List[int]) -> Dict[str, Any]:
    lines = [entry["text"] for entry in collect_lines_until_heading(page_artifacts, page_numbers, {"hard inquiries"})]
    joined = " ".join(lines)
    if re.search(r"no public records reported", joined, re.IGNORECASE):
        return {
            "publicRecordCount": 0,
            "records": [],
            "status": "No public records reported.",
        }

    labels = {
        "record type": "recordType",
        "reference number": "referenceNumber",
        "responsibility": "responsibility",
        "date filed": "dateFiled",
        "date resolved": "dateResolved",
        "on record until": "onRecordUntil",
        "court": "court",
        "address": "address",
        "phone number": "phoneNumber",
    }

    records: List[Dict[str, Any]] = []
    current: Optional[Dict[str, Any]] = None
    current_label: Optional[str] = None
    current_value_lines: List[str] = []
    title_lines: List[str] = []
    detail_lines: List[str] = []
    in_section = False
    in_details = False
    in_court = False

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
        nonlocal current, title_lines, detail_lines, in_details, in_court
        flush_label()
        if not current:
            title_lines = []
            detail_lines = []
            in_details = False
            in_court = False
            return
        summary = normalize_spaces(" ".join(title_lines[:1])) or normalize_spaces(current.get("recordType") or "")
        details = [line for line in unique_preserve_order(detail_lines) if line]
        court = normalize_spaces(current.get("court") or "")
        reference_number = normalize_spaces(current.get("referenceNumber") or "")
        if court and not reference_number:
            split_court, split_reference = split_trailing_public_record_identifier(court)
            if split_reference:
                court = split_court
                reference_number = split_reference
        records.append(
            {
                "recordType": normalize_spaces(current.get("recordType") or summary) or None,
                "court": court or None,
                "referenceNumber": reference_number or None,
                "dateFiled": normalize_spaces(current.get("dateFiled") or "") or None,
                "dateResolved": normalize_spaces(current.get("dateResolved") or "") or None,
                "summary": summary or "Public record",
                "details": details,
                "sourcePages": unique_preserve_order(current.get("sourcePages") or []),
                "responsibility": normalize_spaces(current.get("responsibility") or "") or None,
                "onRecordUntil": normalize_spaces(current.get("onRecordUntil") or "") or None,
                "address": normalize_spaces(current.get("address") or "") or None,
                "phoneNumber": normalize_spaces(current.get("phoneNumber") or "") or None,
            }
        )
        current = None
        title_lines = []
        detail_lines = []
        in_details = False
        in_court = False

    for line in lines:
        heading = canonical_heading(line)
        if heading == "public records":
            in_section = True
            continue
        if not in_section:
            continue
        if heading == "record details":
            if current and (current.get("referenceNumber") or current.get("recordType")):
                finalize_current()
            if current is None:
                current = {"sourcePages": unique_preserve_order(page_numbers)}
            in_details = True
            in_court = False
            continue
        if heading == "court information":
            in_court = True
            continue
        if line == "Potentially Negative":
            continue
        if heading in {"hard inquiries", "important messages", "contact experian", "know your rights"}:
            break
        if line.startswith("Information gathered from courts") or line.startswith("The most common Public Records are"):
            continue

        if not in_details:
            if current is None:
                current = {"sourcePages": unique_preserve_order(page_numbers)}
            title_lines.append(line)
            detail_lines.append(line)
            continue

        field_key = labels.get(heading)
        if field_key:
            flush_label()
            current_label = field_key
            current_value_lines = []
            detail_lines.append(line)
            continue

        if current_label is not None:
            current_value_lines.append(line)
            detail_lines.append(line)
            continue

        if in_court and current is not None:
            detail_lines.append(line)
            continue

        title_lines.append(line)
        detail_lines.append(line)

    finalize_current()

    return {
        "publicRecordCount": len(records),
        "records": records,
        "status": "Records extracted from public records section." if records else "No public records detected.",
    }


def split_inquiry_cards_from_text(lines: List[str]) -> List[List[str]]:
    cards: List[List[str]] = []
    current: List[str] = []
    for line in lines:
        if canonical_heading(line) in {"hard inquiries", "soft inquiries"}:
            continue
        if "inquired on" in line.lower() and current:
            cards.append(current)
            current = [line]
            continue
        current.append(line)
    if current:
        cards.append(current)
    return [card for card in cards if any("inquired on" in line.lower() for line in card)]


def parse_inquiry_card(card_lines: List[str], default_page: int) -> Dict[str, Any]:
    joined = " ".join(card_lines)
    anchor_index = next((index for index, line in enumerate(card_lines) if "inquired on" in line.lower()), 0)
    subscriber_parts = [line for line in card_lines[:anchor_index] if not re.search(r"\d", line)]
    subscriber_name = normalize_spaces(" ".join(subscriber_parts)) or "Not reported"
    dates = re.findall(DATE_PATTERN, joined)
    phone_match = re.search(r"\(\d{3}\)\s*\d{3}-?\d{4}", joined)
    address = []
    description_parts = []
    for line in card_lines[anchor_index + 1 :]:
        if re.search(r"\(\d{3}\)\s*\d{3}-?\d{4}", line):
            continue
        if re.search(r"\b(?:PO BOX|\d{2,}|[A-Z]{2}\s*,?\s*\d{5})\b", line, re.IGNORECASE):
            address.append(line)
            continue
        if re.search(r"inquiry is scheduled|auto loan|credit card|credit report|promotional inquiry|account review|direct to consumer|unspecified", line, re.IGNORECASE):
            description_parts.append(line)
    return {
        "subscriberName": subscriber_name,
        "inquiredOnDates": unique_preserve_order(dates),
        "address": unique_preserve_order(address),
        "phoneNumber": phone_match.group(0) if phone_match else None,
        "description": normalize_spaces(" ".join(description_parts)) or None,
        "sourcePages": [default_page],
    }


def extract_inquiries(page_artifacts: List[Any], page_numbers: List[int], section_heading: str, stop_headings: Iterable[str]) -> Dict[str, Any]:
    if section_heading.lower() in {"hard inquiries", "soft inquiries"}:
        rows_with_pages = collect_rows_until_heading(page_artifacts, page_numbers, stop_headings)
        in_section = False
        collected_rows: List[Dict[str, Any]] = []
        for entry in rows_with_pages:
            heading = canonical_heading(entry["text"])
            if heading == section_heading.lower():
                in_section = True
                continue
            if not in_section:
                continue
            collected_rows.append(entry)
        if section_heading.lower() == "soft inquiries":
            parsed_cards = extract_soft_inquiry_cards(collected_rows)
        else:
            parsed_cards = extract_hard_inquiry_cards(collected_rows)
        return {
            "inquiryCount": len(parsed_cards),
            "inquiries": parsed_cards,
        }

    lines_with_pages = collect_lines_until_heading(page_artifacts, page_numbers, stop_headings)
    in_section = False
    collected: List[Tuple[int, str]] = []
    for entry in lines_with_pages:
        heading = canonical_heading(entry["text"])
        if heading == section_heading.lower():
            in_section = True
            continue
        if not in_section:
            continue
        collected.append((entry["page"], entry["text"]))

    lines = [line for _, line in collected]
    cards = split_inquiry_cards_from_text(lines)
    parsed_cards = []
    for card in cards:
        first_line = card[0]
        source_page = next((page for page, line in collected if line == first_line), page_numbers[0] if page_numbers else 1)
        parsed_cards.append(parse_inquiry_card(card, source_page))
    return {
        "inquiryCount": len(parsed_cards),
        "inquiries": parsed_cards,
    }

def build_component_sources(
    page_windows: Dict[str, List[int]],
    accounts_component: Dict[str, Any],
    hard_inquiries: Dict[str, Any],
    soft_inquiries: Dict[str, Any],
) -> Dict[str, List[int]]:
    account_pages: List[int] = []
    for account in accounts_component.get("accounts") or []:
        account_pages.extend(account.get("sourcePages") or [])
    hard_pages: List[int] = []
    for entry in hard_inquiries.get("inquiries") or []:
        hard_pages.extend(entry.get("sourcePages") or [])
    soft_pages: List[int] = []
    for entry in soft_inquiries.get("inquiries") or []:
        soft_pages.extend(entry.get("sourcePages") or [])
    component_sources = {
        **page_windows,
        "accounts": unique_preserve_order(account_pages) or page_windows.get("accounts") or [],
        "hardInquiries": unique_preserve_order(hard_pages) or page_windows.get("hardInquiries") or [],
        "softInquiries": unique_preserve_order(soft_pages) or page_windows.get("softInquiries") or [],
    }
    return {key: [page for page in value if isinstance(page, int) and page > 0] for key, value in component_sources.items()}


def ensure_required_fields(components: Dict[str, Any]) -> List[Dict[str, Any]]:
    issues: List[Dict[str, Any]] = []
    overview = components.get("reportOverview") or {}
    if not overview.get("consumerName"):
        issues.append({
            "component": "reportOverview",
            "severity": "error",
            "code": "missing_consumer_name",
            "message": "Experian consumer name could not be extracted.",
        })
    if not overview.get("dateGenerated"):
        issues.append({
            "component": "reportOverview",
            "severity": "error",
            "code": "missing_date_generated",
            "message": "Experian date generated could not be extracted.",
        })
    if not overview.get("reportNumber"):
        issues.append({
            "component": "reportOverview",
            "severity": "error",
            "code": "missing_report_number",
            "message": "Experian report number could not be extracted.",
        })
    personal = components.get("personalInformation") or {}
    if not isinstance(personal.get("names"), list) or not personal.get("names"):
        issues.append({
            "component": "personalInformation",
            "severity": "error",
            "code": "missing_names",
            "message": "Experian personal names were not extracted.",
        })
    accounts = components.get("accounts") or {}
    if not isinstance(accounts.get("accounts"), list):
        issues.append({
            "component": "accounts",
            "severity": "error",
            "code": "invalid_accounts_schema",
            "message": "Experian accounts must contain an accounts array.",
        })
    else:
        for index, account in enumerate(accounts.get("accounts") or []):
            header = account.get("header") or {}
            account_name = normalize_spaces(header.get("accountName") or "")
            account_number = normalize_spaces(header.get("accountNumber") or "")
            if not account_name or canonical_heading(account_name) in {"not reported", "potentially negative"}:
                issues.append({
                    "component": "accounts",
                    "severity": "error",
                    "code": "missing_account_name",
                    "message": f"Experian account {index + 1} is missing a valid account name.",
                })
            if not account_number or canonical_heading(account_number) == "not reported":
                issues.append({
                    "component": "accounts",
                    "severity": "error",
                    "code": "missing_account_number",
                    "message": f"Experian account {index + 1} is missing an account number.",
                })
    for key in ["hardInquiries", "softInquiries"]:
        inquiries = components.get(key) or {}
        if not isinstance(inquiries.get("inquiries"), list):
            issues.append({
                "component": key,
                "severity": "error",
                "code": f"invalid_{key}_schema",
                "message": f"{key} must contain an inquiries array.",
            })
    public_records = components.get("publicRecords") or {}
    if not isinstance(public_records.get("records"), list):
        issues.append({
            "component": "publicRecords",
            "severity": "error",
            "code": "invalid_public_records_schema",
            "message": "publicRecords must contain a records array.",
        })
    return issues


def cross_validate(components: Dict[str, Any]) -> List[Dict[str, Any]]:
    issues: List[Dict[str, Any]] = []
    overview = components.get("reportOverview") or {}
    accounts = components.get("accounts") or {}
    public_records = components.get("publicRecords") or {}
    hard_inquiries = components.get("hardInquiries") or {}
    expected_accounts = ((overview.get("atAGlance") or {}).get("accountCount"))
    actual_accounts = len(accounts.get("accounts") or [])
    if isinstance(expected_accounts, int) and expected_accounts > 0 and expected_accounts != actual_accounts:
        issues.append({
            "component": "accounts",
            "severity": "error",
            "code": "account_count_mismatch",
            "message": f"At-a-Glance accounts ({expected_accounts}) do not match extracted accounts ({actual_accounts}).",
        })

    expected_public_records = ((overview.get("atAGlance") or {}).get("publicRecordCount"))
    actual_public_records = len(public_records.get("records") or [])
    if isinstance(expected_public_records, int) and expected_public_records == 0 and actual_public_records != 0:
        issues.append({
            "component": "publicRecords",
            "severity": "error",
            "code": "public_record_mismatch",
            "message": "Experian overview shows 0 public records but extracted public record entries were found.",
        })

    expected_hard = ((overview.get("atAGlance") or {}).get("hardInquiryCount"))
    actual_hard = len(hard_inquiries.get("inquiries") or [])
    if isinstance(expected_hard, int) and expected_hard != actual_hard:
        issues.append({
            "component": "hardInquiries",
            "severity": "error",
            "code": "hard_inquiry_count_mismatch",
            "message": f"Experian At-a-Glance hard inquiries ({expected_hard}) do not match extracted hard inquiries ({actual_hard}).",
        })

    return issues


def assess_component_status(validation_issues: List[Dict[str, Any]]) -> Dict[str, str]:
    status = {name: "complete" for name in EXPERIAN_COMPONENT_NAMES}
    for issue in validation_issues:
        component = issue.get("component")
        severity = str(issue.get("severity", "error")).lower()
        if component in status and severity in {"error", "critical"}:
            status[component] = "failed"
    return status


def extract_experian_components(page_artifacts: List[Any]) -> Tuple[Dict[str, Any], List[Dict[str, Any]], Dict[str, List[int]], Dict[str, List[int]]]:
    page_windows = discover_section_pages(page_artifacts)
    components = {
        "reportOverview": extract_report_overview(page_artifacts, page_windows["reportOverview"]),
        "personalInformation": extract_personal_information(page_artifacts, page_windows["personalInformation"]),
        "accounts": extract_accounts(page_artifacts, page_windows["accounts"]),
        "publicRecords": extract_public_records(page_artifacts, page_windows["publicRecords"]),
        "hardInquiries": extract_inquiries(page_artifacts, page_windows["hardInquiries"], "hard inquiries", {"soft inquiries"}),
        "softInquiries": extract_inquiries(page_artifacts, page_windows["softInquiries"], "soft inquiries", {"know your rights", "contact experian", "public records information", "important messages", "medical information"}),
    }
    component_sources = build_component_sources(
        page_windows,
        components["accounts"],
        components["hardInquiries"],
        components["softInquiries"],
    )
    validation_issues = ensure_required_fields(components)
    validation_issues.extend(cross_validate(components))
    return components, validation_issues, page_windows, component_sources
