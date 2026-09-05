# Cooking video feed — replace DEMO_VIDEOS with cloud-backed video catalog

## Summary

`app/(root)/feed.tsx` reads `getAllVideos()`, `getVideosForCuisine()`, `getVideosForDish()` from `app/(root)/data/demo-videos.ts`, which is a static file backed by `DEMO_CHEFS` and `DEMO_DISHES` from `data/demo.ts`. The feed is already correctly gated on `shouldShowDemoContent()`, so production users see an empty "No videos yet" state. To launch the feed publicly we need a cloud video catalog (table + storage + ranking) that the screen can consume.

## Acceptance Criteria

1. [ ] New cloud table `bc_video_assets` (or extension of an existing media table) with chef, dish, cuisine, video URL, thumbnail, like count, created_at.
2. [ ] Cloud helpers `listFeedVideos(filter)` exposed from `@mylife/bestchef`.
3. [ ] `feed.tsx` reads from the cloud helper, removes the `DEMO_VIDEOS` dependency, and renders skeleton/error/empty/success states.
4. [ ] Like-count and like-state stay wired through the existing submission-likes pipeline.
5. [ ] `data/demo-videos.ts` is deleted or moved behind the `shouldUseDemoFixturesInDev()` gate.

## Source surfaces

- `app/(root)/feed.tsx` (lines 30-34, 437-447)
- `app/(root)/data/demo-videos.ts` (full file)
- `app/(root)/recipe/[id].tsx` (lines 49, 370, 757)

## Related

- Parent: F-044.
- Follow-up of P15-D.

## Severity

- [x] **Must have** — public launch readiness for the social/competitive feed.

## Status

Closed for real 2026-07-11 (commit `3247fb2c`).

The original 2026-06-09 "Done" claim was INCORRECT. The cloud video catalog did land on that date: implemented without a new table, riding `bc_media_assets` (owner_kind=submission, media_kind=video, approved + public + HTTPS remote_url) composed with `bc_submissions` (approved only), `bc_recipe_snapshots`, `bc_dishes`, and `social_profiles`. New module helpers `listFeedVideos` / `getFeedVideoById` in `modules/bestchef/src/cloud/video-feed.ts` (exported from the barrel), consumed by `feed.tsx` and `video/[id].tsx` through `app/(root)/data/cloud-videos.ts`. But the adversarial production audit of 2026-07-10 (finding H16, `docs/reports/REPORT-bestchef-adversarial-production-audit-2026-07-10.md`) proved fixtures were still reachable in public builds across the discover/feed/recipe surfaces, so the "closed" state was false when written.

Genuinely closed 2026-07-11 in commit `3247fb2c`: the remaining `DEMO_*` / `SAMPLE_*` substitutions in public builds were removed or gated behind `shouldUseDemoFixturesInDev()`, with the mechanical `check:no-ungated-fixtures` gate (wired into `check:parity`) preventing regression. Videos still appear automatically as media uploads are approved (BCSERVER-P0-04 promotion path), with the policy-gated demo fallback, loading state, and "No videos yet" empty state intact. Covered by `modules/bestchef/src/__tests__/video-feed.test.ts` (6 tests) and the app adapter tests.
