# 2026-04-20 Social Media, Documents, And Module-Gap Review

## Summary

Completed a follow-up product and codebase review focused on:

- creator-media / short-form social gaps
- opt-in social architecture and human verification
- photo collage/editor and privacy-vault needs
- secure documents / records storage
- low-module-count expansion strategy

## What I Did

1. Reviewed existing repo infrastructure for:
   - shared social primitives in `packages/social`
   - hub trust and privacy tables in `packages/db/src/hub-schema.ts`
   - health and homes document-vault implementations
   - budget subscription and splitting overlap
   - RSVP group and event-coordination overlap
2. Continued primary-source web research on:
   - Meta Edits, Instagram map, Reels/Friends
   - TikTok posting, Duet, Stitch, privacy defaults, TikTok Studio
   - YouTube Shorts editor, templates, remix, photo-to-video
   - Pic Stitch collage/editor positioning
   - Apple Hidden album, app hiding/locking, Files/iCloud copy flows
   - 1Password and Proton secure-file patterns
3. Wrote an addendum report with recommendations that minimize new module count.

## Key Decisions

- Treat social architecture as a **shared platform**, not a standalone module.
- Recommend **one new creator-media module** because short-form social does not fit cleanly in `forums` or other existing modules.
- Recommend **one new suite-wide records module** because the current Health and Homes vaults prove the need but are too siloed.
- Recommend **merging `subs` into `budget`** instead of keeping subscription tracking as a separate product surface.
- Recommend folding other earlier ideas into existing modules first:
  - MySplit -> Budget
  - MyCrew / MyPlans -> RSVP + shared social groups
  - MyStudy -> Flash + Notes + Voice + Words
  - MySpots -> Dining + Surf + Trails

## Files Changed

- `docs/reports/REPORT-social-media-documents-and-low-module-expansion-2026-04-20.md`
- `docs/sessions/2026-04-20-social-media-documents-module-gap-review.md`
- `memory.md`

## Verification

- No function logic changed.
- No tests were run.
- `pnpm gate:function:changed` was intentionally skipped because this session only changed documentation.

## Sources Used

- Meta Edits: `https://about.fb.com/news/2025/04/introducing-edits-streamlined-video-creation-app/`
- Instagram map / Friends: `https://about.fb.com/news/2025/08/new-instagram-features-help-you-connect/`
- TikTok posting: `https://support.tiktok.com/en/using-tiktok/creating-videos/making-a-post`
- TikTok Duet: `https://support.tiktok.com/en/using-tiktok/creating-videos/duets/`
- TikTok Stitch: `https://support.tiktok.com/en/using-tiktok/creating-videos/stitch/`
- TikTok privacy for teens: `https://support.tiktok.com/en/account-and-privacy/account-privacy-settings/privacy-and-safety-settings-for-users-under-age-18/`
- TikTok Studio: `https://support.tiktok.com/en/using-tiktok/creating-videos/tiktok-studio/`
- YouTube Shorts tools: `https://blog.youtube/news-and-events/new-creation-tools-youtube-shorts-2025/`
- YouTube Reimagine: `https://blog.youtube/news-and-events/reimagine-new-ai-powered-remix-tool-youtube-shorts/`
- Pic Stitch App Store: `https://apps.apple.com/us/app/pic-stitch-collage-editor/id454768104`
- Apple Hidden album: `https://support.apple.com/en-us/104987`
- Apple Files + third-party cloud: `https://support.apple.com/en-us/102238`
- Apple iCloud copy/archive: `https://support.apple.com/en-afri/108306`
- Apple app lock/hide: `https://support.apple.com/guide/iphone/lock-or-hide-or-an-app-iph00f208d05/26/ios/26`
- 1Password files: `https://support.1password.com/files/`
- Proton Drive support/security: `https://proton.me/support/drive`, `https://proton.me/drive/security`

## Remaining Follow-Up

- Decide whether to formally mark `subs` as merged into `budget`.
- Decide final naming for the creator-media surface (`MyMoments` is the recommended placeholder).
- Decide final naming for the records surface (`MyRecords` is the recommended placeholder).
- If product direction is approved, the next useful artifact is a technical design doc for:
  - shared media package
  - shared documents package
  - creator-module MVP scope
