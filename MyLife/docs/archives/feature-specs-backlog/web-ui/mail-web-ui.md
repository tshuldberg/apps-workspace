# Feature Spec: MyMail Full Web UI

## Metadata
- **Module:** mail
- **Task ID:** W14-11
- **Priority Score:** 38 / 50 (A-Tier)
- **Scoring Breakdown:** Market 5 x3 + Switching 3 x3 + Complexity 2 x2 + CrossModule 2 x1 + PaidUser 3 x1
- **Sprint:** Sprint 3
- **Estimated CC Time:** 10-14 hours
- **Depends On:** All V1-V2 CRUD, 7 engines (search, attachments, filters, contacts, threading, calendar, notifications, encryption, imap), and mobile UI already implemented
- **Blocks:** Mail full cross-platform parity, web module completion dashboard metric
- **Reference Implementation:** `apps/web/app/books/` (layout, page, actions, sub-routes, tests)
- **Design Pipeline:** /office-hours (builder) -> /plan-eng-review -> /plan-design-review -> /design-consultation

## Phase 1: Office Hours (Builder Mode) -- Web UX Brainstorm

### What Makes a Mail Web App Delightful on Desktop

Desktop is where serious email happens. People write long-form replies, triage 50+ messages, manage multiple accounts, organize with folders and filters, and compose with care. A mail web UI has inherent advantages over mobile:

1. **Three-panel layout.** The defining desktop mail experience: folder sidebar + thread list + message reading pane, all visible simultaneously. Mobile shows one panel at a time with navigation push/pop. On desktop, you click a thread and the reading pane updates instantly without losing your place in the list. This is the single biggest UX difference.

2. **Keyboard-first triage.** Arrow keys to navigate threads. `E` to archive, `S` to star, `R` to reply, `A` to reply all, `F` to forward, `C` to compose, `#` to trash. Rapid triage with zero mouse usage. `Cmd+K` opens command palette for search and navigation.

3. **Multi-account unified inbox.** Desktop has room for an account switcher in the sidebar plus a unified "All Inboxes" view. Color-coded account indicators on each thread. Mobile squeezes this into a tiny filter bar.

4. **Dense thread lists.** Desktop can show sender avatar, sender name, subject, 2-line preview, date, attachment indicator, encryption badge, and unread dot all in a single row. Mobile truncates aggressively. Information density is the killer advantage.

5. **Rich compose experience.** Full-width compose with visible To/CC/BCC fields, contact autocomplete dropdown, attachment list, encryption status bar, and account picker, all without scrolling. Draft auto-save with visual indicator.

6. **Filter and folder management.** Data tables for filters with inline toggle/edit/delete. Drag-and-drop folder reordering. Bulk message operations (select multiple, move to folder, mark read, trash).

7. **Inline message actions.** Hover a message row to reveal star, archive, trash, and snooze buttons without clicking into the message first. Right-click context menus for power users.

### The Narrowest Wedge

**The three-panel inbox.** A fast, keyboard-driven inbox with folder sidebar on the left, scrollable thread list in the center, and reading pane on the right. The "I need this on desktop" moment: you have 30 unread emails, you can arrow-key through them reading each one in the side panel, star the important ones, archive the rest, and reply to two, all without a single page navigation. This is the experience that makes people switch from mobile to web for email.

### How Information Density Differs From Mobile

| Dimension | Mobile | Web |
|-----------|--------|-----|
| Panels visible | 1 at a time | 3 simultaneous (sidebar + list + reader) |
| Thread preview | Sender + subject + 1 line | Sender + subject + 2-line body preview + date + badges |
| Compose | Full-screen modal | Slide-over panel or dedicated page |
| Folder access | Tab bar + separate screen | Always-visible sidebar |
| Message actions | Swipe gestures | Hover buttons + keyboard shortcuts |
| Bulk operations | Long-press select mode | Checkbox column + batch action bar |
| Filter management | Separate settings screens | Inline data table with toggle/edit |
| Contact autocomplete | Dropdown over keyboard | Wide dropdown with avatar + company |
| Attachment preview | Tap to open | Inline thumbnails in message view |
| Account switching | Horizontal chip bar | Sidebar section with color dots |

### Linear/Raycast Aesthetic Patterns

- **Command palette (`Cmd+K`):** Primary search entry point, searches messages, contacts, and folders
- **Three-panel layout:** Folder rail (240px) + thread list (360px) + reading pane (fill). Collapsible sidebar.
- **Glass card surfaces:** Frosted translucent panels for message cards and compose overlay
- **Keyboard shortcuts displayed inline:** Show `R` next to Reply, `E` next to Archive, `Cmd+Enter` next to Send
- **Zero-chrome density:** No hero sections, no marketing. Every pixel serves triage or reading.
- **Hover micro-interactions:** Thread rows elevate slightly on hover, action buttons appear on hover only
- **Real-time unread counts:** Badge numbers on folder items in sidebar, update on markAsRead

## Phase 2: Engineering Review -- Architecture Lock

### Module Exports Audit

The `@mylife/mail` module exports 60+ functions across 10 categories. Here is what the web UI needs:

| Category | Functions Needed | Status |
|----------|-----------------|--------|
| **Account CRUD** | `createAccount`, `getAccount`, `getAccounts`, `updateAccount`, `deleteAccount` | None in actions.ts -- all need adding |
| **Message CRUD** | `createMessage`, `getMessage`, `getMessages`, `getMessagesByAccount`, `markAsRead`, `toggleStar`, `moveToFolder`, `deleteMessage` | None -- all need adding |
| **Draft CRUD** | `createDraft`, `getDrafts`, `updateDraft`, `deleteDraft` | None -- all need adding |
| **Folder CRUD** | `createFolder`, `getFolders` | None -- all need adding |
| **Stats** | `getMailStats` | None -- needs adding |
| **Search Engine** | `searchMessages`, `groupByThread`, `getUnreadCount`, `filterByDateRange` | None -- all need adding |
| **Attachment CRUD** | `createAttachment`, `getAttachmentsByMessage`, `getAttachmentsByDraft`, `deleteAttachment` | None -- all need adding |
| **Filter CRUD** | `createFilter`, `getFilters`, `toggleFilter`, `deleteFilter` | None -- all need adding |
| **Contact CRUD** | `createContact`, `getContactByEmail`, `getContacts`, `searchContacts`, `updateContact`, `incrementContactFrequency`, `toggleContactVip`, `deleteContact` | None -- all need adding |
| **Thread CRUD** | `createThread`, `getThread`, `getThreads`, `getMessagesByThread`, `updateThreadMetadata`, `muteThread`, `deleteThread` | None -- all need adding |
| **Calendar Events** | `createCalendarEvent`, `getCalendarEventsByMessage`, `getCalendarEventsByAccount`, `updateRsvpStatus` | None -- all need adding |
| **Notification Prefs** | `getNotificationPreferences`, `upsertNotificationPreferences` | None -- all need adding |
| **Encryption Keys** | `createEncryptionKey`, `getEncryptionKeys`, `getKeyByFingerprint`, `revokeKey`, `deleteEncryptionKey` | None -- all need adding |
| **Sync State** | `upsertSyncState`, `getSyncState`, `getSyncStates` | None -- all need adding |
| **Engine: Contacts** | `generateInitials`, `getAvatarColor`, `resolveContact`, `autoComplete`, `nameFromEmail`, `gravatarUrl` | None -- all need adding |
| **Engine: Threading** | `normalizeSubject`, `resolveThread`, `buildThreadMetadata`, `sortThreadMessages` | None -- all need adding |
| **Engine: Attachments** | `getMimeType`, `isBlockedExtension`, `validateFileSize`, `formatFileSize`, `isPreviewableImage`, `isPdf` | None -- all need adding |
| **Engine: Filters** | `applyFilters`, `matchesFilter`, `countMatches` | None -- all need adding |
| **Engine: Calendar** | `parseIcs`, `detectDatesInBody`, `eventToInput`, `generateRsvpReply` | None -- all need adding |
| **Engine: Encryption** | `canEncrypt`, `isPgpEncrypted`, `hasPgpSignature`, `findOwnKey`, `findKeyForContact` | None -- all need adding |
| **Engine: IMAP** | `autoDiscoverConfig`, `getSupportedProviders`, `guessConfig` | None -- all need adding |

### Missing Server Actions (actions.ts)

The current web has only a stub page.tsx. The web UI needs ~55 server actions:

```typescript
// Account CRUD -- 5 new
createAccountAction(input: CreateMailAccountInput)
fetchAccountAction(id: string)
fetchAccountsAction()
updateAccountAction(id: string, input: UpdateMailAccountInput)
deleteAccountAction(id: string)

// Message CRUD -- 8 new
createMessageAction(input: CreateMailMessageInput)
fetchMessageAction(id: string)
fetchMessagesAction(filter?: MessageFilterInput)
fetchMessagesByAccountAction(accountId: string)
markAsReadAction(id: string)
toggleStarAction(id: string)
moveToFolderAction(id: string, folder: string)
deleteMessageAction(id: string)

// Draft CRUD -- 4 new
createDraftAction(input: CreateMailDraftInput)
fetchDraftsAction(accountId?: string)
updateDraftAction(id: string, input: UpdateMailDraftInput)
deleteDraftAction(id: string)

// Folder CRUD -- 2 new
createFolderAction(input: CreateMailFolderInput)
fetchFoldersAction(accountId?: string)

// Stats -- 1 new
fetchMailStatsAction(accountId?: string)

// Search -- 4 new
searchMessagesAction(query: string, accountId?: string)
groupByThreadAction(messages: MailMessage[])
fetchUnreadCountAction(accountId?: string)
filterByDateRangeAction(start: string, end: string, accountId?: string)

// Attachment CRUD -- 4 new
createAttachmentAction(input: CreateAttachmentInput)
fetchAttachmentsByMessageAction(messageId: string)
fetchAttachmentsByDraftAction(draftId: string)
deleteAttachmentAction(id: string)

// Filter CRUD -- 4 new
createFilterAction(input: { accountId: string; name: string; field: string; pattern: string; action: string; actionValue?: string; priority?: number })
fetchFiltersAction(accountId: string)
toggleFilterAction(id: string)
deleteFilterAction(id: string)

// Contact CRUD -- 8 new
createContactAction(input: CreateMailContactInput)
fetchContactByEmailAction(accountId: string, email: string)
fetchContactsAction(accountId: string)
searchContactsAction(accountId: string, query: string)
updateContactAction(id: string, input: UpdateMailContactInput)
incrementContactFrequencyAction(accountId: string, email: string)
toggleContactVipAction(id: string)
deleteContactAction(id: string)

// Thread CRUD -- 7 new
createThreadAction(input: CreateMailThreadInput)
fetchThreadAction(id: string)
fetchThreadsAction(accountId: string, limit?: number, offset?: number)
fetchMessagesByThreadAction(threadId: string)
updateThreadMetadataAction(threadId: string, data: { messageCount: number; unreadCount: number; latestMessageAt: string; participantEmails: string[] })
muteThreadAction(id: string, muted: boolean)
deleteThreadAction(id: string)

// Calendar Events -- 4 new
createCalendarEventAction(input: CreateCalendarEventInput)
fetchCalendarEventsByMessageAction(messageId: string)
fetchCalendarEventsByAccountAction(accountId: string)
updateRsvpStatusAction(eventId: string, status: RSVPStatus)

// Notification Prefs -- 2 new
fetchNotificationPreferencesAction(accountId: string)
upsertNotificationPreferencesAction(accountId: string, input: UpdateNotificationPreferencesInput)

// Encryption Keys -- 5 new
createEncryptionKeyAction(input: CreateEncryptionKeyInput)
fetchEncryptionKeysAction(accountId: string)
fetchKeyByFingerprintAction(fingerprint: string)
revokeKeyAction(id: string)
deleteEncryptionKeyAction(id: string)

// Sync State -- 3 new
upsertSyncStateAction(accountId: string, folder: string, data: { lastUid?: string; uidvalidity?: string; status?: string; errorMessage?: string })
fetchSyncStateAction(accountId: string, folder: string)
fetchSyncStatesAction(accountId: string)
```

All server actions follow the books pattern: `'use server'` directive, import `getAdapter` and `ensureModuleMigrations` from `@/lib/db`, call `ensureModuleMigrations('mail')` before any query.

### Schema Verification

The schema (V1-V2) supports all planned features:
- **V1:** `ml_accounts`, `ml_messages`, `ml_drafts`, `ml_folders` with 8 indexes on account, folder, received_at, read, starred, compound account+folder
- **V2:** `ml_attachments`, `ml_filters`, `ml_contacts`, `ml_threads`, `ml_calendar_events`, `ml_notification_preferences`, `ml_encryption_keys`, `ml_sync_state` with 17 additional indexes. Also extends `ml_accounts` (IMAP/SMTP config, color, sort_order, is_default) and `ml_messages` (server_uid, message_id_header, in_reply_to, references, thread_id, encryption flags, has_attachments).

No schema gaps. All features have backend support. The 12 tables and 25+ indexes cover accounts, messages, drafts, folders, attachments, filters, contacts, threads, calendar events, notifications, encryption, and sync state.

### Web Route Structure (Next.js App Router)

```
apps/web/app/mail/
  layout.tsx                    -- Three-panel layout: sidebar + list + content
  page.tsx                      -- Main inbox: thread list + reading pane
  actions.ts                    -- All server actions (~55 functions)
  ui.ts                         -- Shared UI helpers (avatar, time formatting, thread grouping)
  compose/
    page.tsx                    -- Full compose page (To/CC/BCC, subject, body, attachments)
  thread/[id]/
    page.tsx                    -- Thread detail: conversation view with all messages
  message/[id]/
    page.tsx                    -- Single message detail with attachments, calendar events
  search/
    page.tsx                    -- Search results with quick filters and date range
  contacts/
    page.tsx                    -- Contact manager: data table with VIP, frequency
  contacts/[id]/
    page.tsx                    -- Contact detail: info, message history, VIP toggle
  folders/
    page.tsx                    -- Folder manager with system + custom folders
  filters/
    page.tsx                    -- Filter rules: data table with toggle, edit, delete
  filters/edit/
    page.tsx                    -- Filter editor: field, pattern, action, test
  accounts/
    page.tsx                    -- Account list with sync status, color, default flag
  accounts/add/
    page.tsx                    -- Add account: auto-discover + manual IMAP/SMTP config
  settings/
    page.tsx                    -- Mail settings: notifications, encryption, sync
  __tests__/
    inbox-page.test.tsx         -- Inbox thread list tests
    compose-page.test.tsx       -- Compose form tests
    thread-detail-page.test.tsx -- Thread conversation tests
    search-page.test.tsx        -- Search + filter tests
    contacts-page.test.tsx      -- Contact manager tests
    actions.test.ts             -- Server actions tests
    social-contract-parity.test.ts -- Parity with mobile feature set
```

### Data Flow

```
Inbox page load:
  -> fetchAccountsAction()
  -> If accounts.length === 0: show onboarding/add-account CTA
  -> fetchThreadsAction(selectedAccount, 50, 0) for each account (or selected)
  -> fetchMailStatsAction(selectedAccount) for sidebar badge counts
  -> fetchFoldersAction(selectedAccount) for sidebar folder list
  -> Client-side state: selectedAccount, selectedFolder, selectedThread, readingPaneThread

Thread selection:
  -> User clicks thread in list (or arrow key navigates)
  -> fetchMessagesByThreadAction(threadId)
  -> markAsReadAction(firstUnreadMessageId) if thread has unread
  -> Reading pane renders conversation
  -> fetchAttachmentsByMessageAction(messageId) for each message with hasAttachments
  -> fetchCalendarEventsByMessageAction(messageId) if ICS detected

Compose flow:
  -> User presses C or clicks Compose button
  -> Navigate to /mail/compose (or /mail/compose?replyTo=X for replies)
  -> autoComplete contact suggestions as user types in To field
  -> createDraftAction() on first edit, updateDraftAction() every 30s
  -> On send: createMessageAction() + deleteDraftAction()
  -> incrementContactFrequencyAction() for each recipient

Search flow:
  -> Cmd+K or click search
  -> searchMessagesAction(query, accountId)
  -> Quick filters (unread, starred, attachments, encrypted) applied client-side
  -> Date range filter uses filterByDateRangeAction()
  -> Results rendered as message cards with folder badge
```

### State Management

Client-side `useState` + `useEffect` pattern (same as books). No global state library needed. Each page manages its own state with server actions for data fetching. Key state patterns:

- **Inbox page:** `accounts[]`, `threads[]`, `selectedAccountId`, `selectedFolder`, `selectedThreadId`, `readingPaneMessages[]`, `stats`, `loading`, `error`
- **Compose page:** `selectedAccountId`, `toRecipients[]`, `ccRecipients[]`, `bccRecipients[]`, `subject`, `body`, `autoCompleteResults[]`, `activeField`, `draftId`, `sending`, `encryptionReady`
- **Search page:** `query`, `activeFilters`, `results[]`, `recentSearches[]`, `dateRange`
- **Contacts page:** `contacts[]`, `searchQuery`, `sortBy`, `filterVip`, `selectedContact`
- **Filters page:** `filters[]`, `editingFilter`, `testResults`

## Phase 3: Design Review -- Dimension Ratings

### Design Dimension Scores

| Dimension | Score | Rationale | What Makes It a 10 |
|-----------|-------|-----------|---------------------|
| **Information Architecture** | 9/10 | Three-panel layout maps to universal mail mental model (folders/threads/messages). 14 routes cover all mobile parity. | Add Cmd+K command palette for folder/contact/message search |
| **Information Density** | 10/10 | Three simultaneous panels, dense thread rows with avatar/sender/subject/preview/date/badges, inline hover actions | Already maximizing desktop real estate |
| **Keyboard Accessibility** | 9/10 | Full keyboard triage (J/K navigate, E archive, S star, R reply, C compose), Cmd+K search, Tab navigation | Ensure all shortcuts displayed in UI and discoverable |
| **Visual Hierarchy** | 9/10 | Unread threads bold, starred threads accented, folder unread counts prominent, reading pane dominates | Stronger sender avatar presence with Gravatar |
| **Cool Obsidian Compliance** | 10/10 | Blue accent (#3B82F6), glass cards, dark background, Inter font, all tokens from DESIGN.md | Already using correct token system |
| **Empty States** | 9/10 | Warm CTAs per DESIGN.md: "Your inbox is waiting" not "No messages" | Module-specific mail icon illustration |
| **Error States** | 9/10 | Inline retry, sync error banners, no technical IMAP errors exposed | Add offline detection banner per known pattern |
| **Loading States** | 9/10 | Skeleton screens: thread list skeletons, message body skeleton, sidebar skeleton | Ensure skeletons pulse at 60% opacity per DESIGN.md |
| **Responsiveness** | 8/10 | Desktop three-panel, tablet two-panel (list + reader), mobile single column | Test all 3 breakpoints (768, 1024, 1120+) with panel collapsing |
| **Micro-interactions** | 9/10 | Thread row hover elevation, star toggle animation, unread count decrement, compose overlay slide | Add subtle thread selection transition |

### All 5 States Designed Per Page

| Page | Loading | Empty | Error | Success | Partial |
|------|---------|-------|-------|---------|---------|
| **Inbox** | Skeleton thread rows (avatar circle + 3 text lines pulsing) | "Your inbox is waiting" + CTA to add account or compose first email | Red banner: "Could not load inbox" + Retry | Three-panel with populated thread list + reading pane | Filtered view: "Showing 12 starred" or "Showing Inbox (5 unread)" |
| **Thread Detail** | Skeleton message bubbles (sender + body placeholder) | N/A (always navigated from list) | "Could not load conversation" + Retry + Back | Full conversation with collapsible quoted text | Single message in thread (no expand needed) |
| **Compose** | N/A (form is immediate) | Pre-filled form with "Write your message..." placeholder | Inline field errors (invalid email, missing subject) | All fields populated, draft saved indicator visible | Partial recipients with autocomplete dropdown visible |
| **Search** | Skeleton result rows | "Search your mail" + recent searches + quick filter chips | "Search failed" + Retry | Result list with highlighted match terms | Filtered results: "12 unread messages matching 'invoice'" |
| **Contacts** | Skeleton table rows | "Your contacts will appear here" + "Contacts are added automatically from messages" | "Could not load contacts" + Retry | Data table with avatar, name, email, VIP star, frequency | Filtered: "3 VIP contacts" or search results |
| **Filters** | Skeleton rows | "No filters yet" + "Create a filter to auto-organize incoming mail" + CTA | "Could not load filters" + Retry | Filter table with toggle, field, pattern, action columns | One filter active, rest disabled |
| **Folders** | Skeleton sidebar items | Default system folders only (Inbox, Sent, Drafts, Starred, Trash, Spam) | "Could not load folders" + Retry | System + custom folders with unread counts | Custom folder with 0 messages |
| **Accounts** | Skeleton cards | "Add your first email account" + auto-discover search | "Could not load accounts" + Retry | Account cards with sync status, color dot, default badge | Account with sync error (amber warning) |
| **Settings** | Skeleton form | Default notification preferences shown | "Could not save settings" + Retry | All preferences saved with success indicator | Partial: encryption configured, notifications default |

## Phase 4: Design Consultation -- Final Design System Decisions

### Module Identity

- **Accent Color:** `#3B82F6` (blue) -- from `packages/ui/src/tokens/colors.ts` and `modules/mail/src/definition.ts`
- **Accent Dim:** `rgba(59,130,246,0.15)` -- for hero section background and subtle highlights
- **Accent Border:** `rgba(59,130,246,0.25)` -- for active states and borders
- **Icon:** 📬 (consistent with definition.ts)
- **Header Title:** "MyMail" in accent color, 30px, weight 800
- **Account Colors:** 8-color palette from `ACCOUNT_COLORS` constant: `#3B82F6`, `#EF4444`, `#10B981`, `#F59E0B`, `#8B5CF6`, `#EC4899`, `#06B6D4`, `#F97316`

### Component Reuse from packages/ui/ and Existing Web Modules

| Component Pattern | Source | Usage in Mail |
|-------------------|--------|---------------|
| Glass card (`rgba(255,255,255,0.04)` + `rgba(255,255,255,0.06)` border) | DESIGN.md tokens | Thread rows, message cards, contact cards, filter rows |
| Glass strong (`rgba(255,255,255,0.08)` + `rgba(255,255,255,0.10)` border) | DESIGN.md tokens | Selected thread highlight, reading pane header, compose header |
| Glass dock (`rgba(18,18,26,0.65)` + `rgba(255,255,255,0.08)` border + `blur(80px)`) | DESIGN.md tokens | Folder sidebar, compose bottom bar |
| Pill button (border-radius: 999, padding: 8px 14px) | Books page.tsx | Account filter chips, folder chips, quick filter chips |
| Active pill (accent background, dark text) | Books page.tsx | Selected account, active folder, active filter |
| Data table row (flex row, border-bottom, hover highlight) | Books page.tsx list mode | Contact table, filter table |
| Hero section (accent-dim bg, accent border, flex between) | Books page.tsx | Accounts page header, contacts stats |
| Nav header (glass dock bg, backdrop-blur, nav links) | Books layout.tsx | N/A (mail uses sidebar nav, not header tabs) |
| Empty state (dashed border, centered text, CTA links) | Books page.tsx | All empty states |
| Avatar circle (colored circle, initials text, unread dot) | Mobile index.tsx | Thread list sender avatars, contact avatars |

### Typography Decisions

| Element | Variant | Size | Weight |
|---------|---------|------|--------|
| Module title | heroTitle | 30px | 800 |
| Folder labels | body | 14px | 500 |
| Folder unread count | caption | 13px | 700 |
| Thread sender name (unread) | subheading | 15px | 600 |
| Thread sender name (read) | body | 15px | 400 |
| Thread subject | body | 14px | 400 |
| Thread preview | caption | 13px | 400 |
| Thread timestamp | caption | 12px | 500 |
| Message body | body | 16px / 26px LH | 400 |
| Message from header | subheading | 16px | 600 |
| Compose labels (To/CC/BCC/Subject) | caption | 13px | 500 |
| Section headers | label | 12px | 600, uppercase |
| Stats numbers | stat | 36px | 700 |
| Contact name | subheading | 18px | 600 |
| Filter rule pattern | body monospace | 14px | 400 |

### Keyboard Shortcuts

| Shortcut | Action | Context |
|----------|--------|---------|
| `Cmd+K` / `Ctrl+K` | Open search / command palette | Global |
| `C` | Compose new message | Inbox (not in compose) |
| `R` | Reply to selected message | Thread detail / reading pane |
| `A` | Reply All | Thread detail / reading pane |
| `F` | Forward selected message | Thread detail / reading pane |
| `S` | Toggle star on selected thread | Thread list |
| `E` | Archive (move to Sent) selected thread | Thread list |
| `#` | Move to Trash | Thread list |
| `J` / `Arrow Down` | Next thread | Thread list |
| `K` / `Arrow Up` | Previous thread | Thread list |
| `Enter` / `O` | Open selected thread in reading pane | Thread list |
| `Escape` | Close reading pane / Cancel compose | Reading pane / Compose |
| `Cmd+Enter` / `Ctrl+Enter` | Send message | Compose |
| `Cmd+Shift+D` | Save draft | Compose |
| `U` | Mark as unread | Thread list / reading pane |
| `Cmd+A` / `Ctrl+A` | Select all threads | Thread list |

### Three-Panel Layout Specification

```
+--------+---------------------+----------------------------------+
| SIDEBAR| THREAD LIST         | READING PANE                     |
| 240px  | 360px               | fill (min 400px)                |
|        |                     |                                   |
| [Acct] | [Search bar]        | [Message header]                 |
| [Fold] | [Account chips]     | [Message body]                   |
| [Fold] | [Thread rows...]    | [Attachments]                    |
| [Fold] |                     | [Reply bar]                      |
|        |                     |                                   |
+--------+---------------------+----------------------------------+
```

**Responsive breakdowns:**
- **Desktop (>1024px):** Full three-panel. Sidebar 240px, list 360px, reader fill.
- **Tablet (768-1024px):** Two-panel. Sidebar collapses to icon rail (56px). List + reader side by side.
- **Mobile (<768px):** Single column. List only, tap thread opens reader as full page. Back button returns to list.

**Sidebar:**
- Account section: color dot + email, click to filter
- Folder section: system folders (Inbox, Sent, Drafts, Starred, Trash, Spam) + custom folders
- Each folder shows unread count badge
- "Compose" button at top (accent color, full width)
- Bottom: settings gear icon, contacts icon, filters icon

## Page-by-Page Wireframes

### 1. Layout (`layout.tsx`) -- Three-Panel Shell

```
+--------+-------------------------------------------------------------+
| SIDEBAR|  {children}                                                  |
| 240px  |  fills remaining width                                      |
|        |                                                              |
| +----+ |                                                              |
| |[C] | |  Content area has no max-width (mail needs full viewport)   |
| |omp | |  padding: 0 (panels manage their own padding)               |
| |ose | |                                                              |
| +----+ |                                                              |
|        |                                                              |
| ALL    |                                                              |
|  Inbox |                                                              |
|        |                                                              |
| FOLDERS|                                                              |
| Inbox     5|                                                          |
| Sent       |                                                          |
| Drafts   2 |                                                          |
| Starred  3 |                                                          |
| Trash      |                                                          |
| Spam     1 |                                                          |
|            |                                                          |
| CUSTOM     |                                                          |
| Projects   |                                                          |
| Receipts   |                                                          |
|            |                                                          |
| ---------- |                                                          |
| Contacts   |                                                          |
| Filters    |                                                          |
| Accounts   |                                                          |
| Settings   |                                                          |
+--------+-------------------------------------------------------------+
```

Sidebar: glass dock background (`rgba(18,18,26,0.65)` + `backdrop-filter: blur(80px)`), right border `rgba(255,255,255,0.06)`. Compose button in accent color. Folder items: flex row, label + unread badge. Active folder: `glass.strong` background + accent text. Settings/contacts/filters at bottom separated by a divider.

### 2. Inbox Page (`page.tsx`) -- Thread List + Reading Pane

```
+---------------------+------------------------------------------+
| THREAD LIST (360px) | READING PANE (fill)                      |
|                     |                                           |
| [Search bar: glass] | [No thread selected]                     |
| Search mail... [/]  | "Select a conversation to read"           |
|                     |                                           |
| [Acct chips if >1]  |          -- OR --                        |
| [All] [work@] [me@] |                                           |
|                     | [Thread header: glass.strong]             |
| TODAY               | Re: Project Update                        |
| +---+-------------+ | alice@corp.com + 2 others                |
| |[A]| Alice Corp  | | Mar 22, 2:34 PM                         |
| |   | Project Upd.| | [Reply] [Reply All] [Forward] [Star] [...|
| |   | Hey team, h.| | ----------------------------------------|
| |   |   Mar 22 2p | |                                           |
| +---+-------------+ | [Message 1 of 3]                         |
|                     | From: alice@corp.com                      |
| +---+-------------+ | Mar 22, 2:34 PM                          |
| |[B]| Bob         | |                                           |
| |   | Invoice #42 | | Hey team,                                |
| |   | Please find.| |                                           |
| |   |   Mar 21    | | Here's the latest update on the project. |
| +---+-------------+ | We're tracking well against the timeline.|
|                     |                                           |
| YESTERDAY           | Attachments:                              |
| +---+-------------+ | [update.pdf 2.4MB] [notes.docx 540KB]   |
| |[C]| Carol       | |                                           |
| |   | Dinner Frid.| | ----------------------------------------|
| |   | Want to gra.| |                                           |
| |   |   Mar 20    | | [Message 2 of 3: collapsed]              |
| +---+-------------+ | Bob: Thanks for sharing...               |
|                     |                                           |
|                     | ----------------------------------------|
|                     |                                           |
|                     | [Message 3 of 3]                         |
|                     | From: alice@corp.com                      |
|                     | Mar 22, 4:15 PM                          |
|                     |                                           |
|                     | Updated the doc. Let me know if...        |
|                     |                                           |
|                     | ----------------------------------------|
|                     | [Quick reply bar: glass]                  |
|                     | Reply to alice@corp.com...    [Send]     |
+---------------------+------------------------------------------+
```

Thread list: right border `rgba(255,255,255,0.06)`. Thread rows: 76px min-height, left border-left 3px accent for unread, avatar circle (40px, colored, initials), sender + subject + preview + time. Selected thread: `glass.strong` background. Hover: subtle background change. Reading pane: full conversation with collapsible older messages.

### 3. Compose Page (`compose/page.tsx`)

```
+----------------------------------------------------------------------+
| [Back]  Compose                              [Save Draft] [Send ->]  |
+----------------------------------------------------------------------+
|                                                                      |
| From:  [work@example.com v]  (dropdown if multiple accounts)         |
|                                                                      |
| To:    [alice@] [bob@corp] [____________]            [+CC] [+BCC]    |
|                                                                      |
|        +----------------------------------------------+              |
|        | [A] Alice Corp  alice@corp.com           VIP |  <- autocmpl |
|        | [C] Carol B.    carol@gmail.com              |              |
|        +----------------------------------------------+              |
|                                                                      |
| CC:    [charlie@] [____________]                                     |
|                                                                      |
| Subj:  [Re: Project Update___________________________]               |
|                                                                      |
| +------------------------------------------------------------------+ |
| |                                                                  | |
| | Hi Alice,                                                        | |
| |                                                                  | |
| | Thanks for the update. I've reviewed the document and have a     | |
| | few suggestions...                                               | |
| |                                                                  | |
| | ---                                                              | |
| | On Mar 22, alice@corp.com wrote:                                 | |
| | > Hey team, here's the latest update on the project...           | |
| |                                                                  | |
| +------------------------------------------------------------------+ |
|                                                                      |
| [Encryption: Will be encrypted] or [Cannot encrypt -- missing keys]  |
|                                                                      |
| Attachments: [update-response.pdf 1.2MB  x]  [+ Add file]           |
|                                                                      |
| Draft saved 2 min ago                            [Cmd+Enter to Send] |
+----------------------------------------------------------------------+
```

Full-width page. Header: glass dock background. From dropdown with account color dots. Token-style recipient fields with autocomplete. Body textarea with generous line height. Encryption status bar (green if ready, amber if missing keys). Attachment list with file sizes and remove buttons. Auto-save indicator.

### 4. Search Page (`search/page.tsx`)

```
+----------------------------------------------------------------------+
| [Back to Inbox]                                                      |
+----------------------------------------------------------------------+
| +------------------------------------------------------------------+ |
| | [magnifying glass]  Search mail...                    [Cmd+K]    | |
| +------------------------------------------------------------------+ |
|                                                                      |
| Quick Filters:                                                       |
| [Unread] [Starred] [Has Attachments] [Encrypted]                     |
|                                                                      |
| Date Range: [This Week v] or [Custom: Mar 15 - Mar 22]              |
| Account: [All Accounts v]                                            |
|                                                                      |
| 12 results for "invoice"                                             |
|                                                                      |
| +---+--------------------------------------------+---------+--------+|
| |[B]| Bob                                        | Inbox   | Mar 21 ||
| |   | Invoice #4231 - March Billing               |         |        ||
| |   | Please find attached the invoice for...     |         |        ||
| +---+--------------------------------------------+---------+--------+|
|                                                                      |
| +---+--------------------------------------------+---------+--------+|
| |[A]| Accounting Dept                             | Sent    | Mar 18 ||
| |   | Re: Invoice #4230 - Payment Received        |         |        ||
| |   | Thank you for processing the payment...     |         |        ||
| +---+--------------------------------------------+---------+--------+|
|                                                                      |
| Recent Searches                                    [Clear History]   |
| invoice  |  project update  |  alice@corp.com                        |
+----------------------------------------------------------------------+
```

### 5. Contacts Page (`contacts/page.tsx`)

```
+----------------------------------------------------------------------+
| [Hero Section: accent-dim bg]                                        |
|   "Contacts"                                              [+ Add]    |
|   "142 contacts from your conversations"                             |
+----------------------------------------------------------------------+
|                                                                      |
| [Search: glass input]                                                |
| Search contacts by name or email...                                  |
|                                                                      |
| [Filter chips] [All] [VIP (8)] [Auto-created (98)] [Manual (36)]    |
|                                                                      |
| [Data Table]                                                         |
| +------+-----------------+-----------------------+-------+----------+|
| | [Avt]| Name            | Email                 | VIP   | Messages ||
| +------+-----------------+-----------------------+-------+----------+|
| | [AC] | Alice Corp      | alice@corp.com        | [star]| 47       ||
| | [BB] | Bob Builder     | bob@builder.io        |       | 23       ||
| | [CM] | Carol M.        | carol@gmail.com       | [star]| 15       ||
| | [DK] | (auto) dk@...   | dk@newsletter.com     |       | 89       ||
| +------+-----------------+-----------------------+-------+----------+|
|                                                                      |
| Sorted by: [Frequency v]  [A-Z] [Recent] [VIP First]                |
+----------------------------------------------------------------------+
```

### 6. Filters Page (`filters/page.tsx`)

```
+----------------------------------------------------------------------+
| [Hero Section: accent-dim bg]                                        |
|   "Mail Filters"                                     [+ New Filter]  |
|   "Auto-organize incoming messages"                                  |
+----------------------------------------------------------------------+
|                                                                      |
| [Filter Table]                                                       |
| +--------+------------+---------+---------+---------+-------+-------+|
| | Active | Name       | Field   | Pattern | Action  | Hits  | Edit  ||
| +--------+------------+---------+---------+---------+-------+-------+|
| | [on]   | Newsletter | from    | @news*  | move    | 234   | [...]  |
| |        |            |         |         | Archive |       |        |
| +--------+------------+---------+---------+---------+-------+-------+|
| | [on]   | Priority   | subject | URGENT* | star    | 12    | [...]  |
| +--------+------------+---------+---------+---------+-------+-------+|
| | [off]  | Old Rule   | from    | spam@*  | delete  | 0     | [...]  |
| +--------+------------+---------+---------+---------+-------+-------+|
|                                                                      |
| -- OR (empty) --                                                     |
| "No filters yet"                                                     |
| "Create a filter to auto-organize your incoming mail"                |
| [+ Create Filter]                                                    |
+----------------------------------------------------------------------+
```

### 7. Filter Editor Page (`filters/edit/page.tsx`)

```
+----------------------------------------------------------------------+
| [Back to Filters]                         [Test Filter] [Save]       |
+----------------------------------------------------------------------+
|                                                                      |
| Filter Name: [Newsletter Mover__________________]                    |
|                                                                      |
| When a message matches:                                              |
| Field:   [From v]  (from | to | subject | body)                     |
| Pattern: [*@newsletter.substack.com______]                           |
|                                                                      |
| Then:                                                                |
| Action:  [Move to Folder v]  (move | star | mark_read | delete)     |
| Value:   [Archive v]  (folder picker)                                |
|                                                                      |
| Priority: [0] (lower runs first)                                     |
|                                                                      |
| [Test Results: glass card]                                           |
| 23 existing messages match this filter                               |
| [Apply to existing messages]                                         |
+----------------------------------------------------------------------+
```

### 8. Accounts Page (`accounts/page.tsx`)

```
+----------------------------------------------------------------------+
| [Hero Section: accent-dim bg]                                        |
|   "Email Accounts"                                    [+ Add Account]|
|   "2 accounts connected"                                             |
+----------------------------------------------------------------------+
|                                                                      |
| [Account Card: glass.strong]                                         |
| +------------------------------------------------------------------+ |
| | [blue dot] work@example.com                        [Default] [...]| |
| | Display Name: Trey Work                                           | |
| | IMAP: imap.example.com:993 (SSL)   Sync: Idle, last 2 min ago    | |
| | SMTP: smtp.example.com:587 (STARTTLS)                             | |
| +------------------------------------------------------------------+ |
|                                                                      |
| [Account Card: glass]                                                |
| +------------------------------------------------------------------+ |
| | [red dot] personal@gmail.com                               [...]  | |
| | Display Name: Trey Personal                                       | |
| | IMAP: imap.gmail.com:993 (SSL)     Sync: Error (auth expired)    | |
| | SMTP: smtp.gmail.com:587 (STARTTLS)                               | |
| +------------------------------------------------------------------+ |
|                                                                      |
| -- OR (empty) --                                                     |
| "Add your first email account"                                       |
| "Your email stays on your device. No cloud. No tracking."            |
| [+ Add Account]                                                      |
+----------------------------------------------------------------------+
```

### 9. Add Account Page (`accounts/add/page.tsx`)

```
+----------------------------------------------------------------------+
| [Back to Accounts]                                                   |
+----------------------------------------------------------------------+
| Add Email Account                                                    |
|                                                                      |
| Email Address: [your@email.com_______________________]               |
|                                                                      |
| [Auto-Discover]  <- tries autoDiscoverConfig() with email domain     |
|                                                                      |
| -- OR --                                                             |
|                                                                      |
| Manual Configuration                                                 |
|                                                                      |
| Display Name:  [Your Name___________________________]                |
| Account Color: [blue] [red] [green] [amber] [purple] [pink]...      |
|                                                                      |
| IMAP Settings                                                        |
| Host: [imap.example.com__________]  Port: [993]  Security: [SSL v]  |
|                                                                      |
| SMTP Settings                                                        |
| Host: [smtp.example.com__________]  Port: [587]  Security: [TLS v]  |
|                                                                      |
| Auth: [Password v]  (password | oauth2)                              |
|                                                                      |
| [Test Connection]                                                    |
| Connection successful                                                |
|                                                                      |
| [Set as Default Account]                                             |
|                                                                      |
| [Save Account]                                                       |
+----------------------------------------------------------------------+
```

### 10. Settings Page (`settings/page.tsx`)

```
+----------------------------------------------------------------------+
| Mail Settings                                                        |
+----------------------------------------------------------------------+
|                                                                      |
| NOTIFICATIONS                                                        |
| +------------------------------------------------------------------+ |
| | Notifications:          [Enabled v]                               | |
| | VIP Only:               [Off]                                     | |
| | Show Preview:           [On]                                      | |
| | Quiet Hours:            [10:00 PM] to [7:00 AM]                  | |
| | Sound:                  [Default v]                               | |
| +------------------------------------------------------------------+ |
|                                                                      |
| ENCRYPTION                                                           |
| +------------------------------------------------------------------+ |
| | Your Keys:              1 active key (RSA)                        | |
| | [View Keys] [Generate New Key]                                    | |
| |                                                                   | |
| | Trusted Keys:           3 contact keys                            | |
| | [Manage Trusted Keys]                                             | |
| +------------------------------------------------------------------+ |
|                                                                      |
| SYNC                                                                 |
| +------------------------------------------------------------------+ |
| | work@example.com                                                  | |
| |   Inbox: Idle, last sync 2m ago, UID 1234                       | |
| |   Sent: Idle, last sync 5m ago                                   | |
| |   [Sync Now]                                                      | |
| |                                                                   | |
| | personal@gmail.com                                                | |
| |   Inbox: Error -- auth expired                                    | |
| |   [Reconnect]                                                     | |
| +------------------------------------------------------------------+ |
+----------------------------------------------------------------------+
```

## Component Inventory

### New Components (Mail-specific)

| Component | File | Description |
|-----------|------|-------------|
| `MailSidebar` | layout.tsx (inline) | Folder sidebar with account section, folder list, nav links |
| `FolderItem` | layout.tsx (inline) | Sidebar folder row with icon, label, unread badge |
| `ThreadList` | page.tsx (inline) | Scrollable thread list with section headers (Today/Yesterday/Earlier) |
| `ThreadRow` | page.tsx (inline) | Thread preview: avatar, sender, subject, preview, time, unread dot |
| `ReadingPane` | page.tsx (inline) | Message conversation viewer with collapsible messages |
| `MessageBubble` | page.tsx (inline) | Single message in conversation: header, body, attachments |
| `ComposeForm` | compose/page.tsx (inline) | Full compose: from, to/cc/bcc tokens, subject, body, attachments |
| `RecipientTokenField` | compose/page.tsx (inline) | Token-style email input with autocomplete dropdown |
| `AutocompleteDropdown` | compose/page.tsx (inline) | Contact suggestion dropdown with avatar, name, email, VIP |
| `SearchResultRow` | search/page.tsx (inline) | Search result: avatar, sender, subject, preview, folder badge, date |
| `ContactRow` | contacts/page.tsx (inline) | Contact table row: avatar, name, email, VIP star, frequency |
| `FilterRow` | filters/page.tsx (inline) | Filter table row: toggle, name, field, pattern, action, match count |
| `FilterEditor` | filters/edit/page.tsx (inline) | Filter creation/edit form with test results |
| `AccountCard` | accounts/page.tsx (inline) | Account card: color dot, email, IMAP/SMTP config, sync status |
| `AccountSetup` | accounts/add/page.tsx (inline) | Add account form: auto-discover + manual config |
| `EncryptionBadge` | ui.ts helper | Lock icon badge for encrypted messages |
| `AttachmentChip` | ui.ts helper | File chip with icon, name, size, download/remove |
| `CalendarEventCard` | ui.ts helper | ICS event preview: title, time, location, RSVP buttons |
| `SyncStatusBadge` | ui.ts helper | Sync state indicator (idle/syncing/error) |

### Shared Patterns (from Books reference)

All inline styles following the Books pattern (no CSS modules, no Tailwind). Style constants defined at top of each file:

```typescript
const ACCENT = '#3B82F6';
const ACCENT_DIM = 'rgba(59,130,246,0.15)';
const ACCENT_BORDER = 'rgba(59,130,246,0.25)';
const TEXT = '#F0F0F5';
const TEXT_SEC = 'rgba(240,240,245,0.65)';
const TEXT_TERT = 'rgba(240,240,245,0.35)';
const BG = '#0A0A0F';
const SURFACE = '#12121A';
const SURFACE_ELEVATED = '#1A1A24';
const BORDER = 'rgba(255,255,255,0.06)';
const GLASS = 'rgba(255,255,255,0.04)';
const GLASS_STRONG = 'rgba(255,255,255,0.08)';
const GLASS_BORDER = 'rgba(255,255,255,0.10)';
const GLASS_DOCK = 'rgba(18,18,26,0.65)';
const DANGER = '#FF453A';
const SUCCESS = '#30D158';
```

### UI Helper Functions (`ui.ts`)

```typescript
formatTime(isoDate: string) -> string              // "2:34 PM" or "Mar 22"
formatFullDate(isoDate: string) -> string           // "Mar 22, 2026 2:34 PM"
generateInitials(name: string) -> string            // "AC" from "Alice Corp"
getAvatarColor(email: string) -> string             // Deterministic color from email hash
truncatePreview(body: string, len?: number) -> string // First N chars of message body
formatFileSize(bytes: number) -> string             // "2.4 MB" from bytes
getAccountColor(index: number) -> string            // Color from ACCOUNT_COLORS palette
getSyncStatusLabel(status: SyncStatus) -> string    // "Idle" | "Syncing..." | "Error"
getFolderIcon(folderName: string) -> string          // Icon name from SYSTEM_FOLDERS
```

## Test Plan

### Unit Tests (Vitest)

| Test File | Coverage |
|-----------|----------|
| `__tests__/inbox-page.test.tsx` | Renders thread list, account filter chips, folder navigation, thread selection updates reading pane, empty inbox state, error state with retry, loading skeleton, unread badge counts |
| `__tests__/compose-page.test.tsx` | Renders compose form, recipient token add/remove, autocomplete dropdown, account picker, draft auto-save, reply/forward pre-fill, encryption status, send validation |
| `__tests__/thread-detail-page.test.tsx` | Renders conversation messages, collapsible older messages, attachment list, calendar event card, reply bar, mark as read on open |
| `__tests__/search-page.test.tsx` | Renders search bar, quick filters toggle, date range filter, results display, empty results state, recent searches, clear history |
| `__tests__/contacts-page.test.tsx` | Renders contact table, VIP toggle, search filters, sort options, source filter chips, empty state, add contact form |
| `__tests__/actions.test.ts` | All 55 server actions call correct module functions with correct params, db() helper initializes and runs migrations |
| `__tests__/social-contract-parity.test.ts` | Web exports match mobile feature set (see parity assertions below) |

### Parity Test Assertions

The social-contract parity test should verify:
- Web has inbox with thread list and reading pane (mobile: index.tsx)
- Web has compose with To/CC/BCC, autocomplete, encryption (mobile: compose-message.tsx)
- Web has search with quick filters (mobile: search.tsx)
- Web has folder navigation with unread counts (mobile: folders.tsx)
- Web has settings with notification preferences (mobile: settings.tsx + notifications.tsx)
- Web has account management with add/edit (mobile: accounts/index.tsx + accounts/add.tsx)
- Web has contact manager with VIP toggle (mobile: contacts/index.tsx + contacts/[id].tsx)
- Web has filter rules with create/edit/toggle (mobile: filters/index.tsx + filters/edit.tsx)
- Web has thread detail with conversation view (mobile: thread/[id].tsx)
- Web has message detail with attachments (mobile: message/[id].tsx)
- Web has encryption key management (mobile: encryption/index.tsx + encryption/add.tsx)
- Web has calendar event display from ICS (mobile: calendar-events.tsx)
- Web has onboarding/add-account flow (mobile: onboarding.tsx)

## QA Checklist

### Functional QA

- [ ] Inbox: thread list loads with section headers (Today/Yesterday/Earlier)
- [ ] Inbox: click thread populates reading pane with conversation
- [ ] Inbox: unread threads have bold sender name + accent left border
- [ ] Inbox: account filter chips work (All, per-account)
- [ ] Inbox: folder sidebar navigation filters thread list
- [ ] Inbox: unread badge counts match actual unread counts per folder
- [ ] Inbox: arrow key navigation between threads works
- [ ] Inbox: markAsRead fires when thread is selected
- [ ] Inbox: star toggle on hover/keyboard works
- [ ] Inbox: empty inbox shows warm CTA
- [ ] Inbox: no accounts shows "Add your first account" CTA
- [ ] Compose: To/CC/BCC token fields add/remove recipients
- [ ] Compose: autocomplete dropdown shows contact matches
- [ ] Compose: account picker dropdown works (if multiple accounts)
- [ ] Compose: reply pre-fills To, subject (Re:), and quoted body
- [ ] Compose: reply-all pre-fills To + CC correctly
- [ ] Compose: forward pre-fills subject (Fwd:) and forwarded body
- [ ] Compose: draft auto-saves every 30s with visual indicator
- [ ] Compose: encryption status shows when own key + recipient keys exist
- [ ] Compose: send validation requires at least one recipient
- [ ] Compose: Cmd+Enter sends message
- [ ] Thread: all messages in conversation render in chronological order
- [ ] Thread: older messages collapsible, latest expanded
- [ ] Thread: attachments shown with file type icon, name, size
- [ ] Thread: calendar events shown with RSVP buttons
- [ ] Thread: quick reply bar at bottom works
- [ ] Search: text search matches subject, from, and body
- [ ] Search: quick filter chips (unread, starred, attachments, encrypted) toggle
- [ ] Search: date range filter works
- [ ] Search: recent searches display and are clickable
- [ ] Search: empty results show helpful message
- [ ] Contacts: data table loads with avatar, name, email, VIP, frequency
- [ ] Contacts: VIP toggle works
- [ ] Contacts: search by name or email works
- [ ] Contacts: sort by frequency/A-Z/recent works
- [ ] Contacts: source filter chips work (manual, auto, imported)
- [ ] Filters: filter table loads with toggle, name, field, pattern, action
- [ ] Filters: toggle filter on/off works
- [ ] Filters: delete filter works with confirmation
- [ ] Filters: "New Filter" navigates to editor
- [ ] Filter editor: field/pattern/action form works
- [ ] Filter editor: "Test Filter" shows match count on existing messages
- [ ] Accounts: account cards show email, IMAP/SMTP config, sync status
- [ ] Accounts: "Add Account" navigates to setup form
- [ ] Accounts: auto-discover tries to detect IMAP/SMTP from email domain
- [ ] Accounts: manual configuration form validates ports and hosts
- [ ] Accounts: "Test Connection" button works
- [ ] Accounts: account color selection works
- [ ] Accounts: default account toggle works
- [ ] Settings: notification preferences form loads and saves
- [ ] Settings: encryption key list shows with fingerprints
- [ ] Settings: sync state per account/folder shown
- [ ] All pages: loading shows skeleton, not spinner
- [ ] All pages: error shows retry, not technical message
- [ ] All pages: empty shows warm CTA, not "No items found"
- [ ] Navigation: all sidebar links work
- [ ] Navigation: browser back/forward works correctly
- [ ] Keyboard: Cmd+K opens search
- [ ] Keyboard: C opens compose (from inbox)
- [ ] Keyboard: R/A/F reply/reply-all/forward from reading pane
- [ ] Keyboard: J/K navigate threads
- [ ] Keyboard: S stars, E archives, # trashes

### Visual QA (Cool Obsidian Compliance)

- [ ] Background: `#0A0A0F` everywhere
- [ ] Text: `#F0F0F5` primary, `rgba(240,240,245,0.65)` secondary
- [ ] Cards: glass morphism with correct tokens
- [ ] Accent: `#3B82F6` on sidebar active, compose button, CTAs, unread indicators
- [ ] Font: Inter everywhere (no serif, no system font fallback visible)
- [ ] Sidebar: glass dock background with blur
- [ ] Thread list: subtle borders between rows, accent left border for unread
- [ ] Reading pane: clean message rendering with proper line height
- [ ] No light theme cards inside dark background
- [ ] No developer-facing text visible
- [ ] Touch targets: 44px minimum on all interactive elements
- [ ] Glass blur: `backdrop-filter: blur(80px)` on sidebar, `blur(14px)` on compose header
- [ ] Account color dots match ACCOUNT_COLORS palette

### Responsive QA

- [ ] Desktop (>1024px): full three-panel layout
- [ ] Tablet (768-1024px): sidebar collapses to icon rail, two-panel list + reader
- [ ] Mobile (<768px): single column, list only, thread opens as full page
- [ ] Sidebar collapse/expand toggle works at all breakpoints

## Implementation Sequence

1. **actions.ts** -- Add all 55 server actions (biggest file, most foundational)
2. **ui.ts** -- Add shared helpers (avatar, time formatting, file size, sync status)
3. **layout.tsx** -- Three-panel layout shell with sidebar, folder list, account section
4. **page.tsx** -- Inbox: thread list + reading pane (the narrowest wedge, ship-test this first)
5. **compose/page.tsx** -- Compose form with recipient tokens, autocomplete, draft save
6. **thread/[id]/page.tsx** -- Thread conversation view with collapsible messages
7. **message/[id]/page.tsx** -- Single message detail with attachments, calendar events
8. **search/page.tsx** -- Search with quick filters, date range, recent searches
9. **contacts/page.tsx** -- Contact data table with VIP, frequency, search
10. **contacts/[id]/page.tsx** -- Contact detail
11. **folders/page.tsx** -- Folder manager with system + custom
12. **filters/page.tsx** -- Filter rules data table
13. **filters/edit/page.tsx** -- Filter editor with test results
14. **accounts/page.tsx** -- Account list with sync status
15. **accounts/add/page.tsx** -- Account setup with auto-discover
16. **settings/page.tsx** -- Notifications, encryption, sync settings
17. **__tests__/*.test.tsx** -- All test files
18. **Error handling pass** -- Wrap all server action calls in try/catch/finally per feedback memory

## Error Handling Rule

Per project feedback: all web module pages MUST wrap server action calls in try/catch/finally to prevent stuck loading states. Pattern:

```typescript
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  let cancelled = false;
  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchSomeAction();
      if (!cancelled) setData(data);
    } catch (err) {
      if (!cancelled) setError('Something went wrong. Please try again.');
    } finally {
      if (!cancelled) setLoading(false);
    }
  };
  void load();
  return () => { cancelled = true; };
}, []);
```

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| Office Hours | `/office-hours` | Web UX brainstorm (builder mode) | 1 | DONE | Narrowest wedge: three-panel inbox with keyboard triage. Desktop mail = density + multi-panel + keyboard shortcuts. |
| Eng Review | `/plan-eng-review` | Architecture & data flow | 1 | DONE | 55 missing server actions identified. Schema V1-V2 (12 tables, 25+ indexes) covers all features. Route structure: 16 pages + tests. |
| Design Review | `/plan-design-review` | UI/UX gaps & dimensions | 1 | DONE | 10 dimensions rated 8-10/10. All 5 states designed for 10 page types. Cool Obsidian compliant. Three-panel responsive breakdowns. |
| Design Consultation | `/design-consultation` | Design system finalization | 1 | DONE | Accent #3B82F6, glass tokens, 16 keyboard shortcuts, 19 components, 8 account colors. Component reuse from Books + mobile. |

**VERDICT:** ALL 4 REVIEWS COMPLETE. Spec ready for implementation.
