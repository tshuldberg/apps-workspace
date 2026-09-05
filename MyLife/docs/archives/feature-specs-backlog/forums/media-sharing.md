# Feature Spec: Media Sharing

## Metadata
- **Module:** forums
- **Priority Score:** 23 / 50 (B-Tier)
- **Scoring Breakdown:** Market [2] x3 + Switching [3] x3 + Complexity [3] x2 + CrossModule [1] x1 + PaidUser [1] x1
- **Sprint:** Backlog
- **Estimated CC Time:** 4-5 hours
- **Depends On:** none (builds on existing fr_threads and fr_replies)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Text-only forums feel sterile and outdated. Modern community platforms treat images, GIFs, and video as first-class content. Both Reddit and Discord show that media-rich posts drive significantly higher engagement (Reddit reports 2-3x more interaction on image/video posts vs text-only). Without media sharing, MyForums cannot compete for users accustomed to visual content in their community feeds.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Discord | Yes | Partial (Nitro: 500MB upload, 4K streaming) | Inline image/video/GIF embeds, file attachments up to 25MB (free) or 500MB (Nitro), link previews, drag-and-drop |
| Reddit | Yes | No | Image/video posts, image galleries (up to 20), GIF comments (via Giphy), link preview cards, hosted video player |
| Lemmy | Yes | No | Image uploads on posts, no inline comment images, external link embeds |

### Target User
Visual communicators who share screenshots, photos, memes, and short videos as part of community discussion. Reddit users who post image galleries, Discord users who paste screenshots and GIFs inline. Without media support, these users cannot replicate their current forum experience.

## Technical Context

### Where This Lives in MyLife

```
modules/forums/src/
  types.ts                            -- New Zod schemas: MediaAttachment, MediaType
  cloud/client.ts                     -- New cloud functions: media upload, gallery management
  cloud/schema.sql                    -- New tables: fr_media_attachments, fr_link_previews

apps/mobile/app/(forums)/
  create-thread.tsx                   -- MODIFIED: add media picker + inline preview
  thread-detail.tsx                   -- MODIFIED: render media attachments in thread body
  components/MediaPicker.tsx          -- NEW: unified image/video/GIF picker
  components/MediaGallery.tsx         -- NEW: lightbox gallery for multi-image posts
  components/LinkPreview.tsx          -- NEW: og:image + title + description card

apps/web/app/forums/
  components/MediaUploader.tsx        -- NEW: drag-and-drop + paste media upload
  components/MediaGallery.tsx         -- NEW: lightbox gallery
  components/LinkPreview.tsx          -- NEW: link preview card
```

### Wireframe Position

```
Hub Dashboard
  └── MyForums card
       └── Feed / Community
            └── Create Thread / Reply
                 └── Media toolbar ← YOU ARE HERE
                      ├── 📷 Image button (gallery picker)
                      ├── 🎥 Video button (camera or gallery)
                      ├── 🔗 Link button (auto-preview)
                      └── Inline media preview in compose area
```

### Data Model

```sql
-- New table: fr_media_attachments (Supabase cloud)
CREATE TABLE IF NOT EXISTS fr_media_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL CHECK (target_type IN ('thread', 'reply')),
  target_id UUID NOT NULL,
  uploader_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video', 'gif')),
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  width INTEGER,
  height INTEGER,
  file_size INTEGER NOT NULL CHECK (file_size > 0),
  mime_type TEXT NOT NULL,
  alt_text TEXT DEFAULT '' CHECK (char_length(alt_text) <= 300),
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Link preview cache
CREATE TABLE IF NOT EXISTS fr_link_previews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL UNIQUE,
  title TEXT,
  description TEXT,
  image_url TEXT,
  site_name TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_fr_media_target ON fr_media_attachments (target_type, target_id);
CREATE INDEX idx_fr_media_uploader ON fr_media_attachments (uploader_id);
CREATE INDEX idx_fr_link_previews_url ON fr_link_previews (url);

-- RLS
ALTER TABLE fr_media_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Media readable by all" ON fr_media_attachments FOR SELECT USING (true);
CREATE POLICY "Users can upload media" ON fr_media_attachments FOR INSERT WITH CHECK (auth.uid() = uploader_id);
CREATE POLICY "Users can delete own media" ON fr_media_attachments FOR DELETE USING (auth.uid() = uploader_id);

ALTER TABLE fr_link_previews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Link previews are public" ON fr_link_previews FOR SELECT USING (true);
```

### Dependencies
- **Internal:** `@mylife/db` (SQLite adapter), `@mylife/ui` (image components)
- **External:** Supabase Storage for file hosting (bucket: `forum-media`), `expo-image-picker` for mobile, `expo-image-manipulator` for client-side resizing, `expo-video` for video playback
- **Cross-Module:** None directly. Future consideration: `@mylife/recipes` photo sharing could reuse the media pipeline.

## Functional Requirements

### User Stories
1. As a thread author, I want to attach up to 10 images to my post so I can share visual content with the community.
2. As a reply author, I want to paste or pick an image inline so I can respond visually.
3. As a reader, I want to tap an image to view it full-screen in a lightbox gallery.
4. As a thread author, I want link URLs to auto-generate preview cards (title, description, og:image) so my posts look polished.
5. As a member, I want to share short video clips (up to 60 seconds) in threads.

### Behavior Specification

1. **Thread creation with media:** When composing a new thread, a media toolbar appears below the text input with buttons for Image, Video, and Link. Tapping Image opens the device gallery picker (mobile) or file dialog (web). Selected images appear as inline thumbnails in the compose area, reorderable via drag. Up to 10 images per thread.
2. **Reply with media:** Replies support single image/GIF attachment. Tapping the image icon in the reply compose bar opens the picker. Image appears as inline preview below the reply text.
3. **Image processing pipeline:** On selection, images are resized client-side: max 2048px on longest edge, converted to WebP (quality 85). A 400px thumbnail is generated. Both are uploaded to Supabase Storage `forum-media/{user_id}/{uuid}.webp`. Upload progress is shown per-image.
4. **Video handling:** Videos are limited to 60 seconds and 50MB. No client-side transcoding (uploaded as-is). A thumbnail is extracted from the first frame client-side. Videos play inline with native controls (expo-video on mobile, HTML5 video on web).
5. **Link previews:** When a URL is detected in thread/reply body (regex match), the system checks fr_link_previews cache first. If miss, a Supabase Edge Function fetches the URL's Open Graph metadata (og:title, og:description, og:image) and caches it. The preview card renders below the post text.
6. **Gallery lightbox:** Tapping any image in a thread opens a full-screen lightbox. Multi-image threads support horizontal swipe navigation. Pinch-to-zoom on mobile. Close via swipe-down or X button.
7. **Media in feed:** Thread cards in the feed show a media preview: first image as a 16:9 crop thumbnail, or a play icon overlay for video. Multi-image posts show a "+N" badge on the thumbnail.
8. **Paste support (web):** Pasting an image from clipboard in the compose area automatically uploads it as an attachment.
9. **Drag-and-drop (web):** Dragging image files into the compose area uploads them as attachments with progress indicators.
10. **Deletion:** Authors can remove individual media attachments from their posts/replies via a remove button on each thumbnail during editing. Removing triggers Supabase Storage deletion.

### Edge Cases

- **Oversized file:** Files exceeding limits (10MB images, 50MB video) show a toast: "File too large. Images: 10MB max, Videos: 50MB max." Upload is rejected client-side before network call.
- **Unsupported format:** Only JPEG, PNG, WebP, GIF (images) and MP4, MOV (video) are accepted. Other formats show "Unsupported file type" error.
- **Upload failure mid-batch:** If 3 of 5 images upload successfully and 2 fail, the successful ones are retained. Failed ones show a retry icon. User can retry or remove them.
- **Slow network:** Upload progress bar per-image. If connection drops, uploads pause and resume when reconnected (if Supabase resumable uploads are available; otherwise retry from start).
- **Link preview fetch failure:** If og:metadata cannot be fetched (timeout, 404, no og tags), show a plain URL link with no preview card. Do not retry automatically.
- **Extremely wide/tall images:** Client-side resize handles aspect ratios. Display uses `object-fit: contain` within 16:9 container.
- **GIF handling:** GIFs are not converted to WebP (preserves animation). Size limit remains 10MB. Displayed as animated in feed and lightbox.
- **NSFW/inappropriate media:** Deferred to community moderation via existing report system. No automated NSFW detection in v1.
- **Module disabled mid-upload:** Ongoing uploads are cancelled. Partially uploaded files are cleaned up by a daily Supabase cron job.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** User can attach up to 10 images to a new thread via media toolbar
- [ ] **AC-2:** User can attach 1 image or GIF to a reply
- [ ] **AC-3:** Attached images appear as reorderable inline thumbnails in the compose area
- [ ] **AC-4:** Tapping an image in a thread opens a full-screen lightbox with swipe navigation
- [ ] **AC-5:** Video playback works inline with play/pause controls (up to 60 seconds)
- [ ] **AC-6:** URLs in thread/reply body auto-generate preview cards with title, description, and image
- [ ] **AC-7:** Thread cards in the feed show a 16:9 media preview thumbnail
- [ ] **AC-8:** Multi-image posts show "+N" badge on feed thumbnail
- [ ] **AC-9:** Upload progress is shown per-image during media upload
- [ ] **AC-10:** Authors can remove individual media attachments from their posts
- [ ] **AC-11:** Web: pasting an image from clipboard uploads it as an attachment
- [ ] **AC-12:** Web: drag-and-drop image files into compose area uploads them

### Technical Criteria
- [ ] **TC-1:** Images are resized to max 2048px and converted to WebP (quality 85) client-side before upload
- [ ] **TC-2:** Thumbnails are generated at 400px for each image
- [ ] **TC-3:** fr_media_attachments rows are created with correct target_type/target_id linkage
- [ ] **TC-4:** Link preview metadata is cached in fr_link_previews to avoid re-fetching
- [ ] **TC-5:** Files exceeding size limits are rejected client-side before upload
- [ ] **TC-6:** Supabase Storage paths follow pattern: `forum-media/{user_id}/{uuid}.webp`
- [ ] **TC-7:** RLS allows public read and owner-only write/delete on media attachments
- [ ] **TC-8:** Video files are limited to 60 seconds and 50MB

### Negative Criteria
- [ ] **NC-1:** Media attachments must NOT be editable by anyone other than the uploader
- [ ] **NC-2:** Unsupported file types must NOT be uploaded (validate client-side)
- [ ] **NC-3:** Media uploads must NOT block thread/reply text submission (upload in background, attach on completion)
- [ ] **NC-4:** Link preview fetching must NOT delay thread display (async, show placeholder while fetching)

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Media toolbar: horizontal row below compose input, `rgba(255,255,255,0.08)` (glassStrong) background
- Toolbar icons: 24px, `rgba(240,240,245,0.65)` (textSecondary), highlight `#F43F5E` on active
- Inline thumbnails: 80px squares in a horizontal scroll, rounded 8px corners, `rgba(255,255,255,0.10)` border
- Remove button: 20px circle with X, positioned top-right of each thumbnail
- Upload progress: thin `#F43F5E` bar below each thumbnail
- Lightbox: black background, image centered with pinch-to-zoom, dot indicators for multi-image
- Video: native player controls, 16:9 aspect ratio container
- Link preview card: `rgba(255,255,255,0.04)` glass background, og:image left (60x60), title + description right

### Web (Next.js)

- Same tokens via CSS variables
- Drag-and-drop zone: dashed `rgba(255,255,255,0.10)` border on hover, `#F43F5E` border on dragover
- Lightbox: CSS backdrop-filter overlay, keyboard navigation (left/right arrows, Escape to close)
- Image grid in thread: masonry layout for 2-4 images, single column for 1 or 5+

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton placeholder for media thumbnails | Thread with media loading |
| Empty | No media section shown (text-only post) | Thread has no attachments |
| Error | "Failed to load image" placeholder with retry | CDN/network failure |
| Success | Full media gallery with thumbnails and lightbox | Media loaded |
| Partial | Some images loaded, others show progress spinner | Staggered loading |

## Test Requirements

### Unit Tests
- [ ] Image resize: outputs max 2048px on longest edge
- [ ] Image resize: preserves aspect ratio
- [ ] WebP conversion: output is WebP format
- [ ] File size validation: rejects files > 10MB (images) and > 50MB (video)
- [ ] File type validation: accepts JPEG, PNG, WebP, GIF, MP4, MOV; rejects others
- [ ] URL detection regex: matches http/https URLs in text body
- [ ] Media attachment schema: validates all required fields
- [ ] Thumbnail generation: outputs 400px thumbnail

### Integration Tests
- [ ] Full flow: compose thread -> attach 3 images -> submit -> images appear in thread detail -> tap to lightbox
- [ ] Link preview: post URL -> preview card appears after async fetch
- [ ] Delete flow: edit thread -> remove 1 of 3 images -> remaining 2 persist
- [ ] Error flow: upload fails -> retry button works -> image uploads successfully

### QA Verification Script

1. Open the app on mobile
2. Navigate to MyForums, enter a community
3. Tap "New Thread"
4. Verify: media toolbar appears below text input with Image, Video, Link buttons -- corresponds to AC-1
5. Tap Image button, select 3 photos from gallery
6. Verify: 3 thumbnails appear inline, reorderable -- corresponds to AC-3
7. Verify: upload progress bar shows per image -- corresponds to AC-9
8. Add thread title and body text, submit
9. Verify: thread detail shows all 3 images below text -- corresponds to AC-1
10. Tap first image
11. Verify: lightbox opens, swipe left to see image 2 and 3 -- corresponds to AC-4
12. Close lightbox, go back to feed
13. Verify: thread card shows first image as 16:9 thumbnail with "+2" badge -- corresponds to AC-7, AC-8
14. Create a reply on the thread, attach 1 image
15. Verify: reply shows inline image -- corresponds to AC-2
16. Create a new thread with a URL (e.g., a public web page)
17. Verify: link preview card appears with title, description, image -- corresponds to AC-6
18. Try to attach an 11MB image
19. Verify: toast error "File too large" appears, upload does not start -- corresponds to TC-5
20. On web, open compose, paste an image from clipboard
21. Verify: image appears as attachment -- corresponds to AC-11
22. Drag an image file into the compose area
23. Verify: image uploads and appears as attachment -- corresponds to AC-12
24. Edit the thread, remove 1 image
25. Verify: image is removed, remaining 2 persist -- corresponds to AC-10

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to thread creation, attach media, view gallery, verify all 5 states
- [ ] Batch QA: after 5 features in forums module, run `/qa` on the module URL

### Required if Complexity <= 2 (Large/Complex):
- [ ] Not applicable (Complexity = 3)

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
Threads and replies are text-only. The `body` field in fr_threads and fr_replies stores plain text (up to 40,000 and 10,000 chars respectively). No media storage, no link previews, no image rendering in the feed.

### After This Work
Full media pipeline: image/video/GIF attachments on threads and replies, client-side resizing and WebP conversion, Supabase Storage hosting, lightbox gallery, inline video playback, auto-generated link preview cards, and drag-and-drop/paste support on web.

### Files Changed
- `modules/forums/src/types.ts` -- Added MediaAttachment, MediaType, LinkPreview schemas
- `modules/forums/src/cloud/schema.sql` -- Added fr_media_attachments, fr_link_previews tables
- `modules/forums/src/cloud/client.ts` -- Added media upload/delete, link preview fetch functions
- `apps/mobile/app/(forums)/create-thread.tsx` -- Added media toolbar and inline preview
- `apps/mobile/app/(forums)/thread-detail.tsx` -- Added media rendering in thread body
- `apps/mobile/app/(forums)/components/MediaPicker.tsx` -- Unified image/video/GIF picker
- `apps/mobile/app/(forums)/components/MediaGallery.tsx` -- Lightbox gallery component
- `apps/mobile/app/(forums)/components/LinkPreview.tsx` -- Link preview card
- `apps/web/app/forums/components/MediaUploader.tsx` -- Drag-and-drop + paste upload
- `apps/web/app/forums/components/MediaGallery.tsx` -- Web lightbox gallery
- `apps/web/app/forums/components/LinkPreview.tsx` -- Web link preview card

### Known Limitations
- No client-side video transcoding (relies on server or user uploading compatible formats)
- No NSFW detection (relies on community moderation)
- No CDN-level image transformation (all processing is client-side before upload)
- GIF file size limit same as images (10MB) which may be restrictive for high-quality GIFs

### Context for Next Agent
The fr_media_attachments table uses a polymorphic target_type/target_id pattern (same as the existing fr_votes table). When adding media support to future content types (e.g., direct messages), add the new type to the target_type CHECK constraint. The Supabase Storage bucket `forum-media` uses the path pattern `{user_id}/{uuid}.webp` which makes cleanup straightforward on user deletion.
