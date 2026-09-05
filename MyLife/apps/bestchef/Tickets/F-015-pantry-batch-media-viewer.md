# Pantry — view photos / receipts attached to a batch

## Problem Statement

### Who is affected?
Pantry users who imported a batch via receipt or photo.

### What is the current experience?
The MediaSlot at `app/(root)/pantry.tsx` line 147 routes to `/soon?feature=Pantry batch media viewer`. The receipt photo, grocery photo, and expiration photo are stored when uploaded but never re-displayed.

### Pain point
Provenance for the pantry record is opaque; the user cannot verify why an item was added or check the price/expiration captured on the receipt.

---

## Desired Outcome

Tapping the media slot opens a viewer that shows the receipt or food-photo frame the batch came from. The viewer supports zoom, swipe between attachments, and shows OCR-extracted region overlays where they exist.

## Success Criteria

1. [ ] Tap opens an image viewer that fills the screen.
2. [ ] Multi-attachment batches paginate via swipe.
3. [ ] OCR confidence regions overlay the image when present.
4. [ ] Closing the viewer returns to the same Pantry scroll position.
5. [ ] Missing media shows an "Image unavailable" message, not a crash.

## Scope Boundaries

**Not in scope:** Editing the captured image; re-running OCR (covered by F-043).

## Business Case
- [x] **Should have**

## Technical Context
File: `app/(root)/pantry.tsx` line 144–149.

## Status

Done in P14-B (SHA ed60b8ec6, pantry batch viewer + grocery media + photo overwrite fix).
