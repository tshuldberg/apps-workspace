# Scheduler Format Research (Medication Safety + Readability)

## Goal
Define a medication schedule format that is easy to understand and reduces dosing errors for post-op care.

## Sources Reviewed
1. Wolf et al., randomized trial of Universal Medication Schedule (UMS): [PMC4577557](https://pmc.ncbi.nlm.nih.gov/articles/PMC4577557/)
2. Wolf et al., PRN label instruction redesign: [PMC7442820](https://pmc.ncbi.nlm.nih.gov/articles/PMC7442820/)
3. NCPDP white paper on Universal Medication Schedule (UMS): [PDF](https://www.ncpdp.org/NCPDP/media/pdf/WhitePaper_UniversalMedicationSchedule.pdf)
4. ISMP list of error-prone abbreviations/symbols: [ISMP list](https://www.ismp.org/recommendations/error-prone-abbreviations-list)

## Key Findings
- UMS-style simplification improves comprehension and adherence behavior by consolidating doses into four standard time windows rather than scattered times.
- In UMS trial data, adherence improved for complex regimens and multi-dose medications.
- Patients preferred PRN instructions that explicitly include:
  - condition/purpose for use,
  - exact dose,
  - spacing interval,
  - maximum amount allowed in 24 hours.
- Error-prone shorthand (for example unsafe abbreviations and decimal notation mistakes) is a known source of medication errors.

## Applied Format Decisions
1. Daily schedule is organized by explicit time buckets:
   - Morning (`08:00`)
   - Noon (`12:00`)
   - Evening (`18:00`)
   - Bedtime (`22:00`)
2. Each dose line includes:
   - medication name,
   - exact dose,
   - route,
   - purpose (if available),
   - PRN maximum in 24 hours (if applicable),
   - notes.
3. PRN medications are separated clearly from fixed scheduled doses when no fixed administration time exists.
4. Weekly schedule is shown as a by-time matrix (rows=time, columns=day) for quick scanning and caregiver handoff.
5. Validation blocks finalize/send when risk markers exist:
   - missing explicit dose units,
   - missing source citation,
   - missing manual verification,
   - ambiguous unsafe notation.

## Inference Notes
- The weekly time-matrix representation is an implementation inference based on UMS's emphasis on standardized administration windows and simplification. It is not a direct quote from one source.
