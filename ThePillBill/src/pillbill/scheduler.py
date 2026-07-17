from __future__ import annotations

from dataclasses import asdict
from datetime import date, datetime, time, timedelta
import re

from .models import DailySchedule, MedicationInstruction, Regimen, ScheduleDose, WeeklySchedule


UMS_DEFAULT_TIMES = {
    "morning": "08:00",
    "noon": "12:00",
    "evening": "18:00",
    "bedtime": "22:00",
}

SLOT_LABELS = {
    "08:00": "Morning",
    "12:00": "Noon",
    "18:00": "Evening",
    "22:00": "Bedtime",
}

TIME_RE = re.compile(r"\b([01]?\d|2[0-3]):([0-5]\d)\b")
EVERY_HOURS_RE = re.compile(r"every\s+(\d+)\s*hours?", re.IGNORECASE)


def parse_date(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def _is_med_active(med: MedicationInstruction, on_date: date) -> bool:
    if med.start_date:
        if on_date < parse_date(med.start_date):
            return False
    if med.end_date:
        if on_date > parse_date(med.end_date):
            return False
    return True


def _normalize_time(value: str) -> str:
    t = datetime.strptime(value, "%H:%M").time()
    return t.strftime("%H:%M")


def _infer_times_from_frequency(frequency: str) -> list[str]:
    f = frequency.lower()

    explicit = [f"{m.group(1).zfill(2)}:{m.group(2)}" for m in TIME_RE.finditer(f)]
    if explicit:
        return sorted(set(explicit))

    if "bedtime" in f:
        return [UMS_DEFAULT_TIMES["bedtime"]]
    if "morning" in f and "evening" not in f:
        return [UMS_DEFAULT_TIMES["morning"]]
    if "noon" in f:
        return [UMS_DEFAULT_TIMES["noon"]]
    if "evening" in f and "morning" not in f:
        return [UMS_DEFAULT_TIMES["evening"]]

    if "twice daily" in f or "2 times daily" in f or "two times daily" in f:
        return [UMS_DEFAULT_TIMES["morning"], UMS_DEFAULT_TIMES["evening"]]
    if "three times daily" in f or "3 times daily" in f:
        return [
            UMS_DEFAULT_TIMES["morning"],
            UMS_DEFAULT_TIMES["noon"],
            UMS_DEFAULT_TIMES["evening"],
        ]
    if "four times daily" in f or "4 times daily" in f:
        return [
            UMS_DEFAULT_TIMES["morning"],
            UMS_DEFAULT_TIMES["noon"],
            UMS_DEFAULT_TIMES["evening"],
            UMS_DEFAULT_TIMES["bedtime"],
        ]
    if "once daily" in f or "daily" in f:
        return [UMS_DEFAULT_TIMES["morning"]]

    match = EVERY_HOURS_RE.search(f)
    if match:
        interval = int(match.group(1))
        if interval <= 0 or interval > 24:
            return []
        start = datetime.combine(date.today(), time(hour=6))
        values: list[str] = []
        current = start
        while current.date() == start.date():
            values.append(current.strftime("%H:%M"))
            current += timedelta(hours=interval)
            if len(values) > 24:
                break
        return values

    return []


def resolve_times(med: MedicationInstruction) -> list[str]:
    raw_times = med.times or []
    if raw_times:
        normalized: list[str] = []
        for raw in raw_times:
            normalized.append(_normalize_time(raw))
        return sorted(set(normalized))
    return _infer_times_from_frequency(med.frequency)


def build_daily_schedule(regimen: Regimen, on_date: date) -> DailySchedule:
    slots: dict[str, list[ScheduleDose]] = {}
    prn_only: list[ScheduleDose] = []

    for med in regimen.medications:
        if not _is_med_active(med, on_date):
            continue
        dose = ScheduleDose(
            medication_id=med.medication_id,
            medication_name=med.name,
            dose=med.dose,
            route=med.route,
            instruction=f"{med.dose} {med.route}".strip(),
            is_prn=med.is_prn,
            indication=med.indication,
            max_daily_dose=med.max_daily_dose,
            notes=med.notes,
        )
        times = resolve_times(med)
        if med.is_prn and not times:
            prn_only.append(dose)
            continue

        for t in times:
            slots.setdefault(t, []).append(dose)

    for t in slots:
        slots[t].sort(key=lambda d: d.medication_name.lower())
    prn_only.sort(key=lambda d: d.medication_name.lower())

    return DailySchedule(
        patient_id=regimen.patient_id,
        date=on_date.isoformat(),
        timezone=regimen.timezone,
        slots=dict(sorted(slots.items(), key=lambda item: item[0])),
        prn_only=prn_only,
    )


def build_weekly_schedule(regimen: Regimen, start_date: date) -> WeeklySchedule:
    days: list[DailySchedule] = []
    for i in range(7):
        day = start_date + timedelta(days=i)
        days.append(build_daily_schedule(regimen, day))
    return WeeklySchedule(
        patient_id=regimen.patient_id,
        start_date=start_date.isoformat(),
        timezone=regimen.timezone,
        days=days,
    )


def render_daily_markdown(daily: DailySchedule) -> str:
    lines: list[str] = []
    lines.append(f"# Daily Medication Schedule: {daily.date}")
    lines.append("")
    lines.append(f"Timezone: {daily.timezone}")
    lines.append("")

    if not daily.slots:
        lines.append("No scheduled doses for this date.")
    else:
        for t, doses in daily.slots.items():
            label = SLOT_LABELS.get(t, "Scheduled")
            lines.append(f"## {label} ({t})")
            lines.append("")
            for d in doses:
                prn_tag = " (PRN)" if d.is_prn else ""
                reason = f"; Purpose: {d.indication}" if d.indication else ""
                max_daily = f"; Max in 24h: {d.max_daily_dose}" if d.max_daily_dose else ""
                notes = f"; Notes: {d.notes}" if d.notes else ""
                lines.append(
                    f"- [ ] {d.medication_name}{prn_tag} - {d.instruction}{reason}{max_daily}{notes}"
                )
            lines.append("")

    if daily.prn_only:
        lines.append("## As Needed (PRN)")
        lines.append("")
        for d in daily.prn_only:
            reason = f"; Purpose: {d.indication}" if d.indication else ""
            max_daily = f"; Max in 24h: {d.max_daily_dose}" if d.max_daily_dose else ""
            notes = f"; Notes: {d.notes}" if d.notes else ""
            lines.append(f"- [ ] {d.medication_name} - {d.instruction}{reason}{max_daily}{notes}")
        lines.append("")

    lines.append("## Safety Check")
    lines.append("")
    lines.append("- Verify each dose against the discharge packet before administering.")
    lines.append("- If any line differs from discharge instructions, do not use this schedule.")

    return "\n".join(lines).strip() + "\n"


def _cell_for_time(day: DailySchedule, t: str) -> str:
    meds = day.slots.get(t, [])
    if not meds:
        return "-"
    entries = [f"{m.medication_name} ({m.dose})" for m in meds]
    return "<br>".join(entries)


def render_weekly_markdown(weekly: WeeklySchedule) -> str:
    all_times: list[str] = sorted({t for d in weekly.days for t in d.slots.keys()})
    if not all_times:
        all_times = [
            UMS_DEFAULT_TIMES["morning"],
            UMS_DEFAULT_TIMES["noon"],
            UMS_DEFAULT_TIMES["evening"],
            UMS_DEFAULT_TIMES["bedtime"],
        ]

    lines: list[str] = []
    lines.append("# Weekly Medication Schedule (By Time)")
    lines.append("")
    lines.append(f"Start Date: {weekly.start_date}")
    lines.append(f"Timezone: {weekly.timezone}")
    lines.append("")

    headers = ["Time"] + [datetime.strptime(d.date, "%Y-%m-%d").strftime("%a %m/%d") for d in weekly.days]
    lines.append("| " + " | ".join(headers) + " |")
    lines.append("| " + " | ".join(["---"] * len(headers)) + " |")

    for t in all_times:
        row = [t]
        for d in weekly.days:
            row.append(_cell_for_time(d, t))
        lines.append("| " + " | ".join(row) + " |")

    prn_any = any(day.prn_only for day in weekly.days)
    if prn_any:
        lines.append("")
        lines.append("## PRN Medications")
        lines.append("")
        for day in weekly.days:
            if not day.prn_only:
                continue
            label = datetime.strptime(day.date, "%Y-%m-%d").strftime("%a %m/%d")
            lines.append(f"### {label}")
            lines.append("")
            for dose in day.prn_only:
                reason = f"; Purpose: {dose.indication}" if dose.indication else ""
                max_daily = f"; Max in 24h: {dose.max_daily_dose}" if dose.max_daily_dose else ""
                notes = f"; Notes: {dose.notes}" if dose.notes else ""
                lines.append(f"- {dose.medication_name} - {dose.instruction}{reason}{max_daily}{notes}")
            lines.append("")

    lines.append("## Safety Check")
    lines.append("")
    lines.append("- Use explicit times and avoid abbreviation-only instructions.")
    lines.append("- Confirm PRN maximum daily dose before administration.")

    return "\n".join(lines).strip() + "\n"


def daily_to_dict(daily: DailySchedule) -> dict:
    return {
        "patient_id": daily.patient_id,
        "date": daily.date,
        "timezone": daily.timezone,
        "slots": {
            t: [asdict(d) for d in doses]
            for t, doses in daily.slots.items()
        },
        "prn_only": [asdict(d) for d in daily.prn_only],
    }


def weekly_to_dict(weekly: WeeklySchedule) -> dict:
    return {
        "patient_id": weekly.patient_id,
        "start_date": weekly.start_date,
        "timezone": weekly.timezone,
        "days": [daily_to_dict(day) for day in weekly.days],
    }
