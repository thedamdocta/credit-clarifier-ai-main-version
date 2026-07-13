#!/usr/bin/env python3
import argparse
import asyncio
import json
import os
from pathlib import Path
from typing import Any, Dict


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Probe LlamaParse outputs for a PDF sample")
    parser.add_argument("--input-pdf", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--tier", default="agentic", choices=["fast", "cost_effective", "agentic", "agentic_plus"])
    parser.add_argument("--version", default="latest")
    parser.add_argument(
        "--expand",
        nargs="*",
        default=["markdown_full", "text_full", "markdown", "text", "items", "images_content_metadata"],
        help="Expanded result fields to request from the API.",
    )
    return parser.parse_args()


def require_api_key() -> str:
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    if api_key:
        return api_key
    raise SystemExit("Missing LLAMA_CLOUD_API_KEY in environment.")


def ensure_output_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def dump_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")


def extract_pages(payload: Any) -> list:
    if isinstance(payload, dict):
        pages = payload.get("pages")
        if isinstance(pages, list):
            return pages
    if isinstance(payload, list):
        return payload
    return []


def summarize_item_types(items_payload: Any) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for page in extract_pages(items_payload):
        if not isinstance(page, dict):
            continue
        for item in page.get("items") or []:
            item_type = str((item or {}).get("type") or "unknown")
            counts[item_type] = counts.get(item_type, 0) + 1
    return counts


async def run_probe(args: argparse.Namespace) -> int:
    try:
        from llama_cloud import AsyncLlamaCloud
    except ImportError as exc:
        raise SystemExit(
            "Missing optional dependency 'llama-cloud'. Install it in a virtualenv before running this probe."
        ) from exc

    input_pdf = Path(args.input_pdf).expanduser().resolve()
    output_dir = Path(args.output_dir).expanduser().resolve()
    if not input_pdf.exists():
        raise SystemExit(f"Input PDF not found: {input_pdf}")

    ensure_output_dir(output_dir)
    client = AsyncLlamaCloud(api_key=require_api_key())

    try:
        file_obj = await client.files.create(file=str(input_pdf), purpose="parse")
        result = await client.parsing.parse(
            file_id=file_obj.id,
            tier=args.tier,
            version=args.version,
            expand=args.expand,
            output_options={
                "images_to_save": ["screenshot", "layout"],
                "spatial_text": {
                    "do_not_unroll_columns": True,
                    "preserve_layout_alignment_across_pages": True,
                    "preserve_very_small_text": True,
                },
                "tables_as_spreadsheet": {
                    "enable": True,
                    "guess_sheet_name": False,
                },
            },
            processing_options={
                "aggressive_table_extraction": True,
            },
            verbose=True,
            timeout=7200.0,
        )

        result_json = result.model_dump(mode="json")
        dump_json(output_dir / "result.json", result_json)
        dump_json(output_dir / "job.json", result_json.get("job"))
        dump_json(output_dir / "raw_parameters.json", result_json.get("raw_parameters"))
        dump_json(output_dir / "metadata.json", result_json.get("metadata"))
        dump_json(output_dir / "images_content_metadata.json", result_json.get("images_content_metadata"))
        dump_json(output_dir / "items.json", result_json.get("items"))
        dump_json(output_dir / "markdown_pages.json", result_json.get("markdown"))
        dump_json(output_dir / "text_pages.json", result_json.get("text"))

        (output_dir / "markdown_full.md").write_text(result.markdown_full or "", encoding="utf-8")
        (output_dir / "text_full.txt").write_text(result.text_full or "", encoding="utf-8")

        markdown_pages = extract_pages(result_json.get("markdown"))
        text_pages = extract_pages(result_json.get("text"))
        items_pages = extract_pages(result_json.get("items"))

        summary = {
            "inputPdf": str(input_pdf),
            "fileId": file_obj.id,
            "jobId": (result_json.get("job") or {}).get("id"),
            "jobStatus": (result_json.get("job") or {}).get("status"),
            "tier": args.tier,
            "version": args.version,
            "expand": args.expand,
            "markdownPageCount": len(markdown_pages),
            "textPageCount": len(text_pages),
            "itemPageCount": len(items_pages),
            "imageMetadataCount": len(((result_json.get("images_content_metadata") or {}).get("images") or [])),
            "itemTypes": summarize_item_types(result_json.get("items") or []),
        }
        dump_json(output_dir / "summary.json", summary)
        print(json.dumps(summary, indent=2))
        return 0
    finally:
        await client.close()


def main() -> int:
    args = parse_args()
    return asyncio.run(run_probe(args))


if __name__ == "__main__":
    raise SystemExit(main())
