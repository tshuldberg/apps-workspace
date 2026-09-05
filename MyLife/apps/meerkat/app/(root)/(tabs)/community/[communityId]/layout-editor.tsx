import { ONBOARDING_EXPERIENCES, buildExperienceLayout } from '../../../data/onboarding-experience-core';
// Composition plan 2.4: the owner's layout editor (mobile). Same shape as the
// theme editor: a draft layout document in local state, LIVE preview rendered
// through the REAL block registry (preview IS the product), publish = one
// signed cm_layout revision on the identity-event rail. Owner-gated: a
// non-owner sees the honest refusal, never a broken form. Templates: the draft
// exports/imports as a meerkat-layout codec blob (copy/paste + deep link).
// The non-removable floors are structural: this editor composes the home
// surface and per-channel stacks only; the channel list, settings, and
// honesty surfaces render outside the block stack and cannot be edited away.

import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowDown, ArrowLeft, ArrowUp, Plus, X } from 'lucide-react-native';
import { communityLayout, getCommunity } from '@mylife/sync';
import {
  buildLayoutDeepLink,
  decodeLayoutBlob,
  encodeLayoutBlob,
  extractLayoutBlob,
  type MkBlockNode,
  type MkLayoutDocument,
} from '@mylife/meerkat-layout';
import { useMeerkatDatabase } from '../../../providers/DatabaseProvider';
import { useIdentity } from '../../../providers/IdentityProvider';
import { useSync } from '../../../providers/SyncProvider';
import { CommunityThemeProvider } from '../../../providers/CommunityThemeProvider';
import { useMkStyles } from '../../../providers/AppThemeProvider';
import { type MkColors, MK_RADIUS } from '../../../theme/tokens';
import { Button, HonestNotice, SectionHeader } from '../../../components/kit';
import {
  BLOCK_CONFIG_FIELDS,
  BLOCK_REGISTRY,
  CAPABILITY_KEYS,
  CAPABILITY_LABELS,
  CAPABILITY_UNAVAILABLE_COPY,
  KNOWN_BLOCK_TYPES,
  isKnownBlockType,
  type KnownBlockType,
} from '../../../data/block-registry-core';
import {
  draftLayoutProblems,
  resolveActiveLayout,
} from '../../../data/community-layout-core';
import { listCommunityLayoutEvents } from '../../../data/community-core';
import { buildBlockQueries } from '../../../data/block-queries';
import { BlockStack } from '../../../components/blocks/BlockStack';
import type { BlockHostContext } from '../../../components/blocks/registry';

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

export default function LayoutEditorRoute() {
  const { communityId } = useLocalSearchParams<{ communityId: string }>();
  const id = typeof communityId === 'string' ? communityId : '';
  return (
    <CommunityThemeProvider communityId={id}>
      <LayoutEditorScreen communityId={id} />
    </CommunityThemeProvider>
  );
}

function LayoutEditorScreen({ communityId }: { communityId: string }) {
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useMeerkatDatabase();
  const { identity } = useIdentity();
  const { setCommunityLayout, clearCommunityLayout } = useSync();

  const community = useMemo(() => getCommunity(db, communityId), [db, communityId]);
  const isOwner = community?.descriptor.ownerDeviceId === identity.publicKey;

  // Deep-linkable route: Back falls back to the community home (or the list)
  // when this screen is the stack's only route.
  const goBack = useCallback(() => {
    if (router.canGoBack()) { router.back(); return; }
    if (communityId) router.replace({ pathname: '/community/[communityId]', params: { communityId } });
    else router.replace('/communities');
  }, [router, communityId]);

  const active = useMemo(() => {
    if (!community) return null;
    return resolveActiveLayout({
      events: listCommunityLayoutEvents(db, communityId),
      ownerDeviceId: community.descriptor.ownerDeviceId,
      legacyLayout: communityLayout(community.descriptor),
    });
  }, [db, community, communityId]);

  const [draft, setDraft] = useState<MkLayoutDocument>(() =>
    active?.source === 'layout_document'
      ? JSON.parse(JSON.stringify(active.document)) as MkLayoutDocument
      : starterDocument(),
  );
  // Edit composes the draft; Preview renders the CURRENT surface full-width
  // through the real registry, one tap away at all times (preview IS the
  // product, composition 2.4).
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  // null = editing the home surface; a channel id = editing that channel's stack.
  const [editingChannel, setEditingChannel] = useState<string | null>(null);
  const [configIndex, setConfigIndex] = useState<number | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [importValue, setImportValue] = useState('');
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
      queries: buildBlockQueries(db, community.descriptor),
      onOpenChannel: () => {},
      onOpenFiles: () => {},
      revision: 0,
    };
  }, [db, community, communityId]);

  const stack = useMemo<MkBlockNode[]>(
    () => editingChannel === null
      ? draft.home
      : draft.channels[editingChannel] ?? [],
    [draft, editingChannel],
  );

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

  const moveNode = useCallback((index: number, delta: number) => {
    const next = [...stack];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const [node] = next.splice(index, 1);
    next.splice(target, 0, node!);
    setStack(next);
  }, [stack, setStack]);

  const removeNode = useCallback((index: number) => {
    setStack(stack.filter((_, i) => i !== index));
    setConfigIndex(null);
  }, [stack, setStack]);

  const addNode = useCallback((type: KnownBlockType) => {
    setStack([...stack, { type, config: {} }]);
    setPaletteOpen(false);
  }, [stack, setStack]);

  const setConfigValue = useCallback((index: number, key: string, value: unknown) => {
    const next = [...stack];
    const node = next[index];
    if (!node) return;
    const config = { ...node.config };
    if (value === '' || value === undefined || value === null) delete config[key];
    else config[key] = value;
    next[index] = { ...node, config };
    setStack(next);
  }, [stack, setStack]);

  const toggleCapability = useCallback((capability: string) => {
    setDraft((current) => {
      const declared = current.capabilities.includes(capability);
      return {
        ...current,
        capabilities: declared
          ? current.capabilities.filter((c) => c !== capability)
          : [...current.capabilities, capability],
      };
    });
  }, []);

  const publish = useCallback(() => {
    if (problems.length > 0) return;
    let blob: string;
    try {
      blob = encodeLayoutBlob(draft);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not encode the layout.');
      return;
    }
    const result = setCommunityLayout(communityId, blob);
    setNotice(result.ok
      ? 'Layout published. Members receive it on their next sync with you.'
      : result.error ?? 'Could not save the community layout.');
  }, [problems, draft, communityId, setCommunityLayout]);

  const resetToClassic = useCallback(() => {
    const result = clearCommunityLayout(communityId);
    setNotice(result.ok
      ? 'Layout cleared. The community renders its classic surfaces again.'
      : result.error ?? 'Could not reset the community layout.');
  }, [communityId, clearCommunityLayout]);

  // "Copied" is claimed only after the clipboard write resolves; a rejected
  // write renders the honest failure instead of dying unhandled.
  const copyTemplate = useCallback(() => {
    void (async () => {
      try {
        await Clipboard.setStringAsync(buildLayoutDeepLink(draft));
        setNotice('Layout template copied. Paste it in another community’s layout editor.');
      } catch {
        setNotice('Could not copy the template.');
      }
    })();
  }, [draft]);

  const importTemplate = useCallback(() => {
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
  }, [importValue]);

  if (!community) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
        <HonestNotice text="This community is not on this device." />
      </View>
    );
  }

  if (!isOwner) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={goBack} style={styles.backBtn}>
          <ArrowLeft size={20} color={styles.headerText.color as string} />
        </Pressable>
        <HonestNotice text="Only the community owner can edit its layout." />
      </View>
    );
  }

  const channelName = editingChannel === null
    ? null
    : community.descriptor.channels.find((c) => c.id === editingChannel)?.name ?? editingChannel;

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}>
      <View style={styles.headerRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={goBack} style={styles.backBtn}>
          <ArrowLeft size={20} color={styles.headerText.color as string} />
        </Pressable>
        <Text style={styles.headerText}>Layout editor</Text>
      </View>

      <SectionHeader title="Starter layouts" hint="Load a home arrangement into the draft. Existing channels and content stay in place." />
      {ONBOARDING_EXPERIENCES.map((item) => <Button key={item.id} title={`Load ${item.name}${item.ready ? '' : ' (media unfinished)'}`} variant="secondary" onPress={() => {
        const starter = buildExperienceLayout(item.id, community.descriptor.name, community.descriptor.channels.find((channel) => !channel.kind || channel.kind === 'chat')?.id);
        setDraft((current) => ({ ...current, home: starter.home, capabilities: [...new Set([...current.capabilities, ...starter.capabilities])] }));
        setEditingChannel(null); setConfigIndex(null); setMode('preview');
        setNotice('Starter loaded into the home draft. Review, then publish when ready.');
      }} />)}

      <View style={styles.chipRow}>
        <SurfaceChip label="Edit" active={mode === 'edit'} onPress={() => setMode('edit')} styles={styles} />
        <SurfaceChip label="Preview" active={mode === 'preview'} onPress={() => setMode('preview')} styles={styles} />
      </View>

      {mode === 'preview' ? (
        <>
          <SectionHeader
            title={editingChannel === null ? 'Home preview' : `#${channelName} preview`}
            hint="Rendered through the real blocks, exactly as members see it."
          />
          <View style={styles.previewFrame}>
            {blockCtx ? (
              <BlockStack nodes={stack} declaredCapabilities={draft.capabilities} ctx={blockCtx} />
            ) : null}
            {stack.length === 0 ? <Text style={styles.emptyLine}>Nothing to preview yet.</Text> : null}
          </View>
          {problems.length > 0 ? (
            <View style={styles.problems}>
              {problems.map((problem) => (
                <Text key={problem} style={styles.problemLine}>{problem}</Text>
              ))}
            </View>
          ) : null}
          <Button title="Publish layout" onPress={publish} disabled={problems.length > 0} />
          {notice ? <HonestNotice text={notice} /> : null}
          <View style={styles.bottomPad} />
        </>
      ) : null}

      {mode === 'edit' ? (
      <>
      <SectionHeader
        title="Surface"
        hint="Compose the community home, or override one channel's blocks."
      />
      <View style={styles.chipRow}>
        <SurfaceChip label="Home" active={editingChannel === null} onPress={() => { setEditingChannel(null); setConfigIndex(null); }} styles={styles} />
        {community.descriptor.channels.map((channel) => (
          <SurfaceChip
            key={channel.id}
            label={`#${channel.name}`}
            active={editingChannel === channel.id}
            onPress={() => { setEditingChannel(channel.id); setConfigIndex(null); }}
            styles={styles}
          />
        ))}
      </View>

      <SectionHeader
        title={editingChannel === null ? 'Home blocks' : `#${channelName} blocks`}
        hint={editingChannel === null
          ? 'Top to bottom. The channel list and settings always stay reachable.'
          : 'Leave empty to use this channel kind’s standard view.'}
      />
      {stack.length === 0 ? (
        <Text style={styles.emptyLine}>
          {editingChannel === null ? 'No blocks yet. Add one below.' : 'Using the standard view for this channel.'}
        </Text>
      ) : null}
      {stack.map((node, index) => {
        const known = isKnownBlockType(node.type);
        const label = known ? BLOCK_REGISTRY[node.type as KnownBlockType].label : node.type;
        const fields = known ? BLOCK_CONFIG_FIELDS[node.type as KnownBlockType] : [];
        return (
          <View key={`${node.type}:${index}`} style={styles.nodeRow}>
            <View style={styles.nodeHeader}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Configure ${label}`}
                onPress={() => setConfigIndex(configIndex === index ? null : index)}
                style={styles.nodeLabelBtn}
              >
                <Text style={styles.nodeLabel}>{label}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Move ${label} up`} onPress={() => moveNode(index, -1)} style={styles.iconBtn}>
                <ArrowUp size={16} color={styles.nodeLabel.color as string} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Move ${label} down`} onPress={() => moveNode(index, 1)} style={styles.iconBtn}>
                <ArrowDown size={16} color={styles.nodeLabel.color as string} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${label}`} onPress={() => removeNode(index)} style={styles.iconBtn}>
                <X size={16} color={styles.nodeLabel.color as string} />
              </Pressable>
            </View>
            {configIndex === index && fields.length > 0 ? (
              <View style={styles.configPanel}>
                {fields.map((field) => {
                  const raw = node.config[field.key];
                  if (field.kind === 'channel') {
                    return (
                      <View key={field.key} style={styles.fieldBlock}>
                        <Text style={styles.fieldLabel}>{field.label}</Text>
                        <View style={styles.chipRow}>
                          <SurfaceChip label="Auto" active={typeof raw !== 'string'} onPress={() => setConfigValue(index, field.key, undefined)} styles={styles} />
                          {community.descriptor.channels.map((channel) => (
                            <SurfaceChip
                              key={channel.id}
                              label={`#${channel.name}`}
                              active={raw === channel.id}
                              onPress={() => setConfigValue(index, field.key, channel.id)}
                              styles={styles}
                            />
                          ))}
                        </View>
                      </View>
                    );
                  }
                  if (field.kind === 'number') {
                    return (
                      <View key={field.key} style={styles.fieldBlock}>
                        <Text style={styles.fieldLabel}>{field.label}</Text>
                        <TextInput
                          style={styles.fieldInput}
                          keyboardType="number-pad"
                          value={typeof raw === 'number' ? String(raw) : ''}
                          onChangeText={(text) => {
                            const parsed = Number.parseInt(text, 10);
                            setConfigValue(index, field.key, Number.isFinite(parsed) ? Math.min(parsed, field.max ?? parsed) : undefined);
                          }}
                          placeholder="Auto"
                        />
                      </View>
                    );
                  }
                  return (
                    <View key={field.key} style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>{field.label}</Text>
                      <TextInput
                        style={[styles.fieldInput, field.kind === 'multiline' && styles.fieldMultiline]}
                        multiline={field.kind === 'multiline'}
                        maxLength={field.max}
                        value={typeof raw === 'string' ? raw : ''}
                        onChangeText={(text) => setConfigValue(index, field.key, text)}
                      />
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>
        );
      })}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add a block"
        onPress={() => setPaletteOpen((v) => !v)}
        style={styles.addRow}
      >
        <Plus size={16} color={styles.addText.color as string} />
        <Text style={styles.addText}>Add a block</Text>
      </Pressable>
      {paletteOpen ? (
        <View style={styles.chipRow}>
          {placeable.map((type) => (
            <SurfaceChip key={type} label={BLOCK_REGISTRY[type].label} active={false} onPress={() => addNode(type)} styles={styles} />
          ))}
        </View>
      ) : null}

      <SectionHeader
        title="Capabilities"
        hint="What this community turns on. Turning one on declares it to members; a build that cannot run it yet shows the honest pending card instead."
      />
      {CAPABILITY_KEYS.map((capability) => {
        const declared = draft.capabilities.includes(capability);
        return (
          <View key={capability} style={styles.capRow}>
            <View style={styles.capCopy}>
              <Text style={styles.nodeLabel}>{CAPABILITY_LABELS[capability]}</Text>
              {declared ? (
                <Text style={styles.capPending}>{CAPABILITY_UNAVAILABLE_COPY[capability]}</Text>
              ) : null}
            </View>
            <Button
              title={declared ? 'On' : 'Off'}
              variant={declared ? 'primary' : 'secondary'}
              onPress={() => toggleCapability(capability)}
            />
          </View>
        );
      })}

      <SectionHeader title="Preview" hint="Rendered through the real blocks, exactly as members see it." />
      {blockCtx ? (
        <View style={styles.previewFrame}>
          <BlockStack nodes={stack} declaredCapabilities={draft.capabilities} ctx={blockCtx} />
          {stack.length === 0 ? <Text style={styles.emptyLine}>Nothing to preview.</Text> : null}
        </View>
      ) : null}

      {problems.length > 0 ? (
        <View style={styles.problems}>
          {problems.map((problem) => (
            <Text key={problem} style={styles.problemLine}>{problem}</Text>
          ))}
        </View>
      ) : null}

      <Button title="Publish layout" onPress={publish} disabled={problems.length > 0} />
      <View style={styles.spacer} />
      <Button title="Reset to classic layout" variant="secondary" onPress={resetToClassic} />

      <SectionHeader title="Template" hint="Share this layout, or start from another community's." />
      <Button title="Copy layout template" variant="secondary" onPress={copyTemplate} />
      <View style={styles.spacer} />
      <TextInput
        style={styles.fieldInput}
        placeholder="Paste a meerkat-layout template or link"
        value={importValue}
        onChangeText={setImportValue}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <View style={styles.spacer} />
      <Button title="Import into draft" variant="secondary" onPress={importTemplate} disabled={!importValue.trim()} />

      {notice ? <HonestNotice text={notice} /> : null}
      <View style={styles.bottomPad} />
      </>
      ) : null}
    </ScrollView>
  );
}

function SurfaceChip({
  label,
  active,
  onPress,
  styles,
}: {
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

const makeStyles = (c: MkColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { paddingHorizontal: 16, paddingBottom: 24 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    backBtn: { padding: 6 },
    headerText: { color: c.text, fontSize: 18, fontWeight: '700' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: MK_RADIUS.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    chipActive: { backgroundColor: c.accent, borderColor: c.accent },
    chipText: { color: c.text, fontSize: 13 },
    chipTextActive: { color: c.onAccent, fontWeight: '600' },
    nodeRow: {
      backgroundColor: c.surface,
      borderRadius: MK_RADIUS.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      marginBottom: 8,
      padding: 10,
    },
    nodeHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    nodeLabelBtn: { flex: 1 },
    nodeLabel: { color: c.text, fontSize: 14, fontWeight: '600' },
    iconBtn: { padding: 6 },
    configPanel: { marginTop: 8, gap: 8 },
    fieldBlock: { gap: 4 },
    fieldLabel: { color: c.textTertiary, fontSize: 12, fontWeight: '600' },
    fieldInput: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: MK_RADIUS.sm,
      paddingHorizontal: 10,
      paddingVertical: 8,
      color: c.text,
      backgroundColor: c.surfaceElevated,
      fontSize: 14,
    },
    fieldMultiline: { minHeight: 80, textAlignVertical: 'top' },
    addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
    addText: { color: c.accent, fontSize: 14, fontWeight: '600' },
    capRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 8,
    },
    capCopy: { flex: 1 },
    capPending: { color: c.textSecondary, fontSize: 12, marginTop: 2, lineHeight: 16 },
    previewFrame: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borderStrong,
      borderRadius: MK_RADIUS.md,
      padding: 10,
      marginBottom: 12,
    },
    problems: { marginBottom: 10 },
    problemLine: { color: c.danger, fontSize: 13, marginBottom: 4 },
    emptyLine: { color: c.textSecondary, fontSize: 13, marginBottom: 10 },
    spacer: { height: 8 },
    bottomPad: { height: 40 },
  });
