# ThePillBill

Verification-first post-op medication scheduler for discharge packets.

## What this does
- Ingests uploaded discharge/regimen documents (`.docx`, `.pdf`, `.txt`).
- Extracts a **draft** medication regimen with source citations.
- Requires manual per-medication verification before finalizing.
- Generates:
  - daily schedule (clear administration blocks),
  - weekly by-time schedule table.
- Sends daily regimen email from macOS Mail.app.

## Safety model
- No finalize/email until each medication entry is manually verified.
- Validation blocks unsafe notation and incomplete dosing fields.
- PRN items require explicit max daily dose.

## Install
```bash
cd /Users/trey/Desktop/Apps/ThePillBill
python3 -m pip install --upgrade pip
python3 -m pip install -e '.[dev,pdf]'
```

If you prefer local vendoring instead of editable install:
```bash
python3 -m pip install --target .vendor pypdf pytest
```
Then run commands with:
```bash
PYTHONPATH=.vendor:src python3 -m pillbill.cli ...
```

## CLI workflow
Use the wrapper to avoid repeating `PYTHONPATH` every time:
```bash
cd /Users/trey/Desktop/Apps/ThePillBill
./scripts/pb --help
```

### 1) Initialize patient workspace
```bash
./scripts/pb init-patient --patient-id patient-001 --timezone America/Los_Angeles
```

### 2) Upload source files
```bash
./scripts/pb upload --patient-id patient-001 --files '/Users/trey/Downloads/download (1).pdf' '/Users/trey/Downloads/Regimen.docx'
```

### 3) Extract draft regimen
Default behavior prefers `.docx` files (higher-fidelity initial extraction).
```bash
./scripts/pb extract --patient-id patient-001
```

To force all uploaded formats:
```bash
./scripts/pb extract --patient-id patient-001 --include-all-formats
```

### 4) Review extracted medications
```bash
./scripts/pb review --patient-id patient-001
```

### 5) Mark medications as manually verified (and optionally correct fields)
```bash
./scripts/verify_one patient-001 med-001 'Trey'
```

Example with correction before verify:
```bash
./scripts/verify_one patient-001 med-003 'Trey' \
  --dose '5 mg' \
  --route 'by mouth' \
  --source-quote 'oxyCODONE ... Take 1 tablet (5 mg total) by mouth every 4 hours as needed for pain.'
```

Generate a single script for all medications (recommended):
```bash
./scripts/pb generate-verify-script --patient-id patient-001 --verified-by Trey --include-finalize
./scripts/verify_all_patient-001.sh
```
This script is prefilled and includes `TODO_*` markers only where source data is incomplete.
`mark-verified` refuses unresolved `TODO_*` placeholders, so you cannot accidentally verify incomplete values.

### 6) Finalize verified regimen
```bash
./scripts/pb finalize --patient-id patient-001 --verified-by 'Trey'
```

### 7) Generate daily + weekly schedules
```bash
./scripts/pb generate --patient-id patient-001 --date 2026-02-12
```

### 8) Send daily email (after finalize)
```bash
./scripts/pb send-email --patient-id patient-001 --to you@example.com --date 2026-02-12
```

Dry run:
```bash
./scripts/pb send-email --patient-id patient-001 --to you@example.com --date 2026-02-12 --dry-run
```

### Automation-friendly command
```bash
./scripts/pb automation-daily --patient-id patient-001 --to you@example.com
```

Wrapper script for Codex automation:
```bash
/Users/trey/Desktop/Apps/ThePillBill/scripts/automation_daily.sh patient-001 you@example.com
```

## Output paths
- Patient data: `/Users/trey/Desktop/Apps/ThePillBill/data/patients/<patient-id>/`
- Draft regimen: `regimen_draft.json`
- Verified regimen: `regimen_verified.json`
- Generated schedules: `output/daily-YYYY-MM-DD.*`, `output/weekly-YYYY-MM-DD.*`

## Email transport
The project sends mail through local Mail.app using AppleScript (same app-level mechanism used by `macos-hub` mail bridge tooling).

## Scheduler format research
See: `/Users/trey/Desktop/Apps/ThePillBill/docs/schedule-format-research.md`

## Tests
```bash
PYTHONPATH=.vendor:src python3 -m pytest -q
```
