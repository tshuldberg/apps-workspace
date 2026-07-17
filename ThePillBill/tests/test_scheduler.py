from datetime import date

from pillbill.models import MedicationInstruction, Regimen, SourceCitation
from pillbill.scheduler import build_daily_schedule, render_daily_markdown


def test_schedule_infers_twice_daily_slots():
    regimen = Regimen(
        patient_id="p1",
        timezone="America/Los_Angeles",
        source_hash="h",
        source_files=["a.txt"],
        status="verified",
        medications=[
            MedicationInstruction(
                medication_id="med-1",
                name="Topiramate",
                dose="75 mg",
                route="by mouth",
                frequency="twice daily",
                times=[],
                source=SourceCitation(file="a.txt", quote="Take 75 mg by mouth 2 times a day", line=1),
                manually_verified=True,
                verified_by="tester",
            )
        ],
    )

    daily = build_daily_schedule(regimen, date(2026, 2, 12))
    assert "08:00" in daily.slots
    assert "18:00" in daily.slots


def test_daily_markdown_includes_prn_max_daily_dose():
    regimen = Regimen(
        patient_id="p1",
        timezone="America/Los_Angeles",
        source_hash="h",
        source_files=["a.txt"],
        status="verified",
        medications=[
            MedicationInstruction(
                medication_id="med-2",
                name="Rizatriptan",
                dose="10 mg",
                route="by mouth",
                frequency="as needed",
                times=[],
                is_prn=True,
                indication="Migraine",
                max_daily_dose="30 mg in 24 hours",
                source=SourceCitation(
                    file="a.txt",
                    quote="Take 10 mg once as needed. Do not exceed 30 mg in 24 hours.",
                    line=1,
                ),
                manually_verified=True,
                verified_by="tester",
            )
        ],
    )

    daily = build_daily_schedule(regimen, date(2026, 2, 12))
    markdown = render_daily_markdown(daily)
    assert "Max in 24h: 30 mg in 24 hours" in markdown
