// Plan 56 C1: the MOBILE canvas host: wires the db, identity, node store, and
// sync recordChange rail into CanvasSurface, and carries the member editor
// (plan 8): tap-to-add palette, node sheet (props from the registry field
// vocabulary, position/size/rotation steppers, layer picker gated by role),
// per-action publishing (every add/move/remove IS a locally recorded signed
// event; "published" never claims propagation), and the accessibility preview
// (one tap to see the canvas as reduced-motion/high-contrast receivers may).

import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import {
  communityRole,
  type CommunityCanvasEvent,
  type CommunityCanvasLayer,
  type CommunityCanvasNodeEvent,
  type StoredCommunity,
} from '@mylife/sync';
import { useMeerkatDatabase } from '../../providers/DatabaseProvider';
import { useIdentity } from '../../providers/IdentityProvider';
import { useNode } from '../../providers/NodeProvider';
import { useSync } from '../../providers/SyncProvider';
import { useMkStyles } from '../../providers/AppThemeProvider';
import { type MkColors, MK_RADIUS, shortHex } from '../../theme/tokens';
import { HonestNotice } from '../kit';
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
} from '../../data/canvas-core';
import {
  CANVAS_NODE_REGISTRY,
  CANVAS_NODE_TYPES,
  isCanvasNodeType,
  type CanvasNodeType,
} from '../../data/canvas-node-registry-core';
import { resolveCanvasAssetUri, sealCanvasImageAsset } from '../../data/canvas-assets';
import { badgesForMember } from '../../data/badges-core';
import {
  resolveCommunityAvatarImage,
  resolveCommunityAvatarInitial,
  resolveCommunityDisplayName,
} from '../../data/community-core';
import { buildBlockQueries } from '../../data/block-queries';
import type { BlockHostContext } from '../blocks/registry';
import { CanvasSurface, type CanvasHostActions } from './CanvasSurface';

/** Default geometry when a node is tap-added (then adjusted in the sheet). */
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
  /** Toppers bound their height (4.2). */
  maxHeight?: number;
  /** Hosts may force view-only (e.g. inside previews). */
  allowEdit?: boolean;
}) {
  const styles = useMkStyles(makeStyles);
  const router = useRouter();
  const db = useMeerkatDatabase();
  const { identity } = useIdentity();
  const node = useNode();
  const { recordLocalChange } = useSync();
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState(false);
  const [accessibilityPreview, setAccessibilityPreview] = useState(false);
  const [selected, setSelected] = useState<CommunityCanvasNodeEvent | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [layer, setLayer] = useState<CommunityCanvasLayer>('open');
  const [busy, setBusy] = useState(false);

  const communityId = community.communityId;
  // Feature 3: after the owner saves a channel-style axis, the freshly signed
  // policy revision lives in the db before the parent re-renders; prefer it.
  const [policyRevision, setPolicyRevision] = useState(0);
  const policy = useMemo(() => {
    void policyRevision;
    const live = getCanvasById(db, canvas.id);
    return parseCanvasPolicy((live ?? canvas).policyJson);
  }, [db, canvas, policyRevision]);
  const myRole = communityRole(community.descriptor, identity.publicKey);

  const nodes = useMemo(() => { void revision; return listCanvasNodes(db, canvas.id); }, [db, canvas.id, revision]);
  const strokes = useMemo(() => { void revision; return listCanvasStrokes(db, canvas.id, community.descriptor); }, [db, canvas.id, community.descriptor, revision]);
  const prefs = useMemo(() => { void revision; return getRenderPrefs(db, communityId); }, [db, communityId, revision]);
  const dialed = useMemo(() => {
    // Accessibility preview (plan 8): render exactly what a receiver with the
    // conservative dials sees. Not a simulation of their device, an honest
    // application of those dial values to this verified data.
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
    queries: buildBlockQueries(db, community.descriptor),
    onOpenChannel: (channelId) => router.push({ pathname: '/channel/[communityId]/[channelId]', params: { communityId, channelId } }),
    onOpenFiles: () => router.push({ pathname: '/files/[communityId]', params: { communityId } }),
    revision,
  }), [db, community.descriptor, communityId, router, revision]);

  const actions = useMemo<CanvasHostActions>(() => ({
    onNavigate: (target) => {
      if (target.kind === 'channel') {
        router.push({ pathname: '/channel/[communityId]/[channelId]', params: { communityId, channelId: target.id } });
      } else if (target.kind === 'canvas') {
        router.push({ pathname: '/community/[communityId]/page/[canvasId]', params: { communityId, canvasId: target.id } });
      } else if (target.kind === 'post') {
        router.push({ pathname: '/channel/[communityId]/[channelId]', params: { communityId, channelId: target.id } });
      } else if (target.kind === 'member') {
        router.push({ pathname: '/community/[communityId]/member/[deviceId]', params: { communityId, deviceId: target.id } });
      }
    },
    onIncrement: (target) => {
      try {
        addCanvasMark(db, identity, { canvasId: canvas.id, communityId, nodeId: target.id, kind: 'increment' }, recordLocalChange);
        bump();
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'Could not record that.');
      }
    },
    onVote: (target, option) => {
      try {
        addCanvasMark(db, identity, { canvasId: canvas.id, communityId, nodeId: target.id, kind: 'vote', option }, recordLocalChange);
        bump();
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'Could not record that vote.');
      }
    },
    onSignGuestbook: (target, note) => {
      try {
        addCanvasMark(db, identity, { canvasId: canvas.id, communityId, nodeId: target.id, kind: 'note', note }, recordLocalChange);
        bump();
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'Could not sign the guestbook.');
      }
    },
    onSelectNode: editing ? (target) => setSelected(target) : undefined,
    resolveAssetUri: (target) => resolveCanvasAssetUri({ db, store: node.store, identity, node: target }),
    counts: {
      counterTotal: (nodeId) => { void revision; return counterTotal(db, nodeId); },
      pollResults: (nodeId, optionCount) => { void revision; return pollResults(db, nodeId, optionCount); },
      guestbookNotes: (nodeId, limit) => { void revision; return guestbookNotes(db, nodeId, limit); },
    },
    badgesFor: (deviceId) => { void revision; return badgesForMember(db, communityId, deviceId); },
    memberInfo: (deviceId) => {
      void revision;
      const name = resolveCommunityDisplayName(db, communityId, deviceId) ?? shortHex(deviceId);
      return {
        name,
        avatarInitial: resolveCommunityAvatarInitial(db, communityId, deviceId, name) ?? '?',
        avatarImage: resolveCommunityAvatarImage(db, communityId, deviceId),
        isMember: community.descriptor.members.some((member) => member.deviceId === deviceId),
      };
    },
    onOpenMemberProfile: (deviceId) => router.push({
      pathname: '/community/[communityId]/member/[deviceId]',
      params: { communityId, deviceId },
    }),
    blockCtx,
    revision,
  }), [db, identity, node.store, canvas.id, communityId, community.descriptor.members, recordLocalChange, router, bump, editing, blockCtx, revision]);

  const mayEditAnyLayer = (['background', 'structure', 'open'] as const)
    .some((l) => roleMayPlaceOnLayer(myRole, l, policy));

  const addNode = useCallback(async (type: CanvasNodeType) => {
    if (!roleMayPlaceOnLayer(myRole, layer, policy)) {
      setNotice('Your role cannot place on this layer here.');
      return;
    }
    try {
      let asset = null;
      if (type === 'image') {
        setBusy(true);
        const picked = await DocumentPicker.getDocumentAsync({ type: 'image/*', copyToCacheDirectory: true });
        const file = picked.assets?.[0];
        if (!file) { setBusy(false); return; }
        const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: 'base64' });
        asset = await sealCanvasImageAsset({ db, store: node.store, identity, communityId, base64 });
        setBusy(false);
        if (!asset) {
          setNotice('This device has no encryption key for this community yet, so it cannot seal an image.');
          return;
        }
      }
      const geometry = DEFAULT_GEOMETRY[type];
      // top_friends starts from real members (schema requires at least one);
      // the sheet then curates the list.
      const initialProps = type === 'top_friends'
        ? {
            memberDevices: (community.descriptor.members
              .filter((member) => member.deviceId !== identity.publicKey)
              .slice(0, 8)
              .map((member) => member.deviceId) as string[])
              .concat(community.descriptor.members.length <= 1 ? [identity.publicKey] : [])
              .slice(0, 8),
          }
        : DEFAULT_PROPS[type];
      placeCanvasNode(db, identity, {
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
      }, recordLocalChange);
      bump();
    } catch (error) {
      setBusy(false);
      setNotice(error instanceof Error ? error.message : 'Could not add that decoration.');
    }
  }, [db, identity, node.store, canvas.id, communityId, community.descriptor.members, layer, policy, myRole, nodes.length, recordLocalChange, bump]);

  const selectedResolved = selected ? nodes.find((n) => n.event.id === selected.id) ?? null : null;
  const mayModifySelected = selectedResolved
    ? selectedResolved.event.authorDevice === identity.publicKey
    : false;
  const mayRemoveSelected = selectedResolved
    ? mayModifySelected || ((myRole === 'owner' || myRole === 'admin') && selectedResolved.event.layer === 'open')
    : false;

  const nudgeSelected = useCallback((patch: Partial<Pick<CommunityCanvasNodeEvent, 'x' | 'y' | 'w' | 'h' | 'rotation' | 'z'>>) => {
    if (!selectedResolved || !mayModifySelected) return;
    try {
      const next = updateCanvasNode(db, identity, selectedResolved.event, patch, recordLocalChange);
      setSelected(next);
      bump();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not move that.');
    }
  }, [db, identity, selectedResolved, mayModifySelected, recordLocalChange, bump]);

  const editSelectedText = useCallback((text: string) => {
    if (!selectedResolved || !mayModifySelected) return;
    if (selectedResolved.parse.status !== 'ok') return;
    try {
      const next = updateCanvasNode(db, identity, selectedResolved.event, {
        props: { ...selectedResolved.parse.props, text },
      }, recordLocalChange);
      setSelected(next);
      bump();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save that text.');
    }
  }, [db, identity, selectedResolved, mayModifySelected, recordLocalChange, bump]);

  const patchSelectedProps = useCallback((patch: Record<string, unknown>) => {
    if (!selectedResolved || !mayModifySelected) return;
    if (selectedResolved.parse.status !== 'ok') return;
    try {
      const next = updateCanvasNode(db, identity, selectedResolved.event, {
        props: { ...selectedResolved.parse.props, ...patch },
      }, recordLocalChange);
      setSelected(next);
      bump();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save that.');
    }
  }, [db, identity, selectedResolved, mayModifySelected, recordLocalChange, bump]);

  const toggleTopFriend = useCallback((deviceId: string) => {
    if (!selectedResolved || !mayModifySelected) return;
    if (selectedResolved.parse.status !== 'ok') return;
    const current = ((selectedResolved.parse.props as { memberDevices?: string[] }).memberDevices ?? []);
    const next = current.includes(deviceId)
      ? current.filter((id) => id !== deviceId)
      : [...current, deviceId].slice(0, 8);
    if (next.length === 0) { setNotice('Keep at least one friend in the list.'); return; }
    try {
      const updated = updateCanvasNode(db, identity, selectedResolved.event, {
        props: { ...selectedResolved.parse.props, memberDevices: next },
      }, recordLocalChange);
      setSelected(updated);
      bump();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not change the list.');
    }
  }, [db, identity, selectedResolved, mayModifySelected, recordLocalChange, bump]);

  const removeSelected = useCallback(() => {
    if (!selectedResolved || !mayRemoveSelected) return;
    try {
      tombstoneCanvasNode(db, identity, selectedResolved.event, recordLocalChange);
      setSelected(null);
      bump();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not remove that.');
    }
  }, [db, identity, selectedResolved, mayRemoveSelected, recordLocalChange, bump]);

  // Feature 52: templates. Host presets apply as MY OWN signed nodes; export
  // copies the codec blob (assets never travel; honest skip counts); import
  // strict-decodes then re-validates every node through the registry.
  const [showTemplates, setShowTemplates] = useState(false);
  const [importCode, setImportCode] = useState('');

  const applyTemplate = useCallback((template: (typeof CANVAS_PAGE_TEMPLATES)[number]) => {
    try {
      const result = applyCanvasTemplateNodes(db, identity, canvas, template.nodes, recordLocalChange);
      setNotice(result.skipped > 0
        ? `Added ${result.placed} pieces from ${template.name}; ${result.skipped} did not fit this canvas and were skipped.`
        : `Added ${result.placed} pieces from ${template.name}.`);
      setShowTemplates(false);
      bump();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not apply that template.');
    }
  }, [db, identity, canvas, recordLocalChange, bump]);

  const exportTemplate = useCallback(() => {
    const result = exportCanvasTemplate(db, canvas.id);
    if (!result) { setNotice('Nothing to export yet.'); return; }
    void Clipboard.setStringAsync(result.blob);
    setNotice(result.skippedAssets > 0
      ? `Template code copied (${result.exported} pieces). ${result.skippedAssets} sealed images stay behind; they belong to this community.`
      : `Template code copied (${result.exported} pieces). Share it anywhere; another member pastes it into their canvas.`);
  }, [db, canvas.id]);

  const importTemplate = useCallback(() => {
    try {
      const result = importCanvasTemplate(db, identity, canvas, importCode, recordLocalChange);
      setNotice(result.skipped > 0
        ? `Imported ${result.placed} pieces; ${result.skipped} were not valid here and were skipped.`
        : `Imported ${result.placed} pieces.`);
      setImportCode('');
      setShowTemplates(false);
      bump();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not import that template code.');
    }
  }, [db, identity, canvas, importCode, recordLocalChange, bump]);

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
      ensureCanvas(db, identity, {
        communityId,
        kind: 'channel_topper',
        subjectId: canvas.subjectId,
        policy: {
          ...policy,
          ...(Object.keys(current).length > 0 ? { themeExtras: current } : { themeExtras: undefined }),
        } as typeof policy,
      }, recordLocalChange);
      setPolicyRevision((v) => v + 1);
      setNotice('Channel style saved. It applies to this channel for every member (their high-contrast setting still wins).');
      bump();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save the channel style.');
    }
  }, [db, identity, communityId, canvas.subjectId, policy, recordLocalChange, bump]);

  const canEdit = allowEdit !== false && mayEditAnyLayer;

  return (
    <View>
      {canEdit ? (
        <View style={styles.toolbar}>
          <Chip
            label={editing ? 'Done building' : 'Build'}
            active={editing}
            onPress={() => { setEditing((v) => !v); setSelected(null); }}
            styles={styles}
          />
          <Chip
            label="Receiver preview"
            active={accessibilityPreview}
            onPress={() => setAccessibilityPreview((v) => !v)}
            styles={styles}
          />
        </View>
      ) : null}

      {editing ? (
        <>
          <View style={styles.toolbar}>
            {(['background', 'structure', 'open'] as const).map((l) => (
              roleMayPlaceOnLayer(myRole, l, policy) ? (
                <Chip key={l} label={l} active={layer === l} onPress={() => setLayer(l)} styles={styles} />
              ) : null
            ))}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.palette}>
            {CANVAS_NODE_TYPES.filter((type) => CANVAS_NODE_REGISTRY[type].layers.includes(layer)).map((type) => (
              <Chip
                key={type}
                label={CANVAS_NODE_REGISTRY[type].label}
                active={false}
                onPress={() => { void addNode(type); }}
                styles={styles}
              />
            ))}
          </ScrollView>
          <View style={styles.toolbar}>
            <Chip label={showTemplates ? 'Hide templates' : 'Templates'} active={showTemplates} onPress={() => setShowTemplates((v) => !v)} styles={styles} />
            <Chip label="Copy template code" active={false} onPress={exportTemplate} styles={styles} />
          </View>
          {showTemplates ? (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.palette}>
                {CANVAS_PAGE_TEMPLATES.map((template) => (
                  <Chip
                    key={template.id}
                    label={template.name}
                    active={false}
                    onPress={() => applyTemplate(template)}
                    styles={styles}
                  />
                ))}
              </ScrollView>
              <View style={styles.toolbar}>
                <TextInput
                  style={[styles.sheetInput, { flex: 1 }]}
                  value={importCode}
                  onChangeText={setImportCode}
                  placeholder="Paste a template code"
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel="Template code"
                />
                <Chip label="Import" active={false} onPress={importTemplate} styles={styles} />
              </View>
            </>
          ) : null}
          {canvas.kind === 'channel_topper' && myRole === 'owner' ? (
            <>
              <Text style={styles.busyLine}>Channel style (applies to this channel only)</Text>
              {CHANNEL_STYLE_AXES.map(([axis, values]) => (
                <View key={axis} style={styles.toolbar}>
                  <Chip
                    label={`${axis}: default`}
                    active={!(policy.themeExtras as Record<string, string> | undefined)?.[axis]}
                    onPress={() => setChannelStyleAxis(axis, null)}
                    styles={styles}
                  />
                  {values.map((value) => (
                    <Chip
                      key={value}
                      label={value}
                      active={(policy.themeExtras as Record<string, string> | undefined)?.[axis] === value}
                      onPress={() => setChannelStyleAxis(axis, value)}
                      styles={styles}
                    />
                  ))}
                </View>
              ))}
            </>
          ) : null}
          {busy ? <Text style={styles.busyLine}>Sealing…</Text> : null}
        </>
      ) : null}

      <CanvasSurface dialed={dialed} policy={policy} actions={actions} maxHeight={maxHeight} />

      {editing && selectedResolved ? (
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>
            {isCanvasNodeType(selectedResolved.event.nodeType)
              ? CANVAS_NODE_REGISTRY[selectedResolved.event.nodeType].label
              : selectedResolved.event.nodeType}
          </Text>
          {!mayModifySelected ? (
            <Text style={styles.sheetMeta}>Placed by another member. {mayRemoveSelected ? 'As a curator you can remove it.' : 'Only its author can change it.'}</Text>
          ) : null}
          {mayModifySelected && selectedResolved.event.nodeType === 'text' && selectedResolved.parse.status === 'ok' ? (
            <TextInput
              style={styles.sheetInput}
              defaultValue={String((selectedResolved.parse.props as { text?: unknown }).text ?? '')}
              onEndEditing={(e) => editSelectedText(e.nativeEvent.text)}
              multiline
              maxLength={2000}
            />
          ) : null}
          {mayModifySelected && selectedResolved.event.nodeType === 'top_friends' && selectedResolved.parse.status === 'ok' ? (
            <View style={styles.friendPickRow}>
              {community.descriptor.members.map((member) => {
                const picked = (((selectedResolved.parse as { props: { memberDevices?: string[] } }).props).memberDevices ?? []).includes(member.deviceId);
                const info = actions.memberInfo(member.deviceId);
                return (
                  <Chip
                    key={member.deviceId}
                    label={picked ? `✓ ${info.name}` : info.name}
                    active={picked}
                    onPress={() => toggleTopFriend(member.deviceId)}
                    styles={styles}
                  />
                );
              })}
            </View>
          ) : null}
          {mayModifySelected && selectedResolved.event.nodeType === 'milestone' && selectedResolved.parse.status === 'ok' ? (
            <View style={styles.friendPickRow}>
              <TextInput
                style={[styles.sheetInput, { flex: 1, minWidth: 140 }]}
                defaultValue={String((selectedResolved.parse.props as { title?: unknown }).title ?? '')}
                onEndEditing={(e) => patchSelectedProps({ title: e.nativeEvent.text })}
                maxLength={60}
                accessibilityLabel="Milestone title"
              />
              <TextInput
                style={[styles.sheetInput, { width: 120 }]}
                defaultValue={String((selectedResolved.parse.props as { dateIso?: unknown }).dateIso ?? '')}
                onEndEditing={(e) => patchSelectedProps({ dateIso: e.nativeEvent.text.trim() })}
                placeholder="2026-12-31"
                maxLength={10}
                accessibilityLabel="Milestone date (YYYY-MM-DD)"
              />
              {(['countdown', 'countup', 'anniversary'] as const).map((style) => (
                <Chip
                  key={style}
                  label={style}
                  active={(selectedResolved.parse as { props: { style?: string } }).props.style === style}
                  onPress={() => patchSelectedProps({ style })}
                  styles={styles}
                />
              ))}
            </View>
          ) : null}
          {mayModifySelected ? (
            <View style={styles.stepperRows}>
              <StepperRow label="Move" onLess={() => nudgeSelected({ x: selectedResolved.event.x - 16 })} onMore={() => nudgeSelected({ x: selectedResolved.event.x + 16 })} lessLabel="←" moreLabel="→" styles={styles} />
              <StepperRow label="" onLess={() => nudgeSelected({ y: selectedResolved.event.y - 16 })} onMore={() => nudgeSelected({ y: selectedResolved.event.y + 16 })} lessLabel="↑" moreLabel="↓" styles={styles} />
              <StepperRow label="Size" onLess={() => nudgeSelected({ w: Math.max(16, selectedResolved.event.w - 16), h: Math.max(16, selectedResolved.event.h - 16) })} onMore={() => nudgeSelected({ w: selectedResolved.event.w + 16, h: selectedResolved.event.h + 16 })} lessLabel="−" moreLabel="+" styles={styles} />
              <StepperRow label="Turn" onLess={() => nudgeSelected({ rotation: selectedResolved.event.rotation - 15 })} onMore={() => nudgeSelected({ rotation: selectedResolved.event.rotation + 15 })} lessLabel="⟲" moreLabel="⟳" styles={styles} />
              <StepperRow label="Stack" onLess={() => nudgeSelected({ z: selectedResolved.event.z - 1 })} onMore={() => nudgeSelected({ z: selectedResolved.event.z + 1 })} lessLabel="Back" moreLabel="Front" styles={styles} />
            </View>
          ) : null}
          <View style={styles.sheetActions}>
            {mayRemoveSelected ? (
              <Chip label="Remove" active={false} onPress={removeSelected} styles={styles} />
            ) : null}
            <Chip label="Close" active={false} onPress={() => setSelected(null)} styles={styles} />
          </View>
        </View>
      ) : null}

      {notice ? <HonestNotice text={notice} /> : null}
    </View>
  );
}

function Chip({ label, active, onPress, styles }: {
  label: string;
  active: boolean;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function StepperRow({ label, onLess, onMore, lessLabel, moreLabel, styles }: {
  label: string;
  onLess: () => void;
  onMore: () => void;
  lessLabel: string;
  moreLabel: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.stepperRow}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} ${lessLabel}`} onPress={onLess} style={styles.stepperBtn}>
        <Text style={styles.stepperBtnText}>{lessLabel}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} ${moreLabel}`} onPress={onMore} style={styles.stepperBtn}>
        <Text style={styles.stepperBtnText}>{moreLabel}</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (c: MkColors) =>
  StyleSheet.create({
    toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, paddingVertical: 6 },
    palette: { paddingHorizontal: 12, paddingBottom: 6 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: MK_RADIUS.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.surface,
      marginRight: 8,
    },
    chipActive: { backgroundColor: c.accent, borderColor: c.accent },
    chipText: { color: c.text, fontSize: 13 },
    chipTextActive: { color: c.onAccent, fontWeight: '600' },
    busyLine: { color: c.textSecondary, fontSize: 12, paddingHorizontal: 12, paddingBottom: 4 },
    sheet: {
      margin: 12,
      padding: 12,
      backgroundColor: c.surface,
      borderRadius: MK_RADIUS.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borderStrong,
      gap: 8,
    },
    sheetTitle: { color: c.text, fontSize: 15, fontWeight: '700' },
    sheetMeta: { color: c.textSecondary, fontSize: 12 },
    sheetInput: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: MK_RADIUS.sm,
      padding: 8,
      color: c.text,
      backgroundColor: c.surfaceElevated,
      minHeight: 60,
      textAlignVertical: 'top',
    },
    stepperRows: { gap: 4 },
  friendPickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    stepperLabel: { color: c.textSecondary, fontSize: 12, width: 44 },
    stepperBtn: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: MK_RADIUS.sm,
      backgroundColor: c.surfaceElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    stepperBtnText: { color: c.text, fontSize: 13 },
    sheetActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  });
