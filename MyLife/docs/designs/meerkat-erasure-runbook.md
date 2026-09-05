# Meerkat erasure runbook (crypto-shredding, MK-024 / D10.5)

How "delete" works on data that has already replicated to other devices and
relay mailboxes -- and exactly where its limits are.

## The mechanism

Entities whose policy demands it (`isSensitive` modules, disappearing-message
tables; `entityRequiresContentKey` in `packages/sync/src/protocol/entity-keys.ts`)
never replicate plaintext. Each row's payload is sealed under its OWN random
256-bit content key (`sealEntityPayload`); the ciphertext replicates, the key
does not travel with it. Erasure = destroy the key (`destroyEntityKey`): every
replica of the ciphertext -- peer databases, relay mailboxes, backups --
becomes unreadable at once, without reaching into any of them.

## Operator / app procedure

1. **User deletes a shredding-policied row** (or a disappearing message
   expires via `pruneExpiredEntities`):
   a. `destroyEntityKey(db, { moduleId, tableName, rowId })` -- overwrites the
      key row, then deletes it.
   b. Delete the local plaintext row as normal (tombstone written, MK-002
      prevents resurrection).
2. **Propagate the shred**: the tombstone replicates through normal sync.
   Peers that hold their own copy of the entity key must destroy it when they
   apply the tombstone for a shredding-policied table. (Key copies only exist
   on devices that were given them; the relay never has keys.)
3. **Verify locally**: `getEntityKey` returns null; the sealed payload no
   longer opens (`openEntityPayload` -> null). This exact sequence is proven in
   `entity-keys.test.ts` ("destroying the key renders the replicated
   ciphertext unreadable").

## Honest boundaries

- **Peers erase when they apply the shred.** Until a peer syncs the tombstone
  (or shred record), a peer that already holds BOTH the ciphertext and its key
  copy can still read its copy. Crypto-shredding makes the RELAY and any
  key-less replica permanently unreadable immediately; key-holding peers
  converge on the next sync round. A signed "shred" record gossiped like
  MK-019 revocations is the hardening follow-up for key-holding peers that
  never sync again.
- **SQLite page remnants.** Deleting a row does not zero database pages. We
  overwrite the key hex before deleting (removes it from the live DB and the
  WAL going forward), but a forensic read of unzeroed pages could recover a
  destroyed key on an unencrypted database file. Mitigations, in order:
  platform full-disk encryption (default on iOS/Android), `PRAGMA
  secure_delete = ON` for the sync database, SQLCipher for at-rest encryption.
  The mobile app stores `meerkat.db` inside the OS-encrypted container.
- **Backups.** A backup taken BEFORE the shred contains the key. Restoring it
  resurrects readability of old ciphertext. Recovery exports (MK-020) contain
  IDENTITY keys only -- never entity content keys -- so a recovery restore does
  not resurrect shredded data.
- **What this never protects against**: a member who already decrypted and
  screenshotted/exported the plaintext. Crypto-shredding bounds the FUTURE
  readability of ciphertext, not what a past reader did with plaintext.

## Test evidence

- `packages/sync/src/__tests__/entity-keys.test.ts`: shred renders replicated
  ciphertext unreadable; re-created rows get fresh keys that cannot open old
  ciphertext; destroy is idempotent; policy matrix for which tables demand keys.
