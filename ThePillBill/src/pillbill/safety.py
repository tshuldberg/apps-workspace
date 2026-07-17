from __future__ import annotations

import re
from dataclasses import dataclass

from .models import MedicationInstruction, Regimen


FORBIDDEN_ABBREVIATIONS = {
    "u": "Use 'units' instead of 'U'.",
    "iu": "Use 'units' instead of 'IU'.",
    "qd": "Use 'daily' instead of 'qd'.",
    "qod": "Use 'every other day' instead of 'qod'.",
    "ms": "Write full medication name to avoid ambiguity.",
    "mso4": "Write 'morphine sulfate' in full.",
    "mgso4": "Write 'magnesium sulfate' in full.",
}

AMBIGUOUS_PHRASES = {
    "as directed",
    "as needed for pain"  # require indication + max/day for PRN in verified record
}

TRAILING_ZERO_RE = re.compile(r"\b\d+\.0\b")
NO_LEADING_ZERO_RE = re.compile(r"(?<!\d)\.\d")
DOSING_NUMBER_RE = re.compile(r"\b\d+(?:\.\d+)?\s*(mg|mcg|g|ml|units?|tablet|capsule|puff|drop)\b", re.IGNORECASE)


@dataclass
class ValidationIssue:
    severity: str
    field: str
    message: str
    medication_id: str | None = None


def find_text_issues(text: str) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    words = re.findall(r"[A-Za-z0-9\.]+", text)
    for raw in words:
        token = raw.lower().strip(".")
        if token in FORBIDDEN_ABBREVIATIONS:
            issues.append(
                ValidationIssue(
                    severity="error",
                    field="instruction",
                    message=FORBIDDEN_ABBREVIATIONS[token],
                )
            )
    if TRAILING_ZERO_RE.search(text):
        issues.append(
            ValidationIssue(
                severity="error",
                field="instruction",
                message="Trailing zero detected (e.g., 1.0 mg). Use whole number.",
            )
        )
    if NO_LEADING_ZERO_RE.search(text):
        issues.append(
            ValidationIssue(
                severity="error",
                field="instruction",
                message="Missing leading zero detected (e.g., .5 mg). Use 0.5 mg.",
            )
        )
    return issues


def validate_medication(med: MedicationInstruction) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []

    text = " ".join(
        part for part in [med.name, med.dose, med.route, med.frequency, med.notes or ""] if part
    )
    for issue in find_text_issues(text):
        issue.medication_id = med.medication_id
        issues.append(issue)

    if not DOSING_NUMBER_RE.search(med.dose):
        issues.append(
            ValidationIssue(
                severity="error",
                field="dose",
                message="Dose must include an explicit amount and unit.",
                medication_id=med.medication_id,
            )
        )

    if (not med.times) and ("every" not in med.frequency.lower()) and (not med.is_prn):
        issues.append(
            ValidationIssue(
                severity="error",
                field="times",
                message="Medication needs explicit times or an every-X-hours frequency.",
                medication_id=med.medication_id,
            )
        )

    freq_lower = med.frequency.lower()
    for phrase in AMBIGUOUS_PHRASES:
        if phrase in freq_lower and not med.is_prn:
            issues.append(
                ValidationIssue(
                    severity="error",
                    field="frequency",
                    message="Ambiguous frequency. Use explicit timing language.",
                    medication_id=med.medication_id,
                )
            )

    if med.is_prn and not med.max_daily_dose:
        issues.append(
            ValidationIssue(
                severity="error",
                field="max_daily_dose",
                message="PRN medications must include a maximum daily dose.",
                medication_id=med.medication_id,
            )
        )

    if med.source is None:
        issues.append(
            ValidationIssue(
                severity="error",
                field="source",
                message="Each medication must include source citation metadata.",
                medication_id=med.medication_id,
            )
        )
    else:
        quote = med.source.quote
        if med.dose.lower() not in quote.lower():
            issues.append(
                ValidationIssue(
                    severity="error",
                    field="source.quote",
                    message="Source quote must contain exact dose text.",
                    medication_id=med.medication_id,
                )
            )

    if not med.manually_verified:
        issues.append(
            ValidationIssue(
                severity="error",
                field="manually_verified",
                message="Medication has not been manually verified against source documents.",
                medication_id=med.medication_id,
            )
        )

    return issues


def validate_regimen_for_verification(regimen: Regimen, current_docs_hash: str) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    if regimen.source_hash != current_docs_hash:
        issues.append(
            ValidationIssue(
                severity="error",
                field="source_hash",
                message="Source documents changed after extraction. Re-run extraction before verifying.",
            )
        )

    if not regimen.medications:
        issues.append(
            ValidationIssue(
                severity="error",
                field="medications",
                message="No medications found in draft regimen.",
            )
        )

    seen_ids: set[str] = set()
    for med in regimen.medications:
        if med.medication_id in seen_ids:
            issues.append(
                ValidationIssue(
                    severity="error",
                    field="medication_id",
                    message="Duplicate medication_id detected.",
                    medication_id=med.medication_id,
                )
            )
        seen_ids.add(med.medication_id)
        issues.extend(validate_medication(med))

    return issues
