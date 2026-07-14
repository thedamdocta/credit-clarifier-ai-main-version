import argparse
import csv
import io
import json
import math
import re
import subprocess
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

import fitz  # type: ignore
from PIL import Image, ImageDraw


GENERIC_VALUE_TOKENS = {
    "",
    "-",
    "--",
    "---",
    "blank",
    "n/a",
    "n/r",
    "none",
    "none reported",
    "not available",
    "not provided",
    "not reported",
    "unknown",
}

MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
MONTH_NAME_TO_KEY = {
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
HISTORY_FIELD_ALIASES = {
    "balancehistory": "balanceHistory",
    "balancehistorygapslots": "balanceHistoryGapSlots",
    "scheduledpaymenthistory": "scheduledPaymentHistory",
    "actualpaymenthistory": "actualPaymentHistory",
    "creditlimithistory": "creditLimitHistory",
    "amountpastduehistory": "amountPastDueHistory",
    "paymenthistory": "paymentHistory",
    "paymenthistorygapslots": "paymentHistoryGapSlots",
}
TRANSUNION_TABLE_HISTORY_FIELD_ALIASES = {
    "rating": "paymentHistory",
    "balance": "balanceHistory",
    "pastdue": "amountPastDueHistory",
    "amountpaid": "actualPaymentHistory",
    "scheduledpayment": "scheduledPaymentHistory",
    "highcredit": "highCreditHistory",
    "creditlimit": "creditLimitHistory",
    "remarks": "remarksHistory",
}
# Keyword routing from dispute-layer comparison labels (e.g. "Closure-month payment
# history", "Closure-month table activity") to history table fields. Most specific
# keyword first — order matters.
COMPARISON_LABEL_FIELD_KEYWORDS = [
    ("actual payment", "actualPaymentHistory"),
    ("table activity", "actualPaymentHistory"),
    ("amount paid", "actualPaymentHistory"),
    ("scheduled payment", "scheduledPaymentHistory"),
    ("amount past due", "amountPastDueHistory"),
    ("past due", "amountPastDueHistory"),
    ("past-due", "amountPastDueHistory"),
    ("credit limit", "creditLimitHistory"),
    ("high credit", "highCreditHistory"),
    ("payment history", "paymentHistory"),
    ("rating", "paymentHistory"),
    ("balance", "balanceHistory"),
]
# Printed field labels on Equifax account detail pages, keyed by the dispute layer's
# scalar field names / citation-label keywords. Values are search phrases as printed
# on the face of the report (verified against the EQ-old reference report pp16-18).
SCALAR_FIELD_PRINTED_LABELS = {
    "dateclosed": ["Date Closed"],
    "closeddate": ["Date Closed"],
    "recentpayment": ["Actual Payment Amount"],
    "actualpaymentamount": ["Actual Payment Amount"],
    "scheduledpaymentamount": ["Scheduled Payment Amount"],
    "lastpaymentdate": ["Date of Last Payment"],
    "lastpayment": ["Date of Last Payment"],
    "statusupdated": ["Date Reported"],
    "datereported": ["Date Reported"],
    "status": ["Account Status"],
    "accountstatus": ["Account Status"],
    "balanceupdated": [],  # not printed on Equifax old-format reports — absence is cite-only
    "balance": ["Reported Balance"],
    "currentbalance": ["Reported Balance"],
    "amountpastdue": ["Amount Past Due"],
    "chargeoffamount": ["Charge Off Amount"],
    "accountnumber": ["Account Number"],
    "dateopened": ["Date Opened"],
    "closuretiming": ["Date of Last Payment"],
    "paymentamount": ["Actual Payment Amount"],
    "dateoffirstdelinquency": ["Date of First Delinquency"],
    "monthsreviewed": ["Months Reviewed"],
    # Consumer-information-indicator metadata is derived by the dispute layer and has
    # no printed section on Equifax old-format reports — the on-face evidence is the
    # conflicting Account Status values, which the structured slide boxes directly.
    "indicatorcode": [],
    "indicatordescription": [],
    "indicatorcategory": [],
    "legalcategory": [],
    "linkedaccountlegalcategory": [],
    "linkedaccountname": [],
}
SCALAR_CITATION_LABEL_KEYWORDS = [
    ("closed date", "dateclosed"),
    ("closure timing", "closuretiming"),
    ("last-payment", "lastpaymentdate"),
    ("last payment", "lastpaymentdate"),
    ("balance-updated", "balanceupdated"),
    ("balance updated", "balanceupdated"),
    ("status-update", "statusupdated"),
    ("status update", "statusupdated"),
    ("status updated", "statusupdated"),
    ("date reported", "datereported"),
    ("status", "status"),
    ("actual payment", "actualpaymentamount"),
    ("scheduled payment", "scheduledpaymentamount"),
    ("past due", "amountpastdue"),
    ("past-due", "amountpastdue"),
    ("charge off", "chargeoffamount"),
    ("charge-off", "chargeoffamount"),
    ("account number", "accountnumber"),
    ("payment amount", "paymentamount"),
    ("first delinquency", "dateoffirstdelinquency"),
    ("months reviewed", "monthsreviewed"),
    ("indicator code", "indicatorcode"),
    ("indicator description", "indicatordescription"),
    ("indicator category", "indicatorcategory"),
    ("legal category", "legalcategory"),
    ("linked account name", "linkedaccountname"),
    ("balance", "balance"),
]
ACCOUNT_FIELD_VALUE_CANDIDATES = {
    "accountNumber": ["accountNumber"],
    "status": ["status", "accountStatus"],
    "balance": ["currentBalance", "balance"],
    "currentBalance": ["currentBalance", "balance"],
    "amountPastDue": ["amountPastDue"],
    "chargeOffAmount": ["chargeOffAmount"],
    "dateReported": ["dateReported"],
    "dateOpened": ["dateOpened", "openDate"],
    "dateClosed": ["dateClosed"],
    "lastPaymentDate": ["lastPaymentDate"],
    "paymentAmount": ["paymentAmount"],
    "actualPaymentAmount": ["actualPaymentAmount"],
    "scheduledPaymentAmount": ["scheduledPaymentAmount"],
    "accountType": ["accountType"],
    "accountSubtype": ["accountSubtype", "accountSubtypeSourceText"],
    "reportingCategory": ["reportingCategory"],
    "legalCategory": ["legalCategory"],
    "consumerInformationIndicator": ["consumerInformationIndicator"],
    "consumerStatement": ["consumerStatement"],
    "reinvestigationInfo": ["reinvestigationInfo"],
    "additionalInformation": ["additionalInformation", "comments"],
    "terms": ["termsFrequency", "termDuration"],
    "termDuration": ["termDuration"],
    "responsibility": ["responsibility", "paymentResponsibility"],
    "paymentResponsibility": ["paymentResponsibility"],
    "originalCreditorName": ["originalCreditorName", "originalCreditor"],
    "recentPayment": ["actualPaymentAmount", "recentPayment"],
}

MONTH_TOKEN_PATTERN = re.compile(
    r"\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b",
    re.IGNORECASE,
)
DATE_TOKEN_PATTERN = re.compile(
    r"\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*[\s,.-]+\d{1,2}(?:[\s,.-]+\d{2,4})?)\b",
    re.IGNORECASE,
)
AMOUNT_TOKEN_PATTERN = re.compile(r"-?\$?\d[\d,]*(?:\.\d{2})?")
MASKED_NUMBER_PATTERN = re.compile(r"(?:x|#|\*){2,}[-\s]?(?:x|#|\*){2,}[-\s]?(\d{2,6})", re.IGNORECASE)
TOKEN_PATTERN = re.compile(r"[a-z0-9$%./:#-]+", re.IGNORECASE)


def normalize_text(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def normalize_token(value: str) -> str:
    token = normalize_text(value).lower()
    token = token.replace("–", "-").replace("—", "-").replace("’", "'").replace("`", "'")
    token = re.sub(r"^[^a-z0-9$]+|[^a-z0-9%./:#-]+$", "", token)
    return token


def compact_value(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", normalize_text(value).lower())


def is_probable_year(value: str) -> bool:
    digits = re.sub(r"\D+", "", normalize_text(value))
    if len(digits) != 4:
        return False
    try:
        year = int(digits)
    except ValueError:
        return False
    return 1900 <= year <= 2099


def account_name_key(value: str) -> str:
    return compact_value(value)


def account_number_tail(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "", normalize_text(value).lower())
    without_masks = re.sub(r"[x#*]+", "", cleaned)
    token = without_masks or cleaned
    if len(token) >= 6:
        return token[-6:]
    if len(token) >= 4:
        return token[-4:]
    return token


def parse_entity_key(entity_key: str) -> Tuple[str, str]:
    if "::" not in entity_key:
        return normalize_text(entity_key), ""
    left, right = entity_key.split("::", 1)
    return normalize_text(left), normalize_text(right)


def normalize_history_field_name(value: str) -> Optional[str]:
    normalized = HISTORY_FIELD_ALIASES.get(compact_value(value))
    return normalized


def map_comparison_label_to_history_field(label: str) -> Optional[str]:
    normalized = normalize_text(label).lower()
    if not normalized:
        return None
    direct = normalize_history_field_name(normalized)
    if direct:
        return direct
    for keyword, field_name in COMPARISON_LABEL_FIELD_KEYWORDS:
        if keyword in normalized:
            return field_name
    return None


def map_scalar_citation_to_printed_labels(label_or_field: str) -> Optional[List[str]]:
    """Resolve a dispute-layer scalar citation (field name or comparison label) to the
    label phrases printed on the face of the report. Returns None when unmapped,
    [] when the citation is known to have no printed label (cite-only absence)."""
    compacted = compact_value(label_or_field)
    if compacted in SCALAR_FIELD_PRINTED_LABELS:
        return SCALAR_FIELD_PRINTED_LABELS[compacted]
    normalized = normalize_text(label_or_field).lower()
    for keyword, field_key in SCALAR_CITATION_LABEL_KEYWORDS:
        if keyword in normalized:
            return SCALAR_FIELD_PRINTED_LABELS.get(field_key)
    return None


def parse_month_reference(value: str) -> Optional[Tuple[str, str]]:
    clean = normalize_text(value)
    if not clean:
        return None
    month_match = MONTH_TOKEN_PATTERN.search(clean)
    year_match = re.search(r"\b(19|20)\d{2}\b", clean)
    if not month_match or not year_match:
        return None
    month_key = MONTH_NAME_TO_KEY.get(month_match.group(0).lower())
    if not month_key:
        return None
    return year_match.group(0), month_key


def format_month_reference(year: str, month_key: str) -> str:
    return f"{month_key.title()} {year}"


def normalize_history_state(value: str) -> str:
    normalized = normalize_text(value)
    if (
        not normalized
        or normalized.lower() in GENERIC_VALUE_TOKENS
        or compact_value(normalized) in {"---", "--"}
        or re.fullmatch(r"[-–—\s]+", normalized)
    ):
        return "blank"
    return "reported"


def normalize_transunion_table_label(value: str) -> Optional[str]:
    normalized = compact_value(value)
    if not normalized:
        return None
    for key, field_name in TRANSUNION_TABLE_HISTORY_FIELD_ALIASES.items():
        if normalized == key or normalized.startswith(key):
            return field_name
    return None


def strip_transunion_table_label(value: str, field_name: str) -> str:
    normalized = normalize_text(value)
    if not normalized:
        return normalized
    pretty_labels = {
        "paymentHistory": "Rating",
        "balanceHistory": "Balance",
        "amountPastDueHistory": "Past Due",
        "actualPaymentHistory": "Amount Paid",
        "scheduledPaymentHistory": "Scheduled Payment",
        "highCreditHistory": "High Credit",
        "creditLimitHistory": "Credit Limit",
        "remarksHistory": "Remarks",
    }
    pretty = pretty_labels.get(field_name, "")
    if pretty and normalized.lower().startswith(pretty.lower()):
        remainder = normalize_text(normalized[len(pretty):])
        return remainder or normalized
    if field_name == "paymentHistory" and compact_value(normalized) == "rating":
        return ""
    return normalized


def extract_transunion_month_columns(cells: Sequence[str]) -> List[Tuple[str, str]]:
    columns: List[Tuple[str, str]] = []
    for cell_text in cells:
        text = normalize_text(cell_text)
        if not text:
            if columns:
                break
            continue
        month_reference = parse_month_reference(text)
        if not month_reference:
            return []
        columns.append(month_reference)
    return columns if len(columns) >= 2 else []


def next_month_reference(year: str, month_key: str) -> Tuple[str, str]:
    index = MONTH_KEYS.index(month_key)
    if index == len(MONTH_KEYS) - 1:
        return str(int(year) + 1), MONTH_KEYS[0]
    return year, MONTH_KEYS[index + 1]


def tokenize_phrase(value: str) -> List[str]:
    return [normalize_token(token) for token in TOKEN_PATTERN.findall(normalize_text(value)) if normalize_token(token)]


def humanize_field_name(value: str) -> str:
    clean = normalize_text(value)
    clean = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", clean)
    clean = clean.replace("_", " ").replace("-", " ")
    return normalize_text(clean)


def missing_history_slot_text(field_name: str, year: str, month_key: str) -> str:
    normalized_field = normalize_history_field_name(field_name) or field_name
    if normalized_field == "paymentHistory" or normalized_field == "paymentHistoryGapSlots":
        return f"{format_month_reference(year, month_key)} missing from payment history"
    return f"{format_month_reference(year, month_key)} missing from balance history"


def is_low_signal(value: str) -> bool:
    normalized = normalize_text(value).lower()
    if normalized in GENERIC_VALUE_TOKENS:
        return True
    if len(compact_value(normalized)) < 3:
        return True
    return False


def clip_box(box: Dict[str, float], page_width: float, page_height: float) -> Dict[str, int]:
    x = max(0.0, min(page_width, box["x"]))
    y = max(0.0, min(page_height, box["y"]))
    max_width = max(0.0, page_width - x)
    max_height = max(0.0, page_height - y)
    width = max(1.0, min(max_width, box["width"]))
    height = max(1.0, min(max_height, box["height"]))
    return {
        "x": int(round(x)),
        "y": int(round(y)),
        "width": int(round(width)),
        "height": int(round(height)),
    }


def union_boxes(boxes: Sequence[Dict[str, float]]) -> Optional[Dict[str, float]]:
    if not boxes:
        return None
    left = min(box["x"] for box in boxes)
    top = min(box["y"] for box in boxes)
    right = max(box["x"] + box["width"] for box in boxes)
    bottom = max(box["y"] + box["height"] for box in boxes)
    return {
        "x": left,
        "y": top,
        "width": right - left,
        "height": bottom - top,
    }


def union_pdf_boxes(pdf_boxes: Sequence[Optional[Dict[str, float]]]) -> Optional[Dict[str, float]]:
    if not pdf_boxes or any(not isinstance(box, dict) for box in pdf_boxes):
        return None
    return {
        "xMin": min(box["xMin"] for box in pdf_boxes),
        "xMax": max(box["xMax"] for box in pdf_boxes),
        "yMin": min(box["yMin"] for box in pdf_boxes),
        "yMax": max(box["yMax"] for box in pdf_boxes),
    }


def snap_crop_to_text_lines(
    crop: Dict[str, float],
    words: Sequence["Word"],
    page_width: float,
    page_height: float,
    protected: Optional[Sequence[Dict[str, float]]] = None,
    pad: float = 10.0,
    max_expand: float = 150.0,
) -> Dict[str, int]:
    """Operator polish rule (Session 23): a crop edge must never slice through
    a text line — clipped words look unclean and can affect interpretation.
    For every word an edge cuts, the edge either moves OUTWARD to include the
    word fully (when the needed expansion is small) or INWARD past it, then a
    small whitespace pad applies. Edges never contract past a protected
    (highlight) rect; highlight geometry itself is untouched — only the
    visible window moves."""
    left = float(crop["x"])
    top = float(crop["y"])
    right = left + float(crop["width"])
    bottom = top + float(crop["height"])

    if not words:
        left = max(0.0, min(left, page_width - 1.0))
        top = max(0.0, min(top, page_height - 1.0))
        right = max(left + 1.0, min(right, page_width))
        bottom = max(top + 1.0, min(bottom, page_height))
        return {
            "x": int(round(left)),
            "y": int(round(top)),
            "width": int(round(right - left)),
            "height": int(round(bottom - top)),
        }

    # The rects this crop exists to show — contraction may never cross them.
    # Without highlight rects we cannot know which part of the window is
    # evidence, so the entire original window becomes the protected region
    # (contraction disabled, expansion still allowed).
    if protected:
        p_left, p_top, p_right, p_bottom = right, bottom, left, top
        for rect in protected:
            p_left = min(p_left, float(rect["x"]))
            p_top = min(p_top, float(rect["y"]))
            p_right = max(p_right, float(rect["x"]) + float(rect["width"]))
            p_bottom = max(p_bottom, float(rect["y"]) + float(rect["height"]))
    else:
        p_left, p_top, p_right, p_bottom = left, top, right, bottom

    # Per-word nudging oscillates when a label column interleaves with value
    # columns (include A slices B, exclude B slices C, ...). Instead: inflate
    # every sliceable word span by the pad and merge into FORBIDDEN INTERVALS.
    # Inflation makes words closer than 2*pad merge, so an interval boundary
    # can never fall inside another interval — one move per edge lands in true
    # whitespace, and chained sub-pad gaps (the panel's 7d ladder) cannot
    # re-slice. Expansion when cheap, contraction otherwise; contraction never
    # crosses a highlight (a larger crop is the lesser evil than cut evidence).
    def merged_intervals(spans: List[Tuple[float, float]]) -> List[Tuple[float, float]]:
        merged: List[List[float]] = []
        for start, end in sorted((s - pad, e + pad) for s, e in spans):
            if merged and start <= merged[-1][1]:
                merged[-1][1] = max(merged[-1][1], end)
            else:
                merged.append([start, end])
        return [(m[0], m[1]) for m in merged]

    def resolve_edge(
        edge: float,
        spans: List[Tuple[float, float]],
        lo_bound: float,
        hi_bound: float,
        expand_low: bool,
        protect_limit: float,
    ) -> float:
        # Labels and headers live LEFT of and ABOVE values — inclusion on those
        # edges preserves interpretive context (which table, which field), so
        # they get triple the expansion allowance before contraction wins.
        allowance = max_expand * 3.0 if expand_low else max_expand
        for start, end in merged_intervals(spans):
            # Half-pixel epsilon: intervals are pad-inflated, so a sub-pixel
            # incursion (int rounding of a float landing) still has ~pad of
            # real whitespace — treating it as sliced would deny integer
            # crops a fixpoint and re-nudge them by 1px forever.
            if start + 0.5 < edge < end - 0.5:
                # Interval bounds already carry the pad (inflated above).
                if expand_low:  # left/top edges expand by moving toward lo_bound
                    expand_pos = max(lo_bound, start)
                    contract_pos = end
                    expand_cost = edge - expand_pos
                    contract_ok = contract_pos <= protect_limit
                else:  # right/bottom edges expand by moving toward hi_bound
                    expand_pos = min(hi_bound, end)
                    contract_pos = start
                    expand_cost = expand_pos - edge
                    contract_ok = contract_pos >= protect_limit
                # A page-bound clamp can leave the expanded edge still inside
                # the interval (word flush against the page margin) — prefer a
                # clean contraction then, if protection allows one.
                expand_clean = not (start < expand_pos < end)
                if (expand_cost <= allowance or not contract_ok) and (expand_clean or not contract_ok):
                    return expand_pos
                return contract_pos
        return edge

    # Each resolve_edge lands outside every interval of ITS list, but moving a
    # vertical edge widens the band the horizontal edges were resolved against
    # (and vice versa) — newly admitted words could be sliced by an already-
    # placed edge. Re-run the block until no edge moves (cross-axis fixpoint).
    # The cap only backstops pathology: band growth is monotone per edge and
    # bounded by the page, so dense tables settle at their true whitespace
    # boundary well inside it (8 passes proved too few on real table slides).
    for _ in range(32):
        prev = (top, bottom, left, right)
        x_overlapping = [
            (float(w.box["y"]), float(w.box["y"]) + float(w.box["height"]))
            for w in words
            if float(w.box["x"]) + float(w.box["width"]) > left and float(w.box["x"]) < right
        ]
        top = resolve_edge(top, x_overlapping, 0.0, page_height, True, p_top - pad)
        bottom = resolve_edge(bottom, x_overlapping, 0.0, page_height, False, p_bottom + pad)
        y_overlapping = [
            (float(w.box["x"]), float(w.box["x"]) + float(w.box["width"]))
            for w in words
            if float(w.box["y"]) + float(w.box["height"]) > top and float(w.box["y"]) < bottom
        ]
        left = resolve_edge(left, y_overlapping, 0.0, page_width, True, p_left - pad)
        right = resolve_edge(right, y_overlapping, 0.0, page_width, False, p_right + pad)
        if max(abs(a - b) for a, b in zip(prev, (top, bottom, left, right))) < 0.01:
            break

    left = max(0.0, min(left, page_width - 1.0))
    top = max(0.0, min(top, page_height - 1.0))
    right = max(left + 1.0, min(right, page_width))
    bottom = max(top + 1.0, min(bottom, page_height))
    return {
        "x": int(round(left)),
        "y": int(round(top)),
        "width": int(round(right - left)),
        "height": int(round(bottom - top)),
    }


def expand_box(box: Dict[str, float], page_width: float, page_height: float, padding_x: float, padding_y: float) -> Dict[str, int]:
    return clip_box(
        {
            "x": box["x"] - padding_x,
            "y": box["y"] - padding_y,
            "width": box["width"] + padding_x * 2,
            "height": box["height"] + padding_y * 2,
        },
        page_width,
        page_height,
    )


@dataclass
class Anchor:
    id: str
    label: str
    text: str
    tokens: List[str]
    kind: str
    required: bool
    weight: float


@dataclass
class Word:
    text: str
    token: str
    compact: str
    box: Dict[str, float]
    pdf_box: Optional[Dict[str, float]] = None


@dataclass
class Match:
    anchor: Anchor
    page_number: int
    box: Dict[str, float]
    confidence: float
    source: str
    matched_text: str
    pdf_box: Optional[Dict[str, float]] = None
    provenance_id: Optional[str] = None


@dataclass
class Cluster:
    page_number: int
    page_image_width: int
    page_image_height: int
    matches: List[Match] = field(default_factory=list)

    def add(self, match: Match):
        self.matches.append(match)

    @property
    def box(self) -> Dict[str, float]:
        merged = union_boxes([match.box for match in self.matches])
        if not merged:
            return {"x": 0.0, "y": 0.0, "width": float(self.page_image_width), "height": float(self.page_image_height)}
        return merged

    @property
    def score(self) -> float:
        unique_anchors = {match.anchor.id for match in self.matches}
        unique_non_identity = {match.anchor.id for match in self.matches if match.anchor.kind != "identity"}
        avg_confidence = sum(match.confidence for match in self.matches) / max(len(self.matches), 1)
        return (
            sum(match.anchor.weight * match.confidence for match in self.matches)
            + len(unique_anchors) * 0.75
            + len(unique_non_identity) * 1.5
            + avg_confidence
        )


@dataclass
class AccountHistoryCell:
    id: str
    field: str
    page_number: int
    year: str
    month: str
    value: str
    state: str
    box: Dict[str, float]
    pdf_box: Optional[Dict[str, float]]
    source: str


@dataclass
class AccountFieldEvidence:
    id: str
    field: str
    page_number: int
    value: str
    state: str
    box: Dict[str, float]
    pdf_box: Optional[Dict[str, float]]
    source: str


@dataclass
class AccountEvidenceContext:
    account_name: str
    account_number: str
    pages: List[int]
    account_fields: Dict[str, object]
    field_evidence: Dict[str, AccountFieldEvidence]
    history_cells: Dict[str, Dict[Tuple[str, str], AccountHistoryCell]]


@dataclass
class TextSearchSpec:
    label: str
    texts: List[str]
    kind: str
    required: bool
    weight: float


class PageTextLocator:
    def __init__(self, source_pdf: Path, images_dir: Path):
        self.source_pdf = source_pdf
        self.images_dir = images_dir
        self.doc = fitz.open(str(source_pdf))
        self.image_paths = self._index_images(images_dir)
        self.page_sizes: Dict[int, Tuple[int, int]] = {}
        self.page_sources: Dict[int, str] = {}
        self.page_words: Dict[int, List[Word]] = {}
        self.page_dimensions: Dict[int, Tuple[float, float]] = {}
        self._bootstrap_pages()

    def _index_images(self, images_dir: Path) -> Dict[int, Path]:
        indexed: Dict[int, Path] = {}
        if not images_dir.exists():
            return indexed
        for path in images_dir.iterdir():
            if not path.is_file() or path.suffix.lower() != ".png":
                continue
            match = re.match(r"page-(\d+)\.png$", path.name, re.IGNORECASE)
            if not match:
                continue
            indexed[int(match.group(1))] = path
        return indexed

    def _page_image_size(self, page_number: int, page_rect: fitz.Rect) -> Tuple[int, int]:
        if page_number in self.page_sizes:
            return self.page_sizes[page_number]
        image_path = self.image_paths.get(page_number)
        if image_path and image_path.exists():
            with Image.open(image_path) as image:
                size = image.size
                self.page_sizes[page_number] = size
                return size
        inferred = (max(1, int(round(page_rect.width * 2))), max(1, int(round(page_rect.height * 2))))
        self.page_sizes[page_number] = inferred
        return inferred

    def _pdf_box_to_image_box(
        self,
        page_rect: fitz.Rect,
        image_size: Tuple[int, int],
        x0: float,
        y0: float,
        x1: float,
        y1: float,
    ) -> Dict[str, float]:
        image_width, image_height = image_size
        scale_x = image_width / max(page_rect.width, 1.0)
        scale_y = image_height / max(page_rect.height, 1.0)
        return {
            "x": x0 * scale_x,
            "y": y0 * scale_y,
            "width": max(1.0, (x1 - x0) * scale_x),
            "height": max(1.0, (y1 - y0) * scale_y),
        }

    def pdf_bbox_to_image_box(self, page_number: int, bbox: Dict[str, float]) -> Dict[str, float]:
        page_rect = self.doc.load_page(page_number - 1).rect
        image_size = self.page_sizes[page_number]
        return self._pdf_box_to_image_box(
            page_rect,
            image_size,
            float(bbox["xMin"]),
            float(bbox["yMin"]),
            float(bbox["xMax"]),
            float(bbox["yMax"]),
        )

    def _extract_pdf_words(self, page_number: int, page: fitz.Page, image_size: Tuple[int, int]) -> List[Word]:
        words: List[Word] = []
        page_rect = page.rect
        for item in page.get_text("words"):
            if len(item) < 5:
                continue
            x0, y0, x1, y1, text = item[:5]
            token = normalize_token(text)
            if not token:
                continue
            words.append(
                Word(
                    text=str(text),
                    token=token,
                    compact=compact_value(str(text)),
                    box=self._pdf_box_to_image_box(page_rect, image_size, float(x0), float(y0), float(x1), float(y1)),
                    # Keep the original PDF-point rect so text matches carry exact
                    # geometry end to end (crops and the highlighted report render
                    # the same stored rect instead of rescaling image pixels).
                    pdf_box={"xMin": float(x0), "xMax": float(x1), "yMin": float(y0), "yMax": float(y1)},
                )
            )
        return words

    def _extract_ocr_words(self, page_number: int, image_path: Path, image_size: Tuple[int, int]) -> List[Word]:
        command = ["tesseract", str(image_path), "stdout", "tsv", "--psm", "6"]
        result = subprocess.run(command, capture_output=True, text=True, check=False)
        if result.returncode != 0:
            raise RuntimeError(result.stderr.strip() or "tesseract OCR failed")

        rows: List[Word] = []
        reader = csv.DictReader(io.StringIO(result.stdout), delimiter="\t")
        for row in reader:
            text = normalize_text(row.get("text", ""))
            token = normalize_token(text)
            if not token:
                continue
            try:
                confidence = float(row.get("conf", "-1"))
            except ValueError:
                confidence = -1
            if confidence < 35:
                continue
            left = float(row.get("left", "0") or 0)
            top = float(row.get("top", "0") or 0)
            width = float(row.get("width", "0") or 0)
            height = float(row.get("height", "0") or 0)
            if width <= 0 or height <= 0:
                continue
            rows.append(
                Word(
                    text=text,
                    token=token,
                    compact=compact_value(text),
                    box=clip_box({"x": left, "y": top, "width": width, "height": height}, image_size[0], image_size[1]),
                )
            )
        return rows

    def _bootstrap_pages(self):
        for index in range(self.doc.page_count):
            page_number = index + 1
            page = self.doc.load_page(index)
            page_rect = page.rect
            self.page_dimensions[page_number] = (float(page_rect.width), float(page_rect.height))
            image_size = self._page_image_size(page_number, page_rect)
            words = self._extract_pdf_words(page_number, page, image_size)
            if len(words) >= 8:
                self.page_sources[page_number] = "pdf"
                self.page_words[page_number] = words
                continue
            image_path = self.image_paths.get(page_number)
            if image_path and image_path.exists():
                ocr_words = self._extract_ocr_words(page_number, image_path, image_size)
                self.page_sources[page_number] = "ocr"
                self.page_words[page_number] = ocr_words
            else:
                self.page_sources[page_number] = "empty"
                self.page_words[page_number] = words

    @property
    def page_count(self) -> int:
        return self.doc.page_count


class SessionResultContext:
    def __init__(self, result_json_path: Optional[Path], locator: PageTextLocator):
        self.locator = locator
        self.accounts: List[AccountEvidenceContext] = []
        self.by_name: Dict[str, List[AccountEvidenceContext]] = defaultdict(list)
        if result_json_path and result_json_path.exists():
            self._load(result_json_path)

    def _normalize_history_bbox(self, row: Dict[str, object], month_entry: Dict[str, object]) -> Optional[Dict[str, float]]:
        bbox = month_entry.get("pdfBBox") or month_entry.get("bbox")
        if not isinstance(bbox, dict):
            return None
        try:
            x_min = float(bbox.get("xMin", 0.0))
            x_max = float(bbox.get("xMax", 0.0))
            y_min = float(bbox.get("yMin", 0.0))
            y_max = float(bbox.get("yMax", 0.0))
        except (TypeError, ValueError):
            return None

        widths: List[float] = []
        heights: List[float] = []
        months = row.get("months") or {}
        if isinstance(months, dict):
            for value in months.values():
                candidate_bbox = value.get("bbox") if isinstance(value, dict) else None
                if not isinstance(candidate_bbox, dict):
                    continue
                try:
                    candidate_width = float(candidate_bbox.get("xMax", 0.0)) - float(candidate_bbox.get("xMin", 0.0))
                    candidate_height = float(candidate_bbox.get("yMax", 0.0)) - float(candidate_bbox.get("yMin", 0.0))
                except (TypeError, ValueError):
                    continue
                if candidate_width > 0:
                    widths.append(candidate_width)
                if candidate_height > 0:
                    heights.append(candidate_height)

        fallback_width = max(12.0, (sum(widths) / len(widths)) if widths else 22.0)
        fallback_height = max(7.0, (sum(heights) / len(heights)) if heights else 9.0)

        if x_max <= x_min:
            x_max = x_min + fallback_width
        if y_max <= y_min:
            y_max = y_min + fallback_height

        return {
            "xMin": x_min,
            "xMax": x_max,
            "yMin": y_min,
            "yMax": y_max,
        }

    def _load_layout_pages(self, layout_artifacts_path: Optional[str]) -> List[Dict[str, object]]:
        if not layout_artifacts_path:
            return []
        path = Path(layout_artifacts_path)
        if not path.exists():
            return []
        try:
            payload = json.loads(path.read_text())
        except Exception:
            return []
        if not isinstance(payload, list):
            return []
        return [entry for entry in payload if isinstance(entry, dict)]

    def _split_table_row_into_pdf_boxes(
        self,
        row_bbox: Dict[str, float],
        column_count: int,
    ) -> List[Dict[str, float]]:
        if column_count <= 0:
            return []
        x_min = float(row_bbox.get("xMin", 0.0))
        x_max = float(row_bbox.get("xMax", x_min))
        y_min = float(row_bbox.get("yMin", 0.0))
        y_max = float(row_bbox.get("yMax", y_min))
        width = max(1.0, x_max - x_min)
        cell_width = width / max(column_count, 1)
        boxes: List[Dict[str, float]] = []
        for index in range(column_count):
            cell_x_min = x_min + (cell_width * index)
            cell_x_max = x_max if index == column_count - 1 else x_min + (cell_width * (index + 1))
            boxes.append(
                {
                    "xMin": cell_x_min,
                    "xMax": cell_x_max,
                    "yMin": y_min,
                    "yMax": y_max,
                }
            )
        return boxes

    def _synthesize_history_cells_from_layout_tables(
        self,
        context: AccountEvidenceContext,
        layout_pages: List[Dict[str, object]],
    ) -> None:
        if not context.pages or not layout_pages:
            return

        for page_number in context.pages:
            if page_number <= 0 or page_number > len(layout_pages):
                continue
            page_entry = layout_pages[page_number - 1]
            tables = page_entry.get("tables") or []
            if not isinstance(tables, list):
                continue

            for table in tables:
                if not isinstance(table, dict):
                    continue
                row_items = table.get("rowItems") or []
                if not isinstance(row_items, list) or not row_items:
                    continue
                month_columns: List[Tuple[str, str]] = []
                pending_field_name: Optional[str] = None
                for row_item in row_items:
                    if not isinstance(row_item, dict):
                        continue
                    cells = row_item.get("cells") or []
                    if not isinstance(cells, list):
                        continue
                    raw_texts = [
                        normalize_text((cell or {}).get("text")) if isinstance(cell, dict) else ""
                        for cell in cells
                    ]
                    if not raw_texts:
                        continue

                    header_columns = extract_transunion_month_columns(raw_texts)
                    if header_columns:
                        month_columns = header_columns
                        pending_field_name = None
                        continue
                    if not month_columns:
                        continue

                    texts = raw_texts[: len(month_columns)]
                    non_empty_texts = [text for text in texts if text]
                    if not non_empty_texts:
                        continue

                    detected_fields = {normalize_transunion_table_label(text) for text in non_empty_texts}
                    detected_fields.discard(None)
                    field_name = pending_field_name
                    values = list(texts)
                    if not field_name:
                        inline_fields = [normalize_transunion_table_label(text) for text in texts if text]
                        if len(set(inline_fields)) == 1 and inline_fields:
                            candidate_field = inline_fields[0]
                            stripped_values = [normalize_text(strip_transunion_table_label(text, candidate_field)) for text in texts]
                            has_inline_values = any(
                                stripped_value and stripped_value != normalize_text(text)
                                for stripped_value, text in zip(stripped_values, texts)
                            )
                            if has_inline_values:
                                field_name = candidate_field
                                values = stripped_values
                            else:
                                pending_field_name = candidate_field
                                continue
                    else:
                        values = [normalize_text(text) for text in texts]
                        pending_field_name = None

                    if not field_name:
                        continue

                    row_bbox = row_item.get("bbox") or {}
                    if not isinstance(row_bbox, dict):
                        continue
                    cell_boxes = self._split_table_row_into_pdf_boxes(row_bbox, len(month_columns))
                    if not cell_boxes:
                        continue

                    for column_index, ((year, month_key), raw_value) in enumerate(zip(month_columns, values)):
                        pdf_box = cell_boxes[column_index]
                        image_box = self.locator.pdf_bbox_to_image_box(page_number, pdf_box)
                        normalized_value = normalize_text(raw_value)
                        cell = AccountHistoryCell(
                            id=f"layout:{compact_value(context.account_name)}:{compact_value(context.account_number)}:{field_name}:{year}:{month_key}:{page_number}",
                            field=field_name,
                            page_number=page_number,
                            year=year,
                            month=month_key,
                            value=normalized_value if normalize_history_state(normalized_value) != "blank" else "",
                            state=normalize_history_state(normalized_value),
                            box=image_box,
                            pdf_box=pdf_box,
                            source="layout-table",
                        )
                        context.history_cells.setdefault(field_name, {})[(year, month_key)] = cell

    def _load(self, result_json_path: Path):
        payload = json.loads(result_json_path.read_text())
        result = payload.get("result") if isinstance(payload, dict) else None
        if not isinstance(result, dict):
            return

        components = result.get("components") or {}
        meta = result.get("meta") or {}
        layout_pages = self._load_layout_pages(normalize_text(meta.get("layoutArtifactsPath")))
        account_sources = meta.get("accountSources") or []
        account_fields: List[Dict[str, object]] = []
        for component_name in ("accounts", "adverseAccounts", "satisfactoryAccounts"):
            component = components.get(component_name) or {}
            candidates = component.get("accounts") if isinstance(component, dict) else None
            if isinstance(candidates, list):
                account_fields.extend(entry for entry in candidates if isinstance(entry, dict))
        account_field_evidence = meta.get("accountFieldEvidence") or []
        account_history_evidence = meta.get("accountHistoryEvidence") or []

        contexts_by_key: Dict[Tuple[str, str], AccountEvidenceContext] = {}
        pages_by_key: Dict[Tuple[str, str], List[int]] = {}

        for source in account_sources:
            if not isinstance(source, dict):
                continue
            key = (account_name_key(source.get("accountName", "")), account_number_tail(source.get("accountNumber", "")))
            pages = sorted({int(page) for page in source.get("pages") or [] if isinstance(page, int) and page > 0})
            if pages:
                pages_by_key[key] = pages

        for account in account_fields:
            if not isinstance(account, dict):
                continue
            name = normalize_text(account.get("accountName"))
            number = normalize_text(account.get("accountNumber"))
            key = (account_name_key(name), account_number_tail(number))
            fallback_pages = sorted(
                {
                    int(page)
                    for page in account.get("sourcePages") or []
                    if isinstance(page, int) and page > 0
                }
            )
            context = AccountEvidenceContext(
                account_name=name,
                account_number=number,
                pages=list(pages_by_key.get(key, []) or fallback_pages),
                account_fields=account,
                field_evidence={},
                history_cells=defaultdict(dict),
            )
            contexts_by_key[key] = context

        for evidence in account_field_evidence:
            if not isinstance(evidence, dict):
                continue
            name = normalize_text(evidence.get("accountName"))
            number = normalize_text(evidence.get("accountNumber"))
            key = (account_name_key(name), account_number_tail(number))
            context = contexts_by_key.get(key)
            if not context:
                context = AccountEvidenceContext(
                    account_name=name,
                    account_number=number,
                    pages=list(pages_by_key.get(key, [])),
                    account_fields={},
                    field_evidence={},
                    history_cells=defaultdict(dict),
                )
                contexts_by_key[key] = context

            fields = evidence.get("fields") or {}
            if not isinstance(fields, dict):
                continue
            for field_name, detail in fields.items():
                if not isinstance(detail, dict):
                    continue
                bbox = detail.get("pdfBBox") or detail.get("bbox")
                page_number = int(detail.get("pageNumber") or 0)
                if not isinstance(bbox, dict) or page_number <= 0 or page_number > self.locator.page_count:
                    continue
                image_box = self.locator.pdf_bbox_to_image_box(page_number, bbox)
                field_detail = AccountFieldEvidence(
                    id=normalize_text(detail.get("id")) or f"field:{compact_value(field_name)}:{page_number}",
                    field=normalize_text(detail.get("field") or field_name),
                    page_number=page_number,
                    value=normalize_text(detail.get("value")),
                    state=normalize_text(detail.get("state")).lower() or "reported",
                    box=image_box,
                    pdf_box={
                        "xMin": float(bbox.get("xMin", 0.0)),
                        "xMax": float(bbox.get("xMax", 0.0)),
                        "yMin": float(bbox.get("yMin", 0.0)),
                        "yMax": float(bbox.get("yMax", 0.0)),
                    },
                    source=normalize_text(detail.get("source")),
                )
                context.field_evidence[field_detail.field] = field_detail
                if page_number not in context.pages:
                    context.pages.append(page_number)

        for evidence in account_history_evidence:
            if not isinstance(evidence, dict):
                continue
            name = normalize_text(evidence.get("accountName"))
            number = normalize_text(evidence.get("accountNumber"))
            key = (account_name_key(name), account_number_tail(number))
            context = contexts_by_key.get(key)
            if not context:
                context = AccountEvidenceContext(
                    account_name=name,
                    account_number=number,
                    pages=list(pages_by_key.get(key, [])),
                    account_fields={},
                    field_evidence={},
                    history_cells=defaultdict(dict),
                )
                contexts_by_key[key] = context

            fields = evidence.get("fields") or {}
            if not isinstance(fields, dict):
                continue
            for field_name, rows in fields.items():
                normalized_field = normalize_history_field_name(str(field_name))
                if not normalized_field or not isinstance(rows, list):
                    continue
                for row in rows:
                    if not isinstance(row, dict):
                        continue
                    year = normalize_text(row.get("year"))
                    months = row.get("months") or {}
                    if not isinstance(months, dict):
                        continue
                    for month_key, month_entry in months.items():
                        if not isinstance(month_entry, dict):
                            continue
                        normalized_bbox = self._normalize_history_bbox(row, month_entry)
                        page_number = int(month_entry.get("pageNumber") or row.get("pageNumber") or 0)
                        if not normalized_bbox or page_number <= 0 or page_number > self.locator.page_count:
                            continue
                        image_box = self.locator.pdf_bbox_to_image_box(page_number, normalized_bbox)
                        cell = AccountHistoryCell(
                            id=normalize_text(month_entry.get("id")) or f"history:{normalized_field}:{year}:{month_key}:{page_number}",
                            field=normalized_field,
                            page_number=page_number,
                            year=year,
                            month=str(month_key).lower(),
                            value=normalize_text(month_entry.get("value")),
                            state=normalize_text(month_entry.get("state")).lower(),
                            box=image_box,
                            pdf_box=normalized_bbox,
                            source=normalize_text(month_entry.get("source")),
                        )
                        context.history_cells.setdefault(normalized_field, {})[(year, cell.month)] = cell
                        if page_number not in context.pages:
                            context.pages.append(page_number)

        self.accounts = sorted(contexts_by_key.values(), key=lambda entry: (entry.account_name, entry.account_number))
        for context in self.accounts:
            self._synthesize_history_cells_from_layout_tables(context, layout_pages)
            context.pages = sorted({page for page in context.pages if page > 0})
            self.by_name[account_name_key(context.account_name)].append(context)

    def find_account(self, entity_key: str, source_pages: Optional[Sequence[int]] = None) -> Optional[AccountEvidenceContext]:
        account_name, account_number = parse_entity_key(entity_key)
        candidates = self.by_name.get(account_name_key(account_name), [])
        if not candidates:
            return None
        normalized_source_pages = sorted(
            {
                int(page)
                for page in (source_pages or [])
                if isinstance(page, int) and page > 0
            }
        )
        wanted_tail = account_number_tail(account_number)
        matched_candidates = candidates
        if wanted_tail:
            tailed = [
                candidate
                for candidate in candidates
                if account_number_tail(candidate.account_number) == wanted_tail
            ]
            if tailed:
                matched_candidates = tailed
        if len(matched_candidates) == 1:
            return matched_candidates[0]

        def candidate_score(candidate: AccountEvidenceContext) -> Tuple[int, int, int]:
            overlap = 0
            if normalized_source_pages:
                overlap = sum(1 for page in candidate.pages if page in normalized_source_pages)
            history_coverage = sum(len(months) for months in candidate.history_cells.values())
            return (overlap, history_coverage, -len(candidate.pages))

        return max(matched_candidates, key=candidate_score)


def add_anchor(anchor_map: Dict[str, Anchor], label: str, text: str, kind: str, required: bool, weight: float):
    normalized_text = normalize_text(text)
    tokens = tokenize_phrase(normalized_text)
    if not normalized_text or not tokens or is_low_signal(normalized_text):
        return
    key = f"{kind}:{' '.join(tokens)}"
    if key in anchor_map:
        existing = anchor_map[key]
        anchor_map[key] = Anchor(
            id=existing.id,
            label=existing.label,
            text=existing.text,
            tokens=existing.tokens,
            kind=existing.kind,
            required=existing.required or required,
            weight=max(existing.weight, weight),
        )
        return
    anchor_map[key] = Anchor(
        id=f"anchor-{len(anchor_map) + 1}",
        label=normalize_text(label) or normalized_text,
        text=normalized_text,
        tokens=tokens,
        kind=kind,
        required=required,
        weight=weight,
    )


def extract_fact_values(fact: str) -> Iterable[Tuple[str, str]]:
    clean_fact = normalize_text(fact)
    if not clean_fact:
        return []

    candidates: List[Tuple[str, str]] = []
    if ":" in clean_fact:
        label, value = clean_fact.split(":", 1)
        candidates.append((normalize_text(label), normalize_text(value)))

    for match in DATE_TOKEN_PATTERN.findall(clean_fact):
        candidates.append(("Date", normalize_text(match)))

    for match in AMOUNT_TOKEN_PATTERN.findall(clean_fact):
        normalized_match = normalize_text(match)
        if is_probable_year(normalized_match):
            continue
        candidates.append(("Amount", normalized_match))

    for match in MASKED_NUMBER_PATTERN.findall(clean_fact):
        candidates.append(("Account number", normalize_text(match)))

    return candidates


def derive_field_phrases(value: str) -> List[str]:
    normalized = normalize_text(value)
    phrases: List[str] = []
    lower = normalized.lower()
    for candidate in [
        "account number",
        "payment history",
        "amount past due",
        "past due",
        "balance updated",
        "balance updated date",
        "date reported",
        "current balance",
        "last payment date",
        "scheduled payment",
        "payment amount",
        "original creditor",
    ]:
        if candidate in lower:
            phrases.append(candidate)
    return list(dict.fromkeys(phrases))


def create_anchor(label: str, text: str, kind: str, required: bool, weight: float) -> Anchor:
    normalized_text = normalize_text(text)
    return Anchor(
        id=f"{kind}:{compact_value(label)}:{compact_value(normalized_text)}",
        label=normalize_text(label) or normalized_text,
        text=normalized_text,
        tokens=tokenize_phrase(normalized_text),
        kind=kind,
        required=required,
        weight=weight,
    )


def resolve_account_field_values(account_context: Optional[AccountEvidenceContext], field_name: str) -> List[str]:
    if not account_context or not account_context.account_fields:
        return []

    values: List[str] = []
    seen = set()
    nested_sources = [
        account_context.account_fields,
        account_context.account_fields.get("accountInfo") if isinstance(account_context.account_fields.get("accountInfo"), dict) else {},
        account_context.account_fields.get("header") if isinstance(account_context.account_fields.get("header"), dict) else {},
        account_context.account_fields.get("historicalInfo") if isinstance(account_context.account_fields.get("historicalInfo"), dict) else {},
    ]
    for candidate_key in ACCOUNT_FIELD_VALUE_CANDIDATES.get(field_name, [field_name]):
        for source in nested_sources:
            value = source.get(candidate_key) if isinstance(source, dict) else None
            if isinstance(value, list):
                for item in value:
                    normalized = normalize_text(item)
                    if normalized and normalized not in seen and not is_low_signal(normalized):
                        seen.add(normalized)
                        values.append(normalized)
                continue
            normalized = normalize_text(value)
            if normalized and normalized not in seen and not is_low_signal(normalized):
                seen.add(normalized)
                values.append(normalized)
    return values


def build_reason_anchors(reason: Dict[str, object], account_context: Optional[AccountEvidenceContext] = None) -> List[Anchor]:
    anchors: Dict[str, Anchor] = {}
    issue_label = normalize_text(reason.get("issueLabel"))
    reason_summary = normalize_text(reason.get("reasonSummary"))
    entity_key = normalize_text(reason.get("entityKey"))
    account_name = normalize_text(entity_key.split("::")[0]) if "::" in entity_key else entity_key
    account_number = normalize_text(entity_key.split("::", 1)[1]) if "::" in entity_key else ""

    if account_name:
        add_anchor(anchors, "Tradeline", account_name, "identity", False, 2.0)
    if account_number and compact_value(account_number).strip("x#*"):
        add_anchor(anchors, "Account number", account_number, "identity", False, 1.8)

    if issue_label:
        add_anchor(anchors, "Issue", issue_label, "summary", False, 1.5)

    if reason_summary and len(tokenize_phrase(reason_summary)) <= 8:
        add_anchor(anchors, "Reason summary", reason_summary, "summary", False, 1.2)

    compared_fields = []
    evidence = reason.get("evidence") or {}
    if isinstance(evidence, dict):
        compared_fields = evidence.get("comparedFields") or []

    field_names = list(dict.fromkeys([str(field_name) for field_name in (reason.get("supportingFields") or []) + compared_fields]))
    for field_name in field_names:
        field_label = humanize_field_name(str(field_name))
        add_anchor(anchors, field_label, field_label, "field", False, 0.85)
        for value in resolve_account_field_values(account_context, str(field_name)):
            add_anchor(anchors, field_label, value, "account_field", False, 3.5)

    for fact in reason.get("supportingFacts") or []:
        fact_text = normalize_text(fact)
        for label, value in extract_fact_values(fact_text):
            add_anchor(anchors, label, value, "evidence", True, 4.0)
            if label:
                humanized_label = humanize_field_name(label)
                add_anchor(anchors, humanized_label, humanized_label, "field", False, 0.8)
        for phrase in derive_field_phrases(fact_text):
            add_anchor(anchors, phrase, phrase, "field", False, 0.8)
        if len(tokenize_phrase(fact_text)) <= 6:
            add_anchor(anchors, "Report evidence", fact_text, "evidence", False, 2.5)

    if isinstance(evidence, dict):
        for entry in evidence.get("scalarComparisons") or []:
            if not isinstance(entry, dict):
                continue
            label = normalize_text(entry.get("label"))
            value = normalize_text(entry.get("value"))
            if label:
                humanized_label = humanize_field_name(label)
                add_anchor(anchors, humanized_label, humanized_label, "field", False, 0.8)
            derived_pairs = list(extract_fact_values(value))
            if derived_pairs:
                for fact_label, fact_value in derived_pairs:
                    add_anchor(anchors, fact_label, fact_value, "evidence", True, 4.2)
                    humanized_label = humanize_field_name(fact_label)
                    add_anchor(anchors, humanized_label, humanized_label, "field", False, 0.8)
            elif not is_low_signal(value):
                add_anchor(anchors, label or "Observed value", value, "evidence", True, 4.2)
            for phrase in derive_field_phrases(value):
                add_anchor(anchors, phrase, phrase, "field", False, 0.8)

        for entry in evidence.get("monthlyComparisons") or []:
            if not isinstance(entry, dict):
                continue
            month = normalize_text(entry.get("month"))
            left_label = normalize_text(entry.get("leftLabel"))
            right_label = normalize_text(entry.get("rightLabel"))
            left_value = normalize_text(entry.get("leftValue"))
            right_value = normalize_text(entry.get("rightValue"))
            if month and MONTH_TOKEN_PATTERN.search(month):
                add_anchor(anchors, "Month", month, "timeline", False, 1.0)
            if left_value:
                add_anchor(anchors, left_label or month or "Observed value", left_value, "evidence", False, 2.8)
            if right_value:
                add_anchor(anchors, right_label or month or "Observed value", right_value, "evidence", False, 2.8)
            if left_label:
                humanized_label = humanize_field_name(left_label)
                add_anchor(anchors, humanized_label, humanized_label, "field", False, 0.75)
            if right_label:
                humanized_label = humanize_field_name(right_label)
                add_anchor(anchors, humanized_label, humanized_label, "field", False, 0.75)

    ordered = sorted(anchors.values(), key=lambda anchor: (anchor.required, anchor.weight, len(anchor.tokens)), reverse=True)
    return ordered[:18]


def search_anchor(words: Sequence[Word], anchor: Anchor, page_number: int, source: str) -> List[Match]:
    if not anchor.tokens:
        return []
    if anchor.kind == "field" and len(anchor.tokens) < 2:
        return []

    token_count = len(anchor.tokens)
    word_tokens = [word.token for word in words]
    results: List[Match] = []
    anchor_compact = compact_value(anchor.text)

    for index, word in enumerate(words):
        if word_tokens[index] != anchor.tokens[0]:
            if token_count > 1 and word.compact == anchor_compact:
                results.append(
                    Match(
                        anchor=anchor,
                        page_number=page_number,
                        box=word.box,
                        confidence=0.98 if source == "pdf" else 0.82,
                        source=source,
                        matched_text=word.text,
                        pdf_box=word.pdf_box,
                    )
                )
            continue
        if index + token_count > len(words):
            continue
        window = words[index : index + token_count]
        if [entry.token for entry in window] != anchor.tokens:
            continue
        merged = union_boxes([entry.box for entry in window])
        if not merged:
            continue
        results.append(
            Match(
                anchor=anchor,
                page_number=page_number,
                box=merged,
                confidence=0.99 if source == "pdf" else 0.84,
                source=source,
                matched_text=" ".join(entry.text for entry in window),
                pdf_box=union_pdf_boxes([entry.pdf_box for entry in window]),
            )
        )

    deduped: List[Match] = []
    seen = set()
    for match in results:
        key = (
            round(match.box["x"], 1),
            round(match.box["y"], 1),
            round(match.box["width"], 1),
            round(match.box["height"], 1),
            match.anchor.id,
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(match)
    return deduped[:4]


def boxes_are_close(left: Dict[str, float], right: Dict[str, float], threshold_x: float, threshold_y: float) -> bool:
    left_x2 = left["x"] + left["width"]
    left_y2 = left["y"] + left["height"]
    right_x2 = right["x"] + right["width"]
    right_y2 = right["y"] + right["height"]
    return not (
        left_x2 + threshold_x < right["x"]
        or right_x2 + threshold_x < left["x"]
        or left_y2 + threshold_y < right["y"]
        or right_y2 + threshold_y < left["y"]
    )


def cluster_matches(matches: Sequence[Match], page_image_width: int, page_image_height: int) -> List[Cluster]:
    if not matches:
        return []

    threshold_x = max(36.0, page_image_width * 0.04)
    threshold_y = max(26.0, page_image_height * 0.035)
    clusters: List[Cluster] = []

    for match in sorted(matches, key=lambda entry: (entry.page_number, entry.box["y"], entry.box["x"])):
        placed = False
        for cluster in clusters:
            if cluster.page_number != match.page_number:
                continue
            if boxes_are_close(cluster.box, match.box, threshold_x, threshold_y):
                cluster.add(match)
                placed = True
                break
        if not placed:
            cluster = Cluster(
                page_number=match.page_number,
                page_image_width=page_image_width,
                page_image_height=page_image_height,
            )
            cluster.add(match)
            clusters.append(cluster)

    return clusters


def create_match(
    anchor: Anchor,
    page_number: int,
    box: Dict[str, float],
    confidence: float,
    source: str,
    matched_text: str,
    pdf_box: Optional[Dict[str, float]] = None,
    provenance_id: Optional[str] = None,
) -> Match:
    return Match(
        anchor=anchor,
        page_number=page_number,
        box=box,
        confidence=confidence,
        source=source,
        matched_text=matched_text,
        pdf_box=pdf_box,
        provenance_id=provenance_id,
    )


def build_slide_from_matches(
    matches: Sequence[Match],
    page_image_width: int,
    page_image_height: int,
    label: Optional[str] = None,
    padding_override: Optional[Tuple[float, float]] = None,
    contextual_crop: Optional[Dict[str, object]] = None,
) -> Dict[str, object]:
    merged_box = union_boxes([match.box for match in matches])
    if not merged_box:
        merged_box = {"x": 0.0, "y": 0.0, "width": float(page_image_width), "height": float(page_image_height)}
    if padding_override:
        padding_x = max(float(padding_override[0]), page_image_width * 0.01)
        padding_y = max(float(padding_override[1]), page_image_height * 0.01)
    else:
        padding_x = max(40.0, page_image_width * 0.04)
        padding_y = max(34.0, page_image_height * 0.04)
    crop_box = (
        contextual_crop.get("cropBox")
        if isinstance(contextual_crop, dict) and isinstance(contextual_crop.get("cropBox"), dict)
        else expand_box(merged_box, page_image_width, page_image_height, padding_x, padding_y)
    )
    crop_padding = (
        contextual_crop.get("cropPadding")
        if isinstance(contextual_crop, dict) and isinstance(contextual_crop.get("cropPadding"), dict)
        else {"x": round(padding_x, 2), "y": round(padding_y, 2)}
    )

    unique_labels: List[str] = []
    for match in sorted(matches, key=lambda entry: (-entry.anchor.weight, entry.anchor.label)):
        if match.anchor.label not in unique_labels:
            unique_labels.append(match.anchor.label)
        if len(unique_labels) >= 2:
            break

    # Merge matches that landed on the identical rect into ONE box with a combined
    # label — distinct detections that legitimately cite the same printed value must
    # not stack translucent highlights (they compound visually and read as N pins).
    SOURCE_RANK = {"layout": 0, "inferred_gap": 1, "pdf": 2, "inferred_blank": 3, "ocr": 4}
    merged_by_rect: Dict[Tuple[int, int, int, int], Dict[str, object]] = {}
    rect_order: List[Tuple[int, int, int, int]] = []
    for match in sorted(matches, key=lambda entry: (-entry.anchor.weight, entry.box["y"], entry.box["x"])):
        clipped = clip_box(match.box, page_image_width, page_image_height)
        rect_key = (clipped["x"], clipped["y"], clipped["width"], clipped["height"])
        existing = merged_by_rect.get(rect_key)
        if existing is None:
            merged_by_rect[rect_key] = {
                "clipped": clipped,
                "labels": [match.anchor.label],
                "confidence": match.confidence,
                "best": match,
                "kinds": {match.anchor.kind},
            }
            rect_order.append(rect_key)
            continue
        if match.anchor.label not in existing["labels"]:
            existing["labels"].append(match.anchor.label)
        existing["confidence"] = max(existing["confidence"], match.confidence)
        existing["kinds"].add(match.anchor.kind)
        best = existing["best"]
        if (match.pdf_box and not best.pdf_box) or (
            bool(match.pdf_box) == bool(best.pdf_box)
            and SOURCE_RANK.get(match.source, 9) < SOURCE_RANK.get(best.source, 9)
        ):
            existing["best"] = match

    highlight_boxes = []
    for rect_key in rect_order:
        entry = merged_by_rect[rect_key]
        best = entry["best"]
        # A box is identity context only when EVERY contributing anchor is identity —
        # one evidence/field contributor makes it substantive.
        box_kind = "identity" if entry["kinds"] == {"identity"} else next(
            (kind for kind in ("evidence", "history", "history_gap", "account_field", "timeline", "field", "summary") if kind in entry["kinds"]),
            best.anchor.kind,
        )
        highlight_boxes.append(
            {
                **entry["clipped"],
                "label": " + ".join(entry["labels"]),
                "confidence": round(entry["confidence"], 3),
                "source": best.source,
                "kind": box_kind,
                **({"pdfBox": best.pdf_box} if best.pdf_box else {}),
                **({"provenanceId": best.provenance_id} if best.provenance_id else {}),
            }
        )

    return {
        "id": f"page-{matches[0].page_number}-{'-'.join(part.lower().replace(' ', '-') for part in (label.split(' + ') if label else unique_labels)) or 'evidence'}",
        "pageNumber": matches[0].page_number,
        "label": label or (" + ".join(unique_labels) if unique_labels else "Evidence"),
        "confidence": round(min(0.999, max(match.confidence for match in matches)), 3),
        "pageImageWidth": page_image_width,
        "pageImageHeight": page_image_height,
        "cropBox": crop_box,
        "highlightBoxes": highlight_boxes,
        "matchedText": " | ".join(
            dict.fromkeys(
                normalize_text(match.matched_text) for match in matches if normalize_text(match.matched_text)
            )
        ),
        "cropPadding": crop_padding,
    }


def build_slide_from_cluster(cluster: Cluster) -> Dict[str, object]:
    return build_slide_from_matches(cluster.matches, cluster.page_image_width, cluster.page_image_height)


def compact_numeric_value(value: str) -> str:
    return re.sub(r"[^0-9.]+", "", normalize_text(value))


def values_match(left: str, right: str) -> bool:
    normalized_left = normalize_text(left)
    normalized_right = normalize_text(right)
    if not normalized_left or not normalized_right:
        return False
    if compact_value(normalized_left) == compact_value(normalized_right):
        return True
    numeric_amount_left = numeric_amount(normalized_left)
    numeric_amount_right = numeric_amount(normalized_right)
    if numeric_amount_left is not None and numeric_amount_right is not None and abs(numeric_amount_left - numeric_amount_right) < 0.005:
        return True
    numeric_left = compact_numeric_value(normalized_left)
    numeric_right = compact_numeric_value(normalized_right)
    if numeric_left and numeric_right and numeric_left == numeric_right:
        return True
    return False


def field_matches_requested_value(cell: AccountHistoryCell, requested_value: str) -> bool:
    normalized_requested = normalize_text(requested_value).lower()
    if not normalized_requested:
        return False
    if normalized_requested in {"blank", "missing", "not reported", "not available"}:
        return cell.state == "blank" or not normalize_text(cell.value)
    if normalized_requested == "present":
        return cell.state != "blank" and bool(normalize_text(cell.value))
    return values_match(cell.value, requested_value)


def build_account_history_match(label: str, cell: AccountHistoryCell, weight: float, matched_text: Optional[str] = None) -> Match:
    anchor = create_anchor(label, label, "history", False, weight)
    return create_match(
        anchor,
        cell.page_number,
        cell.box,
        0.995,
        "layout",
        matched_text or normalize_text(cell.value) or f"{format_month_reference(cell.year, cell.month)} blank",
        pdf_box=cell.pdf_box,
        provenance_id=cell.id,
    )


def build_account_field_match(label: str, field: AccountFieldEvidence, weight: float, matched_text: Optional[str] = None) -> Match:
    anchor = create_anchor(label, label, "account_field", False, weight)
    return create_match(
        anchor,
        field.page_number,
        field.box,
        0.999,
        "layout",
        matched_text or normalize_text(field.value) or label,
        pdf_box=field.pdf_box,
        provenance_id=field.id,
    )


def unique_non_generic_texts(values: Sequence[object]) -> List[str]:
    deduped: List[str] = []
    seen = set()
    for value in values:
        normalized = normalize_text(value)
        if not normalized or normalized.lower() in GENERIC_VALUE_TOKENS:
            continue
        key = compact_value(normalized)
        if not key or key in seen:
            continue
        seen.add(key)
        deduped.append(normalized)
    return deduped


def search_spec_matches(locator: PageTextLocator, target_pages: Sequence[int], spec: TextSearchSpec) -> List[Match]:
    matches: List[Match] = []
    for text in unique_non_generic_texts(spec.texts):
        anchor = create_anchor(spec.label, text, spec.kind, spec.required, spec.weight)
        for page_number in target_pages:
            words = locator.page_words.get(page_number) or []
            source = locator.page_sources.get(page_number, "pdf")
            matches.extend(search_anchor(words, anchor, page_number, source))

    deduped: List[Match] = []
    seen = set()
    for match in sorted(
        matches,
        key=lambda entry: (
            entry.page_number,
            -entry.confidence,
            -entry.anchor.weight,
            round(entry.box["y"], 2),
            round(entry.box["x"], 2),
        ),
    ):
        key = (
            match.page_number,
            round(match.box["x"], 1),
            round(match.box["y"], 1),
            round(match.box["width"], 1),
            round(match.box["height"], 1),
            match.anchor.id,
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(match)
    return deduped


def build_targeted_text_slide(
    locator: PageTextLocator,
    target_pages: Sequence[int],
    label: str,
    specs: Sequence[TextSearchSpec],
    minimum_matches: int = 2,
) -> Optional[Dict[str, object]]:
    if not target_pages:
        return None

    page_candidates: Dict[int, List[Match]] = defaultdict(list)
    for spec in specs:
        per_page_best: Dict[int, Match] = {}
        for match in search_spec_matches(locator, target_pages, spec):
            current = per_page_best.get(match.page_number)
            current_score = (current.anchor.weight * current.confidence) if current else -1.0
            candidate_score = match.anchor.weight * match.confidence
            if candidate_score > current_score:
                per_page_best[match.page_number] = match
        for page_number, match in per_page_best.items():
            page_candidates[page_number].append(match)

    best_page = None
    best_matches: List[Match] = []
    best_score = -1.0
    for page_number, matches in page_candidates.items():
        if len(matches) < minimum_matches:
            continue
        score = sum(match.anchor.weight * match.confidence for match in matches)
        score += len({match.anchor.id for match in matches}) * 2.5
        if score > best_score:
            best_score = score
            best_page = page_number
            best_matches = matches

    if best_page is None or not best_matches:
        return None

    page_image_width, page_image_height = locator.page_sizes[best_page]
    ordered_matches = sorted(best_matches, key=lambda entry: (-entry.anchor.weight, entry.box["y"], entry.box["x"]))
    return build_slide_from_matches(ordered_matches, page_image_width, page_image_height, label=label)


def split_value_progression(value: str) -> Optional[Tuple[str, str]]:
    clean = normalize_text(value)
    if "->" not in clean:
        return None
    left, right = clean.split("->", 1)
    left = normalize_text(left)
    right = normalize_text(right)
    if not left or not right:
        return None
    return left, right


def find_history_cells_for_month(
    account_context: AccountEvidenceContext,
    field_name: str,
    year: str,
    month_key: str,
    expected_values: Optional[Sequence[str]] = None,
) -> List[AccountHistoryCell]:
    normalized_field = normalize_history_field_name(field_name) or field_name
    cell = account_context.history_cells.get(normalized_field, {}).get((year, month_key))
    if not cell:
        return []
    if expected_values:
        for value in expected_values:
            if field_matches_requested_value(cell, value):
                return [cell]
        return []
    return [cell]


def find_history_cells_by_value(
    account_context: AccountEvidenceContext,
    field_name: str,
    requested_value: str,
) -> List[AccountHistoryCell]:
    normalized_field = normalize_history_field_name(field_name) or field_name
    cells = account_context.history_cells.get(normalized_field, {})
    matches = [cell for cell in cells.values() if field_matches_requested_value(cell, requested_value)]
    return sorted(matches, key=lambda entry: (entry.page_number, entry.year, MONTH_KEYS.index(entry.month)))


PROVENANCE_PHASE_ONE_ISSUES = {
    "payment_history_balance_history_conflict",
    "balance_history_monthly_gap_conflict",
    "high_balance_not_supported_by_history",
    "insufficient_balance_history",
    "balance_updated_timeline_conflict",
    "payment_history_missing_months",
    "recent_payment_missing_when_history_implies_payment",
    "delinquency_progression_inconsistency",
    "severe_delinquency_jump_without_predecessor_support",
    "reaging_jump_after_current_reset",
    "retroactive_derogatory_backfill_after_reporting_gap",
    "payment_activity_conflicts_with_delinquency_progression",
}

PAYMENT_HISTORY_ACCURACY_ISSUES = {
    "payment_history_missing_months",
    "recent_payment_missing_when_history_implies_payment",
    "delinquency_progression_inconsistency",
    "severe_delinquency_jump_without_predecessor_support",
    "reaging_jump_after_current_reset",
    "retroactive_derogatory_backfill_after_reporting_gap",
    "payment_activity_conflicts_with_delinquency_progression",
    "payment_plan_or_forbearance_context_with_derogatory_conflict",
}

PAYMENT_HISTORY_ROW_CONTEXT_ISSUES = {
    "payment_history_missing_months",
    "delinquency_progression_inconsistency",
    "severe_delinquency_jump_without_predecessor_support",
    "reaging_jump_after_current_reset",
    "retroactive_derogatory_backfill_after_reporting_gap",
    "payment_activity_conflicts_with_delinquency_progression",
    "payment_plan_or_forbearance_context_with_derogatory_conflict",
}

ISSUE_IGNORED_LABELS = {
    "payment_history_missing_months": [
        "Payment history guide",
        "Payment status legend",
        "Balance history rows",
        "Section headers",
    ],
    "recent_payment_missing_when_history_implies_payment": [
        "Payment history guide",
        "Balance history rows",
        "Section headers",
    ],
    "delinquency_progression_inconsistency": [
        "Payment history guide",
        "Status legend",
        "Balance history rows",
    ],
    "severe_delinquency_jump_without_predecessor_support": [
        "Payment history guide",
        "Status legend",
        "Balance history rows",
        "Section headers",
    ],
    "reaging_jump_after_current_reset": [
        "Payment history guide",
        "Status legend",
        "Balance history rows",
        "Section headers",
    ],
    "retroactive_derogatory_backfill_after_reporting_gap": [
        "Payment history guide",
        "Status legend",
        "Balance history rows",
    ],
    "payment_activity_conflicts_with_delinquency_progression": [
        "Payment history guide",
        "Status legend",
        "Balance history rows",
        "Section headers",
    ],
    "payment_plan_or_forbearance_context_with_derogatory_conflict": [
        "Payment history guide",
        "Status legend",
        "Balance history rows",
        "Section headers",
    ],
}


def month_sort_value(year: str, month: str) -> int:
    try:
        return int(year) * 12 + MONTH_KEYS.index(month)
    except (ValueError, IndexError):
        return -1


def numeric_amount(value: str) -> Optional[float]:
    clean = normalize_text(value)
    if not clean:
        return None
    amount_match = AMOUNT_TOKEN_PATTERN.search(clean)
    token = normalize_text(amount_match.group(0) if amount_match else clean)
    compact = compact_numeric_value(token)
    if not compact:
        return None
    try:
        return float(compact)
    except ValueError:
        return None


def resolve_field_evidence(account_context: Optional[AccountEvidenceContext], field_name: str) -> Optional[AccountFieldEvidence]:
    if not account_context:
        return None
    for candidate in [field_name, *ACCOUNT_FIELD_VALUE_CANDIDATES.get(field_name, [])]:
        normalized_candidate = normalize_text(candidate)
        if normalized_candidate in account_context.field_evidence:
            return account_context.field_evidence[normalized_candidate]
    return None


def resolve_history_cell(
    account_context: Optional[AccountEvidenceContext],
    field_name: str,
    year: str,
    month: str,
) -> Optional[AccountHistoryCell]:
    if not account_context:
        return None
    normalized_field = normalize_history_field_name(field_name) or field_name
    return account_context.history_cells.get(normalized_field, {}).get((year, month))


def resolve_latest_history_cell(
    account_context: Optional[AccountEvidenceContext],
    field_name: str,
) -> Optional[AccountHistoryCell]:
    if not account_context:
        return None
    normalized_field = normalize_history_field_name(field_name) or field_name
    cells = list(account_context.history_cells.get(normalized_field, {}).values())
    if not cells:
        return None
    return max(cells, key=lambda cell: month_sort_value(cell.year, cell.month))


def resolve_max_history_cell(
    account_context: Optional[AccountEvidenceContext],
    field_name: str,
) -> Optional[AccountHistoryCell]:
    if not account_context:
        return None
    normalized_field = normalize_history_field_name(field_name) or field_name
    best_cell: Optional[AccountHistoryCell] = None
    best_value: Optional[float] = None
    for cell in account_context.history_cells.get(normalized_field, {}).values():
        value = numeric_amount(cell.value)
        if value is None:
            continue
        if best_value is None or value > best_value:
            best_value = value
            best_cell = cell
    return best_cell


def iter_history_cells(
    account_context: Optional[AccountEvidenceContext],
    fields: Optional[Sequence[str]] = None,
) -> Iterable[AccountHistoryCell]:
    if not account_context:
        return []
    if fields:
        normalized_fields = {normalize_history_field_name(field_name) or field_name for field_name in fields}
    else:
        normalized_fields = set(account_context.history_cells.keys())
    cells: List[AccountHistoryCell] = []
    for field_name in normalized_fields:
        cells.extend(account_context.history_cells.get(field_name, {}).values())
    return cells


def resolve_neighbor_history_cells(
    account_context: Optional[AccountEvidenceContext],
    field_name: str,
    year: str,
    month: str,
) -> Tuple[Optional[AccountHistoryCell], Optional[AccountHistoryCell]]:
    if not account_context:
        return None, None
    normalized_field = normalize_history_field_name(field_name) or field_name
    cells = sorted(
        account_context.history_cells.get(normalized_field, {}).values(),
        key=lambda cell: month_sort_value(cell.year, cell.month),
    )
    target_value = month_sort_value(year, month)
    previous_cell: Optional[AccountHistoryCell] = None
    next_cell: Optional[AccountHistoryCell] = None
    for cell in cells:
        cell_value = month_sort_value(cell.year, cell.month)
        if cell_value < target_value and cell.state != "blank":
            previous_cell = cell
            continue
        if cell_value > target_value and cell.state != "blank":
            next_cell = cell
            break
    return previous_cell, next_cell


def resolve_history_cell_by_provenance(
    account_context: Optional[AccountEvidenceContext],
    provenance_id: Optional[str],
) -> Optional[AccountHistoryCell]:
    target_id = normalize_text(provenance_id)
    if not account_context or not target_id:
        return None
    for cell in iter_history_cells(account_context):
        if normalize_text(cell.id) == target_id:
            return cell
    return None


def build_payment_history_contextual_crop(
    issue_type: str,
    account_context: Optional[AccountEvidenceContext],
    matches: Sequence[Match],
    page_image_width: int,
    page_image_height: int,
) -> Optional[Dict[str, object]]:
    if not account_context or not matches:
        return None

    page_number = matches[0].page_number
    matched_cells: List[AccountHistoryCell] = []
    inferred_gap_targets: List[Tuple[str, str, str]] = []
    for match in matches:
        cell = resolve_history_cell_by_provenance(account_context, match.provenance_id)
        if not cell or cell.page_number != page_number:
            provenance_id = normalize_text(match.provenance_id)
            if provenance_id.startswith("gap:"):
                _, field_name, gap_year, gap_month = provenance_id.split(":", 3)
                normalized_field = normalize_history_field_name(field_name) or field_name
                inferred_gap_targets.append((normalized_field, gap_year, gap_month))
            continue
        matched_cells.append(cell)

    if not matched_cells and not inferred_gap_targets:
        return None

    # Row context follows the fields the matches actually landed in (payment history,
    # balance history, actual payment, …) — every history table gets its year row.
    target_fields = {cell.field for cell in matched_cells}
    target_fields.update(field_name for field_name, _year, _month in inferred_gap_targets)
    expanded_fields = set(target_fields)
    for field_name in target_fields:
        if field_name.endswith("GapSlots"):
            expanded_fields.add(field_name[: -len("GapSlots")])
        else:
            expanded_fields.add(f"{field_name}GapSlots")

    target_years = {cell.year for cell in matched_cells}
    target_years.update(year for _field_name, year, _month in inferred_gap_targets)
    row_cells: List[AccountHistoryCell] = []
    field_page_cells: List[AccountHistoryCell] = []
    for field_name in expanded_fields:
        for cell in account_context.history_cells.get(field_name, {}).values():
            if cell.page_number != page_number:
                continue
            field_page_cells.append(cell)
            if cell.year in target_years:
                row_cells.append(cell)

    if inferred_gap_targets and len(row_cells) < 4:
        row_cells = list(field_page_cells)

    if not row_cells:
        row_cells = matched_cells

    row_box = union_boxes([cell.box for cell in row_cells])
    if not row_box:
        return None

    widths = [max(1.0, float(cell.box["width"])) for cell in row_cells]
    heights = [max(1.0, float(cell.box["height"])) for cell in row_cells]
    avg_cell_width = max(20.0, sum(widths) / len(widths)) if widths else max(20.0, row_box["width"] / max(len(row_cells), 1))
    avg_cell_height = max(14.0, sum(heights) / len(heights)) if heights else max(14.0, row_box["height"])

    # Left padding must reach the table's year-label column (roughly 8 cell widths
    # left of the first month cell on the dense 7-year grid; wider tables clip at 0).
    left_padding = max(avg_cell_width * 8.0, row_box["width"] * 0.14, page_image_width * 0.03)
    right_padding = max(avg_cell_width * 0.95, page_image_width * 0.01)
    top_padding = max(avg_cell_height * 2.25, page_image_height * 0.02)
    bottom_padding = max(avg_cell_height * 0.8, page_image_height * 0.01)

    # Extend the crop up to the table's top so the month header row (and the year
    # rows between) stay visible — a highlighted cell without its column header
    # doesn't tell the reviewer WHICH month is marked. Capped to keep crops sane.
    if field_page_cells:
        table_top = min(float(cell.box["y"]) for cell in field_page_cells)
        header_padding = row_box["y"] - table_top + avg_cell_height * 2.6
        top_padding = min(
            max(top_padding, header_padding),
            page_image_height * 0.15,
        )

    crop_box = clip_box(
        {
            "x": row_box["x"] - left_padding,
            "y": row_box["y"] - top_padding,
            "width": row_box["width"] + left_padding + right_padding,
            "height": row_box["height"] + top_padding + bottom_padding,
        },
        page_image_width,
        page_image_height,
    )

    return {
        "cropBox": crop_box,
        "cropPadding": {
            "x": round(max(left_padding, right_padding), 2),
            "y": round(max(top_padding, bottom_padding), 2),
        },
    }


def infer_history_gap_match(
    account_context: Optional[AccountEvidenceContext],
    field_name: str,
    year: str,
    month: str,
    locator: PageTextLocator,
    label: Optional[str] = None,
) -> Optional[Match]:
    if not account_context:
        return None
    normalized_field = normalize_history_field_name(field_name) or field_name
    cells = list(account_context.history_cells.get(normalized_field, {}).values())
    if not cells:
        return None

    target_value = month_sort_value(year, month)
    prior_candidates = [cell for cell in cells if month_sort_value(cell.year, cell.month) > target_value]
    next_candidates = [cell for cell in cells if month_sort_value(cell.year, cell.month) < target_value]
    if prior_candidates and not next_candidates:
        # The target month predates every recorded cell. There is no row on the face
        # where this month belongs — an interpolated rect would mark a DIFFERENT
        # month's empty cell and mislead the reviewer. Absence outside the table's
        # printed range is carried by the blank scalar rows instead.
        return None
    upper = min(prior_candidates, key=lambda cell: month_sort_value(cell.year, cell.month) - target_value) if prior_candidates else None
    lower = min(next_candidates, key=lambda cell: target_value - month_sort_value(cell.year, cell.month)) if next_candidates else None
    section_field = resolve_field_evidence(account_context, "balanceHistorySection")

    pdf_box: Optional[Dict[str, float]] = None
    if upper and lower and upper.page_number == lower.page_number and upper.pdf_box and lower.pdf_box:
        x_min = min(float(upper.pdf_box["xMin"]), float(lower.pdf_box["xMin"]))
        x_max = max(float(upper.pdf_box["xMax"]), float(lower.pdf_box["xMax"]))
        y_min = float(upper.pdf_box["yMax"])
        y_max = float(lower.pdf_box["yMin"])
        if y_max <= y_min:
            row_height = max(
                8.0,
                (
                    (float(upper.pdf_box["yMax"]) - float(upper.pdf_box["yMin"]))
                    + (float(lower.pdf_box["yMax"]) - float(lower.pdf_box["yMin"]))
                )
                / 2.0,
            )
            center = (float(upper.pdf_box["yMax"]) + float(lower.pdf_box["yMin"])) / 2.0
            y_min = center - row_height * 0.45
            y_max = center + row_height * 0.45
        pdf_box = {
            "xMin": x_min,
            "xMax": x_max,
            "yMin": y_min,
            "yMax": y_max,
        }
        page_number = upper.page_number
    elif lower and lower.pdf_box:
        row_height = max(10.0, float(lower.pdf_box["yMax"]) - float(lower.pdf_box["yMin"]))
        y_max = float(lower.pdf_box["yMin"]) - 2.0
        y_min = y_max - row_height
        if section_field and section_field.page_number == lower.page_number and section_field.pdf_box:
            y_min = max(float(section_field.pdf_box["yMax"]) + 2.0, y_min)
        pdf_box = {
            "xMin": float(lower.pdf_box["xMin"]),
            "xMax": float(lower.pdf_box["xMax"]),
            "yMin": y_min,
            "yMax": max(y_min + 8.0, y_max),
        }
        page_number = lower.page_number
    elif upper and upper.pdf_box:
        row_height = max(10.0, float(upper.pdf_box["yMax"]) - float(upper.pdf_box["yMin"]))
        y_min = float(upper.pdf_box["yMax"]) + 2.0
        y_max = y_min + row_height
        pdf_box = {
            "xMin": float(upper.pdf_box["xMin"]),
            "xMax": float(upper.pdf_box["xMax"]),
            "yMin": y_min,
            "yMax": y_max,
        }
        page_number = upper.page_number
    else:
        return None

    history_label = label or (
        "Missing payment-history support"
        if normalized_field == "paymentHistory" or normalized_field == "paymentHistoryGapSlots"
        else "Missing balance-history support"
    )
    anchor = create_anchor(history_label, history_label, "history_gap", False, 5.0)
    return create_match(
        anchor,
        page_number,
        locator.pdf_bbox_to_image_box(page_number, pdf_box),
        0.995,
        "inferred_gap",
        missing_history_slot_text(normalized_field, year, month),
        pdf_box=pdf_box,
        provenance_id=f"gap:{normalized_field}:{year}:{month}",
    )


def dedupe_slides(slides: Sequence[Dict[str, object]]) -> List[Dict[str, object]]:
    deduped: List[Dict[str, object]] = []
    seen = set()
    for slide in slides:
        key = (
            slide["pageNumber"],
            slide["label"],
            tuple((box["x"], box["y"], box["width"], box["height"]) for box in slide.get("highlightBoxes", [])),
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(slide)
    return deduped


def reason_requires_provenance(reason: Dict[str, object]) -> bool:
    return (
        normalize_text(reason.get("profileId")) == "experian_acr_v1"
        and normalize_text(reason.get("issueType")).lower() in PROVENANCE_PHASE_ONE_ISSUES
    )


# Export grade is a QUALITY property of box geometry, not of the route that built it.
# A box qualifies when its rect carries exact PDF-point geometry (pdfBox) from a
# trusted source: extraction-measured cells ("layout"), gaps interpolated between two
# measured cells ("inferred_gap"), the source PDF's text layer ("pdf"), or blank value
# regions synthesized from a measured label row ("inferred_blank" — absence evidence).
# OCR-derived rects stay below the export bar.
# TransUnion column-interpolated cells (provenanceId prefix "layout:") were PROMOTED to
# export grade after the 2026-07-12 TU visual session: placement verified on the monthly
# block tables and the Rating grid (TU tables are evenly columned, matching the
# interpolation's assumption). See tmp/diagnostics/highlighter-s21/FINDINGS.md.
EXPORT_GRADE_BOX_SOURCES = {"layout", "inferred_gap", "pdf", "inferred_blank"}


def highlight_box_is_export_grade(box: Dict[str, object]) -> bool:
    if not isinstance(box, dict) or not isinstance(box.get("pdfBox"), dict):
        return False
    if box.get("source") not in EXPORT_GRADE_BOX_SOURCES:
        return False
    return True


def slides_are_export_grade(slides: Sequence[Dict[str, object]]) -> bool:
    if not slides:
        return False
    for slide in slides:
        boxes = slide.get("highlightBoxes") if isinstance(slide, dict) else None
        if not boxes or not all(highlight_box_is_export_grade(box) for box in boxes):
            return False
    return True


def resolve_reason_provenance_match(
    reason: Dict[str, object],
    ref: Dict[str, object],
    account_context: Optional[AccountEvidenceContext],
    locator: PageTextLocator,
) -> Optional[Match]:
    if not account_context:
        return None

    kind = normalize_text(ref.get("kind")).lower()
    field_name = normalize_text(ref.get("fieldName"))
    label = normalize_text(ref.get("label")) or field_name or "Evidence"
    expected_value = normalize_text(ref.get("expectedValue"))

    if kind == "field":
        field_detail = resolve_field_evidence(account_context, field_name)
        if not field_detail:
            return None
        return build_account_field_match(label, field_detail, 5.2, matched_text=field_detail.value)

    if kind == "history_cell":
        year = normalize_text(ref.get("year"))
        month = normalize_text(ref.get("month")).lower()
        cell = resolve_history_cell(account_context, field_name, year, month)
        if not cell:
            return None
        if expected_value and not values_match(cell.value, expected_value):
            return None
        matched_text = missing_history_slot_text(field_name, cell.year, cell.month) if cell.state == "missing_slot" else cell.value
        return build_account_history_match(label, cell, 5.0, matched_text=matched_text)

    if kind == "history_latest":
        cell = resolve_latest_history_cell(account_context, field_name)
        if not cell:
            return None
        return build_account_history_match(label, cell, 5.0, matched_text=cell.value)

    if kind == "history_max":
        cell = resolve_max_history_cell(account_context, field_name)
        if not cell:
            return None
        return build_account_history_match(label, cell, 5.0, matched_text=cell.value)

    if kind == "history_gap":
        year = normalize_text(ref.get("year"))
        month = normalize_text(ref.get("month")).lower()
        return infer_history_gap_match(account_context, field_name, year, month, locator)

    return None


def resolve_issue_padding(issue_type: str, page_image_width: int, page_image_height: int, retry_mode: str) -> Optional[Tuple[float, float]]:
    normalized_retry = normalize_text(retry_mode).lower()
    if issue_type in PAYMENT_HISTORY_ACCURACY_ISSUES:
        if normalized_retry == "tight":
            return (
                max(8.0, page_image_width * 0.012),
                max(8.0, page_image_height * 0.01),
            )
        return (
            max(14.0, page_image_width * 0.018),
            max(12.0, page_image_height * 0.014),
        )
    if normalized_retry == "tight":
        return (
            max(22.0, page_image_width * 0.022),
            max(18.0, page_image_height * 0.02),
        )
    return None


def build_provenance_slides(
    reason: Dict[str, object],
    account_context: Optional[AccountEvidenceContext],
    locator: PageTextLocator,
    retry_mode: str = "default",
) -> Tuple[List[Dict[str, object]], bool]:
    raw_refs = reason.get("evidenceRefs") or []
    if not isinstance(raw_refs, list) or not raw_refs:
        return [], False

    grouped_matches: Dict[Tuple[str, str], List[Match]] = defaultdict(list)
    unresolved = False

    for ref in raw_refs:
        if not isinstance(ref, dict):
            unresolved = True
            continue
        slide_id = normalize_text(ref.get("slideId")) or "evidence"
        slide_label = normalize_text(ref.get("slideLabel")) or normalize_text(reason.get("issueLabel")) or "Evidence"
        match = resolve_reason_provenance_match(reason, ref, account_context, locator)
        if not match:
            unresolved = True
            continue
        grouped_matches[(slide_id, slide_label)].append(match)

    slides: List[Dict[str, object]] = []
    issue_type = normalize_text(reason.get("issueType")).lower()
    for (_slide_id, slide_label), matches in grouped_matches.items():
        page_groups: Dict[int, List[Match]] = defaultdict(list)
        for match in matches:
            page_groups[match.page_number].append(match)
        ordered_pages = sorted(page_groups.keys())
        for page_number in ordered_pages:
            page_matches = page_groups[page_number]
            page_image_width, page_image_height = locator.page_sizes[page_number]
            label = slide_label if len(ordered_pages) == 1 else f"{slide_label} · page {page_number}"
            contextual_crop = build_payment_history_contextual_crop(
                issue_type,
                account_context,
                page_matches,
                page_image_width,
                page_image_height,
            )
            slides.append(
                build_slide_from_matches(
                    page_matches,
                    page_image_width,
                    page_image_height,
                    label=label,
                    padding_override=resolve_issue_padding(issue_type, page_image_width, page_image_height, retry_mode),
                    contextual_crop=contextual_crop,
                )
            )

    return dedupe_slides(slides)[:5], unresolved


def build_structured_slides(
    reason: Dict[str, object],
    account_context: Optional[AccountEvidenceContext],
    locator: PageTextLocator,
) -> List[Dict[str, object]]:
    if not account_context:
        return []

    issue_type = normalize_text(reason.get("issueType")).lower()
    evidence = reason.get("evidence") or {}
    scalar_comparisons = evidence.get("scalarComparisons") or [] if isinstance(evidence, dict) else []
    monthly_comparisons = evidence.get("monthlyComparisons") or [] if isinstance(evidence, dict) else []
    slides: List[Dict[str, object]] = []
    target_pages = account_context.pages or list(range(1, locator.page_count + 1))

    def first_same_page_cells(
        field_name: str,
        year: str,
        month_key: str,
        expected_values: Optional[Sequence[str]] = None,
        preferred_page: Optional[int] = None,
    ) -> List[AccountHistoryCell]:
        cells = find_history_cells_for_month(account_context, field_name, year, month_key, expected_values)
        if not cells:
            return []
        if preferred_page:
            same_page = [cell for cell in cells if cell.page_number == preferred_page]
            if same_page:
                return same_page
        return cells

    def slide_from_matches(label: str, matches: List[Match]):
        if not matches:
            return
        page_number = matches[0].page_number
        page_image_width, page_image_height = locator.page_sizes[page_number]
        slides.append(build_slide_from_matches(matches, page_image_width, page_image_height, label=label))

    def slide_from_matches_with_context(label: str, matches: List[Match]):
        if not matches:
            return
        page_number = matches[0].page_number
        page_image_width, page_image_height = locator.page_sizes[page_number]
        contextual_crop = build_payment_history_contextual_crop(
            issue_type,
            account_context,
            matches,
            page_image_width,
            page_image_height,
        )
        slides.append(
            build_slide_from_matches(
                matches,
                page_image_width,
                page_image_height,
                label=label,
                contextual_crop=contextual_crop,
            )
        )

    def slide_from_matches_by_page_with_context(label: str, matches: Sequence[Match]):
        if not matches:
            return
        page_groups: Dict[int, List[Match]] = defaultdict(list)
        for match in matches:
            page_groups[match.page_number].append(match)
        ordered_pages = sorted(page_groups.keys())
        for page_number in ordered_pages:
            page_matches = page_groups[page_number]
            page_image_width, page_image_height = locator.page_sizes[page_number]
            contextual_crop = build_payment_history_contextual_crop(
                issue_type,
                account_context,
                page_matches,
                page_image_width,
                page_image_height,
            )
            slide_label = label if len(ordered_pages) == 1 else f"{label} · page {page_number}"
            slides.append(
                build_slide_from_matches(
                    page_matches,
                    page_image_width,
                    page_image_height,
                    label=slide_label,
                    contextual_crop=contextual_crop,
                )
            )

    def group_consecutive_months(comparisons: Sequence[Dict[str, object]]) -> List[List[Tuple[str, str, Dict[str, object]]]]:
        grouped: List[List[Tuple[str, str, Dict[str, object]]]] = []
        current_group: List[Tuple[str, str, Dict[str, object]]] = []
        previous_reference: Optional[Tuple[str, str]] = None
        for comparison in comparisons:
            parsed_month = parse_month_reference(str(comparison.get("month") or ""))
            if not parsed_month:
                continue
            if current_group and previous_reference:
                expected_next = next_month_reference(*previous_reference)
                if parsed_month != expected_next:
                    grouped.append(current_group)
                    current_group = []
            current_group.append((parsed_month[0], parsed_month[1], comparison))
            previous_reference = parsed_month
        if current_group:
            grouped.append(current_group)
        return grouped

    def add_targeted_slide(label: str, specs: Sequence[TextSearchSpec], minimum_matches: int = 2):
        slide = build_targeted_text_slide(locator, target_pages, label, specs, minimum_matches=minimum_matches)
        if slide:
            slides.append(slide)

    if issue_type == "amount_past_due_history_conflict":
        target_values = [
            normalize_text(entry.get("value"))
            for entry in scalar_comparisons
            if isinstance(entry, dict) and "past-due" in normalize_text(entry.get("label")).lower()
        ]
        target_cells = []
        for value in target_values:
            target_cells.extend(find_history_cells_by_value(account_context, "amountPastDueHistory", value))
        if not target_cells:
            target_cells = [
                cell
                for cell in account_context.history_cells.get("amountPastDueHistory", {}).values()
                if cell.state != "blank" and normalize_text(cell.value)
            ]
        for cell in target_cells[:3]:
            matches = [build_account_history_match("Amount past due history", cell, 5.2, matched_text=cell.value)]
            payment_cells = find_history_cells_for_month(account_context, "paymentHistory", cell.year, cell.month)
            for payment_cell in payment_cells[:1]:
                payment_text = normalize_text(payment_cell.value) or f"{format_month_reference(payment_cell.year, payment_cell.month)} blank"
                matches.append(build_account_history_match("Payment history", payment_cell, 4.8, matched_text=payment_text))
            slide_from_matches(f"{format_month_reference(cell.year, cell.month)} past-due amount vs payment history", matches)
        if not slides and target_values:
            add_targeted_slide(
                "Past-due history vs payment history",
                [
                    TextSearchSpec("Tradeline", [account_context.account_name], "identity", False, 2.0),
                    TextSearchSpec("Past Due", ["Past Due"], "field", False, 4.6),
                    TextSearchSpec("Past-due amount", target_values, "account_field", False, 5.0),
                    TextSearchSpec("Payment history", ["Rating", "Payment History"], "field", False, 4.0),
                ],
                minimum_matches=3,
            )

    if issue_type == "payment_history_balance_history_conflict":
        for comparison in monthly_comparisons[:5]:
            if not isinstance(comparison, dict):
                continue
            parsed_month = parse_month_reference(str(comparison.get("month") or ""))
            if not parsed_month:
                continue
            year, month_key = parsed_month
            matches: List[Match] = []

            left_value = normalize_text(comparison.get("leftValue"))
            if left_value:
                for field_name in ("actualPaymentHistory", "scheduledPaymentHistory"):
                    for cell in find_history_cells_for_month(account_context, field_name, year, month_key, [left_value]):
                        label = "Actual payment history" if field_name == "actualPaymentHistory" else "Scheduled payment history"
                        matches.append(build_account_history_match(label, cell, 5.0, matched_text=cell.value))

            balance_progression = split_value_progression(str(comparison.get("rightValue") or ""))
            if balance_progression:
                current_value, next_value = balance_progression
                for cell in find_history_cells_for_month(account_context, "balanceHistory", year, month_key, [current_value]):
                    matches.append(build_account_history_match("Balance history", cell, 5.2, matched_text=cell.value))
                next_year, next_month_key = next_month_reference(year, month_key)
                for cell in find_history_cells_for_month(account_context, "balanceHistory", next_year, next_month_key, [next_value]):
                    matches.append(build_account_history_match("Next-month balance history", cell, 5.2, matched_text=cell.value))

            if len(matches) >= 2:
                slide_from_matches(f"{format_month_reference(year, month_key)} payment activity vs balance history", matches)
        if not slides:
            for comparison in monthly_comparisons[:3]:
                if not isinstance(comparison, dict):
                    continue
                parsed_month = parse_month_reference(str(comparison.get("month") or ""))
                if not parsed_month:
                    continue
                month_text = format_month_reference(*parsed_month)
                balance_progression = split_value_progression(str(comparison.get("rightValue") or ""))
                search_values = [normalize_text(comparison.get("leftValue"))]
                if balance_progression:
                    search_values.extend(balance_progression)
                add_targeted_slide(
                    f"{month_text} payment activity vs balance history",
                    [
                        TextSearchSpec("Tradeline", [account_context.account_name], "identity", False, 2.0),
                        TextSearchSpec("Month", [month_text], "history", False, 3.8),
                        TextSearchSpec("Amount paid", ["Amount Paid", "Payment Received"], "field", False, 4.6),
                        TextSearchSpec("Balance", ["Balance"], "field", False, 4.6),
                        TextSearchSpec("Values", search_values, "account_field", False, 4.9),
                    ],
                    minimum_matches=3,
                )
                if slides:
                    break

    if issue_type == "payment_history_missing_months":
        comparable_months = [comparison for comparison in monthly_comparisons[:12] if isinstance(comparison, dict)]
        for month_group in group_consecutive_months(comparable_months):
            start_year, start_month, _start_comparison = month_group[0]
            end_year, end_month, _end_comparison = month_group[-1]
            gap_label = (
                f"{format_month_reference(start_year, start_month)} through {format_month_reference(end_year, end_month)} missing from payment history"
                if (start_year, start_month) != (end_year, end_month)
                else f"{format_month_reference(start_year, start_month)} missing from payment history"
            )
            matches: List[Match] = []
            # Highlight EVERY month in the gap group, not just the first — a claim of
            # "missing Apr through May" must mark both cells (Phase 2 QC finding).
            for gap_year, gap_month, _comparison in month_group:
                target_cell = (
                    resolve_history_cell(account_context, "paymentHistoryGapSlots", gap_year, gap_month)
                    or resolve_history_cell(account_context, "paymentHistory", gap_year, gap_month)
                )
                if target_cell and (target_cell.state in {"blank", "missing_slot"} or not normalize_text(target_cell.value)):
                    matches.append(
                        build_account_history_match(
                            "Missing payment-history month",
                            target_cell,
                            5.4,
                            matched_text=missing_history_slot_text(target_cell.field, gap_year, gap_month),
                        )
                    )
                else:
                    gap_match = infer_history_gap_match(
                        account_context, "paymentHistory", gap_year, gap_month, locator,
                        label=f"Missing payment-history month — {format_month_reference(gap_year, gap_month)}",
                    )
                    if gap_match:
                        matches.append(gap_match)
            previous_cell, _ = resolve_neighbor_history_cells(account_context, "paymentHistory", start_year, start_month)
            _, next_cell = resolve_neighbor_history_cells(account_context, "paymentHistory", end_year, end_month)
            for boundary_label, boundary_cell in (("Earlier reported month", previous_cell), ("Later reported month", next_cell)):
                if not boundary_cell:
                    continue
                boundary_text = normalize_text(boundary_cell.value) or format_month_reference(boundary_cell.year, boundary_cell.month)
                matches.append(build_account_history_match(boundary_label, boundary_cell, 4.8, matched_text=boundary_text))
            if matches:
                slide_from_matches_by_page_with_context(gap_label, matches)

    if issue_type == "delinquency_progression_inconsistency":
        for comparison in monthly_comparisons[:5]:
            if not isinstance(comparison, dict):
                continue
            later_reference = parse_month_reference(str(comparison.get("month") or ""))
            earlier_reference = parse_month_reference(str(comparison.get("leftLabel") or ""))
            if not later_reference or not earlier_reference:
                continue
            earlier_year, earlier_month = earlier_reference
            later_year, later_month = later_reference
            earlier_value = normalize_text(comparison.get("leftValue"))
            later_value = normalize_text(comparison.get("rightValue"))
            earlier_cells = first_same_page_cells("paymentHistory", earlier_year, earlier_month, [earlier_value] if earlier_value else None)
            preferred_page = earlier_cells[0].page_number if earlier_cells else None
            later_cells = first_same_page_cells("paymentHistory", later_year, later_month, [later_value] if later_value else None, preferred_page)
            if not earlier_cells or not later_cells:
                continue
            earlier_cell = earlier_cells[0]
            later_cell = later_cells[0]
            if earlier_cell.page_number != later_cell.page_number:
                continue
            slide_from_matches_with_context(
                f"{format_month_reference(later_year, later_month)} delinquency progression conflict",
                [
                    build_account_history_match("Earlier delinquency month", earlier_cell, 5.2, matched_text=earlier_cell.value),
                    build_account_history_match("Later delinquency month", later_cell, 5.2, matched_text=later_cell.value),
                ],
            )

    if issue_type == "balance_history_monthly_gap_conflict":
        for comparison in monthly_comparisons[:5]:
            if not isinstance(comparison, dict):
                continue
            parsed_month = parse_month_reference(str(comparison.get("month") or ""))
            if not parsed_month:
                continue
            year, month_key = parsed_month
            matches: List[Match] = []
            target_cell = resolve_history_cell(account_context, "balanceHistory", year, month_key)
            if target_cell:
                matches.append(
                    build_account_history_match(
                        "Balance-history gap month",
                        target_cell,
                        5.2,
                        matched_text=normalize_text(target_cell.value) or missing_history_slot_text("balanceHistory", year, month_key),
                    )
                )
            else:
                gap_match = infer_history_gap_match(account_context, "balanceHistory", year, month_key, locator)
                if gap_match:
                    matches.append(gap_match)
            if not matches:
                continue
            payment_value = normalize_text(comparison.get("leftValue"))
            payment_cells = first_same_page_cells("paymentHistory", year, month_key, [payment_value] if payment_value else None, matches[0].page_number)
            if payment_cells:
                payment_cell = payment_cells[0]
                matches.append(
                    build_account_history_match(
                        "Payment history",
                        payment_cell,
                        4.8,
                        matched_text=normalize_text(payment_cell.value) or format_month_reference(payment_cell.year, payment_cell.month),
                    )
                )
            previous_cell, next_cell = resolve_neighbor_history_cells(account_context, "balanceHistory", year, month_key)
            for boundary_label, boundary_cell in (("Earlier balance month", previous_cell), ("Later balance month", next_cell)):
                if not boundary_cell or boundary_cell.page_number != matches[0].page_number:
                    continue
                matches.append(
                    build_account_history_match(
                        boundary_label,
                        boundary_cell,
                        4.6,
                        matched_text=normalize_text(boundary_cell.value) or format_month_reference(boundary_cell.year, boundary_cell.month),
                    )
                )
            slide_from_matches(f"{format_month_reference(year, month_key)} balance-history gap", matches)

    if issue_type == "balance_updated_timeline_conflict":
        latest_month_value = next(
            (
                normalize_text(entry.get("value"))
                for entry in scalar_comparisons
                if isinstance(entry, dict) and "latest balance-history month" in normalize_text(entry.get("label")).lower()
            ),
            "",
        )
        balance_updated_value = next(
            (
                normalize_text(entry.get("value"))
                for entry in scalar_comparisons
                if isinstance(entry, dict) and "balance-updated date" in normalize_text(entry.get("label")).lower()
            ),
            "",
        )
        add_targeted_slide(
            "Reported balance-updated date",
            [
                TextSearchSpec("Tradeline", [account_context.account_name], "identity", False, 2.0),
                TextSearchSpec("Date Updated", ["Date Updated"], "field", False, 4.6),
                TextSearchSpec("Reported balance-updated date", [balance_updated_value], "account_field", False, 5.0),
            ],
            minimum_matches=2,
        )
        latest_month_reference = parse_month_reference(latest_month_value)
        if latest_month_reference:
            latest_year, latest_month_key = latest_month_reference
            latest_cells = first_same_page_cells("balanceHistory", latest_year, latest_month_key)
            if latest_cells:
                latest_cell = latest_cells[0]
                slide_from_matches(
                    f"{latest_month_value} latest balance-history month",
                    [
                        build_account_history_match(
                            "Latest balance-history month",
                            latest_cell,
                            5.0,
                            matched_text=normalize_text(latest_cell.value) or latest_month_value,
                        )
                    ],
                )

    if issue_type == "status_updated_timeline_conflict":
        latest_month_value = next(
            (
                normalize_text(entry.get("value"))
                for entry in scalar_comparisons
                if isinstance(entry, dict) and "latest payment-history month" in normalize_text(entry.get("label")).lower()
            ),
            "",
        )
        status_updated_value = next(
            (
                normalize_text(entry.get("value"))
                for entry in scalar_comparisons
                if isinstance(entry, dict) and "status-updated date" in normalize_text(entry.get("label")).lower()
            ),
            "",
        )
        add_targeted_slide(
            "Status-updated date vs reported payment history",
            [
                TextSearchSpec("Tradeline", [account_context.account_name], "identity", False, 2.0),
                TextSearchSpec("Date Updated", ["Date Updated"], "field", False, 4.6),
                TextSearchSpec("Reported status-updated date", [status_updated_value], "account_field", False, 5.0),
                TextSearchSpec("Latest payment-history month", [latest_month_value], "history", False, 4.8),
                TextSearchSpec("Payment history", ["Rating", "Payment History"], "field", False, 4.0),
            ],
            minimum_matches=3,
        )

    if issue_type == "missing_payment_history":
        reported_status = next(
            (
                normalize_text(entry.get("value"))
                for entry in scalar_comparisons
                if isinstance(entry, dict) and "status" in normalize_text(entry.get("label")).lower()
            ),
            "",
        )
        reported_payment = next(
            (
                normalize_text(entry.get("value"))
                for entry in scalar_comparisons
                if isinstance(entry, dict) and "payment amount" in normalize_text(entry.get("label")).lower()
            ),
            "",
        )
        add_targeted_slide(
            "Account block without payment-history reporting",
            [
                TextSearchSpec("Tradeline", [account_context.account_name], "identity", False, 2.0),
                TextSearchSpec("Account Type", ["Account Type"], "field", False, 3.8),
                TextSearchSpec("Status", ["Status", "Pay Status"], "field", False, 4.4),
                TextSearchSpec("Reported status", [reported_status], "account_field", False, 4.8),
                TextSearchSpec("Payment amount context", ["Monthly Payment", "Payment Received", "Payment Amount"], "field", False, 4.4),
                TextSearchSpec("Reported payment amount", [reported_payment], "account_field", False, 4.8),
            ],
            minimum_matches=3,
        )

    if issue_type in {
        "closed_account_final_month_reporting_incomplete",
        "last_payment_date_without_payment_amount",
        "last_payment_date_without_scheduled_payment_amount",
    }:
        month_reference = None
        for comparison in monthly_comparisons:
            if isinstance(comparison, dict):
                month_reference = parse_month_reference(str(comparison.get("month") or ""))
                if month_reference:
                    break
        if not month_reference:
            for entry in scalar_comparisons:
                if not isinstance(entry, dict):
                    continue
                if "last payment" in normalize_text(entry.get("label")).lower():
                    month_reference = parse_month_reference(str(entry.get("value") or ""))
                    if month_reference:
                        break
        if month_reference:
            year, month_key = month_reference
            matches: List[Match] = []
            payment_cells = find_history_cells_for_month(account_context, "paymentHistory", year, month_key)
            for cell in payment_cells:
                payment_text = normalize_text(cell.value) or f"{format_month_reference(cell.year, cell.month)} blank"
                matches.append(build_account_history_match("Payment history", cell, 4.8, matched_text=payment_text))
            if not payment_cells:
                gap_match = infer_history_gap_match(
                    account_context, "paymentHistory", year, month_key, locator,
                    label=f"Payment history — {format_month_reference(year, month_key)} missing",
                )
                if gap_match:
                    matches.append(gap_match)
            if issue_type in {"closed_account_final_month_reporting_incomplete", "last_payment_date_without_payment_amount"}:
                target_values = [
                    normalize_text(entry.get("value"))
                    for entry in scalar_comparisons
                    if isinstance(entry, dict) and "actual payment" in normalize_text(entry.get("label")).lower()
                ]
                expected_values = [value for value in target_values if value and value.lower() not in GENERIC_VALUE_TOKENS]
                actual_cells: List[AccountHistoryCell] = []
                for value in expected_values:
                    actual_cells.extend(find_history_cells_for_month(account_context, "actualPaymentHistory", year, month_key, [value]))
                if not actual_cells:
                    # The citation is about ABSENT payment data: the blank measured cell
                    # (or interpolated slot) is the evidence, not a text match.
                    actual_cells = find_history_cells_for_month(account_context, "actualPaymentHistory", year, month_key)
                for cell in actual_cells:
                    actual_text = normalize_text(cell.value) or missing_history_slot_text("actualPaymentHistory", year, month_key)
                    matches.append(build_account_history_match("Actual payment history", cell, 5.0, matched_text=actual_text))
                if not actual_cells:
                    gap_match = infer_history_gap_match(
                        account_context, "actualPaymentHistory", year, month_key, locator,
                        label=f"Actual payment history — {format_month_reference(year, month_key)} missing",
                    )
                    if gap_match:
                        matches.append(gap_match)
            if issue_type == "last_payment_date_without_scheduled_payment_amount":
                scheduled_cells = find_history_cells_for_month(account_context, "scheduledPaymentHistory", year, month_key)
                for cell in scheduled_cells:
                    scheduled_text = normalize_text(cell.value) or missing_history_slot_text("scheduledPaymentHistory", year, month_key)
                    matches.append(build_account_history_match("Scheduled payment history", cell, 5.0, matched_text=scheduled_text))
                if not scheduled_cells:
                    gap_match = infer_history_gap_match(
                        account_context, "scheduledPaymentHistory", year, month_key, locator,
                        label=f"Scheduled payment history — {format_month_reference(year, month_key)} missing",
                    )
                    if gap_match:
                        matches.append(gap_match)

            if len(matches) >= 2:
                slide_from_matches_by_page_with_context(
                    f"{format_month_reference(year, month_key)} closing-month support", matches
                )

    if issue_type == "missing_account_number":
        identifier_target_pages = sorted(
            {
                *target_pages,
                *(
                    [max(1, min(target_pages) - 1)]
                    if target_pages
                    else []
                ),
            }
        )
        account_number_field = resolve_field_evidence(account_context, "accountNumber")
        account_number_values = resolve_account_field_values(account_context, "accountNumber")
        if account_number_field:
            page_matches: List[Match] = [
                build_account_field_match(
                    "Account number",
                    account_number_field,
                    5.2,
                    matched_text=normalize_text(account_number_field.value) or "Account number field",
                )
            ]
            page_specific_specs = [
                TextSearchSpec("Tradeline", [account_context.account_name], "identity", False, 2.4),
                TextSearchSpec(
                    "Tradeline account identifier",
                    [
                        f"{account_context.account_name} {value}"
                        for value in account_number_values
                        if normalize_text(value)
                    ],
                    "identity",
                    False,
                    3.0,
                ),
                TextSearchSpec("Account number", ["Account Number"], "field", False, 4.4),
            ]
            for spec in page_specific_specs:
                matches = search_spec_matches(locator, identifier_target_pages or [account_number_field.page_number], spec)
                if not matches:
                    continue
                page_matched = [
                    entry
                    for entry in matches
                    if entry.page_number == account_number_field.page_number
                ] or matches
                best_match = max(page_matched, key=lambda entry: entry.anchor.weight * entry.confidence)
                page_matches.append(best_match)
            slide_from_matches("Account number field support", page_matches)
        else:
            slide = build_targeted_text_slide(
                locator,
                identifier_target_pages,
                "Account number field support",
                [
                    TextSearchSpec("Tradeline", [account_context.account_name], "identity", False, 2.4),
                    TextSearchSpec(
                        "Tradeline account identifier",
                        [
                            f"{account_context.account_name} {value}"
                            for value in account_number_values
                            if normalize_text(value)
                        ],
                        "identity",
                        False,
                        3.0,
                    ),
                    TextSearchSpec("Account number", ["Account Number"], "field", False, 4.4),
                    TextSearchSpec("Account number", account_number_values, "account_field", False, 5.0),
                ],
                minimum_matches=1,
            )
            if slide:
                slides.append(slide)

    if issue_type == "missing_furnisher_identification":
        identity_field = resolve_field_evidence(account_context, "accountNumber") or resolve_field_evidence(account_context, "status")
        if identity_field:
            page_matches: List[Match] = [
                build_account_field_match(
                    "Account identity",
                    identity_field,
                    5.0,
                    matched_text=normalize_text(identity_field.value) or account_context.account_name,
                )
            ]
            for spec in (
                TextSearchSpec("Tradeline", [account_context.account_name], "identity", False, 4.8),
                TextSearchSpec("Address label", ["Address"], "field", False, 3.2),
                TextSearchSpec("Phone label", ["Phone Number", "Phone"], "field", False, 3.2),
            ):
                matches = search_spec_matches(locator, target_pages or [identity_field.page_number], spec)
                if not matches:
                    continue
                page_matched = [entry for entry in matches if entry.page_number == identity_field.page_number] or matches
                page_matches.append(max(page_matched, key=lambda entry: entry.anchor.weight * entry.confidence))
            slide_from_matches("Furnisher identity block without address or phone", page_matches)
        if not slides:
            add_targeted_slide(
                "Furnisher identity block without address or phone",
                [
                    TextSearchSpec("Tradeline", [account_context.account_name], "identity", False, 4.8),
                    TextSearchSpec("Account number", resolve_account_field_values(account_context, "accountNumber"), "account_field", False, 4.2),
                    TextSearchSpec("Address label", ["Address"], "field", False, 3.0),
                    TextSearchSpec("Phone label", ["Phone Number", "Phone"], "field", False, 3.0),
                ],
                minimum_matches=1,
            )

    if issue_type == "missing_balance_updated_date":
        # Balance and Date Reported rows are covered precisely by the label-anchored
        # scalar citation slides; global value searches ("$9,076" anywhere on the
        # page) land on other fields' occurrences of the same figure — keep only the
        # label-anchored specs here as a fallback.
        add_targeted_slide(
            "Current balance reported without balance-updated date",
            [
                TextSearchSpec("Tradeline", [account_context.account_name], "identity", False, 2.0),
                TextSearchSpec("date Reported", ["Date Reported"], "field", False, 4.0),
            ],
        )

    if issue_type == "monthly_payment_missing_for_open_installment":
        add_targeted_slide(
            "Installment account with missing monthly payment",
            [
                TextSearchSpec("Tradeline", [account_context.account_name], "identity", False, 2.0),
                TextSearchSpec("account Type", ["Account Type"], "field", False, 3.8),
                TextSearchSpec("Account type context", resolve_account_field_values(account_context, "accountType"), "account_field", False, 4.4),
                TextSearchSpec(
                    "payment Amount",
                    ["Payment Amount", "Monthly Payment", "Scheduled Payment", "Actual Payment"],
                    "field",
                    False,
                    4.8,
                ),
            ],
            minimum_matches=3,
        )

    if issue_type == "scheduled_payment_amount_without_terms":
        scheduled_payment_field = resolve_field_evidence(account_context, "scheduledPaymentAmount")
        if scheduled_payment_field:
            page_matches: List[Match] = [
                build_account_field_match(
                    "Scheduled payment amount",
                    scheduled_payment_field,
                    5.2,
                    matched_text=normalize_text(scheduled_payment_field.value) or "Scheduled payment amount",
                )
            ]
            for spec in (
                TextSearchSpec("Tradeline", [account_context.account_name], "identity", False, 4.8),
                TextSearchSpec("Scheduled payment", ["Scheduled Payment", "Monthly Payment"], "field", False, 4.2),
                TextSearchSpec("Terms", ["Terms", "Term", "Term Duration"], "field", False, 3.4),
            ):
                matches = search_spec_matches(locator, target_pages or [scheduled_payment_field.page_number], spec)
                if not matches:
                    continue
                page_matched = [entry for entry in matches if entry.page_number == scheduled_payment_field.page_number] or matches
                page_matches.append(max(page_matched, key=lambda entry: entry.anchor.weight * entry.confidence))
            slide_from_matches("Scheduled payment amount without terms support", page_matches)
        if not slides:
            add_targeted_slide(
                "Scheduled payment amount without terms support",
                [
                    TextSearchSpec("Tradeline", [account_context.account_name], "identity", False, 4.8),
                    TextSearchSpec("Scheduled payment", ["Scheduled Payment", "Monthly Payment"], "field", False, 4.4),
                    TextSearchSpec("Scheduled payment amount", resolve_account_field_values(account_context, "scheduledPaymentAmount"), "account_field", False, 5.0),
                    TextSearchSpec("Terms", ["Terms", "Term", "Term Duration"], "field", False, 3.2),
                ],
                minimum_matches=2,
            )

    if issue_type == "student_loan_lender_identity_mismatch":
        add_targeted_slide(
            "Reported furnisher identity",
            [
                TextSearchSpec("Tradeline", [account_context.account_name], "identity", False, 4.6),
                TextSearchSpec("Account number", resolve_account_field_values(account_context, "accountNumber"), "account_field", False, 4.2),
            ],
        )
        add_targeted_slide(
            "Lender or original-creditor context",
            [
                TextSearchSpec("account Type", ["Account Type"], "field", False, 3.0),
                TextSearchSpec("Account type context", resolve_account_field_values(account_context, "accountType"), "account_field", False, 3.8),
                TextSearchSpec(
                    "Original creditor",
                    ["Original Creditor", "Original Creditor Name", "Original Lender", "Creditor or lender"],
                    "field",
                    False,
                    4.6,
                ),
            ],
        )

    if issue_type in {
        "last_payment_date_without_payment_amount",
        "last_payment_date_without_scheduled_payment_amount",
    } and not slides:
        last_payment_values = resolve_account_field_values(account_context, "lastPaymentDate")
        # Per-variant label + field specs: the two issue types cite DIFFERENT missing
        # fields — a shared spec list made both reasons highlight "Actual Payment"
        # and produce byte-identical exhibits (Phase 1 QC finding).
        if issue_type == "last_payment_date_without_scheduled_payment_amount":
            fallback_label = "Last payment date without scheduled payment amount"
            payment_label_variants = ["Scheduled Payment Amount", "Scheduled Payment"]
            payment_anchor_label = "scheduled Payment Amount"
        else:
            fallback_label = "Last payment date without payment amount"
            payment_label_variants = ["Actual Payment Amount", "Actual Payment", "Payment Amount", "Recent Payment"]
            payment_anchor_label = "payment Amount"
        add_targeted_slide(
            fallback_label,
            [
                TextSearchSpec("Tradeline", [account_context.account_name], "identity", False, 2.0),
                TextSearchSpec(
                    "last Payment Date",
                    ["Last Payment Date", "Date of Last Payment", "Last Payment"],
                    "field",
                    False,
                    4.0,
                ),
                TextSearchSpec("Reported last payment date field", last_payment_values, "account_field", False, 4.8),
                TextSearchSpec(payment_anchor_label, payment_label_variants, "field", False, 4.6),
            ],
        )

    if issue_type == "payment_plan_or_forbearance_context_with_derogatory_conflict":
        status_field = resolve_field_evidence(account_context, "status")
        if status_field:
            slide_from_matches(
                "Reported deferment or forbearance status",
                [
                    build_account_field_match(
                        "Reported status",
                        status_field,
                        5.4,
                        matched_text=normalize_text(status_field.value),
                    )
                ],
            )
        else:
            add_targeted_slide(
                "Reported deferment or forbearance status",
                [
                    TextSearchSpec("Tradeline", [account_context.account_name], "identity", False, 2.2),
                    TextSearchSpec("Reported status", resolve_account_field_values(account_context, "status"), "account_field", False, 5.0),
                ],
            )

        comment_value = ""
        for entry in scalar_comparisons:
            if not isinstance(entry, dict):
                continue
            if "comment" in normalize_text(entry.get("label")).lower():
                comment_value = normalize_text(entry.get("value"))
                break
        comment_parts = [part.strip() for part in comment_value.split(";") if normalize_text(part)]
        if comment_parts:
            add_targeted_slide(
                "Reported remarks and original amount context",
                [
                    TextSearchSpec("Tradeline", [account_context.account_name], "identity", False, 2.0),
                    *[
                        TextSearchSpec("Reported remarks", [part], "account_field", False, 4.8)
                        for part in comment_parts
                    ],
                ],
                minimum_matches=min(3, len(comment_parts) + 1),
            )

        for comparison in monthly_comparisons[:3]:
            if not isinstance(comparison, dict):
                continue
            parsed_month = parse_month_reference(str(comparison.get("month") or ""))
            if not parsed_month:
                continue
            year, month_key = parsed_month
            expected_value = normalize_text(comparison.get("rightValue"))
            payment_cells = find_history_cells_for_month(account_context, "paymentHistory", year, month_key, [expected_value] if expected_value else None)
            if not payment_cells:
                continue
            slide_from_matches_with_context(
                f"{format_month_reference(year, month_key)} derogatory payment-history month",
                [
                    build_account_history_match(
                        "Conflicting payment-history month",
                        payment_cells[0],
                        5.2,
                        matched_text=payment_cells[0].value,
                    )
                ],
            )

    if issue_type == "blank_gap_before_derogatory_month":
        for comparison in monthly_comparisons[:5]:
            if not isinstance(comparison, dict):
                continue
            later_reference = parse_month_reference(str(comparison.get("month") or ""))
            earlier_reference = parse_month_reference(str(comparison.get("leftValue") or ""))
            if not later_reference or not earlier_reference:
                continue
            earlier_year, earlier_month = earlier_reference
            later_year, later_month = later_reference
            later_value = normalize_text(comparison.get("rightValue"))
            matches: List[Match] = []
            earlier_cell = (
                resolve_history_cell(account_context, "paymentHistoryGapSlots", earlier_year, earlier_month)
                or resolve_history_cell(account_context, "paymentHistory", earlier_year, earlier_month)
            )
            if earlier_cell and (earlier_cell.state in {"blank", "missing_slot"} or not normalize_text(earlier_cell.value)):
                matches.append(
                    build_account_history_match(
                        "Earlier blank gap month",
                        earlier_cell,
                        5.2,
                        matched_text=missing_history_slot_text(earlier_cell.field, earlier_year, earlier_month),
                    )
                )
            else:
                gap_match = infer_history_gap_match(account_context, "paymentHistory", earlier_year, earlier_month, locator)
                if gap_match:
                    matches.append(gap_match)
            later_cells = first_same_page_cells("paymentHistory", later_year, later_month, [later_value] if later_value else None)
            if later_cells:
                later_cell = later_cells[0]
                matches.append(
                    build_account_history_match(
                        "Later derogatory month",
                        later_cell,
                        5.2,
                        matched_text=normalize_text(later_cell.value) or format_month_reference(later_year, later_month),
                    )
                )
            if matches:
                slide_from_matches_by_page_with_context(
                    f"{format_month_reference(earlier_year, earlier_month)} blank gap before {format_month_reference(later_year, later_month)} derogatory month",
                    matches,
                )

    # Generic cross-table month resolution: when no issue-specific builder produced a
    # slide, resolve EACH side of every monthly comparison to its own table's measured
    # cell — or the interpolated gap slot when the month is absent — so conflicts and
    # blanks are highlighted in every table they implicate. Both sides of a
    # payment-vs-balance (or present-vs-missing) comparison get their own box.
    if not slides and monthly_comparisons:
        # Accumulate across comparisons and emit ONE combined slide set: repeated
        # resolutions (e.g. the same coverage-boundary cell cited by every month)
        # collapse to a single box instead of duplicate mislabeled slides
        # (Phase 1 QC finding: three byte-identical boundary slides labeled as
        # three different months).
        generic_matches: List[Match] = []
        seen_generic: set = set()
        span_months: List[Tuple[str, str]] = []

        def add_generic(match: Optional[Match]) -> None:
            if not match:
                return
            key = match.provenance_id or (
                match.page_number,
                round(match.box["x"], 1),
                round(match.box["y"], 1),
                round(match.box["width"], 1),
            )
            if key in seen_generic:
                return
            seen_generic.add(key)
            generic_matches.append(match)

        for comparison in monthly_comparisons[:6]:
            if not isinstance(comparison, dict):
                continue
            parsed_month = parse_month_reference(str(comparison.get("month") or ""))
            if not parsed_month:
                continue
            year, month_key = parsed_month
            span_months.append((year, month_key))
            for side_label_key, side_value_key in (("leftLabel", "leftValue"), ("rightLabel", "rightValue")):
                side_label = normalize_text(comparison.get(side_label_key))
                side_value = normalize_text(comparison.get(side_value_key))
                field_name = map_comparison_label_to_history_field(side_label)
                # Sides labeled by MONTH rather than by table ("Earlier month Mar 2024",
                # "Later month") are payment-grid references — the delinquency
                # progression/jump family compares grid months against each other.
                side_month = parse_month_reference(side_label)
                if not field_name:
                    if side_month or "month" in side_label.lower():
                        field_name = "paymentHistory"
                    else:
                        continue
                cell_year, cell_month = side_month or (year, month_key)
                cells = find_history_cells_for_month(account_context, field_name, cell_year, cell_month)
                if cells:
                    cell = cells[0]
                    cell_text = normalize_text(cell.value) or missing_history_slot_text(field_name, cell_year, cell_month)
                    add_generic(
                        build_account_history_match(
                            side_label or humanize_field_name(field_name), cell, 5.0, matched_text=cell_text
                        )
                    )
                else:
                    add_generic(
                        infer_history_gap_match(
                            account_context, field_name, cell_year, cell_month, locator,
                            label=f"{side_label or humanize_field_name(field_name)} — {format_month_reference(cell_year, cell_month)} missing",
                        )
                    )
                if side_value and side_value.lower() not in GENERIC_VALUE_TOKENS:
                    progression = split_value_progression(side_value)
                    if progression:
                        next_year, next_month_key = next_month_reference(year, month_key)
                        for cell in find_history_cells_for_month(account_context, field_name, next_year, next_month_key, [progression[1]]):
                            add_generic(
                                build_account_history_match(
                                    f"Next-month {side_label or humanize_field_name(field_name)}".strip(),
                                    cell,
                                    5.0,
                                    matched_text=cell.value,
                                )
                            )
        if generic_matches:
            if span_months:
                first = format_month_reference(*span_months[0])
                last = format_month_reference(*span_months[-1])
                span_label = first if first == last else f"{first} – {last}"
            else:
                span_label = "Cited months"
            slide_from_matches_by_page_with_context(
                f"{span_label} cross-table comparison", generic_matches
            )

    return dedupe_slides(slides)[:5]


def build_scalar_citation_slides(
    reason: Dict[str, object],
    locator: PageTextLocator,
    target_pages: Sequence[int],
) -> List[Dict[str, object]]:
    """Label-anchored resolution for scalar citations. For each cited account field,
    find the printed field label on the account's pages, then box the VALUE region on
    the same row: the printed value words when present, or the empty value area when
    the citation says the data is missing (synthesized from the label row and the
    table half's value envelope, source="inferred_blank"). Blank/absent information
    is highlightable evidence — a bureau must see WHERE the missing data belongs."""
    evidence = reason.get("evidence") or {}
    citations: List[Tuple[str, str]] = []
    seen_keys = set()

    def add_citation(label: object, value: object):
        label_text = normalize_text(label)
        value_text = normalize_text(value)
        if not label_text:
            return
        key = compact_value(label_text)
        if not key or key in seen_keys:
            return
        seen_keys.add(key)
        citations.append((label_text, value_text))

    if isinstance(evidence, dict):
        for entry in evidence.get("scalarComparisons") or []:
            if isinstance(entry, dict):
                add_citation(entry.get("label"), entry.get("value"))
    for field_name in reason.get("supportingFields") or []:
        add_citation(str(field_name), "")
    for fact in reason.get("supportingFacts") or []:
        for fact_label, fact_value in extract_fact_values(normalize_text(fact)):
            add_citation(fact_label, fact_value)

    if not citations:
        return []

    pages = [page for page in target_pages if page in locator.page_words]
    if not pages:
        return []

    matches_by_page: Dict[int, List[Match]] = defaultdict(list)
    context_boxes_by_page: Dict[int, List[Dict[str, float]]] = {}
    claimed_rects: set = set()

    for citation_label, cited_value in citations:
        printed_labels = map_scalar_citation_to_printed_labels(citation_label)
        if not printed_labels:
            # None = unmapped citation; [] = known cite-only absence (no printed label
            # exists on the face). Either way there is nothing to anchor to.
            continue
        cited_missing = not cited_value or cited_value.lower() in GENERIC_VALUE_TOKENS
        candidates: List[Tuple[Tuple[int, int, int], Match, Dict[str, float]]] = []
        for printed in printed_labels:
            probe_anchor = create_anchor(citation_label, printed, "field", False, 1.0)
            for page_order, page_number in enumerate(pages):
                words = locator.page_words.get(page_number) or []
                source = locator.page_sources.get(page_number, "pdf")
                label_matches = search_anchor(words, probe_anchor, page_number, source)
                if not label_matches:
                    continue
                page_width, page_height = locator.page_sizes[page_number]
                for label_match in label_matches:
                    label_box = label_match.box
                    label_center_y = label_box["y"] + label_box["height"] / 2.0
                    label_right = label_box["x"] + label_box["width"]
                    on_left_half = label_box["x"] < page_width * 0.5
                    half_start = 0.0 if on_left_half else page_width * 0.45
                    half_end = page_width * 0.5 if on_left_half else page_width * 0.98
                    gap = max(6.0, label_box["height"] * 0.3)

                    def in_band(word: Word) -> bool:
                        return abs((word.box["y"] + word.box["height"] / 2.0) - label_center_y) <= label_box["height"] * 0.6

                    # Field labels start their table column. A match with words BEFORE
                    # it in the same half of the row is prose (e.g. "…account's
                    # reported balance by its credit limit"), not a field label.
                    preceding_words = [
                        word
                        for word in words
                        if in_band(word)
                        and word.box["x"] >= half_start
                        and word.box["x"] + word.box["width"] <= label_box["x"] - gap * 0.5
                    ]
                    if preceding_words:
                        continue

                    def in_half(word: Word) -> bool:
                        if on_left_half:
                            return word.box["x"] >= label_box["x"] and word.box["x"] + word.box["width"] <= half_end * 1.02
                        return word.box["x"] >= page_width * 0.45

                    row_words = [
                        word
                        for word in words
                        if in_band(word) and word.box["x"] >= label_right + gap and in_half(word)
                    ]
                    if row_words:
                        value_box = union_boxes([word.box for word in row_words])
                        value_pdf = union_pdf_boxes([word.pdf_box for word in row_words])
                        value_text = " ".join(word.text for word in row_words)
                        agrees = bool(
                            cited_value
                            and (
                                compact_value(cited_value) in compact_value(value_text)
                                or compact_value(value_text) in compact_value(cited_value)
                            )
                        )
                        confidence = 0.99 if agrees else (0.85 if cited_missing else 0.9)
                        anchor = create_anchor(citation_label, citation_label, "evidence", False, 4.5)
                        candidate = create_match(
                            anchor, page_number, value_box, confidence, source, value_text, pdf_box=value_pdf
                        )
                        # rank: value agreement beats everything; a populated row when
                        # the citation expects one beats a blank-looking match
                        rank = (0 if agrees else (2 if cited_missing else 1), page_order, 0)
                    else:
                        if not cited_missing:
                            # Citation says a value exists but this row shows none —
                            # not our row; let another candidate or text search cover it.
                            continue
                        block_words = [
                            word
                            for word in words
                            if abs((word.box["y"] + word.box["height"] / 2.0) - label_center_y) <= label_box["height"] * 8.0
                            and in_half(word)
                        ]
                        right_edge = max(
                            [word.box["x"] + word.box["width"] for word in block_words],
                            default=label_right + label_box["height"] * 3.0,
                        )
                        blank_width = right_edge - (label_right + gap)
                        if blank_width < label_box["height"]:
                            blank_width = min(label_box["height"] * 3.0, half_end - (label_right + gap))
                        if blank_width <= 0:
                            continue
                        blank_box = {
                            "x": label_right + gap,
                            "y": label_box["y"],
                            "width": blank_width,
                            "height": label_box["height"],
                        }
                        blank_pdf = None
                        if label_match.pdf_box:
                            # Derive the PDF rect from the FINAL image rect so both
                            # views share one geometry — separate fallback formulas
                            # drifted (sliver-width pdfBox on Experian layouts).
                            pdf_w, pdf_h = locator.page_dimensions[page_number]
                            scale_x = pdf_w / max(page_width, 1.0)
                            scale_y = pdf_h / max(page_height, 1.0)
                            blank_pdf = {
                                "xMin": blank_box["x"] * scale_x,
                                "xMax": (blank_box["x"] + blank_box["width"]) * scale_x,
                                "yMin": blank_box["y"] * scale_y,
                                "yMax": (blank_box["y"] + blank_box["height"]) * scale_y,
                            }
                        anchor = create_anchor(citation_label, citation_label, "evidence", False, 4.5)
                        candidate = create_match(
                            anchor,
                            page_number,
                            blank_box,
                            0.97,
                            "inferred_blank",
                            f"{printed} — blank",
                            pdf_box=blank_pdf,
                        )
                        # a blank row when the citation expects absence is the goal
                        rank = (0 if cited_missing else 3, page_order, 1)
                    candidates.append((rank, candidate, dict(label_box)))

        if not candidates:
            continue
        candidates.sort(key=lambda entry: entry[0])
        best = candidates[0][1]
        best_label_box = candidates[0][2]
        rect_key = (
            best.page_number,
            round(best.box["x"], 0),
            round(best.box["y"], 0),
            round(best.box["width"], 0),
        )
        if rect_key not in claimed_rects:
            claimed_rects.add(rect_key)
            matches_by_page[best.page_number].append(best)
            context_boxes_by_page.setdefault(best.page_number, []).append(best_label_box)

    slides: List[Dict[str, object]] = []
    for page_number in sorted(matches_by_page.keys()):
        page_matches = matches_by_page[page_number]
        if not page_matches:
            continue
        page_width, page_height = locator.page_sizes[page_number]
        crop_union = union_boxes(
            [match.box for match in page_matches] + context_boxes_by_page.get(page_number, [])
        )
        contextual_crop = None
        if crop_union:
            padding_x = max(40.0, page_width * 0.02)
            padding_y = max(34.0, page_height * 0.02)
            contextual_crop = {
                "cropBox": expand_box(crop_union, page_width, page_height, padding_x, padding_y),
                "cropPadding": {"x": round(padding_x, 2), "y": round(padding_y, 2)},
            }
        slides.append(
            build_slide_from_matches(
                page_matches, page_width, page_height, label="Account detail citations",
                contextual_crop=contextual_crop,
            )
        )
    return slides


def build_reason_bundle(
    reason: Dict[str, object],
    locator: PageTextLocator,
    session_context: Optional[SessionResultContext] = None,
    retry_mode: str = "default",
) -> Dict[str, object]:
    source_pages = sorted({int(page) for page in (reason.get("sourcePages") or []) if isinstance(page, int) and page > 0})
    account_context = (
        session_context.find_account(
            str(reason.get("entityKey") or ""),
            [
                int(page)
                for page in (reason.get("sourcePages") or [])
                if isinstance(page, int) and page > 0
            ],
        )
        if session_context
        else None
    )
    target_pages = (account_context.pages if account_context else []) or source_pages or list(range(1, locator.page_count + 1))
    requires_provenance = reason_requires_provenance(reason)
    issue_type = normalize_text(reason.get("issueType")).lower()
    if requires_provenance:
        provenance_slides, unresolved_provenance = build_provenance_slides(reason, account_context, locator, retry_mode)
        is_ready = bool(provenance_slides and not unresolved_provenance)
        return {
            "reasonId": reason.get("id"),
            "issueType": reason.get("issueType") or "",
            "issueLabel": reason.get("issueLabel") or "",
            "reasonSummary": reason.get("reasonSummary") or "",
            "entityKey": reason.get("entityKey") or "",
            "sourcePages": sorted({int(slide["pageNumber"]) for slide in provenance_slides}) or target_pages,
            "status": "ready" if is_ready else "unresolved",
            "requiresCanonicalProvenance": True,
            "exportGrade": is_ready,
            "resolutionMode": "canonical",
            "retryMode": retry_mode,
            "ignoredLabels": ISSUE_IGNORED_LABELS.get(issue_type, []),
            "slides": provenance_slides,
        }
    anchors = build_reason_anchors(reason, account_context)
    structured_slides = build_structured_slides(reason, account_context, locator)
    scalar_slides = build_scalar_citation_slides(reason, locator, target_pages)
    resolved_slides = dedupe_slides([*structured_slides, *scalar_slides])[:5]
    all_matches: List[Match] = []

    for page_number in target_pages:
        words = locator.page_words.get(page_number) or []
        source = locator.page_sources.get(page_number, "pdf")
        for anchor in anchors:
            all_matches.extend(search_anchor(words, anchor, page_number, source))

    matches_by_page: Dict[int, List[Match]] = defaultdict(list)
    for match in all_matches:
        matches_by_page[match.page_number].append(match)

    clusters: List[Cluster] = []
    for page_number, page_matches in matches_by_page.items():
        page_image_width, page_image_height = locator.page_sizes[page_number]
        clusters.extend(cluster_matches(page_matches, page_image_width, page_image_height))

    clusters = sorted(clusters, key=lambda cluster: cluster.score, reverse=True)
    selected_clusters = clusters[:5]

    matched_required_anchors = {match.anchor.id for cluster in selected_clusters for match in cluster.matches if match.anchor.required}
    matched_non_identity_anchors = {
        match.anchor.id for cluster in selected_clusters for match in cluster.matches if match.anchor.kind != "identity"
    }
    matched_substantive_anchors = {
        match.anchor.id
        for cluster in selected_clusters
        for match in cluster.matches
        if match.anchor.kind in {"evidence", "timeline", "summary", "account_field", "history"}
    }
    required_anchor_ids = {anchor.id for anchor in anchors if anchor.required}
    issue_type = normalize_text(reason.get("issueType")).lower()
    issue_label = normalize_text(reason.get("issueLabel")).lower()
    has_multi_anchor_cluster = any(
        len({match.anchor.id for match in cluster.matches if match.anchor.kind != "identity"}) >= 2
        for cluster in selected_clusters
    )
    field_localizable_issue = issue_type.startswith("missing_") or "lacks" in issue_label or "incomplete" in issue_label

    status = "ready"
    if not resolved_slides and not selected_clusters:
        status = "unresolved"
    elif required_anchor_ids and not (required_anchor_ids & matched_required_anchors):
        if not resolved_slides and not ((field_localizable_issue and matched_substantive_anchors) or len(matched_substantive_anchors) >= 2):
            status = "unresolved"
    elif not resolved_slides and not matched_substantive_anchors:
        status = "unresolved"
    elif not resolved_slides and not has_multi_anchor_cluster and len(matched_substantive_anchors) < 2 and not field_localizable_issue:
        status = "unresolved"

    text_slides = [build_slide_from_cluster(cluster) for cluster in selected_clusters]
    slides = resolved_slides if resolved_slides else dedupe_slides(text_slides)[:5]

    bundle_pages = sorted(
        {
            *target_pages,
            *[
                int(slide["pageNumber"])
                for slide in slides
                if isinstance(slide, dict) and isinstance(slide.get("pageNumber"), int)
            ],
        }
    ) or target_pages
    is_ready = bool(slides and status == "ready")
    export_grade = bool(is_ready and slides_are_export_grade(slides))
    return {
        "reasonId": reason.get("id"),
        "issueType": reason.get("issueType") or "",
        "issueLabel": reason.get("issueLabel") or "",
        "reasonSummary": reason.get("reasonSummary") or "",
        "entityKey": reason.get("entityKey") or "",
        "sourcePages": bundle_pages,
        "status": "ready" if is_ready else "unresolved",
        "requiresCanonicalProvenance": False,
        "exportGrade": export_grade,
        "resolutionMode": "quality" if export_grade else "legacy",
        "retryMode": retry_mode,
        "ignoredLabels": ISSUE_IGNORED_LABELS.get(issue_type, []),
        "slides": slides,
    }


def collect_page_highlights(
    manifest: Dict[str, object],
    *,
    export_grade_only: bool = False,
) -> Dict[int, List[Dict[str, object]]]:
    per_page: Dict[int, List[Dict[str, object]]] = defaultdict(list)
    for bundle in manifest.get("reasons", []):
        if bundle.get("status") != "ready":
            continue
        if export_grade_only and not bundle.get("exportGrade"):
            continue
        for slide in bundle.get("slides", []):
            page_number = int(slide["pageNumber"])
            for box in slide.get("highlightBoxes", []):
                if box.get("kind") == "identity":
                    # Identity anchors (tradeline name, contact block) orient the
                    # per-account crops but are stray marks in the bureau-facing
                    # full report — only substantive evidence gets drawn there.
                    continue
                candidate = {
                    "x": float(box["x"]),
                    "y": float(box["y"]),
                    "width": float(box["width"]),
                    "height": float(box["height"]),
                    "label": box.get("label", ""),
                    **({"pdfBox": box.get("pdfBox")} if isinstance(box.get("pdfBox"), dict) else {}),
                    **({"provenanceId": box.get("provenanceId")} if box.get("provenanceId") else {}),
                }
                duplicate = False
                for existing in per_page[page_number]:
                    if candidate.get("pdfBox") and existing.get("pdfBox"):
                        left_pdf = candidate["pdfBox"]
                        right_pdf = existing["pdfBox"]
                        if (
                            abs(float(left_pdf["xMin"]) - float(right_pdf["xMin"])) <= 0.8
                            and abs(float(left_pdf["yMin"]) - float(right_pdf["yMin"])) <= 0.8
                            and abs(float(left_pdf["xMax"]) - float(right_pdf["xMax"])) <= 0.8
                            and abs(float(left_pdf["yMax"]) - float(right_pdf["yMax"])) <= 0.8
                        ):
                            duplicate = True
                            break
                    elif (
                        abs(existing["x"] - candidate["x"]) <= 1.5
                        and abs(existing["y"] - candidate["y"]) <= 1.5
                        and abs(existing["width"] - candidate["width"]) <= 1.5
                        and abs(existing["height"] - candidate["height"]) <= 1.5
                    ):
                        duplicate = True
                        break
                if not duplicate:
                    per_page[page_number].append(candidate)
    return per_page


def build_box_exhibit_index(exhibit_map: List[Dict[str, object]]) -> Dict[Tuple[int, int, int, int, int], List[str]]:
    """(page, x, y, w, h) -> exhibit labels citing that box, for number chips on the
    full report. Identity/context boxes never chip (they never render there anyway)."""
    index: Dict[Tuple[int, int, int, int, int], List[str]] = {}
    for exhibit in exhibit_map:
        for slide in exhibit.get("slides") or []:
            page_number = int(slide.get("pageNumber") or 0)
            for box in slide.get("highlightBoxes") or []:
                if box.get("kind") == "identity":
                    continue
                key = (page_number, int(box["x"]), int(box["y"]), int(box["width"]), int(box["height"]))
                labels = index.setdefault(key, [])
                label = str(exhibit.get("exhibit"))
                if label not in labels:
                    labels.append(label)
    return index


def render_highlighted_report_pdf(
    source_pdf: Path,
    output_pdf: Path,
    manifest: Dict[str, object],
    box_exhibit_index: Optional[Dict[Tuple[int, int, int, int, int], List[str]]] = None,
):
    page_highlights = collect_page_highlights(manifest, export_grade_only=True)
    doc = fitz.open(str(source_pdf))

    for page_index in range(doc.page_count):
        page_number = page_index + 1
        boxes = page_highlights.get(page_number) or []
        if not boxes:
            continue
        page = doc.load_page(page_index)
        page_rect = page.rect
        page_width = float(page_rect.width)
        page_height = float(page_rect.height)

        image_width = 1.0
        image_height = 1.0
        for bundle in manifest.get("reasons", []):
            for slide in bundle.get("slides", []):
                if int(slide["pageNumber"]) == page_number:
                    image_width = float(slide.get("pageImageWidth") or 1.0)
                    image_height = float(slide.get("pageImageHeight") or 1.0)
                    break
            if image_width > 1.0:
                break

        for box in boxes:
            pdf_box = box.get("pdfBox") if isinstance(box.get("pdfBox"), dict) else None
            if pdf_box:
                left = float(pdf_box["xMin"])
                top = float(pdf_box["yMin"])
                right = float(pdf_box["xMax"])
                bottom = float(pdf_box["yMax"])
            else:
                left = box["x"] / image_width * page_width
                top = box["y"] / image_height * page_height
                right = (box["x"] + box["width"]) / image_width * page_width
                bottom = (box["y"] + box["height"]) / image_height * page_height
            rect = fitz.Rect(left, top, right, bottom)
            page.draw_rect(
                rect,
                color=(1.0, 0.92, 0.23),
                fill=(1.0, 0.92, 0.23),
                fill_opacity=0.42,
                stroke_opacity=0.42,
                width=1.6,
                overlay=True,
            )
            # Exhibit number chip: maps every mark to its dispute so the bureau
            # never has to guess which highlight belongs to which claim.
            if box_exhibit_index:
                chip_key = (
                    page_number,
                    int(box.get("x", -1)), int(box.get("y", -1)),
                    int(box.get("width", -1)), int(box.get("height", -1)),
                )
                chip_labels = box_exhibit_index.get(chip_key)
                if chip_labels:
                    chip_text = ",".join(chip_labels[:3]) + ("\u2026" if len(chip_labels) > 3 else "")
                    chip_width = 4.2 * len(chip_text) + 6.0
                    chip_height = 10.0
                    chip_x1 = min(right, page_width - 1.0)
                    chip_x0 = max(1.0, chip_x1 - chip_width)
                    if top - chip_height - 1.5 >= 1.0:
                        chip_y0 = top - chip_height - 1.5
                    else:
                        chip_y0 = min(bottom + 1.5, page_height - chip_height - 1.0)
                    chip_rect = fitz.Rect(chip_x0, chip_y0, chip_x1, chip_y0 + chip_height)
                    page.draw_rect(
                        chip_rect,
                        color=(0.72, 0.53, 0.04),
                        fill=(1.0, 0.98, 0.82),
                        width=0.7,
                        overlay=True,
                    )
                    # insert_text (not insert_textbox): the 10pt chip is borderline
                    # for textbox fit math, which silently renders NOTHING on a
                    # negative return. Baseline insertion always draws.
                    text_width = fitz.get_text_length(chip_text, fontname="helv", fontsize=6.5)
                    baseline = fitz.Point(
                        chip_rect.x0 + max(1.5, (chip_rect.width - text_width) / 2.0),
                        chip_rect.y0 + 7.6,
                    )
                    page.insert_text(
                        baseline,
                        chip_text,
                        fontsize=6.5,
                        fontname="helv",
                        color=(0.4, 0.28, 0.0),
                        overlay=True,
                    )

    output_pdf.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(output_pdf))
    doc.close()


# --- Evidence exhibits (Phase 1 of the Exhibit Builder plan) -------------------
# Persist per-dispute screenshot crops with the SAME manifest geometry the certified
# views use, numbered to match the letter's dispute order. Export-grade only.

EXHIBIT_HIGHLIGHT_FILL = (255, 235, 59, 107)   # matches the 0.42-alpha yellow
EXHIBIT_HIGHLIGHT_OUTLINE = (218, 165, 32, 200)


def format_exhibit_number(index: int, style: str) -> str:
    if style == "alpha":
        label = ""
        value = index
        while True:
            label = chr(ord("A") + value % 26) + label
            value = value // 26 - 1
            if value < 0:
                break
        return label
    return str(index + 1)


def build_exhibit_map(
    draft: Dict[str, object],
    manifest: Dict[str, object],
    numbering_style: str = "numeric",
) -> List[Dict[str, object]]:
    """Letter-ordered exhibit list: one exhibit per export-grade dispute, numbered in
    the order the letter presents its disputes (sections.accountDisputes[].reasonIds),
    with any remaining export-grade reasons appended in manifest order."""
    bundles = {bundle.get("reasonId"): bundle for bundle in manifest.get("reasons") or []}
    reasons_by_id = {reason.get("id"): reason for reason in draft.get("selectedReasons") or []}

    # Letter-order fidelity: walk BOTH section families in presentation order, honor
    # section.enabled (a disabled section's disputes are not in the letter, so they
    # must not consume exhibit numbers), and never resurrect a disabled reason via
    # the manifest-order fallback.
    ordered: List[str] = []
    disabled: set = set()
    sections = draft.get("sections") or {}
    for section_key in ("accountDisputes", "personalInformationDisputes"):
        for section in sorted(sections.get(section_key) or [], key=lambda entry: entry.get("order") or 0):
            is_enabled = section.get("enabled", True)
            for reason_id in section.get("reasonIds") or []:
                if is_enabled:
                    if reason_id not in ordered:
                        ordered.append(reason_id)
                else:
                    disabled.add(reason_id)
    disabled -= set(ordered)
    for bundle in manifest.get("reasons") or []:
        reason_id = bundle.get("reasonId")
        if reason_id not in ordered and reason_id not in disabled:
            ordered.append(reason_id)

    exhibits: List[Dict[str, object]] = []
    index = 0
    for reason_id in ordered:
        bundle = bundles.get(reason_id)
        if not bundle or bundle.get("status") != "ready" or not bundle.get("exportGrade"):
            continue
        reason = reasons_by_id.get(reason_id) or {}
        exhibits.append(
            {
                "exhibit": format_exhibit_number(index, numbering_style),
                "reasonId": reason_id,
                "issueType": bundle.get("issueType") or reason.get("issueType") or "",
                "issueLabel": bundle.get("issueLabel") or reason.get("issueLabel") or "",
                "reasonSummary": bundle.get("reasonSummary") or reason.get("reasonSummary") or "",
                "requestedAction": reason.get("requestedAction") or "",
                "entityKey": bundle.get("entityKey") or "",
                "sourcePages": bundle.get("sourcePages") or [],
                "slides": bundle.get("slides") or [],
            }
        )
        index += 1
    return exhibits


def render_dispute_exhibits(
    manifest: Dict[str, object],
    draft: Dict[str, object],
    locator: PageTextLocator,
    exhibits_dir: Path,
    numbering_style: str = "numeric",
) -> Dict[str, object]:
    """Render every exhibit slide to a PNG (crop + translucent highlight rects) and
    write exhibits-manifest.json describing the compilation. Pure assembly on the
    certified geometry — no coordinate math beyond crop-relative offsets."""
    exhibits = build_exhibit_map(draft, manifest, numbering_style)
    exhibits_dir.mkdir(parents=True, exist_ok=True)
    # Stale exhibits from prior runs (renumbered disputes, numbering-style switches)
    # must never survive — the artifacts route serves anything in this directory.
    for stale in exhibits_dir.glob("exhibit-*.png"):
        stale.unlink()
    rendered: List[Dict[str, object]] = []
    warnings: List[str] = []

    for exhibit in exhibits:
        slides_out: List[Dict[str, object]] = []
        missing_image_pages: List[int] = []
        for slide_index, slide in enumerate(exhibit["slides"], start=1):
            page_number = int(slide.get("pageNumber") or 0)
            image_path = locator.image_paths.get(page_number)
            if not image_path or not Path(image_path).exists():
                missing_image_pages.append(page_number)
                warnings.append(
                    f"exhibit {exhibit['exhibit']}: page {page_number} image missing — slide skipped"
                )
                continue
            crop = slide.get("cropBox") or {}
            x = int(crop.get("x") or 0)
            y = int(crop.get("y") or 0)
            width = max(1, int(crop.get("width") or 1))
            height = max(1, int(crop.get("height") or 1))
            with Image.open(image_path) as page_image:
                cropped = page_image.crop((x, y, x + width, y + height)).convert("RGBA")
                overlay = Image.new("RGBA", cropped.size, (0, 0, 0, 0))
                draw = ImageDraw.Draw(overlay)
                for box in slide.get("highlightBoxes") or []:
                    left = int(box.get("x", 0)) - x
                    top = int(box.get("y", 0)) - y
                    right = left + int(box.get("width", 0))
                    bottom = top + int(box.get("height", 0))
                    draw.rectangle(
                        (left, top, right, bottom),
                        fill=EXHIBIT_HIGHLIGHT_FILL,
                        outline=EXHIBIT_HIGHLIGHT_OUTLINE,
                        width=2,
                    )
                composed = Image.alpha_composite(cropped, overlay).convert("RGB")
                file_name = f"exhibit-{exhibit['exhibit']}-{slide_index:02d}.png"
                composed.save(str(exhibits_dir / file_name))
            slides_out.append(
                {
                    "file": file_name,
                    "pageNumber": page_number,
                    "label": slide.get("label") or "",
                    "matchedText": slide.get("matchedText") or "",
                    "highlightCount": len(slide.get("highlightBoxes") or []),
                }
            )
        rendered.append(
            {
                **{key: exhibit[key] for key in (
                    "exhibit", "reasonId", "issueType", "issueLabel",
                    "reasonSummary", "requestedAction", "entityKey", "sourcePages",
                )},
                "slides": slides_out,
                **({"missingImagePages": missing_image_pages} if missing_image_pages else {}),
            }
        )

    exhibits_manifest = {
        "numberingStyle": numbering_style,
        "exhibitCount": len(rendered),
        "exhibits": rendered,
        **({"warnings": warnings} if warnings else {}),
    }
    (exhibits_dir / "exhibits-manifest.json").write_text(json.dumps(exhibits_manifest, indent=2))
    return exhibits_manifest


def build_manifest(
    draft: Dict[str, object],
    locator: PageTextLocator,
    session_context: Optional[SessionResultContext] = None,
    manifest_session_id: Optional[str] = None,
    retry_mode: str = "default",
) -> Dict[str, object]:
    selected_reasons = draft.get("selectedReasons") or []
    bundles = [build_reason_bundle(reason, locator, session_context, retry_mode) for reason in selected_reasons]
    # Crop-polish pass: snap every slide's crop window to text-line whitespace
    # so no edge slices a word (operator, Session 23). Applied at manifest
    # assembly so ALL slide-building paths inherit it uniformly.
    for bundle in bundles:
        for slide in bundle.get("slides") or []:
            crop = slide.get("cropBox")
            page_number = slide.get("pageNumber")
            if not isinstance(crop, dict) or not page_number:
                continue
            words = locator.page_words.get(int(page_number)) or []
            size = locator.page_sizes.get(int(page_number))
            if not words or not size:
                continue
            slide["cropBox"] = snap_crop_to_text_lines(
                crop,
                words,
                float(size[0]),
                float(size[1]),
                protected=slide.get("highlightBoxes") or [],
            )
    unresolved_reason_ids = [bundle["reasonId"] for bundle in bundles if bundle["status"] != "ready"]
    blocking_unresolved_reason_ids = [
        bundle["reasonId"]
        for bundle in bundles
        if bundle.get("requiresCanonicalProvenance") and bundle["status"] != "ready"
    ]
    exportable_reason_ids = [
        bundle["reasonId"]
        for bundle in bundles
        if bundle.get("exportGrade")
    ]
    return {
        "generatedAt": fitz.get_pdf_now(),
        "sessionId": manifest_session_id or draft.get("sessionId"),
        "reasonCount": len(bundles),
        "pageCount": locator.page_count,
        "retryMode": retry_mode,
        "retryCount": 0,
        "validationReportPath": None,
        "validationSummary": None,
        "unresolvedReasonIds": unresolved_reason_ids,
        "blockingUnresolvedReasonIds": blocking_unresolved_reason_ids,
        "exportableReasonIds": exportable_reason_ids,
        "reasons": bundles,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("draft_json")
    parser.add_argument("--source-pdf", required=True)
    parser.add_argument("--images-dir", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--result-json")
    parser.add_argument("--highlighted-pdf-path")
    parser.add_argument("--session-id")
    parser.add_argument("--retry-mode", default="default")
    parser.add_argument("--exhibits-dir")
    parser.add_argument("--exhibit-numbering", default="numeric", choices=["numeric", "alpha"])
    args = parser.parse_args()

    draft_path = Path(args.draft_json)
    draft = json.loads(draft_path.read_text())
    source_pdf = Path(args.source_pdf)
    images_dir = Path(args.images_dir)
    output_dir = Path(args.output_dir)
    result_json_path = Path(args.result_json) if args.result_json else None
    output_dir.mkdir(parents=True, exist_ok=True)

    locator = PageTextLocator(source_pdf, images_dir)
    session_context = SessionResultContext(result_json_path, locator)
    manifest = build_manifest(draft, locator, session_context, args.session_id, args.retry_mode)
    manifest_path = output_dir / "evidence-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2))

    highlighted_pdf_path = None
    can_generate = len(manifest.get("blockingUnresolvedReasonIds") or []) == 0 and len(manifest.get("exportableReasonIds") or []) > 0
    if args.highlighted_pdf_path and can_generate:
        highlighted_pdf_path = Path(args.highlighted_pdf_path)
        # Chips always carry letter-order exhibit numbers (product rule: every mark maps to
        # its dispute) — the same map the exhibits/memorandum use.
        chip_index = build_box_exhibit_index(build_exhibit_map(draft, manifest, args.exhibit_numbering))
        render_highlighted_report_pdf(source_pdf, highlighted_pdf_path, manifest, box_exhibit_index=chip_index)

    exhibits_manifest = None
    exhibits_dir = None
    if args.exhibits_dir and can_generate:
        exhibits_dir = Path(args.exhibits_dir)
        exhibits_manifest = render_dispute_exhibits(
            manifest, draft, locator, exhibits_dir, args.exhibit_numbering
        )

    print(
        json.dumps(
            {
                "manifest": manifest,
                "manifestPath": str(manifest_path),
                "highlightedReportPdfPath": str(highlighted_pdf_path) if highlighted_pdf_path else None,
                "canGenerateHighlightedReport": can_generate,
                "blockingUnresolvedReasonIds": manifest.get("blockingUnresolvedReasonIds") or [],
                "exportableReasonIds": manifest.get("exportableReasonIds") or [],
                "exhibitsDir": str(exhibits_dir) if exhibits_dir else None,
                "exhibitCount": exhibits_manifest.get("exhibitCount") if exhibits_manifest else 0,
            }
        )
    )


if __name__ == "__main__":
    main()
