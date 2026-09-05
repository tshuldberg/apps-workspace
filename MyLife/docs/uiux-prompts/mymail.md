# MyMail -- UI/UX Design Prompts

**Module:** MyMail
**Tagline:** Email that respects you
**Icon:** 📧 | **Accent:** #6366F1 | **Tier:** Premium
**Bottom Tabs:** Inbox | Search | Folders | Settings
**Total Screens:** 21 mobile + 14 web = 35

---

## Prompt 1: Mobile Screens 1--12 (Inbox, Compose, Accounts, Search, Folders, Labels, Filters)

```
Design system: Cool Obsidian (dark theme — #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

Module: MyMail
Accent color: #6366F1
Bottom tabs: Inbox | Search | Folders | Settings

Design 12 mobile screens for a privacy-first email client. All screens use the Cool Obsidian dark theme with glass morphism cards, #6366F1 indigo accent, and #12121A surface panels.

1. INBOX (index.tsx)
   - Message list (scrollable, pull-to-refresh)
   - Each row: sender avatar circle (first letter, #6366F1 background), sender name (bold if unread), subject line, body preview (2 lines, secondary text rgba(240,240,245,0.65)), date/time (right-aligned)
   - Read/unread indicator: bold text + left accent bar for unread
   - Star/flag toggle icon per message (tap to toggle, #6366F1 filled when active)
   - Swipe right: archive (green), swipe left: delete (red), long swipe left: flag (#6366F1)
   - Floating compose button (circular, #6366F1)
   - Account switcher pill at top (current account email, tap to switch)
   - Bottom tab bar with Inbox active

2. COMPOSE (compose.tsx)
   - To field with contact autocomplete dropdown (from address book and history)
   - CC/BCC toggle link ("Add CC/BCC" tap to expand fields)
   - Subject line input
   - Rich body editor: toolbar with bold/italic/list/link/attachment buttons
   - Attachment button: file picker and camera options
   - Attached files row (thumbnail pills with X remove)
   - Send button (top right, #6366F1)
   - Save draft button (top left, text)
   - From account selector (if multiple accounts)

3. MESSAGE DETAIL ([id].tsx)
   - Sender name (large) with avatar, email address below
   - Recipients row: To and CC names (expandable)
   - Date and time
   - Subject line (bold, large)
   - Rendered HTML body (scrollable, properly styled for dark theme)
   - Attachments section: file cards with name, size, type icon, download button
   - Action bar at bottom: Reply / Reply All / Forward buttons
   - Overflow menu: star, move to folder, mark unread, delete

4. ACCOUNTS (accounts.tsx)
   - IMAP account list
   - Each card: email address (bold), connection status badge (connected=green / error=red / syncing=#6366F1 spinning), unread count badge, last synced timestamp
   - "Add Account" button (#6366F1)
   - Tap account to configure

5. ADD ACCOUNT (account/add.tsx)
   - Email address input
   - Password input (secure field)
   - IMAP server host input
   - IMAP port number input (default 993)
   - Security picker: SSL / TLS / STARTTLS segmented control
   - SMTP server input
   - SMTP port number input (default 587)
   - "Test Connection" button (outlined)
   - "Save Account" button (#6366F1)
   - Auto-detect link ("Try auto-detect settings")

6. SEARCH (search.tsx)
   - Search query input with magnifying glass icon (large, prominent)
   - Results list with highlighted keyword matches (bold/yellow highlight in preview text)
   - Filter section (expandable): account dropdown, folder dropdown, date range picker, "Has attachment" toggle
   - Recent searches list (below input when empty)
   - Result count display

7. FOLDERS (folders.tsx)
   - Folder tree (hierarchical, indented)
   - System folders: Inbox, Sent, Drafts, Trash, Spam (with icons)
   - Custom folders below with unread count badges
   - Create folder button at bottom
   - Long press for rename/delete context menu
   - Per-folder unread count (right-aligned badge)

8. LABELS (labels.tsx)
   - Label management list
   - Each row: color dot, label name, message count badge
   - "Create Label" button (#6366F1)
   - Tap to edit: name input, color picker (grid of preset colors)
   - Swipe to delete with confirmation
   - Drag to reorder

9. FILTERS (filters.tsx)
   - Filter rules list
   - Each card: condition summary (e.g., "From: newsletter@... -> Move to Newsletters"), active/inactive toggle
   - "Create Filter" button (#6366F1)
   - Filter editor: condition picker (from/subject/body contains pattern), pattern input, action picker (move to folder/apply label/mark read/delete)
   - Edit and delete per filter

10. SETTINGS (settings.tsx)
    - Sync interval picker (15 min / 30 min / 1 hour / manual)
    - Notification preferences per account (toggle switches)
    - Signature editor link (navigates to signatures screen)
    - Default account selector dropdown
    - Theme setting (auto, follows hub)
    - Swipe actions configuration
    - Cache management (clear cache button with size display)

11. ANALYTICS (analytics.tsx)
    - Email volume chart: received vs sent per day (dual bar chart, received=#6366F1, sent=rgba(99,102,241,0.5))
    - Average response time card (hours/minutes)
    - Top senders ranked list: sender name, email count, bar visualization
    - Busiest hours heatmap (24-hour grid, intensity = email volume)
    - Date range selector tabs (1 week / 1 month / 3 months)

12. TEMPLATES (templates.tsx)
    - Email template list
    - Each card: template name, subject preview, body preview (2 lines)
    - "Use Template" button per card (inserts into compose)
    - "Create Template" button (#6366F1)
    - Template editor: name input, subject input, body rich text editor
    - Edit and delete per template
```

---

## Prompt 2: Mobile Screens 13--21 (Contacts, Blocked, Scheduled, Threading, Smart Inbox)

```
Design system: Cool Obsidian (dark theme — #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

Module: MyMail
Accent color: #6366F1

Design 9 mobile screens completing the mobile set. Same design language: dark theme, glass cards, indigo accent.

13. CONTACTS (contacts.tsx)
    - Contact directory extracted from email history
    - Each card: name (or email if no name), email address, communication frequency badge (frequent/occasional/rare), last contact date
    - Search bar at top
    - Sort options: alphabetical / most frequent / most recent
    - Tap contact to compose new email

14. BLOCKED (blocked.tsx)
    - Blocked senders list
    - Each row: email address, date blocked, unblock button (outlined, right-aligned)
    - "Block Address" input at top (type email + add button)
    - Empty state: shield icon with "No blocked senders" text
    - Count display at top

15. SCHEDULED (scheduled.tsx)
    - Send-later queue list
    - Each card: subject line, recipient(s), scheduled send time (prominent, with calendar icon), status (queued/sent/failed)
    - Cancel button per queued message (red outlined)
    - Edit button per queued message (tap to open in compose)
    - Empty state: clock icon with "No scheduled emails" text

16. SIGNATURES (signatures.tsx)
    - Per-account signature list
    - Each card: account email header, signature preview (rendered HTML), edit button
    - Signature editor: rich text (bold/italic/link/image), live preview panel below editor
    - "Set as Default" toggle per signature
    - "Add Signature" button (#6366F1)

17. THREADING (threading.tsx)
    - Conversation threading view
    - Messages grouped by thread (subject-based)
    - Thread list: subject line, participant count, message count, last message date
    - Tap thread to expand: messages in chronological order, sender avatar + name per message, body preview
    - Collapse/expand toggle per thread
    - Reply inline button at bottom of thread

18. ATTACHMENTS (attachments.tsx)
    - Attachment browser across all messages
    - Filter tabs: All / Images / PDFs / Documents / Other
    - Grid view: file thumbnails (image preview or file type icon), file name, size, date, source email subject
    - Download button per attachment
    - Preview on tap (images inline, PDFs in viewer)
    - Search bar at top

19. SMART INBOX (smart.tsx)
    - Priority-sorted inbox with two sections: "Important" and "Other"
    - Section divider with count per section
    - Importance scoring: ML-based (star icon with confidence indicator)
    - Train by starring: star a message to mark as important (improves future sorting)
    - Same message row layout as main inbox
    - "Learn" info tooltip explaining how starring trains the model

20. CALENDAR (calendar.tsx)
    - Calendar events extracted from email content (meeting invites, RSVPs, bookings)
    - Monthly calendar view with event dots on dates
    - Event list below: event name, date/time, location, source email subject
    - RSVP status badge (accepted/declined/tentative/pending)
    - Tap event to open source email
    - "Refresh" to re-scan recent emails

21. NOTIFICATIONS (notifications.tsx)
    - Push notification configuration
    - Per-account toggle switches (on/off)
    - VIP sender list: added senders always trigger notification regardless of account toggle
    - "Add VIP" button with contact picker
    - Quiet hours: start time picker, end time picker, days selector (weekdays/weekends/all)
    - Notification sound picker
    - Badge count toggle
```

---

## Prompt 3: Web Screens 22--35

```
Design system: Cool Obsidian (dark theme — #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

Module: MyMail (Web)
Accent color: #6366F1
Layout: Persistent sidebar (from hub shell) with content area. Email uses a 3-column layout on wide screens: folder list | message list | reading pane.

Design 14 web pages for the MyMail module. Desktop-optimized layouts with multi-panel views, keyboard shortcuts, and data tables. Same Cool Obsidian dark theme.

22. INBOX (/mail)
    - 3-column layout: folder sidebar (narrow) | message list (medium) | reading pane (wide)
    - Folder sidebar: system folders with icons + unread badges, custom folders, labels section
    - Message list: sender, subject, preview, date, star toggle, checkbox for bulk actions
    - Reading pane: full message render (HTML body, attachments, reply/forward bar)
    - Toolbar above message list: compose, archive, delete, move, label, search
    - Keyboard shortcuts hint (? to show shortcuts)

23. COMPOSE (/mail/compose)
    - Full compose view (modal or full page)
    - To/CC/BCC fields with autocomplete chips
    - Subject input
    - Rich text editor (toolbar: bold, italic, underline, lists, links, images, code)
    - Attachment dropzone (drag files onto editor area)
    - Template picker dropdown
    - Signature auto-inserted (editable)
    - Send button (#6366F1), Save Draft, Discard, Schedule Send (date/time picker)

24. MESSAGE DETAIL (/mail/[id])
    - Full message view in reading pane
    - Sender info header: avatar, name, email, date
    - Recipients expandable row
    - Rendered HTML body (full width)
    - Attachments grid: thumbnails with download/preview
    - Thread view below: previous messages in conversation (collapsible)
    - Action toolbar: reply, reply all, forward, star, move, label, delete, mark unread

25. SEARCH (/mail/search)
    - Search bar (large, top) with advanced filters panel (expandable)
    - Filters: account, folder, date range, has attachment, from, to, subject contains
    - Results table: sender, subject (with highlighted matches), date, folder, account
    - Click result to open in reading pane
    - Save search as filter option

26. FOLDERS (/mail/folders)
    - Folder management page
    - Folder tree (hierarchical, drag to reorder or nest)
    - Per-folder stats: message count, unread count, size
    - Create/rename/delete controls
    - Drag-and-drop messages between folders

27. ACCOUNTS (/mail/accounts)
    - Account management table: email, server, status badge, unread count, last synced
    - Account detail panel: IMAP/SMTP config, test connection, sync settings
    - Add account form (inline or modal)
    - Remove account button (with "delete local copies?" option)

28. LABELS (/mail/labels)
    - Label management table: color swatch, name, message count, actions
    - Inline edit (click name to rename, click color to change)
    - Create label form
    - Bulk apply label to selected messages

29. FILTERS (/mail/filters)
    - Filter rules table: condition summary, action, active toggle, priority order
    - Drag to reorder (priority)
    - Create/edit filter: condition builder (from/subject/body + contains/equals/regex), action picker, test against recent messages
    - Import/export filters

30. ANALYTICS (/mail/analytics)
    - Email volume chart: daily received vs sent (bar chart, wide)
    - Response time analysis: distribution histogram, average, median
    - Top senders and recipients tables (ranked)
    - Busiest hours heatmap (7x24 grid: day of week x hour)
    - Account breakdown pie chart
    - Date range selector

31. TEMPLATES (/mail/templates)
    - Template grid: name, subject preview, last used date
    - Template editor (full rich text, live preview)
    - Duplicate, edit, delete actions
    - "Use in Compose" button (opens compose with template loaded)

32. CONTACTS (/mail/contacts)
    - Contact directory table: name, email, frequency, last contact, actions
    - Click to see full communication history (list of emails exchanged)
    - Search and filter
    - Export contacts (CSV)

33. THREADING (/mail/threads)
    - Threaded conversation view
    - Thread list: subject, participants (avatar stack), message count, last activity
    - Click thread to expand full conversation in reading pane
    - Inline reply at bottom of thread

34. ATTACHMENTS (/mail/attachments)
    - Attachment browser: filterable grid (images/PDFs/docs/all)
    - Each card: preview thumbnail, file name, size, source email subject, date
    - Click to preview (images inline, PDFs in viewer, others download)
    - Bulk download selected

35. SETTINGS (/mail/settings)
    - General: sync interval, default account, theme
    - Notifications: per-account toggles, VIP list, quiet hours
    - Signatures: per-account signature editor with preview
    - Swipe/shortcut customization
    - Blocked senders management
    - Data: cache size and clear button, export all mail data
    - Danger zone: delete all MyMail data (red button with confirmation modal)
```
