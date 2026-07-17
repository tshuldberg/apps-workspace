from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re
import subprocess
import sys
import tempfile
from xml.etree import ElementTree as ET
from zipfile import ZipFile

from .models import MedicationInstruction, Regimen, SourceCitation


DOSE_RE = re.compile(
    r"\b\d+(?:\.\d+)?\s*(mg|mcg|g|ml|mL|units?|tablet(?:s)?|capsule(?:s)?|puff(?:s)?|drop(?:s)?)\b",
    re.IGNORECASE,
)
PAREN_DOSE_RE = re.compile(
    r"\(([^)]*?\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|mL|units?)\b[^)]*)\)",
    re.IGNORECASE,
)
TIME_RE = re.compile(r"\b([01]?\d|2[0-3]):([0-5]\d)\b")
EVERY_HOURS_RE = re.compile(r"every\s+(\d+)\s*(?:\([^)]+\)\s*)?hours?", re.IGNORECASE)
N_TIMES_RE = re.compile(r"\b([2-4])\s*(?:\([^)]+\)\s*)?times?\s+a\s+day\b", re.IGNORECASE)
HEADER_RE = re.compile(
    r"^(?P<name>[A-Za-z][A-Za-z0-9\-()/'\. ]+?)\s+\d+(?:\.\d+)?\s*(mg|mcg|g|ml|mL)\b",
    re.IGNORECASE,
)
NAME_TAKE_RE = re.compile(r"^(?P<name>.+?)\s*[\-–]?\s*take\b", re.IGNORECASE)
SHORTHAND_FREQ_RE = re.compile(
    r"^(?P<name>[A-Za-z][A-Za-z0-9\-/() ]{1,60})\s+every\s+(?P<hours>\d+)\s*hours?\b.*$",
    re.IGNORECASE,
)
MAX_DAILY_RE = re.compile(r"do not exceed\s+([^\.]+)", re.IGNORECASE)

NOISE_PHRASES = {
    "walk at least",
    "eat yogurt",
    "if unable to meet this goal",
    "morning afternoon evening bedtime as needed",
    "each morning",
    "each evening",
    "headache management",
}

BAD_NAMES = {
    "take",
    "each morning",
    "each evening",
    "morning",
    "evening",
    "days",
    "mouth daily",
}


@dataclass
class LineRef:
    file: str
    page: int | None
    line: int
    text: str


def _ensure_vendor_path() -> None:
    vendor = Path(__file__).resolve().parents[2] / ".vendor"
    if vendor.exists():
        vendor_str = str(vendor)
        if vendor_str not in sys.path:
            sys.path.insert(0, vendor_str)


def _extract_pdf(path: Path) -> list[LineRef]:
    try:
        _ensure_vendor_path()
        from pypdf import PdfReader  # type: ignore

        refs: list[LineRef] = []
        reader = PdfReader(str(path))
        for page_index, page in enumerate(reader.pages, start=1):
            content = page.extract_text() or ""
            for line_no, line in enumerate(content.splitlines(), start=1):
                cleaned = line.strip()
                if cleaned:
                    refs.append(LineRef(file=path.name, page=page_index, line=line_no, text=cleaned))
        return refs
    except Exception:
        with tempfile.NamedTemporaryFile(prefix="pillbill_pdf_", suffix=".txt", delete=False) as tmp:
            tmp_path = Path(tmp.name)
        try:
            completed = subprocess.run(
                ["pdftotext", "-layout", str(path), str(tmp_path)],
                capture_output=True,
                text=True,
            )
            if completed.returncode != 0:
                raise RuntimeError(
                    "PDF extraction failed. Install pypdf (pip install '.[pdf]') "
                    "or poppler pdftotext."
                )
            text = tmp_path.read_text(encoding="utf-8", errors="ignore")
            refs: list[LineRef] = []
            for line_no, line in enumerate(text.splitlines(), start=1):
                cleaned = line.strip()
                if cleaned:
                    refs.append(LineRef(file=path.name, page=None, line=line_no, text=cleaned))
            return refs
        finally:
            if tmp_path.exists():
                tmp_path.unlink()


def _extract_text(path: Path) -> list[LineRef]:
    refs: list[LineRef] = []
    content = path.read_text(encoding="utf-8", errors="ignore")
    for line_no, line in enumerate(content.splitlines(), start=1):
        cleaned = line.strip()
        if cleaned:
            refs.append(LineRef(file=path.name, page=None, line=line_no, text=cleaned))
    return refs


def _extract_docx(path: Path) -> list[LineRef]:
    refs: list[LineRef] = []
    ns = {
        "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    }
    with ZipFile(path) as zf:
        xml = zf.read("word/document.xml")
    root = ET.fromstring(xml)
    paragraphs = root.findall(".//w:p", ns)
    for idx, para in enumerate(paragraphs, start=1):
        parts: list[str] = []
        for t in para.findall(".//w:t", ns):
            parts.append(t.text or "")
        line = "".join(parts).strip()
        if line:
            refs.append(LineRef(file=path.name, page=None, line=idx, text=line))
    return refs


def extract_lines(paths: list[Path]) -> list[LineRef]:
    refs: list[LineRef] = []
    for path in paths:
        suffix = path.suffix.lower()
        if suffix == ".pdf":
            refs.extend(_extract_pdf(path))
        elif suffix == ".docx":
            refs.extend(_extract_docx(path))
        elif suffix in {".txt", ".md", ".csv", ".rtf"}:
            refs.extend(_extract_text(path))
        else:
            refs.extend(_extract_text(path))
    return refs


def _clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _is_noise_line(text: str) -> bool:
    lower = text.lower()
    return any(phrase in lower for phrase in NOISE_PHRASES)


def _looks_like_header(text: str) -> bool:
    if text.lower().startswith("take "):
        return False
    return HEADER_RE.search(text) is not None


def _normalize_name(name: str) -> str:
    cleaned = _clean_text(name)
    cleaned = cleaned.strip("-–:., ")
    cleaned = re.sub(r"\s+", " ", cleaned)
    if len(cleaned.split()) > 8:
        cleaned = " ".join(cleaned.split()[:8])
    return cleaned


def _guess_route(line: str) -> str:
    l = line.lower()
    if "by mouth" in l or "oral" in l or "orally" in l:
        return "by mouth"
    if "inhal" in l:
        return "by inhalation"
    if "topical" in l or "apply" in l:
        return "topically"
    if "inject" in l or "subcutaneous" in l or "intravenous" in l:
        return "by injection"
    if "rectal" in l:
        return "rectally"
    return "route not specified"


def _guess_frequency(line: str) -> str:
    l = line.lower()

    every_match = EVERY_HOURS_RE.search(l)
    if every_match:
        return f"every {every_match.group(1)} hours"

    ntimes = N_TIMES_RE.search(l)
    if ntimes:
        num = int(ntimes.group(1))
        if num == 2:
            return "twice daily"
        if num == 3:
            return "three times daily"
        if num == 4:
            return "four times daily"

    if "at bedtime" in l:
        return "at bedtime"
    if "every morning" in l:
        return "every morning"
    if "every evening" in l:
        return "every evening"
    if "once daily" in l or "daily" in l:
        return "daily"
    if "as needed" in l or "prn" in l:
        return "as needed"
    if "until gone" in l:
        return "until gone"
    return "frequency not specified"


def _guess_times(line: str, frequency: str) -> list[str]:
    times = [f"{m.group(1).zfill(2)}:{m.group(2)}" for m in TIME_RE.finditer(line)]
    l = line.lower()
    if "morning" in l:
        times.append("08:00")
    if "noon" in l:
        times.append("12:00")
    if "evening" in l:
        times.append("18:00")
    if "bedtime" in l or "at night" in l:
        times.append("22:00")

    f = frequency.lower()
    if f == "twice daily":
        times.extend(["08:00", "18:00"])
    elif f == "three times daily":
        times.extend(["08:00", "12:00", "18:00"])
    elif f == "four times daily":
        times.extend(["08:00", "12:00", "18:00", "22:00"])
    elif f == "daily":
        times.append("08:00")

    return sorted(set(times))


def _guess_indication(line: str) -> str | None:
    l = line.lower()
    if "pain" in l:
        return "Pain"
    if "migraine" in l:
        return "Migraine"
    if "sleep" in l:
        return "Sleep"
    if "nausea" in l:
        return "Nausea"
    if "constipation" in l:
        return "Constipation"
    if "infection" in l:
        return "Infection"
    return None


def _extract_dose(line: str) -> str | None:
    paren = PAREN_DOSE_RE.search(line)
    if paren:
        value = _clean_text(paren.group(1))
        if value:
            return value
    dose = DOSE_RE.search(line)
    if dose:
        return _clean_text(dose.group(0))
    return None


def _sanitize_source_text(line: str) -> str:
    cleaned = line
    cleaned = re.sub(r"Last Dose Time:\s*.*?(?=Take\b)", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"Signed by:\s*.*$", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"Commonly known as:\s*.*$", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"Generic drug:\s*.*$", "", cleaned, flags=re.IGNORECASE)
    return _clean_text(cleaned)


def _split_multi_med_line(line: str) -> list[str]:
    chunks = re.split(
        r"(?<=\.)\s+(?=[A-Za-z][A-Za-z0-9()\-/'\. ]{1,70}\s*[\-–]?\s*Take\b)",
        line,
    )
    out = [_clean_text(chunk) for chunk in chunks if _clean_text(chunk)]
    return out or [line]


def _extract_max_daily(line: str) -> str | None:
    m = MAX_DAILY_RE.search(line)
    if not m:
        return None
    return _clean_text(m.group(1))


def _score_candidate(name: str, dose: str | None, frequency: str, source_text: str) -> float:
    score = 0.3
    if name and name.lower() not in BAD_NAMES:
        score += 0.25
    if dose:
        score += 0.25
    if frequency != "frequency not specified":
        score += 0.15
    if "take" in source_text.lower():
        score += 0.05
    return round(min(score, 0.98), 2)


def _build_medication(
    *,
    med_index: int,
    name: str,
    source_text: str,
    source_ref: LineRef,
) -> MedicationInstruction | None:
    clean_name = _normalize_name(name)
    if not clean_name:
        return None

    if clean_name.lower() in BAD_NAMES:
        return None

    lower_name = clean_name.lower()
    if lower_name.startswith("walk ") or lower_name.startswith("eat "):
        return None

    cleaned_source = _sanitize_source_text(source_text)

    frequency = _guess_frequency(cleaned_source)
    dose = _extract_dose(cleaned_source)

    if dose is None and frequency == "frequency not specified":
        return None

    is_prn = "as needed" in cleaned_source.lower() or "prn" in cleaned_source.lower()
    max_daily = _extract_max_daily(cleaned_source)
    if is_prn and not max_daily:
        max_daily = "required during verification"

    return MedicationInstruction(
        medication_id=f"med-{med_index:03d}",
        name=clean_name,
        dose=dose or "dose not specified",
        route=_guess_route(cleaned_source),
        frequency=frequency,
        times=_guess_times(cleaned_source, frequency),
        is_prn=is_prn,
        indication=_guess_indication(cleaned_source),
        max_daily_dose=max_daily,
        notes="Verify this line against the discharge packet before finalizing.",
        source=SourceCitation(
            file=source_ref.file,
            quote=cleaned_source,
            page=source_ref.page,
            line=source_ref.line,
        ),
        confidence=_score_candidate(clean_name, dose, frequency, cleaned_source),
    )


def _collect_header_instruction(refs: list[LineRef], index: int) -> str:
    head = _clean_text(refs[index].text)
    parts = [head]
    i = index + 1
    while i < len(refs):
        nxt = refs[i]
        line = _clean_text(nxt.text)
        if not line:
            break
        if nxt.file != refs[index].file:
            break
        if refs[index].page is not None and nxt.page != refs[index].page:
            break
        if _looks_like_header(line):
            break
        if _is_noise_line(line):
            break
        parts.append(line)
        if len(parts) >= 6:
            break
        i += 1
    return _clean_text(" ".join(parts))


def extract_draft_regimen(
    *,
    patient_id: str,
    timezone: str,
    source_hash: str,
    docs: list[Path],
) -> Regimen:
    refs = extract_lines(docs)

    candidates: list[MedicationInstruction] = []

    # Pass 1: lines that include medication name plus "Take ..." on one line.
    med_index = 1
    for ref in refs:
        raw_line = _clean_text(ref.text)
        if _is_noise_line(raw_line):
            continue
        for line in _split_multi_med_line(raw_line):
            if line.lower().startswith("take "):
                continue
            match = NAME_TAKE_RE.search(line)
            if not match:
                continue
            name = match.group("name")
            med = _build_medication(
                med_index=med_index,
                name=name,
                source_text=line,
                source_ref=ref,
            )
            if med is None:
                continue
            candidates.append(med)
            med_index += 1

        shorthand = SHORTHAND_FREQ_RE.match(raw_line)
        if shorthand:
            med = _build_medication(
                med_index=med_index,
                name=shorthand.group("name"),
                source_text=raw_line,
                source_ref=ref,
            )
            if med is not None:
                candidates.append(med)
                med_index += 1

    # Pass 2: structured "header + Take ..." sections commonly found in discharge PDFs.
    for i, ref in enumerate(refs):
        if not ref.file.lower().endswith(".pdf"):
            continue
        line = _clean_text(ref.text)
        if _is_noise_line(line):
            continue
        header = HEADER_RE.match(line)
        if not header:
            continue
        combined = _collect_header_instruction(refs, i)
        if "take" not in combined.lower():
            continue
        med = _build_medication(
            med_index=med_index,
            name=header.group("name"),
            source_text=combined,
            source_ref=ref,
        )
        if med is None:
            continue
        candidates.append(med)
        med_index += 1

    # De-duplicate by normalized clinical signature.
    dedup: dict[tuple[str, str, str, str], MedicationInstruction] = {}
    for med in candidates:
        key = (
            med.name.lower(),
            med.frequency.lower(),
            str(med.is_prn),
        )
        existing = dedup.get(key)
        if existing is None:
            dedup[key] = med
            continue
        existing_quality = 0.0
        candidate_quality = 0.0
        if existing.confidence:
            existing_quality += existing.confidence
        if med.confidence:
            candidate_quality += med.confidence
        if "last dose time" not in existing.source.quote.lower():
            existing_quality += 0.1
        if "last dose time" not in med.source.quote.lower():
            candidate_quality += 0.1
        if existing.source.file.lower().endswith(".docx"):
            existing_quality += 0.1
        if med.source.file.lower().endswith(".docx"):
            candidate_quality += 0.1
        if candidate_quality > existing_quality:
            dedup[key] = med

    meds = sorted(dedup.values(), key=lambda m: (m.name.lower(), m.dose.lower()))
    for idx, med in enumerate(meds, start=1):
        med.medication_id = f"med-{idx:03d}"

    return Regimen(
        patient_id=patient_id,
        timezone=timezone,
        source_hash=source_hash,
        source_files=[p.name for p in docs],
        status="draft",
        medications=meds,
    )
