// Plan 56 C1: the WEB canvas host (sibling of the mobile CanvasHost): wires
// the provider db/identity/node store and the recordChange rail into
// CanvasSurface, and carries the member editor: tap-to-add palette (role/
// layer gated incl. the member-build toggle), node sheet with steppers,
// author-only editing with curator remove on the open layer, per-action
// signed publishing, sealed image assets, and the receiver preview.

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  communityRole,
  type CommunityCanvasEvent,
  type CommunityCanvasLayer,
  type CommunityCanvasNodeEvent,
  type StoredCommunity,
} from '@mylife/sync';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { useView } from '../navigation/useView';
import { HonestNotice } from '../shell/HonestNotice';
import {
  addCanvasMark,
  ensureCanvas,
  getCanvasById,
  CANVAS_PAGE_TEMPLATES,
  applyCanvasTemplateNodes,
  exportCanvasTemplate,
  importCanvasTemplate,
  applyRenderPrefs,
  counterTotal,
  getRenderPrefs,
  guestbookNotes,
  listCanvasNodes,
  listCanvasStrokes,
  parseCanvasPolicy,
  placeCanvasNode,
  pollResults,
  roleMayPlaceOnLayer,
  tombstoneCanvasNode,
  updateCanvasNode,
} from '../../lib/canvas-core';
import {
  CANVAS_NODE_REGISTRY,
  CANVAS_NODE_TYPES,
  isCanvasNodeType,
  type CanvasNodeType,
} from '../../lib/canvas-node-registry-core';
import { resolveCanvasAssetUri, sealCanvasImageAsset } from '../../lib/canvas-assets';
import { badgesForMember } from '../../lib/badges-core';
import { shortHex } from '../format';
import { buildBlockQueries } from '../../lib/block-queries';
import type { BlockHostContext } from '../blocks/registry';
import { CanvasSurface, type CanvasHostActions } from './CanvasSurface';

const DEFAULT_GEOMETRY: Record<CanvasNodeType, { w: number; h: number }> = {
  text: { w: 220, h: 60 },
  image: { w: 180, h: 180 },
  sticker: { w: 56, h: 56 },
  shape: { w: 120, h: 120 },
  frame: { w: 240, h: 180 },
  link_card: { w: 200, h: 64 },
  guestbook: { w: 260, h: 200 },
  poll: { w: 260, h: 180 },
  counter: { w: 110, h: 70 },
  divider: { w: 260, h: 16 },
  button_88x31: { w: 88, h: 31 },
  badge_case: { w: 240, h: 160 },
  top_friends: { w: 240, h: 200 },
  milestone: { w: 220, h: 110 },
  block_embed: { w: 300, h: 220 },
};

const DEFAULT_PROPS: Record<CanvasNodeType, Record<string, unknown>> = {
  text: { text: 'New note' },
  image: {},
  sticker: { emoji: '🦫' },
  shape: { shape: 'rect' },
  frame: { layout: 'free' },
  link_card: { label: 'Open a channel', target: { kind: 'channel', id: '' } },
  guestbook: {},
  poll: { question: 'Your question', options: ['Option A', 'Option B'] },
  counter: {},
  divider: {},
  button_88x31: { text: 'MY BURROW' },
  badge_case: {},
  top_friends: { memberDevices: [] },
  milestone: { title: 'Our launch day', dateIso: '2026-12-31', style: 'countdown' },
  block_embed: { blockType: 'members', config: {} },
};

export function CanvasHost({
  community,
  canvas,
  maxHeight,
  allowEdit,
}: {
  community: StoredCommunity;
  canvas: CommunityCanvasEvent;
  maxHeight?: number;
  allowEdit?: boolean;
}): React.ReactElement {
  const m = useMeerkat();
  const { dispatch } = useView();
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState(false);
  const [accessibilityPreview, setAccessibilityPreview] = useState(false);
  const [selected, setSelected] = useState<CommunityCanvasNodeEvent | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [layer, setLayer] = useState<CommunityCanvasLayer>('open');
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const communityId = community.communityId;
  // Feature 3: after the owner saves a channel-style axis, the freshly signed
  // policy revision lives in the db before the parent re-renders; prefer it.
  const [policyRevision, setPolicyRevision] = useState(0);
  const policy = useMemo(() => {
    void policyRevision;
    const live = getCanvasById(m.db, canvas.id);
    return parseCanvasPolicy((live ?? canvas).policyJson);
  }, [m.db, canvas, policyRevision]);
  const myRole = communityRole(community.descriptor, m.identity.publicKey);
  const recordChange = m.recordLocalChange;

  const nodes = useMemo(() => { void revision; return listCanvasNodes(m.db, canvas.id); }, [m.db, canvas.id, revision]);
  const strokes = useMemo(() => { void revision; return listCanvasStrokes(m.db, canvas.id, community.descriptor); }, [m.db, canvas.id, community.descriptor, revision]);
  const prefs = useMemo(() => { void revision; return getRenderPrefs(m.db, communityId); }, [m.db, communityId, revision]);
  const dialed = useMemo(() => {
    const effective = accessibilityPreview
      ? { ...prefs, animations: 'off' as const, sounds: 'off' as const, backgrounds: 'dimmed' as const, effects: 'off' as const }
      : prefs;
    return applyRenderPrefs(nodes, strokes, effective, community.descriptor);
  }, [nodes, strokes, prefs, accessibilityPreview, community.descriptor]);

  const bump = useCallback(() => setRevision((v) => v + 1), []);

  const blockCtx = useMemo<BlockHostContext>(() => ({
    communityId,
    communityName: community.descriptor.name,
    channels: community.descriptor.channels.map((c) => ({ id: c.id, name: c.name, kind: c.kind ?? 'chat' })),
    queries: buildBlockQueries(m.db, community.descriptor),
    onOpenChannel: (channelId) => dispatch({ type: 'OPEN_CHANNEL', communityId, channelId }),
    onOpenFiles: () => dispatch({ type: 'OPEN_FILES', communityId }),
    revision,
  }), [m.db, community.descriptor, communityId, dispatch, revision]);

  const actions = useMemo<CanvasHostActions>(() => ({
    onNavigate: (target) => {
      if (target.kind === 'channel' || target.kind === 'post') {
        dispatch({ type: 'OPEN_CHANNEL', communityId, channelId: target.id });
      } else if (target.kind === 'canvas') {
        dispatch({ type: 'OPEN_COMMUNITY_PAGE', communityId, canvasId: target.id });
      } else if (target.kind === 'member') {
        dispatch({ type: 'OPEN_MEMBER_PROFILE', communityId, memberDeviceId: target.id });
      }
    },
    onIncrement: (target) => {
      try {
        addCanvasMark(m.db, m.identity, { canvasId: canvas.id, communityId, nodeId: target.id, kind: 'increment' }, recordChange);
        void m.db.flush().catch(() => undefined);
        bump();
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'Could not record that.');
      }
    },
    onVote: (target, option) => {
      try {
        addCanvasMark(m.db, m.identity, { canvasId: canvas.id, communityId, nodeId: target.id, kind: 'vote', option }, recordChange);
        void m.db.flush().catch(() => undefined);
        bump();
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'Could not record that vote.');
      }
    },
    onSignGuestbook: (target, note) => {
      try {
        addCanvasMark(m.db, m.identity, { canvasId: canvas.id, communityId, nodeId: target.id, kind: 'note', note }, recordChange);
        void m.db.flush().catch(() => undefined);
        bump();
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'Could not sign the guestbook.');
      }
    },
    onSelectNode: editing ? (target) => setSelected(target) : undefined,
    resolveAssetUri: (target) => resolveCanvasAssetUri({ db: m.db, store: m.nodeStore, identity: m.identity, node: target }),
    counts: {
      counterTotal: (nodeId) => { void revision; return counterTotal(m.db, nodeId); },
      pollResults: (nodeId, optionCount) => { void revision; return pollResults(m.db, nodeId, optionCount); },
      guestbookNotes: (nodeId, limit) => { void revision; return guestbookNotes(m.db, nodeId, limit); },
    },
    badgesFor: (deviceId) => { void revision; return badgesForMember(m.db, communityId, deviceId); },
    memberInfo: (deviceId) => {
      void revision;
      const name = m.communityDisplayName(communityId, deviceId) ?? shortHex(deviceId);
      return {
        name,
        avatarInitial: m.communityAvatarInitial(communityId, deviceId, name) ?? '?',
        avatarImage: m.communityAvatarImage(communityId, deviceId),
        isMember: community.descriptor.members.some((member) => member.deviceId === deviceId),
      };
    },
    onOpenMemberProfile: (deviceId) => dispatch({ type: 'OPEN_MEMBER_PROFILE', communityId, memberDeviceId: deviceId }),
    blockCtx,
    revision,
  }), [m, canvas.id, communityId, community.descriptor.members, recordChange, dispatch, bump, editing, blockCtx, revision]);

  const mayEditAnyLayer = (['background', 'structure', 'open'] as const)
    .some((l) => roleMayPlaceOnLayer(myRole, l, policy));

  const placeType = useCallback((type: CanvasNodeType, asset: Parameters<typeof placeCanvasNode>[2]['asset'] = null) => {
    try {
      const geometry = DEFAULT_GEOMETRY[type];
      // top_friends starts from real members (schema requires at least one);
      // the sheet then curates the list.
      const initialProps = type === 'top_friends'
        ? {
            memberDevices: (community.descriptor.members
              .filter((member) => member.deviceId !== m.identity.publicKey)
              .slice(0, 8)
              .map((member) => member.deviceId) as string[])
              .concat(community.descriptor.members.length <= 1 ? [m.identity.publicKey] : [])
              .slice(0, 8),
          }
        : DEFAULT_PROPS[type];
      placeCanvasNode(m.db, m.identity, {
        canvasId: canvas.id,
        communityId,
        nodeType: type,
        props: initialProps,
        layer,
        x: 24 + (nodes.length % 5) * 20,
        y: 24 + (nodes.length % 7) * 24,
        w: geometry.w,
        h: geometry.h,
        asset,
      }, recordChange);
      void m.db.flush().catch(() => undefined);
      bump();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not add that decoration.');
    }
  }, [m.db, m.identity, canvas.id, communityId, community.descriptor.members, layer, nodes.length, recordChange, bump]);

  const addNode = useCallback((type: CanvasNodeType) => {
    if (!roleMayPlaceOnLayer(myRole, layer, policy)) {
      setNotice('Your role cannot place on this layer here.');
      return;
    }
    if (type === 'image') {
      fileInputRef.current?.click();
      return;
    }
    placeType(type);
  }, [myRole, layer, policy, placeType]);

  const onImagePicked = useCallback(async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const buffer = new Uint8Array(await file.arrayBuffer());
      let binary = '';
      for (const byte of buffer) binary += String.fromCharCode(byte);
      const base64 = btoa(binary);
      const asset = await sealCanvasImageAsset({ db: m.db, store: m.nodeStore, identity: m.identity, communityId, base64 });
      if (!asset) {
        setNotice('This device has no encryption key for this community yet, so it cannot seal an image.');
        return;
      }
      placeType('image', asset);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not add that image.');
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [m.db, m.nodeStore, m.identity, communityId, placeType]);

  const selectedResolved = selected ? nodes.find((n) => n.event.id === selected.id) ?? null : null;
  const mayModifySelected = selectedResolved ? selectedResolved.event.authorDevice === m.identity.publicKey : false;
  const mayRemoveSelected = selectedResolved
    ? mayModifySelected || ((myRole === 'owner' || myRole === 'admin') && selectedResolved.event.layer === 'open')
    : false;

  const nudgeSelected = useCallback((patch: Partial<Pick<CommunityCanvasNodeEvent, 'x' | 'y' | 'w' | 'h' | 'rotation' | 'z'>>) => {
    if (!selectedResolved || !mayModifySelected) return;
    try {
      const next = updateCanvasNode(m.db, m.identity, selectedResolved.event, patch, recordChange);
      void m.db.flush().catch(() => undefined);
      setSelected(next);
      bump();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not move that.');
    }
  }, [m.db, m.identity, selectedResolved, mayModifySelected, recordChange, bump]);

  const editSelectedText = useCallback((text: string) => {
    if (!selectedResolved || !mayModifySelected || selectedResolved.parse.status !== 'ok') return;
    try {
      const next = updateCanvasNode(m.db, m.identity, selectedResolved.event, {
        props: { ...selectedResolved.parse.props, text },
      }, recordChange);
      void m.db.flush().catch(() => undefined);
      setSelected(next);
      bump();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save that text.');
    }
  }, [m.db, m.identity, selectedResolved, mayModifySelected, recordChange, bump]);

  const patchSelectedProps = useCallback((patch: Record<string, unknown>) => {
    if (!selectedResolved || !mayModifySelected) return;
    if (selectedResolved.parse.status !== 'ok') return;
    try {
      const next = updateCanvasNode(m.db, m.identity, selectedResolved.event, {
        props: { ...selectedResolved.parse.props, ...patch },
      }, recordChange);
      void m.db.flush().catch(() => undefined);
      setSelected(next);
      bump();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save that.');
    }
  }, [m, selectedResolved, mayModifySelected, recordChange, bump]);

  const toggleTopFriend = useCallback((deviceId: string) => {
    if (!selectedResolved || !mayModifySelected) return;
    if (selectedResolved.parse.status !== 'ok') return;
    const current = ((selectedResolved.parse.props as { memberDevices?: string[] }).memberDevices ?? []);
    const next = current.includes(deviceId)
      ? current.filter((id) => id !== deviceId)
      : [...current, deviceId].slice(0, 8);
    if (next.length === 0) { setNotice('Keep at least one friend in the list.'); return; }
    try {
      const updated = updateCanvasNode(m.db, m.identity, selectedResolved.event, {
        props: { ...selectedResolved.parse.props, memberDevices: next },
      }, recordChange);
      void m.db.flush().catch(() => undefined);
      setSelected(updated);
      bump();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not change the list.');
    }
  }, [m, selectedResolved, mayModifySelected, recordChange, bump]);

  const removeSelected = useCallback(() => {
    if (!selectedResolved || !mayRemoveSelected) return;
    try {
      tombstoneCanvasNode(m.db, m.identity, selectedResolved.event, recordChange);
      void m.db.flush().catch(() => undefined);
      setSelected(null);
      bump();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not remove that.');
    }
  }, [m.db, m.identity, selectedResolved, mayRemoveSelected, recordChange, bump]);

  // Feature 52: templates. Host presets apply as MY OWN signed nodes; export
  // copies the codec blob (assets never travel; honest skip counts); import
  // strict-decodes then re-validates every node through the registry.
  const [showTemplates, setShowTemplates] = useState(false);
  const [importCode, setImportCode] = useState('');

  const applyTemplate = useCallback((template: (typeof CANVAS_PAGE_TEMPLATES)[number]) => {
    try {
      const result = applyCanvasTemplateNodes(m.db, m.identity, canvas, template.nodes, recordChange);
      void m.db.flush().catch(() => undefined);
      setNotice(result.skipped > 0
        ? `Added ${result.placed} pieces from ${template.name}; ${result.skipped} did not fit this canvas and were skipped.`
        : `Added ${result.placed} pieces from ${template.name}.`);
      setShowTemplates(false);
      bump();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not apply that template.');
    }
  }, [m, canvas, recordChange, bump]);

  const exportTemplate = useCallback(() => {
    const result = exportCanvasTemplate(m.db, canvas.id);
    if (!result) { setNotice('Nothing to export yet.'); return; }
    void navigator.clipboard?.writeText(result.blob);
    setNotice(result.skippedAssets > 0
      ? `Template code copied (${result.exported} pieces). ${result.skippedAssets} sealed images stay behind; they belong to this community.`
      : `Template code copied (${result.exported} pieces). Share it anywhere; another member pastes it into their canvas.`);
  }, [m.db, canvas.id]);

  const importTemplate = useCallback(() => {
    try {
      const result = importCanvasTemplate(m.db, m.identity, canvas, importCode, recordChange);
      void m.db.flush().catch(() => undefined);
      setNotice(result.skipped > 0
        ? `Imported ${result.placed} pieces; ${result.skipped} were not valid here and were skipped.`
        : `Imported ${result.placed} pieces.`);
      setImportCode('');
      setShowTemplates(false);
      bump();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not import that template code.');
    }
  }, [m, canvas, importCode, recordChange, bump]);

  // Feature 3: per-channel style overrides ride THIS topper's owner-signed
  // policy (closed enums; never descriptor fields). Owner-only by the same
  // authority that signs the topper itself.
  const CHANNEL_STYLE_AXES = [
    ['typographyScale', ['compact', 'regular', 'large']],
    ['bubbleShape', ['rounded', 'square', 'pill']],
    ['borderWeight', ['hairline', 'regular', 'bold']],
    ['shadowDepth', ['flat', 'soft', 'deep']],
    ['backgroundTreatment', ['plain', 'tinted', 'washed']],
  ] as const;

  const setChannelStyleAxis = useCallback((axis: string, value: string | null) => {
    try {
      const current = { ...(policy.themeExtras ?? {}) } as Record<string, string>;
      if (value === null) delete current[axis];
      else current[axis] = value;
      ensureCanvas(m.db, m.identity, {
        communityId,
        kind: 'channel_topper',
        subjectId: canvas.subjectId,
        policy: {
          ...policy,
          ...(Object.keys(current).length > 0 ? { themeExtras: current } : { themeExtras: undefined }),
        } as typeof policy,
      }, recordChange);
      void m.db.flush().catch(() => undefined);
      setPolicyRevision((v) => v + 1);
      setNotice('Channel style saved. It applies to this channel for every member (their high-contrast setting still wins).');
      bump();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save the channel style.');
    }
  }, [m, communityId, canvas.subjectId, policy, recordChange, bump]);

  const canEdit = allowEdit !== false && mayEditAnyLayer;

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => { void onImagePicked(e.target.files?.[0] ?? null); }}
      />
      {canEdit ? (
        <div className="mk-layout-editor-chips">
          <button type="button" className={`mk-layout-chip ${editing ? 'active' : ''}`} onClick={() => { setEditing((v) => !v); setSelected(null); }}>
            {editing ? 'Done building' : 'Build'}
          </button>
          <button type="button" className={`mk-layout-chip ${accessibilityPreview ? 'active' : ''}`} onClick={() => setAccessibilityPreview((v) => !v)}>
            Receiver preview
          </button>
        </div>
      ) : null}

      {editing ? (
        <>
          <div className="mk-layout-editor-chips">
            {(['background', 'structure', 'open'] as const).map((l) => (
              roleMayPlaceOnLayer(myRole, l, policy) ? (
                <button key={l} type="button" className={`mk-layout-chip ${layer === l ? 'active' : ''}`} onClick={() => setLayer(l)}>{l}</button>
              ) : null
            ))}
          </div>
          <div className="mk-layout-editor-chips">
            {CANVAS_NODE_TYPES.filter((type) => CANVAS_NODE_REGISTRY[type].layers.includes(layer)).map((type) => (
              <button key={type} type="button" className="mk-layout-chip" onClick={() => addNode(type)}>
                {CANVAS_NODE_REGISTRY[type].label}
              </button>
            ))}
          </div>
          <div className="mk-layout-editor-chips">
            <button type="button" className={`mk-layout-chip${showTemplates ? ' is-active' : ''}`} onClick={() => setShowTemplates((v) => !v)}>
              {showTemplates ? 'Hide templates' : 'Templates'}
            </button>
            <button type="button" className="mk-layout-chip" onClick={exportTemplate}>Copy template code</button>
          </div>
          {showTemplates ? (
            <>
              <div className="mk-layout-editor-chips">
                {CANVAS_PAGE_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className="mk-layout-chip"
                    title={template.description}
                    onClick={() => applyTemplate(template)}
                  >
                    {template.name}
                  </button>
                ))}
              </div>
              <div className="mk-layout-editor-chips">
                <input
                  className="mk-input"
                  style={{ flex: 1 }}
                  value={importCode}
                  placeholder="Paste a template code"
                  onChange={(e) => setImportCode(e.currentTarget.value)}
                  aria-label="Template code"
                />
                <button type="button" className="mk-layout-chip" onClick={importTemplate}>Import</button>
              </div>
            </>
          ) : null}
          {canvas.kind === 'channel_topper' && myRole === 'owner' ? (
            <>
              <div className="mk-muted">Channel style (applies to this channel only)</div>
              {CHANNEL_STYLE_AXES.map(([axis, values]) => (
                <div key={axis} className="mk-layout-editor-chips">
                  <button
                    type="button"
                    className={`mk-layout-chip${!(policy.themeExtras as Record<string, string> | undefined)?.[axis] ? ' is-active' : ''}`}
                    onClick={() => setChannelStyleAxis(axis, null)}
                  >
                    {axis}: default
                  </button>
                  {values.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`mk-layout-chip${(policy.themeExtras as Record<string, string> | undefined)?.[axis] === value ? ' is-active' : ''}`}
                      onClick={() => setChannelStyleAxis(axis, value)}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              ))}
            </>
          ) : null}
          {busy ? <div className="mk-muted">Sealing…</div> : null}
        </>
      ) : null}

      <CanvasSurface dialed={dialed} policy={policy} actions={actions} maxHeight={maxHeight} />

      {editing && selectedResolved ? (
        <div className="mk-canvas-sheet">
          <div className="mk-canvas-panel-title">
            {isCanvasNodeType(selectedResolved.event.nodeType)
              ? CANVAS_NODE_REGISTRY[selectedResolved.event.nodeType].label
              : selectedResolved.event.nodeType}
          </div>
          {!mayModifySelected ? (
            <div className="mk-muted">Placed by another member. {mayRemoveSelected ? 'As a curator you can remove it.' : 'Only its author can change it.'}</div>
          ) : null}
          {mayModifySelected && selectedResolved.event.nodeType === 'text' && selectedResolved.parse.status === 'ok' ? (
            <textarea
              className="mk-input"
              rows={3}
              maxLength={2000}
              defaultValue={String((selectedResolved.parse.props as { text?: unknown }).text ?? '')}
              onBlur={(e) => editSelectedText(e.target.value)}
            />
          ) : null}
          {mayModifySelected && selectedResolved.event.nodeType === 'milestone' && selectedResolved.parse.status === 'ok' ? (
            <div className="mk-layout-editor-chips">
              <input
                className="mk-input"
                style={{ flex: 1, minWidth: 140 }}
                defaultValue={String((selectedResolved.parse.props as { title?: unknown }).title ?? '')}
                onBlur={(e) => patchSelectedProps({ title: e.target.value })}
                maxLength={60}
                aria-label="Milestone title"
              />
              <input
                className="mk-input"
                style={{ width: 120 }}
                defaultValue={String((selectedResolved.parse.props as { dateIso?: unknown }).dateIso ?? '')}
                onBlur={(e) => patchSelectedProps({ dateIso: e.target.value.trim() })}
                placeholder="2026-12-31"
                maxLength={10}
                aria-label="Milestone date (YYYY-MM-DD)"
              />
              {(['countdown', 'countup', 'anniversary'] as const).map((style) => (
                <button
                  key={style}
                  type="button"
                  className={`mk-layout-chip${(selectedResolved.parse as { props: { style?: string } }).props.style === style ? ' is-active' : ''}`}
                  onClick={() => patchSelectedProps({ style })}
                >
                  {style}
                </button>
              ))}
            </div>
          ) : null}
          {mayModifySelected && selectedResolved.event.nodeType === 'top_friends' && selectedResolved.parse.status === 'ok' ? (
            <div className="mk-layout-editor-chips">
              {community.descriptor.members.map((member) => {
                const picked = (((selectedResolved.parse as { props: { memberDevices?: string[] } }).props).memberDevices ?? []).includes(member.deviceId);
                const info = actions.memberInfo(member.deviceId);
                return (
                  <button
                    key={member.deviceId}
                    type="button"
                    className={`mk-layout-chip${picked ? ' is-active' : ''}`}
                    onClick={() => toggleTopFriend(member.deviceId)}
                  >
                    {picked ? `✓ ${info.name}` : info.name}
                  </button>
                );
              })}
            </div>
          ) : null}
          {mayModifySelected ? (
            <div className="mk-canvas-steppers">
              {([
                ['Move ←', { x: selectedResolved.event.x - 16 }],
                ['Move →', { x: selectedResolved.event.x + 16 }],
                ['Move ↑', { y: selectedResolved.event.y - 16 }],
                ['Move ↓', { y: selectedResolved.event.y + 16 }],
                ['Smaller', { w: Math.max(16, selectedResolved.event.w - 16), h: Math.max(16, selectedResolved.event.h - 16) }],
                ['Larger', { w: selectedResolved.event.w + 16, h: selectedResolved.event.h + 16 }],
                ['Turn ⟲', { rotation: selectedResolved.event.rotation - 15 }],
                ['Turn ⟳', { rotation: selectedResolved.event.rotation + 15 }],
                ['Back', { z: selectedResolved.event.z - 1 }],
                ['Front', { z: selectedResolved.event.z + 1 }],
              ] as const).map(([label, patch]) => (
                <button key={label} type="button" className="mk-layout-chip" onClick={() => nudgeSelected(patch)}>{label}</button>
              ))}
            </div>
          ) : null}
          <div className="mk-layout-editor-chips">
            {mayRemoveSelected ? (
              <button type="button" className="mk-layout-chip" onClick={removeSelected}>Remove</button>
            ) : null}
            <button type="button" className="mk-layout-chip" onClick={() => setSelected(null)}>Close</button>
          </div>
        </div>
      ) : null}

      {notice ? <HonestNotice>{notice}</HonestNotice> : null}
    </div>
  );
}
