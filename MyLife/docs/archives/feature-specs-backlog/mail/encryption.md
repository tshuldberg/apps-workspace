# Feature Spec: Encryption

## Metadata
- **Module:** mail
- **Priority Score:** 26 / 50 (B-Tier)
- **Scoring Breakdown:** Market [3] x3 + Switching [3] x3 + Complexity [1] x2 + CrossModule [2] x1 + PaidUser [4] x1
- **Sprint:** Backlog
- **Estimated CC Time:** 6-8 hours
- **Depends On:** Full IMAP implementation (TLS transport), Attachments (encrypted attachments)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Privacy is MyLife's core brand promise. A self-hosted email client without encryption undermines that promise. ProtonMail has built a $100M+ business solely on encrypted email. Superhuman charges $30/mo with no encryption. MyMail can differentiate by offering end-to-end encryption at a fraction of ProtonMail's price within the MyLife suite. Encryption also makes MyMail viable for professionals in healthcare (HIPAA), legal, and finance where email encryption is often required.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Gmail | Partial | No | TLS in transit only. Confidential Mode (expiring messages). No true E2E. |
| Outlook | Partial | Yes ($6.99/mo) | S/MIME + Microsoft 365 Message Encryption. Requires certificates. |
| Superhuman | No | N/A | No encryption features beyond TLS in transit. |
| Spark | No | N/A | No encryption features beyond TLS in transit. |
| ProtonMail | Yes | Freemium ($3.99/mo+) | Full E2E encryption with PGP. Zero-access architecture. |
| Tutanota | Yes | Freemium ($1/mo+) | Custom E2E encryption protocol. Encrypted search. |

### Target User
Privacy-conscious users who currently pay for ProtonMail or Tutanota. Professionals in regulated industries (healthcare, legal, finance) who need email encryption for compliance. MyLife's core audience who chose the platform for privacy-first principles.

## Technical Context

### Where This Lives in MyLife

```
modules/mail/src/
  types.ts                            -- New types: EncryptionKey, EncryptedMessage, KeyPair, EncryptionStatus
  crypto/keys.ts                      -- NEW: key generation (RSA-4096 or X25519), key storage, key exchange
  crypto/encrypt.ts                   -- NEW: message encryption (PGP-compatible), attachment encryption
  crypto/decrypt.ts                   -- NEW: message decryption, signature verification
  db/schema.ts                        -- V2 migration: ml_encryption_keys table, add encryption fields to messages
  db/crud.ts                          -- New CRUD: key management (create, get, list, revoke)

apps/mobile/app/(mail)/
  settings/encryption.tsx              -- NEW: encryption settings (generate keys, import/export, per-contact keys)
  components/EncryptionBadge.tsx       -- NEW: lock icon badge on encrypted messages
  components/DecryptedView.tsx         -- NEW: decrypted message display with verification status

apps/web/app/mail/
  settings/encryption/page.tsx         -- NEW: encryption settings page
  components/EncryptionBadge.tsx       -- NEW
```

### Wireframe Position

```
Hub Dashboard
  └── MyMail card
       └── Settings tab
            └── Encryption ← KEY MANAGEMENT HERE
       └── Compose
            └── Encrypt toggle (lock icon in toolbar) ← SEND ENCRYPTED HERE
       └── Message Detail
            └── Encryption badge (lock icon) ← DECRYPTION HERE
```

### Data Model

```sql
-- V2 migration
CREATE TABLE IF NOT EXISTS ml_encryption_keys (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES ml_accounts(id) ON DELETE CASCADE,
  key_type TEXT NOT NULL CHECK(key_type IN ('rsa', 'x25519', 'pgp')),
  public_key TEXT NOT NULL,
  private_key_encrypted TEXT,
  fingerprint TEXT NOT NULL,
  contact_email TEXT,
  is_own_key INTEGER NOT NULL DEFAULT 0,
  is_revoked INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS ml_encryption_keys_account_idx ON ml_encryption_keys(account_id);
CREATE INDEX IF NOT EXISTS ml_encryption_keys_fingerprint_idx ON ml_encryption_keys(fingerprint);
CREATE INDEX IF NOT EXISTS ml_encryption_keys_contact_idx ON ml_encryption_keys(contact_email);

-- Add encryption fields to messages
ALTER TABLE ml_messages ADD COLUMN is_encrypted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ml_messages ADD COLUMN encryption_status TEXT DEFAULT 'none' CHECK(encryption_status IN ('none', 'encrypted', 'decrypted', 'failed'));
ALTER TABLE ml_messages ADD COLUMN signature_status TEXT DEFAULT 'none' CHECK(signature_status IN ('none', 'valid', 'invalid', 'unknown_key'));
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), Attachments (encrypted file handling), IMAP (transport)
- **External:** `openpgp` (OpenPGP.js for PGP encryption/decryption), `expo-secure-store` (private key storage on mobile), Web Crypto API (web key storage)
- **Cross-Module:** None directly, but encryption aligns with MyLife's privacy brand across all modules

## Functional Requirements

### User Stories
1. As a privacy-conscious user, I want to generate an encryption key pair so that I can send and receive encrypted email.
2. As a mail user, I want to encrypt outgoing messages so that only the recipient can read them.
3. As a mail user, I want encrypted messages to be automatically decrypted so that I can read them seamlessly.
4. As a mail user, I want to import contacts' public keys so that I can send them encrypted messages.
5. As a mail user, I want to see verification badges so that I know if a message was tampered with.

### Behavior Specification

1. **Key Setup:**
   a. User navigates to Settings > Encryption
   b. Taps "Generate Key Pair"
   c. System generates RSA-4096 key pair (or X25519 for modern contacts)
   d. Private key encrypted with user's passphrase and stored in Keychain (mobile) or Web Crypto (web)
   e. Public key fingerprint displayed and stored in ml_encryption_keys (is_own_key=1)
   f. Option to export public key (for sharing) and backup private key

2. **Import Contact Key:**
   a. User taps "Import Key" in encryption settings
   b. Pastes or uploads a PGP public key block
   c. System parses key, extracts email and fingerprint
   d. Stores in ml_encryption_keys with contact_email and is_own_key=0

3. **Send Encrypted:**
   a. In compose screen, user taps lock icon in toolbar to enable encryption
   b. System checks: does the recipient have a stored public key?
   c. If yes: lock icon turns green, message will be encrypted on send
   d. If no: lock icon shows warning "No key for [recipient]. Send unencrypted?"
   e. On send: encrypt body with recipient's public key, sign with sender's private key
   f. Attach as PGP/MIME (application/pgp-encrypted) per RFC 3156

4. **Receive Encrypted:**
   a. When message arrives with PGP/MIME content:
      - Detect Content-Type: application/pgp-encrypted
      - Attempt decryption with user's private key
      - If successful: store decrypted body, set encryption_status='decrypted'
      - If failed: show "Could not decrypt" badge, set encryption_status='failed'
   b. Verify signature if present:
      - Look up sender's public key by email
      - If key found and signature valid: signature_status='valid' (green checkmark)
      - If key not found: signature_status='unknown_key' (gray question mark)
      - If signature invalid: signature_status='invalid' (red warning)

5. **Key Management:**
   a. List all keys (own + contacts) with fingerprint, email, expiry, revocation status
   b. Revoke own key: mark as revoked, generate new key pair
   c. Delete contact key: remove from ml_encryption_keys

### Edge Cases

- Private key passphrase forgotten: cannot decrypt. Show "Export and reimport key" or reset option
- Recipient has multiple keys: use the most recently imported non-revoked key
- Key expired: warn before sending "Recipient's key expired on [date]. Send anyway?"
- Large encrypted message (10+ MB): encrypt in chunks, show progress bar
- Encrypted attachment: encrypt file data separately, wrap in PGP/MIME multipart
- Mixed recipients (some with keys, some without): warn "2 of 3 recipients will receive unencrypted"
- Key import of non-PGP format: show "Unsupported key format" error
- Self-signed message (sent to self): encrypt + sign with own key pair
- Private key stored on device is lost (factory reset): all encrypted messages become unreadable. Recovery via backup key.
- Decryption attempt on non-encrypted message: no-op, treat as plain text

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** "Generate Key Pair" creates RSA-4096 keys and shows fingerprint
- [ ] **AC-2:** Public key can be exported as PGP public key block text
- [ ] **AC-3:** Contact public keys can be imported from pasted text or file
- [ ] **AC-4:** Lock icon in compose toolbar toggles encryption mode
- [ ] **AC-5:** Green lock confirms encryption is active (recipient has key)
- [ ] **AC-6:** Warning shown when recipient has no public key
- [ ] **AC-7:** Encrypted messages display lock badge in message list and detail
- [ ] **AC-8:** Decrypted messages show content normally with green lock badge
- [ ] **AC-9:** Failed decryption shows "Could not decrypt" with red lock badge
- [ ] **AC-10:** Signature verification shows green checkmark (valid), gray question mark (unknown key), or red warning (invalid)

### Technical Criteria
- [ ] **TC-1:** ml_encryption_keys table created with correct schema
- [ ] **TC-2:** Private key encrypted with passphrase before storage
- [ ] **TC-3:** PGP encryption produces valid RFC 3156 PGP/MIME output
- [ ] **TC-4:** Decryption correctly handles PGP/MIME formatted messages
- [ ] **TC-5:** Signature generation uses SHA-256 hash
- [ ] **TC-6:** Signature verification correctly validates against sender's public key
- [ ] **TC-7:** Key fingerprint computed as SHA-256 of public key

### Negative Criteria
- [ ] **NC-1:** Private keys must NEVER be stored unencrypted or transmitted over network
- [ ] **NC-2:** Decrypted message content must NOT be stored in SQLite (decrypt on display only, or store encrypted with device key)
- [ ] **NC-3:** Key passphrase must NOT be stored (derived each time from user input or biometric)
- [ ] **NC-4:** Encryption must NOT be enabled by default (user must opt in per message or per contact)

## UI Specification

### Mobile (Expo)
- Encryption settings: `#0A0A0F` background, glass cards for own key and each contact key
- Own key card: fingerprint in monospace font, `#3B82F6` accent, "Export" and "Revoke" buttons
- Contact key card: email, fingerprint, import date, "Delete" button
- Lock icon in compose: toggles between unlocked (gray), locked-green (encryption active), locked-yellow (warning)
- Message list badge: small lock icon overlay on message row, green for encrypted+verified, yellow for encrypted+unverified
- Decrypted view: subtle `rgba(48,209,88,0.1)` background tint to indicate decryption

### Web (Next.js)
- Encryption settings at `/mail/settings/encryption`
- Same lock icon and badge patterns via CSS variables
- Key export generates downloadable .asc file

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | "Generating key pair..." spinner | Key generation (may take 2-5 seconds) |
| Empty | "No encryption keys. Generate a key pair to get started." + CTA | No keys generated |
| Error | "Decryption failed" red lock badge / "Key import failed" toast | Invalid key or failed decrypt |
| Success | Green lock badge, verified signature checkmark | Successful decrypt + verify |
| Partial | Yellow lock: "Encrypted but signature unverified" | Encrypted, unknown sender key |

## Test Requirements

### Unit Tests
- [ ] Key generation: produces valid RSA-4096 key pair
- [ ] Key generation: fingerprint is deterministic for same key
- [ ] Key encryption: private key encrypted with passphrase, decryptable with same passphrase
- [ ] Key encryption: wrong passphrase fails
- [ ] PGP encrypt: encrypts plaintext to PGP armored output
- [ ] PGP decrypt: decrypts PGP message with correct private key
- [ ] PGP decrypt: fails with wrong key (returns error, not crash)
- [ ] Signature: sign and verify roundtrip succeeds
- [ ] Signature: modified message fails verification
- [ ] Key import: parses valid PGP public key block
- [ ] Key import: rejects invalid key data
- [ ] Key CRUD: create, get by fingerprint, list by account, revoke, delete
- [ ] Encrypted message detection: identifies PGP/MIME content type

### Integration Tests
- [ ] Full flow: generate key -> compose encrypted -> send -> receive -> decrypt -> read
- [ ] Key exchange: import contact key -> send encrypted to contact -> verify encryption

### QA Verification Script

1. Open MyMail on mobile
2. Navigate to Settings > Encryption
3. Verify: empty state with "Generate Key Pair" CTA
4. Tap "Generate Key Pair", enter a passphrase
5. Verify: key generated, fingerprint displayed -- corresponds to AC-1
6. Tap "Export Public Key"
7. Verify: PGP public key block shown with copy/share options -- corresponds to AC-2
8. Tap "Import Key", paste a test contact's public key
9. Verify: contact key appears in list with email and fingerprint -- corresponds to AC-3
10. Navigate to Compose
11. Verify: lock icon present in toolbar (unlocked/gray state) -- corresponds to AC-4
12. Enter the imported contact's email as recipient
13. Tap lock icon
14. Verify: lock turns green confirming encryption -- corresponds to AC-5
15. Enter a new recipient without a key
16. Verify: warning about unencrypted send -- corresponds to AC-6
17. Send encrypted message to the contact with key
18. Open the Sent folder
19. Verify: message shows lock badge -- corresponds to AC-7
20. Receive an encrypted reply (from test contact)
21. Open the message
22. Verify: decrypted content visible with green lock -- corresponds to AC-8
23. Verify: green checkmark for valid signature -- corresponds to AC-10

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if Complexity <= 2 (this is a Large feature):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Fix issues found.

### Required if this feature has UI:
- [ ] `/browse` -- navigate to encryption settings, verify key generation and compose flow
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Post-merge:
- [ ] `/parity-check` -- verify mail module parity

## Handoff State

### Before This Work
No encryption capability. Messages stored and transmitted in plaintext. No key management. MyMail's privacy promise is aspirational only.

### After This Work
Full PGP encryption: key generation, key exchange, encrypt/decrypt messages, sign/verify, per-contact key management. MyMail becomes a viable ProtonMail alternative.

### Files Changed
- `modules/mail/src/types.ts` -- Added EncryptionKey, EncryptedMessage, KeyPair, EncryptionStatus types
- `modules/mail/src/crypto/keys.ts` -- NEW: key generation, storage, exchange
- `modules/mail/src/crypto/encrypt.ts` -- NEW: PGP encryption
- `modules/mail/src/crypto/decrypt.ts` -- NEW: PGP decryption, signature verification
- `modules/mail/src/db/schema.ts` -- Added ml_encryption_keys table + message encryption columns
- `modules/mail/src/db/crud.ts` -- Added key CRUD
- `modules/mail/src/definition.ts` -- V2 migration entry
- `apps/mobile/app/(mail)/settings/encryption.tsx` -- NEW
- `apps/mobile/app/(mail)/components/EncryptionBadge.tsx` -- NEW
- `apps/mobile/app/(mail)/components/DecryptedView.tsx` -- NEW
- `apps/web/app/mail/settings/encryption/page.tsx` -- NEW
- `apps/web/app/mail/components/EncryptionBadge.tsx` -- NEW

### Known Limitations
- No S/MIME support (PGP only). S/MIME requires certificate authority infrastructure.
- No key server discovery (manual key exchange only). WKD/SKS key server lookup is a future feature.
- No forward secrecy (standard PGP limitation).
- Decrypted content cached in memory only (not persisted), so re-decrypt on each view.

### Context for Next Agent
Use OpenPGP.js (openpgp npm package) for all crypto operations. It is well-maintained, supports streaming, and works in both Node and browser. On mobile, private keys should be stored via expo-secure-store. On web, use the Web Crypto API's extractable=false for key material. The crypto module should export pure functions that accept key material and return encrypted/decrypted buffers. Keep all crypto operations off the main thread.
