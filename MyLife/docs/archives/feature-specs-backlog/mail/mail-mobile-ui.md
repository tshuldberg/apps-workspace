# Feature Spec: MyMail Full Mobile UI

## Metadata
- **Module:** mail
- **Priority Score:** 36 / 50 (A-Tier)
- **Scoring Breakdown:** Market 4 x3 + Switching 3 x3 + Complexity 3 x2 + CrossModule 2 x1 + PaidUser 4 x1
- **Sprint:** Sprint 2
- **Estimated CC Time:** 10-12 hours
- **Depends On:** none (all 8 engines + 12 tables + 85+ functions already exist)
- **Blocks:** mail web UI, mail cross-module integrations (calendar event sync to RSVP, contact sync)

## Business Context

### Why This Feature Exists
MyMail has 85+ exported functions across 8 engines (search, threading, contacts, filters, attachments, calendar, notifications, encryption) and 12 database tables covering multi-account IMAP email, threaded conversations, contact management, attachment handling, filter rules, calendar event extraction, notification preferences, and PGP encryption key management. All of this backend infrastructure is complete and tested, but the mobile UI is a single placeholder screen. The module is entirely unusable as a product. This spec designs the full mobile experience: 14 screens organized into 4 tabs (Inbox, Folders, Search, Settings) that surface every feature the backend already supports, including a dedicated first-run onboarding flow.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Apple Mail | Yes | Free (iOS built-in) | Threaded inbox, VIP senders, focused inbox, swipe actions, multi-account, search |
| Gmail | Yes | Free | Labels as folders, conversation view, smart compose, nudges, schedule send |
| Spark | Yes | Free + Teams ($7.99/mo) | Smart inbox with categories, snooze, send later, templates, team collaboration |
| ProtonMail | Yes | Free + Plus ($4/mo) | End-to-end encryption, self-destructing messages, custom domains, bridge for IMAP |
| Hey | Yes | $99/yr | Screener for new senders, reply later stack, paper trail for receipts, set aside pile |

### Target User
Privacy-conscious users who want a self-hosted email client that keeps all metadata on-device with zero cloud analytics. The key differentiator vs Apple Mail/Gmail is PGP encryption support, per-account color coding for visual multi-account management, and integration with the MyLife ecosystem (calendar events flow to RSVP, contacts shared across modules). The premium tier targets users who already subscribe to MyLife Pro for budget/books/workouts and want their email unified in the same app.

## Technical Context

### Where This Lives in MyLife

```
apps/mobile/app/(mail)/
  _layout.tsx                    -- Tab navigator (4 tabs) + Stack screens
  index.tsx                      -- Inbox tab (threaded conversation list)
  folders.tsx                    -- Folders tab (folder browser)
  search.tsx                     -- Search tab (full-text search)
  settings.tsx                   -- Settings tab (hub for all settings)
  onboarding.tsx                 -- First-run account setup wizard (stack screen, shown when 0 accounts)
  message/[id].tsx               -- Message detail, lightweight (stack screen, deep-link fallback only)
  thread/[id].tsx                -- Thread/conversation detail, canonical reading surface (stack screen)
  compose-message.tsx            -- Full compose screen (stack screen)
  contacts/index.tsx             -- Contact directory (stack screen)
  contacts/[id].tsx              -- Contact detail/edit (stack screen)
  accounts/index.tsx             -- Multi-account manager (stack screen)
  accounts/add.tsx               -- Add account / server setup (stack screen)
  filters/index.tsx              -- Filter manager (stack screen)
  filters/edit.tsx               -- Filter editor (stack screen)
  calendar-events.tsx            -- Calendar events extracted from mail (stack screen)
  notifications.tsx              -- Notification preferences (stack screen)
  encryption/index.tsx           -- Encryption key manager (stack screen)
  encryption/add.tsx             -- Import/generate key (stack screen)
```

### Wireframe Position

```
Hub Dashboard
  |-- MyMail card (unread badge)
       |-- (mail) tab navigator
            |-- Inbox tab (index.tsx)
            |     |-- Account filter bar (colored dots on avatar)
            |     |-- Thread list (grouped conversations, dense rows not cards)
            |     |-- [tap thread] -> Thread Detail (thread/[id].tsx)
            |     |     |-- Chronological messages (expanded = glass.card, collapsed = flat row)
            |     |     |-- Quick reply bar (plain text, expand to full compose)
            |     |-- [compose FAB] -> Compose (compose-message.tsx)
            |
            |-- Folders tab (folders.tsx)
            |     |-- System folders (Inbox, Sent, Drafts, Starred, Trash, Spam)
            |     |-- Custom folders
            |     |-- Per-folder unread counts
            |     |-- [tap folder] -> filtered inbox view
            |     |-- [+] -> create custom folder
            |
            |-- Search tab (search.tsx)
            |     |-- Full-text search with recent history
            |     |-- Quick filter chips (Unread, Starred, Attachments, Encrypted)
            |     |-- Results -> Thread Detail (thread/[id].tsx)
            |
            |-- Settings tab (settings.tsx)
                  |-- Sync status (glass.strong, dominant top position)
                  |-- Accounts row -> accounts/index.tsx
                  |-- Contacts row -> contacts/index.tsx
                  |-- Filters row -> filters/index.tsx
                  |-- Notifications row -> notifications.tsx
                  |-- Encryption row -> encryption/index.tsx
                  |-- Calendar Events row -> calendar-events.tsx
```

### Data Model Summary

12 tables across 2 schema migrations:

| Table | Key Fields | Engine |
|-------|-----------|--------|
| `ml_accounts` | email, display_name, server_host, server_port, is_active, color, signature | imap |
| `ml_messages` | subject, from, to (JSON), body, is_read, is_starred, folder, received_at, message_id_header, in_reply_to, references, thread_id | search, threading |
| `ml_drafts` | subject, to (JSON), body, cc, bcc, reply_to_message_id | -- |
| `ml_folders` | name, icon, sort_order, is_system | -- |
| `ml_attachments` | filename, mime_type, size_bytes, local_path, is_inline, content_id | attachments |
| `ml_filters` | name, field, pattern, action, action_value, is_active, priority | filters |
| `ml_contacts` | email, display_name, avatar_url, company, phone, notes, is_vip, source, frequency | contacts |
| `ml_threads` | subject, participant_emails (JSON), message_count, unread_count, latest_message_at, is_muted | threading |
| `ml_calendar_events` | title, description, location, start_time, end_time, organizer, attendees (JSON), ics_uid, rsvp_status, is_all_day | calendar |
| `ml_notification_preferences` | enabled, quiet_start, quiet_end, vip_only, show_preview, sound | notifications |
| `ml_encryption_keys` | key_type, public_key, private_key_encrypted, fingerprint, contact_email, is_own_key, is_revoked, expires_at | encryption |
| `ml_sync_state` | folder, last_uid, last_sync_at, uidvalidity, status, error_message | imap |

### Dependencies
- **Internal:** `@mylife/mail` (all 8 engines, all CRUD functions), `@mylife/ui` (Cool Obsidian tokens, Card, Text), `@mylife/db` (database provider)
- **External:** `expo-router` (tabs + stack), `expo-document-picker` (attachment selection), `expo-file-system` (attachment storage), `expo-haptics` (swipe feedback), `expo-clipboard` (copy email address)
- **Cross-Module:** None for V1. Future: RSVP module calendar event sync, contacts shared with other modules.

## Screen Designs

### Screen 1: Inbox Tab (`index.tsx`)

**Purpose:** Primary screen. Threaded conversation list with multi-account support, swipe actions, and unread badges.

**Layout:**
```
[Header]
  "Inbox" title + unread count badge
  [Search icon] -> search.tsx
  [Compose FAB, bottom-right] -> compose-message.tsx

[Account Filter Bar] (horizontal scroll, only if 2+ accounts)
  "All" chip (default) + per-account colored dots
  Each chip: account color dot + short email label + unread count
  Tap to filter threads to that account

[SectionList - grouped by date: Today, Yesterday, This Week, Earlier]
  Thread Row (per thread, dense row on `background`, NOT a card):
    Row height: 76px min, `md` padding horizontal, `sm` padding vertical
    Bottom separator: 1px `border` color

    [Left] Avatar circle (40px, `pill` radius, initials from generateInitials, bg from getAvatarColor)
      - Unread dot: 10px filled circle, module accent, overlaid on avatar bottom-left
      - Account color dot: 8px circle at avatar bottom-right (from ACCOUNT_COLORS, only if 2+ accounts)

    [Center]
      - Sender name: `subheading` (18px/600), `text` color if unread, `textSecondary` if read
      - Subject line: `body` (16px/400), `text` color, single line, numberOfLines={1}
      - Body preview: `body` (16px/400), `textSecondary`, single line

    [Right]
      - Timestamp: `caption` (13px/500), `textSecondary`, right-aligned
      - Unread dot (only, no count badge)

    NOTE: Star, mute, attachment, calendar, and lock icons are NOT shown in the row.
    They appear in the thread detail header. This keeps scan speed fast (5 elements max per row).

  Swipe Actions:
    [Swipe right] -> Toggle read/unread (markAsRead)
    [Swipe left, short] -> Star (toggleStar on latest message)
    [Swipe left, long] -> Trash (moveToFolder 'Trash')

  Pull-to-refresh -> trigger IMAP sync
```

**Engine Functions Used:**
- `getThreads(db, accountId, limit, offset)` -- paginated thread list
- `getMessages(db, { folder: 'Inbox', accountId })` -- message data for threads
- `getMailStats(db, accountId)` -- unread counts for account filter bar
- `getUnreadCount(messages)` -- per-thread unread count
- `resolveContact(email, contacts)` -- sender display name
- `generateInitials(name)` -- avatar initials
- `getAvatarColor(email)` -- deterministic avatar color
- `getAccounts(db)` -- account list for filter bar
- `markAsRead(db, id)` -- swipe action
- `toggleStar(db, id)` -- swipe action
- `moveToFolder(db, id, 'Trash')` -- swipe action

**States:**
| State | What User Sees |
|-------|---------------|
| Loading | Skeleton rows (shimmer) with avatar circles |
| Empty (no accounts) | Triggers onboarding.tsx (full-screen wizard, not inline CTA) |
| Empty (no messages) | Mail icon + "Your inbox is clear" (`subheading`) + "New messages will appear here" (`body`, `textSecondary`) |
| Has threads | Scrollable thread list grouped by date |
| Account filtered | Only threads from selected account, header shows account email |
| Syncing | Subtle spinner in header bar, "Syncing..." label |
| Sync error | Banner: "Sync failed for [account]" with retry button |
| Offline | Banner: "Offline -- showing cached messages" |

---

### Screen 2: Thread Detail (`thread/[id].tsx`)

**Purpose:** Conversation view showing all messages in a thread chronologically. The primary reading experience.

**Layout:**
```
[Header]
  Thread subject (bold, large)
  Participant count: "3 participants"
  [Mute toggle] bell / bell-slash icon
  [More menu] -> Archive, Move to folder, Delete thread

[ScrollView - chronological messages]
  Messages use two visual treatments to create rhythm:

  [Collapsed state - flat row on `background`, NO card wrapping, tap to expand]
    Avatar (32px) + sender name (`body`, `textSecondary`) + timestamp (`caption`)
    Body preview (2 lines, `body`, `textSecondary`)
    Bottom separator: 1px `border`

  [Expanded state - `glass.card` surface, `xl` border-radius, `md` padding]
    Avatar (40px) + sender name (`subheading`, `text`, bold)
    From: sender@email.com (`caption`, `textSecondary`)
    To: recipient1, recipient2 (`caption`, `textSecondary`)
    Timestamp (full: "Mar 15, 2026, 3:42 PM", `caption`)

      [Encryption badge] (conditional)
        "Encrypted" green badge if isPgpEncrypted
        "Signed" blue badge if hasPgpSignature

      Message body (rendered HTML or plain text)

      [Attachment section] (conditional, if attachments exist)
        Attachment chips: icon + filename + size (formatFileSize)
        Image attachments: inline preview thumbnails (isPreviewableImage)
        PDF attachments: PDF icon + filename (isPdf)
        [tap] -> open/share attachment

      [Calendar Event Card] (conditional, if events detected)
        Event title, date/time, location
        RSVP buttons: Accept / Decline / Tentative
        [tap Accept] -> updateRsvpStatus + generateRsvpReply

      [Action bar]
        Reply -> compose-message.tsx (pre-filled reply)
        Reply All -> compose-message.tsx (all recipients)
        Forward -> compose-message.tsx (forwarded body)
        Star toggle
        More: Move, Print, Mark unread

  [Bottom] Quick reply bar (`glass.dock` surface, fixed bottom)
    [Expand icon] plain text input (1 line, expands to 4 max) + [Send button]
    Plain text only, no formatting toolbar, no attachments
    Expand icon opens full compose-message.tsx with current text preserved
    Send uses thread's account. No draft auto-save for quick reply (lightweight)
```

**Engine Functions Used:**
- `getThread(db, id)` -- thread metadata
- `getMessages(db, { folder, accountId })` + filter by thread -- messages in thread
- `sortThreadMessages(messages)` -- chronological order
- `buildThreadMetadata(messages)` -- participant list, unread count
- `resolveContact(email, contacts)` -- sender display names
- `generateInitials(name)` + `getAvatarColor(email)` -- avatars
- `getAttachmentsByMessage(db, messageId)` -- per-message attachments
- `formatFileSize(bytes)` -- attachment size display
- `isPreviewableImage(mimeType)` -- inline image preview
- `isPdf(mimeType)` -- PDF icon treatment
- `isPgpEncrypted(body)` -- encryption badge
- `hasPgpSignature(body)` -- signature badge
- `getCalendarEventsByMessage(db, messageId)` -- calendar event cards
- `updateRsvpStatus(db, eventId, status)` -- RSVP action
- `generateRsvpReply(event, email, status)` -- iCal reply generation
- `muteThread(db, id, muted)` -- mute toggle
- `markAsRead(db, id)` -- auto-mark read on open

**States:**
| State | What User Sees |
|-------|---------------|
| Loading | Skeleton message cards |
| Single message | Full message expanded, no collapse controls |
| Multi-message | Latest expanded, older collapsed (tap to expand) |
| Has attachments | Attachment section visible per message |
| Has calendar event | RSVP card with accept/decline/tentative buttons |
| Encrypted thread | Lock icon in header, per-message encryption badges |
| Muted thread | Bell-slash icon in header, "Muted" label |
| Error loading | `glass.card` with error message + "Retry" button |
| HTML render failure | Falls back to plain text extraction with "Simplified view" label |

---

### Screen 3: Message Detail (`message/[id].tsx`) -- Lightweight Fallback

**Purpose:** Lightweight single-message view for deep links and direct navigation only. Thread detail (Screen 2) is the canonical reading surface for all inbox/search/folder navigation. This screen exists as a fallback when a direct link targets a specific message without thread context.

**Layout:**
```
[Header]
  Subject line (large, bold)
  [Star toggle] [More menu]

[ScrollView]
  Sender Card
    Avatar (initials + color) + sender name + email
    [VIP badge] if contact is VIP
    Timestamp: "Mar 15, 2026, 3:42 PM"
    Account badge (colored dot + account email)

  Recipients
    To: chip list of recipients
    CC: chip list (if present)
    [tap chip] -> contact detail or "Add to contacts"

  [Encryption Status] (conditional)
    Green: "End-to-end encrypted" with lock icon
    Blue: "Digitally signed" with shield icon
    Gray: "Not encrypted" (only shown in encryption settings enabled mode)

  Message Body
    Rendered content (HTML sanitized or plain text)
    Inline images rendered in-place (isInline attachments)

  [Attachments Section] (conditional)
    Section header: "Attachments (N)" + total size
    Grid of attachment cards:
      - Image: thumbnail preview + filename + size
      - PDF: PDF icon + filename + size
      - Other: file type icon + filename + size
    Actions per attachment: Open, Share, Save

  [Calendar Events Section] (conditional)
    Parsed from ICS attachments (parseIcs) or detected dates (detectDatesInBody)
    Event card: title, date range, location, organizer
    RSVP row: Accept / Tentative / Decline buttons
    "Add to Calendar" button

  [Action Row - fixed bottom]
    Reply | Reply All | Forward | Delete
```

**Engine Functions Used:**
- `getMessage(db, id)` -- message data
- `resolveContact(email, contacts)` -- sender/recipient display names
- `generateInitials(name)` + `getAvatarColor(email)` -- avatar
- `getAttachmentsByMessage(db, messageId)` -- attachments
- `formatFileSize(bytes)` -- size display
- `isPreviewableImage(mimeType)` -- image thumbnail
- `isPdf(mimeType)` -- PDF treatment
- `getMimeType(filename)` -- fallback type detection
- `getCalendarEventsByMessage(db, messageId)` -- associated events
- `parseIcs(content)` -- parse ICS attachment content
- `detectDatesInBody(body)` -- detect dates in plain text
- `eventToInput(event, messageId, accountId)` -- convert to calendar event
- `updateRsvpStatus(db, eventId, status)` -- RSVP action
- `generateRsvpReply(event, email, status)` -- iCal reply
- `isPgpEncrypted(body)` -- encryption status
- `hasPgpSignature(body)` -- signature status
- `markAsRead(db, id)` -- auto-mark on open
- `toggleStar(db, id)` -- star action
- `moveToFolder(db, id, folder)` -- move/delete
- `getAccount(db, accountId)` -- account info for badge

**States:**
| State | What User Sees |
|-------|---------------|
| Loading | Skeleton layout |
| Plain text | Body rendered as plain text with link detection |
| HTML | Sanitized HTML rendering |
| Has attachments | Attachment grid visible |
| Has inline images | Images rendered within body |
| Has calendar invite | RSVP card prominent below body |
| Encrypted | Decrypted body (if own key available) or "Cannot decrypt" message |
| Deleted/Trash | "Message in Trash" banner + "Restore" button |

---

### Screen 4: Compose Message (`compose-message.tsx`)

**Purpose:** Full email composer with contact autocomplete, attachments, encryption status, and draft auto-save.

**Layout:**
```
[Header]
  "Cancel" (left) -- save as draft prompt
  "Send" button (right, blue, disabled until valid)
  Account selector (if multiple accounts, shows colored dot + email)

[Form - ScrollView]
  From: [Account picker dropdown] (only if 2+ accounts)
    Shows account email with color dot

  To: [Token input field]
    Type to search -> autoComplete(query, contacts)
    Autocomplete dropdown: avatar + name + email, VIP badge, frequency indicator
    Tokens: chips with name, [x] to remove
    [+] button -> contacts/index.tsx (pick from directory)

  CC: [Token input, collapsed by default, tap "Add CC" to show]
  BCC: [Token input, collapsed by default, tap "Add BCC" to show]

  Subject: [Text input]

  [Encryption Status Bar] (conditional, shown if own PGP key exists)
    Green: "Will be encrypted" if canEncrypt for all recipients
    Amber: "Cannot encrypt -- missing keys for: [emails]"
    [tap] -> encryption/index.tsx

  Body: [Rich text area]
    Toolbar: Bold, Italic, Link, Quote, List
    [Quoted text] (if replying/forwarding, collapsible)

  [Attachments Bar] (visible if attachments added)
    Horizontal scroll of attachment chips
    Each: icon + filename + size (formatFileSize) + [x] remove
    Total size indicator + limit warning (if approaching 50 MB)

  [Bottom Toolbar]
    Attach file (expo-document-picker)
    Attach photo (expo-image-picker)
    Discard draft
    Save draft

  [Draft auto-save] -- saves to ml_drafts every 30 seconds or on navigation away
```

**Engine Functions Used:**
- `autoComplete(query, contacts, limit)` -- recipient autocomplete
- `resolveContact(email, contacts)` -- display names for tokens
- `generateInitials(name)` + `getAvatarColor(email)` -- autocomplete avatars
- `nameFromEmail(email)` -- fallback name extraction
- `gravatarUrl(email)` -- avatar image (if available)
- `canEncrypt(recipientEmails, keys)` -- encryption status check
- `findOwnKey(accountId, keys)` -- check if own key exists
- `getMimeType(filename)` -- attachment type detection
- `isBlockedExtension(filename)` -- reject dangerous files
- `validateFileSize(sizeBytes)` -- per-file size check
- `validateTotalSize(existing, newSize)` -- total size check
- `formatFileSize(bytes)` -- display attachment sizes
- `getAccounts(db)` -- account picker
- `createDraft(db, id, input)` -- auto-save
- `updateDraft(db, id, input)` -- subsequent saves
- `createAttachment(db, id, input)` -- attach files
- `deleteAttachment(db, id)` -- remove attachment
- `getAttachmentsByDraft(db, draftId)` -- load draft attachments
- `incrementContactFrequency(db, accountId, email)` -- on send

**States:**
| State | What User Sees |
|-------|---------------|
| Fresh compose | Empty form, cursor in To field |
| Reply | To pre-filled, subject "Re: ...", quoted body |
| Reply All | To + CC pre-filled from original recipients |
| Forward | Subject "Fwd: ...", original body + attachments |
| From draft | Restored draft content, "Draft" label in header |
| Autocomplete active | Dropdown below To field with matching contacts |
| Encryption available | Green bar: "Will be encrypted" |
| Encryption partial | Amber bar with missing key recipients listed |
| Attachment limit | Red warning: "Total size exceeds 50 MB" |
| Blocked file | Toast: "File type not allowed" |
| Sending | Send button shows spinner, form disabled |
| Sent | Success haptic + navigate back to inbox |
| Send failed | Re-enable form, inline error banner ("Authentication failed for [account]" / "Network unavailable"), auto-save to drafts, primary "Retry" CTA |
| Discard draft dialog | Alert: "Save Draft?" / body: "Your changes will be lost." / buttons: "Save Draft" (primary), "Discard" (destructive, `danger`), "Cancel" (ghost) |

---

### Screen 5: Folders Tab (`folders.tsx`)

**Purpose:** Browse all folders across accounts with message counts. Manage custom folders.

**Layout:**
```
[Header]
  "Folders" title
  [+ button] -> create custom folder dialog

[Account Sections] (one section per account, or unified if single account)
  Account header: colored dot + email + sync status

  System Folders (always present, from SYSTEM_FOLDERS constant):
    Inbox    [inbox icon]     -- unread count badge
    Sent     [send icon]      -- total count
    Drafts   [file-text icon] -- draft count
    Starred  [star icon]      -- starred count
    Trash    [trash icon]     -- total count
    Spam     [alert icon]     -- total count

  Custom Folders (user-created, sorted by sort_order):
    [folder icon] Folder name -- message count
    [long press] -> Edit (rename, reorder) / Delete

  [tap any folder] -> navigate to inbox tab filtered by folder

[Create Folder Dialog] (modal)
  Folder name input
  Icon picker (optional)
  Account selector (if multiple accounts)
  "Create" button
```

**Engine Functions Used:**
- `getFolders(db, accountId)` -- folder list per account
- `getMailStats(db, accountId)` -- per-folder message/unread counts
- `getAccounts(db)` -- account sections
- `createFolder(db, id, input)` -- new custom folder
- `getSyncStates(db, accountId)` -- sync status per folder

**States:**
| State | What User Sees |
|-------|---------------|
| Loading | Skeleton folder rows |
| Single account | No account headers, flat folder list |
| Multiple accounts | Sections with colored account headers |
| Has custom folders | Custom section below system folders |
| Empty custom | Only system folders visible |
| Syncing | Per-account spinner + "Syncing..." |
| Sync error | Red status icon + error message per account |

---

### Screen 6: Contacts Directory (`contacts/index.tsx`)

**Purpose:** Manage email contacts with VIP designation, frequency tracking, and search. Supports manual creation and auto-created contacts from sent mail.

**Layout:**
```
[Header]
  "Contacts" title
  [Search icon] -> inline search bar
  [+ button] -> add contact form

[Filter Chips] (horizontal scroll)
  All | VIP Only | Recent | Auto-created

[SectionList - alphabetical by display name]
  Contact Row:
    [Left] Avatar circle (initials + color, or gravatar image)
      VIP badge (star overlay, gold)
    [Center]
      Display name (bold) or email if no name
      Email address (secondary)
      Company (tertiary, if set)
    [Right]
      Frequency indicator (dots: low/med/high based on frequency count)
      Source badge: "manual" / "auto" / "device" / "imported"

  [tap] -> contacts/[id].tsx
  [swipe right] -> Toggle VIP (toggleContactVip)
  [swipe left] -> Delete contact

[Contact Detail - contacts/[id].tsx]
  Avatar (large) + initials/gravatar
  Display name (editable)
  Email (read-only)
  Company (editable)
  Phone (editable, tap to call)
  Notes (editable, multi-line)
  VIP toggle switch
  Source label + first contacted / last contacted dates
  Frequency: "Contacted X times"

  [Encryption section] (if PGP key exists for this contact)
    Key fingerprint
    Key type (RSA/x25519/PGP)
    Expires: date or "Never"
    Status: Active / Revoked / Expired

  [Action buttons]
    Compose email -> compose-message.tsx (pre-filled To)
    View messages -> inbox filtered by from: email

  Danger Zone: Delete contact
```

**Engine Functions Used:**
- `getContacts(db, accountId)` -- full contact list (sorted by frequency)
- `searchContacts(db, accountId, query)` -- contact search
- `createContact(db, id, input)` -- add contact
- `updateContact(db, id, input)` -- edit contact
- `toggleContactVip(db, id)` -- VIP toggle
- `deleteContact(db, id)` -- remove contact
- `generateInitials(name)` + `getAvatarColor(email)` -- avatar
- `gravatarUrl(email)` -- avatar image attempt
- `nameFromEmail(email)` -- fallback name
- `findKeyForContact(email, keys)` -- encryption key lookup
- `getEncryptionKeys(db, accountId)` -- key list for contact

**States:**
| State | What User Sees |
|-------|---------------|
| Loading | Skeleton contact rows |
| Empty | Contact icon + "Your address book is ready" + "Contacts appear automatically as you send email, or add them manually." + [Add Contact] CTA |
| Has contacts | Alphabetical list with section headers (A, B, C...) |
| VIP filter | Only VIP contacts shown |
| Search active | Filtered results, "No matches" if empty |
| Contact detail | Full editable contact card |

---

### Screen 7: Filter Manager (`filters/index.tsx` + `filters/edit.tsx`)

**Purpose:** Create and manage email filter rules that automatically move, star, mark as read, or delete incoming messages.

**Layout:**
```
[filters/index.tsx - Filter List]

[Header]
  "Filters" title
  [+ button] -> filters/edit.tsx (new filter)

[Grouped List - sorted by priority] (rows on `background` + `border` separators, NOT cards)
  Filter Row:
    [Left] Priority number (`caption`, `textTertiary`)
    [Center]
      Filter name (`subheading`)
      Rule summary: "When [field] contains '[pattern]' -> [action]" (`body`, `textSecondary`)
    [Right]
      Active/inactive toggle (toggleFilter)
      [chevron] -> filters/edit.tsx?id=X

  [Swipe left] -> Delete filter (with confirmation)

[Empty state] (`glass.card`, DESIGN.md warmth pattern)
  Mail filter icon (module-specific, not generic)
  "Tame your inbox" (`subheading`, `text`)
  "Create rules to sort newsletters, flag VIP senders, and auto-archive noise." (`body`, `textSecondary`)
  [Create First Filter] button (module accent, primary)

---

[filters/edit.tsx - Filter Editor]

[Header]
  "Cancel" (left)
  "Save" (right)

[Form]
  Name: [Text input] "e.g., Newsletter filter"

  Condition Section:
    Field picker: From | To | Subject | Body
    Pattern: [Text input] "e.g., newsletter@"
    (visual: "When [From] contains [newsletter@]")

  Action Section:
    Action picker: Move to folder | Star | Mark as read | Delete
    [If "Move to folder" selected]:
      Folder picker dropdown (from getFolders)
    (visual: "Then [Move to] [Promotions]")

  Priority: [Number stepper] (lower = higher priority)
    Helper text: "Filters run in priority order. First match wins."

  Test Section:
    "Test against inbox" button
    Result: "Would match X of Y messages" (from countMatches)

  [If editing existing filter]
    Danger Zone: Delete filter button
```

**Engine Functions Used:**
- `getFilters(db, accountId)` -- filter list
- `createFilter(db, id, input)` -- new filter
- `toggleFilter(db, id)` -- enable/disable
- `deleteFilter(db, id)` -- remove filter
- `applyFilters(message, filters)` -- preview filter matching
- `matchesFilter(message, filter)` -- per-filter match check
- `countMatches(messages, filter)` -- test mode count
- `getMessages(db, { folder: 'Inbox' })` -- messages for test mode
- `getFolders(db, accountId)` -- folder picker for "move" action

**States:**
| State | What User Sees |
|-------|---------------|
| Loading | Skeleton filter cards |
| Empty | Illustration + create CTA |
| Has filters | Priority-sorted list with toggle switches |
| Filter disabled | Grayed out card, toggle off |
| Editing filter | Full form with current values |
| Test results | "Would match X messages" with preview list |
| New filter | Empty form with field/action pickers |

---

### Screen 8: Settings Tab (`settings.tsx`)

**Purpose:** Hub for all mail configuration: accounts, contacts, filters, notifications, encryption, calendar events, and sync status.

**Layout:**
```
[ScrollView]
  [Sync Status Section] (`glass.strong` surface, `lg` padding, dominant top position)
    "All Synced" or "Syncing..." (`heading` typography)
    Per-account row: colored dot + email + last sync time (`body`/`caption`)
    Status: "Synced" (green) / "Syncing..." (blue spinner) / "Error" (red)
    [tap if error] -> show error message + "Retry" button
    "Sync All" button (`ghost` style)

  [Section: Accounts]
    Row: "Accounts" + account count badge
    Subtitle: list of active account emails
    [chevron] -> accounts/index.tsx

  [Section: Mail Settings]
    Row: "Contacts" + contact count -> contacts/index.tsx
    Row: "Filters" + active filter count -> filters/index.tsx
    Row: "Calendar Events" + event count -> calendar-events.tsx

  [Section: Notifications]
    Row: "Notification Preferences" -> notifications.tsx
    Quick toggle: "Push Notifications" (master on/off)

  [Section: Security]
    Row: "Encryption (PGP)" + key count badge -> encryption/index.tsx
    Subtitle: "X keys" or "Not configured"

  [Section: Data]
    Row: "Storage" + total DB size
    Row: "Clear Trash" -> delete all messages in Trash folder
    Row: "Clear Spam" -> delete all messages in Spam folder
```

**Engine Functions Used:**
- `getAccounts(db)` -- account list/count
- `getSyncStates(db, accountId)` -- per-account sync status
- `getContacts(db, accountId)` -- contact count
- `getFilters(db, accountId)` -- active filter count
- `getNotificationPreferences(db, accountId)` -- notification status
- `getEncryptionKeys(db, accountId)` -- key count
- `getMailStats(db)` -- trash/spam counts

---

### Screen 9: Account Manager (`accounts/index.tsx` + `accounts/add.tsx`)

**Purpose:** Add, edit, and manage multiple email accounts with IMAP auto-discovery for major providers.

**Layout:**
```
[accounts/index.tsx - Account List]

[Header]
  "Accounts" title
  [+ button] -> accounts/add.tsx

[Grouped List] (rows on `background` + `border` separators, NOT cards)
  Account Row:
    Account color dot (8px, left) + email address (`subheading`)
    Display name (`body`, `textSecondary`)
    Active toggle switch (right)
    Sync status: "Synced" / "Error" (`caption`, green/red)
    [chevron] -> accounts/add.tsx?id=X (edit mode)

  [Swipe left] -> Delete account (with "this deletes all messages" warning)

---

[accounts/add.tsx - Add/Edit Account]

[Header]
  "Cancel" (left)
  "Save" (right)

[Form - stepped wizard for new, full form for edit]

  Step 1: Email + Password
    Email address input
    Password input (for IMAP auth)
    "Next" button -> auto-discover server settings

  Step 2: Server Settings (auto-filled if provider recognized)
    Auto-discovery banner: "Detected Gmail settings" (or provider name)
    IMAP Host + Port + Security (SSL/STARTTLS/None)
    SMTP Host + Port + Security
    Auth Method: Password / OAuth2
    [Advanced toggle] -> show raw fields for manual config

  Step 3: Personalization
    Display name
    Account color picker (8 colors from ACCOUNT_COLORS)
    Signature (multi-line text)
    Set as default account toggle

  "Test Connection" button -> validate IMAP/SMTP connectivity
  "Save" button

[Supported Providers] (shown as helper on Step 1)
  Gmail, Outlook/Hotmail/Live, Yahoo, iCloud, ProtonMail (via Bridge)
```

**Engine Functions Used:**
- `getAccounts(db)` -- account list
- `createAccount(db, id, input)` -- add account
- `updateAccount(db, id, input)` -- edit account
- `deleteAccount(db, id)` -- remove account (cascades)
- `autoDiscoverConfig(email)` -- auto-detect IMAP/SMTP settings
- `getSupportedProviders()` -- provider list for helper text
- `guessConfig(domain)` -- fallback config for unknown providers
- `upsertSyncState(db, id, accountId, folder, data)` -- init sync state
- `getSyncStates(db, accountId)` -- current sync status

**States:**
| State | What User Sees |
|-------|---------------|
| Loading | Skeleton account cards |
| Empty | Triggers onboarding.tsx if no accounts exist |
| Has accounts | Card list with color bars and status |
| Add: Step 1 | Email + password input |
| Add: Step 2 (auto-discovered) | Pre-filled server fields with provider banner |
| Add: Step 2 (manual) | Empty server fields for manual entry |
| Add: Step 3 | Personalization form |
| Connection test: pending | Spinner on "Test Connection" button |
| Connection test: success | Green checkmark + "Connection successful" |
| Connection test: failed | Red warning + error details |
| Edit mode | Full form with current values, delete button at bottom |

---

### Screen 10: Encryption Key Manager (`encryption/index.tsx` + `encryption/add.tsx`)

**Purpose:** Manage PGP encryption keys for end-to-end encrypted email. View own keys, import contact public keys, check encryption status per contact.

**Layout:**
```
[encryption/index.tsx - Key List]

[Header]
  "Encryption" title
  [+ button] -> encryption/add.tsx

[Section: Your Keys]
  Key Card (own keys, isOwnKey = true):
    Key type badge (RSA / x25519 / PGP)
    Fingerprint (monospace, truncated)
    Account email
    Status: Active (green) / Revoked (red) / Expired (amber)
    Created date
    Expires: date or "Never"
    [tap] -> key detail with full fingerprint + export option

[Section: Contact Keys]
  Key Card (contact keys, isOwnKey = false):
    Contact email + display name (if contact exists)
    Key type badge
    Fingerprint (truncated)
    Status: Active / Revoked / Expired
    [tap] -> key detail

[Empty state - no keys] (`glass.card`, DESIGN.md warmth pattern)
  Lock icon (module-specific)
  "End-to-end encryption" (`subheading`, `text`)
  "Encrypt your messages so only the intended recipient can read them. Generate your key pair to get started." (`body`, `textSecondary`)
  [Generate Key Pair] button (module accent, primary)
  [Import Public Key] button (`ghost` style)

---

[encryption/add.tsx - Import/Generate Key]

[Header]
  "Cancel" (left)

[Tab Selector]
  "Generate" | "Import"

[Generate Tab]
  Account selector (which account to generate for)
  Key type picker: RSA (most compatible) | x25519 (modern)
  Passphrase input (for private key encryption)
  "Generate Key Pair" button
  Result: fingerprint display + "Your public key can be shared with contacts"

[Import Tab]
  "Paste public key" text area
  OR "Import from file" button (expo-document-picker)
  Contact email (who this key belongs to)
  Auto-detect: isPgpPublicKey validation
  "Import" button
  Result: fingerprint + key type + contact association
```

**Engine Functions Used:**
- `getEncryptionKeys(db, accountId)` -- all keys for account
- `createEncryptionKey(db, id, input)` -- import or generate key
- `getKeyByFingerprint(db, fingerprint)` -- deduplicate on import
- `revokeKey(db, id)` -- revoke a key
- `deleteEncryptionKey(db, id)` -- remove key
- `computeFingerprint(publicKey)` -- fingerprint generation
- `findOwnKey(accountId, keys)` -- check own key exists
- `findKeyForContact(email, keys)` -- contact key lookup
- `canEncrypt(recipientEmails, keys)` -- encryption readiness check
- `isPgpPublicKey(text)` -- validate pasted key block

**States:**
| State | What User Sees |
|-------|---------------|
| Loading | Skeleton key cards |
| No keys | Explanation + generate/import CTAs |
| Has own key | "Your Keys" section with key card |
| Has contact keys | "Contact Keys" section with cards |
| Key revoked | Red "Revoked" badge, grayed card |
| Key expired | Amber "Expired" badge |
| Import: valid key pasted | Green checkmark + fingerprint preview |
| Import: invalid text | Red: "Not a valid PGP public key" |
| Generate: in progress | Spinner + "Generating key pair..." |
| Generate: complete | Success + fingerprint display |

---

### Screen 11: Notification Preferences (`notifications.tsx`)

**Purpose:** Per-account notification configuration with quiet hours, VIP-only mode, and preview settings.

**Layout:**
```
[ScrollView]
  [Per Account Sections] (one section per account)
    Account header: colored dot + email

    Master toggle: "Enable Notifications" (switch)

    [If enabled:]
      VIP Only: "Only notify for VIP contacts" (switch)
        Helper: "X contacts are currently marked as VIP"

      Show Preview: "Show message preview in notification" (switch)

      Sound picker: Default / Chime / Ping / None
        [tap] -> play sound preview

      Quiet Hours:
        "Enable Quiet Hours" toggle
        Start time picker (e.g., 10:00 PM)
        End time picker (e.g., 7:00 AM)
        Helper: "Notifications silenced 10:00 PM - 7:00 AM"
        Handles midnight wrap-around
```

**Engine Functions Used:**
- `getNotificationPreferences(db, accountId)` -- current prefs
- `upsertNotificationPreferences(db, id, accountId, input)` -- save changes
- `isQuietHours(quietStart, quietEnd)` -- preview current quiet status
- `getAccounts(db)` -- account sections
- `getContacts(db, accountId)` + filter VIP -- VIP count display

**States:**
| State | What User Sees |
|-------|---------------|
| Loading | Skeleton settings rows |
| Notifications disabled | Master toggle off, all options grayed |
| Notifications enabled | Full settings visible |
| VIP only mode | VIP toggle on + VIP count display |
| Quiet hours active | Time range displayed, "Currently in quiet hours" badge if applicable |
| No preferences saved | Default values shown (enabled, not VIP-only, preview on, default sound) |

---

### Screen 12: Calendar Events (`calendar-events.tsx`)

**Purpose:** Aggregated view of all calendar events extracted from emails. Quick RSVP management.

**Layout:**
```
[Header]
  "Calendar Events" title

[Filter Chips]
  All | Pending RSVP | Accepted | Declined

[SectionList - grouped by date, upcoming first]
  Event Card:
    [Left] Date block (month + day, large)
    [Center]
      Event title (bold)
      Time range (or "All Day")
      Location (if set, with map pin icon)
      Organizer email
      Attendee count: "X attendees"
    [Right]
      RSVP status badge:
        Pending (amber)
        Accepted (green)
        Declined (red)
        Tentative (blue)

  [tap] -> Event Detail (inline expansion or modal)
    Full description
    All attendees listed
    Source message link -> message/[id].tsx
    RSVP action buttons: Accept / Tentative / Decline
    "Add to Device Calendar" button

[Empty state]
  "No calendar events found in your emails"
  "Events are automatically detected from .ics attachments and meeting invitations"
```

**Engine Functions Used:**
- `getCalendarEventsByMessage(db, messageId)` -- events per message (aggregated across all messages)
- `getCalendarEventByIcsUid(db, icsUid)` -- deduplicate events
- `updateRsvpStatus(db, eventId, status)` -- RSVP action
- `generateRsvpReply(event, email, status)` -- iCal reply for RSVP
- `parseIcs(content)` -- parse new ICS content
- `normalizeIcsDate(icsDate)` -- normalize dates for display
- `eventToInput(event, messageId, accountId)` -- create event record

**States:**
| State | What User Sees |
|-------|---------------|
| Loading | Skeleton event cards |
| Empty | Illustration + explanation of event detection |
| Has events | Date-grouped event list |
| Pending filter | Only events with RSVP pending |
| Event expanded | Full details with RSVP buttons |
| RSVP submitted | Status badge updates, success haptic |

---

### Screen 13: Search (`search.tsx`)

**Purpose:** Full-text search across all messages with field-specific filters and recent search history.

**Layout:**
```
[Header]
  [Back button]
  [Search input, auto-focused] placeholder: "Search mail..."
  [Cancel button]

[Before search - Recent & Suggestions]
  Recent Searches (last 10, stored locally)
    [tap] -> execute search
    [x] -> remove from history

  Quick Filters:
    "Unread" chip -> isRead: false
    "Starred" chip -> isStarred: true
    "Has Attachments" chip -> filter by attachment presence
    "Encrypted" chip -> filter by PGP content

[During search - Real-time results]
  Account filter (optional, horizontal chips)

  [FlatList - results sorted by relevance/recency]
    Result Row:
      Avatar + sender name
      Subject (with search term highlighted)
      Body snippet (with search term highlighted, from MailSearchResult.snippet)
      Folder badge
      Timestamp
      [tap] -> message/[id].tsx or thread/[id].tsx

  Result count: "X results"

[Empty results]
  "No messages match '[query]'"
  Suggestion: "Try searching for sender name, subject, or message content"
```

**Engine Functions Used:**
- `searchMessages(messages, query)` -- full-text search across subject/from/body
- `getMessages(db, filter)` -- message pool to search
- `filterByDateRange(messages, from, to)` -- date-scoped search
- `groupByThread(results)` -- optionally group results by conversation
- `resolveContact(email, contacts)` -- sender display names in results
- `generateInitials(name)` + `getAvatarColor(email)` -- result avatars
- `getAccounts(db)` -- account filter chips

**States:**
| State | What User Sees |
|-------|---------------|
| Initial | Recent searches + quick filter chips |
| Typing | Real-time results (debounced 300ms) |
| Has results | Scrollable result list with highlights |
| No results | "No messages match" + search tips |
| Filtered | Account/folder filter applied, results narrowed |

---

## Function Coverage Matrix

Every exported function from `@mylife/mail` is covered by at least one screen:

| Engine | Functions | Covered By |
|--------|-----------|------------|
| **V1 CRUD** | createAccount, getAccount, getAccounts, updateAccount, deleteAccount | Accounts (S9) |
| | createMessage, getMessage, getMessages, getMessagesByAccount | Inbox (S1), Thread (S2), Message (S3) |
| | markAsRead, toggleStar, moveToFolder, deleteMessage | Inbox swipes (S1), Message actions (S3) |
| | createDraft, getDrafts, updateDraft, deleteDraft | Compose (S4) |
| | createFolder, getFolders | Folders (S5), Filter editor (S7) |
| | getMailStats | Inbox (S1), Folders (S5), Settings (S8) |
| **V2 CRUD** | createAttachment, getAttachmentsByMessage, getAttachmentsByDraft, deleteAttachment | Thread (S2), Message (S3), Compose (S4) |
| | createFilter, getFilters, toggleFilter, deleteFilter | Filters (S7) |
| | createContact, getContactByEmail, getContacts, searchContacts, updateContact, incrementContactFrequency, toggleContactVip, deleteContact | Contacts (S6), Compose autocomplete (S4) |
| | createThread, getThread, getThreads, updateThreadMetadata, muteThread, deleteThread | Inbox (S1), Thread (S2) |
| | createCalendarEvent, getCalendarEventsByMessage, getCalendarEventByIcsUid, updateRsvpStatus | Thread (S2), Message (S3), Calendar (S12) |
| | getNotificationPreferences, upsertNotificationPreferences | Notifications (S11) |
| | createEncryptionKey, getEncryptionKeys, getKeyByFingerprint, revokeKey, deleteEncryptionKey | Encryption (S10), Contacts (S6) |
| | upsertSyncState, getSyncState, getSyncStates | Settings (S8), Accounts (S9) |
| **search** | searchMessages, groupByThread, getUnreadCount, filterByDateRange | Search (S13), Inbox (S1) |
| **attachments** | getMimeType, getExtension, isBlockedExtension, validateFileSize, validateTotalSize, formatFileSize, isPreviewableImage, isPdf | Thread (S2), Message (S3), Compose (S4) |
| **filters** | applyFilters, matchesFilter, countMatches | Filters (S7) |
| **contacts** | generateInitials, getAvatarColor, resolveContact, autoComplete, nameFromEmail, gravatarUrl | Inbox (S1), Thread (S2), Compose (S4), Contacts (S6) |
| **threading** | normalizeSubject, resolveThread, buildThreadMetadata, sortThreadMessages | Inbox (S1), Thread (S2) |
| **calendar** | parseIcs, normalizeIcsDate, detectDatesInBody, eventToInput, generateRsvpReply | Thread (S2), Message (S3), Calendar (S12) |
| **notifications** | buildNotification, isQuietHours, shouldNotify, batchNotification | Notifications (S11) + background push handler |
| **encryption** | computeFingerprint, findKeyForContact, findOwnKey, canEncrypt, isPgpEncrypted, hasPgpSignature, isPgpPublicKey | Encryption (S10), Compose (S4), Thread (S2), Message (S3) |
| **imap** | autoDiscoverConfig, getSupportedProviders, guessConfig, parseHeader, parseReferences | Accounts (S9) |

## Implementation Notes

### Navigation Update
The module definition (`definition.ts`) needs updating to reflect the design review changes:
- **Tabs:** Replace `compose` tab with `search` tab. New tabs: `inbox`, `folders`, `search`, `settings`.
- **Add screens:** `onboarding` (first-run wizard), `contacts/[id].tsx`, `encryption/add.tsx`, `filters/edit.tsx`.
- **Remove:** `compose` tab entry (compose is now a FAB + stack screen only).

### Routing Rules
- **Inbox tap** -> `thread/[id].tsx` (canonical reading surface)
- **Search result** -> `thread/[id].tsx` (scrolled to matching message)
- **Folder message tap** -> `thread/[id].tsx`
- **Deep link / notification** -> `message/[id].tsx` (lightweight fallback)
- Thread detail is the primary reading surface; message detail is never reached via normal navigation.

### Swipe Actions
Use `react-native-gesture-handler` Swipeable component with expo-haptics feedback. Keep swipe actions consistent: right-swipe = positive action (mark read), left-swipe = destructive/secondary (star, trash). Swipe lane colors: right = `accent` blue, left-short = amber `#FBBF24`, left-long = `danger` red. Icons: white, 24px. Labels: `label` typography, white.

### Account Color System
Use `ACCOUNT_COLORS` (8 predefined colors) as an 8px colored dot positioned at avatar bottom-right (status indicator pattern). Only shown when 2+ accounts are active. This replaces the earlier left-edge color bar design (which was flagged as AI slop pattern #8).

### Draft Auto-Save
Compose screen should auto-save drafts every 30 seconds and on any navigation event (back, tab switch, app background). Use a debounced timer that resets on each keystroke.

### Offline-First
All screens should render from local SQLite cache immediately. Sync operations happen in the background. Display "Last synced: X minutes ago" in the Settings tab. Show cached data with a "Syncing..." overlay when pull-to-refresh triggers.

### Encryption UX
PGP encryption should be discoverable but not forced. Show encryption status only when the user has at least one own key configured. The compose screen encryption bar appears conditionally. Never block sending if encryption is unavailable.

### Performance
- Inbox: paginate threads (50 per page) with infinite scroll
- Thread: lazy-expand messages (only render visible messages)
- Search: debounce 300ms, limit results to 100
- Contacts: alphabetical section list with fast-scroll index
- Attachments: thumbnail generation happens off-thread

## First-Run Onboarding Flow (`onboarding.tsx`)

When the mail module is enabled with zero accounts, intercept the tab navigator and show a dedicated full-screen onboarding wizard (not a settings sub-page).

**Step 0: Welcome**
```
[Full screen, `background`]
  Module icon (mail emoji, large)
  "Welcome to MyMail" (`heading`, `text`)
  "Your email stays on your device." (`body`, `textSecondary`)
  "No cloud. No tracking. No analytics." (`body`, `textSecondary`)
  [Get Started] button (module accent, primary)
```

**Step 1: Choose Provider**
```
  Provider logo grid (2x3):
    Gmail | Outlook | Yahoo
    iCloud | ProtonMail | Other
  Tap provider -> auto-fill Step 2
  Tap "Other" -> manual entry in Step 2
```

**Step 2: Email + Password**
```
  Email address input (`surface` fill, `border` outline)
  Password input (secure entry)
  Auto-discovery banner: "Detected Gmail settings" (green `success` text)
  Or manual IMAP/SMTP fields if "Other" selected
  [Next] button
```

**Step 3: Personalization**
```
  Display name input
  Account color picker (8 dots from ACCOUNT_COLORS)
  [Finish Setup] button
```

**Step 4: Initial Sync**
```
  "Syncing your inbox..." (`subheading`, `text`)
  Progress indicator (message count or folder progress)
  "This may take a minute for large mailboxes" (`body`, `textSecondary`)
  On completion: success haptic + transition to inbox tab
```

After the first account syncs, this flow is never shown again. Subsequent accounts are added via Settings > Accounts > Add.

## Design Token Map (Cool Obsidian)

### Surface Assignments

| Screen Type | Surface | Token |
|------------|---------|-------|
| Screen backgrounds | Deepest layer | `background` (#0A0A0F) |
| Inbox thread rows | Dense list, NO cards | `background` + `border` bottom separator |
| Thread detail collapsed messages | Flat rows | `background` + `border` separator |
| Thread detail expanded messages | Elevated content | `glass.card` |
| Compose form fields | Input containers | `surface` fill + `border` outline |
| Settings/Accounts/Filters/Keys rows | Grouped list items | `background` + `border` separator |
| Sync status card (Settings top) | Prominent status | `glass.strong` |
| Empty state containers | Warm CTA | `glass.card` |
| Quick reply bar | Fixed bottom dock | `glass.dock` |
| Modals/dialogs | Elevated | `surfaceElevated` |
| Filter chips / account chips | Interactive pills | `glass.card`, active: `glass.strong` + accent border |

### Typography Assignments

| Element | Variant | Size/Weight | Color |
|---------|---------|-------------|-------|
| Screen titles | `heading` | 24px/700 | `text` |
| Card titles, sender names (unread) | `subheading` | 18px/600 | `text` |
| Sender names (read) | `subheading` | 18px/600 | `textSecondary` |
| Message body, subject lines | `body` | 16px/400, 26px LH | `text` |
| Body preview, secondary info | `body` | 16px/400 | `textSecondary` |
| Timestamps, metadata | `caption` | 13px/500 | `textSecondary` |
| Badges, chip labels | `label` | 12px/600, UPPERCASE | varies |
| PGP fingerprints | monospace `caption` | 13px/500 | `textSecondary` |

### Spacing Assignments

| Context | Token | Value |
|---------|-------|-------|
| Screen padding (horizontal) | `lg` | 24px |
| Card internal padding | `md` | 16px |
| List row padding (horizontal) | `md` | 16px |
| List row padding (vertical) | `sm` | 8px |
| Between sections | `lg` | 24px |
| Icon-to-label gap | `xs` | 4px |
| Between filter chips | `sm` | 8px |
| Avatar size (list) | -- | 40px |
| Avatar size (collapsed thread msg) | -- | 32px |
| Thread row minimum height | -- | 76px |

### Motion Assignments

| Interaction | Duration | Easing | Effect |
|-------------|----------|--------|--------|
| Button press | 200ms | ease-out | scale(0.97) |
| Swipe action reveal | 200ms | ease-out | horizontal slide |
| Thread message expand/collapse | 300ms | ease-out | height animation + fade |
| Tab switch | instant | -- | iOS native tab transition |
| Screen push/pop | 300ms | -- | iOS native push/pop |
| Skeleton pulse | 1500ms | ease-in-out | opacity 0.4 -> 0.7 loop |
| Success haptic | instant | -- | expo-haptics notificationSuccess |
| Card appearance (dashboard) | 50ms stagger | ease-out | opacity 0 -> 1 + translateY(8 -> 0) |

## HTML Email Rendering Spec

Privacy-first email rendering with strict security defaults:

- **Renderer:** Sandboxed WebView (`originWhitelist={['about:blank']}`)
- **Sanitization:** Strip `<script>`, `<iframe>`, `<object>`, `<embed>` tags
- **Remote images:** Blocked by default. Show "Load Remote Images" button at top of body. Rationale: remote images = tracking pixels, which violates privacy-first principle
- **Links:** Open in system browser via `Linking.openURL` (not in-app WebView)
- **Max initial height:** 400px. If content exceeds, show "Show full message" expand button
- **Plain text fallback:** If HTML rendering fails, extract plain text and render with `body` typography. Show "Simplified view" label
- **Inline images:** Render from local attachment cache (`isInline` flag). Never fetch remotely without user action
- **CSS isolation:** WebView content styled with Cool Obsidian tokens (dark background, light text) to match the app chrome

## Accessibility

### VoiceOver / Screen Reader Support
- **Inbox thread rows:** `accessibilityRole="button"`, label: "[Sender name], [Subject], [Timestamp], [Unread/Read]"
- **Swipe actions:** Must have long-press alternative. Long-press on thread row shows action sheet: "Mark Read", "Star", "Move to Trash". Swipe gestures are invisible to screen readers
- **Thread messages:** `accessibilityRole="article"`, label: "Message from [sender], [timestamp]"
- **Encryption badges:** `accessibilityLabel="This message is encrypted"` / `"This message is digitally signed"`
- **VIP badges:** `accessibilityLabel="VIP contact"`
- **Compose autocomplete:** Uses `accessibilityRole="combobox"` on input, `"list"` on dropdown, `"option"` on each result
- **Account color dots:** `accessibilityLabel="[Account email] account"`

### Touch Targets
- All interactive elements: minimum 44px x 44px (per DESIGN.md)
- Swipe action hit zones: full row height
- Filter chips: minimum 36px height with `sm` padding (meets 44px with touch expansion)
- FAB compose button: 56px circle

### Focus Order
- Inbox: account filter bar -> thread list -> FAB
- Thread detail: header actions -> message list -> quick reply bar
- Compose: From -> To -> CC/BCC -> Subject -> Body -> toolbar -> Send
- Settings: sync status -> section rows (top to bottom)

## NOT in Scope (Design Review)

- **Web responsive breakpoints:** This is a mobile-only spec. Web UI is a separate spec.
- **Dark/light mode toggle:** MyLife is dark-only per DESIGN.md.
- **Custom notification sounds:** Sound picker UI is spec'd, but actual sound file creation is deferred.
- **Offline compose queue:** Spec covers offline display but not queuing outbound messages for later send. Deferred to V2.
- **Rich text editor implementation:** Compose specifies a toolbar (Bold, Italic, Link, Quote, List) but the exact rich text library choice is deferred to implementation.

## What Already Exists

- **DESIGN.md (hub-level):** Complete Cool Obsidian design system with tokens, typography, spacing, component patterns, motion, accessibility. All design decisions in this spec calibrate against it.
- **MyMail/DESIGN.md (module-level):** Outdated (V1 only, 4 tables). Needs updating after this spec ships.
- **`packages/ui/src/tokens/`:** Runtime token source of truth for colors, typography, spacing.
- **`@mylife/ui` components:** Card, Text, and other shared components already implement Cool Obsidian patterns.
- **Module definition (`definition.ts`):** Existing 4-tab + 10-screen navigation declaration. Needs updating per this spec's tab restructure.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR | 3 critical gaps (prior run, different plan) |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | DONE | Outside voice ran via codex |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 2 | CLEAR | 1 issue (doc cleanup), 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR | score: 6/10 -> 9/10, 10 decisions |

- **OUTSIDE VOICES:** Codex triggered hard rejection #7 (stacked cards), Claude subagent found 3 critical + 5 high severity items. All resolved in design review.
- **ENG REVIEW (re-run):** Validated post-design-review changes. 19 screens accepted (established module patterns). 1 doc cleanup (removed 3 stale function refs from inbox). 23 test gaps identified (all UI, engine layer 100% covered). 0 critical failure modes.
- **UNRESOLVED:** 0
- **VERDICT:** ENG + DESIGN + CEO CLEARED -- ready to implement.
