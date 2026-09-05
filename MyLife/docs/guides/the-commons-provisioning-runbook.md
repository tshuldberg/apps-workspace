# The Commons — provisioning + key custody runbook (Plan 39 P8/P9)

The Commons is the first-party, system-owned open base feed: a set of open-post publications
(one per topic channel) under the `the-commons` community namespace, signed by an operator
descriptor key that first-party ops custody. This runbook is how ops provision The Commons once
and have the first-party community node boot it with verify-to-view enforcement.

Everything here is founder-ops. The code it drives lives in
`packages/meerkat-relay/src/commons-provisioning.ts` (`buildCommonsProvisioning`,
`serializeCommonsProvisioning`, `parseCommonsProvisioning`, `commonsGatePredicate`) and the
community-node bin (`bin/meerkat-community-node.mjs`, the `COMMONS_PROVISION_FILE` path).

## Why persist, not re-derive

The public snapshot seal uses random AEAD nonces, so a re-provision is NOT byte-identical and
publication ids are NOT reproducible from a seed. The Commons is therefore provisioned ONCE and
PERSISTED: the operator runs provisioning, saves the output file, and the node loads it on every
boot. Re-provisioning mints a NEW Commons (new ids); do it only to intentionally re-baseline.

## The operator descriptor key (custody)

- The Commons descriptors are signed by an OPERATOR device identity. Its Ed25519 private key is
  the single most sensitive secret for The Commons: whoever holds it can revise/tombstone/kill
  Commons publications. Treat it like a code-signing key.
- Custody: generate it on an offline/HSM-backed host, store the private key in the org secret
  manager (never in the repo, never in a container image), and grant break-glass access to a
  named few. Rotating it means re-baselining The Commons (new ids) and publishing an owner
  takedown of the old descriptors.
- The node does NOT need the operator private key at runtime. It only registers + serves the
  already-signed descriptors from the provision file. Keep the operator key OFF the node hosts.

## Provision once (operator host)

Run from `packages/meerkat-relay` with the operator identity loaded into the configured secret
store. Sketch (adapt to your ops tooling):

```js
import { writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { configureSyncSecretStore, createInMemorySyncSecretStore, generateDeviceIdentity } from '@mylife/sync';
import { buildCommonsProvisioning, serializeCommonsProvisioning } from './src/index.ts';

configureSyncSecretStore(createInMemorySyncSecretStore()); // use a PERSISTENT secret store in prod
const operator = generateDeviceIdentity('The Commons operator'); // back this key up to custody
const provisioned = await buildCommonsProvisioning({
  operator,
  postNodeKeyHex: '<the community node post-receipt PUBLIC key, 64-hex>',
  randomBytes: (n) => new Uint8Array(randomBytes(n)),
  // topics: [...]  // optional; defaults to DEFAULT_COMMONS_TOPICS
});
writeFileSync('the-commons.provision.json', serializeCommonsProvisioning(provisioned));
```

Back up the operator key material to custody, and keep `the-commons.provision.json` (it carries
no secrets: owner-signed public descriptors + the same opaque snapshot bytes the node serves
publicly).

## Boot The Commons on the node

Point the community node at the provision file and wire the verify-to-view session verifier:

```
COMMONS_PROVISION_FILE=/data/the-commons.provision.json \
SESSION_VERIFY_URL=https://accounts.example  # the persona service base (P9 read gate uses it) \
  pnpm --filter @mylife/meerkat-relay start:community-node
```

On boot the node:
1. Parses the file FAIL-CLOSED: a tampered file, a non-`the-commons` community, or an id/descriptor
   mismatch is refused and The Commons stays OFF (`commons: rejected` in the ready log) rather
   than serving a rogue feed.
2. Registers each Commons publication.
3. Flags those publication ids GATED for verify-to-view (Plan 39 P9). A gated read requires a
   valid `x-mk-session`; without `SESSION_VERIFY_URL` the ready log says
   `gated-but-no-verifier` and gated reads return 500 (fail-closed), never open.

The ready log's `commons` field states the honest state: `off`, `rejected`,
`gated (n/m registered)`, or `gated-but-no-verifier (n/m)`.

## Honesty boundary (NC-P4, binding)

Verify-to-view is REAL only on the first-party node, and only for the publications it flags
gated. A self-hosted third-party community node that does not set `publicRead`/`COMMONS_PROVISION_FILE`
serves its reads openly; the app labels such content honestly and never claims a gate a node
does not enforce. The private mesh tier and reads on non-gated publications are untouched
(NC-P1).
