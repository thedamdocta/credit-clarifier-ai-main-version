#!/usr/bin/env python3
import argparse
import asyncio
import atexit
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, List, Optional, Set, Tuple
from xml.etree import ElementTree as ET

import requests
try:
    from PIL import Image, ImageOps
except ImportError:
    Image = None
    ImageOps = None


STATUS_CODES = {
    "30": "30 days late",
    "60": "60 days late",
    "90": "90 days late",
    "120": "120 days late",
    "150": "150 days past due",
    "180": "180 days past due",
    "OK": "Payment made on time",
    "COL": "In collections",
    "C": "Collection account",
    "CO": "Charge-off",
    "R": "Repossession",
    "F": "Foreclosure",
    "V": "Voluntary surrender",
    "B": "Included in bankruptcy",
    "TNT": "Too new to rate",
    "X": "No data available",
}

REQUIRED_ACCOUNT_TYPES = ["Revolving", "Mortgage", "Installment", "Other", "Total"]
COMPONENT_NAMES = [
    "reportConfirmationDetails",
    "personalInformation",
    "summary",
    "creditAccountsSummary",
    "otherItemsSummary",
    "publicRecords",
    "accounts",
    "collections",
    "inquiries",
]
EQUIFAX_PROFILE_ID = "equifax_old_v1"
EQUIFAX_NEW_PROFILE_ID = "equifax_new_v1"
EXPERIAN_PROFILE_ID = "experian_acr_v1"
TRANSUNION_PROFILE_ID = "transunion_acr_v1"
SUPPORTED_PROFILES = {EQUIFAX_PROFILE_ID, EQUIFAX_NEW_PROFILE_ID, EXPERIAN_PROFILE_ID, TRANSUNION_PROFILE_ID}

EXPERIAN_COMPONENT_NAMES = [
    "reportOverview",
    "personalInformation",
    "accounts",
    "publicRecords",
    "hardInquiries",
    "softInquiries",
]

TRANSUNION_COMPONENT_NAMES = [
    "reportOverview",
    "personalInformation",
    "accounts",
]

COMPONENT_KEYWORDS = {
    "reportConfirmationDetails": ["confirmation number", "consumer name", "report date"],
    "personalInformation": ["personal information", "name", "social security", "date of birth", "address"],
    "summary": ["credit file status", "summary", "average account age", "length of credit history"],
    "creditAccountsSummary": ["credit accounts", "account type", "revolving", "mortgage", "installment", "debt-to-credit"],
    "otherItemsSummary": ["other items", "inquiries", "public records", "collections", "consumer statements"],
    "accounts": ["account number", "payment history", "date opened", "creditor classification", "account details"],
    "collections": ["collection", "collection agency", "original creditor", "date assigned"],
    "inquiries": ["hard inquiries", "soft inquiries", "inquiry date", "subscriber"],
}

EXPERIAN_COMPONENT_KEYWORDS = {
    "reportOverview": ["prepared for", "date generated", "report number", "at a glance"],
    "personalInformation": ["personal information", "names", "addresses", "year of birth", "phone numbers", "employers"],
    "accounts": ["accounts", "account info", "payment history", "balance histories", "contact info"],
    "publicRecords": ["public records", "no public records reported"],
    "hardInquiries": ["hard inquiries", "inquired on"],
    "softInquiries": ["soft inquiries", "inquired on"],
}

ACCOUNT_SECTION_STOP_PATTERN = re.compile(
    r"^\d+\.\s+(?:consumer statements|personal information|inquiries|public records|collections|dispute|a summary of your rights)\b",
    re.IGNORECASE,
)
SUMMARY_SECTION_PATTERN = re.compile(r"^1\.\s+summary\b", re.IGNORECASE)
PERSONAL_INFORMATION_SECTION_PATTERN = re.compile(r"^7\.\s+personal information\b", re.IGNORECASE)
INQUIRIES_SECTION_PATTERN = re.compile(r"^8\.\s+inquiries\b", re.IGNORECASE)
PUBLIC_RECORDS_SECTION_PATTERN = re.compile(r"^9\.\s+public records\b", re.IGNORECASE)
COLLECTIONS_SECTION_PATTERN = re.compile(r"^10\.\s+collections\b", re.IGNORECASE)
DISPUTE_SECTION_PATTERN = re.compile(r"^11\.\s+dispute file information\b", re.IGNORECASE)
NUMBERED_SECTION_ROW_PATTERN = re.compile(r"^(?:\d+\.\s+|\d+\.\d+\s+)", re.IGNORECASE)
REPORT_CONFIRMATION_ROW_PATTERN = re.compile(r"^report confirmation\b", re.IGNORECASE)
CREDIT_ACCOUNTS_SECTION_ROW_PATTERN = re.compile(r"^credit accounts\b", re.IGNORECASE)
CREDIT_ACCOUNTS_TABLE_HEADER_PATTERN = re.compile(
    r"^account type\b.*(?:debt-to-credit|payment)\b",
    re.IGNORECASE,
)
OTHER_ITEMS_SECTION_ROW_PATTERN = re.compile(r"^other items\b", re.IGNORECASE)
OTHER_ITEMS_TABLE_ROW_PATTERN = re.compile(
    r"^(consumer statements|personal information|inquiries|most recent inquiry|public records|collections)\b",
    re.IGNORECASE,
)


@dataclass
class PageArtifact:
    page_number: int
    text_layer: str
    ocr_text: str
    fused_text: str
    image_path: str
    text_quality: float
    table_quality: float
    page_width: float = 0.0
    page_height: float = 0.0
    layout_blocks: List[Dict[str, Any]] = field(default_factory=list)
    layout_rows: List[Dict[str, Any]] = field(default_factory=list)
    layout_items: List[Dict[str, Any]] = field(default_factory=list)
    layout_tables: List[Dict[str, Any]] = field(default_factory=list)
    parse_concerns: List[Dict[str, Any]] = field(default_factory=list)


class WorkerError(Exception):
    pass


PROGRESS_PREFIX = "__PROGRESS__"


def emit_progress(
    progress_callback: Optional[Callable[[Dict[str, Any]], None]],
    progress: float,
    stage: str,
    **extra: Any,
) -> None:
    if progress_callback is None:
        return

    payload: Dict[str, Any] = {
        "progress": max(0.0, min(100.0, round(progress, 2))),
        "stage": stage,
    }
    payload.update(extra)
    progress_callback(payload)


def stdout_progress_callback(payload: Dict[str, Any]) -> None:
    print(f"{PROGRESS_PREFIX}{json.dumps(payload)}", flush=True)


def run_with_progress_heartbeat(
    work: Callable[[], Any],
    progress_callback: Optional[Callable[[Dict[str, Any]], None]],
    start_progress: float,
    end_progress: float,
    stage: str,
    interval_seconds: float = 2.0,
    increment: float = 0.4,
    **extra: Any,
) -> Any:
    result: Dict[str, Any] = {}
    error: Dict[str, BaseException] = {}
    completed = threading.Event()

    def runner() -> None:
        try:
            result["value"] = work()
        except BaseException as exc:  # pragma: no cover - preserves worker failures
            error["value"] = exc
        finally:
            completed.set()

    thread = threading.Thread(target=runner, daemon=True)
    thread.start()

    current_progress = start_progress
    emit_progress(progress_callback, current_progress, stage, **extra)
    max_progress = max(start_progress, end_progress)

    while not completed.wait(interval_seconds):
        current_progress = min(max_progress, round(current_progress + increment, 2))
        emit_progress(progress_callback, current_progress, stage, **extra)

    if "value" in error:
        raise error["value"]
    return result.get("value")


class OllamaClient:
    def __init__(self, base_url: str, model: str, timeout_seconds: int = 90):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout_seconds = timeout_seconds

    def chat(self, messages: List[Dict[str, str]], temperature: float = 0.0) -> str:
        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": temperature,
            },
        }
        response = requests.post(
            f"{self.base_url}/api/chat",
            json=payload,
            timeout=self.timeout_seconds,
        )
        response.raise_for_status()
        body = response.json()
        return (body.get("message") or {}).get("content", "")


def run_command(command: List[str], cwd: Optional[str] = None, timeout: int = 180) -> str:
    try:
        completed = subprocess.run(
            command,
            cwd=cwd,
            check=True,
            text=True,
            capture_output=True,
            timeout=timeout,
        )
        return completed.stdout
    except subprocess.CalledProcessError as exc:
        raise WorkerError(
            f"Command failed ({' '.join(command)}): {exc.stderr.strip() or exc.stdout.strip()}"
        ) from exc


def normalize_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "")).strip()


def normalize_preserve_lines(value: str) -> str:
    if not value:
        return ""
    lines = []
    for raw_line in value.splitlines():
        line = normalize_spaces(raw_line)
        if line:
            lines.append(line)
    return "\n".join(lines)


def parse_json_safely(raw: str) -> Optional[Dict[str, Any]]:
    if not raw:
        return None

    fence_match = re.search(r"```json\s*(\{[\s\S]*\})\s*```", raw, re.IGNORECASE)
    payload = fence_match.group(1) if fence_match else raw

    start = payload.find("{")
    end = payload.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None

    candidate = payload[start : end + 1]
    try:
        return json.loads(candidate)
    except Exception:
        return None


def parse_float(value: str) -> float:
    try:
        return float(value)
    except Exception:
        return 0.0


MONTH_COLUMNS = ["year", "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
ACCOUNT_TABLE_TITLES = {
    "balance": "balanceHistory",
    "scheduled payment": "scheduledPaymentHistory",
    "actual payment": "actualPaymentHistory",
    "credit limit": "creditLimitHistory",
    "amount past due": "amountPastDueHistory",
    "activity designator": "activityDesignatorHistory",
}
ACCOUNT_SECTION_FIELDS = {
    **ACCOUNT_TABLE_TITLES,
    "payment history": "paymentHistory",
}
ACCOUNT_COMMENTS_CONTACT_TITLES = {"comments contact", "comments | contact"}
EXPLICIT_NOT_REPORTED_MARKERS = {
    "not reported",
    "not provided",
    "none reported",
    "not available",
    "not applicable",
    "n/a",
    "na",
}
PROTECTED_CELL_STATES = {"blank", "explicit_not_reported"}
ACCOUNT_PAIR_FIELD_MAP = {
    "account number": "accountNumber",
    "reported balance": "balance",
    "balance": "currentBalance",
    "account status": "accountStatus",
    "high credit": "highCredit",
    "highest balance": "highestBalance",
    "payment responsibility": "paymentResponsibility",
    "credit limit": "creditLimit",
    "account type": "accountType",
    "terms frequency": "termsFrequency",
    "term duration": "termDuration",
    "date opened": "dateOpened",
    "date reported": "dateReported",
    "date closed": "dateClosed",
    "last payment date": "lastPaymentDate",
    "date of last payment": "lastPaymentDate",
    "date of last activity": "dateOfLastActivity",
    "date of first delinquency": "dateOfFirstDelinquency",
    "delinquency first reported": "delinquencyFirstReported",
    "deferred payment start date": "deferredPaymentStartDate",
    "balloon payment date": "balloonPaymentDate",
    "balloon payment amount": "balloonPaymentAmount",
    "amount past due": "amountPastDue",
    "charge off amount": "chargeOffAmount",
    "credit type": "creditType",
    "loan type": "loanType",
    "responsibility": "responsibility",
    "months reviewed": "monthsReviewed",
    "activity designator": "activityDesignator",
    "creditor classification": "creditorClassification",
    "actual payment amount": "actualPaymentAmount",
    "scheduled payment amount": "scheduledPaymentAmount",
    "comments": "comments",
    "contact": "contact",
}
COLLECTION_FIELD_MAP = {
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
KNOWN_PAIR_LABELS = set(ACCOUNT_PAIR_FIELD_MAP.keys()) | set(COLLECTION_FIELD_MAP.keys())
ACCOUNT_CURRENCY_FIELDS = {
    "balance",
    "creditLimit",
    "highestBalance",
    "highCredit",
    "currentBalance",
    "paymentAmount",
    "actualPaymentAmount",
    "scheduledPaymentAmount",
    "amountPastDue",
    "chargeOffAmount",
    "balloonPaymentAmount",
}


def normalize_account_scalar_value(field_name: str, value: Any) -> str:
    cleaned = normalize_spaces(str(value))
    if not cleaned:
        return "Not reported"
    if field_name in ACCOUNT_CURRENCY_FIELDS:
        if cleaned.lower().rstrip(":") in EXPLICIT_NOT_REPORTED_MARKERS:
            return "Not reported"
        return parse_currency(cleaned) or "Not reported"
    return cleaned


def strip_xml_tag(tag: str) -> str:
    return tag.split("}", 1)[-1]


def parse_bbox(value: Any) -> float:
    try:
        return float(value)
    except Exception:
        return 0.0


def bbox_from_coords(x_min: float, y_min: float, x_max: float, y_max: float) -> Dict[str, float]:
    return {
        "xMin": round(x_min, 3),
        "yMin": round(y_min, 3),
        "xMax": round(x_max, 3),
        "yMax": round(y_max, 3),
        "width": round(max(x_max - x_min, 0.0), 3),
        "height": round(max(y_max - y_min, 0.0), 3),
    }


def merge_bboxes(boxes: Iterable[Dict[str, float]]) -> Dict[str, float]:
    usable = [box for box in boxes if box]
    if not usable:
        return bbox_from_coords(0.0, 0.0, 0.0, 0.0)
    return bbox_from_coords(
        min(box["xMin"] for box in usable),
        min(box["yMin"] for box in usable),
        max(box["xMax"] for box in usable),
        max(box["yMax"] for box in usable),
    )


def build_row_text_from_blocks(blocks: List[Dict[str, Any]]) -> str:
    ordered = sorted(blocks, key=lambda block: (block["bbox"]["xMin"], block["bbox"]["yMin"]))
    parts: List[str] = []
    last_x_max = None
    for block in ordered:
        text = normalize_spaces(block.get("text", ""))
        if not text:
            continue
        if parts and last_x_max is not None:
            gap = block["bbox"]["xMin"] - last_x_max
            parts.append(" | " if gap >= 24 else " ")
        parts.append(text)
        last_x_max = block["bbox"]["xMax"]
    return "".join(parts).strip()


def group_blocks_into_rows(blocks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for block in sorted(blocks, key=lambda item: (item["bbox"]["yMin"], item["bbox"]["xMin"])):
        center_y = (block["bbox"]["yMin"] + block["bbox"]["yMax"]) / 2.0
        height = max(block["bbox"]["height"], 1.0)
        matched_row: Optional[Dict[str, Any]] = None

        for row in reversed(rows[-6:]):
            tolerance = max(4.5, min(height, row["bbox"]["height"]) * 0.85)
            if abs(center_y - row["centerY"]) <= tolerance:
                matched_row = row
                break

        if matched_row is None:
            matched_row = {
                "blocks": [],
                "centerY": center_y,
                "bbox": block["bbox"].copy(),
            }
            rows.append(matched_row)
        else:
            matched_row["bbox"] = merge_bboxes([matched_row["bbox"], block["bbox"]])
            block_count = len(matched_row["blocks"])
            matched_row["centerY"] = ((matched_row["centerY"] * block_count) + center_y) / (block_count + 1)

        matched_row["blocks"].append(block)

    normalized_rows: List[Dict[str, Any]] = []
    for row_index, row in enumerate(sorted(rows, key=lambda item: (item["bbox"]["yMin"], item["bbox"]["xMin"]))):
        sorted_blocks = sorted(row["blocks"], key=lambda item: (item["bbox"]["xMin"], item["bbox"]["yMin"]))
        row_text = build_row_text_from_blocks(sorted_blocks)
        big_gap_count = 0
        last_x_max = None
        for block in sorted_blocks:
            if last_x_max is not None and block["bbox"]["xMin"] - last_x_max >= 24:
                big_gap_count += 1
            last_x_max = block["bbox"]["xMax"]
        normalized_rows.append(
            {
                "rowIndex": row_index,
                "bbox": row["bbox"],
                "centerY": row["centerY"],
                "blocks": sorted_blocks,
                "text": row_text,
                "blockCount": len(sorted_blocks),
                "bigGapCount": big_gap_count,
                "numericCount": sum(
                    1 for block in sorted_blocks if re.search(r"[\d$%]", str(block.get("text", "")))
                ),
            }
        )
    return normalized_rows


def is_footer_row(row: Dict[str, Any], page_height: float) -> bool:
    text = row.get("text", "")
    lowered = text.lower()
    if "page " in lowered and " of " in lowered:
        return True
    return bool(row["bbox"]["yMax"] >= page_height - 28.0)


def is_header_row(row: Dict[str, Any]) -> bool:
    text = row.get("text", "")
    if not text:
        return False
    if row["bbox"]["yMin"] > 40.0:
        return False
    if re.fullmatch(r"[A-Z][A-Z0-9/&,. \-]{2,60}", text):
        return True
    return len(text) <= 60


def is_heading_row(row: Dict[str, Any]) -> bool:
    text = normalize_spaces(row.get("text", ""))
    if not text or is_header_row(row):
        return False
    if re.match(r"^(?:\d{1,2}\.\s+.+|\d{1,2}(?:\.\d{1,2}){1,2}\s+.+)$", text):
        return True
    if text.lower() in {
        "summary",
        "credit accounts",
        "other items",
        "account history",
        "account details",
        "hard inquiries",
        "soft inquiries",
        "identification",
        "contact information",
        "employment history",
        "comments",
        "contact",
    }:
        return True
    if row["blockCount"] == 1 and len(text) <= 48 and re.fullmatch(r"[A-Z][A-Za-z/&'.,\- ]{2,48}", text):
        return True
    return False


def is_numbered_section_row_text(text: str) -> bool:
    return bool(NUMBERED_SECTION_ROW_PATTERN.match(normalize_spaces(text)))


def is_summary_account_stub_row(row: Dict[str, Any]) -> bool:
    text = normalize_spaces(row.get("text", ""))
    return row.get("blockCount") == 1 and text.title() in REQUIRED_ACCOUNT_TYPES


def is_table_caption_row(row: Dict[str, Any], next_row: Optional[Dict[str, Any]]) -> bool:
    text = normalize_spaces(row.get("text", ""))
    if not text or row["blockCount"] != 1 or is_heading_row(row) or is_footer_row(row, 10_000.0):
        return False
    if len(text) > 48:
        return False
    if re.search(r"\d", text):
        return False
    if len(re.findall(r"[A-Za-z]", text)) < 3:
        return False
    if not next_row:
        return False
    return is_table_like_row(next_row)


def looks_like_month_header(cells: List[str]) -> bool:
    lowered = [normalize_spaces(cell).lower() for cell in cells if normalize_spaces(cell)]
    if len(lowered) < 5:
        return False
    if lowered[0] != "year":
        return False
    month_hits = sum(1 for token in lowered[1:] if token in MONTH_COLUMNS[1:])
    return month_hits >= 4


def row_label_score(cells: List[str]) -> int:
    joined = " ".join(normalize_spaces(cell).lower() for cell in cells if normalize_spaces(cell))
    hints = [
        "account type",
        "report date",
        "credit file status",
        "collection agency",
        "original creditor",
        "balance date",
        "date assigned",
        "date reported",
        "account number",
        "status date",
        "request originator",
        "description",
        "high credit",
        "payment responsibility",
        "credit limit",
        "terms frequency",
        "term duration",
        "comments",
        "contact",
        "date",
        "company",
    ]
    return sum(1 for hint in hints if hint in joined)


def is_table_like_row(row: Dict[str, Any]) -> bool:
    cells = [normalize_spaces(block.get("text", "")) for block in row.get("blocks", []) if normalize_spaces(block.get("text", ""))]
    if len(cells) < 2:
        return False
    if looks_like_month_header(cells):
        return True
    if row["blockCount"] >= 4:
        return True
    if row_label_score(cells) > 0:
        return True
    if row["bigGapCount"] >= 1 and row["numericCount"] >= 1:
        return True
    if row["bigGapCount"] >= 2:
        return True
    return False


def cluster_column_positions(rows: List[Dict[str, Any]]) -> List[float]:
    positions: List[float] = []
    for row in rows:
        for block in row.get("blocks", []):
            positions.append(block["bbox"]["xMin"])
    if not positions:
        return []
    clusters: List[List[float]] = []
    for position in sorted(positions):
        if not clusters or abs(position - clusters[-1][-1]) > 18.0:
            clusters.append([position])
        else:
            clusters[-1].append(position)
    return [sum(cluster) / len(cluster) for cluster in clusters]


def build_table_from_rows(
    page_number: int,
    table_index: int,
    rows: List[Dict[str, Any]],
    title: Optional[str],
    heading_trail: List[str],
) -> Dict[str, Any]:
    columns = cluster_column_positions(rows)
    table_rows: List[List[str]] = []
    row_items: List[Dict[str, Any]] = []
    parse_concerns: List[Dict[str, Any]] = []

    for row in rows:
        cells = [""] * len(columns)
        for block in row.get("blocks", []):
            if not columns:
                continue
            position = block["bbox"]["xMin"]
            column_index = min(range(len(columns)), key=lambda idx: abs(columns[idx] - position))
            text = normalize_spaces(block.get("text", ""))
            if not text:
                continue
            if cells[column_index]:
                cells[column_index] = normalize_spaces(f"{cells[column_index]} {text}")
            else:
                cells[column_index] = text

        non_empty = sum(1 for cell in cells if cell)
        if non_empty == 0:
            continue
        if (
            non_empty == 1
            and len(columns) > 3
            and normalize_spaces(cells[0] if cells else "").title() not in REQUIRED_ACCOUNT_TYPES
        ):
            parse_concerns.append(
                {
                    "type": "sparse_row",
                    "details": f"Row {row['rowIndex']} only populated 1 of {len(columns)} columns.",
                }
            )
        row_items.append(
            {
                "rowIndex": row["rowIndex"],
                "bbox": row["bbox"],
                "cells": [
                    {
                        "columnIndex": idx,
                        "text": value,
                        "state": (
                            "explicit_not_reported"
                            if normalize_spaces(str(value)).lower() in EXPLICIT_NOT_REPORTED_MARKERS
                            else "blank"
                            if not normalize_spaces(str(value))
                            else "value"
                        ),
                    }
                    for idx, value in enumerate(cells)
                ],
            }
        )
        table_rows.append(cells)

    header_row = table_rows[0] if table_rows else []
    inferred_title = title or ""
    if not inferred_title and looks_like_month_header(header_row):
        inferred_title = "History Grid"
    elif not inferred_title and header_row:
        inferred_title = normalize_spaces(" ".join(cell for cell in header_row[:2] if cell))

    table_kind = "grid" if looks_like_month_header(header_row) else "keyValue" if len(columns) in {2, 4} else "table"
    if len(table_rows) <= 1 and table_kind != "keyValue":
        parse_concerns.append(
            {
                "type": "short_table",
                "details": "Detected table has one or fewer populated rows.",
            }
        )

    if len(columns) <= 1:
        parse_concerns.append(
            {
                "type": "insufficient_columns",
                "details": "Detected table has one or fewer geometry columns.",
            }
        )
    return {
        "tableId": f"page-{page_number}-table-{table_index}",
        "pageNumber": page_number,
        "title": inferred_title or None,
        "kind": table_kind,
        "headingTrail": heading_trail[-4:],
        "columns": [round(value, 3) for value in columns],
        "rows": table_rows,
        "rowItems": row_items,
        "bbox": merge_bboxes([row["bbox"] for row in rows]),
        "parseConcerns": parse_concerns,
        "startRowIndex": rows[0]["rowIndex"] if rows else 0,
        "endRowIndex": rows[-1]["rowIndex"] if rows else 0,
    }


def build_layout_items_and_tables(
    page_number: int,
    page_width: float,
    page_height: float,
    rows: List[Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    tables: List[Dict[str, Any]] = []
    items: List[Dict[str, Any]] = []
    concerns: List[Dict[str, Any]] = []
    consumed_rows = set()
    table_titles: Dict[int, Optional[str]] = {}

    for idx, row in enumerate(rows):
        next_row = rows[idx + 1] if idx + 1 < len(rows) else None
        if is_table_caption_row(row, next_row):
            table_titles[idx + 1] = row["text"]

    heading_trail: List[str] = []
    idx = 0
    while idx < len(rows):
        row = rows[idx]
        if idx in consumed_rows or idx in table_titles:
            idx += 1
            continue

        if is_footer_row(row, page_height):
            items.append(
                {
                    "type": "footer",
                    "text": row["text"],
                    "bbox": row["bbox"],
                    "pageNumber": page_number,
                    "rowIndex": row["rowIndex"],
                    "headingTrail": list(heading_trail),
                }
            )
            idx += 1
            continue

        if is_header_row(row):
            items.append(
                {
                    "type": "header",
                    "text": row["text"],
                    "bbox": row["bbox"],
                    "pageNumber": page_number,
                    "rowIndex": row["rowIndex"],
                    "headingTrail": list(heading_trail),
                }
            )
            idx += 1
            continue

        if is_table_like_row(row):
            table_rows = [row]
            consumed_rows.add(idx)
            header_joined = " ".join(normalize_table_cell(cell).lower() for cell in (row.get("text") or "").split("|"))
            next_index = idx + 1
            while next_index < len(rows):
                next_row = rows[next_index]
                if next_index in table_titles:
                    break
                if is_footer_row(next_row, page_height):
                    break
                if is_heading_row(next_row) and not ("account type" in header_joined and is_summary_account_stub_row(next_row)):
                    break
                if not is_table_like_row(next_row) and not ("account type" in header_joined and is_summary_account_stub_row(next_row)):
                    break
                table_rows.append(next_row)
                consumed_rows.add(next_index)
                next_index += 1

            table = build_table_from_rows(
                page_number=page_number,
                table_index=len(tables) + 1,
                rows=table_rows,
                title=table_titles.get(idx),
                heading_trail=heading_trail,
            )
            tables.append(table)
            items.append(
                {
                    "type": "table",
                    "text": table.get("title") or "",
                    "tableId": table["tableId"],
                    "bbox": table["bbox"],
                    "pageNumber": page_number,
                    "rowIndex": row["rowIndex"],
                    "headingTrail": list(table.get("headingTrail") or []),
                }
            )
            for concern in table.get("parseConcerns") or []:
                concerns.append(
                    {
                        "pageNumber": page_number,
                        "tableId": table["tableId"],
                        **concern,
                    }
                )
            idx = next_index
            continue

        item_type = "text"
        if is_heading_row(row):
            item_type = "heading"
            heading_trail.append(row["text"])
            heading_trail = heading_trail[-6:]

        items.append(
            {
                "type": item_type,
                "text": row["text"],
                "bbox": row["bbox"],
                "pageNumber": page_number,
                "rowIndex": row["rowIndex"],
                "headingTrail": list(heading_trail),
            }
        )
        idx += 1

    return items, tables, concerns


def load_bbox_layout_pages(xml_path: Path) -> List[Dict[str, Any]]:
    tree = ET.parse(xml_path)
    root = tree.getroot()
    pages: List[Dict[str, Any]] = []

    for page_index, page in enumerate([elem for elem in root.iter() if strip_xml_tag(elem.tag) == "page"], start=1):
        page_width = parse_bbox(page.attrib.get("width"))
        page_height = parse_bbox(page.attrib.get("height"))
        blocks: List[Dict[str, Any]] = []

        for block in [elem for elem in page.iter() if strip_xml_tag(elem.tag) == "block"]:
            line_texts: List[str] = []
            word_boxes: List[Dict[str, Any]] = []
            for line in [elem for elem in block.iter() if strip_xml_tag(elem.tag) == "line"]:
                words: List[str] = []
                for word in [elem for elem in line.iter() if strip_xml_tag(elem.tag) == "word"]:
                    raw = (word.text or "").strip()
                    if not raw:
                        continue
                    words.append(raw)
                    word_boxes.append(
                        {
                            "text": raw,
                            "bbox": bbox_from_coords(
                                parse_bbox(word.attrib.get("xMin")),
                                parse_bbox(word.attrib.get("yMin")),
                                parse_bbox(word.attrib.get("xMax")),
                                parse_bbox(word.attrib.get("yMax")),
                            ),
                        }
                    )
                if words:
                    line_texts.append(" ".join(words))

            if not line_texts:
                continue

            block_bbox = bbox_from_coords(
                parse_bbox(block.attrib.get("xMin")),
                parse_bbox(block.attrib.get("yMin")),
                parse_bbox(block.attrib.get("xMax")),
                parse_bbox(block.attrib.get("yMax")),
            )
            blocks.append(
                {
                    "text": "\n".join(line_texts),
                    "lines": line_texts,
                    "bbox": block_bbox,
                    "words": word_boxes,
                }
            )

        rows = group_blocks_into_rows(blocks)
        items, tables, concerns = build_layout_items_and_tables(page_index, page_width, page_height, rows)
        pages.append(
            {
                "pageNumber": page_index,
                "width": page_width,
                "height": page_height,
                "blocks": blocks,
                "rows": rows,
                "items": items,
                "tables": tables,
                "parseConcerns": concerns,
            }
        )

    return pages


def load_bbox_pages(xml_path: Path) -> List[Tuple[int, str]]:
    page_entries: List[Tuple[int, str]] = []
    for page in load_bbox_layout_pages(xml_path):
        row_text = [normalize_spaces(row.get("text", "")) for row in page.get("rows") or [] if normalize_spaces(row.get("text", ""))]
        page_entries.append((int(page["pageNumber"]), "\n".join(row_text)))
    page_entries.sort(key=lambda item: item[0])
    return page_entries


def split_text_pages(raw_text: str) -> List[str]:
    if not raw_text:
        return []
    parts = [part.strip() for part in raw_text.split("\f")]
    return parts


def get_pdf_page_count(input_pdf: Path) -> Optional[int]:
    try:
        output = run_command(["pdfinfo", str(input_pdf)])
    except WorkerError:
        return None

    match = re.search(r"^Pages:\s+(\d+)\s*$", output, re.MULTILINE)
    if not match:
        return None

    page_count = int(match.group(1))
    return page_count if page_count > 0 else None


def render_pdf_images(
    input_pdf: Path,
    output_dir: Path,
    total_pages: Optional[int] = None,
    progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
) -> List[Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    prefix = output_dir / "page"
    command = [
        "pdftoppm",
        "-png",
        "-r",
        "300",
        str(input_pdf),
        str(prefix),
    ]

    process = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    last_reported_count = -1
    while process.poll() is None:
        image_count = len(list(output_dir.glob("page-*.png")))
        if total_pages and image_count != last_reported_count:
            render_progress = 26.0 + (min(image_count, total_pages) / total_pages) * 28.0
            emit_progress(
                progress_callback,
                render_progress,
                f"Rendering page images ({min(image_count, total_pages)} of {total_pages})...",
                totalPages=total_pages,
                processedPages=min(image_count, total_pages),
            )
            last_reported_count = image_count
        time.sleep(0.25)

    stdout, stderr = process.communicate()
    if process.returncode != 0:
        raise WorkerError(
            f"Command failed ({' '.join(command)}): {(stderr or stdout or '').strip()}"
        )

    images = sorted(output_dir.glob("page-*.png"), key=lambda path: int(path.stem.split("-")[-1]))
    return images


def extract_pdf_text_files(input_pdf: Path, output_dir: Path) -> Tuple[Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    text_path = output_dir / "document.txt"
    bbox_path = output_dir / "document-bbox.xml"

    run_command(["pdftotext", "-layout", str(input_pdf), str(text_path)])
    run_command(["pdftotext", "-bbox-layout", str(input_pdf), str(bbox_path)])

    return text_path, bbox_path


def tesseract_ocr(image_path: Path, output_base: Path) -> str:
    run_command(
        [
            "tesseract",
            str(image_path),
            str(output_base),
            "--oem",
            "1",
            "--psm",
            "6",
        ],
        timeout=120,
    )
    txt_path = output_base.with_suffix(".txt")
    if not txt_path.exists():
        return ""
    return txt_path.read_text(encoding="utf-8", errors="ignore").strip()


def build_page_artifacts(
    input_pdf: Path,
    session_dir: Path,
    max_pages: int,
    progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
) -> Tuple[List[PageArtifact], str]:
    ingestion_dir = session_dir / "ingestion"
    text_dir = ingestion_dir / "text"
    image_dir = ingestion_dir / "images"
    ocr_dir = ingestion_dir / "ocr"
    ocr_dir.mkdir(parents=True, exist_ok=True)

    total_pages = get_pdf_page_count(input_pdf)
    if total_pages:
        emit_progress(
            progress_callback,
            23.0,
            f"Preparing {min(total_pages, max_pages)} PDF pages for analysis...",
            totalPages=min(total_pages, max_pages),
            processedPages=0,
        )

    text_path, bbox_path = extract_pdf_text_files(input_pdf, text_dir)
    images = render_pdf_images(
        input_pdf,
        image_dir,
        total_pages=min(total_pages, max_pages) if total_pages else None,
        progress_callback=progress_callback,
    )

    plain_text = text_path.read_text(encoding="utf-8", errors="ignore") if text_path.exists() else ""
    text_pages = split_text_pages(plain_text)
    layout_pages = load_bbox_layout_pages(bbox_path)
    bbox_pages = [
        (
            int(page["pageNumber"]),
            "\n".join(
                normalize_spaces(row.get("text", ""))
                for row in page.get("rows") or []
                if normalize_spaces(row.get("text", ""))
            ),
        )
        for page in layout_pages
    ]

    if not images:
        raise WorkerError("No PDF page images were generated.")

    page_count = min(len(images), max_pages)
    if page_count <= 0:
        raise WorkerError("No pages available after max page filtering.")

    emit_progress(progress_callback, 54.0, f"Analyzing {page_count} PDF pages...", totalPages=page_count, processedPages=0)

    artifacts: List[PageArtifact] = []

    for idx in range(page_count):
        page_number = idx + 1
        image_path = images[idx]
        layout_page = layout_pages[idx] if idx < len(layout_pages) else {}
        text_layer = ""

        if idx < len(text_pages) and text_pages[idx]:
            text_layer = text_pages[idx]
        elif idx < len(bbox_pages):
            text_layer = bbox_pages[idx][1]

        text_layer = normalize_preserve_lines(text_layer)
        text_quality = min(len(text_layer) / 1800.0, 1.0)

        ocr_text = ""
        if len(text_layer) < 120:
            ocr_out = ocr_dir / f"page-{page_number}"
            try:
                ocr_text = normalize_preserve_lines(tesseract_ocr(image_path, ocr_out))
            except Exception:
                ocr_text = ""

        fused_text = normalize_preserve_lines("\n".join([text_layer, ocr_text]))
        table_quality = min(
            (1.0 if re.search(r"account\s+type|revolving|installment|mortgage", fused_text, re.IGNORECASE) else 0.0)
            + (0.3 if re.search(r"\$\s*\d", fused_text) else 0.0),
            1.0,
        )

        artifacts.append(
            PageArtifact(
                page_number=page_number,
                text_layer=text_layer,
                ocr_text=ocr_text,
                fused_text=fused_text,
                image_path=str(image_path),
                text_quality=text_quality,
                table_quality=table_quality,
                page_width=parse_bbox(layout_page.get("width")),
                page_height=parse_bbox(layout_page.get("height")),
                layout_blocks=list(layout_page.get("blocks") or []),
                layout_rows=list(layout_page.get("rows") or []),
                layout_items=list(layout_page.get("items") or []),
                layout_tables=list(layout_page.get("tables") or []),
                parse_concerns=list(layout_page.get("parseConcerns") or []),
            )
        )

        page_progress = 54.0 + ((idx + 1) / page_count) * 16.0
        emit_progress(
            progress_callback,
            page_progress,
            f"Analyzing page {page_number} of {page_count}...",
            totalPages=page_count,
            processedPages=page_number,
        )

    (ingestion_dir / "layout-artifacts.json").write_text(
        json.dumps(
            [
                {
                    "pageNumber": page.page_number,
                    "pageWidth": page.page_width,
                    "pageHeight": page.page_height,
                    "rows": page.layout_rows,
                    "items": page.layout_items,
                    "tables": page.layout_tables,
                    "parseConcerns": page.parse_concerns,
                }
                for page in artifacts
            ],
            indent=2,
        ),
        encoding="utf-8",
    )

    emit_progress(
        progress_callback,
        70.0,
        "Building section index from analyzed pages...",
        totalPages=page_count,
        processedPages=page_count,
    )

    return artifacts, plain_text


def flatten_tree_nodes(tree: Any) -> List[Dict[str, Any]]:
    nodes: List[Dict[str, Any]] = []

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            nodes.append(node)
            children = node.get("nodes")
            if isinstance(children, list):
                for child in children:
                    walk(child)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(tree)
    return nodes


def build_heuristic_tree(page_artifacts: List[PageArtifact]) -> Dict[str, Any]:
    sections = []
    section_patterns = [
        ("Report Confirmation", ["confirmation number", "consumer name", "report date"]),
        ("Personal Information", ["personal information", "date of birth", "social security"]),
        ("Credit Summary", ["credit file status", "average account age", "length of credit history"]),
        ("Credit Accounts Summary", ["account type", "revolving", "mortgage", "installment", "debt-to-credit"]),
        ("Account Details", ["account number", "payment history", "date opened", "creditor classification"]),
        ("Collections", ["collection agency", "original creditor", "collection account"]),
        ("Inquiries", ["hard inquiries", "soft inquiries", "inquiry"]),
        ("Other Items", ["public records", "consumer statements", "other items"]),
    ]

    for title, keywords in section_patterns:
        matches = [
            page.page_number
            for page in page_artifacts
            if any(keyword in page.fused_text.lower() for keyword in keywords)
        ]
        if matches:
            sections.append(
                {
                    "title": title,
                    "node_id": f"heur-{len(sections):04d}",
                    "start_index": min(matches),
                    "end_index": max(matches),
                    "source": "heuristic",
                }
            )

    if not sections:
        sections.append(
            {
                "title": "Entire Report",
                "node_id": "heur-0000",
                "start_index": 1,
                "end_index": len(page_artifacts),
                "source": "heuristic",
            }
        )

    return {
        "doc_name": "equifax_report",
        "structure": sections,
        "source": "heuristic",
    }


def load_profile_config(profile_id: str, worker_root: Path) -> Dict[str, Any]:
    if profile_id not in SUPPORTED_PROFILES:
        raise WorkerError(
            f"Unsupported profile '{profile_id}'. This worker currently supports: {', '.join(sorted(SUPPORTED_PROFILES))}."
        )

    profile_path = worker_root / "profiles" / f"{profile_id}.json"
    if not profile_path.exists():
        defaults = {
            EQUIFAX_PROFILE_ID: {
                "id": EQUIFAX_PROFILE_ID,
                "sectionAnchors": COMPONENT_KEYWORDS,
                "retrieval": {"includeNeighbors": True},
                "requiredComponents": COMPONENT_NAMES,
            },
            EXPERIAN_PROFILE_ID: {
                "id": EXPERIAN_PROFILE_ID,
                "sectionAnchors": EXPERIAN_COMPONENT_KEYWORDS,
                "retrieval": {"includeNeighbors": True},
                "requiredComponents": EXPERIAN_COMPONENT_NAMES,
            },
        }
        return {
            **defaults.get(profile_id, {}),
        }

    try:
        payload = json.loads(profile_path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise WorkerError(f"Invalid profile config '{profile_path}': {exc}") from exc

    anchors = payload.get("sectionAnchors")
    if not isinstance(anchors, dict):
        payload["sectionAnchors"] = COMPONENT_KEYWORDS if profile_id == EQUIFAX_PROFILE_ID else EXPERIAN_COMPONENT_KEYWORDS

    retrieval = payload.get("retrieval")
    if not isinstance(retrieval, dict):
        payload["retrieval"] = {"includeNeighbors": True}

    required_components = payload.get("requiredComponents")
    if not isinstance(required_components, list):
        payload["requiredComponents"] = COMPONENT_NAMES if profile_id == EQUIFAX_PROFILE_ID else EXPERIAN_COMPONENT_NAMES

    return payload


def build_pageindex_tree(
    input_pdf: Path,
    page_artifacts: List[PageArtifact],
    ollama: OllamaClient,
    pageindex_root: Optional[Path],
) -> Dict[str, Any]:
    if not pageindex_root or not pageindex_root.exists():
        return build_heuristic_tree(page_artifacts)

    try:
        sys.path.insert(0, str(pageindex_root))
        import pageindex  # type: ignore
        import pageindex.utils as pageindex_utils  # type: ignore

        def chat_text(prompt: str) -> str:
            content = ollama.chat(
                [
                    {
                        "role": "system",
                        "content": "Return concise output that follows the user instruction exactly.",
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.0,
            )
            return content

        def sync_chat_api(model: str, prompt: str, api_key=None, chat_history=None):
            _ = (model, api_key, chat_history)
            return chat_text(prompt)

        def sync_chat_api_with_reason(model: str, prompt: str, api_key=None, chat_history=None):
            _ = (model, api_key, chat_history)
            return chat_text(prompt), "finished"

        async def async_chat_api(model: str, prompt: str, api_key=None):
            _ = (model, api_key)
            return await asyncio.to_thread(chat_text, prompt)

        pageindex_utils.ChatGPT_API = sync_chat_api
        pageindex_utils.ChatGPT_API_with_finish_reason = sync_chat_api_with_reason
        pageindex_utils.ChatGPT_API_async = async_chat_api

        tree = pageindex.page_index(
            str(input_pdf),
            model=ollama.model,
            toc_check_page_num=20,
            max_page_num_each_node=8,
            max_token_num_each_node=12000,
            if_add_node_id="yes",
            if_add_node_summary="no",
            if_add_doc_description="no",
            if_add_node_text="no",
        )

        if isinstance(tree, dict):
            tree["source"] = "pageindex"
            return tree
        return {
            "doc_name": "equifax_report",
            "structure": tree,
            "source": "pageindex",
        }
    except Exception as exc:
        fallback = build_heuristic_tree(page_artifacts)
        fallback["fallback_reason"] = str(exc)
        return fallback


def select_pages_for_component(
    component_name: str,
    page_artifacts: List[PageArtifact],
    page_tree: Dict[str, Any],
    component_keywords: Dict[str, List[str]],
    include_neighbors: bool = True,
) -> List[int]:
    if component_name == "personalInformation":
        personal_pages = find_section_page_range(
            page_artifacts,
            PERSONAL_INFORMATION_SECTION_PATTERN,
            [INQUIRIES_SECTION_PATTERN],
        )
        if personal_pages:
            return personal_pages

    keywords = component_keywords.get(component_name, [])
    lowered_keywords = [keyword.lower() for keyword in keywords]

    candidate_pages = set()
    nodes = flatten_tree_nodes(page_tree.get("structure"))

    for node in nodes:
        title = str(node.get("title", "")).lower()
        if any(keyword in title for keyword in lowered_keywords):
            start = int(node.get("start_index", 0) or 0)
            end = int(node.get("end_index", start) or start)
            if start <= 0:
                continue
            for page in range(start, end + 1):
                candidate_pages.add(page)

    if not candidate_pages:
        for page in page_artifacts:
            text = page.fused_text.lower()
            if any(keyword in text for keyword in lowered_keywords):
                candidate_pages.add(page.page_number)

    if not candidate_pages:
        candidate_pages = {page.page_number for page in page_artifacts}

    if include_neighbors:
        expanded = set(candidate_pages)
        max_page = len(page_artifacts)
        for page in list(candidate_pages):
            if page > 1:
                expanded.add(page - 1)
            if page < max_page:
                expanded.add(page + 1)
        candidate_pages = expanded

    selected_pages = sorted(page for page in candidate_pages if 1 <= page <= len(page_artifacts))
    return extend_component_page_window(component_name, page_artifacts, selected_pages)


def visible_row_texts(page: PageArtifact) -> List[str]:
    texts: List[str] = []
    for row in page.layout_rows:
        text = normalize_spaces(str(row.get("text") or ""))
        if not text:
            continue
        if is_footer_row(row, page.page_height):
            continue
        texts.append(text)
    return texts


def page_has_row_pattern(page: PageArtifact, pattern: re.Pattern[str]) -> bool:
    return any(pattern.search(text) for text in visible_row_texts(page))


def page_contains_value(page: PageArtifact, value: Optional[Any]) -> bool:
    normalized_value = normalize_spaces(str(value or ""))
    if not normalized_value:
        return False
    lowered_value = normalized_value.lower()
    if lowered_value in {"not reported", "not available"}:
        return False
    if lowered_value in normalize_spaces(page.fused_text).lower():
        return True
    return any(lowered_value in text.lower() for text in visible_row_texts(page))


def find_section_page_range(
    page_artifacts: List[PageArtifact],
    start_pattern: re.Pattern[str],
    end_patterns: List[re.Pattern[str]],
) -> List[int]:
    started = False
    pages: List[int] = []

    for page in page_artifacts:
        rows = visible_row_texts(page)
        if not rows:
            continue

        has_start = any(start_pattern.search(text) for text in rows)
        if not started:
            if not has_start:
                continue
            started = True
            pages.append(page.page_number)
            continue

        if any(pattern.search(text) for pattern in end_patterns for text in rows):
            break
        pages.append(page.page_number)

    return pages


def union_source_pages(entries: List[Dict[str, Any]]) -> List[int]:
    pages: List[int] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        for page in entry.get("pages") or []:
            if isinstance(page, int) and page > 0:
                pages.append(page)
    return unique_preserve_order(pages)


def infer_report_confirmation_source_pages(
    page_artifacts: List[PageArtifact],
    confirmation_component: Dict[str, Any],
) -> List[int]:
    confirmation_number = confirmation_component.get("confirmationNumber")
    consumer_name = confirmation_component.get("consumerName")
    report_date = confirmation_component.get("reportDate")

    heading_pages = [
        page.page_number for page in page_artifacts if page_has_row_pattern(page, REPORT_CONFIRMATION_ROW_PATTERN)
    ]
    confirmation_pages = [
        page.page_number for page in page_artifacts if page_contains_value(page, confirmation_number)
    ]
    selected = unique_preserve_order(confirmation_pages or heading_pages)

    if not selected and consumer_name:
        name_pages = [page.page_number for page in page_artifacts if page_contains_value(page, consumer_name)]
        selected = unique_preserve_order(name_pages[:1])

    if report_date and not any(page_contains_value(page_artifacts[page - 1], report_date) for page in selected if 1 <= page <= len(page_artifacts)):
        report_date_pages = [
            page.page_number for page in page_artifacts if page_contains_value(page, report_date)
        ]
        selected = unique_preserve_order(selected + report_date_pages[:1])

    return selected


def infer_component_source_pages(
    page_artifacts: List[PageArtifact],
    components: Dict[str, Any],
    page_windows: Dict[str, List[int]],
    account_sources: List[Dict[str, Any]],
    collection_sources: List[Dict[str, Any]],
    inquiry_evidence: Dict[str, List[Dict[str, Any]]],
) -> Dict[str, List[int]]:
    component_sources: Dict[str, List[int]] = {}

    summary_pages = [
        page.page_number for page in page_artifacts if page_has_row_pattern(page, SUMMARY_SECTION_PATTERN)
    ]
    summary_page_set = set(summary_pages)
    credit_accounts_summary_pages = [
        page.page_number
        for page in page_artifacts
        if (not summary_page_set or page.page_number in summary_page_set)
        and (
            page_has_row_pattern(page, CREDIT_ACCOUNTS_SECTION_ROW_PATTERN)
        or page_has_row_pattern(page, CREDIT_ACCOUNTS_TABLE_HEADER_PATTERN)
        )
    ]
    other_items_summary_pages = [
        page.page_number
        for page in page_artifacts
        if (not summary_page_set or page.page_number in summary_page_set)
        and (
            page_has_row_pattern(page, OTHER_ITEMS_SECTION_ROW_PATTERN)
        or page_has_row_pattern(page, OTHER_ITEMS_TABLE_ROW_PATTERN)
        )
    ]
    personal_information_pages = find_section_page_range(
        page_artifacts,
        PERSONAL_INFORMATION_SECTION_PATTERN,
        [INQUIRIES_SECTION_PATTERN],
    )
    inquiry_pages = union_source_pages((inquiry_evidence.get("hardInquiries") or []) + (inquiry_evidence.get("softInquiries") or []))
    if not inquiry_pages:
        inquiry_pages = find_section_page_range(
            page_artifacts,
            INQUIRIES_SECTION_PATTERN,
            [PUBLIC_RECORDS_SECTION_PATTERN],
        )

    collection_pages = union_source_pages(collection_sources)
    if not collection_pages:
        collection_pages = find_section_page_range(
            page_artifacts,
            COLLECTIONS_SECTION_PATTERN,
            [DISPUTE_SECTION_PATTERN],
        )

    public_record_pages = find_section_page_range(
        page_artifacts,
        PUBLIC_RECORDS_SECTION_PATTERN,
        [COLLECTIONS_SECTION_PATTERN],
    )

    account_pages = union_source_pages(account_sources)

    inferred = {
        "reportConfirmationDetails": infer_report_confirmation_source_pages(
            page_artifacts,
            components.get("reportConfirmationDetails") or {},
        ),
        "personalInformation": personal_information_pages,
        "summary": summary_pages,
        "creditAccountsSummary": credit_accounts_summary_pages,
        "otherItemsSummary": other_items_summary_pages,
        "accounts": account_pages,
        "collections": collection_pages,
        "publicRecords": public_record_pages,
        "inquiries": inquiry_pages,
    }

    for component_name in COMPONENT_NAMES:
        component_sources[component_name] = unique_preserve_order(
            inferred.get(component_name) or page_windows.get(component_name) or []
        )

    return component_sources


def extend_component_page_window(
    component_name: str,
    page_artifacts: List[PageArtifact],
    page_numbers: List[int],
) -> List[int]:
    if component_name not in {"inquiries", "accounts"} or not page_numbers:
        return page_numbers

    selected_pages = sorted({page for page in page_numbers if 1 <= page <= len(page_artifacts)})
    if not selected_pages:
        return selected_pages

    max_page = len(page_artifacts)
    if component_name == "accounts":
        start_page = min(selected_pages)
        extended: set[int] = set()
        for page_number in range(start_page, max_page + 1):
            page = page_artifacts[page_number - 1]
            rows = visible_row_texts(page)
            if not rows:
                continue
            if page_number > start_page and ACCOUNT_SECTION_STOP_PATTERN.match(rows[0]):
                break
            extended.add(page_number)
        return sorted(extended)

    extended = set(selected_pages)

    for page_number in range(max(selected_pages) + 1, max_page + 1):
        page = page_artifacts[page_number - 1]
        rows = visible_row_texts(page)
        if not rows:
            continue
        if is_inquiry_section_break(rows[0]):
            break
        extended.add(page_number)

    return sorted(extended)


def text_for_pages(page_artifacts: List[PageArtifact], page_numbers: List[int], source: str = "fused") -> str:
    chunks: List[str] = []
    for page_number in page_numbers:
        page = page_artifacts[page_number - 1]
        if source == "text_layer":
            content = page.text_layer
        elif source == "ocr":
            content = page.ocr_text
        else:
            content = page.fused_text
        chunks.append(f"[Page {page_number}]\n{content}")
    return "\n\n".join(chunks)


def layout_tables_for_pages(page_artifacts: List[PageArtifact], page_numbers: List[int]) -> List[Dict[str, Any]]:
    tables: List[Dict[str, Any]] = []
    for page_number in page_numbers:
        if not 1 <= page_number <= len(page_artifacts):
            continue
        tables.extend(page_artifacts[page_number - 1].layout_tables)
    return tables


def layout_items_for_pages(page_artifacts: List[PageArtifact], page_numbers: List[int]) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    for page_number in page_numbers:
        if not 1 <= page_number <= len(page_artifacts):
            continue
        items.extend(page_artifacts[page_number - 1].layout_items)
    return items


def find_table_by_id(page_artifacts: List[PageArtifact], table_id: str) -> Optional[Dict[str, Any]]:
    for page in page_artifacts:
        for table in page.layout_tables:
            if table.get("tableId") == table_id:
                return table
    return None


def table_contains_text(table: Dict[str, Any], needle: str) -> bool:
    lowered = needle.lower()
    if lowered in normalize_spaces(str(table.get("title") or "")).lower():
        return True
    if any(lowered in normalize_spaces(str(heading)).lower() for heading in table.get("headingTrail") or []):
        return True
    for row in table.get("rows") or []:
        if lowered in " ".join(normalize_spaces(str(cell)).lower() for cell in row if normalize_spaces(str(cell))):
            return True
    return False


def normalize_table_cell(value: Any) -> str:
    return normalize_spaces(str(value or ""))


def classify_table_cell_state(value: Any) -> str:
    cleaned = normalize_table_cell(value)
    if not cleaned:
        return "blank"
    if cleaned.lower().rstrip(":") in EXPLICIT_NOT_REPORTED_MARKERS:
        return "explicit_not_reported"
    return "value"


def normalize_pair_label(label: Any) -> str:
    return normalize_spaces(str(label or "")).lower().rstrip(":")


def key_value_entries_from_row(row: List[Any]) -> List[Dict[str, str]]:
    cells = [normalize_table_cell(cell) for cell in row]
    entries: List[Dict[str, str]] = []
    index = 0
    while index < len(cells):
        label = cells[index]
        normalized_label = normalize_pair_label(label)
        if not label or normalized_label not in KNOWN_PAIR_LABELS:
            index += 1
            continue

        value = ""
        value_state = "blank"
        next_index = index + 1
        probe = index + 1
        while probe < len(cells):
            candidate = cells[probe]
            if not candidate:
                probe += 1
                continue
            if normalize_pair_label(candidate) in KNOWN_PAIR_LABELS:
                next_index = probe
                break
            value = candidate
            value_state = classify_table_cell_state(candidate)
            next_index = probe + 1
            break
        else:
            next_index = len(cells)

        entries.append(
            {
                "label": label,
                "value": value,
                "valueState": value_state if value else "blank",
            }
        )
        index = max(next_index, index + 1)
    return entries


def key_value_entries_from_table(table: Dict[str, Any]) -> List[Dict[str, str]]:
    entries: List[Dict[str, str]] = []
    for row in table.get("rows") or []:
        entries.extend(key_value_entries_from_row(row))
    return entries


def key_value_maps_from_table(table: Dict[str, Any]) -> Tuple[Dict[str, str], Dict[str, str]]:
    pairs: Dict[str, str] = {}
    states: Dict[str, str] = {}
    for entry in key_value_entries_from_table(table):
        pairs[entry["label"]] = entry["value"]
        states[entry["label"]] = entry["valueState"]
    return pairs, states


def key_value_pairs_from_table(table: Dict[str, Any]) -> Dict[str, str]:
    pairs, _ = key_value_maps_from_table(table)
    return pairs


def set_field_state(record: Dict[str, Any], field_name: str, state: str) -> None:
    field_states = record.setdefault("_fieldStates", {})
    if not isinstance(field_states, dict):
        field_states = {}
        record["_fieldStates"] = field_states
    field_states[field_name] = state


def get_field_state(record: Dict[str, Any], field_name: str) -> Optional[str]:
    field_states = record.get("_fieldStates")
    if isinstance(field_states, dict):
        value = field_states.get(field_name)
        if value:
            return str(value)
    return None


def should_protect_field(record: Dict[str, Any], field_name: str) -> bool:
    return get_field_state(record, field_name) in PROTECTED_CELL_STATES


def merge_hidden_field_states(primary: Dict[str, Any], fallback: Dict[str, Any]) -> Dict[str, str]:
    merged: Dict[str, str] = {}
    for source in (primary.get("_fieldStates"), fallback.get("_fieldStates")):
        if isinstance(source, dict):
            for key, value in source.items():
                if key not in merged:
                    merged[key] = str(value)
    return merged


def has_meaningful_account_value(field_name: str, value: Any) -> bool:
    if field_name == "paymentStatusCodes":
        return False
    if isinstance(value, list):
        if field_name == "paymentHistory":
            return any(item not in {"-", "", None} for item in value)
        if field_name in {
            "balanceHistory",
            "scheduledPaymentHistory",
            "actualPaymentHistory",
            "creditLimitHistory",
            "amountPastDueHistory",
            "activityDesignatorHistory",
        }:
            return any(
                isinstance(item, dict)
                and any(cell not in {"-", "", None} for key, cell in item.items() if key != "year")
                for item in value
            )
        return any(item not in {"", None, "Not reported"} for item in value)
    return value not in (None, "", "Not reported", [], {})


def merge_account_records(primary: Dict[str, Any], fallback: Dict[str, Any]) -> Dict[str, Any]:
    merged = dict(primary)
    for key, value in fallback.items():
        if key == "_fieldStates":
            continue
        if key == "_historyEvidence":
            primary_evidence = primary.get("_historyEvidence") if isinstance(primary.get("_historyEvidence"), dict) else {}
            fallback_evidence = value if isinstance(value, dict) else {}
            combined = dict(primary_evidence)
            for field_name, rows in fallback_evidence.items():
                if field_name not in combined and rows:
                    combined[field_name] = rows
            if combined:
                merged["_historyEvidence"] = combined
            continue
        if key == "_sourcePages":
            primary_pages = primary.get("_sourcePages") if isinstance(primary.get("_sourcePages"), list) else []
            fallback_pages = value if isinstance(value, list) else []
            combined_pages = [
                int(page)
                for page in unique_preserve_order(list(primary_pages) + list(fallback_pages))
                if isinstance(page, int) and page > 0
            ]
            if combined_pages:
                merged["_sourcePages"] = combined_pages
            continue
        if key not in merged:
            merged[key] = value
            continue
        if should_protect_field(merged, key):
            continue
        if key in {
            "balanceHistory",
            "scheduledPaymentHistory",
            "actualPaymentHistory",
            "creditLimitHistory",
            "amountPastDueHistory",
            "activityDesignatorHistory",
            "paymentHistory",
            "additionalInformation",
            "comments",
            "contact",
        }:
            if not has_meaningful_account_value(key, merged.get(key)) and has_meaningful_account_value(key, value):
                merged[key] = value
            continue
        if merged.get(key) in (None, "", "Not reported", [], {}) and value not in (None, "", [], {}):
            merged[key] = value

    merged_states = merge_hidden_field_states(primary, fallback)
    if merged_states:
        merged["_fieldStates"] = merged_states
    return merged


def merge_collection_records(primary: Dict[str, Any], fallback: Dict[str, Any]) -> Dict[str, Any]:
    merged = dict(primary)
    for key, value in fallback.items():
        if key == "_fieldStates":
            continue
        if key == "_sourcePages":
            primary_pages = primary.get("_sourcePages") if isinstance(primary.get("_sourcePages"), list) else []
            fallback_pages = value if isinstance(value, list) else []
            combined_pages = [
                int(page)
                for page in unique_preserve_order(list(primary_pages) + list(fallback_pages))
                if isinstance(page, int) and page > 0
            ]
            if combined_pages:
                merged["_sourcePages"] = combined_pages
            continue
        if key not in merged:
            merged[key] = value
            continue
        if should_protect_field(merged, key):
            continue
        if key in {"comments", "contact"}:
            if not merged.get(key) and value:
                merged[key] = value
            continue
        if merged.get(key) in (None, "", [], {}) and value not in (None, "", [], {}):
            merged[key] = value

    merged_states = merge_hidden_field_states(primary, fallback)
    if merged_states:
        merged["_fieldStates"] = merged_states
    return merged


def table_rows_to_text(table: Dict[str, Any]) -> str:
    lines = []
    for row in table.get("rows") or []:
        rendered = " | ".join(normalize_table_cell(cell) for cell in row)
        if any(normalize_table_cell(cell) for cell in row):
            lines.append(rendered.rstrip())
    return "\n".join(lines)


def history_rows_from_table(table: Dict[str, Any]) -> List[Dict[str, str]]:
    rows = table.get("rows") or []
    if not rows:
        return []

    header = [normalize_table_cell(cell).lower() for cell in rows[0]]
    if not looks_like_month_header(header):
        return []

    history: List[Dict[str, str]] = []
    for row in rows[1:]:
        normalized = [normalize_table_cell(cell) for cell in row]
        entry = {"year": normalized[0] if normalized else "-"}
        for index, month in enumerate(MONTH_COLUMNS[1:], start=1):
            entry[month] = normalized[index] if index < len(normalized) and normalized[index] else "-"
        history.append(entry)
    return history


def normalize_payment_history_values(value: Any, minimum_months: int = 36) -> List[str]:
    cleaned: List[str] = []
    if isinstance(value, list):
        for item in value:
            raw = normalize_spaces(str(item))
            cleaned.append(normalize_payment_history_code(raw) if raw and raw != "-" else "-")

    if not cleaned:
        return ["-"] * minimum_months

    target_length = ((len(cleaned) + 11) // 12) * 12
    while len(cleaned) < target_length:
        cleaned.append("-")
    return cleaned[:target_length]


def payment_history_from_table(table: Dict[str, Any]) -> List[str]:
    rows = table.get("rows") or []
    if not rows:
        return ["-"] * 36

    header = [normalize_table_cell(cell).lower() for cell in rows[0]]
    if not looks_like_month_header(header):
        return ["-"] * 36

    values: List[str] = []
    for row in rows[1:]:
        normalized = [normalize_table_cell(cell) for cell in row]
        year = normalized[0] if normalized else ""
        if not re.fullmatch(r"\d{4}", year):
            continue
        month_values = normalized[1:13]
        while len(month_values) < 12:
            month_values.append("")
        values.extend([value or "-" for value in month_values])
    return normalize_payment_history_values(values)


GEOMETRY_REPAIR_COUNTS: Dict[str, int] = {}


def note_geometry_repair(kind: str, detail: str = "", immediate: bool = False) -> None:
    """Record a defensive geometry repair so masked upstream bugs stay visible.

    Aggregate kinds (immediate=False) are routine — e.g. a grid row's final edge
    extended past text that stops short of the last column — and surface only in
    the exit summary (per-row warnings would flood stderr and train readers to
    ignore it). Anomaly kinds (immediate=True) should be unreachable in healthy
    extraction; each occurrence prints to stderr with identifiers. Session-22
    lesson: silent repairs/skips in this pipeline hid the Dec-2020 checkmark
    miss. stderr is safe here — the server collects it for logs only
    (pythonWorker.mjs) and failure is signaled by exit code/status.
    """
    GEOMETRY_REPAIR_COUNTS[kind] = GEOMETRY_REPAIR_COUNTS.get(kind, 0) + 1
    if immediate:
        print(f"[geometry-repair] {kind}: {detail}", file=sys.stderr)


@atexit.register
def _emit_geometry_repair_summary() -> None:
    if GEOMETRY_REPAIR_COUNTS:
        counts = ", ".join(f"{kind}={count}" for kind, count in sorted(GEOMETRY_REPAIR_COUNTS.items()))
        print(f"[geometry-repair] summary: {counts}", file=sys.stderr)


def table_column_boundaries(table: Dict[str, Any]) -> List[float]:
    columns = table.get("columns") or []
    if not columns:
        return []
    bbox = table.get("bbox") or {}
    boundaries = [float(bbox.get("xMin") or columns[0])]
    for idx in range(1, len(columns)):
        boundaries.append((float(columns[idx - 1]) + float(columns[idx])) / 2.0)
    # Same last-edge guard as column_boundaries_from_positions: never collapse
    # below the last interior boundary (image-only last cells shrink the bbox).
    table_x_max = float(bbox.get("xMax") or columns[-1])
    if len(boundaries) >= 2:
        column_width = boundaries[-1] - boundaries[-2]
    else:
        column_width = 0.0
    guarded_edge = boundaries[-1] + max(column_width, 1.0)
    if guarded_edge > table_x_max:
        note_geometry_repair("table_last_edge_extended")
    boundaries.append(max(table_x_max, guarded_edge))
    return boundaries


def normalize_payment_history_code(value: str) -> str:
    token = re.sub(r"[^A-Za-z0-9]", "", value or "").upper()
    if not token:
        return "-"
    if token in STATUS_CODES:
        return token
    if token.startswith("COL"):
        return "COL"
    if token.startswith("CO"):
        return "CO"
    if token.startswith("OK") or token in {"0K", "DK", "GK"}:
        return "OK"
    if token.startswith("TNT") or token in {"TN"}:
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


def ocr_payment_history_cell(
    page: PageArtifact,
    crop_box_pdf: Tuple[float, float, float, float],
    allow_tesseract: bool = True,
) -> Tuple[str, str, str]:
    if Image is None or ImageOps is None:
        return "-", "", "image_crop"
    image_path = Path(page.image_path)
    if not image_path.exists() or page.page_width <= 0 or page.page_height <= 0:
        return "-", "", "image_crop"

    with Image.open(image_path) as image:
        scale_x = image.width / max(page.page_width, 1.0)
        scale_y = image.height / max(page.page_height, 1.0)
        left = max(int(crop_box_pdf[0] * scale_x), 0)
        top = max(int(crop_box_pdf[1] * scale_y), 0)
        right = min(int(crop_box_pdf[2] * scale_x), image.width)
        bottom = min(int(crop_box_pdf[3] * scale_y), image.height)
        if right <= left or bottom <= top:
            return "-", "", "image_crop"

        crop = image.crop((left, top, right, bottom))
        if detect_green_checkmark(crop):
            return "OK", "green_checkmark", "image_checkmark"
        if not allow_tesseract:
            return "-", "", "image_crop"
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
                return "-", "", "image_crop"
            text_path = output_base.with_suffix(".txt")
            if not text_path.exists():
                return "-", "", "image_crop"
            raw = text_path.read_text(encoding="utf-8", errors="ignore").strip()
            return normalize_payment_history_code(raw), raw, "image_crop"


def payment_history_from_image_with_evidence(
    page_artifacts: List[PageArtifact],
    table: Dict[str, Any],
) -> Tuple[List[str], List[Dict[str, Any]]]:
    page_number = int(table.get("pageNumber") or 0)
    if not 1 <= page_number <= len(page_artifacts):
        return ["-"] * 36, []

    boundaries = table_column_boundaries(table)
    if len(boundaries) < 14:
        return ["-"] * 36, []

    year_rows: List[Dict[str, Any]] = []
    start_row = int(table.get("endRowIndex") or 0)
    for current_page_number, page, row in iter_rows_after_position(page_artifacts, page_number, start_row):
        if is_footer_row(row, page.page_height):
            continue
        text = normalize_spaces(str(row.get("text") or ""))
        if row_contains_month_header(row):
            continue
        if re.fullmatch(r"\d{4}", text):
            year_rows.append({**row, "_pageNumber": current_page_number})
            continue
        if year_rows and (is_heading_row(row) or text):
            break

    if not year_rows:
        return ["-"] * 36, []

    values: List[str] = []
    evidence_rows: List[Dict[str, Any]] = []
    for row in year_rows:
        year = normalize_spaces(str(row.get("text") or ""))
        row_page_number = int(row.get("_pageNumber") or 0)
        if not 1 <= row_page_number <= len(page_artifacts):
            continue
        page = page_artifacts[row_page_number - 1]
        evidence_row = month_row_evidence_template("paymentHistory", year, row)
        row_top = max(float(row["bbox"]["yMin"]) - 2.0, 0.0)
        row_bottom = min(float(row["bbox"]["yMax"]) + 2.0, page.page_height)
        for month_index in range(1, 13):
            left = boundaries[month_index]
            right = boundaries[month_index + 1]
            normalized_value, raw_value, source = ocr_payment_history_cell(
                page,
                (left, row_top, right, row_bottom),
            )
            month = MONTH_COLUMNS[month_index]
            values.append(normalized_value)
            evidence_row["months"][month] = make_history_cell_evidence(
                row=row,
                field_name="paymentHistory",
                year=year,
                month=month,
                value=normalized_value,
                raw_text=raw_value,
                bbox={
                    "xMin": float(left),
                    "xMax": float(right),
                    "yMin": float(row_top),
                    "yMax": float(row_bottom),
                },
                source=source,
                state="reported" if raw_value or normalized_value != "-" else "blank",
            )
        evidence_rows.append(evidence_row)

    return normalize_payment_history_values(values), evidence_rows


def payment_history_from_image(page_artifacts: List[PageArtifact], table: Dict[str, Any]) -> List[str]:
    values, _ = payment_history_from_image_with_evidence(page_artifacts, table)
    return values


def history_field_for_heading(text: str) -> Optional[str]:
    normalized = normalize_spaces(text).lower()
    return ACCOUNT_SECTION_FIELDS.get(normalized)


def item_position_key(item: Dict[str, Any]) -> Tuple[int, int]:
    return (int(item.get("pageNumber") or 0), int(item.get("rowIndex") or 0))


def history_columns_from_row(row: Dict[str, Any]) -> List[float]:
    blocks = sorted(row.get("blocks") or [], key=lambda block: (block["bbox"]["xMin"], block["bbox"]["yMin"]))
    columns = [float(block["bbox"]["xMin"]) for block in blocks if normalize_table_cell(block.get("text", ""))]
    return columns[:13]


def row_cells_for_columns(row: Dict[str, Any], columns: List[float]) -> List[str]:
    cells = [""] * len(columns)
    for block in sorted(row.get("blocks") or [], key=lambda block: (block["bbox"]["xMin"], block["bbox"]["yMin"])):
        text = normalize_table_cell(block.get("text", ""))
        if not text:
            continue
        column_index = min(range(len(columns)), key=lambda idx: abs(columns[idx] - float(block["bbox"]["xMin"])))
        if cells[column_index]:
            cells[column_index] = normalize_spaces(f"{cells[column_index]} {text}")
        else:
            cells[column_index] = text
    return cells


def column_boundaries_from_positions(row: Dict[str, Any], columns: List[float]) -> List[float]:
    if not columns:
        return []
    bbox = row.get("bbox") or {}
    boundaries = [float(bbox.get("xMin") or columns[0])]
    for idx in range(1, len(columns)):
        boundaries.append((float(columns[idx - 1]) + float(columns[idx])) / 2.0)
    # The final edge must never collapse below the last interior boundary: a row whose
    # last cell is a checkmark IMAGE has no last-column text, so the data row's xMax
    # ends at the previous column and would invert the last cell's bbox (the Dec-2020
    # miss). Extend by one typical column width past the last header midpoint instead.
    row_x_max = float(bbox.get("xMax") or columns[-1])
    if len(boundaries) >= 2:
        column_width = boundaries[-1] - boundaries[-2]
    else:
        column_width = 0.0
    guarded_edge = boundaries[-1] + max(column_width, 1.0)
    if guarded_edge > row_x_max:
        note_geometry_repair("row_last_edge_extended")
    boundaries.append(max(row_x_max, guarded_edge))
    return boundaries


def merge_history_bboxes(boxes: List[Dict[str, Any]]) -> Optional[Dict[str, float]]:
    if not boxes:
        return None
    return {
        "xMin": min(float(box.get("xMin") or 0.0) for box in boxes),
        "xMax": max(float(box.get("xMax") or 0.0) for box in boxes),
        "yMin": min(float(box.get("yMin") or 0.0) for box in boxes),
        "yMax": max(float(box.get("yMax") or 0.0) for box in boxes),
    }


def empty_history_cell_detail() -> Dict[str, Any]:
    return {
        "text": "",
        "rawText": "",
        "boxes": [],
        "bbox": None,
    }


def row_cell_details_for_columns(row: Dict[str, Any], columns: List[float]) -> List[Dict[str, Any]]:
    details = [empty_history_cell_detail() for _ in columns]
    for block in sorted(row.get("blocks") or [], key=lambda block: (block["bbox"]["xMin"], block["bbox"]["yMin"])):
        text = normalize_table_cell(block.get("text", ""))
        if not text:
            continue
        column_index = min(range(len(columns)), key=lambda idx: abs(columns[idx] - float(block["bbox"]["xMin"])))
        cell = details[column_index]
        if cell["text"]:
            cell["text"] = normalize_spaces(f"{cell['text']} {text}")
            cell["rawText"] = normalize_spaces(f"{cell['rawText']} {text}")
        else:
            cell["text"] = text
            cell["rawText"] = text
        box = block.get("bbox") or {}
        cell["boxes"].append(
            {
                "xMin": float(box.get("xMin") or 0.0),
                "xMax": float(box.get("xMax") or 0.0),
                "yMin": float(box.get("yMin") or 0.0),
                "yMax": float(box.get("yMax") or 0.0),
            }
        )

    boundaries = column_boundaries_from_positions(row, columns)
    row_bbox = row.get("bbox") or {}
    row_top = float(row_bbox.get("yMin") or 0.0)
    row_bottom = float(row_bbox.get("yMax") or row_top)
    for index, cell in enumerate(details):
        merged = merge_history_bboxes(cell["boxes"])
        if merged:
            cell["bbox"] = merged
            continue
        if index + 1 < len(boundaries):
            left_edge = float(boundaries[index])
            right_edge = float(boundaries[index + 1])
            if right_edge <= left_edge:
                # Never emit an inverted/degenerate bbox — fall back to one median
                # column width to the right of the cell's own left edge.
                note_geometry_repair(
                    "degenerate_cell_bbox_repaired",
                    f"column {index + 1}/{len(boundaries) - 1} edges [{left_edge:.2f}, {right_edge:.2f}] row y {row_top:.2f}",
                    immediate=True,
                )
                widths = [boundaries[i + 1] - boundaries[i] for i in range(len(boundaries) - 1) if boundaries[i + 1] > boundaries[i]]
                fallback_width = sorted(widths)[len(widths) // 2] if widths else 10.0
                right_edge = left_edge + fallback_width
            cell["bbox"] = {
                "xMin": left_edge,
                "xMax": right_edge,
                "yMin": row_top,
                "yMax": row_bottom,
            }
    return details


def make_history_cell_evidence(
    row: Dict[str, Any],
    field_name: str,
    year: str,
    month: str,
    value: str,
    raw_text: str,
    bbox: Optional[Dict[str, Any]],
    source: str,
    state: str,
) -> Dict[str, Any]:
    return {
        "field": field_name,
        "year": year,
        "month": month,
        "value": value,
        "rawText": raw_text,
        "state": state,
        "pageNumber": int(row.get("_pageNumber") or row.get("pageNumber") or 0),
        "rowIndex": int(row.get("rowIndex") or 0),
        "bbox": bbox,
        "source": source,
    }


def month_row_evidence_template(field_name: str, year: str, row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "field": field_name,
        "year": year,
        "pageNumber": int(row.get("_pageNumber") or row.get("pageNumber") or 0),
        "rowIndex": int(row.get("rowIndex") or 0),
        "months": {},
    }


def section_rows_between(
    page_artifacts: List[PageArtifact],
    start_item: Dict[str, Any],
    end_item: Optional[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    start_page, start_row = item_position_key(start_item)
    end_page, end_row = item_position_key(end_item) if end_item else (len(page_artifacts), 10**9)
    rows: List[Dict[str, Any]] = []

    for page_number in range(start_page, end_page + 1):
        if not 1 <= page_number <= len(page_artifacts):
            continue
        page = page_artifacts[page_number - 1]
        for row in page.layout_rows:
            row_index = int(row.get("rowIndex") or 0)
            if page_number == start_page and row_index <= start_row:
                continue
            if page_number == end_page and row_index >= end_row:
                continue
            if is_footer_row(row, page.page_height):
                continue
            rows.append(
                {
                    **row,
                    "_pageNumber": page_number,
                }
            )

    return rows


def find_month_header_row(rows: List[Dict[str, Any]]) -> Tuple[Optional[Dict[str, Any]], List[float], int]:
    for index, row in enumerate(rows):
        header_cells = [
            normalize_table_cell(block.get("text", "")).lower()
            for block in sorted(row.get("blocks") or [], key=lambda block: (block["bbox"]["xMin"], block["bbox"]["yMin"]))
            if normalize_table_cell(block.get("text", ""))
        ]
        if looks_like_month_header(header_cells):
            columns = history_columns_from_row(row)
            if len(columns) >= 13:
                return row, columns, index
    return None, [], -1


def row_contains_month_header(row: Dict[str, Any]) -> bool:
    header_cells = [
        normalize_table_cell(block.get("text", "")).lower()
        for block in sorted(row.get("blocks") or [], key=lambda block: (block["bbox"]["xMin"], block["bbox"]["yMin"]))
        if normalize_table_cell(block.get("text", ""))
    ]
    if looks_like_month_header(header_cells):
        return True
    return looks_like_month_header(normalize_spaces(str(row.get("text") or "")).lower().split())


def monthly_history_from_rows_with_evidence(
    rows: List[Dict[str, Any]],
    field_name: str,
) -> Tuple[List[Dict[str, str]], List[Dict[str, Any]]]:
    header_row, columns, header_index = find_month_header_row(rows)
    if not header_row or len(columns) < 13:
        return [], []

    history: List[Dict[str, str]] = []
    evidence_rows: List[Dict[str, Any]] = []
    for row in rows[header_index + 1 :]:
        cell_details = row_cell_details_for_columns(row, columns)
        year = normalize_table_cell(cell_details[0]["text"] if cell_details else "")
        if not re.fullmatch(r"\d{4}", year):
            continue
        entry = {"year": year}
        evidence_row = month_row_evidence_template(field_name, year, row)
        for index, month in enumerate(MONTH_COLUMNS[1:], start=1):
            detail = cell_details[index] if index < len(cell_details) else empty_history_cell_detail()
            raw_value = normalize_table_cell(detail["text"])
            if raw_value.lower().rstrip(":") in EXPLICIT_NOT_REPORTED_MARKERS:
                entry[month] = "Not reported"
                state = "explicit_not_reported"
            else:
                entry[month] = raw_value or "-"
                state = "reported" if raw_value else "blank"
            evidence_row["months"][month] = make_history_cell_evidence(
                row=row,
                field_name=field_name,
                year=year,
                month=month,
                value=entry[month],
                raw_text=raw_value,
                bbox=detail.get("bbox"),
                source="layout_row",
                state=state,
            )
        history.append(entry)
        evidence_rows.append(evidence_row)
    return history, evidence_rows


def monthly_history_from_rows(rows: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    history, _ = monthly_history_from_rows_with_evidence(rows, "history")
    return history


def should_image_enrich_payment_history_cell(cell: Dict[str, Any]) -> bool:
    value = normalize_payment_history_code(str(cell.get("value") or ""))
    raw_text = normalize_table_cell(cell.get("rawText") or "")
    source = str(cell.get("source") or "")
    if source == "image_checkmark":
        return False
    if value != "-":
        return False
    return bool(cell.get("bbox")) and not raw_text.upper().startswith("X")


def enrich_payment_history_evidence_from_image(
    page_artifacts: List[PageArtifact],
    evidence_rows: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    rows_by_page: Dict[int, List[Dict[str, Any]]] = {}
    for row in evidence_rows:
        page_number = int(row.get("pageNumber") or 0)
        if not 1 <= page_number <= len(page_artifacts):
            continue
        rows_by_page.setdefault(page_number, []).append(row)

    for page_number, rows in rows_by_page.items():
        page = page_artifacts[page_number - 1]
        if Image is None:
            continue
        image_path = Path(page.image_path)
        if not image_path.exists() or page.page_width <= 0 or page.page_height <= 0:
            continue
        with Image.open(image_path) as image:
            scale_x = image.width / max(page.page_width, 1.0)
            scale_y = image.height / max(page.page_height, 1.0)
            for row in rows:
                months = row.get("months") or {}
                if not isinstance(months, dict):
                    continue
                for month in MONTH_COLUMNS[1:]:
                    cell = months.get(month)
                    if not isinstance(cell, dict) or not should_image_enrich_payment_history_cell(cell):
                        continue
                    bbox = cell.get("bbox") or {}
                    if not bbox:
                        continue
                    if float(bbox.get("xMax") or 0.0) < float(bbox.get("xMin") or 0.0):
                        note_geometry_repair(
                            "inverted_bbox_normalized",
                            f"page {page_number} year {row.get('year')} month {month} bbox xMin {bbox.get('xMin')} > xMax {bbox.get('xMax')}",
                            immediate=True,
                        )
                    x_lo = min(float(bbox.get("xMin") or 0.0), float(bbox.get("xMax") or 0.0))
                    x_hi = max(float(bbox.get("xMin") or 0.0), float(bbox.get("xMax") or 0.0))
                    left = max(int(x_lo * scale_x), 0)
                    top = max(int(float(bbox.get("yMin") or 0.0) * scale_y), 0)
                    right = min(int(x_hi * scale_x), image.width)
                    bottom = min(int(float(bbox.get("yMax") or 0.0) * scale_y), image.height)
                    if right <= left or bottom <= top:
                        # Never silently skip a candidate cell: a degenerate window
                        # hid the Dec-2020 checkmark. Widen to one nominal cell width.
                        note_geometry_repair(
                            "degenerate_crop_normalized",
                            f"page {page_number} year {row.get('year')} month {month} window [{left}, {top}, {right}, {bottom}]",
                            immediate=True,
                        )
                        right = min(left + max(int(36.0 * scale_x), 8), image.width)
                        if right <= left or bottom <= top:
                            note_geometry_repair(
                                "degenerate_crop_skipped",
                                f"page {page_number} year {row.get('year')} month {month} unrecoverable window [{left}, {top}, {right}, {bottom}]",
                                immediate=True,
                            )
                            continue
                    crop = image.crop((left, top, right, bottom))
                    if not detect_green_checkmark(crop):
                        continue
                    cell["value"] = "OK"
                    cell["rawText"] = "green_checkmark"
                    cell["source"] = "image_checkmark"
                    cell["state"] = "reported"
    return evidence_rows


def payment_history_values_from_evidence_rows(evidence_rows: List[Dict[str, Any]]) -> List[str]:
    values: List[str] = []
    for row in evidence_rows:
        months = row.get("months") or {}
        for month in MONTH_COLUMNS[1:]:
            cell = months.get(month) if isinstance(months, dict) else None
            values.append(normalize_payment_history_code(str((cell or {}).get("value") or "")) if isinstance(cell, dict) else "-")
    return values


def payment_history_from_rows_with_evidence(
    page_artifacts: List[PageArtifact],
    rows: List[Dict[str, Any]],
) -> Tuple[List[str], Optional[Dict[str, Any]], List[Dict[str, Any]]]:
    header_row, columns, header_index = find_month_header_row(rows)
    if not header_row or len(columns) < 13:
        return ["-"] * 36, None, []

    values: List[str] = []
    evidence_rows: List[Dict[str, Any]] = []
    for row in rows[header_index + 1 :]:
        cell_details = row_cell_details_for_columns(row, columns)
        year = normalize_table_cell(cell_details[0]["text"] if cell_details else "")
        if not re.fullmatch(r"\d{4}", year):
            continue
        evidence_row = month_row_evidence_template("paymentHistory", year, row)
        for index in range(1, 13):
            detail = cell_details[index] if index < len(cell_details) else empty_history_cell_detail()
            raw_value = normalize_table_cell(detail["text"])
            normalized_value = normalize_payment_history_code(raw_value)
            month = MONTH_COLUMNS[index]
            values.append(normalized_value)
            evidence_row["months"][month] = make_history_cell_evidence(
                row=row,
                field_name="paymentHistory",
                year=year,
                month=month,
                value=normalized_value,
                raw_text=raw_value,
                bbox=detail.get("bbox"),
                source="layout_row",
                state="reported" if raw_value else "blank",
            )
        evidence_rows.append(evidence_row)
    evidence_rows = enrich_payment_history_evidence_from_image(page_artifacts, evidence_rows)
    values = payment_history_values_from_evidence_rows(evidence_rows)

    pseudo_table = {
        "pageNumber": int(header_row.get("_pageNumber") or 0),
        "columns": columns,
        "bbox": header_row.get("bbox") or {},
        "endRowIndex": int(header_row.get("rowIndex") or 0),
    }
    return normalize_payment_history_values(values), pseudo_table, evidence_rows


def payment_history_from_rows(page_artifacts: List[PageArtifact], rows: List[Dict[str, Any]]) -> Tuple[List[str], Optional[Dict[str, Any]]]:
    values, pseudo_table, _ = payment_history_from_rows_with_evidence(page_artifacts, rows)
    return values, pseudo_table


def extract_account_history_payload_from_section(
    page_artifacts: List[PageArtifact],
    section: Dict[str, Any],
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    items = sorted(section.get("items") or [], key=item_position_key)
    payload: Dict[str, Any] = {}
    evidence: Dict[str, Any] = {}

    history_heading_indexes = [
        index
        for index, item in enumerate(items)
        if item.get("type") == "heading" and history_field_for_heading(str(item.get("text") or ""))
    ]

    for position, index in enumerate(history_heading_indexes):
        heading_item = items[index]
        field_name = history_field_for_heading(str(heading_item.get("text") or ""))
        if not field_name:
            continue
        next_heading = next(
            (
                candidate
                for candidate in items[index + 1 :]
                if candidate.get("type") == "heading"
            ),
            None,
        )
        rows = section_rows_between(page_artifacts, heading_item, next_heading)
        if not rows:
            continue
        if field_name == "paymentHistory":
            values, pseudo_table, field_evidence = payment_history_from_rows_with_evidence(page_artifacts, rows)
            if all(value == "-" for value in values) and pseudo_table:
                values, field_evidence = payment_history_from_image_with_evidence(page_artifacts, pseudo_table)
            payload[field_name] = values
            if field_evidence:
                evidence[field_name] = field_evidence
            continue
        values, field_evidence = monthly_history_from_rows_with_evidence(rows, field_name)
        payload[field_name] = values
        if field_evidence:
            evidence[field_name] = field_evidence

    return payload, evidence


def row_lines(block: Dict[str, Any]) -> List[str]:
    lines = block.get("lines")
    if isinstance(lines, list) and lines:
        return [normalize_spaces(str(line)) for line in lines if normalize_spaces(str(line))]
    text = str(block.get("text") or "")
    return [normalize_spaces(line) for line in text.splitlines() if normalize_spaces(line)]


def unique_strings(values: List[str]) -> List[str]:
    seen = set()
    deduped: List[str] = []
    for value in values:
        clean = normalize_spaces(value)
        if not clean:
            continue
        key = clean.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(clean)
    return deduped


def unique_preserve_order(values: List[Any]) -> List[Any]:
    seen = set()
    deduped: List[Any] = []
    for value in values:
        key = json.dumps(value, sort_keys=True, default=str) if isinstance(value, (dict, list, tuple)) else str(value)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(value)
    return deduped


def is_account_comments_contact_break(text: str) -> bool:
    normalized = normalize_spaces(text)
    if not normalized:
        return False
    lowered = normalized.lower()
    if lowered in {"summary", "account history", "payment history", "account details"}:
        return True
    return bool(re.match(r"^\d+\.\d+\s+.+", normalized) or re.match(r"^\d+\.\s+.+", normalized))


def find_account_details_start_item(section: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    for item in sorted(section.get("items") or [], key=item_position_key):
        if item.get("type") != "heading":
            continue
        if normalize_spaces(str(item.get("text") or "")).lower() == "account details":
            return item
    return None


def find_layout_row(page_artifacts: List[PageArtifact], page_number: int, row_index: int) -> Optional[Dict[str, Any]]:
    if not 1 <= page_number <= len(page_artifacts):
        return None
    for row in page_artifacts[page_number - 1].layout_rows:
        if int(row.get("rowIndex") or -1) == row_index:
            return row
    return None


def account_comments_contact_split_x(header_row: Dict[str, Any]) -> float:
    blocks = sorted(header_row.get("blocks") or [], key=lambda block: (block["bbox"]["xMin"], block["bbox"]["yMin"]))
    if len(blocks) >= 2:
        return (float(blocks[0]["bbox"]["xMax"]) + float(blocks[-1]["bbox"]["xMin"])) / 2.0
    bbox = header_row.get("bbox") or {}
    return float(bbox.get("xMin") or 0.0) + (float(bbox.get("width") or 0.0) / 2.0)


def is_comments_contact_header_row(row: Dict[str, Any]) -> bool:
    text = normalize_spaces(str(row.get("text") or "")).lower()
    if text in ACCOUNT_COMMENTS_CONTACT_TITLES:
        return True
    blocks = sorted(row.get("blocks") or [], key=lambda block: (block["bbox"]["xMin"], block["bbox"]["yMin"]))
    labels = [normalize_spaces(str(block.get("text") or "")).lower() for block in blocks if normalize_spaces(str(block.get("text") or ""))]
    return labels == ["comments", "contact"]


def iter_rows_after_position(
    page_artifacts: List[PageArtifact],
    start_page: int,
    start_row: int,
) -> Iterable[Tuple[int, PageArtifact, Dict[str, Any]]]:
    for page_number in range(start_page, len(page_artifacts) + 1):
        page = page_artifacts[page_number - 1]
        for row in page.layout_rows:
            row_index = int(row.get("rowIndex") or -1)
            if page_number == start_page and row_index <= start_row:
                continue
            yield page_number, page, row


def split_comments_contact_row(row: Dict[str, Any], split_x: float) -> Tuple[List[str], List[str]]:
    comments: List[str] = []
    contact: List[str] = []
    for block in sorted(row.get("blocks") or [], key=lambda block: (block["bbox"]["xMin"], block["bbox"]["yMin"])):
        lines = row_lines(block)
        if not lines:
            continue
        if float(block["bbox"]["xMin"]) >= split_x:
            contact.extend(lines)
        else:
            comments.extend(lines)
    return comments, contact


def extract_account_comments_contact_from_section(
    page_artifacts: List[PageArtifact],
    section: Dict[str, Any],
) -> Dict[str, List[str]]:
    items = sorted(section.get("items") or [], key=item_position_key)
    if not items:
        return {}
    start_item = find_account_details_start_item(section) or items[0]
    start_page, start_row = item_position_key(start_item)
    header_row: Optional[Dict[str, Any]] = None
    header_page = start_page
    for page_number, page, row in iter_rows_after_position(page_artifacts, start_page, start_row):
        if is_footer_row(row, page.page_height):
            continue
        text = normalize_spaces(str(row.get("text") or ""))
        if is_account_comments_contact_break(text):
            return {}
        if is_comments_contact_header_row(row):
            header_row = row
            header_page = page_number
            break
    if not header_row:
        return {}

    split_x = account_comments_contact_split_x(header_row)
    comments: List[str] = []
    contact: List[str] = []

    for _, page, row in iter_rows_after_position(page_artifacts, header_page, int(header_row.get("rowIndex") or -1)):
        if is_footer_row(row, page.page_height):
            continue
        text = normalize_spaces(str(row.get("text") or ""))
        if not text:
            continue
        if is_account_comments_contact_break(text):
            return {
                "comments": unique_strings(comments),
                "contact": unique_strings(contact),
            }
        row_comments, row_contact = split_comments_contact_row(row, split_x)
        comments.extend(row_comments)
        contact.extend(row_contact)
        if len(comments) + len(contact) >= 40:
            return {
                "comments": unique_strings(comments),
                "contact": unique_strings(contact),
            }

    return {
        "comments": unique_strings(comments),
        "contact": unique_strings(contact),
    }


def is_structured_history_fragment(table: Dict[str, Any]) -> bool:
    title = normalize_spaces(str(table.get("title") or ""))
    heading_trail = [normalize_spaces(str(heading)).lower() for heading in (table.get("headingTrail") or [])]
    has_history_heading = any(history_field_for_heading(heading) for heading in heading_trail)
    return has_history_heading and (
        title == "History Grid"
        or bool(re.match(r"^\d{4}\b", title))
    )


def extract_first(patterns: Iterable[str], text: str) -> Optional[str]:
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            if match.groups():
                return normalize_spaces(match.group(1))
            return normalize_spaces(match.group(0))
    return None


def parse_currency(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    match = re.search(r"(-)?\s*\$?\s*([\d,]+(?:\.\d{2})?)", value)
    if not match:
        return None
    sign = "-" if match.group(1) else ""
    amount = re.sub(r"[^\d,\.]", "", match.group(2)).rstrip(",")
    if not re.search(r"\d", amount):
        return None
    return f"{sign}${amount}"


def parse_integer(value: Optional[str]) -> Optional[int]:
    if not value:
        return None
    match = re.search(r"\d+", value)
    if not match:
        return None
    return int(match.group(0))


def create_monthly_history_template() -> List[Dict[str, str]]:
    months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
    rows = []
    for _ in range(3):
        row = {"year": "-"}
        for month in months:
            row[month] = "-"
        rows.append(row)
    return rows


def create_default_account(name: str = "Sample Account", account_number: str = "Not reported") -> Dict[str, Any]:
    return {
        "accountName": name,
        "accountNumber": account_number,
        "isClosed": False,
        "accountType": "Not reported",
        "accountCategory": "Not reported",
        "accountOwnership": "Not reported",
        "openDate": "Not reported",
        "status": "Not reported",
        "balance": "Not reported",
        "balanceHistory": create_monthly_history_template(),
        "scheduledPaymentHistory": create_monthly_history_template(),
        "actualPaymentHistory": create_monthly_history_template(),
        "creditLimitHistory": create_monthly_history_template(),
        "amountPastDueHistory": create_monthly_history_template(),
        "activityDesignatorHistory": create_monthly_history_template(),
        "paymentHistory": ["-"] * 36,
        "paymentStatusCodes": STATUS_CODES.copy(),
        "creditLimit": "Not reported",
        "highestBalance": "Not reported",
        "highCredit": "Not reported",
        "paymentStatus": "Not reported",
        "dateOpened": "Not reported",
        "dateReported": "Not reported",
        "dateClosed": "Not reported",
        "lastPaymentDate": "Not reported",
        "dateOfLastActivity": "Not reported",
        "dateOfFirstDelinquency": "Not reported",
        "delinquencyFirstReported": "Not reported",
        "deferredPaymentStartDate": "Not reported",
        "balloonPaymentDate": "Not reported",
        "currentBalance": "Not reported",
        "paymentAmount": "Not reported",
        "actualPaymentAmount": "Not reported",
        "scheduledPaymentAmount": "Not reported",
        "amountPastDue": "Not reported",
        "chargeOffAmount": "Not reported",
        "balloonPaymentAmount": "Not reported",
        "creditType": "Not reported",
        "loanType": "Not reported",
        "responsibility": "Not reported",
        "paymentResponsibility": "Not reported",
        "termsFrequency": "Not reported",
        "termDuration": "Not reported",
        "monthsReviewed": "Not reported",
        "activityDesignator": "Not reported",
        "creditorClassification": "Not reported",
        "accountStatus": "Not reported",
        "additionalInformation": [],
        "comments": ["Not reported"],
        "contact": [],
        "totalAccounts": 0,
        "openAccounts": 0,
        "closedAccounts": 0,
    }


def create_default_collection() -> Dict[str, Any]:
    return {
        "dateReported": None,
        "collectionAgency": None,
        "balanceDate": None,
        "originalCreditorName": None,
        "accountDesignatorCode": None,
        "dateAssigned": None,
        "accountNumber": None,
        "originalAmountOwed": None,
        "creditorClassification": None,
        "amount": None,
        "lastPaymentDate": None,
        "statusDate": None,
        "dateOfFirstDelinquency": None,
        "status": None,
        "comments": [],
        "contact": [],
    }


def create_default_public_record() -> Dict[str, Any]:
    return {
        "recordType": None,
        "court": None,
        "referenceNumber": None,
        "status": None,
        "amount": None,
        "dateFiled": None,
        "dateResolved": None,
        "summary": None,
        "details": [],
        "sourcePages": [],
    }


def create_default_components() -> Dict[str, Any]:
    return {
        "reportConfirmationDetails": {
            "consumerName": "",
            "confirmationNumber": "",
            "reportDate": "",
        },
        "personalInformation": {
            "name": "",
            "addresses": [],
            "socialSecurityNumber": "",
            "dateOfBirth": "",
            "employmentHistory": "",
            "currentAddresses": [],
            "previousAddresses": [],
        },
        "summary": {
            "reportDate": None,
            "creditFileStatus": None,
            "alertContacts": None,
            "averageAccountAge": None,
            "lengthOfCreditHistory": None,
            "accountsWithNegativeInfo": None,
            "oldestAccount": None,
            "recentAccount": None,
        },
        "creditAccountsSummary": [
            {
                "accountType": account_type,
                "totalAccounts": None,
                "open": None,
                "closed": None,
                "balance": None,
                "withBalance": None,
                "totalBalance": None,
                "available": None,
                "creditLimit": None,
                "debtToCredit": None,
                "payment": None,
            }
            for account_type in REQUIRED_ACCOUNT_TYPES
        ],
        "otherItemsSummary": {
            "inquiries": 0,
            "publicRecords": 0,
            "collections": [],
            "statementCount": 0,
            "personalInfoItemCount": 0,
            "recentInquiry": None,
            "inquiryCount": 0,
            "publicRecordCount": 0,
            "collectionCount": 0,
        },
        "accounts": {
            "accounts": [],
        },
        "collections": {
            "collections": [],
            "collectionCount": 0,
            "collectionFields": {
                "dateReported": "Date the collection was reported to the credit bureau",
                "collectionAgency": "Name of the collection agency handling the debt",
                "balanceDate": "Date of the current balance information",
                "originalCreditorName": "Name of the original creditor who issued the debt",
                "accountDesignatorCode": "Code that identifies the type of collection account",
                "dateAssigned": "Date the debt was assigned to the collection agency",
                "accountNumber": "Collection account number (partially masked for security)",
                "originalAmountOwed": "Original amount owed before collection fees",
                "creditorClassification": "Classification of the creditor type",
                "amount": "Current collection amount owed",
                "lastPaymentDate": "Date of last payment made on the collection",
                "statusDate": "Date of the current collection status",
                "dateOfFirstDelinquency": "Date when the account first became delinquent",
                "status": "Current status of the collection account",
                "comments": "Comments about the collection account from the agency",
                "contact": "Contact information for the collection agency",
            },
        },
        "publicRecords": {
            "records": [],
            "publicRecordCount": 0,
            "status": "",
        },
        "inquiries": {
            "hardInquiries": [],
            "softInquiries": [],
            "hardInquiryCount": 0,
            "softInquiryCount": 0,
        },
    }


def ensure_list_of_strings(value: Any) -> List[str]:
    if isinstance(value, list):
        return [normalize_spaces(str(item)) for item in value if normalize_spaces(str(item))]
    if isinstance(value, str):
        tokenized = re.split(r"\n|;|\|", value)
        return [normalize_spaces(item) for item in tokenized if normalize_spaces(item)]
    return []


def create_month_row_template() -> Dict[str, str]:
    row = {"year": "-"}
    for month in ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]:
        row[month] = "-"
    return row


def normalize_monthly_history_rows(value: Any) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    if isinstance(value, list):
        for row in value:
            normalized_row = create_month_row_template()
            if isinstance(row, dict):
                normalized_row["year"] = normalize_spaces(str(row.get("year", "-"))) or "-"
                for month in ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]:
                    normalized_row[month] = normalize_spaces(str(row.get(month, "-"))) or "-"
            if normalized_row["year"] != "-" or any(normalized_row[month] != "-" for month in ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]):
                rows.append(normalized_row)

    return rows


def normalize_payment_history(value: Any) -> List[str]:
    return normalize_payment_history_values(value)


ACCOUNT_COMMENT_NARRATIVE_PATTERNS = (
    r"^the tables below show up to \d+ (?:years?|months?)\b",
    r"^view up to \d+ years? of monthly payment history on this account\b",
    r"^your debt-to-credit ratio represents\b",
)


def is_meaningful_account_comment_text(value: str) -> bool:
    clean = normalize_spaces(value)
    if not clean or clean.lower() == "not reported":
        return False
    return not any(re.search(pattern, clean, re.IGNORECASE) for pattern in ACCOUNT_COMMENT_NARRATIVE_PATTERNS)


EQUIFAX_NEW_HISTORY_FIELD_ALIASES = {
    "paymentHistory": "paymentHistory",
    "month24:balance": "balanceHistory",
    "month24:paymentAmount": "actualPaymentHistory",
    "month24:pastDueAmount": "amountPastDueHistory",
    "month24:highCredit": "highCreditHistory",
    "month24:creditLimit": "creditLimitHistory",
    "month24:lastPaymentDate": "lastPaymentDateHistory",
    "month24:narrativeCodes": "narrativeCodesHistory",
}


def remap_equifax_new_history_fields(accounts: Any) -> List[Dict[str, Any]]:
    """Non-mutating view of eq-new accounts whose _historyEvidence keys use the
    canonical history-field names (balanceHistory, actualPaymentHistory, ...) so the
    shared evidence collector emits fields/provenance ids the dispute layer already
    understands. Additive only — the source account dicts are never modified."""
    remapped: List[Dict[str, Any]] = []
    for account in accounts if isinstance(accounts, list) else []:
        if not isinstance(account, dict):
            remapped.append(account)
            continue
        evidence = account.get("_historyEvidence")
        if not isinstance(evidence, dict) or not evidence:
            remapped.append(account)
            continue
        renamed = {
            EQUIFAX_NEW_HISTORY_FIELD_ALIASES.get(field, field): rows
            for field, rows in evidence.items()
        }
        clone = dict(account)
        clone["_historyEvidence"] = renamed
        remapped.append(clone)
    return remapped


def collect_account_history_evidence(accounts: Any) -> List[Dict[str, Any]]:
    evidence_items: List[Dict[str, Any]] = []
    if not isinstance(accounts, list):
        return evidence_items

    for account in accounts:
        if not isinstance(account, dict):
            evidence_items.append({})
            continue
        raw_evidence = account.get("_historyEvidence")
        if not isinstance(raw_evidence, dict) or not raw_evidence:
            evidence_items.append({})
            continue
        account_name = account_name_for_evidence(account)
        account_number = account_number_for_evidence(account)
        fields: Dict[str, List[Dict[str, Any]]] = {}
        for field_name, rows in raw_evidence.items():
            if not isinstance(rows, list) or not rows:
                continue
            normalized_rows: List[Dict[str, Any]] = []
            for row in rows:
                if not isinstance(row, dict):
                    continue
                months = row.get("months") or {}
                normalized_months: Dict[str, Any] = {}
                if isinstance(months, dict):
                    for month, cell in months.items():
                        if not isinstance(cell, dict):
                            continue
                        bbox = cell.get("bbox")
                        if not bbox:
                            normalized_months[month] = cell
                            continue
                        normalized_months[month] = {
                            **cell,
                            "id": cell.get("id")
                            or make_account_history_provenance_id(account_name, account_number, str(field_name), str(cell.get("year") or row.get("year") or ""), str(month)),
                            "pdfBBox": cell.get("pdfBBox") or bbox,
                        }
                normalized_rows.append({
                    **row,
                    "field": field_name,
                    "months": normalized_months,
                })
            if normalized_rows:
                fields[field_name] = normalized_rows
        evidence_items.append(
            {
                "accountName": account_name,
                "accountNumber": account_number,
                "fields": fields,
            }
        )
    return evidence_items


def account_name_for_evidence(account: Dict[str, Any]) -> str:
    if not isinstance(account, dict):
        return ""
    header = account.get("header") if isinstance(account.get("header"), dict) else {}
    account_info = account.get("accountInfo") if isinstance(account.get("accountInfo"), dict) else {}
    return normalize_spaces(
        str(
            account.get("accountName")
            or header.get("accountName")
            or account_info.get("accountName")
            or ""
        )
    )


def account_number_for_evidence(account: Dict[str, Any]) -> str:
    if not isinstance(account, dict):
        return ""
    header = account.get("header") if isinstance(account.get("header"), dict) else {}
    account_info = account.get("accountInfo") if isinstance(account.get("accountInfo"), dict) else {}
    return clean_masked_account_number(
        str(
            account.get("accountNumber")
            or header.get("accountNumber")
            or account_info.get("accountNumber")
            or ""
        )
    )


def account_pages_for_evidence(account: Dict[str, Any], fallback_pages: List[int]) -> List[int]:
    raw_pages = (
        list(account.get("_sourcePages") or [])
        or list(account.get("sourcePages") or [])
        or fallback_pages
    )
    return [
        int(page)
        for page in unique_preserve_order(raw_pages)
        if isinstance(page, int) and page > 0
    ]


def make_account_field_provenance_id(account_name: str, account_number: str, field_name: str) -> str:
    return (
        f"account:{normalize_spaces(account_name).lower()}::"
        f"{clean_masked_account_number(account_number)}:field:{normalize_spaces(field_name)}"
    )


def make_account_history_provenance_id(account_name: str, account_number: str, field_name: str, year: str, month: str) -> str:
    return (
        f"account:{normalize_spaces(account_name).lower()}::"
        f"{clean_masked_account_number(account_number)}:history:{normalize_spaces(field_name)}:{normalize_spaces(year)}:{normalize_spaces(month).lower()}"
    )


def collect_account_field_evidence(accounts: Any) -> List[Dict[str, Any]]:
    evidence_items: List[Dict[str, Any]] = []
    if not isinstance(accounts, list):
        return evidence_items

    for account in accounts:
        if not isinstance(account, dict):
            evidence_items.append({})
            continue
        raw_evidence = account.get("_fieldEvidence")
        if not isinstance(raw_evidence, dict) or not raw_evidence:
            evidence_items.append({})
            continue

        account_name = account_name_for_evidence(account)
        account_number = account_number_for_evidence(account)
        fields: Dict[str, Any] = {}
        for field_name, detail in raw_evidence.items():
            if not isinstance(detail, dict):
                continue
            bbox = detail.get("bbox")
            page_number = int(detail.get("pageNumber") or 0)
            if not bbox or page_number <= 0:
                continue
            fields[field_name] = {
                **detail,
                "field": field_name,
                "id": detail.get("id")
                or make_account_field_provenance_id(account_name, account_number, str(field_name)),
                "pdfBBox": detail.get("pdfBBox") or bbox,
            }

        evidence_items.append(
            {
                "accountName": account_name,
                "accountNumber": account_number,
                "fields": fields,
            }
        )
    return evidence_items


def collect_account_source_metadata(accounts: Any, default_pages: Optional[List[int]] = None) -> List[Dict[str, Any]]:
    source_items: List[Dict[str, Any]] = []
    if not isinstance(accounts, list):
        return source_items

    fallback_pages = [
        int(page)
        for page in unique_preserve_order(default_pages or [])
        if isinstance(page, int) and page > 0
    ]

    for account in accounts:
        if not isinstance(account, dict):
            source_items.append({})
            continue
        pages = account_pages_for_evidence(account, fallback_pages)
        source_items.append(
            {
                "accountName": account_name_for_evidence(account),
                "accountNumber": account_number_for_evidence(account),
                "pages": pages,
            }
        )
    return source_items


def collect_collection_source_metadata(collections: Any, default_pages: Optional[List[int]] = None) -> List[Dict[str, Any]]:
    source_items: List[Dict[str, Any]] = []
    if not isinstance(collections, list):
        return source_items

    fallback_pages = [
        int(page)
        for page in unique_preserve_order(default_pages or [])
        if isinstance(page, int) and page > 0
    ]

    for collection in collections:
        if not isinstance(collection, dict):
            source_items.append({})
            continue
        pages = [
            int(page)
            for page in unique_preserve_order(list(collection.get("_sourcePages") or []))
            if isinstance(page, int) and page > 0
        ]
        if not pages:
            pages = fallback_pages
        source_items.append(
            {
                "collectionAgency": normalize_spaces(str(collection.get("collectionAgency") or "")),
                "accountNumber": clean_masked_account_number(str(collection.get("accountNumber") or "")),
                "originalCreditorName": normalize_spaces(str(collection.get("originalCreditorName") or "")),
                "pages": pages,
            }
        )
    return source_items


def collect_inquiry_evidence(inquiries_component: Any) -> Dict[str, List[Dict[str, Any]]]:
    result = {
        "hardInquiries": [],
        "softInquiries": [],
    }
    if not isinstance(inquiries_component, dict):
        return result

    for list_name in ["hardInquiries", "softInquiries"]:
        entries = inquiries_component.get(list_name) or []
        if not isinstance(entries, list):
            continue
        for entry in entries:
            if not isinstance(entry, dict):
                result[list_name].append({})
                continue
            pages = [
                int(page)
                for page in unique_preserve_order(list(entry.get("_evidencePages") or []))
                if isinstance(page, int) and page > 0
            ]
            result[list_name].append(
                {
                    "subscriberName": normalize_spaces(str(entry.get("subscriberName") or "")),
                    "inquiryDate": normalize_spaces(str(entry.get("inquiryDate") or "")),
                    "contact": normalize_spaces(str(entry.get("contact") or "")) if entry.get("contact") else None,
                    "pages": pages,
                }
            )
    return result


def normalize_credit_accounts_summary_rows(
    rows: Any,
) -> List[Dict[str, Any]]:
    empty_row = {
        "accountType": None,
        "totalAccounts": None,
        "open": None,
        "closed": None,
        "balance": None,
        "withBalance": None,
        "totalBalance": None,
        "available": None,
        "creditLimit": None,
        "debtToCredit": None,
        "payment": None,
    }
    by_type: Dict[str, Dict[str, Any]] = {}

    if isinstance(rows, list):
        for row in rows:
            if not isinstance(row, dict):
                continue
            account_type = normalize_spaces(str(row.get("accountType", "")))
            if account_type not in REQUIRED_ACCOUNT_TYPES:
                continue

            normalized = empty_row.copy()
            normalized["accountType"] = account_type
            for key in normalized.keys():
                if key == "accountType":
                    continue
                value = row.get(key)
                normalized[key] = value if value not in ("", []) else None
            by_type[account_type] = normalized

    normalized_rows: List[Dict[str, Any]] = []
    for account_type in REQUIRED_ACCOUNT_TYPES:
        source_row = by_type.get(account_type)
        if source_row:
            normalized_rows.append(source_row)
        else:
            row = empty_row.copy()
            row["accountType"] = account_type
            normalized_rows.append(row)

    return normalized_rows


def normalize_account_to_contract(account: Any) -> Dict[str, Any]:
    if not isinstance(account, dict):
        return create_default_account()

    normalized = create_default_account(
        normalize_spaces(str(account.get("accountName", "Sample Account"))) or "Sample Account",
        clean_masked_account_number(str(account.get("accountNumber", "Not reported"))) or "Not reported",
    )
    normalized["isClosed"] = bool(account.get("isClosed"))

    passthrough_fields = [
        "accountType",
        "accountCategory",
        "accountOwnership",
        "openDate",
        "status",
        "balance",
        "creditLimit",
        "highestBalance",
        "highCredit",
        "paymentStatus",
        "dateOpened",
        "dateReported",
        "dateClosed",
        "lastPaymentDate",
        "dateOfLastActivity",
        "dateOfFirstDelinquency",
        "delinquencyFirstReported",
        "deferredPaymentStartDate",
        "balloonPaymentDate",
        "currentBalance",
        "paymentAmount",
        "actualPaymentAmount",
        "scheduledPaymentAmount",
        "amountPastDue",
        "chargeOffAmount",
        "balloonPaymentAmount",
        "creditType",
        "loanType",
        "responsibility",
        "paymentResponsibility",
        "termsFrequency",
        "termDuration",
        "monthsReviewed",
        "activityDesignator",
        "creditorClassification",
        "accountStatus",
    ]
    for field in passthrough_fields:
        value = account.get(field)
        if value not in (None, "", []):
            normalized[field] = normalize_account_scalar_value(field, value)

    normalized["balanceHistory"] = normalize_monthly_history_rows(account.get("balanceHistory"))
    normalized["scheduledPaymentHistory"] = normalize_monthly_history_rows(account.get("scheduledPaymentHistory"))
    normalized["actualPaymentHistory"] = normalize_monthly_history_rows(account.get("actualPaymentHistory"))
    normalized["creditLimitHistory"] = normalize_monthly_history_rows(account.get("creditLimitHistory"))
    normalized["amountPastDueHistory"] = normalize_monthly_history_rows(account.get("amountPastDueHistory"))
    normalized["activityDesignatorHistory"] = normalize_monthly_history_rows(account.get("activityDesignatorHistory"))
    normalized["paymentHistory"] = normalize_payment_history(account.get("paymentHistory"))
    normalized["additionalInformation"] = ensure_list_of_strings(account.get("additionalInformation"))

    comments = [
        comment
        for comment in ensure_list_of_strings(account.get("comments"))
        if is_meaningful_account_comment_text(comment)
    ]
    normalized["comments"] = comments if comments else ["Not reported"]
    normalized["contact"] = ensure_list_of_strings(account.get("contact"))
    normalized["paymentStatusCodes"] = STATUS_CODES.copy()

    date_closed = normalize_spaces(str(normalized.get("dateClosed", "")))
    status_value = normalize_spaces(str(normalized.get("status", ""))).lower()
    account_status_value = normalize_spaces(str(normalized.get("accountStatus", ""))).lower()
    normalized["isClosed"] = bool(
        normalized.get("isClosed")
        or (date_closed and date_closed.lower() != "not reported")
        or "closed" in status_value
        or "closed" in account_status_value
    )

    for counter_field in ["totalAccounts", "openAccounts", "closedAccounts"]:
        raw = account.get(counter_field)
        if isinstance(raw, int):
            normalized[counter_field] = raw
        else:
            parsed = parse_integer(str(raw)) if raw not in (None, "") else None
            normalized[counter_field] = parsed if parsed is not None else 0

    return normalized


def normalize_collection_to_contract(collection: Any) -> Dict[str, Any]:
    if not isinstance(collection, dict):
        return create_default_collection()

    normalized = create_default_collection()
    for key in normalized.keys():
        value = collection.get(key)
        if key in {"comments", "contact"}:
            normalized[key] = ensure_list_of_strings(value)
        elif key == "accountNumber" and value not in (None, "", []):
            normalized[key] = clean_masked_account_number(str(value))
        elif value not in (None, "", []):
            normalized[key] = normalize_spaces(str(value))
    return normalized


def normalize_public_record_to_contract(record: Any) -> Dict[str, Any]:
    if not isinstance(record, dict):
        return create_default_public_record()

    normalized = create_default_public_record()
    for key in normalized.keys():
        value = record.get(key)
        if key == "details":
            normalized[key] = ensure_list_of_strings(value)
        elif key == "sourcePages":
            normalized[key] = [
                page
                for page in (value if isinstance(value, list) else [])
                if isinstance(page, int) and page > 0
            ]
        elif value not in (None, "", []):
            normalized[key] = normalize_spaces(str(value))
    return normalized


def normalize_inquiry_entry(entry: Any) -> Dict[str, Any]:
    if not isinstance(entry, dict):
        return {
            "subscriberName": None,
            "inquiryDate": None,
            "purpose": None,
            "permissiblePurpose": None,
            "contact": None,
            "referenceNumber": None,
        }

    return {
        "subscriberName": normalize_spaces(str(entry.get("subscriberName"))) if entry.get("subscriberName") else None,
        "inquiryDate": normalize_spaces(str(entry.get("inquiryDate"))) if entry.get("inquiryDate") else None,
        "purpose": normalize_spaces(str(entry.get("purpose"))) if entry.get("purpose") else None,
        "permissiblePurpose": normalize_spaces(str(entry.get("permissiblePurpose"))) if entry.get("permissiblePurpose") else None,
        "contact": normalize_spaces(str(entry.get("contact"))) if entry.get("contact") else None,
        "referenceNumber": normalize_spaces(str(entry.get("referenceNumber"))) if entry.get("referenceNumber") else None,
    }


def normalize_components_to_contract(components: Dict[str, Any]) -> Dict[str, Any]:
    defaults = create_default_components()

    confirmation = defaults["reportConfirmationDetails"].copy()
    confirmation_source = components.get("reportConfirmationDetails") if isinstance(components, dict) else None
    if isinstance(confirmation_source, dict):
        confirmation["consumerName"] = normalize_spaces(str(confirmation_source.get("consumerName", "")))
        confirmation["confirmationNumber"] = normalize_spaces(str(confirmation_source.get("confirmationNumber", "")))
        confirmation["reportDate"] = normalize_spaces(str(confirmation_source.get("reportDate", "")))

    personal = defaults["personalInformation"].copy()
    personal_source = components.get("personalInformation") if isinstance(components, dict) else None
    if isinstance(personal_source, dict):
        personal["name"] = normalize_spaces(str(personal_source.get("name", "")))
        personal["addresses"] = ensure_list_of_strings(personal_source.get("addresses"))
        personal["socialSecurityNumber"] = normalize_spaces(str(personal_source.get("socialSecurityNumber", "")))
        personal["dateOfBirth"] = normalize_spaces(str(personal_source.get("dateOfBirth", "")))
        personal["employmentHistory"] = normalize_spaces(str(personal_source.get("employmentHistory", "")))
        personal["currentAddresses"] = ensure_list_of_strings(personal_source.get("currentAddresses"))
        personal["previousAddresses"] = ensure_list_of_strings(personal_source.get("previousAddresses"))

    summary = defaults["summary"].copy()
    summary_source = components.get("summary") if isinstance(components, dict) else None
    if isinstance(summary_source, dict):
        for key in summary.keys():
            if key in {"oldestAccount", "recentAccount"}:
                value = summary_source.get(key)
                if isinstance(value, dict):
                    summary[key] = {
                        "accountName": normalize_spaces(str(value.get("accountName", ""))) or None,
                        "openDate": normalize_spaces(str(value.get("openDate", ""))) or None,
                    }
                else:
                    summary[key] = None
            else:
                value = summary_source.get(key)
                if value in (None, ""):
                    summary[key] = None
                elif key == "accountsWithNegativeInfo":
                    parsed = parse_integer(str(value))
                    summary[key] = parsed if parsed is not None else None
                else:
                    summary[key] = normalize_spaces(str(value))

    other_items = defaults["otherItemsSummary"].copy()
    other_source = components.get("otherItemsSummary") if isinstance(components, dict) else None
    if isinstance(other_source, dict):
        other_items["inquiries"] = parse_integer(str(other_source.get("inquiries"))) or 0
        other_items["publicRecords"] = parse_integer(str(other_source.get("publicRecords"))) or 0
        other_items["collections"] = ensure_list_of_strings(other_source.get("collections"))
        other_items["statementCount"] = parse_integer(str(other_source.get("statementCount"))) or 0
        other_items["personalInfoItemCount"] = parse_integer(str(other_source.get("personalInfoItemCount"))) or 0
        other_items["recentInquiry"] = normalize_spaces(str(other_source.get("recentInquiry"))) if other_source.get("recentInquiry") else None
        other_items["inquiryCount"] = parse_integer(str(other_source.get("inquiryCount"))) or 0
        other_items["publicRecordCount"] = parse_integer(str(other_source.get("publicRecordCount"))) or 0
        other_items["collectionCount"] = parse_integer(str(other_source.get("collectionCount"))) or 0

    accounts_source = components.get("accounts") if isinstance(components, dict) else None
    account_list_raw = accounts_source.get("accounts") if isinstance(accounts_source, dict) else []
    normalized_accounts = [normalize_account_to_contract(account) for account in (account_list_raw or [])]
    for account in normalized_accounts:
        account["totalAccounts"] = len(normalized_accounts)
        account["openAccounts"] = sum(
            1
            for item in normalized_accounts
            if re.search(r"open", str(item.get("status", "")), re.IGNORECASE)
        )
        account["closedAccounts"] = sum(
            1
            for item in normalized_accounts
            if re.search(r"closed", str(item.get("status", "")), re.IGNORECASE)
        )

    collections_source = components.get("collections") if isinstance(components, dict) else None
    collection_list_raw = collections_source.get("collections") if isinstance(collections_source, dict) else []
    normalized_collections = [normalize_collection_to_contract(item) for item in (collection_list_raw or [])]

    public_records_source = components.get("publicRecords") if isinstance(components, dict) else None
    public_record_list_raw = public_records_source.get("records") if isinstance(public_records_source, dict) else []
    normalized_public_records = [normalize_public_record_to_contract(item) for item in (public_record_list_raw or [])]

    inquiries_source = components.get("inquiries") if isinstance(components, dict) else None
    hard_raw = inquiries_source.get("hardInquiries") if isinstance(inquiries_source, dict) else []
    soft_raw = inquiries_source.get("softInquiries") if isinstance(inquiries_source, dict) else []
    hard_inquiries = [normalize_inquiry_entry(entry) for entry in (hard_raw or [])]
    soft_inquiries = [normalize_inquiry_entry(entry) for entry in (soft_raw or [])]

    return {
        "reportConfirmationDetails": confirmation,
        "personalInformation": personal,
        "summary": summary,
        "creditAccountsSummary": normalize_credit_accounts_summary_rows(components.get("creditAccountsSummary")),
        "otherItemsSummary": other_items,
        "accounts": {
            "accounts": normalized_accounts,
        },
        "collections": {
            "collections": normalized_collections,
            "collectionCount": len(normalized_collections),
            "collectionFields": defaults["collections"]["collectionFields"],
        },
        "publicRecords": {
            "records": normalized_public_records,
            "publicRecordCount": len(normalized_public_records),
            "status": normalize_spaces(str((public_records_source or {}).get("status", ""))) if isinstance(public_records_source, dict) else "",
        },
        "inquiries": {
            "hardInquiries": hard_inquiries,
            "softInquiries": soft_inquiries,
            "hardInquiryCount": len(hard_inquiries),
            "softInquiryCount": len(soft_inquiries),
        },
    }


def extract_report_confirmation(text: str) -> Dict[str, Any]:
    month_date_pattern = r"(?:[A-Za-z]{3,9}\s+\d{1,2},\s+\d{4}|\d{1,2}/\d{1,2}/\d{2,4})"

    consumer_name = extract_first(
        [
            r"consumer\s+name\s*:?\s*([^\n]+)",
            r"name\s*:?\s*([^\n]+)",
        ],
        text,
    )
    if not consumer_name:
        for line in text.splitlines()[:30]:
            candidate = normalize_spaces(line)
            if len(candidate) < 5 or len(candidate) > 80:
                continue
            if not re.fullmatch(r"[A-Z][A-Z\s\.\-']{4,}", candidate):
                continue
            if re.search(
                r"\b(credit report|report confirmation|dear|summary|equifax|page|accounts?)\b",
                candidate,
                re.IGNORECASE,
            ):
                continue
            consumer_name = candidate
            break

    confirmation_number = extract_first(
        [
            r"report\s+confirmation(?:\s+number)?\s*[:#]?\s*([A-Z0-9\-]{6,})",
            r"report\s+confirmation(?:\s+number)?\s*\n+\s*([A-Z0-9\-]{6,})",
            r"confirmation\s+number\s*:?\s*#?([A-Z0-9\-]{6,})",
            r"confirmation\s*#\s*:?\s*([A-Z0-9\-]{6,})",
        ],
        text,
    )

    report_date = extract_first(
        [
            rf"report\s+date\s*:?\s*({month_date_pattern})",
            rf"date\s+issued\s*:?\s*({month_date_pattern})",
            rf"as\s+of\s*:?\s*({month_date_pattern})",
            rf"\|\s*({month_date_pattern})\s*\|\s*page\s+\d+\s+of\s+\d+",
        ],
        text,
    )

    return {
        "consumerName": consumer_name or "",
        "confirmationNumber": confirmation_number or "",
        "reportDate": report_date or "",
    }


def extract_personal_information(text: str) -> Dict[str, Any]:
    name = extract_first(
        [
            r"consumer\s+name\s*:?\s*([^\n]+)",
            r"name\s*:?\s*([^\n]{3,80})",
        ],
        text,
    ) or ""

    ssn = extract_first(
        [
            r"social\s+security\s+number\s*:?\s*([Xx\*\d\-\s]{9,20})",
            r"ssn\s*:?\s*([Xx\*\d\-\s]{9,20})",
        ],
        text,
    ) or ""

    dob = extract_first(
        [
            r"date\s+of\s+birth\s*:?\s*(\d{1,2}/\d{1,2}/\d{2,4})",
            r"(?:age\s+or\s+)?date\s+of\s+birth\s*:?\s*([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})",
            r"dob\s*:?\s*(\d{1,2}/\d{1,2}/\d{2,4})",
        ],
        text,
    ) or ""

    addresses = []
    for line in text.splitlines():
        normalized = normalize_spaces(line)
        if len(normalized) < 8:
            continue
        if re.search(r"\d+\s+.+\b(?:ST|AVE|BLVD|RD|DR|LN|CT|WAY|PL)\b", normalized, re.IGNORECASE):
            addresses.append(normalized)

    seen_addresses = []
    seen_set = set()
    for address in addresses:
        lowered = address.lower()
        if lowered in seen_set:
            continue
        seen_set.add(lowered)
        seen_addresses.append(address)

    current_addresses = [addr for addr in seen_addresses if re.search(r"\bcurrent\b", addr, re.IGNORECASE)]
    previous_addresses = [
        addr for addr in seen_addresses if re.search(r"\b(former|previous)\b", addr, re.IGNORECASE)
    ]

    employment_history = extract_first(
        [
            r"employment\s+history\s*:?\s*([^\n]+)",
            r"employer\s*:?\s*([^\n]+)",
        ],
        text,
    ) or ""
    employment_history = normalize_spaces(employment_history)
    lowered_employment_history = employment_history.lower()
    if (
        not employment_history
        or lowered_employment_history.startswith("employment history is the information")
        or lowered_employment_history.startswith("7. personal information")
        or "creditors use your personal information primarily to identify you" in lowered_employment_history
        or "social security number |" in lowered_employment_history
        or "age or date of birth |" in lowered_employment_history
        or "contact information is the information in your credit file" in lowered_employment_history
    ):
        employment_history = ""

    return {
        "name": name,
        "addresses": seen_addresses,
        "socialSecurityNumber": ssn,
        "dateOfBirth": dob,
        "employmentHistory": employment_history,
        "currentAddresses": current_addresses,
        "previousAddresses": previous_addresses,
    }


def extract_personal_information_from_layout(
    page_artifacts: List[PageArtifact],
    page_numbers: List[int],
) -> Dict[str, Any]:
    page_number_set = {int(page) for page in page_numbers if int(page) > 0}
    relevant_pages = [
        artifact
        for artifact in page_artifacts
        if artifact.page_number in page_number_set
    ]
    relevant_pages.sort(key=lambda artifact: artifact.page_number)

    personal = {
        "name": "",
        "addresses": [],
        "socialSecurityNumber": "",
        "dateOfBirth": "",
        "employmentHistory": "",
        "currentAddresses": [],
        "previousAddresses": [],
    }
    if not relevant_pages:
        return personal

    all_addresses: List[str] = []
    current_addresses: List[str] = []
    previous_addresses: List[str] = []
    seen_addresses: Set[str] = set()
    employment_entries: List[str] = []

    def add_address(bucket: List[str], address: str) -> None:
        cleaned = normalize_spaces(address)
        if not cleaned:
            return
        lowered = cleaned.lower()
        if lowered not in seen_addresses:
            seen_addresses.add(lowered)
            all_addresses.append(cleaned)
        if cleaned not in bucket:
            bucket.append(cleaned)

    def add_employment_entry(value: str) -> None:
        cleaned = normalize_spaces(value)
        if not cleaned:
            return
        lowered = cleaned.lower()
        if lowered.startswith("employment history is the information"):
            return
        if re.search(r"\|\s*page\s+\d+\s+of\s+\d+", lowered):
            return
        if cleaned not in employment_entries:
            employment_entries.append(cleaned)

    def add_address_by_status(address: str, status: str) -> None:
        normalized_status = normalize_spaces(status).lower()
        if normalized_status == "current":
            add_address(current_addresses, address)
        elif normalized_status in {"former", "previous"}:
            add_address(previous_addresses, address)
        else:
            add_address(all_addresses, address)

    def parse_address_row_text(text: str) -> Optional[Tuple[str, str]]:
        match = re.match(
            r"^(.*?)\s+\|\s+(current|former|previous)\s+\|\s+"
            r"([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4}|\d{1,2}/\d{1,2}/\d{2,4})$",
            text,
            flags=re.IGNORECASE,
        )
        if not match:
            return None
        return normalize_spaces(match.group(1)), normalize_spaces(match.group(2))

    employment_section_active = False
    employment_header_seen = False
    address_section_active = False

    for artifact in relevant_pages:
        for item in artifact.layout_items:
            text = normalize_spaces(str(item.get("text") or ""))
            if not text:
                continue
            if not personal["name"]:
                name_match = re.match(r"^name\s*\|\s*(.+)$", text, re.IGNORECASE)
                if name_match:
                    personal["name"] = normalize_spaces(name_match.group(1))

        for table in artifact.layout_tables:
            rows = table.get("rows") or []
            normalized_rows = [
                [normalize_table_cell(cell) for cell in row]
                for row in rows
                if any(normalize_table_cell(cell) for cell in row)
            ]
            if not normalized_rows:
                continue

            header = [normalize_pair_label(cell) for cell in normalized_rows[0]]

            if header[:2] == ["social security number", "xxxxx 8617"]:
                # Defensive no-op for malformed title tables; handled below by row iteration.
                pass

            if any("social security number" == (normalize_pair_label(row[0]) if row else "") for row in normalized_rows):
                for row in normalized_rows:
                    if len(row) < 2:
                        continue
                    label = normalize_pair_label(row[0])
                    value = normalize_spaces(row[1])
                    if label == "social security number" and value and not personal["socialSecurityNumber"]:
                        personal["socialSecurityNumber"] = value
                    elif label in {"age or date of birth", "date of birth"} and value and not personal["dateOfBirth"]:
                        personal["dateOfBirth"] = value
                continue

            is_address_table = (
                len(header) >= 3
                and header[0] == "address"
                and header[1] == "status"
            )
            is_address_continuation = (
                all(
                    len(row) >= 3 and normalize_spaces(row[1]).lower() in {"current", "former", "previous"}
                    for row in normalized_rows
                )
            )
            if is_address_table or is_address_continuation:
                address_section_active = True
                address_rows = normalized_rows[1:] if is_address_table else normalized_rows
                for row in address_rows:
                    if len(row) < 2:
                        continue
                    address = normalize_spaces(row[0])
                    status = normalize_spaces(row[1]).lower()
                    if not address:
                        continue
                    add_address_by_status(address, status)
                continue

            if len(header) >= 2 and header[0] == "company" and header[1] == "occupation":
                for row in normalized_rows[1:]:
                    values = [normalize_spaces(cell) for cell in row if normalize_spaces(cell)]
                    if values:
                        add_employment_entry(" | ".join(values))
                continue

        for row in artifact.layout_rows:
            text = normalize_spaces(str(row.get("text") or ""))
            if not text:
                continue
            lowered = text.lower()
            if lowered == "employment history":
                employment_section_active = True
                employment_header_seen = False
                address_section_active = False
                continue
            if lowered == "contact information":
                address_section_active = True
                employment_section_active = False
                employment_header_seen = False
                continue
            if re.search(r"\|\s*page\s+\d+\s+of\s+\d+", lowered):
                continue
            if is_numbered_section_row_text(text) and not PERSONAL_INFORMATION_SECTION_PATTERN.match(text):
                employment_section_active = False
                employment_header_seen = False
                address_section_active = False
                break
            if lowered in {
                "identification",
                "other identification",
                "alert contact information",
            }:
                address_section_active = False
                if lowered != "identification":
                    employment_section_active = False
                    employment_header_seen = False
                continue
            if address_section_active:
                parsed_address = parse_address_row_text(text)
                if parsed_address:
                    add_address_by_status(parsed_address[0], parsed_address[1])
                    continue
            if not employment_section_active:
                continue
            if lowered.startswith("employment history is the information"):
                continue
            if lowered in {"company | occupation", "company occupation"}:
                employment_header_seen = True
                continue
            if lowered == "contact information":
                employment_section_active = False
                employment_header_seen = False
                address_section_active = True
                continue
            if employment_header_seen:
                add_employment_entry(text)

    if current_addresses or previous_addresses:
        combined_addresses = current_addresses + [addr for addr in previous_addresses if addr not in current_addresses]
    else:
        combined_addresses = all_addresses

    personal["addresses"] = combined_addresses
    personal["currentAddresses"] = current_addresses
    personal["previousAddresses"] = previous_addresses
    personal["employmentHistory"] = "\n".join(employment_entries)

    return personal


def extract_summary(text: str) -> Dict[str, Any]:
    def parse_account_entry(label: str) -> Tuple[Optional[str], Optional[str]]:
        raw = extract_first([rf"{label}\s+account\s*:?\s*([^\n]+)"], text)
        if not raw:
            return None, None

        open_date = None
        open_match = re.search(
            r"\(Opened\s+([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4}|\d{1,2}/\d{1,2}/\d{2,4})\)",
            raw,
            flags=re.IGNORECASE,
        )
        if open_match:
            open_date = normalize_spaces(open_match.group(1))
            raw = re.sub(r"\(Opened\s+[^)]+\)", "", raw, flags=re.IGNORECASE)
        if not open_date:
            open_date = extract_first(
                [rf"{label}\s+account[^\n]*opened\s*([A-Za-z]{{3,9}}\s+\d{{1,2}},\s+\d{{4}}|\d{{1,2}}/\d{{1,2}}/\d{{2,4}})"],
                text,
            )
        return normalize_spaces(raw), open_date

    oldest_account_name, oldest_account_open = parse_account_entry("oldest")
    recent_account_name, recent_account_open = parse_account_entry("recent")
    negative_info = extract_first(
        [r"accounts\s+with\s+negative\s+info(?:rmation)?\s*:?\s*(\d+)"],
        text,
    )

    return {
        "reportDate": extract_first(
            [r"report\s+date\s*:?\s*([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4}|\d{1,2}/\d{1,2}/\d{2,4})"],
            text,
        ),
        "creditFileStatus": extract_first([r"credit\s+file\s+status\s*:?\s*([^\n]+)"], text),
        "alertContacts": extract_first([r"alert\s+contacts?\s*:?\s*([^\n]+)"], text),
        "averageAccountAge": extract_first([r"average\s+account\s+age\s*:?\s*([^\n]+)"], text),
        "lengthOfCreditHistory": extract_first([r"length\s+of\s+credit\s+history\s*:?\s*([^\n]+)"], text),
        "accountsWithNegativeInfo": negative_info,
        "oldestAccount": (
            {"accountName": oldest_account_name, "openDate": oldest_account_open}
            if oldest_account_name
            else None
        ),
        "recentAccount": (
            {"accountName": recent_account_name, "openDate": recent_account_open}
            if recent_account_name
            else None
        ),
}


def merge_missing_fields(base: Any, fallback: Any) -> Any:
    if isinstance(base, dict) and isinstance(fallback, dict):
        merged = dict(base)
        for key, value in fallback.items():
            if key not in merged:
                merged[key] = value
                continue
            if isinstance(merged[key], dict) and isinstance(value, dict):
                merged[key] = merge_missing_fields(merged[key], value)
                continue
            if merged[key] in (None, "", [], {}):
                merged[key] = value
        return merged
    return base if base not in (None, "", [], {}) else fallback


def base_summary_row(account_type: str) -> Dict[str, Any]:
    return {
        "accountType": account_type,
        "totalAccounts": None,
        "open": None,
        "closed": None,
        "balance": None,
        "withBalance": None,
        "totalBalance": None,
        "available": None,
        "creditLimit": None,
        "debtToCredit": None,
        "payment": None,
    }


def effective_table_title(table: Dict[str, Any]) -> str:
    title = normalize_spaces(str(table.get("title") or ""))
    if title:
        return title
    heading_trail = [
        normalize_spaces(str(heading))
        for heading in (table.get("headingTrail") or [])
        if normalize_spaces(str(heading))
    ]
    filtered = [
        heading
        for heading in heading_trail
        if not re.match(r"^\d+(?:\.\d+)?\s+", heading)
        and heading.lower() not in {"summary", "account history"}
    ]
    return filtered[-1] if filtered else ""


def structured_credit_summary_candidate_score(table: Dict[str, Any]) -> int:
    rows = table.get("rows") or []
    if len(rows) < 2:
        return -1
    header = [normalize_table_cell(cell).lower() for cell in rows[0]]
    score = 0
    if any("account type" in cell for cell in header):
        score += 4
    if any("with balance" in cell for cell in header):
        score += 2
    if any("credit limit" in cell for cell in header):
        score += 1
    score += sum(
        1
        for row in rows[1:]
        if normalize_table_cell(row[0] if row else "").title() in REQUIRED_ACCOUNT_TYPES
    )
    return score


def extract_credit_accounts_summary_from_tables(
    structured_tables: List[Dict[str, Any]],
    ollama: Optional[OllamaClient] = None,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    candidate = None
    best_score = -1
    for table in structured_tables:
        score = structured_credit_summary_candidate_score(table)
        if score > best_score:
            best_score = score
            candidate = table

    if not candidate or best_score < 4:
        return [], []

    rows = candidate.get("rows") or []
    header = [normalize_table_cell(cell).lower() for cell in rows[0]]
    index_by_header: Dict[str, int] = {}
    for idx, cell in enumerate(header):
        if "account type" in cell:
            index_by_header["accountType"] = idx
        elif cell == "open":
            index_by_header["open"] = idx
        elif "total accounts" in cell:
            index_by_header["totalAccounts"] = idx
        elif "closed" == cell:
            index_by_header["closed"] = idx
        elif "with balance" in cell:
            index_by_header["withBalance"] = idx
        elif "total balance" in cell:
            index_by_header["totalBalance"] = idx
        elif "available" in cell:
            index_by_header["available"] = idx
        elif "credit limit" in cell:
            index_by_header["creditLimit"] = idx
        elif "debt-to-credit" in cell:
            index_by_header["debtToCredit"] = idx
        elif "payment" in cell:
            index_by_header["payment"] = idx

    normalized_rows: Dict[str, Dict[str, Any]] = {}
    for raw_row in rows[1:]:
        account_type = normalize_table_cell(raw_row[index_by_header.get("accountType", 0)] if raw_row else "").title()
        if account_type not in REQUIRED_ACCOUNT_TYPES:
            continue
        normalized = base_summary_row(account_type)
        normalized["_fieldStates"] = {}
        raw_open = normalize_table_cell(raw_row[index_by_header["open"]]) if "open" in index_by_header and index_by_header["open"] < len(raw_row) else ""
        raw_total = normalize_table_cell(raw_row[index_by_header["totalAccounts"]]) if "totalAccounts" in index_by_header and index_by_header["totalAccounts"] < len(raw_row) else ""
        raw_closed = normalize_table_cell(raw_row[index_by_header["closed"]]) if "closed" in index_by_header and index_by_header["closed"] < len(raw_row) else ""
        raw_with_balance = normalize_table_cell(raw_row[index_by_header["withBalance"]]) if "withBalance" in index_by_header and index_by_header["withBalance"] < len(raw_row) else ""
        if "totalAccounts" in index_by_header:
            set_field_state(normalized, "totalAccounts", classify_table_cell_state(raw_total))
        if raw_total:
            normalized["totalAccounts"] = parse_integer(raw_total)
        if "open" in index_by_header:
            open_state = classify_table_cell_state(raw_open)
            set_field_state(normalized, "open", open_state)
        if raw_open:
            if open_state == "explicit_not_reported":
                normalized["open"] = "Not reported"
            else:
                normalized["open"] = str(parse_integer(raw_open) or raw_open)
        if "closed" in index_by_header:
            closed_state = classify_table_cell_state(raw_closed)
            set_field_state(normalized, "closed", closed_state)
        if raw_closed:
            normalized["closed"] = parse_integer(raw_closed)
        if "withBalance" in index_by_header:
            with_balance_state = classify_table_cell_state(raw_with_balance)
            set_field_state(normalized, "withBalance", with_balance_state)
        if raw_with_balance:
            if with_balance_state == "explicit_not_reported":
                normalized["withBalance"] = "Not reported"
            else:
                normalized["withBalance"] = str(parse_integer(raw_with_balance) or raw_with_balance)
        for field_name in ["totalBalance", "available", "creditLimit", "payment"]:
            if field_name in index_by_header and index_by_header[field_name] < len(raw_row):
                raw_value = normalize_table_cell(raw_row[index_by_header[field_name]])
                state = classify_table_cell_state(raw_value)
                set_field_state(normalized, field_name, state)
                if state == "explicit_not_reported":
                    normalized[field_name] = "Not reported"
                    continue
                value = parse_currency(raw_value)
                if value:
                    normalized[field_name] = value
        if "debtToCredit" in index_by_header and index_by_header["debtToCredit"] < len(raw_row):
            percent = normalize_table_cell(raw_row[index_by_header["debtToCredit"]])
            percent_state = classify_table_cell_state(percent)
            set_field_state(normalized, "debtToCredit", percent_state)
            if percent:
                if percent_state == "explicit_not_reported":
                    normalized["debtToCredit"] = "Not reported"
                else:
                    normalized["debtToCredit"] = percent if percent.endswith("%") else f"{percent}%"
        normalized_rows[account_type] = normalized

    merged_rows = [normalized_rows.get(account_type, base_summary_row(account_type)) for account_type in REQUIRED_ACCOUNT_TYPES]
    validation: List[Dict[str, Any]] = []
    if len(normalized_rows) != len(REQUIRED_ACCOUNT_TYPES):
        validation.append(
            {
                "component": "creditAccountsSummary",
                "severity": "warning",
                "code": "structured_table_incomplete",
                "message": f"Structured table only yielded {len(normalized_rows)} of {len(REQUIRED_ACCOUNT_TYPES)} account type rows.",
            }
        )

    for concern in candidate.get("parseConcerns") or []:
        severity = "warning"
        if concern.get("type") in {"insufficient_columns", "short_table"}:
            severity = "error"
        validation.append(
            {
                "component": "creditAccountsSummary",
                "severity": severity,
                "code": concern.get("type", "structured_table_warning"),
                "message": concern.get("details", "Structured table concern."),
            }
        )

    if any(row.get("accountType") == "Total" and row.get("totalAccounts") is None and row.get("open") is None for row in merged_rows) and ollama:
        prompt = f"""
Return JSON only.
Normalize this Equifax credit accounts summary table into the fixed schema:
{{
  "rows": [
    {{"accountType":"Revolving","totalAccounts":null,"open":null,"closed":null,"balance":null,"withBalance":null,"totalBalance":null,"available":null,"creditLimit":null,"debtToCredit":null,"payment":null}},
    {{"accountType":"Mortgage","totalAccounts":null,"open":null,"closed":null,"balance":null,"withBalance":null,"totalBalance":null,"available":null,"creditLimit":null,"debtToCredit":null,"payment":null}},
    {{"accountType":"Installment","totalAccounts":null,"open":null,"closed":null,"balance":null,"withBalance":null,"totalBalance":null,"available":null,"creditLimit":null,"debtToCredit":null,"payment":null}},
    {{"accountType":"Other","totalAccounts":null,"open":null,"closed":null,"balance":null,"withBalance":null,"totalBalance":null,"available":null,"creditLimit":null,"debtToCredit":null,"payment":null}},
    {{"accountType":"Total","totalAccounts":null,"open":null,"closed":null,"balance":null,"withBalance":null,"totalBalance":null,"available":null,"creditLimit":null,"debtToCredit":null,"payment":null}}
  ]
}}
Preserve blanks as null. Table excerpt:
{table_rows_to_text(candidate)}
"""
        try:
            response = ollama.chat(
                [
                    {"role": "system", "content": "You normalize tables into strict JSON only."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.0,
            )
            parsed = parse_json_safely(response) or {}
            llm_rows = parsed.get("rows")
            if isinstance(llm_rows, list) and len(llm_rows) == len(REQUIRED_ACCOUNT_TYPES):
                merged_rows = []
                for expected_type, row in zip(REQUIRED_ACCOUNT_TYPES, llm_rows):
                    candidate_row = row if isinstance(row, dict) else {}
                    normalized = base_summary_row(expected_type)
                    normalized.update(candidate_row)
                    normalized["accountType"] = expected_type
                    merged_rows.append(normalized)
        except Exception:
            pass

    return merged_rows, validation


def merge_credit_summary_rows(
    primary_rows: List[Dict[str, Any]],
    fallback_rows: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    fallback_by_type = {
        normalize_spaces(str(row.get("accountType") or "")).lower(): row
        for row in fallback_rows
        if isinstance(row, dict)
    }
    merged_rows: List[Dict[str, Any]] = []
    for primary in primary_rows:
        account_type = normalize_spaces(str(primary.get("accountType") or "")).lower()
        fallback = fallback_by_type.get(account_type, {})
        merged = dict(primary)
        for key, value in fallback.items():
            if key == "accountType":
                continue
            if should_protect_field(merged, key):
                continue
            if merged.get(key) in (None, "", [], {}):
                merged[key] = value
        merged_states = merge_hidden_field_states(primary, fallback)
        if merged_states:
            merged["_fieldStates"] = merged_states
        merged_rows.append(merged)
    if not merged_rows:
        return fallback_rows
    return merged_rows


def collection_field_name(label: str) -> Optional[str]:
    return COLLECTION_FIELD_MAP.get(normalize_pair_label(label))


def merge_collection_pairs(
    record: Dict[str, Any],
    pairs: Dict[str, str],
    pair_states: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    for label, value in pairs.items():
        field_name = collection_field_name(label)
        if not field_name:
            continue
        state = (pair_states or {}).get(label) or classify_table_cell_state(value)
        set_field_state(record, field_name, state)
        cleaned = normalize_table_cell(value)
        if state == "blank":
            continue
        if state == "explicit_not_reported":
            cleaned = "Not reported"
        if field_name == "accountNumber":
            cleaned = clean_masked_account_number(cleaned)
        elif field_name in {"amount", "originalAmountOwed"}:
            cleaned = parse_currency(cleaned) or cleaned
        if field_name == "comments":
            if cleaned:
                record["comments"] = [cleaned]
        elif field_name == "contact":
            if cleaned:
                record["contact"] = [cleaned]
        elif cleaned:
            record[field_name] = cleaned
    return record


def extract_collections_from_tables(
    page_artifacts: List[PageArtifact],
    page_numbers: List[int],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    items = sorted(layout_items_for_pages(page_artifacts, page_numbers), key=lambda item: (item["pageNumber"], item["rowIndex"]))
    collections: List[Dict[str, Any]] = []
    validation: List[Dict[str, Any]] = []

    for index, item in enumerate(items):
        if item.get("type") != "table":
            continue
        table = find_table_by_id(page_artifacts, str(item.get("tableId") or ""))
        if not table or not table_contains_text(table, "collection agency"):
            continue

        record = create_default_collection()
        source_pages: List[int] = []
        table_page_number = int(table.get("pageNumber") or 0)
        if table_page_number > 0:
            source_pages.append(table_page_number)
        pairs, pair_states = key_value_maps_from_table(table)
        record = merge_collection_pairs(record, pairs, pair_states)

        for back_index in range(max(0, index - 3), index):
            previous = items[back_index]
            if previous.get("type") != "text":
                continue
            text = normalize_spaces(str(previous.get("text") or ""))
            if text.lower().startswith("date reported"):
                value = extract_first([r"date\s+reported\s*:?\s*([^\n]+)"], text)
                if value:
                    record["dateReported"] = value
                previous_page_number = int(previous.get("pageNumber") or 0)
                if previous_page_number > 0:
                    source_pages.append(previous_page_number)

        if index + 1 < len(items):
            next_item = items[index + 1]
            if next_item.get("type") == "table":
                next_table = find_table_by_id(page_artifacts, str(next_item.get("tableId") or ""))
                if next_table and (table_contains_text(next_table, "comments") or table_contains_text(next_table, "contact")):
                    next_pairs, next_states = key_value_maps_from_table(next_table)
                    record = merge_collection_pairs(record, next_pairs, next_states)
                    next_page_number = int(next_table.get("pageNumber") or 0)
                    if next_page_number > 0:
                        source_pages.append(next_page_number)

        score = sum(
            1
            for field_name in ["collectionAgency", "accountNumber", "originalCreditorName", "amount", "status"]
            if record.get(field_name)
        )
        if score < 2:
            validation.append(
                {
                    "component": "collections",
                    "severity": "warning",
                    "code": "structured_collection_low_confidence",
                    "message": "Structured collection table was too sparse to trust without fallback.",
                }
            )
            continue

        unique_source_pages = [
            int(page)
            for page in unique_preserve_order(source_pages)
            if isinstance(page, int) and page > 0
        ]
        if unique_source_pages:
            record["_sourcePages"] = unique_source_pages
        collections.append(record)
        for concern in table.get("parseConcerns") or []:
            validation.append(
                {
                    "component": "collections",
                    "severity": "warning",
                    "code": concern.get("type", "structured_table_warning"),
                    "message": concern.get("details", "Structured collection table concern."),
                }
            )

    return collections, validation


def inquiry_mode_for_table(table: Dict[str, Any]) -> Optional[str]:
    for heading in reversed(table.get("headingTrail") or []):
        lowered = normalize_spaces(str(heading)).lower()
        if lowered == "soft inquiries":
            return "soft"
        if lowered == "hard inquiries":
            return "hard"
    return None


def clean_inquiry_subscriber_name(value: str) -> str:
    cleaned = normalize_spaces(value)
    if not cleaned:
        return ""

    cleaned = re.sub(r"\s+\(?\d{3}\)?[-\s]\d{3}[-\s]\d{4}$", "", cleaned).strip()
    cleaned = re.sub(
        r"\s+[A-Z][A-Z .&'/()-]+,\s+[A-Z]{2}\s+\d{5}(?:-\d{4})?$",
        "",
        cleaned,
    ).strip()
    cleaned = re.sub(
        r"\s+(?:P\.?O\.?\s+BOX|PO BOX|\d{1,6}\s+[A-Z0-9#./' -]+(?:ST|STREET|AVE|AVENUE|RD|ROAD|DR|DRIVE|BLVD|LANE|LN|CT|COURT|HWY|HIGHWAY|PKWY|PARKWAY|SUITE|STE)\b.*)$",
        "",
        cleaned,
        flags=re.IGNORECASE,
    ).strip()
    return cleaned or normalize_spaces(value)


def inquiry_mode_from_heading(text: str) -> Optional[str]:
    lowered = normalize_spaces(text).lower()
    if lowered == "hard inquiries":
        return "hard"
    if lowered == "soft inquiries":
        return "soft"
    return None


def is_inquiry_section_break(text: str) -> bool:
    normalized = normalize_spaces(text)
    if not normalized:
        return False
    lowered = normalized.lower()
    if lowered == "8. inquiries":
        return False
    return bool(re.match(r"^\d+\.\s+.+", normalized))


def is_inquiry_narrative_row(text: str) -> bool:
    lowered = normalize_spaces(text).lower()
    return lowered.startswith("inquiries that ") or lowered.startswith("these are inquiries") or lowered.startswith(
        "a request for your credit history"
    )


def is_inquiry_header_row(text: str) -> bool:
    lowered = normalize_spaces(text).lower()
    return lowered in {
        "date | company | request originator",
        "date | company | request originator | description",
        "date | company",
        "date | company | description",
    }


def parse_inquiry_layout_entry_row(row: Dict[str, Any], mode: str) -> Optional[Dict[str, Any]]:
    blocks = sorted(row.get("blocks") or [], key=lambda block: (block["bbox"]["xMin"], block["bbox"]["yMin"]))
    if len(blocks) < 2:
        return None

    date_text = normalize_spaces(str(blocks[0].get("text") or ""))
    if not re.match(rf"^{INQUIRY_DATE_PATTERN}$", date_text, re.IGNORECASE):
        return None

    subscriber = clean_inquiry_subscriber_name(normalize_spaces(str(blocks[1].get("text") or "")))
    if not subscriber:
        return None

    trailing_blocks = [
        normalize_spaces(str(block.get("text") or ""))
        for block in blocks[2:]
        if normalize_spaces(str(block.get("text") or ""))
    ]
    purpose = None
    if mode == "soft" and trailing_blocks:
        purpose = normalize_spaces(" ".join(trailing_blocks)) or None

    return {
        "subscriberName": subscriber,
        "inquiryDate": date_text,
        "purpose": purpose,
        "permissiblePurpose": None,
        "contact": None,
        "referenceNumber": None,
        "_contactLines": [],
        "_evidencePages": [int(row.get("_pageNumber") or row.get("pageNumber") or 0)],
    }


def extract_inquiry_continuation_lines(row: Dict[str, Any]) -> List[str]:
    lines: List[str] = []
    for block in sorted(row.get("blocks") or [], key=lambda block: (block["bbox"]["xMin"], block["bbox"]["yMin"])):
        lines.extend(row_lines(block))
    return unique_strings(lines)


def finalize_inquiry_layout_entry(entry: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not entry:
        return None

    contact_lines = unique_strings(entry.pop("_contactLines", []))
    evidence_pages = [
        int(page)
        for page in unique_preserve_order(entry.pop("_evidencePages", []))
        if isinstance(page, int) and page > 0
    ]
    if contact_lines:
        entry["contact"] = " | ".join(contact_lines)
    else:
        entry["contact"] = None
    entry["_evidencePages"] = evidence_pages

    subscriber = clean_inquiry_subscriber_name(str(entry.get("subscriberName") or ""))
    if not subscriber or not entry.get("inquiryDate"):
        return None
    entry["subscriberName"] = subscriber
    return entry


def extract_inquiries_from_rows(
    page_artifacts: List[PageArtifact],
    page_numbers: List[int],
) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    ordered_rows: List[Dict[str, Any]] = []
    for page_number in page_numbers:
        if not 1 <= page_number <= len(page_artifacts):
            continue
        page = page_artifacts[page_number - 1]
        for row in page.layout_rows:
            if is_footer_row(row, page.page_height):
                continue
            ordered_rows.append(
                {
                    **row,
                    "_pageNumber": page_number,
                }
            )

    hard_entries: List[Dict[str, Any]] = []
    soft_entries: List[Dict[str, Any]] = []
    validation: List[Dict[str, Any]] = []
    current_mode: Optional[str] = None
    current_entry: Optional[Dict[str, Any]] = None

    def flush_current() -> None:
        nonlocal current_entry
        finalized = finalize_inquiry_layout_entry(current_entry)
        current_entry = None
        if not finalized:
            return
        if current_mode == "hard":
            hard_entries.append(finalized)
        elif current_mode == "soft":
            soft_entries.append(finalized)

    for row in sorted(ordered_rows, key=lambda item: (int(item.get("_pageNumber") or 0), int(item.get("rowIndex") or 0))):
        text = normalize_spaces(str(row.get("text") or ""))
        if not text:
            continue

        next_mode = inquiry_mode_from_heading(text)
        if next_mode:
            flush_current()
            current_mode = next_mode
            continue

        if current_mode is None:
            continue

        if is_inquiry_section_break(text):
            flush_current()
            break

        if is_inquiry_narrative_row(text) or is_inquiry_header_row(text):
            continue

        parsed_entry = parse_inquiry_layout_entry_row(row, current_mode)
        if parsed_entry:
            flush_current()
            current_entry = parsed_entry
            continue

        if current_entry is not None:
            current_entry["_contactLines"].extend(extract_inquiry_continuation_lines(row))
            page_number = int(row.get("_pageNumber") or 0)
            if page_number > 0:
                current_entry.setdefault("_evidencePages", []).append(page_number)

    flush_current()

    if current_mode is None:
        validation.append(
            {
                "component": "inquiries",
                "severity": "warning",
                "code": "missing_inquiry_headings",
                "message": "No hard or soft inquiry headings were detected in layout rows.",
            }
        )

    return {
        "hardInquiries": hard_entries,
        "softInquiries": soft_entries,
        "hardInquiryCount": len(hard_entries),
        "softInquiryCount": len(soft_entries),
    }, validation


def parse_inquiry_table_entries(table: Dict[str, Any], mode: str) -> List[Dict[str, Any]]:
    rows = table.get("rows") or []
    if not rows:
        return []
    header = [normalize_table_cell(cell).lower() for cell in rows[0]]
    has_header = bool(header and "date" in header[0])

    index_by_header: Dict[str, int] = {}
    if has_header:
        for idx, cell in enumerate(header):
            if cell == "date":
                index_by_header["date"] = idx
            elif "company" in cell:
                index_by_header["company"] = idx
            elif "request originator" in cell:
                index_by_header["requestOriginator"] = idx
            elif "description" in cell:
                index_by_header["description"] = idx
        data_rows = rows[1:]
    else:
        index_by_header["date"] = 0
        index_by_header["company"] = 1
        if mode == "soft":
            index_by_header["description"] = 2
        data_rows = rows

    entries: List[Dict[str, Any]] = []
    for row in data_rows:
        if len(row) < 2:
            continue
        inquiry_date = normalize_table_cell(row[index_by_header.get("date", 0)])
        subscriber = clean_inquiry_subscriber_name(normalize_table_cell(row[index_by_header.get("company", 1)]))
        if not inquiry_date or not subscriber:
            continue
        if not re.match(rf"^{INQUIRY_DATE_PATTERN}$", inquiry_date, re.IGNORECASE):
            continue
        purpose = None
        if mode == "soft" and "description" in index_by_header and index_by_header["description"] < len(row):
            purpose = normalize_table_cell(row[index_by_header["description"]]) or None
        entries.append(
            {
                "subscriberName": subscriber,
                "inquiryDate": inquiry_date,
                "purpose": purpose,
                "permissiblePurpose": None,
                "contact": None,
                "referenceNumber": None,
            }
        )
    return entries


def merge_inquiry_entries(
    primary: List[Dict[str, Any]],
    fallback: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    def canonical_subscriber(name: str) -> str:
        normalized = normalize_spaces(name).lower()
        normalized = re.sub(
            r"\b(id report|direct to consumer report|promotional inquiry|insurance inquiry|account review inquiry|credit report)\b.*$",
            "",
            normalized,
            flags=re.IGNORECASE,
        )
        normalized = re.sub(r"[\s,.;:]+$", "", normalized).strip()
        return normalized

    def is_same_entry(left: Dict[str, Any], right: Dict[str, Any]) -> bool:
        left_date = normalize_spaces(str(left.get("inquiryDate") or "")).lower()
        right_date = normalize_spaces(str(right.get("inquiryDate") or "")).lower()
        if not left_date or left_date != right_date:
            return False
        left_name = canonical_subscriber(str(left.get("subscriberName") or ""))
        right_name = canonical_subscriber(str(right.get("subscriberName") or ""))
        if not left_name or not right_name:
            return False
        return (
            left_name == right_name
            or left_name in right_name
            or right_name in left_name
        )

    merged: List[Dict[str, Any]] = [entry for entry in primary if isinstance(entry, dict)]
    for entry in fallback:
        if not isinstance(entry, dict):
            continue
        match_index = next((idx for idx, existing in enumerate(merged) if is_same_entry(existing, entry)), None)
        if match_index is not None:
            existing = merged[match_index]
            merged_pages = [
                int(page)
                for page in unique_preserve_order(
                    list(existing.get("_evidencePages") or []) + list(entry.get("_evidencePages") or [])
                )
                if isinstance(page, int) and page > 0
            ]
            if not normalize_spaces(str(existing.get("purpose") or "")) and normalize_spaces(str(entry.get("purpose") or "")):
                replacement = dict(entry)
                if merged_pages:
                    replacement["_evidencePages"] = merged_pages
                merged[match_index] = replacement
            elif merged_pages:
                existing["_evidencePages"] = merged_pages
            continue
        merged.append(entry)
    return merged


def extract_inquiries_from_tables(
    page_artifacts: List[PageArtifact],
    page_numbers: List[int],
) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    ordered_items = sorted(
        layout_items_for_pages(page_artifacts, page_numbers),
        key=lambda item: (item["pageNumber"], item["rowIndex"]),
    )
    hard_entries: List[Dict[str, Any]] = []
    soft_entries: List[Dict[str, Any]] = []
    validation: List[Dict[str, Any]] = []
    current_mode: Optional[str] = None

    for item in ordered_items:
        if item.get("type") == "heading":
            text = normalize_spaces(str(item.get("text") or "")).lower()
            if text == "hard inquiries":
                current_mode = "hard"
            elif text == "soft inquiries":
                current_mode = "soft"
            continue
        if item.get("type") != "table":
            continue

        table = find_table_by_id(page_artifacts, str(item.get("tableId") or ""))
        if not table:
            continue
        mode = inquiry_mode_for_table(table) or current_mode
        if mode not in {"hard", "soft"}:
            continue
        entries = parse_inquiry_table_entries(table, mode)
        if not entries:
            continue
        if mode == "hard":
            hard_entries.extend(entries)
        else:
            soft_entries.extend(entries)
        for concern in table.get("parseConcerns") or []:
            validation.append(
                {
                    "component": "inquiries",
                    "severity": "warning",
                    "code": concern.get("type", "structured_table_warning"),
                    "message": concern.get("details", "Structured inquiry table concern."),
                }
            )

    return {
        "hardInquiries": hard_entries,
        "softInquiries": soft_entries,
        "hardInquiryCount": len(hard_entries),
        "softInquiryCount": len(soft_entries),
    }, validation


def build_account_sections(page_artifacts: List[PageArtifact], page_numbers: List[int]) -> List[Dict[str, Any]]:
    items = sorted(layout_items_for_pages(page_artifacts, page_numbers), key=lambda item: (item["pageNumber"], item["rowIndex"]))
    sections: List[Dict[str, Any]] = []
    current: Optional[Dict[str, Any]] = None
    account_heading_pattern = re.compile(r"^\d+\.\d+\s+.+")

    for item in items:
        text = normalize_spaces(str(item.get("text") or ""))
        if ACCOUNT_SECTION_STOP_PATTERN.match(text):
            if current:
                sections.append(current)
                current = None
            continue
        if item.get("type") == "heading":
            if account_heading_pattern.match(text):
                if current:
                    sections.append(current)
                current = {
                    "heading": text,
                    "items": [item],
                }
                continue
        if current:
            current["items"].append(item)

    if current:
        sections.append(current)

    return sections


def section_source_pages(section: Dict[str, Any]) -> List[int]:
    return [
        int(page)
        for page in unique_preserve_order(
            [
                int(item.get("pageNumber") or 0)
                for item in (section.get("items") or [])
                if isinstance(item, dict) and int(item.get("pageNumber") or 0) > 0
            ]
        )
        if isinstance(page, int) and page > 0
    ]


def apply_account_pairs(
    account: Dict[str, Any],
    pairs: Dict[str, str],
    pair_states: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    for label, value in pairs.items():
        normalized_label = normalize_pair_label(label)
        field_name = ACCOUNT_PAIR_FIELD_MAP.get(normalized_label)
        if not field_name:
            continue
        state = (pair_states or {}).get(label) or classify_table_cell_state(value)
        set_field_state(account, field_name, state)
        cleaned = normalize_table_cell(value)
        if state == "blank":
            continue
        if state == "explicit_not_reported":
            cleaned = "Not reported"
        if field_name == "accountNumber":
            cleaned = clean_masked_account_number(cleaned)
        elif field_name in {"comments", "contact"}:
            if cleaned:
                account[field_name] = [cleaned]
            continue
        elif "date" in field_name.lower():
            cleaned = cleaned
        elif field_name in ACCOUNT_CURRENCY_FIELDS:
            parsed_currency = parse_currency(cleaned)
            if not parsed_currency:
                set_field_state(account, field_name, "blank")
                continue
            cleaned = parsed_currency
        account[field_name] = cleaned
        if field_name == "accountStatus" and account.get("status") in {"Not reported", "", None}:
            account["status"] = cleaned
        if field_name == "dateOpened" and account.get("openDate") in {"Not reported", "", None}:
            account["openDate"] = cleaned
    return account


def section_to_fallback_text(section: Dict[str, Any], page_artifacts: List[PageArtifact]) -> str:
    chunks: List[str] = []
    for item in section.get("items") or []:
        if item.get("type") == "table":
            table = find_table_by_id(page_artifacts, str(item.get("tableId") or ""))
            if table:
                table_title = effective_table_title(table)
                if table_title.lower() in ACCOUNT_COMMENTS_CONTACT_TITLES:
                    continue
                if table_title:
                    chunks.append(table_title)
                chunks.append(table_rows_to_text(table))
        else:
            text = normalize_spaces(str(item.get("text") or ""))
            if text:
                chunks.append(text)
    return "\n".join(chunks)


def extract_accounts_from_sections(
    page_artifacts: List[PageArtifact],
    page_numbers: List[int],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    sections = build_account_sections(page_artifacts, page_numbers)
    accounts: List[Dict[str, Any]] = []
    validation: List[Dict[str, Any]] = []

    for section in sections:
        heading = normalize_spaces(str(section.get("heading") or ""))
        heading_match = re.match(r"^\d+\.\d+\s+(.+)$", heading)
        account_name = heading_match.group(1) if heading_match else heading
        account_name = re.sub(r"\((?:closed|open)\)\s*$", "", account_name, flags=re.IGNORECASE).strip() or "Not reported"
        closed_hint = bool(re.search(r"\(closed\)", heading, re.IGNORECASE))
        source_pages = section_source_pages(section)

        fallback_text = section_to_fallback_text(section, page_artifacts)
        account = extract_account_from_block(fallback_text)
        account["accountName"] = account_name
        if source_pages:
            account["_sourcePages"] = source_pages
        if closed_hint:
            account["isClosed"] = True
            account["accountStatus"] = "CLOSED"

        for item in section.get("items") or []:
            if item.get("type") != "table":
                continue
            table = find_table_by_id(page_artifacts, str(item.get("tableId") or ""))
            if not table:
                continue
            table_title = effective_table_title(table).lower()
            if table_title in ACCOUNT_COMMENTS_CONTACT_TITLES:
                continue
            pairs, pair_states = key_value_maps_from_table(table)
            if pairs:
                account = apply_account_pairs(account, pairs, pair_states)
                if "comments" in {normalize_spaces(key).lower() for key in pairs}:
                    comments = normalize_table_cell(pairs.get("Comments") or pairs.get("comments") or "")
                    if comments:
                        account["comments"] = [comments]
            if table_title in ACCOUNT_TABLE_TITLES:
                account[ACCOUNT_TABLE_TITLES[table_title]] = history_rows_from_table(table)
            elif table_title == "payment history":
                account["paymentHistory"] = payment_history_from_table(table)
            elif table_title == "account details":
                account = apply_account_pairs(account, pairs, pair_states)

            for concern in table.get("parseConcerns") or []:
                if concern.get("type") == "short_table" and is_structured_history_fragment(table):
                    continue
                validation.append(
                    {
                        "component": "accounts",
                        "severity": "warning",
                        "code": concern.get("type", "structured_table_warning"),
                        "message": f"{account_name}: {concern.get('details', 'Structured account table concern.')}",
                    }
                )

        structured_history_payload, structured_history_evidence = extract_account_history_payload_from_section(page_artifacts, section)
        for field_name, value in structured_history_payload.items():
            if has_meaningful_account_value(field_name, value) or not has_meaningful_account_value(field_name, account.get(field_name)):
                account[field_name] = value
        if structured_history_evidence:
            account["_historyEvidence"] = structured_history_evidence

        comments_contact_payload = extract_account_comments_contact_from_section(page_artifacts, section)
        if has_meaningful_account_value("comments", comments_contact_payload.get("comments")):
            account["comments"] = comments_contact_payload["comments"]
        if has_meaningful_account_value("contact", comments_contact_payload.get("contact")):
            account["contact"] = comments_contact_payload["contact"]

        if account.get("accountNumber") == "Not reported":
            validation.append(
                {
                    "component": "accounts",
                    "severity": "warning",
                    "code": "missing_structured_account_number",
                    "message": f"{account_name}: account number was not proven from structured layout.",
                }
            )

        accounts.append(account)

    return accounts, validation


def collect_table_row_segments(text: str) -> Dict[str, List[str]]:
    segments: Dict[str, List[str]] = {account_type: [] for account_type in REQUIRED_ACCOUNT_TYPES}
    if not text:
        return segments

    lines = [normalize_spaces(line) for line in text.splitlines() if normalize_spaces(line)]
    account_type_pattern = re.compile(r"^(revolving|mortgage|installment|other|total)\b", re.IGNORECASE)
    line_count = len(lines)

    header_indices = [
        idx
        for idx, line in enumerate(lines)
        if ("account type" in line.lower()) and (
            "debt-to-credit" in line.lower()
            or "debt to credit" in line.lower()
            or "with balance" in line.lower()
        )
    ]

    candidate_indices = set(range(line_count))
    if header_indices:
        scoped = set()
        for header_idx in header_indices:
            for cursor in range(header_idx + 1, min(line_count, header_idx + 18)):
                scoped.add(cursor)
        candidate_indices = scoped

    for idx, line in enumerate(lines):
        if idx not in candidate_indices:
            continue
        match = account_type_pattern.match(line)
        if not match:
            continue
        account_type = match.group(1).title()
        if account_type not in segments:
            continue
        lowered_line = line.lower()
        if account_type == "Other" and lowered_line.startswith("other items"):
            continue
        if account_type == "Total" and lowered_line.startswith("total balance"):
            continue

        parts = [line]
        next_idx = idx + 1
        while next_idx < line_count:
            if header_indices and next_idx not in candidate_indices:
                break
            next_line = lines[next_idx]
            if account_type_pattern.match(next_line):
                break
            if re.search(r"\b(account\s+type|other items|consumer statements|personal information|collections?|inquiries|public records)\b", next_line, re.IGNORECASE):
                break
            if re.search(r"[\d$%]", next_line):
                parts.append(next_line)
            if len(" ".join(parts)) > 220:
                break
            next_idx += 1

        segment = normalize_spaces(" ".join(parts))
        if segment:
            segments[account_type].append(segment)

    return segments


def parse_row_tokens(segment: str) -> Tuple[List[str], List[str], List[str]]:
    tail_tokens = re.findall(r"-?\$?[\d,]+(?:\.\d+)?%?", segment)
    count_tokens: List[str] = []
    money_tokens: List[str] = []
    percent_tokens: List[str] = []

    for token in tail_tokens:
        clean = token.replace("$", "").replace(",", "")
        if not clean:
            continue

        if token.endswith("%"):
            percent_tokens.append(token if token.endswith("%") else f"{token}%")
            continue

        if "$" in token or "," in token or token.startswith("-"):
            money_tokens.append(token)
            continue

        if re.fullmatch(r"\d+(?:\.\d+)?", clean):
            if "." in clean:
                percent_tokens.append(f"{clean}%")
            else:
                value = int(clean)
                if value <= 500:
                    count_tokens.append(token)
                else:
                    money_tokens.append(token)

    return count_tokens, money_tokens, percent_tokens


def parse_summary_row_from_segment(account_type: str, segment: str, count_layout: str) -> Dict[str, Any]:
    row = base_summary_row(account_type)
    cleaned = re.sub(rf"^{account_type}\b", "", segment, flags=re.IGNORECASE).strip()
    count_tokens, money_tokens, percent_tokens = parse_row_tokens(cleaned)

    counts = []
    for token in count_tokens:
        value = parse_integer(token)
        if value is not None:
            counts.append(value)

    map_count_fields(row, counts, count_layout)

    money_values = [parse_currency(token) for token in money_tokens]
    money_values = [value for value in money_values if value]
    for field_name, value in zip(["totalBalance", "available", "creditLimit", "payment"], money_values):
        row[field_name] = value

    if percent_tokens:
        row["debtToCredit"] = percent_tokens[0]

    return row


def detect_summary_count_layout(text: str) -> str:
    if not text:
        return "legacy"

    lines = [normalize_spaces(line).lower() for line in text.splitlines() if normalize_spaces(line)]
    for line in lines:
        if "account type" not in line:
            continue
        if "open" in line and "with balance" in line and "closed" not in line and "total accounts" not in line:
            return "open_with_balance"
        if "total accounts" in line and "open" in line and "closed" in line:
            return "total_open_closed_with_balance"
        if "total accounts" in line and "open" in line:
            return "total_open_with_balance"
    return "legacy"


def map_count_fields(row: Dict[str, Any], counts: List[int], layout: str) -> None:
    if not counts:
        return

    if layout == "open_with_balance":
        if len(counts) >= 1:
            row["open"] = str(counts[0])
        if len(counts) >= 2:
            row["withBalance"] = str(counts[1])
        return

    if layout == "total_open_closed_with_balance":
        if len(counts) >= 1:
            row["totalAccounts"] = counts[0]
        if len(counts) >= 2:
            row["open"] = str(counts[1])
        if len(counts) >= 3:
            row["closed"] = counts[2]
        if len(counts) >= 4:
            row["withBalance"] = str(counts[3])
        return

    if layout == "total_open_with_balance":
        if len(counts) >= 1:
            row["totalAccounts"] = counts[0]
        if len(counts) >= 2:
            row["open"] = str(counts[1])
        if len(counts) >= 3:
            row["withBalance"] = str(counts[2])
        return

    if len(counts) >= 1:
        row["totalAccounts"] = counts[0]
    if len(counts) >= 2:
        row["open"] = str(counts[1])
    if len(counts) >= 3:
        row["withBalance"] = str(counts[2])
    if len(counts) >= 4:
        row["closed"] = counts[3]


def score_summary_row(row: Dict[str, Any]) -> Tuple[int, List[str]]:
    score_fields = ["totalAccounts", "open", "withBalance", "totalBalance", "available", "creditLimit", "debtToCredit", "payment"]
    score = sum(1 for field in score_fields if row.get(field) not in (None, ""))
    issues: List[str] = []

    total_accounts = row.get("totalAccounts")
    open_count = parse_integer(str(row.get("open"))) if row.get("open") is not None else None
    with_balance = parse_integer(str(row.get("withBalance"))) if row.get("withBalance") is not None else None
    account_type = str(row.get("accountType", ""))

    if isinstance(total_accounts, int):
        if isinstance(open_count, int) and open_count > total_accounts:
            issues.append("open exceeds totalAccounts")
        if isinstance(with_balance, int) and with_balance > total_accounts:
            issues.append("withBalance exceeds totalAccounts")
        if account_type.lower() != "total" and total_accounts > 20:
            issues.append("non-total totalAccounts unusually high")
    if isinstance(open_count, int) and account_type.lower() != "total" and open_count > 20:
        issues.append("non-total open count unusually high")

    if row.get("debtToCredit") and not str(row["debtToCredit"]).endswith("%"):
        row["debtToCredit"] = f"{row['debtToCredit']}%"

    return score, issues


def parse_credit_accounts_rows(text: str, count_layout: str) -> Dict[str, Dict[str, Any]]:
    segments = collect_table_row_segments(text)
    rows: Dict[str, Dict[str, Any]] = {}

    for account_type in REQUIRED_ACCOUNT_TYPES:
        best_row = base_summary_row(account_type)
        best_score = -1
        for segment in segments.get(account_type, []):
            candidate = parse_summary_row_from_segment(account_type, segment, count_layout)
            score, issues = score_summary_row(candidate)
            score -= len(issues)
            if score > best_score:
                best_row = candidate
                best_score = score
        if best_score >= 0:
            rows[account_type] = best_row

    return rows


def merge_table_rows(
    text_rows: Dict[str, Dict[str, Any]],
    image_rows: Dict[str, Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], List[str]]:
    merged_rows: List[Dict[str, Any]] = []
    issues: List[str] = []

    for account_type in REQUIRED_ACCOUNT_TYPES:
        text_row = text_rows.get(account_type)
        image_row = image_rows.get(account_type)

        if not text_row and not image_row:
            issues.append(f"Missing row for account type '{account_type}'")
            merged_rows.append(base_summary_row(account_type))
            continue

        if image_row and not text_row:
            selected = image_row
        elif text_row and not image_row:
            selected = text_row
        else:
            text_score, text_issues = score_summary_row(text_row or base_summary_row(account_type))
            image_score, image_issues = score_summary_row(image_row or base_summary_row(account_type))
            image_valid = len(image_issues) == 0
            text_valid = len(text_issues) == 0

            if image_valid and (image_score >= text_score):
                selected = image_row
            elif text_valid:
                selected = text_row
            else:
                selected = image_row if image_score >= text_score else text_row

        selected = selected or base_summary_row(account_type)
        _, selected_issues = score_summary_row(selected)
        if selected_issues:
            issues.append(f"{account_type} row integrity issues: {', '.join(selected_issues)}")

        merged_rows.append(selected)

    return merged_rows, issues


def extract_credit_accounts_summary(text_layer: str, image_text: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    count_layout = detect_summary_count_layout(f"{text_layer}\n{image_text}")
    text_rows = parse_credit_accounts_rows(text_layer, count_layout)
    image_rows = parse_credit_accounts_rows(image_text, count_layout)
    merged_rows, issues = merge_table_rows(text_rows, image_rows)

    validation: List[Dict[str, Any]] = []
    for issue in issues:
        validation.append(
            {
                "component": "creditAccountsSummary",
                "severity": "error",
                "code": "table_integrity_error",
                "message": issue,
            }
        )

    return merged_rows, validation


def extract_other_items_summary(text: str) -> Dict[str, Any]:
    inquiry_count = parse_integer(extract_first([r"inquiries\s*:?\s*(\d+)"], text)) or 0
    public_record_count = parse_integer(extract_first([r"public\s+records\s*:?\s*(\d+)"], text)) or 0
    collection_count = parse_integer(extract_first([r"collections\s*:?\s*(\d+)"], text)) or 0
    personal_info_count = parse_integer(extract_first([r"personal\s+information\s*:?\s*(\d+)"], text)) or 0
    statement_count = parse_integer(extract_first([r"consumer\s+statements?\s*:?\s*(\d+)"], text)) or 0

    return {
        "inquiries": inquiry_count,
        "publicRecords": public_record_count,
        "collections": [],
        "statementCount": statement_count,
        "personalInfoItemCount": personal_info_count,
        "recentInquiry": extract_first([r"most\s+recent\s+inquiry\s*:?\s*([^\n]+)"], text),
        "inquiryCount": inquiry_count,
        "publicRecordCount": public_record_count,
        "collectionCount": collection_count,
    }


OLD_EQ_PUBLIC_RECORD_CATEGORIES = {
    "bankruptcies": "Bankruptcy",
    "judgments": "Judgment",
    "liens": "Lien",
}

OLD_EQ_PUBLIC_RECORD_LABELS = [
    ("reference number", "referenceNumber"),
    ("status", "status"),
    ("date filed", "dateFiled"),
    ("date resolved", "dateResolved"),
    ("type", "recordType"),
    ("verified date", "verifiedDate"),
    ("filer", "filer"),
    ("liability", "liability"),
    ("court", "court"),
    ("amount", "amount"),
    ("exempt amount", "exemptAmount"),
    ("asset amount", "assetAmount"),
    ("prior disposition", "priorDisposition"),
    ("comments", "comments"),
]


def collect_lines_with_pages(page_artifacts: List[PageArtifact], page_numbers: List[int]) -> List[Tuple[int, str]]:
    collected: List[Tuple[int, str]] = []
    for page_number in page_numbers:
        if not 1 <= page_number <= len(page_artifacts):
            continue
        for line in visible_row_texts(page_artifacts[page_number - 1]):
            collected.append((page_number, line))
    return collected


def parse_labeled_text_block(block_lines: List[str], labels: List[Tuple[str, str]]) -> Dict[str, str]:
    if not block_lines:
        return {}

    pattern = re.compile(
        "|".join(
            re.escape(label)
            for label, _ in sorted(labels, key=lambda item: len(item[0]), reverse=True)
        ),
        re.IGNORECASE,
    )
    label_map = {label.lower(): key for label, key in labels}
    text = "\n".join(block_lines)
    matches = list(pattern.finditer(text))
    if not matches:
        return {}

    parsed: Dict[str, str] = {}
    for index, match in enumerate(matches):
        label_text = normalize_spaces(match.group(0)).lower()
        field_key = label_map.get(label_text)
        if not field_key:
            continue
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        value = normalize_spaces(text[start:end])
        if value:
            parsed[field_key] = value
    return parsed


def clean_public_record_value(value: Optional[str]) -> Optional[str]:
    cleaned = normalize_spaces(str(value or "").replace("|", " "))
    cleaned = cleaned.strip(":-| ")
    return cleaned or None


def split_trailing_public_record_identifier(value: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    normalized = clean_public_record_value(value)
    if not normalized:
        return None, None
    match = re.match(r"^(.*?)(?:\s+)([A-Z0-9\-]*\d[A-Z0-9\-]{3,})$", normalized)
    if not match:
        return normalized, None
    court_name = clean_public_record_value(match.group(1))
    identifier = clean_public_record_value(match.group(2))
    if not court_name or not identifier:
        return normalized, None
    if "court" not in court_name.lower():
        return normalized, None
    return court_name, identifier


def extract_public_records(
    page_artifacts: List[PageArtifact],
    page_numbers: List[int],
) -> Dict[str, Any]:
    if not page_numbers:
        return {"publicRecordCount": 0, "records": [], "status": "Section not present."}

    lines_with_pages = collect_lines_with_pages(page_artifacts, page_numbers)
    joined = " ".join(line for _, line in lines_with_pages).lower()
    if "no public records reported" in joined:
        return {"publicRecordCount": 0, "records": [], "status": "No public records reported."}

    records: List[Dict[str, Any]] = []
    current_category: Optional[str] = None
    current_lines: List[str] = []
    current_pages: List[int] = []

    public_record_date_pattern = r"(?:\d{1,2}/\d{1,2}/\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},\s+\d{4}|[A-Za-z]{3,9}\s+\d{4})"

    def finalize_current() -> None:
        nonlocal current_lines, current_pages
        if not current_category:
            current_lines = []
            current_pages = []
            return

        block_text = "\n".join(current_lines)
        if re.search(r"you currently do not have any", block_text, re.IGNORECASE):
            current_lines = []
            current_pages = []
            return

        parsed = parse_labeled_text_block(current_lines, OLD_EQ_PUBLIC_RECORD_LABELS)
        normalized_block = normalize_spaces(block_text.replace("|", " | "))
        reference_number = clean_public_record_value(
            extract_first([r"Reference Number[:\s|]+([A-Za-z0-9-]+)"], normalized_block)
            or parsed.get("referenceNumber")
        )
        date_filed = clean_public_record_value(
            extract_first([r"Date Filed\s*\|?\s*([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})"], normalized_block)
            or parsed.get("dateFiled")
        )
        date_resolved = clean_public_record_value(
            extract_first([r"Date Resolved\s*\|?\s*([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})"], normalized_block)
            or parsed.get("dateResolved")
        )
        court = clean_public_record_value(
            extract_first(
                [
                    r"Court\s*\|?\s*([A-Za-z0-9 .,'/&()\-]+?)(?=\s+(?:Exempt Amount|Asset Amount|Prior Disposition|Comments)\b|$)",
                ],
                normalized_block,
            )
            or parsed.get("court")
        )
        if court and not reference_number:
            split_court, split_reference = split_trailing_public_record_identifier(court)
            if split_reference:
                court = split_court
                reference_number = split_reference
        status = clean_public_record_value(
            extract_first([r"Status\s+(.+?)(?=\s+Date Filed\b|$)"], normalized_block)
            or parsed.get("status")
        )
        amount = clean_public_record_value(parsed.get("amount") or parsed.get("assetAmount"))
        if amount and not re.search(r"\d", amount):
            amount = None
        summary = status or clean_public_record_value(parsed.get("recordType")) or current_category
        details = [
            line
            for line in unique_preserve_order(current_lines)
            if line
            and not re.match(rf"^(?:{public_record_date_pattern})\s*$", line, re.IGNORECASE)
            and not re.search(
                r"^(?:status|comments|reference number)\s*$|^(?:bankruptcies|judgments|liens)\s+are\b|^this section includes public record items\b|^they can be contacted\b|^lexisnexis consumer center\b|^p\.o\. box\b|^atlanta, ga\b",
                line,
                re.IGNORECASE,
            )
            and not re.fullmatch(r"(?:Verified Date|Filer|Subject|Liability|Exempt Amount|Asset Amount|Prior Disposition)(?:\s*\|\s*(?:Verified Date|Filer|Subject|Liability|Exempt Amount|Asset Amount|Prior Disposition))*", line, re.IGNORECASE)
        ]
        if reference_number or date_filed or court or summary:
            records.append(
                {
                    "recordType": current_category,
                    "court": court,
                    "referenceNumber": reference_number,
                    "status": status,
                    "amount": amount,
                    "dateFiled": date_filed,
                    "dateResolved": date_resolved,
                    "summary": summary,
                    "details": details,
                    "sourcePages": unique_preserve_order(current_pages),
                }
            )
        current_lines = []
        current_pages = []

    for page_number, line in lines_with_pages:
        lowered = normalize_spaces(line).lower()
        if not lowered:
            continue
        if re.match(r"^\d+\.\s+public records\b", line, re.IGNORECASE):
            continue
        if line.startswith("ARICA ") or re.match(r"^[A-Z][A-Z\s\.'-]+\|\s+[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}", line):
            continue
        if re.match(r"^page\s+\d+\s+of\s+\d+$", lowered):
            continue
        if lowered in OLD_EQ_PUBLIC_RECORD_CATEGORIES:
            finalize_current()
            current_category = OLD_EQ_PUBLIC_RECORD_CATEGORIES[lowered]
            continue
        if re.search(
            r"^this section includes public record items\b|^they can be contacted\b|^lexisnexis consumer center\b|^p\.o\. box\b|^atlanta, ga\b",
            lowered,
            re.IGNORECASE,
        ):
            continue
        if re.search(
            r"^(bankruptcies|judgments)\s+are a legal status\b|^a lien is a legal claim\b|^on your credit report\b",
            lowered,
            re.IGNORECASE,
        ):
            continue
        if current_category is None:
            continue
        current_lines.append(line)
        current_pages.append(page_number)

    finalize_current()

    return {
        "publicRecordCount": len(records),
        "records": records,
        "status": "Records extracted from Equifax public records section." if records else "No public records detected.",
    }


INQUIRY_DATE_PATTERN = r"(?:\d{1,2}/\d{1,2}/\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})"


def collect_inquiry_section_lines(text: str, start_token: str, end_tokens: List[str]) -> List[str]:
    raw_lines = [line.rstrip() for line in text.splitlines() if normalize_spaces(line)]
    collected: List[str] = []
    in_section = False

    for raw_line in raw_lines:
        normalized = normalize_spaces(raw_line)
        lowered = normalized.lower()

        if not in_section:
            if start_token in lowered:
                in_section = True
            continue

        if any(token in lowered for token in end_tokens):
            break
        if re.match(r"^\d+\.\s+", normalized):
            break

        collected.append(raw_line)

    return collected


def parse_inquiry_entries(section_lines: List[str], mode: str) -> List[Dict[str, Any]]:
    date_line_pattern = re.compile(rf"^\s*({INQUIRY_DATE_PATTERN})\s+(.*\S)?\s*$", re.IGNORECASE)
    heading_pattern = re.compile(r"^(date|company|request originator|description|inquiries that)\b", re.IGNORECASE)
    address_pattern = re.compile(r"\b(po box|suite|street|avenue|ave|road|rd\b|blvd|drive|dr\b|city|state|\(\d{3}\))\b", re.IGNORECASE)

    entries: List[Dict[str, Any]] = []
    seen_keys = set()
    current: Optional[Dict[str, Any]] = None

    def flush_current() -> None:
        nonlocal current
        if not current:
            return

        subscriber = normalize_spaces(current.get("subscriber", ""))
        purpose = normalize_spaces(current.get("purpose", "")) or None

        for extra_line in current.get("continuation", []):
            normalized = normalize_spaces(extra_line)
            lowered = normalized.lower()
            if not normalized or heading_pattern.search(normalized):
                continue
            if "page " in lowered and " of " in lowered:
                continue
            if address_pattern.search(normalized):
                continue

            if mode == "soft" and not purpose and re.search(
                r"\b(inquiry|report|prequalification|review|consumer)\b",
                lowered,
            ):
                purpose = normalized
                continue

            if re.fullmatch(r"[A-Z][A-Z0-9&'.,/\- ]{2,70}", normalized):
                subscriber = normalize_spaces(f"{subscriber} {normalized}")

        if not subscriber or len(subscriber) < 3:
            current = None
            return

        key = (mode, subscriber.lower(), str(current["date"]))
        if key in seen_keys:
            current = None
            return
        seen_keys.add(key)

        entries.append(
            {
                "subscriberName": subscriber,
                "inquiryDate": current["date"],
                "purpose": purpose,
                "permissiblePurpose": None,
                "contact": None,
                "referenceNumber": None,
            }
        )
        current = None

    for raw_line in section_lines:
        normalized = normalize_spaces(raw_line)
        if not normalized:
            continue
        if heading_pattern.search(normalized):
            continue
        if re.search(r"\b(these are inquiries|may remain on your file)\b", normalized, re.IGNORECASE):
            continue

        date_match = date_line_pattern.match(raw_line)
        if date_match:
            flush_current()
            date_value = normalize_spaces(date_match.group(1))
            remainder_raw = (date_match.group(2) or "").strip()
            chunks = [normalize_spaces(chunk) for chunk in re.split(r"\s{2,}", remainder_raw) if normalize_spaces(chunk)]
            subscriber = chunks[0] if chunks else normalize_spaces(remainder_raw)
            purpose = chunks[1] if mode == "soft" and len(chunks) >= 2 else None
            current = {
                "date": date_value,
                "subscriber": subscriber,
                "purpose": purpose,
                "continuation": [],
            }
            continue

        if current is not None:
            current["continuation"].append(raw_line)

    flush_current()
    return entries


def extract_inquiries(text: str) -> Dict[str, Any]:
    hard_section = collect_inquiry_section_lines(
        text,
        start_token="hard inquir",
        end_tokens=["soft inquir", "public records", "collections", "dispute"],
    )
    soft_section = collect_inquiry_section_lines(
        text,
        start_token="soft inquir",
        end_tokens=["public records", "collections", "dispute"],
    )

    hard_entries = parse_inquiry_entries(hard_section, "hard")
    soft_entries = parse_inquiry_entries(soft_section, "soft")

    return {
        "hardInquiries": hard_entries,
        "softInquiries": soft_entries,
        "hardInquiryCount": len(hard_entries),
        "softInquiryCount": len(soft_entries),
    }


def extract_inquiries_generic(text: str) -> List[Dict[str, Any]]:
    raw_lines = [line.rstrip() for line in text.splitlines() if normalize_spaces(line)]
    if not raw_lines:
        return []

    entries: List[Dict[str, Any]] = []
    seen = set()
    in_section = False
    date_line_pattern = re.compile(rf"^\s*({INQUIRY_DATE_PATTERN})\s+(.*\S)?\s*$", re.IGNORECASE)

    for raw_line in raw_lines:
        normalized = normalize_spaces(raw_line)
        lowered = normalized.lower()

        if not in_section:
            if "inquiries" in lowered:
                in_section = True
            continue

        if re.match(r"^\d+\.\s+", normalized) and "inquiries" not in lowered:
            break
        if re.search(r"\b(public records|collections|dispute)\b", lowered):
            break

        date_match = date_line_pattern.match(raw_line)
        if not date_match:
            continue

        inquiry_date = normalize_spaces(date_match.group(1))
        remainder = (date_match.group(2) or "").strip()
        chunks = [normalize_spaces(chunk) for chunk in re.split(r"\s{2,}", remainder) if normalize_spaces(chunk)]
        subscriber = chunks[0] if chunks else normalize_spaces(remainder)
        purpose = chunks[1] if len(chunks) >= 2 else None
        if not subscriber or len(subscriber) < 3:
            continue
        key = (subscriber.lower(), inquiry_date)
        if key in seen:
            continue
        seen.add(key)
        entries.append(
            {
                "subscriberName": subscriber,
                "inquiryDate": inquiry_date,
                "purpose": purpose,
                "permissiblePurpose": None,
                "contact": None,
                "referenceNumber": None,
            }
        )

    return entries


def split_account_blocks(text: str) -> List[str]:
    if not text:
        return []
    lines = [normalize_spaces(line) for line in text.splitlines() if normalize_spaces(line)]
    if not lines:
        return []

    heading_pattern = re.compile(r"^\d+\.\d+\s+(.+)$")
    section_stop_pattern = re.compile(
        r"^\d+\.\s+(?:other accounts|consumer statements|personal information|inquiries|public records|collections|dispute|a summary of your rights)\b",
        re.IGNORECASE,
    )

    heading_indices = [idx for idx, line in enumerate(lines) if heading_pattern.match(line)]
    blocks: List[str] = []

    if heading_indices:
        for pos, start in enumerate(heading_indices):
            heading_match = heading_pattern.match(lines[start])
            if not heading_match:
                continue
            heading_text = heading_match.group(1)
            if re.search(r"\b(revolving|mortgage|installment|other)\s+accounts\b", heading_text, re.IGNORECASE):
                continue

            end = heading_indices[pos + 1] - 1 if pos + 1 < len(heading_indices) else len(lines) - 1
            for cursor in range(start + 1, min(end + 1, len(lines))):
                if section_stop_pattern.match(lines[cursor]):
                    end = cursor - 1
                    break

            if end <= start:
                continue
            block = "\n".join(lines[start : end + 1]).strip()
            if not re.search(r"\baccount\s+number\b", block, re.IGNORECASE):
                continue
            if re.search(r"\bcollection\s+agency\b", block, re.IGNORECASE):
                continue
            if len(block) >= 120:
                blocks.append(block)

        if blocks:
            return blocks

    anchor_indices = [idx for idx, line in enumerate(lines) if re.search(r"\baccount\s+number\b", line, re.IGNORECASE)]
    for pos, anchor in enumerate(anchor_indices):
        context_window = " ".join(lines[max(0, anchor - 8) : min(len(lines), anchor + 8)]).lower()
        if any(token in context_window for token in ["collection agency", "original creditor", "account designator code"]):
            continue

        start = max(0, anchor - 8)
        end = anchor_indices[pos + 1] - 1 if pos + 1 < len(anchor_indices) else min(len(lines) - 1, anchor + 130)

        for cursor in range(anchor + 1, min(end + 1, len(lines))):
            if re.match(
                r"^\d+\.\s+(?:inquiries|public records|collections|dispute|consumer statements|personal information)\b",
                lines[cursor],
                re.IGNORECASE,
            ):
                end = cursor - 1
                break

        if end <= start:
            continue

        block = "\n".join(lines[start : end + 1]).strip()
        if len(block) >= 120:
            blocks.append(block)

    return blocks


def clean_account_text(value: str) -> str:
    if not value:
        return ""
    cleaned = normalize_spaces(value)
    stop_tokens = [
        "Account History",
        "Balance Year",
        "Scheduled Payment",
        "Actual Payment",
        "Credit Limit Year",
        "Comments Contact",
        "View detailed information",
        "Contact the creditor",
        "Reported Balance",
        "Available Credit",
        "Page ",
    ]
    for token in stop_tokens:
        split = re.split(re.escape(token), cleaned, maxsplit=1, flags=re.IGNORECASE)
        cleaned = split[0].strip()
    cleaned = re.sub(r"\b[A-Z][a-z]+ [A-Z][a-z]+ \| .*?$", "", cleaned).strip()
    return normalize_spaces(cleaned)


def clean_masked_account_number(value: str) -> str:
    cleaned = str(value or "").replace("\xa0", " ")
    cleaned = re.sub(r"[\r\n\t]+", " ", cleaned).strip()
    cleaned = re.split(r"\breported\s+balance\b", cleaned, maxsplit=1, flags=re.IGNORECASE)[0].strip()
    cleaned = re.split(r"\bavailable\s+credit\b", cleaned, maxsplit=1, flags=re.IGNORECASE)[0].strip()
    cleaned = cleaned.strip(" :;,.")
    return cleaned or "Not reported"


def canonical_account_number_key(value: Any) -> str:
    cleaned = str(value or "").replace("\xa0", " ")
    cleaned = re.sub(r"[\r\n\t]+", " ", cleaned).strip()
    cleaned = re.sub(r"[^A-Za-z0-9Xx\*\-\s]", "", cleaned)
    cleaned = normalize_spaces(cleaned).lower()
    return cleaned or "not reported"


def derive_account_name(lines: List[str], account_line_index: int) -> str:
    heading_pattern = re.compile(r"^\d+\.\d+\s+(.+)$")
    for idx in range(account_line_index, max(-1, account_line_index - 80), -1):
        candidate = normalize_spaces(lines[idx])
        heading_match = heading_pattern.match(candidate)
        if not heading_match:
            continue
        heading_name = clean_account_text(heading_match.group(1))
        heading_name = re.sub(r"\((?:closed|open)\)\s*$", "", heading_name, flags=re.IGNORECASE).strip()
        if heading_name and not re.search(r"\b(revolving|installment|mortgage|other)\s+accounts\b", heading_name, re.IGNORECASE):
            return heading_name

    bad_patterns = [
        r"or lender if you have any questions",
        r"view detailed information",
        r"contact the creditor",
        r"account number",
        r"account history",
        r"page \d+ of \d+",
        r"^summary$",
        r"debt-to-credit ratio",
        r"tables below show",
        r"payment was past due",
    ]

    for idx in range(account_line_index - 1, max(-1, account_line_index - 9), -1):
        candidate = normalize_spaces(lines[idx])
        if len(candidate) < 3 or len(candidate) > 80:
            continue
        if any(re.search(pattern, candidate, re.IGNORECASE) for pattern in bad_patterns):
            continue
        if candidate in {"[", "]", "|"}:
            continue
        if re.search(r"[$%]", candidate):
            continue
        if re.search(r"\d{1,2}/\d{1,2}/\d{2,4}", candidate):
            continue
        if re.search(r"\b(?:account|status|date|balance|terms frequency|term duration|year)\b", candidate, re.IGNORECASE):
            continue
        return clean_account_text(candidate)
    return "Not reported"


def extract_account_from_block(block: str) -> Dict[str, Any]:
    lines = [normalize_spaces(line) for line in block.splitlines() if normalize_spaces(line)]
    account_line_index = 0
    account_line = ""
    heading_line = ""
    for line in lines:
        if re.match(r"^\d+\.\d+\s+.+", line):
            heading_line = line
            break

    for idx, line in enumerate(lines):
        if re.search(r"\baccount\s+number\b", line, re.IGNORECASE):
            account_line_index = idx
            account_line = line
            break

    raw_account_number = extract_first(
        [
            r"account\s+number\s*:?\s*([^\n]{4,60})",
            r"\b([X\*]{4,}[A-Z0-9X\*\-\s]{2,})\b",
        ],
        account_line or block,
    )
    account_number = clean_masked_account_number(raw_account_number) if raw_account_number else "Not reported"

    heading_match = re.match(r"^\d+\.\d+\s+(.+)$", heading_line)
    closed_hint = bool(heading_match and re.search(r"\(closed\)", heading_match.group(1), re.IGNORECASE))

    account_name = "Not reported"
    if heading_match:
        account_name = clean_account_text(heading_match.group(1))
        account_name = re.sub(r"\((?:closed|open)\)\s*$", "", account_name, flags=re.IGNORECASE).strip()
    if account_name == "Not reported" or not account_name:
        account_name = derive_account_name(lines, account_line_index)
    if account_name == "Not reported":
        account_name = extract_first(
            [
                r"creditor\s*:?\s*([^\n]+)",
                r"furnisher\s*:?\s*([^\n]+)",
            ],
            block,
        ) or "Not reported"
    account_name = clean_account_text(account_name)
    account_name = re.sub(r"^\d+\.\d+\s+", "", account_name).strip()
    if account_name in {"[", "]", "|"} or not re.search(r"[A-Za-z]{2,}", account_name):
        account_name = "Not reported"

    account = create_default_account(account_name, account_number)
    date_pattern = r"([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4}|[A-Za-z]{3,9}\s+\d{4}|\d{1,2}/\d{1,2}/\d{2,4})"

    mapping = {
        "accountType": [r"account\s+type\s*:?\s*([A-Z_ ]{3,40})"],
        "accountCategory": [r"account\s+category\s*:?\s*([A-Z_ ]{3,40})"],
        "accountOwnership": [r"account\s+ownership\s*:?\s*([A-Z_ ]{3,40})"],
        "openDate": [rf"(?:open\s+date|date\s+opened)\s*:?\s*{date_pattern}"],
        "status": [r"status\s*:?\s*([A-Z_ ]{3,60}(?:\s+Available Credit)?(?:\s+\-?\$?[\d,]+)?)"],
        "balance": [r"balance\s*:?\s*(\$?\s*[\d,]+(?:\.\d{2})?)"],
        "creditLimit": [r"credit\s+limit\s*:?\s*(\$?\s*[\d,]+(?:\.\d{2})?)"],
        "highestBalance": [r"highest\s+balance\s*:?\s*(\$?\s*[\d,]+(?:\.\d{2})?)(?=\s+payment\s+responsibility\b|$)"],
        "highCredit": [r"high\s+credit\s*:?\s*(\$?\s*[\d,]+(?:\.\d{2})?)(?=\s+payment\s+responsibility\b|$)"],
        "paymentStatus": [r"payment\s+status\s*:?\s*([A-Z_ ]{3,40})"],
        "dateOpened": [rf"date\s+opened\s*:?\s*{date_pattern}"],
        "dateReported": [rf"date\s+reported\s*:?\s*{date_pattern}"],
        "dateClosed": [rf"date\s+closed\s*:?\s*{date_pattern}"],
        "lastPaymentDate": [rf"(?:last\s+payment\s+date|date\s+of\s+last\s+payment)\s*:?\s*{date_pattern}"],
        "dateOfLastActivity": [rf"date\s+of\s+last\s+activity\s*:?\s*{date_pattern}"],
        "dateOfFirstDelinquency": [rf"date\s+of\s+first\s+delinquency\s*:?\s*{date_pattern}"],
        "delinquencyFirstReported": [rf"delinquency\s+first\s+reported\s*:?\s*{date_pattern}"],
        "deferredPaymentStartDate": [rf"deferred\s+payment\s+start\s+date\s*:?\s*{date_pattern}"],
        "balloonPaymentDate": [rf"balloon\s+payment\s+date\s*:?\s*{date_pattern}"],
        "currentBalance": [r"current\s+balance\s*:?\s*(\$?\s*[\d,]+(?:\.\d{2})?)"],
        "paymentAmount": [r"payment\s+amount\s*:?\s*(\$?\s*[\d,]+(?:\.\d{2})?)"],
        "actualPaymentAmount": [r"actual\s+payment\s+amount\s*:?\s*(\$?\s*[\d,]+(?:\.\d{2})?)"],
        "scheduledPaymentAmount": [r"scheduled\s+payment\s+amount\s*:?\s*(\$?\s*[\d,]+(?:\.\d{2})?)"],
        "amountPastDue": [r"amount\s+past\s+due\s*:?\s*(\$?\s*[\d,]+(?:\.\d{2})?)"],
        "chargeOffAmount": [r"charge\s*[- ]?off\s+amount\s*:?\s*(\$?\s*[\d,]+(?:\.\d{2})?)"],
        "balloonPaymentAmount": [r"balloon\s+payment\s+amount\s*:?\s*(\$?\s*[\d,]+(?:\.\d{2})?)"],
        "creditType": [r"credit\s+type\s*:?\s*([A-Z_ ]{3,50})"],
        "loanType": [r"loan\s+type\s*:?\s*([A-Za-z0-9 _/-]{3,50}?)(?=\s+date\s+closed\b|$)"],
        "responsibility": [r"responsibility\s*:?\s*([A-Z_ ]{3,40})"],
        "paymentResponsibility": [r"payment\s+responsibility\s*:?\s*([A-Z_ ]{3,40})"],
        "termsFrequency": [r"terms\s+frequency\s*:?\s*([A-Z_ ]{3,40}?)(?=\s+term\s+duration\b|$)"],
        "termDuration": [r"term\s+duration\s*:?\s*([A-Za-z0-9 _/-]{1,40}?)(?=\s+balance\b|\s+date\s+opened\b|$)"],
        "monthsReviewed": [r"months\s+reviewed\s*:?\s*([A-Za-z0-9 _/-]{1,20}?)(?=\s+delinquency\s+first\s+reported\b|$)"],
        "activityDesignator": [r"activity\s+designator\s*:?\s*([A-Z_ ]{3,40}?)(?=\s+creditor\s+classification\b|$)"],
        "creditorClassification": [r"creditor\s+classification\s*:?\s*([A-Za-z0-9 _/-]{3,60}?)(?=\s+deferred\s+payment\s+start\s+date\b|\s+charge\s+off\s+amount\b|$)"],
        "accountStatus": [r"account\s+status\s*:?\s*([A-Z_ ]{3,60})"],
    }

    for field, patterns in mapping.items():
        value = extract_first(patterns, block)
        if value:
            account[field] = clean_account_text(value)

    if account.get("balance") and account["balance"] != "Not reported":
        account["balance"] = parse_currency(account["balance"]) or account["balance"]
    if account.get("openDate") == "Not reported" and account.get("dateOpened") not in (None, "Not reported"):
        account["openDate"] = account["dateOpened"]
    if closed_hint:
        account["isClosed"] = True
        account["accountStatus"] = "CLOSED"

    comments = []
    additional_information = []
    for line in lines:
        clean = normalize_spaces(line)
        if clean.lower() in {"comments", "contact", "comments contact", "comments | contact"}:
            continue
        additional_information_match = re.search(r"additional information\s*[-:]\s*(.+)$", clean, re.IGNORECASE)
        if additional_information_match:
            parts = [
                clean_account_text(part)
                for part in re.split(r"[;|]+", additional_information_match.group(1))
            ]
            additional_information.extend(
                part
                for part in parts
                if part
                and part.lower() not in {"not reported", "address"}
                and not re.match(r"^address\b", part, re.IGNORECASE)
            )
        match = re.match(r"^(?:comments?|comment)\s*[:\-]\s*(.+)$", clean, re.IGNORECASE)
        if match:
            comment_value = clean_account_text(match.group(1))
            if comment_value:
                comments.append(comment_value)

    if additional_information:
        account["additionalInformation"] = unique_strings(additional_information)
    if comments:
        account["comments"] = comments

    bad_name_patterns = [r"or lender if you have any questions", r"view detailed information", r"page \d+ of \d+"]
    if account["accountName"].lower() in {"summary", "account details", "not reported"} or any(
        re.search(pattern, account["accountName"], re.IGNORECASE) for pattern in bad_name_patterns
    ):
        replacement = "Not reported"
        for candidate in lines[:8]:
            if any(re.search(pattern, candidate, re.IGNORECASE) for pattern in bad_name_patterns):
                continue
            if re.search(r"\b(account number|status|balance|date opened|terms frequency)\b", candidate, re.IGNORECASE):
                continue
            if re.search(r"[A-Za-z]{3,}", candidate) and len(candidate) <= 70:
                replacement = clean_account_text(candidate)
                break
        account["accountName"] = replacement

    if "Available Credit" in str(account.get("status", "")):
        account["status"] = clean_account_text(str(account["status"]).split("Available Credit")[0])

    return account


def is_closed_account(account: Dict[str, Any]) -> bool:
    date_closed = normalize_spaces(str(account.get("dateClosed", "")))
    if date_closed and date_closed.lower() not in {"not reported", "-", "none", "null"}:
        return True

    status_blob = " ".join(
        [
            normalize_spaces(str(account.get("status", ""))),
            normalize_spaces(str(account.get("accountStatus", ""))),
            normalize_spaces(" ".join(str(item) for item in (account.get("comments") or []))),
        ]
    ).lower()
    closed_markers = [
        "closed",
        "paid_and_closed",
        "charge_off",
        "charge-off",
        "repossession",
        "voluntary surrender",
        "closed or paid account",
    ]
    return any(marker in status_blob for marker in closed_markers)


def inventory_accounts_with_llm(text: str, ollama: OllamaClient) -> List[Dict[str, str]]:
    prompt = f"""
Return JSON only.
Identify every credit account tradeline in the excerpt.
Schema:
{{
  "accounts": [
    {{
      "accountName": "string",
      "accountNumber": "string"
    }}
  ]
}}
Do not include inquiries, public records, summaries, or collections.

Excerpt:
{text[:18000]}
"""

    try:
        response = ollama.chat(
            [
                {"role": "system", "content": "You extract strict JSON."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.0,
        )
        parsed = parse_json_safely(response)
        accounts = parsed.get("accounts") if parsed else []
        if isinstance(accounts, list):
            cleaned = []
            for entry in accounts:
                if not isinstance(entry, dict):
                    continue
                name = normalize_spaces(str(entry.get("accountName", "")))
                number = normalize_spaces(str(entry.get("accountNumber", "")))
                if name or number:
                    cleaned.append({"accountName": name or "Not reported", "accountNumber": number or "Not reported"})
            return cleaned
        return []
    except Exception:
        return []


def extract_accounts(
    text: str,
    summary_rows: List[Dict[str, Any]],
    ollama: OllamaClient,
    structured_accounts: Optional[List[Dict[str, Any]]] = None,
) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    blocks = split_account_blocks(text)
    raw_accounts = list(structured_accounts or []) + [extract_account_from_block(block) for block in blocks]
    deduped_accounts: List[Dict[str, Any]] = []
    seen_exact_keys = set()
    best_by_identity: Dict[Tuple[str, str], Dict[str, Any]] = {}
    structured_inventory_present = bool(structured_accounts)
    structured_identity_keys = {
        (
            normalize_spaces(str(account.get("accountName") or "")).lower(),
            canonical_account_number_key(account.get("accountNumber")),
        )
        for account in (structured_accounts or [])
        if canonical_account_number_key(account.get("accountNumber")) != "not reported"
    }
    structured_numbered_names = {
        normalize_spaces(str(account.get("accountName") or "")).lower()
        for account in (structured_accounts or [])
        if canonical_account_number_key(account.get("accountNumber")) != "not reported"
    }
    bad_name_pattern = re.compile(
        r"^(?:summary|account details|\[|\]|not reported|\d+\.\s*(?:revolving|mortgage|installment|other)\s+accounts?)$",
        re.IGNORECASE,
    )

    for account in raw_accounts:
        account_name = normalize_spaces(str(account.get("accountName", "")))
        account_number = clean_masked_account_number(str(account.get("accountNumber", "")))
        account_number_key = canonical_account_number_key(account_number)
        if bad_name_pattern.match(account_name):
            account_name = "Not reported"
        account["accountName"] = account_name or "Not reported"
        account["accountNumber"] = account_number

        if account["accountName"] == "Not reported" and account["accountNumber"] == "Not reported":
            continue

        key = (
            account["accountName"].lower(),
            account_number_key,
            normalize_spaces(str(account.get("dateOpened", ""))).lower(),
            normalize_spaces(str(account.get("dateReported", ""))).lower(),
            normalize_spaces(str(account.get("balance", ""))).lower(),
            normalize_spaces(str(account.get("status", ""))).lower(),
        )
        if key in seen_exact_keys:
            continue
        seen_exact_keys.add(key)

        identity_key = (account["accountName"].lower(), account_number_key)
        if identity_key[1] != "not reported":
            if structured_inventory_present and identity_key not in structured_identity_keys and identity_key not in best_by_identity:
                continue
            existing = best_by_identity.get(identity_key)
            if existing is None:
                best_by_identity[identity_key] = account
            else:
                best_by_identity[identity_key] = merge_account_records(existing, account)
            continue
        deduped_accounts.append(account)

    accounts = list(best_by_identity.values()) + deduped_accounts
    names_with_numbers = structured_numbered_names | {
        normalize_spaces(str(account.get("accountName") or "")).lower()
        for account in accounts
        if canonical_account_number_key(account.get("accountNumber")) != "not reported"
    }
    accounts = [
        account
        for account in accounts
        if not (
            canonical_account_number_key(account.get("accountNumber")) == "not reported"
            and normalize_spaces(str(account.get("accountName") or "")).lower() in names_with_numbers
        )
    ]

    llm_inventory: List[Dict[str, str]] = []
    if len(accounts) <= 1:
        llm_inventory = inventory_accounts_with_llm(text, ollama)
    known_keys = {
        (
            normalize_spaces(account.get("accountName", "")).lower(),
            canonical_account_number_key(account.get("accountNumber")),
        )
        for account in accounts
    }

    for entry in llm_inventory:
        key = (entry["accountName"].lower(), canonical_account_number_key(entry["accountNumber"]))
        if key in known_keys:
            continue
        accounts.append(create_default_account(entry["accountName"], entry["accountNumber"]))
        known_keys.add(key)

    total_accounts = len(accounts)
    closed_accounts = sum(1 for item in accounts if is_closed_account(item))
    open_accounts = max(total_accounts - closed_accounts, 0)

    for account in accounts:
        account["totalAccounts"] = total_accounts
        account["openAccounts"] = open_accounts
        account["closedAccounts"] = closed_accounts

    validation_issues = []

    expected_total = None
    for row in summary_rows:
        if str(row.get("accountType", "")).lower() == "total":
            expected_total = row.get("totalAccounts")
            break

    if isinstance(expected_total, str) and expected_total.isdigit():
        expected_total = int(expected_total)

    total_row = next((row for row in summary_rows if str(row.get("accountType", "")).lower() == "total"), None)
    open_count = None
    closed_count = None
    if total_row:
        open_count = parse_integer(str(total_row.get("open"))) if total_row.get("open") is not None else None
        closed_count = (
            parse_integer(str(total_row.get("closed"))) if total_row.get("closed") not in (None, "", "Not reported") else None
        )

    enforce_count_match = bool(
        isinstance(expected_total, int)
        and expected_total > 0
        and (closed_count is not None or (open_count is not None and expected_total != open_count))
    )

    if enforce_count_match and expected_total != len(accounts):
        validation_issues.append(
            {
                "component": "accounts",
                "severity": "error",
                "code": "count_mismatch",
                "message": f"Summary totalAccounts={expected_total} but discovered {len(accounts)} account entries.",
            }
        )

    if not accounts:
        validation_issues.append(
            {
                "component": "accounts",
                "severity": "error",
                "code": "empty_accounts",
                "message": "No accounts were discovered in the account retrieval window.",
            }
        )

    return {"accounts": accounts}, validation_issues


def split_collection_blocks(text: str) -> List[str]:
    lines = [normalize_spaces(line) for line in text.splitlines() if normalize_spaces(line)]
    if not lines:
        return []

    section_start = None
    for idx, line in enumerate(lines):
        if re.match(r"^\d+\.\s+collections\b", line, re.IGNORECASE):
            section_start = idx
            break

    section_end = len(lines)
    if section_start is not None:
        for idx in range(section_start + 1, len(lines)):
            if re.match(r"^\d+\.\s+", lines[idx]):
                section_end = idx
                break

    scoped_lines = lines[section_start:section_end] if section_start is not None else lines

    anchors: List[int] = []
    for idx, line in enumerate(scoped_lines):
        if re.match(r"^date\s+reported\b", line, re.IGNORECASE):
            anchors.append(idx)
            continue
        if re.search(r"\bcollection\s+agency\b|\boriginal\s+creditor\b", line, re.IGNORECASE):
            anchors.append(idx)

    if not anchors:
        return []

    deduped = sorted(set(anchors))
    blocks: List[str] = []
    for pos, anchor in enumerate(deduped):
        start = max(0, anchor - 2)
        end = deduped[pos + 1] - 1 if pos + 1 < len(deduped) else min(len(scoped_lines) - 1, anchor + 120)

        for cursor in range(anchor + 1, min(end + 1, len(scoped_lines))):
            if re.match(r"^\d+\.\s+", scoped_lines[cursor]):
                end = cursor - 1
                break

        if end <= start:
            continue
        block = "\n".join(scoped_lines[start : end + 1]).strip()
        if len(block) >= 80:
            blocks.append(block)

    return blocks


def clean_collection_text(value: str) -> str:
    cleaned = normalize_spaces(value)
    for token in [
        "Balance Date",
        "Original Creditor Name",
        "Account Designator Code",
        "Date Assigned",
        "Original Amount Owed",
        "Creditor Classification",
        "Last Payment Date",
        "Date of First Delinquency",
        "Comments",
        "Contact",
        "How to dispute",
        "Page ",
        "View detailed information",
        "Collections stay on your",
    ]:
        split = re.split(re.escape(token), cleaned, maxsplit=1, flags=re.IGNORECASE)
        cleaned = split[0].strip()
    return normalize_spaces(cleaned)


def extract_collection_from_block(block: str) -> Dict[str, Any]:
    record = create_default_collection()
    flat_block = normalize_spaces(" ".join(block.splitlines()))
    date_pattern = r"([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4}|[A-Za-z]{3,9}\s+\d{4}|\d{1,2}/\d{1,2}/\d{2,4})"

    field_patterns = {
        "dateReported": [rf"date\s+reported\s*:?\s*{date_pattern}"],
        "collectionAgency": [r"collection\s+agency\s*:?\s*(.+?)(?=\s+balance\s+date\b)"],
        "balanceDate": [rf"balance\s+date\s*:?\s*{date_pattern}"],
        "originalCreditorName": [r"original\s+creditor(?:\s+name)?\s*:?\s*(.+?)(?=\s+account\s+designator\s+code\b)"],
        "accountDesignatorCode": [r"account\s+designator\s+code\s*:?\s*([A-Z_ ]{3,40})"],
        "dateAssigned": [rf"date\s+assigned\s*:?\s*{date_pattern}"],
        "accountNumber": [
            r"account\s+number\s*:?\s*([A-Z0-9Xx\*\-\s]{4,24}?)(?=\s+original\s+amount\s+owed\b|\s+creditor\s+classification\b|\s+amount\b|$)"
        ],
        "originalAmountOwed": [r"original\s+amount\s+owed\s*:?\s*(\$?\s*[\d,]+(?:\.\d{2})?)"],
        "creditorClassification": [r"creditor\s+classification\s*:?\s*(.+?)(?=\s+amount\b|\s+last\s+payment\s+date\b|$)"],
        "amount": [r"(?:amount|current\s+balance)\s*:?\s*(\$?\s*[\d,]+(?:\.\d{2})?)"],
        "lastPaymentDate": [rf"last\s+payment\s+date\s*:?\s*{date_pattern}"],
        "statusDate": [rf"status\s+date\s*:?\s*{date_pattern}"],
        "dateOfFirstDelinquency": [rf"date\s+of\s+first\s+delinquency\s*:?\s*{date_pattern}"],
        "status": [r"status\s*:?\s*([A-Za-z_ ]{3,80})"],
    }

    for field_name, patterns in field_patterns.items():
        value = extract_first(patterns, flat_block)
        if value:
            record[field_name] = clean_collection_text(value)

    if record.get("accountNumber"):
        record["accountNumber"] = clean_masked_account_number(str(record["accountNumber"]))

    if record.get("collectionAgency"):
        agency = clean_collection_text(str(record["collectionAgency"]))
        if agency.endswith("COLLECTION"):
            agency_fallback = extract_first([r"\b([A-Z][A-Z/&., ]+COLLECTION SERVICES)\b"], block)
            if agency_fallback:
                agency = normalize_spaces(agency_fallback)
        record["collectionAgency"] = agency
    else:
        agency_fallback = extract_first([r"\b([A-Z][A-Z/&., ]+COLLECTION SERVICES)\b"], block)
        if agency_fallback:
            record["collectionAgency"] = normalize_spaces(agency_fallback)

    for money_field in ["originalAmountOwed", "amount"]:
        value = record.get(money_field)
        if value:
            record[money_field] = parse_currency(value)

    if record.get("status") and str(record["status"]).lower().startswith("date "):
        record["status"] = None

    comments = []
    contacts = []
    for line in block.splitlines():
        clean = normalize_spaces(line)
        if not clean:
            continue
        if clean.lower() in {"comments", "contact", "comments contact"}:
            continue
        if "comment" in clean.lower():
            comments.append(clean)
        if any(token in clean.lower() for token in ["phone", "www", "@", "address", "contact"]) or re.search(
            r"\(\d{3}\)\s*\d{3}-\d{4}",
            clean,
        ):
            contacts.append(clean)

    if comments:
        record["comments"] = comments
    if contacts:
        record["contact"] = contacts

    return record


def extract_collections(
    text: str,
    expected_count: Optional[int],
    structured_collections: Optional[List[Dict[str, Any]]] = None,
) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    blocks = split_collection_blocks(text)
    raw_collections = list(structured_collections or []) + [extract_collection_from_block(block) for block in blocks]
    deduped_collections: List[Dict[str, Any]] = []
    seen_keys = set()
    merged_by_identity: Dict[Tuple[str, str], Dict[str, Any]] = {}

    def collection_score(collection: Dict[str, Any]) -> int:
        score_fields = [
            "collectionAgency",
            "accountNumber",
            "originalCreditorName",
            "amount",
            "originalAmountOwed",
            "dateReported",
            "status",
        ]
        return sum(1 for field in score_fields if collection.get(field))

    suspicious_patterns = [
        r"collections?\s+stay\s+on\s+your",
        r"view detailed information",
        r"how to dispute",
    ]

    for collection in raw_collections:
        if any(
            re.search(pattern, str(collection.get("collectionAgency", "")), re.IGNORECASE)
            for pattern in suspicious_patterns
        ):
            continue
        agency_text = normalize_spaces(str(collection.get("collectionAgency") or ""))
        if agency_text and not re.search(r"[A-Za-z]{3,}", agency_text):
            continue
        if collection_score(collection) < 2:
            continue

        key = (
            normalize_spaces(str(collection.get("collectionAgency", ""))).lower(),
            normalize_spaces(str(collection.get("accountNumber", ""))).lower(),
            normalize_spaces(str(collection.get("originalCreditorName", ""))).lower(),
            normalize_spaces(str(collection.get("dateReported", ""))).lower(),
            normalize_spaces(str(collection.get("statusDate", ""))).lower(),
            normalize_spaces(str(collection.get("amount", ""))).lower(),
        )
        if key in seen_keys:
            continue
        seen_keys.add(key)
        identity_key = (
            normalize_spaces(str(collection.get("collectionAgency", ""))).lower(),
            normalize_spaces(
                str(collection.get("accountNumber") or collection.get("originalCreditorName") or "")
            ).lower(),
        )
        if all(identity_key):
            existing = merged_by_identity.get(identity_key)
            if existing is None:
                merged_by_identity[identity_key] = collection
            else:
                merged_by_identity[identity_key] = merge_collection_records(existing, collection)
            continue
        deduped_collections.append(collection)
    collections = list(merged_by_identity.values()) + deduped_collections

    if isinstance(expected_count, int) and expected_count == 1 and len(collections) > 1:
        ranked = sorted(collections, key=collection_score, reverse=True)
        merged = ranked[0]
        for item in ranked[1:]:
            merged = merge_collection_records(merged, item)
        collections = [merged]

    if isinstance(expected_count, int) and expected_count > 0 and len(collections) > expected_count:
        collections = sorted(collections, key=collection_score, reverse=True)[:expected_count]

    validation = []
    if expected_count is not None and expected_count > 0 and len(collections) != expected_count:
        validation.append(
            {
                "component": "collections",
                "severity": "error",
                "code": "count_mismatch",
                "message": f"Expected {expected_count} collections from summary but extracted {len(collections)}.",
            }
        )

    return {
        "collections": collections,
        "collectionCount": len(collections),
        "collectionFields": create_default_components()["collections"]["collectionFields"],
    }, validation


def assess_component_status(validation_issues: List[Dict[str, Any]]) -> Dict[str, str]:
    status = {name: "complete" for name in COMPONENT_NAMES}

    for issue in validation_issues:
        component = issue.get("component")
        severity = str(issue.get("severity", "error")).lower()
        if component in status and severity in {"error", "critical"}:
            status[component] = "failed"

    return status


def cross_validate(
    components: Dict[str, Any],
) -> List[Dict[str, Any]]:
    issues: List[Dict[str, Any]] = []

    summary_rows = components.get("creditAccountsSummary") or []
    accounts_container = components.get("accounts") or {"accounts": []}
    collections_container = components.get("collections") or {"collections": []}
    other_items = components.get("otherItemsSummary") or {}
    inquiries = components.get("inquiries") or {}

    total_summary_accounts = None
    total_row = None
    for row in summary_rows:
        if str(row.get("accountType", "")).lower() == "total":
            total_row = row
            total_summary_accounts = row.get("totalAccounts")
            break

    if isinstance(total_summary_accounts, str) and total_summary_accounts.isdigit():
        total_summary_accounts = int(total_summary_accounts)

    total_open = parse_integer(str(total_row.get("open"))) if isinstance(total_row, dict) and total_row.get("open") is not None else None
    total_closed = (
        parse_integer(str(total_row.get("closed")))
        if isinstance(total_row, dict) and total_row.get("closed") not in (None, "", "Not reported")
        else None
    )
    enforce_account_mismatch = bool(
        isinstance(total_summary_accounts, int)
        and total_summary_accounts > 0
        and (total_closed is not None or (total_open is not None and total_summary_accounts != total_open))
    )

    extracted_accounts = len(accounts_container.get("accounts") or [])
    if enforce_account_mismatch and total_summary_accounts != extracted_accounts:
        issues.append(
            {
                "component": "accounts",
                "severity": "error",
                "code": "cross_component_mismatch",
                "message": f"Account summary total ({total_summary_accounts}) does not match extracted accounts ({extracted_accounts}).",
            }
        )

    summary_collection_count = other_items.get("collectionCount")
    extracted_collection_count = len(collections_container.get("collections") or [])
    if isinstance(summary_collection_count, int) and summary_collection_count > 0 and summary_collection_count != extracted_collection_count:
        issues.append(
            {
                "component": "collections",
                "severity": "error",
                "code": "cross_component_mismatch",
                "message": f"Other items collection count ({summary_collection_count}) does not match extracted collections ({extracted_collection_count}).",
            }
        )

    public_records_container = components.get("publicRecords") or {"records": []}
    summary_public_record_count = other_items.get("publicRecordCount")
    extracted_public_record_count = len(public_records_container.get("records") or [])
    if (
        isinstance(summary_public_record_count, int)
        and summary_public_record_count > 0
        and summary_public_record_count != extracted_public_record_count
    ):
        issues.append(
            {
                "component": "publicRecords",
                "severity": "error",
                "code": "cross_component_mismatch",
                "message": f"Other items public-record count ({summary_public_record_count}) does not match extracted public records ({extracted_public_record_count}).",
            }
        )

    summary_inquiry_count = other_items.get("inquiryCount")
    extracted_inquiry_count = (inquiries.get("hardInquiryCount") or 0) + (inquiries.get("softInquiryCount") or 0)
    if isinstance(summary_inquiry_count, int) and summary_inquiry_count > 0 and summary_inquiry_count != extracted_inquiry_count:
        issues.append(
            {
                "component": "inquiries",
                "severity": "error",
                "code": "cross_component_mismatch",
                "message": f"Other items inquiry count ({summary_inquiry_count}) does not match extracted inquiries ({extracted_inquiry_count}).",
            }
        )

    return issues


def ensure_component_required_fields(components: Dict[str, Any]) -> List[Dict[str, Any]]:
    issues: List[Dict[str, Any]] = []

    confirmation = components.get("reportConfirmationDetails") or {}
    if not confirmation.get("confirmationNumber"):
        issues.append(
            {
                "component": "reportConfirmationDetails",
                "severity": "error",
                "code": "missing_confirmation_number",
                "message": "Confirmation number could not be extracted.",
            }
        )

    if not confirmation.get("reportDate"):
        issues.append(
            {
                "component": "reportConfirmationDetails",
                "severity": "error",
                "code": "missing_report_date",
                "message": "Report date could not be extracted.",
            }
        )

    personal = components.get("personalInformation") or {}
    if not personal.get("name"):
        issues.append(
            {
                "component": "personalInformation",
                "severity": "error",
                "code": "missing_personal_name",
                "message": "Personal information name was not extracted.",
            }
        )

    if not isinstance(components.get("creditAccountsSummary"), list):
        issues.append(
            {
                "component": "creditAccountsSummary",
                "severity": "error",
                "code": "invalid_summary_schema",
                "message": "Credit accounts summary is not in expected array format.",
            }
        )
    else:
        rows = components.get("creditAccountsSummary") or []
        if len(rows) != len(REQUIRED_ACCOUNT_TYPES):
            issues.append(
                {
                    "component": "creditAccountsSummary",
                    "severity": "error",
                    "code": "invalid_row_count",
                    "message": f"Credit accounts summary must contain exactly {len(REQUIRED_ACCOUNT_TYPES)} rows.",
                }
            )
        for idx, expected_type in enumerate(REQUIRED_ACCOUNT_TYPES):
            row = rows[idx] if idx < len(rows) else {}
            actual_type = row.get("accountType") if isinstance(row, dict) else None
            if actual_type != expected_type:
                issues.append(
                    {
                        "component": "creditAccountsSummary",
                        "severity": "error",
                        "code": "invalid_row_order",
                        "message": f"Row {idx + 1} must be '{expected_type}'.",
                    }
                )

    accounts_container = components.get("accounts") or {}
    if not isinstance(accounts_container, dict) or not isinstance(accounts_container.get("accounts"), list):
        issues.append(
            {
                "component": "accounts",
                "severity": "error",
                "code": "invalid_accounts_schema",
                "message": "Accounts component must contain an accounts array.",
            }
        )
    else:
        for index, account in enumerate(accounts_container.get("accounts") or []):
            if not isinstance(account, dict):
                issues.append(
                    {
                        "component": "accounts",
                        "severity": "error",
                        "code": "invalid_account_entry",
                        "message": f"Account index {index} is not an object.",
                    }
                )
                continue
            for history_key in [
                "balanceHistory",
                "scheduledPaymentHistory",
                "actualPaymentHistory",
                "creditLimitHistory",
                "amountPastDueHistory",
                "activityDesignatorHistory",
            ]:
                history = account.get(history_key)
                # Empty is a legitimate face state: some tradelines print no
                # money-history tables at all (QC face-verified, Session 23 F1).
                # The March-era worker fabricated 3 placeholder rows (year '-')
                # for them; honest [] must not be flagged as an error.
                if not isinstance(history, list) or len(history) not in (0, 3):
                    issues.append(
                        {
                            "component": "accounts",
                            "severity": "error",
                            "code": "invalid_history_rows",
                            "message": f"Account index {index} has invalid '{history_key}' shape.",
                        }
                    )
            payment_history = account.get("paymentHistory")
            if (
                not isinstance(payment_history, list)
                or len(payment_history) < 12
                or len(payment_history) % 12 != 0
            ):
                issues.append(
                    {
                        "component": "accounts",
                        "severity": "error",
                        "code": "invalid_payment_history_length",
                        "message": f"Account index {index} paymentHistory must contain complete month rows (12 entries per year).",
            }
        )

    public_records = components.get("publicRecords") or {}
    if not isinstance(public_records.get("records"), list):
        issues.append(
            {
                "component": "publicRecords",
                "severity": "error",
                "code": "invalid_public_records_schema",
                "message": "Public records component must contain a records array.",
            }
        )

    collections_component = components.get("collections") or {}
    if not isinstance(collections_component, dict):
        issues.append(
            {
                "component": "collections",
                "severity": "error",
                "code": "invalid_collections_schema",
                "message": "Collections component must be an object.",
            }
        )
    else:
        if not isinstance(collections_component.get("collections"), list):
            issues.append(
                {
                    "component": "collections",
                    "severity": "error",
                    "code": "invalid_collections_list",
                    "message": "Collections component must contain a collections array.",
                }
            )

    inquiries_component = components.get("inquiries") or {}
    if not isinstance(inquiries_component, dict):
        issues.append(
            {
                "component": "inquiries",
                "severity": "error",
                "code": "invalid_inquiries_schema",
                "message": "Inquiries component must be an object.",
            }
        )
    else:
        if not isinstance(inquiries_component.get("hardInquiries"), list) or not isinstance(
            inquiries_component.get("softInquiries"), list
        ):
            issues.append(
                {
                    "component": "inquiries",
                    "severity": "error",
                    "code": "invalid_inquiry_lists",
                    "message": "Inquiries must contain hardInquiries and softInquiries arrays.",
                }
            )

    return issues


def generate_experian_result(
    args: argparse.Namespace,
    session_dir: Path,
    input_pdf: Path,
    output_json: Path,
    started_at: float,
    ollama: OllamaClient,
    progress_callback: Optional[Callable[[Dict[str, Any]], None]],
) -> Dict[str, Any]:
    from experian_profile import EXPERIAN_COMPONENT_NAMES, extract_experian_components

    emit_progress(progress_callback, 22.0, "Starting backend extraction...")

    page_artifacts, plain_text = build_page_artifacts(
        input_pdf,
        session_dir,
        args.max_pages,
        progress_callback=progress_callback,
    )
    page_tree = build_pageindex_tree(
        input_pdf,
        page_artifacts,
        ollama,
        Path(args.pageindex_root) if args.pageindex_root else None,
    )

    emit_progress(
        progress_callback,
        74.0,
        "Routing Experian report sections for extraction...",
        totalPages=len(page_artifacts),
        processedPages=len(page_artifacts),
    )

    emit_progress(progress_callback, 78.0, "Extracting Experian overview and personal information...")
    components, validation_issues, page_windows, component_sources = extract_experian_components(page_artifacts)
    account_field_evidence = collect_account_field_evidence((components.get("accounts") or {}).get("accounts"))
    account_history_evidence = collect_account_history_evidence((components.get("accounts") or {}).get("accounts"))
    account_sources = collect_account_source_metadata(
        (components.get("accounts") or {}).get("accounts"),
        page_windows.get("accounts"),
    )

    emit_progress(progress_callback, 92.0, "Validating Experian extracted report data...")
    component_status = {name: "complete" for name in EXPERIAN_COMPONENT_NAMES}
    for issue in validation_issues:
        component = issue.get("component")
        severity = str(issue.get("severity", "error")).lower()
        if component in component_status and severity in {"error", "critical"}:
            component_status[component] = "failed"
    ready_for_attorney = all(component_status[name] == "complete" for name in EXPERIAN_COMPONENT_NAMES)

    ended_at = time.time()
    result = {
        "profile": args.profile,
        "components": components,
        "componentStatus": component_status,
        "validationIssues": validation_issues,
        "readyForAttorney": ready_for_attorney,
        "meta": {
            "sessionId": args.session_id,
            "model": args.model,
            "profileId": args.profile,
            "ollamaBaseUrl": args.ollama_base_url,
            "pageCount": len(page_artifacts),
            "processingMs": int((ended_at - started_at) * 1000),
            "pageWindows": page_windows,
            "componentSources": component_sources,
            "pageIndexSource": page_tree.get("source", "heuristic"),
            "pageIndexFallbackReason": page_tree.get("fallback_reason"),
            "layoutArtifactsPath": str(session_dir / "ingestion" / "layout-artifacts.json"),
            "accountFieldEvidence": account_field_evidence,
            "accountHistoryEvidence": account_history_evidence,
            "accountSources": account_sources,
            "layoutSummary": [
                {
                    "page": page.page_number,
                    "rowCount": len(page.layout_rows),
                    "itemCount": len(page.layout_items),
                    "tableCount": len(page.layout_tables),
                    "parseConcernCount": len(page.parse_concerns),
                }
                for page in page_artifacts
            ],
            "ingestion": [
                {
                    "page": page.page_number,
                    "textQuality": round(page.text_quality, 4),
                    "tableQuality": round(page.table_quality, 4),
                    "hasOCR": bool(page.ocr_text),
                    "imagePath": page.image_path,
                    "tableCount": len(page.layout_tables),
                    "parseConcernCount": len(page.parse_concerns),
                }
                for page in page_artifacts
            ],
            "fullText": plain_text,
            "reportDate": (components.get("reportOverview") or {}).get("dateGenerated"),
            "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        },
    }

    payload = {
        "status": "ok",
        "result": result,
    }

    emit_progress(progress_callback, 99.0, "Writing extracted result...")
    output_json.parent.mkdir(parents=True, exist_ok=True)
    output_json.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return payload


def generate_equifax_new_result(
    args: argparse.Namespace,
    session_dir: Path,
    input_pdf: Path,
    output_json: Path,
    started_at: float,
    ollama: OllamaClient,
    progress_callback: Optional[Callable[[Dict[str, Any]], None]],
) -> Dict[str, Any]:
    from equifax_new_profile import EQUIFAX_NEW_COMPONENT_NAMES, extract_equifax_new_components

    emit_progress(progress_callback, 22.0, "Starting backend extraction...")

    page_artifacts, plain_text = build_page_artifacts(
        input_pdf,
        session_dir,
        args.max_pages,
        progress_callback=progress_callback,
    )
    page_tree = build_pageindex_tree(
        input_pdf,
        page_artifacts,
        ollama,
        Path(args.pageindex_root) if args.pageindex_root else None,
    )

    emit_progress(
        progress_callback,
        74.0,
        "Routing Equifax report sections for extraction...",
        totalPages=len(page_artifacts),
        processedPages=len(page_artifacts),
    )

    components, validation_issues, page_windows, component_sources = run_with_progress_heartbeat(
        lambda: extract_equifax_new_components(page_artifacts),
        progress_callback,
        82.0,
        96.0,
        "Extracting Equifax account inventory and top-level sections...",
        increment=0.25,
        totalPages=len(page_artifacts),
        processedPages=len(page_artifacts),
    )

    emit_progress(progress_callback, 97.0, "Validating Equifax extracted report data...")
    component_status = {name: "complete" for name in EQUIFAX_NEW_COMPONENT_NAMES}
    for issue in validation_issues:
        component = issue.get("component")
        severity = str(issue.get("severity", "error")).lower()
        if component in component_status and severity in {"error", "critical"}:
            component_status[component] = "failed"
    ready_for_attorney = all(component_status[name] == "complete" for name in EQUIFAX_NEW_COMPONENT_NAMES)

    emit_progress(progress_callback, 98.0, "Assembling Equifax extracted report data...")
    ended_at = time.time()
    result = {
        "profile": args.profile,
        "components": components,
        "componentStatus": component_status,
        "validationIssues": validation_issues,
        "readyForAttorney": ready_for_attorney,
        "meta": {
            "sessionId": args.session_id,
            "model": args.model,
            "profileId": args.profile,
            "ollamaBaseUrl": args.ollama_base_url,
            "pageCount": len(page_artifacts),
            "processingMs": int((ended_at - started_at) * 1000),
            "pageWindows": page_windows,
            "componentSources": component_sources,
            "pageIndexSource": page_tree.get("source", "heuristic"),
            "pageIndexFallbackReason": page_tree.get("fallback_reason"),
            # Additive (2026-07-12): eq-new now emits accountHistoryEvidence in the
            # equifax_old schema (per-cell bbox -> pdfBBox + provenance id via the
            # shared collector) so the dispute evidence generator can highlight
            # measured cells. month24:* field keys are remapped to their canonical
            # history-field names for downstream consumers.
            "accountHistoryEvidence": collect_account_history_evidence(
                remap_equifax_new_history_fields((components.get("accounts") or {}).get("accounts"))
            ),
            "layoutArtifactsPath": str(session_dir / "ingestion" / "layout-artifacts.json"),
            "layoutSummary": [
                {
                    "page": page.page_number,
                    "rowCount": len(page.layout_rows),
                    "itemCount": len(page.layout_items),
                    "tableCount": len(page.layout_tables),
                    "parseConcernCount": len(page.parse_concerns),
                }
                for page in page_artifacts
            ],
            "ingestion": [
                {
                    "page": page.page_number,
                    "textQuality": round(page.text_quality, 4),
                    "tableQuality": round(page.table_quality, 4),
                    "hasOCR": bool(page.ocr_text),
                    "imagePath": page.image_path,
                    "tableCount": len(page.layout_tables),
                    "parseConcernCount": len(page.parse_concerns),
                }
                for page in page_artifacts
            ],
            "fullText": plain_text,
            "reportDate": (components.get("reportConfirmationDetails") or {}).get("reportDate")
            or (components.get("summary") or {}).get("reportDate"),
            "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        },
    }

    emit_progress(progress_callback, 98.5, "Preparing Equifax output payload...")
    payload = {
        "status": "ok",
        "result": result,
    }

    emit_progress(progress_callback, 99.0, "Writing extracted result...")
    output_json.parent.mkdir(parents=True, exist_ok=True)
    output_json.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return payload


def generate_transunion_result(
    args: argparse.Namespace,
    session_dir: Path,
    input_pdf: Path,
    output_json: Path,
    started_at: float,
    ollama: OllamaClient,
    progress_callback: Optional[Callable[[Dict[str, Any]], None]],
) -> Dict[str, Any]:
    from transunion_profile import TRANSUNION_COMPONENT_NAMES, extract_transunion_components

    emit_progress(progress_callback, 22.0, "Starting backend extraction...")

    page_artifacts, plain_text = build_page_artifacts(
        input_pdf,
        session_dir,
        args.max_pages,
        progress_callback=progress_callback,
    )

    page_tree = build_pageindex_tree(
        input_pdf,
        page_artifacts,
        ollama,
        Path(args.pageindex_root) if args.pageindex_root else None,
    )

    emit_progress(
        progress_callback,
        74.0,
        "Routing TransUnion report sections for extraction...",
        totalPages=len(page_artifacts),
        processedPages=len(page_artifacts),
    )

    emit_progress(progress_callback, 82.0, "Extracting TransUnion overview, personal information, and account inventory...")
    components, validation_issues, page_windows, component_sources = extract_transunion_components(page_artifacts)

    emit_progress(progress_callback, 92.0, "Validating TransUnion extracted report data...")
    component_status = {name: "complete" for name in TRANSUNION_COMPONENT_NAMES}
    for issue in validation_issues:
        component = issue.get("component")
        severity = str(issue.get("severity", "error")).lower()
        if component in component_status and severity in {"error", "critical"}:
            component_status[component] = "failed"
    ready_for_attorney = all(component_status[name] == "complete" for name in TRANSUNION_COMPONENT_NAMES)

    ended_at = time.time()
    result = {
        "profile": args.profile,
        "components": components,
        "componentStatus": component_status,
        "validationIssues": validation_issues,
        "readyForAttorney": ready_for_attorney,
        "meta": {
            "sessionId": args.session_id,
            "model": args.model,
            "profileId": args.profile,
            "ollamaBaseUrl": args.ollama_base_url,
            "pageCount": len(page_artifacts),
            "processingMs": int((ended_at - started_at) * 1000),
            "pageWindows": page_windows,
            "componentSources": component_sources,
            "pageIndexSource": page_tree.get("source", "heuristic"),
            "pageIndexFallbackReason": page_tree.get("fallback_reason"),
            "layoutArtifactsPath": str(session_dir / "ingestion" / "layout-artifacts.json"),
            "layoutSummary": [
                {
                    "page": page.page_number,
                    "rowCount": len(page.layout_rows),
                    "itemCount": len(page.layout_items),
                    "tableCount": len(page.layout_tables),
                    "parseConcernCount": len(page.parse_concerns),
                }
                for page in page_artifacts
            ],
            "ingestion": [
                {
                    "page": page.page_number,
                    "textQuality": round(page.text_quality, 4),
                    "tableQuality": round(page.table_quality, 4),
                    "hasOCR": bool(page.ocr_text),
                    "imagePath": page.image_path,
                    "tableCount": len(page.layout_tables),
                    "parseConcernCount": len(page.parse_concerns),
                }
                for page in page_artifacts
            ],
            "fullText": plain_text,
            "reportDate": (components.get("reportOverview") or {}).get("creditReportDate")
            or (components.get("reportOverview") or {}).get("dateCreated"),
            "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        },
    }

    payload = {
        "status": "ok",
        "result": result,
    }

    emit_progress(progress_callback, 99.0, "Writing extracted result...")
    output_json.parent.mkdir(parents=True, exist_ok=True)
    output_json.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return payload


def generate_result(
    args: argparse.Namespace,
) -> Dict[str, Any]:
    session_dir = Path(args.session_dir)
    input_pdf = Path(args.input_pdf)
    output_json = Path(args.output_json)

    if not input_pdf.exists():
        raise WorkerError(f"Input PDF not found: {input_pdf}")

    session_dir.mkdir(parents=True, exist_ok=True)

    started_at = time.time()
    ollama = OllamaClient(args.ollama_base_url, args.model)

    if args.profile == EXPERIAN_PROFILE_ID:
        return generate_experian_result(
            args,
            session_dir,
            input_pdf,
            output_json,
            started_at,
            ollama,
            stdout_progress_callback,
        )

    if args.profile == EQUIFAX_NEW_PROFILE_ID:
        return generate_equifax_new_result(
            args,
            session_dir,
            input_pdf,
            output_json,
            started_at,
            ollama,
            stdout_progress_callback,
        )

    if args.profile == TRANSUNION_PROFILE_ID:
        return generate_transunion_result(
            args,
            session_dir,
            input_pdf,
            output_json,
            started_at,
            ollama,
            stdout_progress_callback,
        )

    profile_config = load_profile_config(args.profile, Path(__file__).resolve().parent)
    component_keywords = profile_config.get("sectionAnchors", COMPONENT_KEYWORDS)
    include_neighbors = bool((profile_config.get("retrieval") or {}).get("includeNeighbors", True))
    required_components = [
        component for component in profile_config.get("requiredComponents", COMPONENT_NAMES) if component in COMPONENT_NAMES
    ] or COMPONENT_NAMES
    progress_callback = stdout_progress_callback

    emit_progress(progress_callback, 22.0, "Starting backend extraction...")

    page_artifacts, plain_text = build_page_artifacts(
        input_pdf,
        session_dir,
        args.max_pages,
        progress_callback=progress_callback,
    )
    page_tree = build_pageindex_tree(input_pdf, page_artifacts, ollama, Path(args.pageindex_root) if args.pageindex_root else None)

    emit_progress(
        progress_callback,
        74.0,
        "Routing report sections for extraction...",
        totalPages=len(page_artifacts),
        processedPages=len(page_artifacts),
    )

    components = create_default_components()
    validation_issues: List[Dict[str, Any]] = []

    page_windows = {
        component: select_pages_for_component(
            component,
            page_artifacts,
            page_tree,
            component_keywords,
            include_neighbors=include_neighbors,
        )
        for component in COMPONENT_NAMES
    }

    confirmation_text_layer = text_for_pages(page_artifacts, page_windows["reportConfirmationDetails"], source="text_layer")
    confirmation_text_fused = text_for_pages(page_artifacts, page_windows["reportConfirmationDetails"], source="fused")
    personal_text_layer = text_for_pages(page_artifacts, page_windows["personalInformation"], source="text_layer")
    personal_text_fused = text_for_pages(page_artifacts, page_windows["personalInformation"], source="fused")
    summary_text_layer = text_for_pages(page_artifacts, page_windows["summary"], source="text_layer")
    summary_text_fused = text_for_pages(page_artifacts, page_windows["summary"], source="fused")
    other_items_text_layer = text_for_pages(page_artifacts, page_windows["otherItemsSummary"], source="text_layer")
    other_items_text_fused = text_for_pages(page_artifacts, page_windows["otherItemsSummary"], source="fused")
    account_table_text = text_for_pages(page_artifacts, page_windows["creditAccountsSummary"], source="text_layer")
    account_table_image_text = text_for_pages(page_artifacts, page_windows["creditAccountsSummary"], source="ocr")
    accounts_text = text_for_pages(page_artifacts, page_windows["accounts"], source="fused")
    collections_text = text_for_pages(page_artifacts, page_windows["collections"], source="fused")
    inquiries_text = text_for_pages(page_artifacts, page_windows["inquiries"], source="text_layer")

    progress_steps = {
        "reportConfirmationDetails": 76.0,
        "personalInformation": 78.0,
        "summary": 80.0,
        "creditAccountsSummary": 83.0,
        "otherItemsSummary": 85.0,
        "publicRecords": 86.5,
        "inquiries": 88.0,
        "accounts": 92.0,
        "collections": 95.0,
    }

    emit_progress(progress_callback, progress_steps["reportConfirmationDetails"], "Extracting report confirmation details...")
    confirmation_primary = extract_report_confirmation(confirmation_text_layer)
    confirmation_fallback = extract_report_confirmation(confirmation_text_fused)
    confirmation_report_wide = extract_report_confirmation(plain_text)
    components["reportConfirmationDetails"] = merge_missing_fields(
        merge_missing_fields(confirmation_primary, confirmation_fallback),
        confirmation_report_wide,
    )

    emit_progress(progress_callback, progress_steps["personalInformation"], "Extracting personal information...")
    personal_primary = extract_personal_information_from_layout(page_artifacts, page_windows["personalInformation"])
    personal_fallback = extract_personal_information(personal_text_fused)
    components["personalInformation"] = merge_missing_fields(personal_primary, personal_fallback)

    emit_progress(progress_callback, progress_steps["summary"], "Extracting report summary...")
    summary_primary = extract_summary(summary_text_layer)
    summary_fallback = extract_summary(summary_text_fused)
    components["summary"] = merge_missing_fields(summary_primary, summary_fallback)

    emit_progress(progress_callback, progress_steps["creditAccountsSummary"], "Extracting credit accounts summary table...")
    structured_credit_accounts_summary, structured_table_issues = extract_credit_accounts_summary_from_tables(
        layout_tables_for_pages(page_artifacts, page_windows["creditAccountsSummary"]),
        ollama=ollama,
    )
    credit_accounts_summary, table_issues = extract_credit_accounts_summary(
        account_table_text,
        account_table_image_text,
    )
    credit_accounts_summary = merge_credit_summary_rows(structured_credit_accounts_summary, credit_accounts_summary)
    components["creditAccountsSummary"] = credit_accounts_summary
    validation_issues.extend(structured_table_issues)
    validation_issues.extend(table_issues)

    emit_progress(progress_callback, progress_steps["otherItemsSummary"], "Extracting other items summary...")
    other_primary = extract_other_items_summary(other_items_text_layer)
    other_fallback = extract_other_items_summary(other_items_text_fused)
    components["otherItemsSummary"] = merge_missing_fields(other_primary, other_fallback)

    emit_progress(progress_callback, progress_steps["publicRecords"], "Extracting public records...")
    components["publicRecords"] = extract_public_records(page_artifacts, page_windows["publicRecords"])

    emit_progress(progress_callback, progress_steps["inquiries"], "Extracting inquiries...")
    row_inquiries, row_inquiry_issues = extract_inquiries_from_rows(page_artifacts, page_windows["inquiries"])
    table_inquiries, structured_inquiry_issues = extract_inquiries_from_tables(page_artifacts, page_windows["inquiries"])
    structured_inquiries = {
        "hardInquiries": merge_inquiry_entries(
            row_inquiries.get("hardInquiries") or [],
            table_inquiries.get("hardInquiries") or [],
        ),
        "softInquiries": merge_inquiry_entries(
            row_inquiries.get("softInquiries") or [],
            table_inquiries.get("softInquiries") or [],
        ),
    }
    structured_inquiries["hardInquiryCount"] = len(structured_inquiries["hardInquiries"])
    structured_inquiries["softInquiryCount"] = len(structured_inquiries["softInquiries"])
    inquiries_component = structured_inquiries if (
        (structured_inquiries.get("hardInquiryCount") or 0) + (structured_inquiries.get("softInquiryCount") or 0)
    ) > 0 else extract_inquiries(inquiries_text)
    inquiries_component["hardInquiryCount"] = len(inquiries_component["hardInquiries"])
    inquiries_component["softInquiryCount"] = len(inquiries_component["softInquiries"])
    validation_issues.extend(row_inquiry_issues)
    validation_issues.extend(structured_inquiry_issues)
    expected_inquiries = components["otherItemsSummary"].get("inquiryCount")
    extracted_inquiries = (inquiries_component.get("hardInquiryCount") or 0) + (inquiries_component.get("softInquiryCount") or 0)
    if isinstance(expected_inquiries, int) and expected_inquiries > 0 and extracted_inquiries < expected_inquiries:
        text_inquiries = extract_inquiries(inquiries_text)
        if len(text_inquiries.get("hardInquiries") or []) > len(inquiries_component.get("hardInquiries") or []):
            inquiries_component["hardInquiries"] = merge_inquiry_entries(
                inquiries_component.get("hardInquiries") or [],
                text_inquiries.get("hardInquiries") or [],
            )
        if len(text_inquiries.get("softInquiries") or []) > len(inquiries_component.get("softInquiries") or []):
            inquiries_component["softInquiries"] = merge_inquiry_entries(
                inquiries_component.get("softInquiries") or [],
                text_inquiries.get("softInquiries") or [],
            )
        inquiries_component["hardInquiryCount"] = len(inquiries_component["hardInquiries"])
        inquiries_component["softInquiryCount"] = len(inquiries_component["softInquiries"])
        extracted_inquiries = (inquiries_component.get("hardInquiryCount") or 0) + (inquiries_component.get("softInquiryCount") or 0)
    if isinstance(expected_inquiries, int) and expected_inquiries > 0 and extracted_inquiries < expected_inquiries:
        generic_inquiries = extract_inquiries_generic(plain_text)
        if len(generic_inquiries) > extracted_inquiries:
            inquiries_component["hardInquiries"] = generic_inquiries
            inquiries_component["hardInquiryCount"] = len(generic_inquiries)
            inquiries_component["softInquiries"] = []
            inquiries_component["softInquiryCount"] = 0
    components["inquiries"] = inquiries_component

    emit_progress(progress_callback, progress_steps["accounts"], "Extracting account sections and payment histories...")
    structured_accounts, structured_account_issues = extract_accounts_from_sections(page_artifacts, page_windows["accounts"])
    validation_issues.extend(structured_account_issues)
    accounts_result, account_issues = extract_accounts(
        accounts_text,
        components["creditAccountsSummary"],
        ollama,
        structured_accounts=structured_accounts,
    )
    components["accounts"] = accounts_result
    validation_issues.extend(account_issues)

    emit_progress(progress_callback, progress_steps["collections"], "Extracting collection accounts...")
    expected_collection_count = components["otherItemsSummary"].get("collectionCount")
    structured_collections, structured_collection_issues = extract_collections_from_tables(
        page_artifacts,
        page_windows["collections"],
    )
    validation_issues.extend(structured_collection_issues)
    collections_result, collection_issues = extract_collections(
        collections_text,
        expected_collection_count,
        structured_collections=structured_collections,
    )
    if isinstance(expected_collection_count, int) and expected_collection_count > 0:
        extracted_collection_count = len(collections_result.get("collections") or [])
        if extracted_collection_count == 0:
            collections_result, collection_issues = extract_collections(
                plain_text,
                expected_collection_count,
                structured_collections=structured_collections,
            )
    components["collections"] = collections_result
    validation_issues.extend(collection_issues)

    inquiry_evidence = collect_inquiry_evidence(components.get("inquiries"))
    account_history_evidence = collect_account_history_evidence((components.get("accounts") or {}).get("accounts"))
    account_field_evidence = collect_account_field_evidence((components.get("accounts") or {}).get("accounts"))
    account_sources = collect_account_source_metadata(
        (components.get("accounts") or {}).get("accounts"),
        page_windows.get("accounts"),
    )
    collection_sources = collect_collection_source_metadata(
        (components.get("collections") or {}).get("collections"),
        page_windows.get("collections"),
    )
    components = normalize_components_to_contract(components)
    component_sources = infer_component_source_pages(
        page_artifacts,
        components,
        page_windows,
        account_sources,
        collection_sources,
        inquiry_evidence,
    )
    validation_issues.extend(ensure_component_required_fields(components))
    validation_issues.extend(cross_validate(components))

    emit_progress(progress_callback, 97.0, "Validating extracted report data...")

    component_status = assess_component_status(validation_issues)
    ready_for_attorney = all(component_status[component] == "complete" for component in required_components)

    ended_at = time.time()

    result = {
        "profile": args.profile,
        "components": components,
        "componentStatus": component_status,
        "validationIssues": validation_issues,
        "readyForAttorney": ready_for_attorney,
        "meta": {
            "sessionId": args.session_id,
            "model": args.model,
            "profileId": args.profile,
            "ollamaBaseUrl": args.ollama_base_url,
            "pageCount": len(page_artifacts),
            "processingMs": int((ended_at - started_at) * 1000),
            "pageWindows": page_windows,
            "componentSources": component_sources,
            "pageIndexSource": page_tree.get("source", "heuristic"),
            "pageIndexFallbackReason": page_tree.get("fallback_reason"),
            "layoutArtifactsPath": str(session_dir / "ingestion" / "layout-artifacts.json"),
            "accountFieldEvidence": account_field_evidence,
            "accountHistoryEvidence": account_history_evidence,
            "accountSources": account_sources,
            "collectionSources": collection_sources,
            "inquiryEvidence": inquiry_evidence,
            "layoutSummary": [
                {
                    "page": page.page_number,
                    "rowCount": len(page.layout_rows),
                    "itemCount": len(page.layout_items),
                    "tableCount": len(page.layout_tables),
                    "parseConcernCount": len(page.parse_concerns),
                }
                for page in page_artifacts
            ],
            "ingestion": [
                {
                    "page": page.page_number,
                    "textQuality": round(page.text_quality, 4),
                    "tableQuality": round(page.table_quality, 4),
                    "hasOCR": bool(page.ocr_text),
                    "imagePath": page.image_path,
                    "tableCount": len(page.layout_tables),
                    "parseConcernCount": len(page.parse_concerns),
                }
                for page in page_artifacts
            ],
            "fullText": plain_text,
            "reportDate": components["reportConfirmationDetails"].get("reportDate")
            or components["summary"].get("reportDate"),
            "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        },
    }

    payload = {
        "status": "ok",
        "result": result,
    }

    emit_progress(progress_callback, 99.0, "Writing extracted result...")
    output_json.parent.mkdir(parents=True, exist_ok=True)
    output_json.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    return payload


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Equifax V1 extraction worker")
    parser.add_argument("--session-id", required=True)
    parser.add_argument("--session-dir", required=True)
    parser.add_argument("--input-pdf", required=True)
    parser.add_argument("--output-json", required=True)
    parser.add_argument("--profile", required=True)
    parser.add_argument("--ollama-base-url", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--max-pages", type=int, default=240)
    parser.add_argument("--pageindex-root", default="")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        generate_result(args)
        return 0
    except Exception as exc:
        payload = {
            "status": "error",
            "error": str(exc),
        }
        output_json = Path(args.output_json)
        output_json.parent.mkdir(parents=True, exist_ok=True)
        output_json.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
