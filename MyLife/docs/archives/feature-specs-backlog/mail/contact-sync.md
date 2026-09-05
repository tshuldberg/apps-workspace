# Feature Spec: Contact Sync

## Metadata
- **Module:** mail
- **Priority Score:** 26 / 50 (B-Tier)
- **Scoring Breakdown:** Market [3] x3 + Switching [3] x3 + Complexity [2] x2 + CrossModule [2] x1 + PaidUser [2] x1
- **Sprint:** Backlog
- **Estimated CC Time:** 4-5 hours
- **Depends On:** none (can sync contacts independently of IMAP messages)
- **Blocks:** none (but enhances Push Notifications VIP mode and Encryption key lookup)

## Business Context

### Why This Feature Exists
Email is fundamentally a person-to-person medium. Without contact integration, every message shows raw email addresses instead of names and photos. Gmail and Outlook automatically resolve email addresses to contact cards with names, photos, and relationship context. Without contact sync, MyMail feels impersonal and requires users to mentally map "john.doe@company.com" to "John from Marketing" every time they read a message.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Gmail | Yes | No | Google Contacts integration, auto-complete from contacts, contact cards with photo/phone/company, auto-create contacts from replies |
| Outlook | Yes | No | Microsoft People integration, LinkedIn profile enrichment, contact cards with full org info |
| Superhuman | Yes | Yes ($30/mo) | Auto-enrichment via Clearbit (company, title, social profiles), profile photos from Gravatar |
| Spark | Yes | No | Device contacts integration, sender avatars, auto-complete from address book |

### Target User
Any mail user who communicates with people they know. Users accustomed to seeing contact names and photos in Gmail or Outlook. Professionals who need to quickly identify senders by name rather than email address.

## Technical Context

### Where This Lives in MyLife

```
modules/mail/src/
  types.ts                            -- New types: MailContact, ContactSource, AutoCompleteResult
  db/schema.ts                        -- V2 migration: ml_contacts table
  db/crud.ts                          -- New CRUD: contact create, get by email, search, update, delete
  engine/contacts.ts                  -- NEW: contact resolution (email -> name/avatar), auto-complete, auto-create from sent messages

apps/mobile/app/(mail)/
  settings/contacts.tsx                -- NEW: contact management screen
  components/ContactAvatar.tsx         -- NEW: circular avatar with initials fallback
  components/ContactAutoComplete.tsx   -- NEW: auto-complete dropdown for compose To/CC/BCC fields

apps/web/app/mail/
  contacts/page.tsx                    -- NEW: contact directory page
  components/ContactAvatar.tsx         -- NEW
  components/ContactAutoComplete.tsx   -- NEW
```

### Wireframe Position

```
Hub Dashboard
  └── MyMail card
       └── Compose
            └── To field (auto-complete dropdown) ← AUTO-COMPLETE HERE
       └── Inbox
            └── Message row (contact avatar + name) ← AVATAR HERE
       └── Settings
            └── Contacts ← MANAGEMENT HERE
```

### Data Model

```sql
-- V2 migration
CREATE TABLE IF NOT EXISTS ml_contacts (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES ml_accounts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  company TEXT,
  phone TEXT,
  notes TEXT,
  is_vip INTEGER NOT NULL DEFAULT 0,
  source TEXT DEFAULT 'manual' CHECK(source IN ('manual', 'device', 'auto_created', 'imported')),
  frequency INTEGER NOT NULL DEFAULT 0,
  last_contacted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(account_id, email)
);

CREATE INDEX IF NOT EXISTS ml_contacts_account_idx ON ml_contacts(account_id);
CREATE INDEX IF NOT EXISTS ml_contacts_email_idx ON ml_contacts(email);
CREATE INDEX IF NOT EXISTS ml_contacts_vip_idx ON ml_contacts(is_vip);
CREATE INDEX IF NOT EXISTS ml_contacts_frequency_idx ON ml_contacts(frequency DESC);
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter)
- **External:** `expo-contacts` (device address book access on mobile), Gravatar API (avatar lookup by email hash)
- **Cross-Module:** Push Notifications (VIP filter uses is_vip flag), Encryption (contact key lookup by email)

## Functional Requirements

### User Stories
1. As a mail user, I want sender names and avatars in my inbox so that I can quickly identify who sent each message.
2. As a mail user, I want auto-complete when typing email addresses so that I can compose messages faster.
3. As a mail user, I want to import my device contacts so that my existing address book works in MyMail.
4. As a mail user, I want contacts auto-created from my sent messages so that frequent recipients are remembered.
5. As a mail user, I want to mark contacts as VIP so that I can prioritize important people.

### Behavior Specification

1. **Contact Resolution (Inbox):**
   a. When displaying message list, for each "from" address:
      - Query ml_contacts for display_name by email
      - If found: show display_name and avatar (or initials if no avatar)
      - If not found: show email address with generated initials avatar
   b. ContactAvatar: circle, 36px, background color derived from email hash, white initials

2. **Auto-Complete (Compose):**
   a. User starts typing in To/CC/BCC field
   b. After 2 characters, query ml_contacts WHERE email LIKE '%query%' OR display_name LIKE '%query%'
   c. Results sorted by frequency (most contacted first)
   d. Show dropdown: avatar + name + email for each match
   e. Tapping a result fills the field with the contact

3. **Device Contact Import:**
   a. User navigates to Settings > Contacts > "Import from Device"
   b. Request contact permission (expo-contacts)
   c. Scan device contacts for entries with email addresses
   d. Show preview: "Found 142 contacts with email. Import?"
   e. On confirm: upsert to ml_contacts (source='device'), skip duplicates
   f. Show completion: "Imported 142 contacts"

4. **Auto-Create from Sent:**
   a. When user sends a message, for each recipient email:
      - Check if ml_contacts row exists for that email + account
      - If not: create with source='auto_created', display_name from email prefix (before @)
      - If yes: increment frequency, update last_contacted_at

5. **VIP Management:**
   a. Contacts list shows star icon for VIP contacts
   b. Toggle VIP by tapping star icon
   c. VIP contacts appear first in auto-complete
   d. Push notification VIP mode uses this flag

6. **Gravatar Lookup:**
   a. On contact creation (any source), compute MD5 hash of lowercase email
   b. Check Gravatar API for avatar
   c. If found, store avatar_url. If not, use initials.
   d. Refresh on a 30-day interval (not on every render)

### Edge Cases

- Contact permission denied: "Import from Device" shows "Enable contacts access in Settings" deep link
- Device has 10,000+ contacts: batch import with progress indicator, limit to contacts with email addresses
- Same email across multiple accounts: each account has its own contact row (UNIQUE on account_id + email)
- Email address changes for a contact: update email field, keep history via updated_at
- Auto-created contact with no name: use email prefix (e.g., "john.doe" from "john.doe@company.com")
- Gravatar returns 404: fall back to initials avatar, do not retry for 30 days
- Contact has multiple email addresses on device: create one ml_contacts row per email
- Delete contact that was device-imported: mark deleted locally, do not modify device contacts
- Special characters in email prefix for initials: strip dots and underscores, use first two letter characters

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Inbox message list shows sender name (not raw email) for known contacts
- [ ] **AC-2:** Contact avatar (photo or initials) displays beside sender name
- [ ] **AC-3:** Auto-complete dropdown appears after typing 2+ characters in To/CC/BCC
- [ ] **AC-4:** Auto-complete results sorted by contact frequency (most contacted first)
- [ ] **AC-5:** "Import from Device" imports all device contacts with email addresses
- [ ] **AC-6:** New recipients auto-added as contacts after sending
- [ ] **AC-7:** VIP toggle marks contacts with star, appears first in auto-complete
- [ ] **AC-8:** Contact management screen shows all contacts with search and VIP filter

### Technical Criteria
- [ ] **TC-1:** ml_contacts table created with correct schema and UNIQUE constraint
- [ ] **TC-2:** Contact resolution queries complete in < 10ms per email lookup
- [ ] **TC-3:** Auto-complete query returns results in < 50ms
- [ ] **TC-4:** Device import batches inserts (not one-by-one)
- [ ] **TC-5:** Gravatar lookup caches results with 30-day TTL
- [ ] **TC-6:** Frequency counter increments on each sent message to a contact
- [ ] **TC-7:** Cascade delete removes contacts when account is deleted

### Negative Criteria
- [ ] **NC-1:** Device contact import must NOT modify the device address book (read-only)
- [ ] **NC-2:** Gravatar lookup must NOT block message list rendering (async, show initials until loaded)
- [ ] **NC-3:** Contact data must NOT be shared across accounts (per-account isolation)
- [ ] **NC-4:** Auto-created contacts must NOT overwrite manually edited contacts

## UI Specification

### Mobile (Expo)
- ContactAvatar: 36px circle, background color from `hashCode(email) % 12` palette (12 distinct colors), white uppercase initials (first + last initial, or first two chars if single word)
- Auto-complete dropdown: `#12121A` surface background, glass border, max 5 visible results, avatar + "Name\nemail" two-line layout
- Contact management: list with avatar, name, email, VIP star. Search bar at top. "Import" button in header.
- VIP star: filled `#FFD60A` gold when VIP, outline `rgba(240,240,245,0.65)` when not

### Web (Next.js)
- Contacts page at `/mail/contacts` with table layout
- Same avatar and auto-complete patterns via CSS variables
- Gravatar images loaded lazily

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton avatars in message list | First load / contact resolution |
| Empty | "No contacts yet. Import from device or compose a message." | No contacts |
| Error | "Could not import contacts" toast | Permission denied or import failure |
| Success | Contact names + avatars in inbox, auto-complete working | Contacts loaded |
| Partial | Some contacts resolved (names), others showing email (not yet in contacts) | Mixed known/unknown senders |

## Test Requirements

### Unit Tests
- [ ] Contact CRUD: create contact persists to ml_contacts
- [ ] Contact CRUD: get by email returns correct contact
- [ ] Contact CRUD: unique constraint prevents duplicate account+email
- [ ] Contact resolution: returns display_name for known email
- [ ] Contact resolution: returns null for unknown email
- [ ] Auto-complete: matches partial email
- [ ] Auto-complete: matches partial name
- [ ] Auto-complete: sorted by frequency descending
- [ ] Auto-complete: returns max 10 results
- [ ] Auto-create: creates contact from sent message recipient
- [ ] Auto-create: increments frequency for existing contact
- [ ] Auto-create: does not overwrite manually edited display_name
- [ ] Initials generation: "John Doe" -> "JD"
- [ ] Initials generation: "john.doe@example.com" -> "JD" (from prefix)
- [ ] Initials generation: "support" -> "SU" (first two chars)
- [ ] VIP toggle: sets is_vip=1 / is_vip=0
- [ ] Cascade: deleting account removes contacts

### Integration Tests
- [ ] Full flow: import device contacts -> compose message -> auto-complete suggests imported contact
- [ ] Auto-create flow: send message to new address -> contact auto-created -> appears in auto-complete

### QA Verification Script

1. Open MyMail on mobile
2. Navigate to Settings > Contacts
3. Verify: empty state with import CTA
4. Tap "Import from Device"
5. Grant contacts permission
6. Verify: preview shows count of contacts with email -- step toward AC-5
7. Confirm import
8. Verify: contacts appear in list -- corresponds to AC-5
9. Navigate to Inbox
10. Verify: messages from imported contacts show name + avatar -- corresponds to AC-1, AC-2
11. Tap Compose
12. Type first 2 characters of an imported contact's name
13. Verify: auto-complete dropdown shows contact -- corresponds to AC-3
14. Verify: most-contacted contacts appear first -- corresponds to AC-4
15. Send a message to a new email address (not in contacts)
16. Navigate to Settings > Contacts
17. Verify: new recipient appears as auto-created contact -- corresponds to AC-6
18. Tap VIP star on a contact
19. Verify: star fills gold -- corresponds to AC-7
20. Go to Compose, type search
21. Verify: VIP contact appears first -- corresponds to AC-7
22. Use search bar in contacts screen
23. Verify: contacts filtered by search -- corresponds to AC-8

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to contacts, verify auto-complete and avatar display
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Post-merge:
- [ ] `/parity-check` -- verify mail module parity

## Handoff State

### Before This Work
No contact system. All messages display raw email addresses. No auto-complete in compose. No device contact integration. No VIP support.

### After This Work
Full contact system: device import, auto-create from sent, name/avatar resolution in inbox, auto-complete in compose, VIP management, Gravatar avatars.

### Files Changed
- `modules/mail/src/types.ts` -- Added MailContact, ContactSource, AutoCompleteResult types
- `modules/mail/src/db/schema.ts` -- Added ml_contacts table + indexes
- `modules/mail/src/db/crud.ts` -- Added contact CRUD (create, getByEmail, search, update, delete, toggleVIP)
- `modules/mail/src/engine/contacts.ts` -- NEW: resolution, auto-complete, auto-create, Gravatar lookup, initials
- `modules/mail/src/definition.ts` -- V2 migration entry
- `apps/mobile/app/(mail)/settings/contacts.tsx` -- NEW
- `apps/mobile/app/(mail)/components/ContactAvatar.tsx` -- NEW
- `apps/mobile/app/(mail)/components/ContactAutoComplete.tsx` -- NEW
- `apps/web/app/mail/contacts/page.tsx` -- NEW
- `apps/web/app/mail/components/ContactAvatar.tsx` -- NEW
- `apps/web/app/mail/components/ContactAutoComplete.tsx` -- NEW

### Known Limitations
- No CardDAV sync (device contacts only, no server-side contact sync).
- No contact groups/labels.
- No LinkedIn/social profile enrichment (Gravatar only).
- No contact merge/dedup tool (same person with multiple emails).

### Context for Next Agent
The ml_contacts table uses UNIQUE(account_id, email) to prevent duplicates. The frequency column is used for auto-complete ranking. Push Notifications can use is_vip for VIP-only mode. Encryption can look up contact keys by email. The ContactAvatar component should be reusable across mail module screens. Gravatar URL format: `https://gravatar.com/avatar/{md5(email.toLowerCase())}?d=404&s=72`.
