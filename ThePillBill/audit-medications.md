# Medication Audit: Regimen vs. After Visit Summary PDF

**Patient:** Lisa A. Shuldberg
**Procedure:** Meningioma surgery, February 9, 2026
**Discharge:** February 11, 2026
**Facility:** Scripps Green Hospital
**Auditor:** Automated cross-reference audit
**Date:** February 11, 2026

---

## 1. Medication-by-Medication Comparison

### 1. acetaminophen (Tylenol) 500 mg

| Field | PDF | Regimen | Match? |
|-------|-----|---------|--------|
| Dosage | 500 mg | Not specified | PARTIAL |
| Frequency | Every 6 hours as needed | "Every 6 hours BID" | INCORRECT |
| Indication | Mild pain (level 1-3) | Not specified | MISSING |
| Timing | As Needed | Listed under "Special instructions" | Correct placement |
| Status | CONTINUE | Present | Correct |

**Verdict: INCORRECT.** The Regimen says "Tylenol every 6 hours BID." This is contradictory. "BID" means twice daily, but "every 6 hours" means up to 4 times daily. The PDF says "every 6 hours as needed" with no BID qualifier. The Regimen should read: **"Tylenol 500 mg every 6 hours as needed for mild pain."** The word "BID" must be removed.

---

### 2. ascorbic acid with rose hips 500 mg

| Field | PDF | Regimen | Match? |
|-------|-----|---------|--------|
| Dosage | 500 mg | 500 mg | Correct |
| Frequency | 1 tablet daily | 1 tablet daily | Correct |
| Timing | Morning | Morning | Correct |
| Status | START (new med) | Present in morning list | Correct |

**Verdict: CORRECT.** No discrepancies.

---

### 3. buPROPion XL (Wellbutrin XL) 300 mg

| Field | PDF | Regimen | Match? |
|-------|-----|---------|--------|
| Dosage | 300 mg | 300 mg | Correct |
| Frequency | Every morning | Every morning | Correct |
| Timing | Morning | Morning | Correct |
| Status | CONTINUE | Present in morning list | Correct |

**Verdict: CORRECT.** No discrepancies.

---

### 4. dexAMETHasone (DECADRON) 1 mg tablet — TAPER

| Field | PDF | Regimen | Match? |
|-------|-----|---------|--------|
| Taper schedule | Detailed 7-day taper provided | "See separate timeanddate calendar" | CANNOT VERIFY |
| Take with meals | Yes, specified | "Take after meals" | MINOR WORDING DIFFERENCE |
| Timing | Morning + Evening (first 4 days), then Morning only | Morning + Evening listed | Correct |
| Status | CHANGE | Present | Correct |

**PDF Taper Schedule:**
- Days 1-2 (Feb 11-12): 3 mg (3 tablets) twice daily with meals
- Days 3-4 (Feb 13-14): 2 mg (2 tablets) twice daily with meals
- Days 5-6 (Feb 15-16): 2 mg (2 tablets) once daily with breakfast
- Day 7 (Feb 17): 1 mg (1 tablet) once daily with breakfast

**Verdict: PARTIALLY CORRECT.** The Regimen correctly references a separate calendar for the taper, and the med appears in both morning and evening lists. However, the taper details are deferred to an external document ("timeanddate calendar") that cannot be verified in this audit. The wording "take after meals" vs the PDF's "with meals" is a minor but notable difference — "with meals" is the official instruction. **Recommendation:** Verify the external calendar matches the PDF taper exactly.

---

### 5. levETIRAcetam (Keppra) 500 mg

| Field | PDF | Regimen | Match? |
|-------|-----|---------|--------|
| Dosage | 500 mg | 500 mg | Correct |
| Frequency | 2x/day | 2x/day (morning + evening) | Correct |
| Timing | Morning + Evening | Morning + Evening | Correct |
| Duration | "FOR SEIZURE PREVENTION UNTIL ALL GONE" | "Until gone" | PARTIAL |
| Status | START (new med) | Present | Correct |
| Spelling | levETIRAcetam (KEPPRA) | levETIRAcetam (Kepra) | MINOR TYPO |

**Verdict: PARTIALLY CORRECT.** The Regimen correctly captures the dosage, frequency, and timing. It includes "until gone" but omits the critical context: **"FOR SEIZURE PREVENTION."** The caregiver and patient should understand WHY this medication is being taken — it is for post-surgical seizure prevention. The brand name is also misspelled as "Kepra" instead of "Keppra" (minor).

---

### 6. oxyCODONE (Roxicodone) 5 mg

| Field | PDF | Regimen | Match? |
|-------|-----|---------|--------|
| Dosage | 5 mg | Not specified | MISSING |
| Frequency | Every 4 hours as needed | "Every 4 hours BID" | INCORRECT |
| Indication | Moderate pain (4-6) or severe pain (7-10) | Not specified | MISSING |
| Timing | As Needed | Listed under "Special instructions" | Correct placement |
| Status | START (new med) | Present | Correct |

**Verdict: INCORRECT.** Same error as acetaminophen. The Regimen says "Oxy every 4 hours BID." "BID" means twice daily, but "every 4 hours" means up to 6 times daily. The PDF says "every 4 hours as needed." The Regimen should read: **"oxyCODONE 5 mg every 4 hours as needed for moderate-to-severe pain."** The word "BID" must be removed. Additionally, the dosage (5 mg) is not stated in the Regimen.

---

### 7. pantoprazole (Protonix) 40 mg

| Field | PDF | Regimen | Match? |
|-------|-----|---------|--------|
| Dosage | 40 mg | 40 mg | Correct |
| Frequency | Daily | Daily | Correct |
| Timing | Morning, 30 min before meals | Morning, 30 min before meals | Correct |
| Purpose | "FOR STOMACH ACIDS WHILE ON STEROID" | Not stated | MISSING |
| Status | START (new med) | Present in morning list | Correct |

**Verdict: PARTIALLY CORRECT.** Dosage, frequency, and timing are all correct. However, the purpose note is missing: **"FOR STOMACH ACIDS WHILE ON STEROID."** This context matters because it tells the patient (a) why they are taking this and (b) that it may be discontinued when the dexamethasone taper is complete. The caregiver should add this note.

---

### 8. promethazine (Phenergan) 25 mg

| Field | PDF | Regimen | Match? |
|-------|-----|---------|--------|
| Dosage | 25 mg | 25 mg | Correct |
| Frequency | At bedtime as needed | At bedtime as needed | Correct |
| Indication | Migraine | Migraine (implied) | Correct |
| Timing | Bedtime / As Needed | Under "Special instructions" | Correct |
| Status | CONTINUE | Present | Correct |
| Interaction note | Not in PDF | "Do not take when taking Trazadone" | BENEFICIAL ADDITION |

**Verdict: CORRECT, with a beneficial addition.** The Regimen matches the PDF. The caregiver added a valuable safety note: "Do not take when taking Trazadone." This interaction warning is NOT in the PDF but is a **good clinical practice addition** — both promethazine and trazodone cause CNS depression, and concurrent use increases sedation risk. This note should be kept.

---

### 9. rizatriptan MLT (Maxalt-MLT) 10 mg

| Field | PDF | Regimen | Match? |
|-------|-----|---------|--------|
| Dosage | 10 mg | 10 mg | Correct |
| Frequency | Once as needed for migraine | Once as needed for migraine | Correct |
| Repeat dose | May repeat in 2 hours | May repeat in 2 hours | Correct |
| Max dose | 30 mg in 24 hours | 30 mg in 24 hours | Correct |
| Timing | As Needed | Under "Special instructions" | Correct |
| Status | CONTINUE | Present | Correct |

**Verdict: CORRECT.** No discrepancies. All details match precisely.

---

### 10. topiramate (Topamax) 50 mg tablet

| Field | PDF | Regimen | Match? |
|-------|-----|---------|--------|
| Dosage | 1.5 tablets (75 mg) | 1.5 tablets (75 mg) | Correct |
| Frequency | 2x/day | 2x/day | Correct |
| Timing | Morning + Evening | Morning + Evening | Correct |
| Status | CONTINUE | Present in both lists | Correct |

**Verdict: CORRECT.** No discrepancies.

---

### 11. traZODone (Desyrel) 50 mg

| Field | PDF | Regimen | Match? |
|-------|-----|---------|--------|
| Dosage | 50 mg | 50 mg | Correct |
| Frequency | Daily at bedtime | Daily at bedtime as needed | MINOR DIFFERENCE |
| Timing | Bedtime | Under "Special instructions" | Correct |
| Status | CONTINUE | Present | Correct |
| Interaction note | Not in PDF | "Do not take when taking Phenergan" | BENEFICIAL ADDITION |

**Verdict: CORRECT, with notes.** The Regimen adds "as needed (sleep aid)" which is a reasonable clarification. The caregiver added "Do not take when taking Phenergan" — the reciprocal of the promethazine note. This is a **beneficial safety addition** and should be kept.

---

### 12. VITAMIN D3

| Field | PDF | Regimen | Match? |
|-------|-----|---------|--------|
| Dosage | Not specified in PDF | Not specified | N/A |
| Frequency | Daily | Daily | Correct |
| Timing | PDF chart shows afternoon/evening area | Regimen lists under Morning | DISCREPANCY |
| Status | CONTINUE | Present in morning list | Correct |

**Verdict: TIMING DISCREPANCY.** The PDF medication chart places the Vitamin D3 checkmark in the afternoon/evening column area, but the Regimen lists it under "Each morning." While Vitamin D3 can be taken at any time, the Regimen should match the official instructions. **Recommendation:** Move Vitamin D3 to the evening list, or verify with the prescriber which timing is preferred.

---

### 13. zinc sulfate (Zincate) 220 mg capsule (50 mg elemental zinc)

| Field | PDF | Regimen | Match? |
|-------|-----|---------|--------|
| Dosage | 50 mg elemental zinc (220 mg capsule) | 50 mg elemental zinc | Correct |
| Frequency | Daily | Daily | Correct |
| Timing | Morning | Morning | Correct |
| Status | START (new med) | Present in morning list | Correct |

**Verdict: CORRECT.** No discrepancies.

---

## 2. Discrepancies Found

### CRITICAL Errors (Could Cause Harm)

| # | Issue | Details | Risk Level |
|---|-------|---------|------------|
| 1 | **"Tylenol every 6 hours BID" — BID is WRONG** | "BID" means twice daily. "Every 6 hours" means up to 4x/day. These are contradictory. The PDF says "every 6 hours as needed." If the patient interprets "BID" literally, they may under-dose and suffer unnecessary pain. If they follow "every 6 hours," they exceed the BID instruction, causing confusion. **Fix: Remove "BID." Write "every 6 hours as needed for mild pain (level 1-3)."** | HIGH |
| 2 | **"Oxy every 4 hours BID" — BID is WRONG** | Same issue. "Every 4 hours" = up to 6x/day. "BID" = 2x/day. The PDF says "every 4 hours as needed." This is an opioid — dosing confusion is dangerous. If patient takes it only BID when they need it every 4 hours, pain is uncontrolled. If they take it every 4 hours thinking BID is just a label, no harm — but the instruction is confusing. **Fix: Remove "BID." Write "oxyCODONE 5 mg every 4 hours as needed for moderate-to-severe pain."** | HIGH |
| 3 | **Oxycodone dosage (5 mg) missing from Regimen** | The Regimen says "Oxy" with no dosage specified. The PDF specifies 5 mg. Dosage must always be explicit for controlled substances. | HIGH |

### Moderate Errors (Could Cause Confusion)

| # | Issue | Details | Risk Level |
|---|-------|---------|------------|
| 4 | **Bowel protocol incomplete** | Regimen includes only Step 1 (Sennakot-S 2x/day with fluids). Missing: Step 2 (Miralax on day 2 if no BM), Step 3 (Dulcolax suppository on day 3), Step 4 (mineral oil enema on day 4), Step 5 (call Neurosurgery nurse at 858-554-8920). Opioid-induced constipation is common and the escalation protocol is essential. | MODERATE |
| 5 | **Vitamin D3 timing mismatch** | Regimen lists morning; PDF chart shows afternoon/evening. | LOW-MODERATE |
| 6 | **pantoprazole purpose note missing** | Regimen does not explain "FOR STOMACH ACIDS WHILE ON STEROID." Patient should know this med is linked to the dexamethasone taper and may be discontinued after. | LOW-MODERATE |
| 7 | **levETIRAcetam seizure prevention context missing** | Regimen says "until gone" but omits "FOR SEIZURE PREVENTION." Patient should understand the clinical reason. | LOW-MODERATE |
| 8 | **Acetaminophen dosage (500 mg) not stated in Regimen** | The Regimen says "Tylenol" without specifying 500 mg. | LOW |

### Minor Issues

| # | Issue | Details | Risk Level |
|---|-------|---------|------------|
| 9 | **"Kepra" misspelling** | Should be "Keppra" (brand name of levetiracetam). | TRIVIAL |
| 10 | **"Take after meals" vs "with meals" for dexamethasone** | PDF says "with meals." Regimen says "after meals." Clinical difference is minimal but should match official wording. | TRIVIAL |
| 11 | **Acetaminophen pain level guidance missing** | PDF specifies "mild pain (level 1-3)" for Tylenol and "moderate pain (level 4-6) or severe pain (level 7-10)" for oxycodone. This pain-level guidance helps the patient choose the right medication. | LOW |

### Beneficial Additions in Regimen (Not in PDF, but Valuable)

| # | Addition | Assessment |
|---|----------|------------|
| A | **promethazine/trazodone interaction warning** | KEEP. Both are CNS depressants. The caregiver correctly identified that these should not be taken together. This is a clinically sound addition. |
| B | **Adderall discontinuation note** | KEEP. The Regimen includes "[Stop taking adderall.]" which matches the PDF's STOP instruction for dextroamphetamine-amphetamine XR 10 mg. Correctly captured. |

---

## 3. Medications Missing from Regimen

### Fully Missing

| Medication | PDF Status | Notes |
|------------|-----------|-------|
| **docusate sodium with senna (Sennakot-S)** | Part of Bowel Protocol | Sennakot-S IS listed in the Regimen (morning + evening), so Step 1 is present. However, the full escalation protocol (Steps 2-5) is missing. |

### Bowel Protocol Steps Missing from Regimen

The Regimen only captures Step 1. The following escalation steps are absent:

1. ~~Day 1 home: Sennakot-S 1 tablet 2x/day with fluids~~ (Present in Regimen)
2. **MISSING — Day 2 no BM: Add polyethylene glycol (Miralax) 1 capful in 6-8 oz fluids every morning**
3. **MISSING — Day 3 no BM: Add bisacodyl (Dulcolax) suppository every 12 hours**
4. **MISSING — Day 4 no BM: Add mineral oil enema**
5. **MISSING — All fail: Call Neurosurgery nurse at (858) 554-8920**

---

## 4. Summary Verdict

### Overall Accuracy: 8 of 13 medications are CORRECT or have only minor issues

**Breakdown:**
- **Fully Correct (6):** ascorbic acid, buPROPion XL, rizatriptan, topiramate, zinc sulfate, dextroamphetamine-amphetamine (STOP instruction)
- **Correct with Beneficial Additions (2):** promethazine, traZODone
- **Partially Correct (3):** dexamethasone (deferred to external calendar, wording difference), levETIRAcetam (missing purpose note, minor typo), pantoprazole (missing purpose note)
- **INCORRECT (2):** acetaminophen ("BID" error, missing dosage), oxyCODONE ("BID" error, missing dosage)

### Priority Fixes Required

1. **URGENT — Remove "BID" from Tylenol and Oxy instructions.** Replace with "as needed." This is the most important fix because it involves an opioid and creates dosing confusion.
2. **URGENT — Add oxycodone dosage (5 mg) and acetaminophen dosage (500 mg) to the Regimen.**
3. **HIGH — Add full bowel protocol escalation steps (Miralax, Dulcolax, mineral oil enema, nurse phone number).**
4. **MODERATE — Add purpose notes for pantoprazole and levetiracetam.**
5. **LOW — Verify Vitamin D3 timing preference (morning vs afternoon/evening).**
6. **LOW — Verify dexamethasone taper calendar matches PDF exactly.**
7. **TRIVIAL — Fix "Kepra" to "Keppra" and "after meals" to "with meals."**

### What the Caregiver Got Right

The Regimen is well-organized with clear morning/evening groupings. The promethazine/trazodone interaction warning is a valuable safety addition not present in the PDF. The Adderall discontinuation is correctly noted. Most medication dosages and frequencies are accurately transcribed. The dexamethasone taper is wisely tracked on a separate calendar. Overall, this is a solid caregiving document that needs targeted corrections, not a rewrite.

---

*Audit generated February 11, 2026. This audit compares two documents and does not constitute medical advice. All changes should be verified with the prescribing medical team.*
