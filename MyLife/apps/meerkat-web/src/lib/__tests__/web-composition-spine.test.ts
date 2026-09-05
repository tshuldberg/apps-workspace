/**
 * Composition Phase 1 spine, WEB twin (block registry + layout resolution). Proves:
 *   - every registered block's configSchema is STRICT (unknown keys rejected,
 *     the F8 type-exact boundary) and validateBlockConfig is total;
 *   - the structural no-URL invariant: no block config accepts url-shaped keys
 *     and no schema field can smuggle a network destination;
 *   - two-layer capability honesty (declared is never available: an undeclared
 *     capability blocks, a declared-but-no-runtime capability still blocks);
 *   - default kind stacks reference only known blocks valid on channels;
 *   - resolveActiveLayout fails SAFE to the legacy rendering on no event,
 *     tombstone, forged event, and malformed blob, and resolves a real
 *     owner-signed document;
 *   - per-node degradation: one bad node renders the placeholder alone;
 *   - the cm_layout DDL + entity rule landed together (rule-less guard is in
 *     library-core.test.ts; here we assert the specific scope).
 */

import { describe, expect, it } from 'vitest';
import { encodeLayoutBlob, type MkLayoutDocument } from '@mylife/meerkat-layout';
import {
  createCommunity,
  createCommunityLayoutEvent,
  generateDeviceIdentity,
} from '@mylife/sync';
import {
  BLOCK_CONFIG_FIELDS,
  BLOCK_REGISTRY,
  CAPABILITY_KEYS,
  DEFAULT_KIND_BLOCKS,
  KNOWN_BLOCK_TYPES,
  blockPlaceholderLine,
  isKnownBlockType,
  resolveBlockAvailability,
  validateBlockConfig,
} from '../block-registry-core';
import {
  channelBlockStack,
  draftLayoutProblems,
  resolveActiveLayout,
  resolveBlockStack,
} from '../community-layout-core';
import { COMMUNITY_SYNC_POLICY } from '../meerkat-data';

const DOC: MkLayoutDocument = {
  capabilities: ['video'],
  tiers: [],
  home: [
    { type: 'hero', config: { title: 'Welcome' } },
    { type: 'video_gallery', config: {} },
  ],
  channels: { general: [{ type: 'posts', config: {} }] },
};

describe('block registry contracts', () => {
  it('every known block validates an empty config or rejects it deterministically, never throws', () => {
    for (const type of KNOWN_BLOCK_TYPES) {
      expect(() => validateBlockConfig(type, {})).not.toThrow();
      expect(isKnownBlockType(type)).toBe(true);
    }
    expect(validateBlockConfig('holo_deck', {})).toEqual({ status: 'unknown_type' });
  });

  it('configs are STRICT: an unknown key is rejected per block (F8)', () => {
    for (const type of KNOWN_BLOCK_TYPES) {
      expect(validateBlockConfig(type, { smuggled: 'payload' }).status).toBe('invalid');
    }
  });

  it('structural no-URL invariant: url-shaped keys are rejected on every block', () => {
    for (const type of KNOWN_BLOCK_TYPES) {
      for (const key of ['url', 'href', 'src', 'link', 'uri', 'endpoint']) {
        expect(validateBlockConfig(type, { [key]: 'https://evil.example' }).status).toBe('invalid');
      }
    }
  });

  it('declared data sources are cm_/mk_ tables only (block-data-scope floor)', () => {
    for (const type of KNOWN_BLOCK_TYPES) {
      for (const table of BLOCK_REGISTRY[type].dataSources) {
        expect(table).toMatch(/^(cm|mk)_[a-z_]+$/);
      }
    }
  });

  it('capability gates: undeclared blocks, declared-but-unavailable blocks, both fail honestly', () => {
    // video_gallery requires 'video'.
    const notDeclared = resolveBlockAvailability('video_gallery', [], {});
    expect(notDeclared).toEqual({ status: 'needs_capability', capability: 'video' });
    const declaredNoRuntime = resolveBlockAvailability('video_gallery', ['video'], {});
    expect(declaredNoRuntime).toEqual({ status: 'declared_unavailable', capability: 'video' });
    const available = resolveBlockAvailability('video_gallery', ['video'], { video: true });
    expect(available).toEqual({ status: 'available' });
    // Ungated blocks are always available.
    expect(resolveBlockAvailability('chat', [], {})).toEqual({ status: 'available' });
    // Placeholder copy exists for every degraded state and never for available.
    expect(blockPlaceholderLine(notDeclared)).toContain('turned on in community settings');
    expect(blockPlaceholderLine(declaredNoRuntime)).toContain('enabled here');
    expect(blockPlaceholderLine({ status: 'unknown_type' })).toContain('does not support yet');
    expect(blockPlaceholderLine(available)).toBeNull();
  });

  it('every capability key is a known slug and every gate uses a known key', () => {
    for (const type of KNOWN_BLOCK_TYPES) {
      for (const cap of BLOCK_REGISTRY[type].requires) {
        expect(CAPABILITY_KEYS).toContain(cap);
      }
    }
  });

  it('default kind stacks reference known blocks placeable on channels', () => {
    for (const [kind, stack] of Object.entries(DEFAULT_KIND_BLOCKS)) {
      expect(stack.length).toBeGreaterThan(0);
      for (const node of stack) {
        expect(isKnownBlockType(node.type)).toBe(true);
        const surfaces = BLOCK_REGISTRY[node.type].surfaces;
        expect(surfaces === 'channel' || surfaces === 'both').toBe(true);
        expect(validateBlockConfig(node.type, node.config).status).toBe('ok');
      }
      expect(kind).toMatch(/^[a-z_]+$/);
    }
  });
});

describe('resolveActiveLayout (fail-safe choke point)', () => {
  const owner = generateDeviceIdentity('Owner');
  const communityId = 'c-layout-1';
  const blob = encodeLayoutBlob(DOC);

  it('resolves a verified owner-signed document', () => {
    const event = createCommunityLayoutEvent(owner, { communityId, revision: 1, layoutBlob: blob });
    const result = resolveActiveLayout({ events: [event], ownerDeviceId: owner.publicKey, legacyLayout: 'chat_first' });
    expect(result.source).toBe('layout_document');
    if (result.source !== 'layout_document') throw new Error('expected document');
    expect(result.document).toEqual(DOC);
    expect(result.revision).toBe(1);
  });

  it('fails safe to legacy: no events, tombstone winner, forged event', () => {
    expect(resolveActiveLayout({ events: [], ownerDeviceId: owner.publicKey, legacyLayout: 'library_first' }))
      .toEqual({ source: 'legacy', legacyLayout: 'library_first' });
    const r1 = createCommunityLayoutEvent(owner, { communityId, revision: 1, layoutBlob: blob });
    const tomb = createCommunityLayoutEvent(owner, { communityId, revision: 2, tombstone: true });
    expect(resolveActiveLayout({ events: [r1, tomb], ownerDeviceId: owner.publicKey, legacyLayout: 'chat_first' }).source)
      .toBe('legacy');
    const stranger = generateDeviceIdentity('Stranger');
    const forged = createCommunityLayoutEvent(stranger, { communityId, revision: 9, layoutBlob: blob });
    expect(resolveActiveLayout({ events: [forged], ownerDeviceId: owner.publicKey, legacyLayout: 'chat_first' }).source)
      .toBe('legacy');
  });

  it('fails safe to legacy on a sync-valid but codec-malformed blob', () => {
    // Passes the sync layer's namespace/token gate but fails the codec checksum.
    const badBlob = 'meerkat-layout:v1:notbase64!!:zzzzzzzz'.replace('!!', '');
    const event = createCommunityLayoutEvent(owner, { communityId, revision: 1, layoutBlob: badBlob });
    expect(resolveActiveLayout({ events: [event], ownerDeviceId: owner.publicKey, legacyLayout: 'chat_first' }))
      .toEqual({ source: 'legacy', legacyLayout: 'chat_first' });
  });
});

describe('per-node degradation + channel stacks', () => {
  it('one bad node degrades alone; the rest of the stack renders', () => {
    const resolved = resolveBlockStack(
      [
        { type: 'chat', config: {} },
        { type: 'future_widget', config: {} },
        { type: 'members', config: { maxShown: 'lots' } },
        { type: 'hero', config: { title: 'Hi' } },
      ],
      [],
      {},
    );
    expect(resolved.map((n) => n.renderable)).toEqual([true, false, false, true]);
    expect(resolved[1]!.availability.status).toBe('unknown_type');
    expect(resolved[2]!.availability.status).toBe('unknown_type');
  });

  it('channelBlockStack: override wins, kind default fills, chat/library/unknown return null', () => {
    expect(channelBlockStack(DOC, 'general', 'forum')).toEqual([{ type: 'posts', config: {} }]);
    expect(channelBlockStack(DOC, 'clips', 'video')).toEqual([{ type: 'video_gallery', config: {} }]);
    expect(channelBlockStack(null, 'clips', 'video')).toEqual([{ type: 'video_gallery', config: {} }]);
    expect(channelBlockStack(DOC, 'general2', 'chat')).toBeNull();
    expect(channelBlockStack(DOC, 'lib', 'library')).toBeNull();
    expect(channelBlockStack(DOC, 'x', 'unknown')).toBeNull();
  });

  it('draftLayoutProblems flags unplaceable types, bad configs, and wrong surfaces', () => {
    const problems = draftLayoutProblems({
      capabilities: [],
      tiers: [],
      home: [{ type: 'future_widget', config: {} }, { type: 'members', config: { maxShown: 0 } }],
      channels: { general: [{ type: 'hero', config: {} }] },
    });
    expect(problems.some((p) => p.includes('future_widget'))).toBe(true);
    expect(problems.some((p) => p.includes('invalid settings'))).toBe(true);
    expect(problems.some((p) => p.includes('cannot be placed on the channel surface'))).toBe(true);
    expect(draftLayoutProblems(DOC)).toEqual([]);
  });
});

describe('cm_layout sync policy', () => {
  it('replicates at shared_workspace with lww (rule landed with the DDL)', () => {
    const rule = COMMUNITY_SYNC_POLICY.entityRules.find((r) => r.tableName === 'cm_layout');
    expect(rule?.defaultScope).toBe('shared_workspace');
    expect(rule?.maxScope).toBe('shared_workspace');
    expect(rule?.conflictStrategy).toBe('lww');
  });
});

describe('kind slot compatibility (correction 1.1)', () => {
  it('a descriptor carrying a new block-backed kind still signs and verifies', () => {
    const owner = generateDeviceIdentity('Owner');
    const signed = createCommunity(owner, {
      name: 'Composed',
      channels: [
        { id: 'general', name: 'general' },
        { id: 'clips', name: 'clips', kind: 'video' },
        { id: 'wiki', name: 'wiki', kind: 'page' },
      ],
    });
    const kinds = signed.descriptor.channels.map((c) => c.kind ?? 'chat');
    expect(kinds).toEqual(['chat', 'video', 'page']);
  });
});

describe('editor field descriptors', () => {
  it('every descriptor key is accepted by its block schema with a max-length value', () => {
    for (const [type, fields] of Object.entries(BLOCK_CONFIG_FIELDS)) {
      for (const field of fields) {
        const value = field.kind === 'number' ? Math.min(field.max ?? 1, 50)
          : field.kind === 'channel' ? 'general'
          : 'x'.repeat(Math.min(field.max ?? 10, 10));
        const parse = validateBlockConfig(type, { [field.key]: value });
        expect(parse.status, `${type}.${field.key}`).toBe('ok');
      }
    }
  });
});
