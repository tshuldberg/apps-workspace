# MyForums -- UI/UX Design Prompts

**Tagline:** Human-verified community, bot-free by design
**Icon:** 💬 | **Accent:** #7C4DFF | **Tier:** Free | **Storage:** Supabase + SQLite cache
**Bottom Tabs:** Feed | Communities | Search | Saved | Profile
**Total Screens:** 13 mobile + 17 web = 30

---

## Prompt 1 -- Mobile Screens 1-12

```
Design system: Cool Obsidian (dark theme — #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

App: MyForums
Platform: iOS (React Native / Expo)
Accent color: #7C4DFF
Bottom tab bar: Feed | Communities | Search | Saved | Profile

Design 12 mobile screens:

1. FEED (feed.tsx)
- Bottom tab bar with Feed tab active, #7C4DFF accent highlight
- Pull-to-refresh indicator at top
- Real-time thread feed, each card on #12121A surface with rgba(255,255,255,0.06) border
- Thread card contains: title (bold, #F0F0F5), community name badge (pill, glass fill), timestamp (rgba(240,240,245,0.65))
- Left side: up/down vote arrows with vote count between them
- Right side: reply count with speech bubble icon
- Human verified badge -- small checkmark icon in #7C4DFF next to author name
- Pinned indicator -- pin icon + "Pinned" label on pinned threads, subtle #7C4DFF tint
- Floating action button (FAB) bottom-right for new thread, #7C4DFF fill

2. COMMUNITIES (communities.tsx)
- Bottom tab bar with Communities tab active
- Search bar at top with magnifying glass icon, #1A1A24 background, rgba(255,255,255,0.10) border
- Scrollable list of community cards on #12121A surface
- Each card: community name (bold), member count, thread count, description preview (1 line, rgba(240,240,245,0.65))
- "Humans Only" verification badge -- shield icon in #7C4DFF on verified communities
- Join/Leave toggle button per card -- outlined when not joined, filled #7C4DFF when joined
- Section headers: "Your Communities" and "Discover"

3. SEARCH (search.tsx)
- Bottom tab bar with Search tab active
- Large search input at top, auto-focus, #1A1A24 background
- Scope pills below search bar: "Threads" | "Replies" | "Communities" | "Users" -- glass fill, #7C4DFF when active
- Search results as cards: thread title, matched text snippet with highlighted keywords (#7C4DFF), community name, timestamp
- Relevance ranking indicator -- subtle relevance bar or score
- Empty state: search icon illustration, "Search threads, replies, and communities" text in rgba(240,240,245,0.65)
- Recent searches section when input is empty

4. SAVED (saved.tsx)
- Bottom tab bar with Saved tab active
- Bookmarked threads grouped by community
- Community group headers: community name + icon, thread count in group
- Thread cards: title, first line preview, vote count, reply count, saved date
- Swipe-to-remove gesture per card
- Empty state: bookmark icon, "No saved threads yet" message

5. PROFILE (profile.tsx)
- Bottom tab bar with Profile tab active
- Profile header: avatar (circular, 80px), display name, join date
- Verification status indicator -- badge with tier label (Unverified/Verified/Trusted)
- Stats row: posts count, replies count, karma (total votes received)
- Badges section: horizontal scroll of earned badges (icons with labels)
- Post history tab / Replies tab toggle below stats
- Post list: title, community, timestamp, vote count
- Settings gear icon in top-right nav bar

6. ACTIVITY FEED (activity-feed.tsx)
- Full-screen view, back arrow in nav bar
- Activity timeline, vertical line connecting events
- Event types with distinct icons:
  - Reply to your post -- speech bubble icon
  - Mention -- @ icon
  - Upvote milestone -- arrow-up icon
  - New follower -- person-plus icon
- Each event card: icon, description text, timestamp (relative), thread title link
- Unread events have subtle #7C4DFF left border accent
- "Mark all read" button in nav bar

7. THREAD DETAIL (thread-detail.tsx)
- Nav bar with back arrow, community name, overflow menu (share, report, edit)
- Thread title (large, bold, #F0F0F5)
- Thread body (markdown rendered), full width on #0A0A0F background
- Author info row: avatar, name, verification badge, timestamp
- Action bar: up/down vote arrows with count, bookmark button, share button, reply button
- Nested reply tree below, indented with vertical connector lines
  - Each reply: avatar, name, body text, vote arrows, timestamp
  - Indent levels: 0px, 16px, 32px, max 48px then flat
- Reply input bar fixed at bottom: text field, send button (#7C4DFF)

8. CREATE THREAD (create-thread.tsx)
- Full-screen modal with "Cancel" (left) and "Post" (right, #7C4DFF) in nav bar
- Community selector dropdown at top -- current community name, chevron, opens picker
- Title input: large font, placeholder "Thread title"
- Body editor: multi-line, markdown toolbar (bold, italic, link, list, code, image)
- Tags section: horizontal tag chips, "Add tag" button with + icon
- Character count / word count at bottom in rgba(240,240,245,0.65)

9. CREATE COMMUNITY (create-community.tsx)
- Full-screen modal with "Cancel" and "Create" buttons
- Name input field with character limit indicator
- Description text area (multi-line)
- Rules editor: numbered list, each rule as an editable row with delete button, "Add Rule" button
- "Humans Only" toggle switch -- label explaining verification requirement
- Icon/avatar picker for community
- Category selector dropdown

10. COMMUNITY DETAIL (community-detail.tsx)
- Community banner area: name (large), description, member count, thread count
- "Humans Only" badge if verified community
- Join/Leave button (prominent, #7C4DFF fill or outlined)
- Tab bar below header: Threads | Rules | Members
- Threads tab: thread feed (same card format as main feed)
- Rules tab: numbered rules list, clean typography
- Members tab: member list with avatars, names, roles (mod/member)

11. COMMUNITY SETTINGS (community-settings.tsx)
- Nav bar: back arrow, "Community Settings" title
- Sections with #12121A surface cards:
  - Edit Info: name, description, icon
  - Rules Management: reorderable rules list, add/edit/delete
  - Tags Management: manage allowed tags, create new tags
  - Post Templates: set default thread template
  - Moderation: auto-mod toggles (spam filter, link filter, new account filter)
- Each section has chevron to expand or navigate to sub-screen
- Danger zone at bottom: "Delete Community" in #FF453A

12. COMMUNITY HEALTH (community-health.tsx)
- Nav bar: back arrow, "Community Health" title
- Dashboard layout with stat cards on #12121A surfaces
- % Verified Members: circular progress ring in #7C4DFF with percentage
- Average Response Time: value + trend arrow (up/down)
- Mod Action Frequency: bar chart (last 7 days)
- Active Members (last 30 days): number + sparkline
- Flagged Content: count with warning icon
- Engagement Rate: percentage with trend indicator
- Time range selector: 7d | 30d | 90d pills
```

---

## Prompt 2 -- Mobile Screens 13-17

```
Design system: Cool Obsidian (dark theme — #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

App: MyForums
Platform: iOS (React Native / Expo)
Accent color: #7C4DFF

Design 5 mobile screens:

1. MOD LOG (mod-log.tsx)
- Nav bar: back arrow, "Moderation Log" title
- Public moderation log as a timeline list
- Each entry on #12121A surface card:
  - Action type badge (Removed/Warned/Banned/Muted/Pinned/Locked) with color coding
  - Moderator name with mod badge icon
  - Target: thread title or username
  - Timestamp (relative)
  - Reason text (if provided), rgba(240,240,245,0.65)
- Filter pills at top: All | Removals | Bans | Warnings
- Pagination / infinite scroll

2. MESSAGES (messages.tsx)
- Nav bar: "Messages" title, compose button (pencil icon) top-right
- Conversation list on #0A0A0F background
- Each conversation row on #12121A surface:
  - Avatar (circular, 48px)
  - Display name (bold if unread, normal if read)
  - Last message preview (1 line, truncated, rgba(240,240,245,0.65))
  - Timestamp (right-aligned)
  - Unread badge (circle with count, #7C4DFF fill)
- Swipe actions: mute, delete
- Empty state: envelope icon, "No messages yet"

3. NEW MESSAGE (new-message.tsx)
- Full-screen modal with "Cancel" and "Send" buttons in nav bar
- Recipient field at top: "To:" label, search input for user lookup
- User search results dropdown: avatar, display name, verification badge
- Selected recipients as removable chips
- Message composer: multi-line text input, placeholder "Write a message..."
- Attachment button (image icon) in bottom toolbar
- Character count in rgba(240,240,245,0.65)

4. EDIT PROFILE (edit-profile.tsx)
- Nav bar: "Cancel" (left), "Save" (right, #7C4DFF)
- Avatar section: current avatar (large, circular), "Change Photo" button overlay
- Form fields on #12121A surface cards:
  - Display Name input
  - Bio text area (multi-line, character limit shown)
  - Location input (optional)
  - Website/link input (optional)
- Each field has label above in rgba(240,240,245,0.65) and value in #F0F0F5
- Delete Account section at bottom in #FF453A text

5. USER PROFILE (user-profile.tsx)
- Nav bar: back arrow, overflow menu (block, report)
- Profile header: avatar, display name, verification badge, join date
- Stats row: posts, replies, karma
- Badges section: horizontal scroll of earned badges
- Action buttons: "Message" (outlined), "Follow" (filled #7C4DFF or outlined if already following)
- Tab toggle: Posts | Replies
- Post/reply list below: same card format as feed items
- If user is blocked: "You have blocked this user" state with unblock option
```

---

## Prompt 3 -- Web Pages 1-10 (Overview)

```
Design system: Cool Obsidian (dark theme — #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

App: MyForums
Platform: Web (Next.js 15, desktop layout with persistent sidebar from MyLife hub)
Accent color: #7C4DFF

Design 10 web pages. Each page sits in the MyLife hub shell: persistent left sidebar with module icons, top bar with breadcrumbs. Content area uses max-width 960px centered layout for readability.

1. FEED (/forums)
- Three-column layout: left sidebar (communities list, quick links), center (thread feed), right sidebar (trending, activity summary)
- Thread feed cards: title, vote arrows (left), community badge, author, timestamp, reply count, human verified badge
- Pinned threads at top with pin indicator
- "New Thread" button prominent in top bar area, #7C4DFF
- Infinite scroll with loading skeleton

2. COMMUNITY BROWSER (/forums/communities)
- Grid of community cards (3 columns)
- Each card: community name, description preview, member count, thread count, "Humans Only" badge
- Search bar and category filter dropdown at top
- Join/Leave button per card
- "Create Community" button top-right

3. COMMUNITY DETAIL (/forums/communities/[slug])
- Community header: banner, name, description, member count, join button
- Tab navigation: Threads | Rules | Members | Health | Settings (if mod)
- Thread list below tabs, same card format
- Right sidebar: community stats, top contributors, recent activity

4. THREAD DETAIL (/forums/threads/[id])
- Full thread view: title, author info, body (markdown rendered), vote controls, action buttons
- Nested reply tree with indentation lines
- Reply composer at bottom: markdown editor, "Reply" button
- Right sidebar: related threads, thread stats

5. CREATE THREAD (/forums/new)
- Form layout: community selector, title input, body markdown editor with toolbar
- Tag selector with autocomplete
- Preview toggle (side-by-side or tab)
- "Post Thread" button, #7C4DFF

6. SEARCH (/forums/search)
- Large search input at top
- Scope tabs: Threads | Replies | Communities | Users
- Result cards with highlighted matched text
- Filter sidebar: date range, community, sort by
- Recent searches when input is empty

7. SAVED (/forums/saved)
- Bookmarked threads grouped by community
- Each group: community header, thread cards below
- Remove bookmark button per card
- Empty state with bookmark illustration

8. MESSAGES (/forums/messages)
- Two-panel layout: conversation list (left, 320px), active conversation (right)
- Conversation list: avatar, name, preview, timestamp, unread badge
- Active conversation: message bubbles, input composer at bottom
- "New Message" button at top of list

9. PROFILE (/forums/profile)
- Profile header: avatar, name, verification badge, stats
- Tabs: Posts | Replies | Badges | Settings
- Edit profile form accessible from settings tab
- Post/reply history below tabs

10. MOD DASHBOARD (/forums/communities/[slug]/mod)
- Mod tools layout: moderation log, reported content queue, community health stats
- Reported content: card per report with approve/remove/dismiss actions
- Health dashboard: charts for engagement, verified %, response time
- Community settings access
```
