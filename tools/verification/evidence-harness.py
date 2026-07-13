#!/usr/bin/env python3
"""Ground-truth harness: cross-check a dispute draft (what the dispute layer found)
against an evidence manifest (what the highlighter produced).

This is the programmatic half of the Session 21 verification loop. It answers,
per reason:
  1. COVERAGE  - is every cited piece of evidence (scalar comparisons, monthly
                 comparisons, supporting fields) represented by at least one
                 highlight box?
  2. GEOMETRY  - does every box carry pdfBox? does pdfBox agree numerically with
                 the image-space box (scale = pageImage / pdf page)? what source
                 tier is each box (extraction provenance / pdf text / unknown)?
  3. DUPLICATES- do distinct labels collapse onto identical rects within a slide?
  4. EXPORT    - status / exportGrade / resolutionMode, and the manifest-level
                 exportableReasonIds + whether a highlighted PDF exists.

Usage:
  python3 harness.py --draft <draft.json> --manifest <evidence-manifest.json> \
      [--pdf-width 612] [--pdf-height 792] [--json <out.json>]

The draft's embedded evidenceManifest can be used by passing the draft twice:
  python3 harness.py --draft draft.json --manifest EMBEDDED
"""

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

PT_TO_PX_TOLERANCE_PX = 2.5  # allowed drift between pdfBox*scale and image box, px


def load(path):
    with open(path) as fh:
        return json.load(fh)


def norm_label(s):
    return " ".join(str(s or "").lower().split())


def compactk(s):
    return "".join(ch for ch in str(s or "").lower() if ch.isalnum())


# Mirror of the generator's citation -> printed-label routing, so coverage matching
# recognizes a box placed via the mapped printed label (e.g. field:dateClosed is
# covered by a box labeled 'Reported closed date' — both resolve to "Date Closed").
PRINTED_LABEL_KEYS = {
    "dateclosed": "Date Closed", "closeddate": "Date Closed",
    "recentpayment": "Actual Payment Amount", "actualpaymentamount": "Actual Payment Amount",
    "scheduledpaymentamount": "Scheduled Payment Amount",
    "lastpaymentdate": "Date of Last Payment", "lastpayment": "Date of Last Payment",
    "statusupdated": "Date Reported", "datereported": "Date Reported",
    "status": "Account Status", "accountstatus": "Account Status",
    "balanceupdated": None,  # cite-only: not printed on EQ old-format
    "balance": "Reported Balance", "currentbalance": "Reported Balance",
    "amountpastdue": "Amount Past Due", "chargeoffamount": "Charge Off Amount",
    "accountnumber": "Account Number", "dateopened": "Date Opened",
    "closuretiming": "Date of Last Payment",
    "paymentamount": "Actual Payment Amount",
    "indicatorcode": None, "indicatordescription": None, "indicatorcategory": None,
    "legalcategory": None, "linkedaccountlegalcategory": None, "linkedaccountname": None,
    "description": None,
}
LABEL_KEYWORDS = [
    ("closed date", "dateclosed"), ("closure timing", "closuretiming"),
    ("last-payment", "lastpaymentdate"), ("last payment", "lastpaymentdate"),
    ("balance-updated", "balanceupdated"), ("balance updated", "balanceupdated"),
    ("status-update", "statusupdated"), ("status update", "statusupdated"),
    ("date reported", "datereported"), ("status", "status"),
    ("actual payment", "actualpaymentamount"), ("scheduled payment", "scheduledpaymentamount"),
    ("past due", "amountpastdue"), ("past-due", "amountpastdue"),
    ("charge off", "chargeoffamount"), ("charge-off", "chargeoffamount"),
    ("account number", "accountnumber"), ("payment amount", "paymentamount"),
    ("indicator code", "indicatorcode"), ("indicator description", "indicatordescription"),
    ("indicator category", "indicatorcategory"), ("legal category", "legalcategory"),
    ("linked account name", "linkedaccountname"),
    ("balance", "balance"),
]


def printed_label_for(citation_text):
    """Return (mapped, printed): mapped=False if unmapped; printed=None if cite-only."""
    import re as _re
    key = compactk(citation_text)
    if key in PRINTED_LABEL_KEYS:
        return True, PRINTED_LABEL_KEYS[key]
    # de-camelCase field names so keyword scan sees word boundaries
    low = norm_label(_re.sub(r"(?<=[a-z])(?=[A-Z])", " ", str(citation_text or "")))
    for kw, fk in LABEL_KEYWORDS:
        if kw in low:
            return True, PRINTED_LABEL_KEYS.get(fk)
    return False, None


def box_key(b):
    return (b.get("x"), b.get("y"), b.get("width"), b.get("height"))


def month_tokens(month_str):
    """'Mar 2022' -> {'mar 2022', 'mar', '2022'} lowercased."""
    t = norm_label(month_str)
    parts = t.split()
    out = {t}
    out.update(parts)
    return out


def analyze_reason(reason, bundle, pdf_w, pdf_h):
    res = {
        "reasonId": reason["id"],
        "issueType": reason.get("issueType"),
        "entityKey": reason.get("entityKey"),
        "sourcePages": reason.get("sourcePages"),
        "status": bundle.get("status") if bundle else None,
        "exportGrade": bundle.get("exportGrade") if bundle else None,
        "resolutionMode": bundle.get("resolutionMode") if bundle else None,
        "slides": 0,
        "boxes": 0,
        "boxes_with_pdfBox": 0,
        "boxes_with_provenance": 0,
        "box_sources": defaultdict(int),
        "pdfbox_mismatches": [],   # boxes whose pdfBox*scale disagrees with image box
        "duplicate_rect_groups": [],  # within-slide identical rects w/ distinct labels
        "coverage": {},            # cited item -> [labels of boxes covering it] or []
        "boxes_off_source_pages": [],
        "problems": [],
    }
    ev = reason.get("evidence") or {}

    # ---- enumerate cited items (the ground truth) ----
    cited = {}
    for sc in ev.get("scalarComparisons") or []:
        cited[f"scalar:{sc.get('label')}"] = {"kind": "scalar", "label": norm_label(sc.get("label")), "value": sc.get("value")}
    for mc in ev.get("monthlyComparisons") or []:
        cited[f"month:{mc.get('month')}"] = {"kind": "month", "month": mc.get("month"),
                                             "left": f"{mc.get('leftLabel')}={mc.get('leftValue')}",
                                             "right": f"{mc.get('rightLabel')}={mc.get('rightValue')}"}
    for f in reason.get("supportingFields") or []:
        cited[f"field:{f}"] = {"kind": "field", "field": f}

    if not bundle:
        res["problems"].append("NO BUNDLE in manifest for this reason")
        res["coverage"] = {k: [] for k in cited}
        return res

    slides = bundle.get("slides") or []
    res["slides"] = len(slides)
    all_boxes = []

    for slide in slides:
        boxes = slide.get("highlightBoxes") or []
        res["boxes"] += len(boxes)
        piw = slide.get("pageImageWidth") or 0
        pih = slide.get("pageImageHeight") or 0
        sx = piw / pdf_w if pdf_w else 0
        sy = pih / pdf_h if pdf_h else 0

        # duplicate rects within slide
        groups = defaultdict(list)
        for b in boxes:
            groups[box_key(b)].append(b.get("label"))
        for rect, labels in groups.items():
            if len(labels) > 1:
                res["duplicate_rect_groups"].append(
                    {"slide": slide.get("id"), "page": slide.get("pageNumber"),
                     "rect": rect, "labels": labels})

        for b in boxes:
            all_boxes.append((slide, b))
            src = b.get("source") or ("provenance" if b.get("provenanceId") else "unknown")
            res["box_sources"][src] += 1
            if b.get("pdfBox"):
                res["boxes_with_pdfBox"] += 1
                pb = b["pdfBox"]
                exp_x = pb["xMin"] * sx
                exp_y = pb["yMin"] * sy
                exp_w = (pb["xMax"] - pb["xMin"]) * sx
                exp_h = (pb["yMax"] - pb["yMin"]) * sy
                if (abs(exp_x - b["x"]) > PT_TO_PX_TOLERANCE_PX
                        or abs(exp_y - b["y"]) > PT_TO_PX_TOLERANCE_PX
                        or abs(exp_w - b["width"]) > 2 * PT_TO_PX_TOLERANCE_PX
                        or abs(exp_h - b["height"]) > 2 * PT_TO_PX_TOLERANCE_PX):
                    res["pdfbox_mismatches"].append(
                        {"slide": slide.get("id"), "label": b.get("label"),
                         "image": box_key(b),
                         "pdf_scaled": (round(exp_x, 1), round(exp_y, 1), round(exp_w, 1), round(exp_h, 1))})
            if b.get("provenanceId"):
                res["boxes_with_provenance"] += 1
            sp = reason.get("sourcePages") or []
            if sp and slide.get("pageNumber") not in sp:
                res["boxes_off_source_pages"].append(
                    {"slide": slide.get("id"), "page": slide.get("pageNumber"), "label": b.get("label")})

    # ---- coverage: does some box speak for each cited item? ----
    for key, item in cited.items():
        hits = []
        # resolve the citation to its printed label (or cite-only status)
        cite_text = item.get("label") or item.get("field") or ""
        if norm_label(cite_text) == "report evidence":
            # catch-all label for a short supporting fact — the fact's substantive
            # fields are cited (and matched) individually; the letter text carries it
            res["coverage"][key] = ["(meta-fact: carried by letter text)"]
            continue
        mapped, printed = printed_label_for(cite_text)
        if mapped and printed is None:
            res["coverage"][key] = ["(cite-only: not printed on the face)"]
            continue
        for slide, b in all_boxes:
            bl = norm_label(b.get("label"))
            prov = b.get("provenanceId") or ""
            # map-aware: a box whose label routes to the same printed label covers it
            if mapped and printed:
                b_mapped, b_printed = printed_label_for(b.get("label"))
                if b_mapped and b_printed == printed:
                    hits.append(b.get("label"))
                    continue
            if item["kind"] == "scalar":
                if item["label"] and (item["label"] in bl or bl in item["label"]):
                    hits.append(b.get("label"))
            elif item["kind"] == "month":
                toks = month_tokens(item["month"])
                mt = norm_label(slide.get("matchedText"))
                # month covered if a box label mentions the month, matchedText does,
                # or provenance id encodes the year:month
                ym = None
                parts = norm_label(item["month"]).split()
                if len(parts) == 2:
                    ym = f"{parts[1]}:{parts[0]}"
                if (any(t and t in bl for t in toks)
                        or (ym and ym in prov)
                        or bl == "month" and mt in toks):
                    hits.append(b.get("label"))
            elif item["kind"] == "field":
                # humanize: lastPaymentDate -> last payment date
                fname = item["field"]
                human = norm_label("".join(" " + c.lower() if c.isupper() else c for c in fname))
                if human and (human in bl or bl in human) or (f":field:{fname}" in prov) or (f":{fname}:" in prov):
                    hits.append(b.get("label"))
        res["coverage"][key] = hits

    res["box_sources"] = dict(res["box_sources"])
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--draft", required=True)
    ap.add_argument("--manifest", required=True,
                    help="path to evidence-manifest.json, or EMBEDDED to use draft.evidenceManifest")
    ap.add_argument("--pdf-width", type=float, default=612.0)
    ap.add_argument("--pdf-height", type=float, default=792.0)
    ap.add_argument("--json", help="also write full results as JSON to this path")
    args = ap.parse_args()

    draft = load(args.draft)
    manifest = draft.get("evidenceManifest") if args.manifest == "EMBEDDED" else load(args.manifest)
    if not manifest:
        print("FATAL: no manifest found", file=sys.stderr)
        sys.exit(2)

    reasons = draft.get("selectedReasons") or []
    bundles = {b.get("reasonId"): b for b in manifest.get("reasons") or []}

    results = [analyze_reason(r, bundles.get(r["id"]), args.pdf_width, args.pdf_height)
               for r in reasons]

    # ---------- report ----------
    exportable = manifest.get("exportableReasonIds")
    if exportable is None:
        exportable = [b["reasonId"] for b in (manifest.get("reasons") or []) if b.get("exportGrade")]
    print("=" * 100)
    print(f"HARNESS  draft={Path(args.draft).name}  manifest={'EMBEDDED' if args.manifest=='EMBEDDED' else Path(args.manifest).name}")
    print(f"reasons={len(reasons)}  bundles={len(bundles)}  exportable={len(exportable)}  "
          f"generatedAt={manifest.get('generatedAt')}")
    hl = Path(args.manifest).parent / "highlighted-report.pdf" if args.manifest != "EMBEDDED" else None
    if hl is not None:
        print(f"highlighted-report.pdf on disk: {hl.exists()}")
    print("=" * 100)

    tot = {"boxes": 0, "pdfBox": 0, "prov": 0, "dups": 0, "mismatch": 0, "uncovered": 0, "offpage": 0}
    for r in results:
        cov_missing = [k for k, v in r["coverage"].items() if not v]
        tot["boxes"] += r["boxes"]
        tot["pdfBox"] += r["boxes_with_pdfBox"]
        tot["prov"] += r["boxes_with_provenance"]
        tot["dups"] += len(r["duplicate_rect_groups"])
        tot["mismatch"] += len(r["pdfbox_mismatches"])
        tot["uncovered"] += len(cov_missing)
        tot["offpage"] += len(r["boxes_off_source_pages"])

        flag = "OK " if (r["exportGrade"] and not cov_missing and not r["duplicate_rect_groups"]
                         and not r["pdfbox_mismatches"] and r["boxes_with_pdfBox"] == r["boxes"]) else "!! "
        print(f"\n{flag}{r['reasonId']}")
        print(f"    status={r['status']} exportGrade={r['exportGrade']} mode={r['resolutionMode']} "
              f"slides={r['slides']} boxes={r['boxes']} pdfBox={r['boxes_with_pdfBox']}/{r['boxes']} "
              f"prov={r['boxes_with_provenance']} sources={r['box_sources']}")
        if r["problems"]:
            for p in r["problems"]:
                print(f"    PROBLEM: {p}")
        if cov_missing:
            print(f"    UNCOVERED cited items ({len(cov_missing)}):")
            for k in cov_missing:
                print(f"      - {k}")
        for d in r["duplicate_rect_groups"]:
            print(f"    DUP RECT p{d['page']} {d['rect']}: {d['labels']}")
        for m in r["pdfbox_mismatches"]:
            print(f"    PDFBOX MISMATCH {m['slide']} '{m['label']}': img={m['image']} vs pdf*scale={m['pdf_scaled']}")
        for o in r["boxes_off_source_pages"][:3]:
            print(f"    OFF-PAGE box p{o['page']} '{o['label']}' (sourcePages={r['sourcePages']})")

    print("\n" + "=" * 100)
    print(f"TOTALS: boxes={tot['boxes']}  pdfBox={tot['pdfBox']}/{tot['boxes']}  provenance={tot['prov']}  "
          f"dupRectGroups={tot['dups']}  pdfboxMismatches={tot['mismatch']}  "
          f"uncoveredCitedItems={tot['uncovered']}  offPageBoxes={tot['offpage']}")
    print(f"EXPORTABLE: {len(exportable)}/{len(reasons)}  -> {sorted(exportable)[:5]}{'...' if len(exportable) > 5 else ''}")

    if args.json:
        with open(args.json, "w") as fh:
            json.dump({"results": results, "totals": tot, "exportable": exportable}, fh, indent=2, default=list)
        print(f"\nfull JSON -> {args.json}")


if __name__ == "__main__":
    main()
