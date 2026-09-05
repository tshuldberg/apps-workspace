# Import flows — retry OCR from the review screen on failure

## Problem Statement

### Who is affected?
Users whose receipt or food-photo OCR partially fails or returns `provider_status === 'failed'`.

### What is the current experience?
`kitchen-receipt-review.tsx` line 388 surfaces the error message but offers no retry; the user must navigate back to `kitchen-receipt.tsx`, re-pick the photo, and rerun. `kitchen-photo-review.tsx` empty state (lines 328–335) has no retry either.

### Pain point
Common transient failures (network, model timeout) destroy a 30-second photo-pick flow.

---

## Desired Outcome

When OCR has failed or returned no candidates, the review screen shows a **Retry OCR** action. Retry rerun the same image through the same provider. A second failure offers **Switch provider** / **Pick different photo**.

## Success Criteria

1. [ ] Retry visible whenever provider status indicates failure.
2. [ ] Retry rerun completes in < 10 s on a healthy network.
3. [ ] Multiple retries do not duplicate review records.
4. [ ] Persistent failures escalate to provider-switch UI.

## Business Case
- [x] **Should have**

## Technical Context
- Files: `app/(root)/kitchen-receipt-review.tsx` 380–410, `app/(root)/kitchen-photo-review.tsx` 320–340.

## Status

Done in P14-D (SHA 217053cef, OCR pipeline hardening).
