/**
 * Plan 19 (Meerkat Public Social Layer) P9 -- public archive job lifecycle.
 *
 * The ArchiveJob is the durable-pin request for a publication's PUBLIC snapshot.
 * It is owner-signed and carries an explicit rights/consent block (license,
 * rights-assertion, provenance, consent timestamp). A host runs verifyArchiveJob
 * BEFORE pinning; only an 'ok' verdict proceeds, so a consent-less or rights-less
 * publish never reaches the durable archive (NC-8). The dedupe + index key is the
 * content-addressed contentId, identical to the host-registry id so two
 * publications of the same content resolve to ONE stored copy + ONE index entry.
 *
 * AC (P9): full verdict matrix (ok/invalid/not_owner/no_consent/no_rights),
 * deriveArchiveIndexKey == deriveContentRegistryId stability, rights carried +
 * signed, tamper -> fail-closed (no partial trust). Backs AC-10, NC-8, TC-11.
 */

import { describe, it, expect } from 'vitest';
import { generateDeviceIdentity } from '../identity/device-identity';
import { createPublication, type SignedPublicationDescriptor } from '../protocol/publication';
import { deriveContentRegistryId } from '../node/host-registry';
import {
  createArchiveJob,
  verifyArchiveJob,
  deriveArchiveIndexKey,
  type ArchiveLicense,
  type PublicationRights,
  type RightsAssertion,
  type SignedArchiveJob,
} from '../protocol/public-archive';

const NOW = '2026-06-30T00:00:00.000Z';

function publication(owner = generateDeviceIdentity('Owner')): {
  owner: ReturnType<typeof generateDeviceIdentity>;
  signed: SignedPublicationDescriptor;
} {
  const signed = createPublication(owner, {
    kind: 'channel',
    communityId: 'comm-1',
    channelId: 'chan-1',
    postId: null,
    title: 'NYC Cyclists',
    description: 'A public channel for NYC cyclists.',
    category: 'local',
    contentId: 'snapshot-cid-archive-1',
    publicKeyHex: 'aabbccddeeff00',
    hostUrls: ['https://host.example'],
    joinPolicy: 'open',
    now: NOW,
  });
  return { owner, signed };
}

const validRights: PublicationRights = {
  license: 'cc_by',
  rightsAssertion: 'i_own',
  provenance: 'Photographed by me, 2026.',
  consentAt: NOW,
};

function jobOpts(rights: PublicationRights = validRights) {
  return {
    tier: 'self_host' as const,
    hostUrl: 'https://host.example',
    objects: [{ index: 0, hash: 'ab'.repeat(32), size: 3 }],
    rights,
    now: NOW,
  };
}

describe('deriveArchiveIndexKey (dedupe + index key stability)', () => {
  it('equals deriveContentRegistryId for the same contentId', () => {
    for (const cid of ['snapshot-cid-archive-1', 'another-content', 'x'.repeat(64)]) {
      expect(deriveArchiveIndexKey(cid)).toBe(deriveContentRegistryId(cid));
    }
  });

  it('is deterministic and distinct per contentId', () => {
    expect(deriveArchiveIndexKey('a')).toBe(deriveArchiveIndexKey('a'));
    expect(deriveArchiveIndexKey('a')).not.toBe(deriveArchiveIndexKey('b'));
    expect(deriveArchiveIndexKey('a')).toHaveLength(64);
  });
});

describe('createArchiveJob / verifyArchiveJob (P9 verdict matrix)', () => {
  it('creates an owner-signed job that verifies ok and carries rights from the publication', () => {
    const { owner, signed } = publication();
    const job = createArchiveJob(owner, signed, jobOpts());

    expect(verifyArchiveJob(job)).toBe('ok');
    expect(verifyArchiveJob(job, signed)).toBe('ok');
    // contentId + publicationId are bound to the publication, not caller-supplied.
    expect(job.job.contentId).toBe(signed.descriptor.contentId);
    expect(job.job.publicationId).toBe(signed.descriptor.publicationId);
    expect(job.job.ownerDeviceId).toBe(owner.publicKey);
    // rights carried verbatim + both signatures present.
    expect(job.job.rights).toEqual(validRights);
    expect(typeof job.rightsSignature).toBe('string');
    expect(job.rightsSignature.length).toBeGreaterThan(0);
    expect(typeof job.signature).toBe('string');
    expect(job.signature.length).toBeGreaterThan(0);
    // the dedupe key is the content-addressed index key.
    expect(deriveArchiveIndexKey(job.job.contentId)).toBe(
      deriveContentRegistryId(signed.descriptor.contentId),
    );
  });

  it('returns not_owner when the signer is not the publication owner (checked vs publication)', () => {
    const { signed } = publication();
    const stranger = generateDeviceIdentity('Stranger');
    const job = createArchiveJob(stranger, signed, jobOpts());

    // self-consistent + signed, so single-arg verify cannot tell -> ok.
    expect(verifyArchiveJob(job)).toBe('ok');
    // with the publication, the owner mismatch is caught fail-closed.
    expect(verifyArchiveJob(job, signed)).toBe('not_owner');
  });

  it('returns no_consent when the consent timestamp is absent', () => {
    const { owner, signed } = publication();
    const job = createArchiveJob(owner, signed, jobOpts({ ...validRights, consentAt: '' }));
    expect(verifyArchiveJob(job)).toBe('no_consent');
    expect(verifyArchiveJob(job, signed)).toBe('no_consent');
  });

  it('returns no_rights when license or rights-assertion is missing/invalid', () => {
    const { owner, signed } = publication();
    const noLicense = createArchiveJob(
      owner,
      signed,
      jobOpts({ ...validRights, license: '' as ArchiveLicense }),
    );
    expect(verifyArchiveJob(noLicense)).toBe('no_rights');

    const noAssertion = createArchiveJob(
      owner,
      signed,
      jobOpts({ ...validRights, rightsAssertion: 'nonsense' as RightsAssertion }),
    );
    expect(verifyArchiveJob(noAssertion)).toBe('no_rights');
  });

  it('accepts every valid license + rights-assertion combination', () => {
    const { owner, signed } = publication();
    const licenses: ArchiveLicense[] = [
      'all_rights_reserved', 'cc_by', 'cc_by_sa', 'cc0', 'public_domain', 'other',
    ];
    const assertions: RightsAssertion[] = ['i_own', 'i_have_permission', 'public_domain', 'fair_use'];
    for (const license of licenses) {
      for (const rightsAssertion of assertions) {
        const job = createArchiveJob(owner, signed, jobOpts({ ...validRights, license, rightsAssertion }));
        expect(verifyArchiveJob(job)).toBe('ok');
      }
    }
  });

  it('fails closed on a tampered job field (no partial trust)', () => {
    const { owner, signed } = publication();
    const job = createArchiveJob(owner, signed, jobOpts());

    const tamperedContent: SignedArchiveJob = {
      ...job,
      job: { ...job.job, contentId: 'evil-cid' },
    };
    expect(verifyArchiveJob(tamperedContent)).toBe('invalid');

    const tamperedTier: SignedArchiveJob = {
      ...job,
      job: { ...job.job, tier: 'managed' },
    };
    expect(verifyArchiveJob(tamperedTier)).toBe('invalid');

    const tamperedSig: SignedArchiveJob = { ...job, signature: '00'.repeat(32) };
    expect(verifyArchiveJob(tamperedSig)).toBe('invalid');

    const tamperedManifest: SignedArchiveJob = {
      ...job,
      job: { ...job.job, objects: [{ ...job.job.objects[0]!, hash: 'cd'.repeat(32) }] },
    };
    expect(verifyArchiveJob(tamperedManifest)).toBe('invalid');
  });

  it('fails closed when the rights block is mutated after signing', () => {
    const { owner, signed } = publication();
    const job = createArchiveJob(owner, signed, jobOpts());
    // swap to a different VALID license (passes enum checks, breaks the signature).
    const mutated: SignedArchiveJob = {
      ...job,
      job: { ...job.job, rights: { ...job.job.rights, license: 'cc0' } },
    };
    expect(verifyArchiveJob(mutated)).toBe('invalid');
  });

  it('returns invalid for malformed input', () => {
    expect(verifyArchiveJob(null as never)).toBe('invalid');
    expect(verifyArchiveJob({} as never)).toBe('invalid');
    const { owner, signed } = publication();
    const job = createArchiveJob(owner, signed, jobOpts());
    expect(verifyArchiveJob({ ...job, job: { ...job.job, version: 1 as never } })).toBe('invalid');
    expect(verifyArchiveJob({ ...job, job: { ...job.job, tier: 'free' as never } })).toBe('invalid');
  });
});
