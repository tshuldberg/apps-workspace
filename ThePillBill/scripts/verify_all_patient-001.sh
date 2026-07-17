#!/usr/bin/env bash
set -euo pipefail

VERIFY_ONE="/Users/trey/Desktop/Apps/ThePillBill/scripts/verify_one"
PB="/Users/trey/Desktop/Apps/ThePillBill/scripts/pb"
if [ ! -x "$VERIFY_ONE" ]; then
  echo "Missing helper: $VERIFY_ONE" >&2
  exit 1
fi
if [ ! -x "$PB" ]; then
  echo "Missing helper: $PB" >&2
  exit 1
fi

# Patient: patient-001
# Verified by: Trey
# Review each command before running. TODO_* values must be replaced.

# med-001 - ascorbic acid with rose hips
/Users/trey/Desktop/Apps/ThePillBill/scripts/verify_one patient-001 med-001 Trey --name 'ascorbic acid with rose hips' --dose '500 mg' --route 'by mouth' --frequency daily --times 08:00 --notes 'Verify this line against the discharge packet before finalizing.' --source-file Regimen.docx --source-line 25 --source-quote 'ascorbic acid with rose hips – take 1 500 mg tablet by mouth daily.'

# med-002 - levETIRAcetam (Kepra)
# TODO: missing explicit times
/Users/trey/Desktop/Apps/ThePillBill/scripts/verify_one patient-001 med-002 Trey --name 'levETIRAcetam (Kepra)' --dose '500 mg total' --route 'by mouth' --frequency 'until gone' --times TODO_SET_TIMES_HH:MM --notes 'Verify this line against the discharge packet before finalizing.' --source-file Regimen.docx --source-line 29 --source-quote 'levETIRAcetam (Kepra) Take 1 tablet (500 mg total) by mouth until gone'

# med-003 - Oxy
/Users/trey/Desktop/Apps/ThePillBill/scripts/verify_one patient-001 med-003 Trey --name Oxy --dose '5 mg' --route 'by mouth' --frequency 'every 4 hours' --notes 'Verify this line against the discharge packet before finalizing.' --source-file Regimen.docx --source-line 57 --source-quote 'Oxy every 4 hours BID'

# med-004 - pantoprazole
/Users/trey/Desktop/Apps/ThePillBill/scripts/verify_one patient-001 med-004 Trey --name pantoprazole --dose '40 mg total' --route 'by mouth' --frequency daily --times 08:00 --notes 'Verify this line against the discharge packet before finalizing.' --source-file Regimen.docx --source-line 21 --source-quote 'pantoprazole Take 1 tablet (40 mg total) by mouth daily. Take 30 minutes before meal(s).'

# med-005 - promethazine (PHENERGAN)
# TODO: missing PRN max daily dose
/Users/trey/Desktop/Apps/ThePillBill/scripts/verify_one patient-001 med-005 Trey --name 'promethazine (PHENERGAN)' --dose '25 mg total' --route 'by mouth' --frequency 'at bedtime' --times 22:00 --is-prn --max-daily-dose TODO_SET_MAX_DAILY --indication Migraine --notes 'Verify this line against the discharge packet before finalizing.' --source-file Regimen.docx --source-line 61 --source-quote 'promethazine (PHENERGAN) Take 1 tablet (25 mg total) by mouth at bedtime as needed (Migraine).'

# med-006 - rizatriptan (MAXALT)
/Users/trey/Desktop/Apps/ThePillBill/scripts/verify_one patient-001 med-006 Trey --name 'rizatriptan (MAXALT)' --dose '10 mg total' --route 'by mouth' --frequency 'as needed' --is-prn --max-daily-dose '30 mg in 24 hours' --indication Migraine --notes 'Verify this line against the discharge packet before finalizing.' --source-file Regimen.docx --source-line 59 --source-quote 'rizatriptan (MAXALT) Take 1 disintegrating tablet (10 mg total) by mouth once as needed for migraine. May repeat in 2 hours if unresolved. Do not exceed 30 mg in 24 hours.'

# med-007 - topiramate (TOPAMAX)
/Users/trey/Desktop/Apps/ThePillBill/scripts/verify_one patient-001 med-007 Trey --name 'topiramate (TOPAMAX)' --dose '75 mg total' --route 'by mouth' --frequency 'twice daily' --times 08:00,18:00 --notes 'Verify this line against the discharge packet before finalizing.' --source-file Regimen.docx --source-line 31 --source-quote 'topiramate (TOPAMAX) Take 1.5 tablets (75 mg total) by mouth 2 (two) times a day.'

# med-008 - traZODone
# TODO: missing PRN max daily dose
/Users/trey/Desktop/Apps/ThePillBill/scripts/verify_one patient-001 med-008 Trey --name traZODone --dose '50 mg total' --route 'by mouth' --frequency 'at bedtime' --times 22:00 --is-prn --max-daily-dose TODO_SET_MAX_DAILY --indication Sleep --notes 'Verify this line against the discharge packet before finalizing.' --source-file Regimen.docx --source-line 64 --source-quote 'traZODone Take 1 tablet (50 mg total) by mouth daily at bedtime as needed (sleep aid).'

# med-009 - Tylenol
# TODO: missing dose, missing route
/Users/trey/Desktop/Apps/ThePillBill/scripts/verify_one patient-001 med-009 Trey --name Tylenol --dose TODO_SET_DOSE --route TODO_SET_ROUTE --frequency 'every 6 hours' --notes 'Verify this line against the discharge packet before finalizing.' --source-file Regimen.docx --source-line 55 --source-quote 'Tylenol every 6 hours BID'

# med-010 - VITAMIN D3 PO
# TODO: missing dose
/Users/trey/Desktop/Apps/ThePillBill/scripts/verify_one patient-001 med-010 Trey --name 'VITAMIN D3 PO' --dose TODO_SET_DOSE --route 'by mouth' --frequency daily --times 08:00 --notes 'Verify this line against the discharge packet before finalizing.' --source-file Regimen.docx --source-line 33 --source-quote 'VITAMIN D3 PO take by mouth daily.'

# med-011 - Wellbutrin
/Users/trey/Desktop/Apps/ThePillBill/scripts/verify_one patient-001 med-011 Trey --name Wellbutrin --dose '300 mg total' --route 'by mouth' --frequency 'every morning' --times 08:00 --notes 'Verify this line against the discharge packet before finalizing.' --source-file Regimen.docx --source-line 27 --source-quote 'Wellbutrin – Take 1 tablet (300 mg total) by mouth every morning.'

# med-012 - zinc sulfate
/Users/trey/Desktop/Apps/ThePillBill/scripts/verify_one patient-001 med-012 Trey --name 'zinc sulfate' --dose '50 mg of elemental zinc total' --route 'by mouth' --frequency daily --times 08:00 --notes 'Verify this line against the discharge packet before finalizing.' --source-file Regimen.docx --source-line 35 --source-quote 'zinc sulfate Take 1 capsule (50 mg of elemental zinc total) by mouth daily.'

/Users/trey/Desktop/Apps/ThePillBill/scripts/pb finalize --patient-id patient-001 --verified-by Trey
