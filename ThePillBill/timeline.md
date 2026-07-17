# Timeline

## 2026-02-12 - Project scaffold + first patient ingestion

- Created Python project scaffold (`pyproject.toml`, `src/pillbill`, `tests`).
- Implemented verification-first pipeline:
  - patient init,
  - document upload,
  - regimen draft extraction with source citations,
  - manual per-med verification,
  - finalize gate before schedule/email.
- Implemented schedule generation:
  - daily schedule markdown/json,
  - weekly by-time matrix markdown/json,
  - PRN section with max-in-24h field.
- Implemented Mail.app sender for morning schedule delivery.
- Added extraction support for `.docx`, `.pdf`, `.txt` with DOCX-preferred initial extraction mode.
- Added safety validations for ambiguous notation, missing dose metadata, missing citations, and missing manual verification.
- Added tests for extractors, safety gates, and scheduler rendering (`5 passed`).
- Ingested first patient documents:
  - `/Users/trey/Downloads/download (1).pdf`
  - `/Users/trey/Downloads/Regimen.docx`
- Generated first draft regimen at:
  - `/Users/trey/Desktop/Apps/ThePillBill/data/patients/patient-001/regimen_draft.json`

## 2026-02-12 - Bulk verification script generator

- Added CLI command `generate-verify-script` to output one shell script containing verification commands for every medication in a patient's draft regimen.
- Generated patient script:
  - `/Users/trey/Desktop/Apps/ThePillBill/scripts/verify_all_patient-001.sh`
- Added placeholder safety guard: `mark-verified` now rejects unresolved `TODO_*` values to prevent accidental incomplete verification updates.
