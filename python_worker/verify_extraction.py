#!/usr/bin/env python3
import argparse
import json
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


PLACEHOLDER_VALUES = {
    "",
    "-",
    "not reported",
    "not available",
    "none",
    "null",
}

SKIP_SUBTREES = {"paymentStatusCodes", "collectionFields"}
SKIP_PATH_SUFFIXES = {
    "totalAccounts",
    "openAccounts",
    "closedAccounts",
    "hardInquiryCount",
    "softInquiryCount",
    "collectionCount",
    "inquiryCount",
    "publicRecordCount",
    "statementCount",
    "personalInfoItemCount",
    "inquiries",
    "publicRecords",
}


@dataclass
class PageText:
    page: int
    raw: str
    norm: str
    simple: str
    tokens: set[str]


def run_command(command: List[str]) -> str:
    completed = subprocess.run(command, text=True, capture_output=True, check=False)
    if completed.returncode != 0:
        raise RuntimeError(
            f"Command failed ({' '.join(command)}): {completed.stderr.strip() or completed.stdout.strip()}"
        )
    return completed.stdout


def normalize_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def normalize_text(value: str) -> str:
    return normalize_spaces((value or "").lower())


def simplify_text(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (value or "").lower())


def extract_pdf_pages(pdf_path: Path) -> List[PageText]:
    text = run_command(["pdftotext", "-layout", str(pdf_path), "-"])
    raw_pages = text.split("\f")
    pages: List[PageText] = []
    for index, raw in enumerate(raw_pages, start=1):
        stripped = raw.strip()
        if not stripped:
            continue
        pages.append(
            PageText(
                page=index,
                raw=raw,
                norm=normalize_text(raw),
                simple=simplify_text(raw),
                tokens=set(re.findall(r"[a-z0-9]+", normalize_text(raw))),
            )
        )
    return pages


def load_result_payload(result_json: Path) -> Dict[str, Any]:
    data = json.loads(result_json.read_text(encoding="utf-8"))

    if isinstance(data, dict) and "result" in data and isinstance(data["result"], dict):
        return data["result"]
    if isinstance(data, dict) and data.get("status") == "ok" and isinstance(data.get("result"), dict):
        return data["result"]
    if isinstance(data, dict) and "components" in data:
        return data
    raise RuntimeError("Could not locate extraction result envelope in JSON.")


def profile_id_from_result(result_payload: Dict[str, Any]) -> str:
    meta = result_payload.get("meta") or {}
    return str(meta.get("profileId") or result_payload.get("profile") or "").strip()


def top_component_from_path(path: str) -> str:
    match = re.search(r"(?:^|\.)(?:components\.)?([a-zA-Z_]+)(?:\[|\.|$)", path)
    if match:
        token = match.group(1)
        if token != "components":
            return token
    tokens = [token for token in path.split(".") if token]
    if tokens:
        return tokens[0].split("[")[0]
    return "unknown"


def is_placeholder(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        normalized = normalize_text(value)
        return normalized in PLACEHOLDER_VALUES
    return False


def should_skip_field(path: str, value: Any) -> bool:
    leaf = path.split(".")[-1].split("[")[0]
    if leaf in SKIP_PATH_SUFFIXES:
        return True

    # Numeric counters and very short numbers are validated by dedicated cross-checks.
    if isinstance(value, (int, float)):
        return True
    if isinstance(value, str):
        normalized = normalize_text(value)
        if re.fullmatch(r"[\d,\.%$]+", normalized):
            digit_count = len(re.sub(r"\D", "", normalized))
            if digit_count <= 3:
                return True
    return False


def collect_scalar_fields(value: Any, path: str, out: List[Dict[str, Any]]) -> None:
    if isinstance(value, dict):
        key = path.split(".")[-1] if path else ""
        if key in SKIP_SUBTREES:
            return
        for child_key, child_value in value.items():
            child_path = f"{path}.{child_key}" if path else child_key
            collect_scalar_fields(child_value, child_path, out)
        return

    if isinstance(value, list):
        for index, child in enumerate(value):
            child_path = f"{path}[{index}]"
            collect_scalar_fields(child, child_path, out)
        return

    if is_placeholder(value) or should_skip_field(path, value):
        return

    if isinstance(value, (str, int, float, bool)):
        out.append(
            {
                "path": path,
                "component": top_component_from_path(path),
                "value": str(value),
            }
        )


def value_candidates(value: str, path: str = "") -> List[str]:
    normalized = normalize_text(value)
    simple = simplify_text(value)
    candidates = []
    if len(normalized) >= 4:
        candidates.append(normalized)
    if len(simple) >= 4 and simple != normalized:
        candidates.append(simple)
    if "paymentHistory[" in path and len(normalized) >= 2:
        candidates.append(normalized)

    # Try currency/date relaxed variants
    if re.search(r"\$", value):
        no_currency = normalize_text(value.replace("$", "").replace(",", ""))
        if len(no_currency) >= 4:
            candidates.append(no_currency)

    month_variant = normalize_text(re.sub(r",", "", value))
    if len(month_variant) >= 4:
        candidates.append(month_variant)

    unique: List[str] = []
    seen = set()
    for candidate in candidates:
        if candidate in seen:
            continue
        seen.add(candidate)
        unique.append(candidate)
    return unique


def fuzzy_tokens_match(value: str, page: PageText, path: str) -> bool:
    min_length = 1 if "paymentHistory[" in path else 2
    tokens = [token for token in re.findall(r"[a-z0-9]+", normalize_text(value)) if len(token) >= min_length]
    if not tokens:
        return False

    if "paymentHistory[" in path and len(tokens) == 1:
        token = tokens[0]
        return bool(re.search(rf"(?<![A-Za-z0-9]){re.escape(token)}(?![A-Za-z0-9])", page.raw, flags=re.IGNORECASE))

    matched = sum(1 for token in tokens if token in page.tokens)
    if matched == len(tokens):
        return True
    if len(tokens) >= 4 and matched >= len(tokens) - 1:
        return True
    return False


def find_value_pages(value: str, pages: List[PageText], path: str = "") -> List[int]:
    candidates = value_candidates(value, path)
    hits: List[int] = []
    for page in pages:
        page_hit = False
        for candidate in candidates:
            if candidate in page.norm:
                page_hit = True
                break
            if candidate in page.simple:
                page_hit = True
                break
        if not page_hit and fuzzy_tokens_match(value, page, path):
            page_hit = True
        if page_hit:
            hits.append(page.page)
    return hits


def history_field_from_path(result_payload: Dict[str, Any], path: str) -> Optional[Tuple[int, str, int, Optional[str]]]:
    monthly_match = re.match(
        r"^components\.accounts\.accounts\[(\d+)\]\.(balanceHistory|scheduledPaymentHistory|actualPaymentHistory|creditLimitHistory|amountPastDueHistory|activityDesignatorHistory)\[(\d+)\]\.(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)$",
        path,
    )
    if monthly_match:
        return int(monthly_match.group(1)), monthly_match.group(2), int(monthly_match.group(3)), monthly_match.group(4)

    payment_match = re.match(r"^components\.accounts\.accounts\[(\d+)\]\.paymentHistory\[(\d+)\]$", path)
    if payment_match:
        flat_index = int(payment_match.group(2))
        return int(payment_match.group(1)), "paymentHistory", flat_index // 12, MONTHS[flat_index % 12]

    new_equifax_payment = re.match(
        r"^components\.accounts\.accounts\[(\d+)\]\.paymentHistory\[(\d+)\]\.(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)$",
        path,
    )
    if new_equifax_payment:
        return (
            int(new_equifax_payment.group(1)),
            "paymentHistory",
            int(new_equifax_payment.group(2)),
            new_equifax_payment.group(3),
        )

    new_equifax_month24 = re.match(
        r"^components\.accounts\.accounts\[(\d+)\]\.month24History\.sections\[(\d+)\]\.rows\[(\d+)\]\.(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)$",
        path,
    )
    if new_equifax_month24:
        account_index = int(new_equifax_month24.group(1))
        section_index = int(new_equifax_month24.group(2))
        row_index = int(new_equifax_month24.group(3))
        month = new_equifax_month24.group(4)
        accounts = (((result_payload.get("components") or {}).get("accounts") or {}).get("accounts")) or []
        if not isinstance(accounts, list) or account_index >= len(accounts):
            return None
        sections = (((accounts[account_index] or {}).get("month24History") or {}).get("sections")) or []
        if not isinstance(sections, list) or section_index >= len(sections):
            return None
        section_key = normalize_spaces(str((sections[section_index] or {}).get("key") or ""))
        if not section_key:
            return None
        return account_index, f"month24:{section_key}", row_index, month
    return None


MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]


def evidence_pages_for_history_path(result_payload: Dict[str, Any], path: str, value: str) -> List[int]:
    parsed = history_field_from_path(result_payload, path)
    if not parsed:
        return []

    account_index, field_name, row_index, month = parsed
    meta = result_payload.get("meta") or {}
    evidence_accounts = meta.get("accountHistoryEvidence") or []
    if not isinstance(evidence_accounts, list) or account_index >= len(evidence_accounts):
        return []

    account_evidence = evidence_accounts[account_index] or {}
    fields = account_evidence.get("fields") or {}
    rows = fields.get(field_name) or []
    if not isinstance(rows, list) or row_index >= len(rows):
        return []

    row = rows[row_index] or {}
    months = row.get("months") or {}
    cell = months.get(month or "") or {}
    if normalize_text(str(cell.get("value") or "")) != normalize_text(value):
        return []

    page_number = cell.get("pageNumber")
    if isinstance(page_number, int) and page_number > 0:
        return [page_number]
    return []


def inquiry_evidence_pages(result_payload: Dict[str, Any], path: str, value: str) -> List[int]:
    match = re.match(r"^components\.inquiries\.(hardInquiries|softInquiries)\[(\d+)\]\.(contact|subscriberName|inquiryDate|purpose)$", path)
    if not match:
        return []

    list_name = match.group(1)
    index = int(match.group(2))
    field_name = match.group(3)
    meta = result_payload.get("meta") or {}
    inquiry_evidence = meta.get("inquiryEvidence") or {}
    entries = inquiry_evidence.get(list_name) or []
    if not isinstance(entries, list) or index >= len(entries):
        return []

    entry = entries[index] or {}
    if field_name in {"contact", "subscriberName", "inquiryDate"}:
        if normalize_text(str(entry.get(field_name) or "")) != normalize_text(value):
            return []
    pages = entry.get("pages") or []
    return [int(page) for page in pages if isinstance(page, int) and page > 0]


def load_fixture(path: Optional[Path]) -> Optional[Dict[str, Any]]:
    if not path:
        return None
    if not path.exists():
        raise RuntimeError(f"Fixture not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def component_source_pages(result_payload: Dict[str, Any], component_name: str) -> List[int]:
    meta = result_payload.get("meta") or {}
    source_map = meta.get("componentSources") or meta.get("pageWindows") or {}
    value = source_map.get(component_name)
    if isinstance(value, list):
        return [int(page) for page in value if isinstance(page, int) and page > 0]
    if isinstance(value, dict):
        return [int(page) for page in value.get("pages") or [] if isinstance(page, int) and page > 0]
    return []


def find_account_by_identity(result_payload: Dict[str, Any], account_name: str, account_number: str) -> Optional[Dict[str, Any]]:
    accounts = (((result_payload.get("components") or {}).get("accounts") or {}).get("accounts")) or []
    expected_name = normalize_text(account_name)
    expected_number = normalize_spaces(account_number)
    for account in accounts:
        if not isinstance(account, dict):
            continue
        if normalize_text(str(account.get("accountName") or "")) != expected_name:
            continue
        if normalize_spaces(str(account.get("accountNumber") or "")) != expected_number:
            continue
        return account
    return None


def fixture_checks_for_equifax_new(result_payload: Dict[str, Any], fixture: Dict[str, Any]) -> List[Dict[str, Any]]:
    checks: List[Dict[str, Any]] = []
    components = result_payload.get("components") or {}
    accounts_component = components.get("accounts") or {}
    inquiries_component = components.get("inquiries") or {}

    expected_counts = fixture.get("expectedCounts") or {}
    if "accounts" in expected_counts:
        actual_accounts = len((accounts_component.get("accounts") or [])) if isinstance(accounts_component, dict) else 0
        checks.append(
            {
                "name": "fixture_accounts_count",
                "component": "accounts",
                "expected": expected_counts.get("accounts"),
                "actual": actual_accounts,
                "pass": actual_accounts == expected_counts.get("accounts"),
            }
        )
    if "inquiries" in expected_counts:
        actual_inquiries = len((inquiries_component.get("inquiries") or [])) if isinstance(inquiries_component, dict) else 0
        checks.append(
            {
                "name": "fixture_inquiries_count",
                "component": "inquiries",
                "expected": expected_counts.get("inquiries"),
                "actual": actual_inquiries,
                "pass": actual_inquiries == expected_counts.get("inquiries"),
            }
        )

    for component_name, expected_pages in (fixture.get("componentSources") or {}).items():
        actual_pages = component_source_pages(result_payload, component_name)
        checks.append(
            {
                "name": f"fixture_source_pages_{component_name}",
                "component": component_name,
                "expected": expected_pages,
                "actual": actual_pages,
                "pass": actual_pages == expected_pages,
            }
        )

    for account_check in fixture.get("accountChecks") or []:
        account_name = str(account_check.get("accountName") or "")
        account_number = str(account_check.get("accountNumber") or "")
        account = find_account_by_identity(result_payload, account_name, account_number)
        identity = f"{account_name} {account_number}".strip()
        checks.append(
            {
                "name": f"fixture_account_present_{identity}",
                "component": "accounts",
                "expected": "present",
                "actual": "present" if account else "missing",
                "pass": account is not None,
            }
        )
        if not account:
            continue

        if "address" in account_check:
            actual_value = normalize_spaces(str(account.get("address") or ""))
            expected_value = normalize_spaces(str(account_check.get("address") or ""))
            checks.append(
                {
                    "name": f"fixture_account_address_{identity}",
                    "component": "accounts",
                    "expected": expected_value,
                    "actual": actual_value,
                    "pass": actual_value == expected_value,
                }
            )
        if "phoneNumber" in account_check:
            actual_value = normalize_spaces(str(account.get("phoneNumber") or ""))
            expected_value = normalize_spaces(str(account_check.get("phoneNumber") or ""))
            checks.append(
                {
                    "name": f"fixture_account_phone_{identity}",
                    "component": "accounts",
                    "expected": expected_value,
                    "actual": actual_value,
                    "pass": actual_value == expected_value,
                }
            )
        if "paymentHistoryMinRows" in account_check:
            actual_rows = len(account.get("paymentHistory") or [])
            expected_min = int(account_check.get("paymentHistoryMinRows") or 0)
            checks.append(
                {
                    "name": f"fixture_payment_history_rows_{identity}",
                    "component": "accounts",
                    "expected": f">={expected_min}",
                    "actual": actual_rows,
                    "pass": actual_rows >= expected_min,
                }
            )
        if "paymentHistoryHasValue" in account_check:
            expected_value = normalize_spaces(str(account_check.get("paymentHistoryHasValue") or ""))
            rows = account.get("paymentHistory") or []
            found_value = False
            for row in rows:
                if not isinstance(row, dict):
                    continue
                for month in MONTHS:
                    if normalize_spaces(str(row.get(month) or "")) == expected_value:
                        found_value = True
                        break
                if found_value:
                    break
            checks.append(
                {
                    "name": f"fixture_payment_history_has_value_{identity}",
                    "component": "accounts",
                    "expected": expected_value,
                    "actual": expected_value if found_value else "missing",
                    "pass": found_value,
                }
            )
        for cell_check in account_check.get("paymentHistoryCells") or []:
            year = str(cell_check.get("year") or "")
            month = normalize_text(str(cell_check.get("month") or ""))
            expected_value = normalize_spaces(str(cell_check.get("value") or ""))
            actual_value = ""
            for row in account.get("paymentHistory") or []:
                if not isinstance(row, dict) or normalize_spaces(str(row.get("year") or "")) != year:
                    continue
                actual_value = normalize_spaces(str(row.get(month) or ""))
                break
            checks.append(
                {
                    "name": f"fixture_payment_history_cell_{identity}_{year}_{month}",
                    "component": "accounts",
                    "expected": expected_value,
                    "actual": actual_value or "missing",
                    "pass": actual_value == expected_value,
                }
            )

    return checks


def compute_cross_checks(components: Dict[str, Any], profile_id: str) -> List[Dict[str, Any]]:
    if profile_id == "equifax_new_v1":
        accounts_component = components.get("accounts") or {}
        inquiries_component = components.get("inquiries") or {}
        actual_accounts = len((accounts_component.get("accounts") or [])) if isinstance(accounts_component, dict) else 0
        actual_inquiries = len((inquiries_component.get("inquiries") or [])) if isinstance(inquiries_component, dict) else 0
        return [
            {
                "name": "accounts_count_component_consistency",
                "expected": parse_int(accounts_component.get("accountCount")) if isinstance(accounts_component, dict) else None,
                "actual": actual_accounts,
                "pass": (not isinstance(accounts_component, dict))
                or parse_int(accounts_component.get("accountCount")) in {None, actual_accounts},
            },
            {
                "name": "inquiries_count_component_consistency",
                "expected": parse_int(inquiries_component.get("inquiryCount")) if isinstance(inquiries_component, dict) else None,
                "actual": actual_inquiries,
                "pass": (not isinstance(inquiries_component, dict))
                or parse_int(inquiries_component.get("inquiryCount")) in {None, actual_inquiries},
            },
        ]

    checks: List[Dict[str, Any]] = []

    summary_rows = components.get("creditAccountsSummary") or []
    accounts = ((components.get("accounts") or {}).get("accounts")) or []
    other = components.get("otherItemsSummary") or {}
    collections = ((components.get("collections") or {}).get("collections")) or []
    inquiries = components.get("inquiries") or {}

    summary_total = None
    if isinstance(summary_rows, list):
        for row in summary_rows:
            if not isinstance(row, dict):
                continue
            if str(row.get("accountType", "")).lower() == "total":
                raw = row.get("totalAccounts")
                try:
                    summary_total = int(raw) if raw is not None else None
                except Exception:
                    summary_total = None
                break

    extracted_accounts = len(accounts) if isinstance(accounts, list) else 0
    checks.append(
        {
            "name": "accounts_count_vs_summary_total",
            "expected": summary_total,
            "actual": extracted_accounts,
            "pass": (summary_total is None) or (summary_total == extracted_accounts),
        }
    )

    summary_collections = other.get("collectionCount")
    extracted_collections = len(collections) if isinstance(collections, list) else 0
    checks.append(
        {
            "name": "collections_count_vs_other_items",
            "expected": summary_collections,
            "actual": extracted_collections,
            "pass": (summary_collections in (None, "")) or (summary_collections == extracted_collections),
        }
    )

    summary_inquiries = other.get("inquiryCount")
    actual_inquiries = int(inquiries.get("hardInquiryCount") or 0) + int(inquiries.get("softInquiryCount") or 0)
    checks.append(
        {
            "name": "inquiries_count_vs_other_items",
            "expected": summary_inquiries,
            "actual": actual_inquiries,
            "pass": (summary_inquiries in (None, "")) or (summary_inquiries == actual_inquiries),
        }
    )

    return checks


def parse_int(value: Any) -> Optional[int]:
    if value in (None, ""):
        return None
    try:
        return int(str(value).replace(",", "").strip())
    except Exception:
        return None


def looks_like_date(value: Optional[str]) -> bool:
    if not value:
        return False
    text = normalize_text(value)
    if re.search(r"\b\d{1,2}/\d{1,2}/\d{2,4}\b", text):
        return True
    if re.search(r"\b[a-z]{3,9}\s+\d{1,2},\s+\d{4}\b", text):
        return True
    return False


def add_quality_issue(
    issues: List[Dict[str, Any]],
    component: str,
    path: str,
    rule: str,
    message: str,
    severity: str = "error",
) -> None:
    issues.append(
        {
            "component": component,
            "path": path,
            "rule": rule,
            "severity": severity,
            "message": message,
        }
    )


def string_list(value: Any) -> List[str]:
    if isinstance(value, list):
        return [normalize_spaces(str(item)) for item in value if normalize_spaces(str(item))]
    if isinstance(value, str) and normalize_spaces(value):
        return [normalize_spaces(value)]
    return []


def compute_quality_issues(components: Dict[str, Any], component_status: Dict[str, str], profile_id: str) -> List[Dict[str, Any]]:
    if profile_id == "equifax_new_v1":
        issues: List[Dict[str, Any]] = []
        confirmation = components.get("reportConfirmationDetails") or {}
        if not normalize_spaces(str(confirmation.get("confirmationNumber") or "")):
            add_quality_issue(
                issues,
                "reportConfirmationDetails",
                "components.reportConfirmationDetails.confirmationNumber",
                "required_field_missing",
                "Confirmation number is missing.",
                severity="critical",
            )
        if not normalize_spaces(str(confirmation.get("reportDate") or "")):
            add_quality_issue(
                issues,
                "reportConfirmationDetails",
                "components.reportConfirmationDetails.reportDate",
                "required_field_missing",
                "Report date is missing.",
                severity="critical",
            )

        accounts = ((components.get("accounts") or {}).get("accounts")) or []
        if not isinstance(accounts, list) or len(accounts) == 0:
            add_quality_issue(
                issues,
                "accounts",
                "components.accounts.accounts",
                "empty_accounts",
                "No accounts extracted.",
                severity="critical",
            )
        else:
            missing_contact_accounts = 0
            missing_payment_history_accounts = 0
            for idx, account in enumerate(accounts):
                if not isinstance(account, dict):
                    continue
                address = normalize_spaces(str(account.get("address") or ""))
                phone = normalize_spaces(str(account.get("phoneNumber") or ""))
                if not address and not phone:
                    missing_contact_accounts += 1
                if not isinstance(account.get("paymentHistory"), list):
                    missing_payment_history_accounts += 1
                elif len(account.get("paymentHistory") or []) == 0:
                    missing_payment_history_accounts += 1
            if missing_contact_accounts == len(accounts):
                add_quality_issue(
                    issues,
                    "accounts",
                    "components.accounts.accounts[*].address",
                    "missing_contact_information",
                    "All new-Equifax accounts are missing address and phone information.",
                    severity="critical",
                )
            elif missing_contact_accounts > 0:
                add_quality_issue(
                    issues,
                    "accounts",
                    "components.accounts.accounts[*].address",
                    "missing_contact_information",
                    f"{missing_contact_accounts}/{len(accounts)} new-Equifax accounts are missing both address and phone information.",
                    severity="warning",
                )
            if missing_payment_history_accounts == len(accounts):
                add_quality_issue(
                    issues,
                    "accounts",
                    "components.accounts.accounts[*].paymentHistory",
                    "missing_payment_history",
                    "All new-Equifax accounts are missing payment history.",
                    severity="critical",
                )

        for component, status in component_status.items():
            if status == "failed":
                add_quality_issue(
                    issues,
                    component,
                    f"components.{component}",
                    "component_failed",
                    "Component failed validation checks in extraction pipeline.",
                    severity="error",
                )
        return issues

    issues: List[Dict[str, Any]] = []
    suspicious_phrases = [
        "or lender if you have any questions",
        "view detailed information",
        "the tables below show",
        "credit accounts",
        "other items",
        "collections stay on your",
        "page ",
    ]

    confirmation = components.get("reportConfirmationDetails") or {}
    if not normalize_spaces(str(confirmation.get("confirmationNumber") or "")):
        add_quality_issue(
            issues,
            "reportConfirmationDetails",
            "components.reportConfirmationDetails.confirmationNumber",
            "required_field_missing",
            "Confirmation number is missing.",
            severity="critical",
        )
    if not normalize_spaces(str(confirmation.get("reportDate") or "")):
        add_quality_issue(
            issues,
            "reportConfirmationDetails",
            "components.reportConfirmationDetails.reportDate",
            "required_field_missing",
            "Report date is missing.",
            severity="critical",
        )

    summary = components.get("summary") or {}
    if summary.get("accountsWithNegativeInfo") is None:
        add_quality_issue(
            issues,
            "summary",
            "components.summary.accountsWithNegativeInfo",
            "required_field_missing",
            "Accounts with negative info should be populated.",
        )
    oldest = summary.get("oldestAccount") or {}
    if oldest and not looks_like_date(oldest.get("openDate")):
        add_quality_issue(
            issues,
            "summary",
            "components.summary.oldestAccount.openDate",
            "invalid_date",
            "Oldest account open date is not a valid date format.",
        )
    recent = summary.get("recentAccount") or {}
    if recent and not looks_like_date(recent.get("openDate")):
        add_quality_issue(
            issues,
            "summary",
            "components.summary.recentAccount.openDate",
            "invalid_date",
            "Recent account open date is not a valid date format.",
        )

    summary_rows = components.get("creditAccountsSummary") or []
    expected_types = ["Revolving", "Mortgage", "Installment", "Other", "Total"]
    if not isinstance(summary_rows, list) or len(summary_rows) != 5:
        add_quality_issue(
            issues,
            "creditAccountsSummary",
            "components.creditAccountsSummary",
            "invalid_row_count",
            "Credit accounts summary must have exactly 5 rows.",
            severity="critical",
        )
    else:
        for index, expected in enumerate(expected_types):
            row = summary_rows[index] if index < len(summary_rows) else {}
            actual = row.get("accountType") if isinstance(row, dict) else None
            if actual != expected:
                add_quality_issue(
                    issues,
                    "creditAccountsSummary",
                    f"components.creditAccountsSummary[{index}].accountType",
                    "invalid_row_order",
                    f"Expected row '{expected}', got '{actual}'.",
                )

            if isinstance(row, dict):
                total_accounts = parse_int(row.get("totalAccounts"))
                with_balance = parse_int(row.get("withBalance"))
                if total_accounts is not None and with_balance is not None and with_balance > total_accounts:
                    add_quality_issue(
                        issues,
                        "creditAccountsSummary",
                        f"components.creditAccountsSummary[{index}].withBalance",
                        "count_logic_error",
                        f"withBalance ({with_balance}) exceeds totalAccounts ({total_accounts}).",
                    )

        compare_rows = []
        for idx in [1, 2, 3]:
            row = summary_rows[idx] if idx < len(summary_rows) and isinstance(summary_rows[idx], dict) else {}
            compare_rows.append(
                (
                    row.get("totalAccounts"),
                    row.get("open"),
                    row.get("withBalance"),
                    row.get("totalBalance"),
                    row.get("available"),
                    row.get("creditLimit"),
                    row.get("debtToCredit"),
                    row.get("payment"),
                )
            )
        if compare_rows[0] == compare_rows[1] == compare_rows[2]:
            add_quality_issue(
                issues,
                "creditAccountsSummary",
                "components.creditAccountsSummary",
                "duplicated_rows",
                "Mortgage/Installment/Other rows have identical values, likely mis-mapped table extraction.",
                severity="critical",
            )

    accounts = ((components.get("accounts") or {}).get("accounts")) or []
    if not isinstance(accounts, list) or len(accounts) == 0:
        add_quality_issue(
            issues,
            "accounts",
            "components.accounts.accounts",
            "empty_accounts",
            "No accounts extracted.",
            severity="critical",
        )
    else:
        unresolved_open_dates = 0
        missing_contact_accounts = 0
        for idx, account in enumerate(accounts):
            if not isinstance(account, dict):
                continue
            name = normalize_text(str(account.get("accountName") or ""))
            status = normalize_text(str(account.get("status") or ""))
            loan_type = normalize_text(str(account.get("loanType") or ""))
            comments = string_list(account.get("comments"))
            contact = string_list(account.get("contact"))
            if any(phrase in name for phrase in suspicious_phrases):
                add_quality_issue(
                    issues,
                    "accounts",
                    f"components.accounts.accounts[{idx}].accountName",
                    "contaminated_value",
                    "Account name contains narrative/report boilerplate text.",
                )
            if "available credit" in status or "account history" in status:
                add_quality_issue(
                    issues,
                    "accounts",
                    f"components.accounts.accounts[{idx}].status",
                    "contaminated_value",
                    "Account status contains adjacent table/summary text.",
                )
            if "date closed" in loan_type:
                add_quality_issue(
                    issues,
                    "accounts",
                    f"components.accounts.accounts[{idx}].loanType",
                    "contaminated_value",
                    "Loan type contains unrelated field labels.",
                )
            if normalize_text(str(account.get("openDate") or "")) in PLACEHOLDER_VALUES and normalize_text(
                str(account.get("dateOpened") or "")
            ) in PLACEHOLDER_VALUES:
                unresolved_open_dates += 1
            if not contact:
                missing_contact_accounts += 1

            for comment_index, comment in enumerate(comments):
                normalized_comment = normalize_text(comment)
                if normalized_comment in {"comments", "contact", "comments contact", "comments | contact"}:
                    add_quality_issue(
                        issues,
                        "accounts",
                        f"components.accounts.accounts[{idx}].comments[{comment_index}]",
                        "contaminated_value",
                        "Account comments still contain the section header instead of extracted comment text.",
                        severity="critical",
                    )

            for contact_index, contact_value in enumerate(contact):
                normalized_contact = normalize_text(contact_value)
                if normalized_contact in {"comments", "contact", "comments contact", "comments | contact"}:
                    add_quality_issue(
                        issues,
                        "accounts",
                        f"components.accounts.accounts[{idx}].contact[{contact_index}]",
                        "contaminated_value",
                        "Account contact still contains the section header instead of extracted contact text.",
                        severity="critical",
                    )

        if unresolved_open_dates == len(accounts):
            add_quality_issue(
                issues,
                "accounts",
                "components.accounts.accounts[*].openDate",
                "missing_key_dates",
                "All extracted accounts are missing open date.",
            )
        if missing_contact_accounts == len(accounts):
            add_quality_issue(
                issues,
                "accounts",
                "components.accounts.accounts[*].contact",
                "missing_contact_information",
                "All extracted accounts are missing contact information.",
                severity="critical",
            )
        elif missing_contact_accounts > 0:
            add_quality_issue(
                issues,
                "accounts",
                "components.accounts.accounts[*].contact",
                "missing_contact_information",
                f"{missing_contact_accounts}/{len(accounts)} accounts are missing contact information.",
                severity="warning",
            )

    collections = ((components.get("collections") or {}).get("collections")) or []
    if isinstance(collections, list):
        null_agencies = 0
        for idx, collection in enumerate(collections):
            if not isinstance(collection, dict):
                continue
            agency = normalize_text(str(collection.get("collectionAgency") or ""))
            status = normalize_text(str(collection.get("status") or ""))
            if not agency:
                null_agencies += 1
            if any(phrase in agency for phrase in suspicious_phrases):
                add_quality_issue(
                    issues,
                    "collections",
                    f"components.collections.collections[{idx}].collectionAgency",
                    "contaminated_value",
                    "Collection agency contains narrative/report text.",
                )
            if "date of first delinquency" in status:
                add_quality_issue(
                    issues,
                    "collections",
                    f"components.collections.collections[{idx}].status",
                    "contaminated_value",
                    "Collection status contains adjacent label text.",
                )
        if len(collections) > 0 and null_agencies > 0:
            add_quality_issue(
                issues,
                "collections",
                "components.collections.collections[*].collectionAgency",
                "missing_required_fields",
                f"{null_agencies}/{len(collections)} collection entries are missing collection agency name.",
            )

    inquiries = components.get("inquiries") or {}
    hard = inquiries.get("hardInquiries") or []
    soft = inquiries.get("softInquiries") or []
    total_inquiries = len(hard) + len(soft)
    other = components.get("otherItemsSummary") or {}
    expected_inquiries = parse_int(other.get("inquiryCount"))
    if expected_inquiries and expected_inquiries > 0 and total_inquiries == 0:
        add_quality_issue(
            issues,
            "inquiries",
            "components.inquiries",
            "count_mismatch",
            f"Other items indicates {expected_inquiries} inquiries but extracted 0.",
            severity="critical",
        )

    for component, status in component_status.items():
        if status == "failed":
            add_quality_issue(
                issues,
                component,
                f"components.{component}",
                "component_failed",
                "Component failed validation checks in extraction pipeline.",
                severity="error",
            )

    return issues


def build_verification_report(
    result_payload: Dict[str, Any],
    components: Dict[str, Any],
    pages: List[PageText],
    component_status: Dict[str, str],
    validation_issues: List[Dict[str, Any]],
    fixture: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    profile_id = profile_id_from_result(result_payload)
    fields: List[Dict[str, Any]] = []
    collect_scalar_fields({"components": components}, "", fields)

    checks: List[Dict[str, Any]] = []
    by_component: Dict[str, Dict[str, Any]] = {}

    matched = 0
    unmatched = 0

    for field in fields:
        value = field["value"]
        hits = find_value_pages(value, pages, field["path"])
        evidence_hits = evidence_pages_for_history_path(result_payload, field["path"], value)
        if not hits and evidence_hits:
            hits = evidence_hits
        if not hits:
            inquiry_hits = inquiry_evidence_pages(result_payload, field["path"], value)
            if inquiry_hits:
                hits = inquiry_hits
        field_check = {
            "path": field["path"],
            "component": field["component"],
            "value": value,
            "found": bool(hits),
            "pages": hits,
        }
        checks.append(field_check)

        bucket = by_component.setdefault(
            field["component"],
            {"total": 0, "matched": 0, "unmatched": 0, "unmatchedFields": []},
        )
        bucket["total"] += 1
        if hits:
            matched += 1
            bucket["matched"] += 1
        else:
            unmatched += 1
            bucket["unmatched"] += 1
            bucket["unmatchedFields"].append(field["path"])

    for component, stats in by_component.items():
        total = stats["total"] or 1
        stats["matchRate"] = round(stats["matched"] / total, 4)
        stats["componentStatus"] = component_status.get(component)

    cross_checks = compute_cross_checks(components, profile_id)
    fixture_checks = (
        fixture_checks_for_equifax_new(result_payload, fixture)
        if fixture and profile_id == "equifax_new_v1"
        else []
    )
    quality_issues = compute_quality_issues(components, component_status, profile_id)
    for check in fixture_checks:
        if check["pass"]:
            continue
        add_quality_issue(
            quality_issues,
            check.get("component") or "regression",
            f"fixture.{check['name']}",
            "fixture_check_failed",
            f"Expected {check['expected']}, got {check['actual']}.",
            severity="critical",
        )

    required_components = (
        ["reportConfirmationDetails", "summary", "personalInformation", "accounts", "inquiries"]
        if profile_id == "equifax_new_v1"
        else [
            "reportConfirmationDetails",
            "personalInformation",
            "summary",
            "creditAccountsSummary",
            "otherItemsSummary",
            "accounts",
            "collections",
            "inquiries",
        ]
    )
    required_failed = [name for name in required_components if component_status.get(name) == "failed"]

    total_fields = matched + unmatched
    overall_rate = round(matched / (total_fields or 1), 4)
    blocking_quality = [issue for issue in quality_issues if issue["severity"] in {"critical", "error"}]
    ready_for_attorney_verified = (not required_failed) and all(check["pass"] for check in cross_checks) and all(
        check["pass"] for check in fixture_checks
    ) and (
        len(blocking_quality) == 0
    )

    return {
        "summary": {
            "totalFieldsChecked": total_fields,
            "matchedFields": matched,
            "unmatchedFields": unmatched,
            "overallMatchRate": overall_rate,
            "requiredFailedComponents": required_failed,
            "readyForAttorneyVerified": ready_for_attorney_verified,
            "pdfPageCount": len(pages),
            "qualityIssueCount": len(quality_issues),
            "blockingQualityIssueCount": len(blocking_quality),
            "fixtureCheckCount": len(fixture_checks),
            "failedFixtureCheckCount": len([check for check in fixture_checks if not check["pass"]]),
        },
        "componentBreakdown": by_component,
        "crossChecks": cross_checks,
        "fixtureChecks": fixture_checks,
        "qualityIssues": quality_issues,
        "unmatchedFieldChecks": [check for check in checks if not check["found"]],
        "sampleMatchedFieldChecks": [check for check in checks if check["found"]][:100],
        "componentStatus": component_status,
        "validationIssues": validation_issues,
    }


def write_markdown_report(report: Dict[str, Any], out_path: Path) -> None:
    lines: List[str] = []
    summary = report["summary"]
    lines.append("# Extraction Verification Report")
    lines.append("")
    lines.append(f"- Total fields checked: {summary['totalFieldsChecked']}")
    lines.append(f"- Matched fields: {summary['matchedFields']}")
    lines.append(f"- Unmatched fields: {summary['unmatchedFields']}")
    lines.append(f"- Overall match rate: {summary['overallMatchRate']:.2%}")
    lines.append(f"- Required failed components: {', '.join(summary['requiredFailedComponents']) or 'none'}")
    lines.append(f"- Ready for attorney (verified): {summary['readyForAttorneyVerified']}")
    lines.append(f"- Quality issues: {summary['qualityIssueCount']} (blocking: {summary['blockingQualityIssueCount']})")
    lines.append(f"- Fixture checks: {summary.get('fixtureCheckCount', 0)} (failed: {summary.get('failedFixtureCheckCount', 0)})")
    lines.append("")

    lines.append("## Component Breakdown")
    for component, stats in sorted(report["componentBreakdown"].items()):
        lines.append(
            f"- {component}: {stats['matched']}/{stats['total']} matched "
            f"({stats['matchRate']:.2%}), status={stats.get('componentStatus')}"
        )
    lines.append("")

    lines.append("## Cross Checks")
    for check in report["crossChecks"]:
        lines.append(
            f"- {check['name']}: expected={check['expected']} actual={check['actual']} pass={check['pass']}"
        )
    lines.append("")

    lines.append("## Fixture Checks")
    fixture_checks = report.get("fixtureChecks") or []
    if not fixture_checks:
        lines.append("- none")
    else:
        for check in fixture_checks:
            lines.append(
                f"- {check['name']}: expected={check['expected']} actual={check['actual']} pass={check['pass']}"
            )
    lines.append("")

    lines.append("## Quality Issues")
    quality = report.get("qualityIssues") or []
    if not quality:
        lines.append("- none")
    else:
        for issue in quality[:200]:
            lines.append(
                f"- [{issue['severity']}] {issue['component']} {issue['path']} {issue['rule']}: {issue['message']}"
            )
    lines.append("")

    lines.append("## Unmatched Fields")
    unmatched = report["unmatchedFieldChecks"]
    if not unmatched:
        lines.append("- none")
    else:
        for item in unmatched[:200]:
            lines.append(f"- {item['path']}: `{item['value']}`")
    lines.append("")

    out_path.write_text("\n".join(lines), encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Verify extraction output against source PDF text")
    parser.add_argument("--pdf", required=True, help="Path to source PDF")
    parser.add_argument("--result-json", required=True, help="Path to extraction result JSON")
    parser.add_argument("--out-json", required=False, help="Path to write verification JSON")
    parser.add_argument("--out-md", required=False, help="Path to write verification markdown")
    parser.add_argument("--fixture", required=False, help="Optional regression fixture JSON")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    pdf_path = Path(args.pdf)
    result_path = Path(args.result_json)

    if not pdf_path.exists():
        raise SystemExit(f"PDF not found: {pdf_path}")
    if not result_path.exists():
        raise SystemExit(f"Result JSON not found: {result_path}")

    result_payload = load_result_payload(result_path)
    components = result_payload.get("components") or {}
    component_status = result_payload.get("componentStatus") or {}
    validation_issues = result_payload.get("validationIssues") or []
    pages = extract_pdf_pages(pdf_path)
    fixture = load_fixture(Path(args.fixture)) if args.fixture else None

    verification = build_verification_report(
        result_payload=result_payload,
        components=components,
        pages=pages,
        component_status=component_status,
        validation_issues=validation_issues,
        fixture=fixture,
    )

    output_json = Path(args.out_json) if args.out_json else Path("tmp/verification_report.json")
    output_json.parent.mkdir(parents=True, exist_ok=True)
    output_json.write_text(json.dumps(verification, indent=2), encoding="utf-8")

    if args.out_md:
        out_md = Path(args.out_md)
        out_md.parent.mkdir(parents=True, exist_ok=True)
        write_markdown_report(verification, out_md)

    print(str(output_json))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
