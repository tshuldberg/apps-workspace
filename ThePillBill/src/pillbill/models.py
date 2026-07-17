from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class SourceCitation:
    file: str
    quote: str
    page: int | None = None
    line: int | None = None


@dataclass
class MedicationInstruction:
    medication_id: str
    name: str
    dose: str
    route: str
    frequency: str
    times: list[str]
    is_prn: bool = False
    indication: str | None = None
    max_daily_dose: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    notes: str | None = None
    source: SourceCitation | None = None
    confidence: float | None = None
    manually_verified: bool = False
    verified_by: str | None = None
    verified_at: str | None = None


@dataclass
class Regimen:
    patient_id: str
    timezone: str
    source_hash: str
    source_files: list[str]
    status: str
    medications: list[MedicationInstruction] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    verified_at: str | None = None
    verified_by: str | None = None


@dataclass
class PatientConfig:
    patient_id: str
    timezone: str = "America/Los_Angeles"
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


@dataclass
class ScheduleDose:
    medication_id: str
    medication_name: str
    dose: str
    route: str
    instruction: str
    is_prn: bool
    indication: str | None
    max_daily_dose: str | None
    notes: str | None


@dataclass
class DailySchedule:
    patient_id: str
    date: str
    timezone: str
    slots: dict[str, list[ScheduleDose]]
    prn_only: list[ScheduleDose]


@dataclass
class WeeklySchedule:
    patient_id: str
    start_date: str
    timezone: str
    days: list[DailySchedule]


def regimen_from_dict(data: dict[str, Any]) -> Regimen:
    meds: list[MedicationInstruction] = []
    for m in data.get("medications", []):
        source_data = m.get("source")
        source = SourceCitation(**source_data) if source_data else None
        meds.append(
            MedicationInstruction(
                medication_id=m["medication_id"],
                name=m["name"],
                dose=m["dose"],
                route=m["route"],
                frequency=m["frequency"],
                times=list(m.get("times", [])),
                is_prn=bool(m.get("is_prn", False)),
                indication=m.get("indication"),
                max_daily_dose=m.get("max_daily_dose"),
                start_date=m.get("start_date"),
                end_date=m.get("end_date"),
                notes=m.get("notes"),
                source=source,
                confidence=m.get("confidence"),
                manually_verified=bool(m.get("manually_verified", False)),
                verified_by=m.get("verified_by"),
                verified_at=m.get("verified_at"),
            )
        )
    return Regimen(
        patient_id=data["patient_id"],
        timezone=data["timezone"],
        source_hash=data["source_hash"],
        source_files=list(data.get("source_files", [])),
        status=data["status"],
        medications=meds,
        created_at=data.get("created_at", datetime.now(timezone.utc).isoformat()),
        verified_at=data.get("verified_at"),
        verified_by=data.get("verified_by"),
    )


def regimen_to_dict(regimen: Regimen) -> dict[str, Any]:
    return asdict(regimen)
