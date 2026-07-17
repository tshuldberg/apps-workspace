from pillbill.models import MedicationInstruction, Regimen, SourceCitation
from pillbill.safety import validate_regimen_for_verification


def _med(**overrides):
    base = MedicationInstruction(
        medication_id="med-001",
        name="Acetaminophen",
        dose="500 mg",
        route="by mouth",
        frequency="every 6 hours",
        times=[],
        is_prn=False,
        indication="Pain",
        max_daily_dose=None,
        source=SourceCitation(file="a.txt", quote="Take 500 mg by mouth every 6 hours", line=1),
        manually_verified=True,
        verified_by="tester",
    )
    for key, value in overrides.items():
        setattr(base, key, value)
    return base


def test_finalize_fails_when_not_manually_verified():
    regimen = Regimen(
        patient_id="p1",
        timezone="America/Los_Angeles",
        source_hash="hash1",
        source_files=["a.txt"],
        status="draft",
        medications=[_med(manually_verified=False)],
    )

    issues = validate_regimen_for_verification(regimen, "hash1")
    assert any(i.field == "manually_verified" for i in issues)


def test_finalize_fails_on_source_hash_mismatch():
    regimen = Regimen(
        patient_id="p1",
        timezone="America/Los_Angeles",
        source_hash="hash1",
        source_files=["a.txt"],
        status="draft",
        medications=[_med()],
    )

    issues = validate_regimen_for_verification(regimen, "hash2")
    assert any(i.field == "source_hash" for i in issues)
