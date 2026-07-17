from pathlib import Path

from pillbill.extractors import extract_draft_regimen


def test_extracts_take_lines_and_shorthand(tmp_path: Path):
    source = tmp_path / "regimen.txt"
    source.write_text(
        """
Wellbutrin - Take 1 tablet (300 mg total) by mouth every morning.
Tylenol every 6 hours BID
promethazine (PHENERGAN) Take 1 tablet (25 mg total) by mouth at bedtime as needed (Migraine).
""".strip()
        + "\n",
        encoding="utf-8",
    )

    regimen = extract_draft_regimen(
        patient_id="p1",
        timezone="America/Los_Angeles",
        source_hash="abc",
        docs=[source],
    )

    names = [m.name for m in regimen.medications]
    assert "Wellbutrin" in names
    assert "Tylenol" in names
    assert "promethazine (PHENERGAN)" in names
