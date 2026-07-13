import argparse
import base64
import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

import requests
from PIL import Image, ImageDraw


HIGHLIGHT_FILL = (255, 235, 59, 107)
HIGHLIGHT_STROKE = (255, 235, 59, 107)
HIGHLIGHT_STROKE_WIDTH = 4


def normalize_text(value: object) -> str:
    return " ".join(str(value or "").split()).strip()


def clip_crop(box: Dict[str, object], image: Image.Image) -> Tuple[int, int, int, int]:
    width, height = image.size
    x = max(0, min(width, int(round(float(box.get("x", 0) or 0)))))
    y = max(0, min(height, int(round(float(box.get("y", 0) or 0)))))
    w = max(1, min(width - x, int(round(float(box.get("width", 1) or 1)))))
    h = max(1, min(height - y, int(round(float(box.get("height", 1) or 1)))))
    return x, y, x + w, y + h


def build_reason_lookup(draft: Dict[str, object]) -> Dict[str, Dict[str, object]]:
    selected_reasons = draft.get("selectedReasons") or []
    return {
        normalize_text(reason.get("id")): reason
        for reason in selected_reasons
        if isinstance(reason, dict) and normalize_text(reason.get("id"))
    }


def encode_image(image_path: Path) -> str:
    encoded = base64.b64encode(image_path.read_bytes()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def resolve_page_image(images_dir: Path, page_number: int) -> Path:
    candidates = [
        images_dir / f"page-{page_number}.png",
        images_dir / f"page-{page_number:02d}.png",
        images_dir / f"page-{page_number:03d}.png",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[0]


def draw_highlighted_slide(page_image_path: Path, slide: Dict[str, object], full_page_output: Path, crop_output: Path) -> None:
    image = Image.open(page_image_path).convert("RGBA")
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    for box in slide.get("highlightBoxes") or []:
        if not isinstance(box, dict):
            continue
        left, top, right, bottom = clip_crop(box, image)
        draw.rectangle((left, top, right, bottom), fill=HIGHLIGHT_FILL, outline=HIGHLIGHT_STROKE, width=HIGHLIGHT_STROKE_WIDTH)

    composited = Image.alpha_composite(image, overlay).convert("RGB")
    full_page_output.parent.mkdir(parents=True, exist_ok=True)
    composited.save(full_page_output)

    crop_box = slide.get("cropBox") if isinstance(slide.get("cropBox"), dict) else None
    if crop_box:
        crop_bounds = clip_crop(crop_box, composited)
        composited.crop(crop_bounds).save(crop_output)
    else:
        composited.save(crop_output)


@dataclass
class ValidationResult:
    verdict: str
    confidence: float
    rationale: str
    problems: List[str]


class VisionValidator:
    model_name: str = ""

    def validate_reason(
        self,
        *,
        reason: Dict[str, object],
        bundle: Dict[str, object],
        rendered_slides: Sequence[Dict[str, object]],
    ) -> ValidationResult:
        raise NotImplementedError


class OpenAIVisionValidator(VisionValidator):
    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model
        self.model_name = model

    def validate_reason(
        self,
        *,
        reason: Dict[str, object],
        bundle: Dict[str, object],
        rendered_slides: Sequence[Dict[str, object]],
    ) -> ValidationResult:
        prompt = {
            "issueLabel": normalize_text(reason.get("issueLabel")),
            "reasonSummary": normalize_text(reason.get("reasonSummary")),
            "supportingFacts": [normalize_text(item) for item in (reason.get("supportingFacts") or [])[:4]],
            "requestedAction": normalize_text(reason.get("requestedAction")),
            "bundleSourcePages": bundle.get("sourcePages") or [],
            "slides": [
                {
                    "slideLabel": normalize_text(slide.get("label")),
                    "pageNumber": int(slide.get("pageNumber") or 0),
                    "highlightLabels": slide.get("highlightLabels") or [],
                }
                for slide in rendered_slides
            ],
        }
        content: List[Dict[str, str]] = [
            {
                "type": "input_text",
                "text": (
                    "Validate the highlighted evidence against this dispute reason and the rendered slide set:\n"
                    f"{json.dumps(prompt, indent=2)}\n"
                    "Judge the evidence bundle as a whole. A dispute may be supported across multiple slides or pages. "
                    "Return pass only if the combined highlights accurately and specifically support the reason."
                ),
            }
        ]
        for slide in rendered_slides:
            content.append({"type": "input_image", "image_url": encode_image(Path(slide["cropImagePath"]))})
            content.append({"type": "input_image", "image_url": encode_image(Path(slide["fullPageImagePath"]))})
        body = {
            "model": self.model,
            "input": [
                {
                    "role": "system",
                    "content": [
                        {
                            "type": "input_text",
                            "text": (
                                "You are validating whether yellow highlight boxes on a credit-report screenshot "
                                "accurately mark the evidence for a dispute reason. Return strict JSON with keys: "
                                "verdict (pass|review|fail), confidence (0-1), rationale, problems (array of strings)."
                            ),
                        }
                    ],
                },
                {
                    "role": "user",
                    "content": content,
                },
            ],
            "text": {"format": {"type": "json_object"}},
        }
        response = requests.post(
            "https://api.openai.com/v1/responses",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            json=body,
            timeout=120,
        )
        response.raise_for_status()
        payload = response.json()
        output_text = ""
        for item in payload.get("output", []):
            for content in item.get("content", []):
                if content.get("type") == "output_text":
                    output_text += content.get("text", "")
        parsed = json.loads(output_text or "{}")
        return ValidationResult(
            verdict=normalize_text(parsed.get("verdict")).lower() or "review",
            confidence=float(parsed.get("confidence") or 0.0),
            rationale=normalize_text(parsed.get("rationale")) or "No rationale returned.",
            problems=[normalize_text(item) for item in parsed.get("problems") or [] if normalize_text(item)],
        )


class OllamaVisionValidator(VisionValidator):
    def __init__(self, base_url: str, model: str):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.model_name = model

    def validate_reason(
        self,
        *,
        reason: Dict[str, object],
        bundle: Dict[str, object],
        rendered_slides: Sequence[Dict[str, object]],
    ) -> ValidationResult:
        prompt = {
            "issueLabel": normalize_text(reason.get("issueLabel")),
            "reasonSummary": normalize_text(reason.get("reasonSummary")),
            "supportingFacts": [normalize_text(item) for item in (reason.get("supportingFacts") or [])[:4]],
            "requestedAction": normalize_text(reason.get("requestedAction")),
            "bundleSourcePages": bundle.get("sourcePages") or [],
            "slides": [
                {
                    "slideLabel": normalize_text(slide.get("label")),
                    "pageNumber": int(slide.get("pageNumber") or 0),
                    "highlightLabels": slide.get("highlightLabels") or [],
                }
                for slide in rendered_slides
            ],
        }
        def image_to_b64(path: Path) -> str:
            return base64.b64encode(path.read_bytes()).decode("ascii")

        response = requests.post(
            f"{self.base_url}/api/chat",
            json={
                "model": self.model,
                "stream": False,
                "format": "json",
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "Validate highlighted credit-report evidence. Return JSON with keys: "
                            "verdict (pass|review|fail), confidence (0-1), rationale, problems (array)."
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            "Validate the highlighted evidence against this dispute reason and the rendered slide set:\n"
                            f"{json.dumps(prompt, indent=2)}\n"
                            "Judge the evidence bundle as a whole. A dispute may be supported across multiple slides or pages."
                        ),
                        "images": [
                            image_to_b64(Path(slide["cropImagePath"]))
                            for slide in rendered_slides
                        ] + [
                            image_to_b64(Path(slide["fullPageImagePath"]))
                            for slide in rendered_slides
                        ],
                    },
                ],
            },
            timeout=120,
        )
        response.raise_for_status()
        payload = response.json()
        parsed = json.loads(((payload.get("message") or {}).get("content")) or "{}")
        return ValidationResult(
            verdict=normalize_text(parsed.get("verdict")).lower() or "review",
            confidence=float(parsed.get("confidence") or 0.0),
            rationale=normalize_text(parsed.get("rationale")) or "No rationale returned.",
            problems=[normalize_text(item) for item in parsed.get("problems") or [] if normalize_text(item)],
        )


def load_validator(provider: str, model: Optional[str]) -> Optional[VisionValidator]:
    normalized_provider = normalize_text(provider).lower()
    if normalized_provider in {"", "auto"}:
        if os.getenv("OPENAI_API_KEY"):
            return OpenAIVisionValidator(os.environ["OPENAI_API_KEY"], model or os.getenv("HIGHLIGHT_VALIDATION_MODEL") or "gpt-4.1-mini")
        if os.getenv("OLLAMA_VISION_MODEL"):
            return OllamaVisionValidator(os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434"), os.environ["OLLAMA_VISION_MODEL"])
        return None
    if normalized_provider == "openai":
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is required for provider=openai.")
        return OpenAIVisionValidator(api_key, model or os.getenv("HIGHLIGHT_VALIDATION_MODEL") or "gpt-4.1-mini")
    if normalized_provider == "ollama":
        selected_model = model or os.getenv("OLLAMA_VISION_MODEL")
        if not selected_model:
            raise RuntimeError("OLLAMA_VISION_MODEL or --model is required for provider=ollama.")
        return OllamaVisionValidator(os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434"), selected_model)
    if normalized_provider == "none":
        return None
    raise RuntimeError(f"Unsupported provider '{provider}'.")


def safe_verdict(rendered_slides: Sequence[Dict[str, object]]) -> ValidationResult:
    if not rendered_slides:
        return ValidationResult("fail", 0.0, "No rendered slides were available for validation.", ["missing_slides"])
    if any(not slide.get("pageImageExists") for slide in rendered_slides):
        return ValidationResult("fail", 0.0, "One or more source page images are missing for validation.", ["missing_page_image"])
    if any(not slide.get("highlightLabels") for slide in rendered_slides):
        return ValidationResult("fail", 0.0, "One or more rendered slides contains no highlight boxes.", ["missing_highlights"])
    return ValidationResult("review", 0.25, "Screenshots rendered successfully, but no vision model was configured. Manual review is still required.", ["validator_not_configured"])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--draft-json", required=True)
    parser.add_argument("--manifest-json", required=True)
    parser.add_argument("--images-dir", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--provider", default="auto")
    parser.add_argument("--model")
    parser.add_argument("--max-slides-per-reason", type=int, default=5)
    args = parser.parse_args()

    draft = json.loads(Path(args.draft_json).read_text())
    manifest = json.loads(Path(args.manifest_json).read_text())
    images_dir = Path(args.images_dir)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    validator = load_validator(args.provider, args.model)
    reason_lookup = build_reason_lookup(draft)
    report_reasons: List[Dict[str, object]] = []

    for bundle in manifest.get("reasons") or []:
        if not isinstance(bundle, dict):
            continue
        if bundle.get("status") != "ready" or not bundle.get("exportGrade"):
            continue
        reason_id = normalize_text(bundle.get("reasonId"))
        reason = reason_lookup.get(reason_id, {})
        rendered_slides: List[Dict[str, object]] = []
        for slide_index, slide in enumerate((bundle.get("slides") or [])[: max(args.max_slides_per_reason, 1)]):
            if not isinstance(slide, dict):
                continue
            page_number = int(slide.get("pageNumber") or 0)
            page_image_path = resolve_page_image(images_dir, page_number)
            slide_dir = output_dir / reason_id.replace("/", "_").replace(":", "_")
            full_page_output = slide_dir / f"slide-{slide_index + 1}-page.png"
            crop_output = slide_dir / f"slide-{slide_index + 1}-crop.png"
            if page_image_path.exists():
                draw_highlighted_slide(page_image_path, slide, full_page_output, crop_output)
            rendered_slides.append(
                {
                    "slideId": normalize_text(slide.get("id")) or f"slide-{slide_index + 1}",
                    "pageNumber": page_number,
                    "label": normalize_text(slide.get("label")),
                    "pageImageExists": page_image_path.exists(),
                    "cropImagePath": str(crop_output),
                    "fullPageImagePath": str(full_page_output),
                    "highlightLabels": [
                        normalize_text(box.get("label"))
                        for box in (slide.get("highlightBoxes") or [])
                        if isinstance(box, dict) and normalize_text(box.get("label"))
                    ],
                    "provenanceIds": [
                        normalize_text(box.get("provenanceId"))
                        for box in (slide.get("highlightBoxes") or [])
                        if isinstance(box, dict) and normalize_text(box.get("provenanceId"))
                    ],
                }
            )
        if validator and rendered_slides and all(slide.get("pageImageExists") for slide in rendered_slides):
            validation = validator.validate_reason(reason=reason, bundle=bundle, rendered_slides=rendered_slides)
        else:
            validation = safe_verdict(rendered_slides)
        report_reasons.append(
            {
                "reasonId": reason_id,
                "issueLabel": normalize_text(bundle.get("issueLabel")),
                "reasonSummary": normalize_text(bundle.get("reasonSummary")),
                "verdict": validation.verdict,
                "confidence": validation.confidence,
                "rationale": validation.rationale,
                "problems": validation.problems,
                "slides": rendered_slides,
            }
        )

    summary = {
        "reasonCount": len(report_reasons),
        "passCount": sum(1 for reason in report_reasons if reason["verdict"] == "pass"),
        "reviewCount": sum(1 for reason in report_reasons if reason["verdict"] == "review"),
        "failCount": sum(1 for reason in report_reasons if reason["verdict"] == "fail"),
        "validatorProvider": args.provider,
        "validatorModel": getattr(validator, "model_name", "") or args.model or os.getenv("HIGHLIGHT_VALIDATION_MODEL") or os.getenv("OLLAMA_VISION_MODEL") or "",
    }
    report = {"summary": summary, "reasons": report_reasons}
    report_path = output_dir / "highlight-validation-report.json"
    report_path.write_text(json.dumps(report, indent=2))
    print(json.dumps({"reportPath": str(report_path), "summary": summary}))


if __name__ == "__main__":
    main()
