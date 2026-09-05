import { generateDeviceIdentity, extractSigningPrivateKeyHex } from '@mylife/sync';
import { describe, expect, it } from 'vitest';
import { signRevision, signSuggestion } from './sign';
import {
  authorshipBadgeLabel,
  authorshipBadgeTone,
  recoveryBranding,
  verifyRevisionAuthorship,
  verifySuggestionAuthorship,
  type ChainKeyEvent,
  type ChainKeyRow,
  type StoredRevisionForVerify,
  type StoredSuggestionForVerify,
} from './reader-verify';

const BYLINE = '11111111-1111-1111-1111-111111111111';
const OTHER_PROFILE = '22222222-2222-2222-2222-222222222222';
const ARTICLE = '33333333-3333-3333-3333-333333333333';

function identity() {
  const device = generateDeviceIdentity('MyNews Author');
  return {
    pubkey: device.publicKey,
    privateKeyHex: extractSigningPrivateKeyHex(device.privateKeyRef),
  };
}

function chainRow(overrides: Partial<ChainKeyRow> & { id: string; pubkey: string }): ChainKeyRow {
  return {
    profileId: BYLINE,
    status: 'active',
    kind: 'primary',
    addedVia: 'initial',
    validFrom: '2026-07-01T00:00:00.000Z',
    revokedAt: null,
    ...overrides,
  };
}

function signedRevision(
  keys: { pubkey: string; privateKeyHex: string },
  overrides?: Partial<StoredRevisionForVerify>,
): StoredRevisionForVerify {
  const base = {
    articleId: ARTICLE,
    rev: 1,
    headline: 'Council votes on the sweeping plan',
    dek: 'A short standfirst',
    bodyMd: 'The council voted 7 to 2.',
    changelog: [],
    createdAt: '2026-07-15T12:00:00.000Z',
    signerPubkey: keys.pubkey,
    ...overrides,
  };
  return {
    ...base,
    signature: signRevision(base, keys.privateKeyHex),
    // `in` rather than `??`: an EXPLICIT null is the unrecorded case and must
    // not fall through to the default.
    verifiedKeyId: overrides && 'verifiedKeyId' in overrides ? overrides.verifiedKeyId! : 'key-1',
  };
}

function signedSuggestion(
  keys: { pubkey: string; privateKeyHex: string },
  overrides?: Partial<StoredSuggestionForVerify>,
): StoredSuggestionForVerify {
  const base = {
    articleId: ARTICLE,
    baseRev: 1,
    type: 'correction' as const,
    diffJson: '{"ops":[]}',
    citations: ['https://example.org/source'],
    rationale: 'The vote was 7 to 2, not 7 to 3.',
    editorPubkey: keys.pubkey,
    ...overrides,
  };
  return {
    ...base,
    signature: signSuggestion(base, keys.privateKeyHex),
    verifiedKeyId: overrides && 'verifiedKeyId' in overrides ? overrides.verifiedKeyId! : 'key-1',
  };
}

describe('revision authorship verification', () => {
  it('verifies a revision signed by the active chain key on the byline', () => {
    const keys = identity();
    const result = verifyRevisionAuthorship({
      revision: signedRevision(keys),
      bylineProfileId: BYLINE,
      chain: [chainRow({ id: 'key-1', pubkey: keys.pubkey })],
    });
    expect(result.verdict).toBe('verified');
    expect(result.keyRetired).toBe(false);
    expect(authorshipBadgeTone(result)).toBe('pass');
    expect(authorshipBadgeLabel(result)).toBe('Signature verified');
  });

  it('keeps a revision verifiable across a ROTATION boundary', () => {
    // The old key is revoked and a new primary is active. History signed by the
    // old key must stay authentic: revocation stops NEW writes, it does not
    // rewrite the past.
    const oldKeys = identity();
    const newKeys = identity();
    const result = verifyRevisionAuthorship({
      revision: signedRevision(oldKeys, { verifiedKeyId: 'key-old' }),
      bylineProfileId: BYLINE,
      chain: [
        chainRow({
          id: 'key-old',
          pubkey: oldKeys.pubkey,
          status: 'revoked',
          revokedAt: '2026-07-20T00:00:00.000Z',
        }),
        chainRow({
          id: 'key-new',
          pubkey: newKeys.pubkey,
          addedVia: 'rotation',
          validFrom: '2026-07-20T00:00:00.000Z',
        }),
      ],
    });
    expect(result.verdict).toBe('verified');
    expect(result.keyRetired).toBe(true);
    expect(authorshipBadgeLabel(result)).toBe('Signature verified (key since rotated)');
    expect(authorshipBadgeTone(result)).toBe('pass');
  });

  it('keeps a revision verifiable across a RECOVERY boundary', () => {
    const recoveredKeys = identity();
    const result = verifyRevisionAuthorship({
      revision: signedRevision(recoveredKeys, { verifiedKeyId: 'key-rec' }),
      bylineProfileId: BYLINE,
      chain: [
        chainRow({
          id: 'key-rec',
          pubkey: recoveredKeys.pubkey,
          addedVia: 'recovery',
        }),
      ],
    });
    expect(result.verdict).toBe('verified');
    expect(result.addedVia).toBe('recovery');
    expect(authorshipBadgeLabel(result)).toBe(
      'Signature verified (key restored via account recovery)',
    );
  });

  it('labels a co-active device key distinctly', () => {
    const keys = identity();
    const result = verifyRevisionAuthorship({
      revision: signedRevision(keys),
      bylineProfileId: BYLINE,
      chain: [
        chainRow({ id: 'key-1', pubkey: keys.pubkey, kind: 'device', addedVia: 'device_approval' }),
      ],
    });
    expect(result.verdict).toBe('verified');
    expect(authorshipBadgeLabel(result)).toBe('Signature verified (device key)');
  });

  it('reports chain-unrecorded when the server recorded no key row', () => {
    const keys = identity();
    const result = verifyRevisionAuthorship({
      revision: signedRevision(keys, { verifiedKeyId: null }),
      bylineProfileId: BYLINE,
      chain: [chainRow({ id: 'key-1', pubkey: keys.pubkey })],
    });
    expect(result.verdict).toBe('chain-unrecorded');
    expect(authorshipBadgeTone(result)).toBe('caveat');
    expect(authorshipBadgeLabel(result)).toBe('Signed, not key-chain recorded');
  });

  it('reports key-mismatch when the recorded row holds a different key', () => {
    const keys = identity();
    const decoy = identity();
    const result = verifyRevisionAuthorship({
      revision: signedRevision(keys, { verifiedKeyId: 'key-decoy' }),
      bylineProfileId: BYLINE,
      chain: [chainRow({ id: 'key-decoy', pubkey: decoy.pubkey })],
    });
    expect(result.verdict).toBe('key-mismatch');
    expect(authorshipBadgeTone(result)).toBe('fail');
  });

  it('reports wrong-profile when the recorded row belongs to another byline', () => {
    const keys = identity();
    const result = verifyRevisionAuthorship({
      revision: signedRevision(keys, { verifiedKeyId: 'key-1' }),
      bylineProfileId: BYLINE,
      chain: [chainRow({ id: 'key-1', pubkey: keys.pubkey, profileId: OTHER_PROFILE })],
    });
    expect(result.verdict).toBe('wrong-profile');
    expect(authorshipBadgeTone(result)).toBe('fail');
  });

  it('reports wrong-profile when the recorded row is absent from the byline chain', () => {
    const keys = identity();
    const result = verifyRevisionAuthorship({
      revision: signedRevision(keys, { verifiedKeyId: 'key-nowhere' }),
      bylineProfileId: BYLINE,
      chain: [chainRow({ id: 'key-1', pubkey: keys.pubkey })],
    });
    expect(result.verdict).toBe('wrong-profile');
  });

  it('rejects a tampered headline, body, and changelog', () => {
    const keys = identity();
    const chain = [chainRow({ id: 'key-1', pubkey: keys.pubkey })];
    const honest = signedRevision(keys);
    for (const tampered of [
      { ...honest, headline: 'Council rejects the sweeping plan' },
      { ...honest, bodyMd: 'The council voted 2 to 7.' },
      { ...honest, changelog: [{ suggestionId: 'x', editorKey: 'y', type: 'correction' as const }] },
      { ...honest, dek: 'A different standfirst' },
      { ...honest, rev: 2 },
    ]) {
      expect(
        verifyRevisionAuthorship({ revision: tampered, bylineProfileId: BYLINE, chain }).verdict,
      ).toBe('bad-signature');
    }
  });

  it('checks the signature before the chain, so unsigned bytes never report a chain problem', () => {
    const keys = identity();
    const result = verifyRevisionAuthorship({
      revision: { ...signedRevision(keys), headline: 'edited', verifiedKeyId: null },
      bylineProfileId: BYLINE,
      chain: [],
    });
    expect(result.verdict).toBe('bad-signature');
  });
});

describe('wall-clock independence (design finding C-2)', () => {
  it('verifies a revision whose createdAt long PREDATES the key validFrom', () => {
    // A time-window verifier would reject this. Validity is chain membership,
    // not a window, precisely because the client controls createdAt.
    const keys = identity();
    const result = verifyRevisionAuthorship({
      revision: signedRevision(keys, { createdAt: '2020-01-01T00:00:00.000Z' }),
      bylineProfileId: BYLINE,
      chain: [chainRow({ id: 'key-1', pubkey: keys.pubkey, validFrom: '2026-07-01T00:00:00.000Z' })],
    });
    expect(result.verdict).toBe('verified');
  });

  it('verifies a revision whose createdAt POSTDATES the key revocation', () => {
    const keys = identity();
    const result = verifyRevisionAuthorship({
      revision: signedRevision(keys, { createdAt: '2030-01-01T00:00:00.000Z' }),
      bylineProfileId: BYLINE,
      chain: [
        chainRow({
          id: 'key-1',
          pubkey: keys.pubkey,
          status: 'revoked',
          revokedAt: '2026-07-02T00:00:00.000Z',
        }),
      ],
    });
    expect(result.verdict).toBe('verified');
    expect(result.keyRetired).toBe(true);
  });

  it('rejects a createdAt edited AFTER signing, because it is inside the signed bytes', () => {
    const keys = identity();
    const honest = signedRevision(keys);
    const result = verifyRevisionAuthorship({
      revision: { ...honest, createdAt: '2020-01-01T00:00:00.000Z' },
      bylineProfileId: BYLINE,
      chain: [chainRow({ id: 'key-1', pubkey: keys.pubkey })],
    });
    expect(result.verdict).toBe('bad-signature');
  });
});

describe('suggestion authorship verification', () => {
  it('verifies a suggestion against the editor chain', () => {
    const keys = identity();
    const result = verifySuggestionAuthorship({
      suggestion: signedSuggestion(keys),
      editorProfileId: BYLINE,
      chain: [chainRow({ id: 'key-1', pubkey: keys.pubkey })],
    });
    expect(result.verdict).toBe('verified');
  });

  it('stays verifiable after the editor rotates, using the RECORDED signer', () => {
    // The whole point of recording signer_pubkey: assuming the editor's current
    // key would fail every suggestion filed before the rotation.
    const oldKeys = identity();
    const newKeys = identity();
    const result = verifySuggestionAuthorship({
      suggestion: signedSuggestion(oldKeys, { verifiedKeyId: 'key-old' }),
      editorProfileId: BYLINE,
      chain: [
        chainRow({ id: 'key-old', pubkey: oldKeys.pubkey, status: 'revoked', revokedAt: 'x' }),
        chainRow({ id: 'key-new', pubkey: newKeys.pubkey, addedVia: 'rotation' }),
      ],
    });
    expect(result.verdict).toBe('verified');
    expect(result.keyRetired).toBe(true);
  });

  it('reports chain-unrecorded for a pre-WP6 row with no recorded signer', () => {
    const keys = identity();
    const result = verifySuggestionAuthorship({
      suggestion: { ...signedSuggestion(keys), editorPubkey: '', verifiedKeyId: null },
      editorProfileId: BYLINE,
      chain: [chainRow({ id: 'key-1', pubkey: keys.pubkey })],
    });
    expect(result.verdict).toBe('chain-unrecorded');
  });

  it('rejects a tampered rationale, diff, and citations', () => {
    const keys = identity();
    const chain = [chainRow({ id: 'key-1', pubkey: keys.pubkey })];
    const honest = signedSuggestion(keys);
    for (const tampered of [
      { ...honest, rationale: 'Actually the vote was unanimous.' },
      { ...honest, diffJson: '{"ops":[{"a":1}]}' },
      { ...honest, citations: ['https://example.org/other'] },
      { ...honest, baseRev: 2 },
    ]) {
      expect(
        verifySuggestionAuthorship({
          suggestion: tampered,
          editorProfileId: BYLINE,
          chain,
        }).verdict,
      ).toBe('bad-signature');
    }
  });

  it('reports wrong-profile when the recorded row belongs to another editor', () => {
    const keys = identity();
    const result = verifySuggestionAuthorship({
      suggestion: signedSuggestion(keys),
      editorProfileId: BYLINE,
      chain: [chainRow({ id: 'key-1', pubkey: keys.pubkey, profileId: OTHER_PROFILE })],
    });
    expect(result.verdict).toBe('wrong-profile');
  });
});

describe('recovery branding', () => {
  const fmt = (iso: string) => iso.slice(0, 10);

  it('brands only COMPLETED recoveries', () => {
    const events: ChainKeyEvent[] = [
      { kind: 'recovery_requested', createdAt: '2026-07-01T00:00:00.000Z' },
      { kind: 'recovery_cancelled', createdAt: '2026-07-02T00:00:00.000Z' },
      { kind: 'recovery_frozen', createdAt: '2026-07-03T00:00:00.000Z' },
      { kind: 'rotation', createdAt: '2026-07-04T00:00:00.000Z' },
    ];
    expect(recoveryBranding(events, fmt)).toBeNull();
  });

  it('brands with the date of the most recent completed recovery', () => {
    const events: ChainKeyEvent[] = [
      { kind: 'recovery_completed', createdAt: '2026-05-05T00:00:00.000Z' },
      { kind: 'recovery_requested', createdAt: '2026-07-01T00:00:00.000Z' },
      { kind: 'recovery_completed', createdAt: '2026-07-09T00:00:00.000Z' },
    ];
    expect(recoveryBranding(events, fmt)).toBe(
      'Signing key replaced via account recovery on 2026-07-09',
    );
  });

  it('brands nothing on an empty feed', () => {
    expect(recoveryBranding([], fmt)).toBeNull();
  });
});
