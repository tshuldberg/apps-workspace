import { ONBOARDING_EXPERIENCES, buildExperienceLayout } from '../../lib/onboarding-experience-core';
// Composition plan 2.4 (WEB): the owner's layout editor, rendered inside
// CommunitySettings. Same shape as the mobile layout-editor route: a draft
// layout document in local state, an Edit | Preview switch so the owner can
// flip to a full preview at any moment, LIVE preview rendered through the REAL
// block registry (preview IS the product), publish = one signed cm_layout
// revision on the identity-event rail. Templates: the draft exports/imports as
// a meerkat-layout codec blob (copy/paste + deep link). The non-removable
// floors are structural: the channel sidebar and settings gear render outside
// the block stack and cannot be edited away.

import { useCallback, useMemo, useState } from 'react';
import { communityLayout } from '@mylife/sync';
import {
  buildLayoutDeepLink,
  decodeLayoutBlob,
  encodeLayoutBlob,
  extractLayoutBlob,
  type MkBlockNode,
  type MkLayoutDocument,
} from '@mylife/meerkat-layout';
import { useMeerkat } from '../../lib/MeerkatProvider';
import {
  BLOCK_CONFIG_FIELDS,
  BLOCK_REGISTRY,
  CAPABILITY_KEYS,
  CAPABILITY_LABELS,
  CAPABILITY_UNAVAILABLE_COPY,
  KNOWN_BLOCK_TYPES,
  isKnownBlockType,
  type KnownBlockType,
} from '../../lib/block-registry-core';
import { draftLayoutProblems, resolveActiveLayout } from '../../lib/community-layout-core';
import { listCommunityLayoutEvents } from '../../lib/meerkat-data';
import { buildBlockQueries } from '../../lib/block-queries';
import { BlockStack } from '../blocks/BlockStack';
import type { BlockHostContext } from '../blocks/registry';
import { Button } from '../shell/Button';
import { HonestNotice } from '../shell/HonestNotice';

/** The starter home for a community that has never been composed. */
function starterDocument(): MkLayoutDocument {
  return {
    capabilities: [],
    tiers: [],
    home: [
      { type: 'hero', config: {} },
      { type: 'chat', config: {} },
      { type: 'members', config: {} },
    ],
    channels: {},
  };
}

export function LayoutEditorSection({ communityId }: { communityId: string }): React.ReactElement | null {
  const m = useMeerkat();

  const community = useMemo(
    () => m.listCommunities().find((c) => c.communityId === communityId) ?? null,
    [m, communityId],
  );

  const active = useMemo(() => {
    if (!community) return null;
    return resolveActiveLayout({
      events: listCommunityLayoutEvents(m.db, communityId),
      ownerDeviceId: community.descriptor.ownerDeviceId,
      legacyLayout: communityLayout(community.descriptor),
    });
  }, [m.db, community, communityId]);

  const [draft, setDraft] = useState<MkLayoutDocument>(() =>
    active?.source === 'layout_document'
      ? JSON.parse(JSON.stringify(active.document)) as MkLayoutDocument
      : starterDocument(),
  );
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [editingChannel, setEditingChannel] = useState<string | null>(null);
  const [configIndex, setConfigIndex] = useState<number | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [importValue, setImportValue] = useState('');
  const [starterId, setStarterId] = useState('standard');
  const [notice, setNotice] = useState<string | null>(null);

  const problems = useMemo(() => draftLayoutProblems(draft), [draft]);

  const blockCtx = useMemo<BlockHostContext | null>(() => {
    if (!community) return null;
    return {
      communityId,
      communityName: community.descriptor.name,
      channels: community.descriptor.channels.map((channel) => ({
        id: channel.id,
        name: channel.name,
        kind: channel.kind ?? 'chat',
      })),
      queries: buildBlockQueries(m.db, community.descriptor),
      onOpenChannel: () => {},
      onOpenFiles: () => {},
      revision: 0,
    };
  }, [m.db, community, communityId]);

  const stack: MkBlockNode[] = editingChannel === null
    ? draft.home
    : draft.channels[editingChannel] ?? [];

  const setStack = useCallback((next: MkBlockNode[]) => {
    setDraft((current) => {
      if (editingChannel === null) return { ...current, home: next };
      const channels = { ...current.channels };
      if (next.length === 0) delete channels[editingChannel];
      else channels[editingChannel] = next;
      return { ...current, channels };
    });
  }, [editingChannel]);

  const surface = editingChannel === null ? 'home' : 'channel';
  const placeable = KNOWN_BLOCK_TYPES.filter((type) => {
    const s = BLOCK_REGISTRY[type].surfaces;
    return s === 'both' || s === surface;
  });

  const moveNode = (index: number, delta: number): void => {
    const next = [...stack];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const [node] = next.splice(index, 1);
    next.splice(target, 0, node!);
    setStack(next);
  };

  const setConfigValue = (index: number, key: string, value: unknown): void => {
    const next = [...stack];
    const node = next[index];
    if (!node) return;
    const config = { ...node.config };
    if (value === '' || value === undefined || value === null) delete config[key];
    else config[key] = value;
    next[index] = { ...node, config };
    setStack(next);
  };

  const publish = (): void => {
    if (problems.length > 0) return;
    try {
      const blob = encodeLayoutBlob(draft);
      m.publishCommunityLayout(communityId, blob);
      setNotice('Layout published. Members receive it on their next sync with you.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save the community layout.');
    }
  };

  const resetToClassic = (): void => {
    try {
      m.tombstoneCommunityLayout(communityId);
      setNotice('Layout cleared. The community renders its classic surfaces again.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not reset the community layout.');
    }
  };

  // "Copied" is claimed only after the clipboard write resolves; a rejected
  // write (no focus, no permission) renders the honest failure instead of
  // dying unhandled while the notice claims success.
  const copyTemplate = (): void => {
    void (async () => {
      try {
        await navigator.clipboard.writeText(buildLayoutDeepLink(draft));
        setNotice('Layout template copied. Paste it in another community’s layout editor.');
      } catch {
        setNotice('Could not copy the template.');
      }
    })();
  };

  const importTemplate = (): void => {
    const blob = extractLayoutBlob(importValue);
    if (!blob) {
      setNotice("That doesn't look like a Meerkat layout.");
      return;
    }
    const decoded = decodeLayoutBlob(blob);
    if (!decoded.success) {
      setNotice(decoded.error.message);
      return;
    }
    setDraft(decoded.layout);
    setImportValue('');
    setNotice('Template imported into the draft. Review it, then publish.');
  };

  if (!community) return null;

  const channelName = editingChannel === null
    ? null
    : community.descriptor.channels.find((c) => c.id === editingChannel)?.name ?? editingChannel;

  return (
    <section className="mk-settings-section">
      <h3>Layout</h3>
      <p className="mk-muted">
        Compose the community home and channel surfaces from blocks. Members receive the new layout on their next sync with you.
      </p>

      <label className="mk-label">Starter layout
        <select aria-label="Starter layout" value={starterId} onChange={(event) => setStarterId(event.target.value)}>
          {ONBOARDING_EXPERIENCES.map((item) => <option key={item.id} value={item.id}>{item.name}{item.ready ? '' : ' (media unfinished)'}</option>)}
        </select>
      </label>
      <Button onClick={() => {
        const starter = buildExperienceLayout(starterId, community.descriptor.name, community.descriptor.channels.find((channel) => !channel.kind || channel.kind === 'chat')?.id);
        setDraft((current) => ({ ...current, home: starter.home, capabilities: [...new Set([...current.capabilities, ...starter.capabilities])] }));
        setEditingChannel(null); setConfigIndex(null); setMode('preview');
        setNotice('Starter loaded into the home draft. Existing channels and content stay in place. Review, then publish when ready.');
      }}>Load starter into draft</Button>

      <div className="mk-layout-editor-chips" role="tablist" aria-label="Layout editor mode">
        <button type="button" role="tab" aria-selected={mode === 'edit'} className={`mk-layout-chip ${mode === 'edit' ? 'active' : ''}`} onClick={() => setMode('edit')}>Edit</button>
        <button type="button" role="tab" aria-selected={mode === 'preview'} className={`mk-layout-chip ${mode === 'preview' ? 'active' : ''}`} onClick={() => setMode('preview')}>Preview</button>
      </div>

      {mode === 'preview' ? (
        <>
          <p className="mk-muted">
            {editingChannel === null ? 'Home preview' : `#${channelName} preview`} · rendered through the real blocks, exactly as members see it.
          </p>
          <div className="mk-layout-preview">
            {blockCtx ? (
              <BlockStack nodes={stack} declaredCapabilities={draft.capabilities} ctx={blockCtx} />
            ) : null}
            {stack.length === 0 ? <p className="mk-muted">Nothing to preview yet.</p> : null}
          </div>
          {problems.map((problem) => <div key={problem} className="mk-layout-problem">{problem}</div>)}
          <Button onClick={publish} disabled={problems.length > 0}>Publish layout</Button>
        </>
      ) : (
        <>
          <div className="mk-layout-editor-chips">
            <button type="button" className={`mk-layout-chip ${editingChannel === null ? 'active' : ''}`} onClick={() => { setEditingChannel(null); setConfigIndex(null); }}>Home</button>
            {community.descriptor.channels.map((channel) => (
              <button key={channel.id} type="button" className={`mk-layout-chip ${editingChannel === channel.id ? 'active' : ''}`} onClick={() => { setEditingChannel(channel.id); setConfigIndex(null); }}>
                #{channel.name}
              </button>
            ))}
          </div>

          {stack.length === 0 ? (
            <p className="mk-muted">
              {editingChannel === null ? 'No blocks yet. Add one below.' : 'Using the standard view for this channel.'}
            </p>
          ) : null}
          {stack.map((node, index) => {
            const known = isKnownBlockType(node.type);
            const label = known ? BLOCK_REGISTRY[node.type as KnownBlockType].label : node.type;
            const fields = known ? BLOCK_CONFIG_FIELDS[node.type as KnownBlockType] : [];
            return (
              <div key={`${node.type}:${index}`} className="mk-layout-node">
                <div className="mk-layout-node-header">
                  <button type="button" className="mk-layout-node-label" onClick={() => setConfigIndex(configIndex === index ? null : index)}>
                    {label}
                  </button>
                  <button type="button" className="mk-layout-icon-btn" aria-label={`Move ${label} up`} onClick={() => moveNode(index, -1)}>↑</button>
                  <button type="button" className="mk-layout-icon-btn" aria-label={`Move ${label} down`} onClick={() => moveNode(index, 1)}>↓</button>
                  <button type="button" className="mk-layout-icon-btn" aria-label={`Remove ${label}`} onClick={() => { setStack(stack.filter((_, i) => i !== index)); setConfigIndex(null); }}>✕</button>
                </div>
                {configIndex === index && fields.length > 0 ? (
                  <div>
                    {fields.map((field) => {
                      const raw = node.config[field.key];
                      if (field.kind === 'channel') {
                        return (
                          <div key={field.key} className="mk-layout-field">
                            <label>{field.label}</label>
                            <div className="mk-layout-editor-chips">
                              <button type="button" className={`mk-layout-chip ${typeof raw !== 'string' ? 'active' : ''}`} onClick={() => setConfigValue(index, field.key, undefined)}>Auto</button>
                              {community.descriptor.channels.map((channel) => (
                                <button key={channel.id} type="button" className={`mk-layout-chip ${raw === channel.id ? 'active' : ''}`} onClick={() => setConfigValue(index, field.key, channel.id)}>
                                  #{channel.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      if (field.kind === 'number') {
                        return (
                          <div key={field.key} className="mk-layout-field">
                            <label>{field.label}</label>
                            <input
                              className="mk-input"
                              type="number"
                              min={1}
                              max={field.max}
                              value={typeof raw === 'number' ? raw : ''}
                              onChange={(e) => {
                                const parsed = Number.parseInt(e.target.value, 10);
                                setConfigValue(index, field.key, Number.isFinite(parsed) ? Math.min(parsed, field.max ?? parsed) : undefined);
                              }}
                            />
                          </div>
                        );
                      }
                      return (
                        <div key={field.key} className="mk-layout-field">
                          <label>{field.label}</label>
                          {field.kind === 'multiline' ? (
                            <textarea
                              className="mk-input"
                              rows={4}
                              maxLength={field.max}
                              value={typeof raw === 'string' ? raw : ''}
                              onChange={(e) => setConfigValue(index, field.key, e.target.value)}
                            />
                          ) : (
                            <input
                              className="mk-input"
                              maxLength={field.max}
                              value={typeof raw === 'string' ? raw : ''}
                              onChange={(e) => setConfigValue(index, field.key, e.target.value)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}

          <button type="button" className="mk-layout-chip" onClick={() => setPaletteOpen((v) => !v)}>+ Add a block</button>
          {paletteOpen ? (
            <div className="mk-layout-editor-chips">
              {placeable.map((type) => (
                <button key={type} type="button" className="mk-layout-chip" onClick={() => { setStack([...stack, { type, config: {} }]); setPaletteOpen(false); }}>
                  {BLOCK_REGISTRY[type].label}
                </button>
              ))}
            </div>
          ) : null}

          <h4>Capabilities</h4>
          <p className="mk-muted">
            What this community turns on. Turning one on declares it to members; a build that cannot run it yet shows the honest pending card instead.
          </p>
          {CAPABILITY_KEYS.map((capability) => {
            const declared = draft.capabilities.includes(capability);
            return (
              <div key={capability} className="mk-layout-cap-row">
                <div className="mk-layout-cap-copy">
                  <div>{CAPABILITY_LABELS[capability]}</div>
                  {declared ? <div className="mk-layout-cap-pending">{CAPABILITY_UNAVAILABLE_COPY[capability]}</div> : null}
                </div>
                <Button
                  variant={declared ? 'primary' : 'ghost'}
                  small
                  onClick={() => setDraft((current) => ({
                    ...current,
                    capabilities: declared
                      ? current.capabilities.filter((c) => c !== capability)
                      : [...current.capabilities, capability],
                  }))}
                >
                  {declared ? 'On' : 'Off'}
                </Button>
              </div>
            );
          })}

          {problems.map((problem) => <div key={problem} className="mk-layout-problem">{problem}</div>)}
          <div className="mk-layout-editor-chips">
            <Button onClick={publish} disabled={problems.length > 0}>Publish layout</Button>
            <Button variant="ghost" onClick={resetToClassic}>Reset to classic layout</Button>
            <Button variant="ghost" onClick={copyTemplate}>Copy layout template</Button>
          </div>
          <div className="mk-layout-field">
            <label>Import a template</label>
            <input
              className="mk-input"
              placeholder="Paste a meerkat-layout template or link"
              value={importValue}
              onChange={(e) => setImportValue(e.target.value)}
            />
          </div>
          <Button variant="ghost" onClick={importTemplate} disabled={!importValue.trim()}>Import into draft</Button>
        </>
      )}

      {notice ? <HonestNotice>{notice}</HonestNotice> : null}
    </section>
  );
}
