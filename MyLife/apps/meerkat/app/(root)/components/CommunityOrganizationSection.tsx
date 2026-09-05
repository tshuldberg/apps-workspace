// Plan 38 Phase 2 (Track A): the owner-only "Organization" editor. It edits a
// LOCAL draft of the channel list + categories -- create/rename/topic/assign/
// archive/reorder channels, create/rename/reorder/delete categories -- and on Save
// folds the WHOLE draft into ONE signed reviseCommunity revision (the binding
// one-revision-per-save contract; never one revision per drag). Creating a channel
// here is the W2 fix: it is the mobile channel-creation path that never existed.
// Non-owners never see this section (the caller gates on isOwner). Honesty: a saved
// revision is written locally; members converge when they receive the updated
// community, so the notice says exactly that.

import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import type { CommunityDescriptor } from '@mylife/sync';
import {
  addCategoryToDraft,
  addChannelToDraft,
  deleteCategoryFromDraft,
  draftFromDescriptor,
  moveCategoryInDraft,
  moveChannelInDraft,
  renameCategoryInDraft,
  renameChannelInDraft,
  setChannelArchivedInDraft,
  setChannelCategoryInDraft,
  setChannelTopicInDraft,
  setLayoutInDraft,
  type OrganizationDraft,
} from '../data/community-org-core';
import { Button, SectionHeader } from './kit';
import { type MkColors, MK_RADIUS } from '../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../providers/AppThemeProvider';
import { useSync } from '../providers/SyncProvider';

export function CommunityOrganizationSection({
  communityId,
  descriptor,
  onSaved,
  setNotice,
}: {
  communityId: string;
  descriptor: CommunityDescriptor;
  onSaved: () => void;
  setNotice: (notice: string | null) => void;
}) {
  const styles = useMkStyles(makeStyles);
  const c = useAppThemeColors();
  const { saveCommunityOrganization } = useSync();

  const [draft, setDraft] = useState<OrganizationDraft>(() => draftFromDescriptor(descriptor));
  const [dirty, setDirty] = useState(false);
  const [newChannel, setNewChannel] = useState('');
  // Plan 56 C1: a new channel is Chat or a Commons canvas (4.1); both are
  // values in the signed kind slot (old clients show the read-only banner).
  const [newChannelKind, setNewChannelKind] = useState<'chat' | 'canvas'>('chat');
  const [newCategory, setNewCategory] = useState('');

  // Reset the draft when a fresh revision lands (after Save) or the community
  // changes. Keyed on the revision so an in-progress edit for the SAME revision is
  // never clobbered.
  useEffect(() => {
    setDraft(draftFromDescriptor(descriptor));
    setDirty(false);
    setNewChannel('');
    setNewCategory('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descriptor.communityId, descriptor.revision]);

  const mutate = useCallback((next: OrganizationDraft) => {
    setDraft(next);
    setDirty(true);
    setNotice(null);
  }, [setNotice]);

  const onAddChannel = useCallback(() => {
    const result = addChannelToDraft(draft, newChannel, newChannelKind);
    if (!result.ok) { setNotice(result.error); return; }
    mutate(result.draft);
    setNewChannel('');
    setNewChannelKind('chat');
  }, [draft, newChannel, newChannelKind, mutate, setNotice]);

  const onAddCategory = useCallback(() => {
    const result = addCategoryToDraft(draft, newCategory);
    if (!result.ok) { setNotice(result.error); return; }
    mutate(result.draft);
    setNewCategory('');
  }, [draft, newCategory, mutate, setNotice]);

  const onSave = useCallback(() => {
    const result = saveCommunityOrganization(communityId, draft);
    if (!result.ok) { setNotice(result.error); return; }
    setDirty(false);
    onSaved();
    setNotice('Saved. Members see the new channel setup after they receive a fresh invite and rejoin.');
  }, [communityId, draft, saveCommunityOrganization, onSaved, setNotice]);

  const onCancel = useCallback(() => {
    setDraft(draftFromDescriptor(descriptor));
    setDirty(false);
    setNewChannel('');
    setNewCategory('');
    setNotice(null);
  }, [descriptor, setNotice]);

  return (
    <View style={styles.panel}>
      <SectionHeader title="Organization" hint="Group and order channels. Only you (the owner) can change this." />

      {/* Layout (Plan 38 Phase 7, G10): open the community on its libraries. */}
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: draft.layout === 'library_first' }}
        accessibilityLabel="Open on Library"
        onPress={() => mutate(setLayoutInDraft(draft, draft.layout === 'library_first' ? 'chat_first' : 'library_first'))}
        style={({ pressed }) => [styles.layoutRow, pressed && styles.pressed]}
      >
        <View style={styles.layoutText}>
          <Text style={styles.groupLabel}>Open on Library</Text>
          <Text style={styles.limitText}>
            Members open this community on its libraries, with chat one tap away.
          </Text>
        </View>
        <View style={[styles.layoutCheck, draft.layout === 'library_first' && styles.layoutCheckOn]}>
          {draft.layout === 'library_first' ? <Text style={styles.layoutCheckMark}>✓</Text> : null}
        </View>
      </Pressable>

      {/* Categories */}
      <Text style={styles.groupLabel}>Categories</Text>
      {draft.categories.length === 0 ? (
        <Text style={styles.limitText}>No categories yet. Add one to group channels.</Text>
      ) : (
        draft.categories.map((category, index) => (
          <View key={category.id} style={styles.itemRow}>
            <TextInput
              style={styles.itemInput}
              value={category.name}
              onChangeText={(v) => mutate(renameCategoryInDraft(draft, category.id, v))}
              placeholder="Category name"
              placeholderTextColor={c.textTertiary}
              accessibilityLabel={`Category name for ${category.name}`}
            />
            <MoveButtons
              onUp={() => mutate(moveCategoryInDraft(draft, category.id, 'up'))}
              onDown={() => mutate(moveCategoryInDraft(draft, category.id, 'down'))}
              upDisabled={index === 0}
              downDisabled={index === draft.categories.length - 1}
              label={category.name}
              styles={styles}
              color={c.textSecondary}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Delete category ${category.name}`}
              onPress={() => mutate(deleteCategoryFromDraft(draft, category.id))}
              style={({ pressed }) => [styles.tinyAction, styles.dangerAction, pressed && styles.pressed]}
            >
              <Text style={[styles.tinyActionText, styles.dangerActionText]}>Delete</Text>
            </Pressable>
          </View>
        ))
      )}
      <View style={styles.addRow}>
        <TextInput
          style={styles.itemInput}
          value={newCategory}
          onChangeText={setNewCategory}
          placeholder="Add a category"
          placeholderTextColor={c.textTertiary}
          accessibilityLabel="New category name"
        />
        <Button title="Add category" variant="secondary" onPress={onAddCategory} disabled={newCategory.trim().length === 0} />
      </View>

      {/* Channels */}
      <Text style={styles.groupLabel}>Channels</Text>
      {draft.channels.map((channel, index) => {
        const archived = channel.archived === true;
        return (
          <View key={channel.id} style={[styles.channelCard, archived && styles.archivedCard]}>
            <View style={styles.itemRow}>
              <TextInput
                style={styles.itemInput}
                value={channel.name}
                onChangeText={(v) => mutate(renameChannelInDraft(draft, channel.id, v))}
                placeholder="channel-name"
                placeholderTextColor={c.textTertiary}
                accessibilityLabel={`Channel name for ${channel.name}`}
              />
              <MoveButtons
                onUp={() => mutate(moveChannelInDraft(draft, channel.id, 'up'))}
                onDown={() => mutate(moveChannelInDraft(draft, channel.id, 'down'))}
                upDisabled={index === 0}
                downDisabled={index === draft.channels.length - 1}
                label={channel.name}
                styles={styles}
                color={c.textSecondary}
              />
            </View>
            <TextInput
              style={styles.itemInput}
              value={channel.topic ?? ''}
              onChangeText={(v) => mutate(setChannelTopicInDraft(draft, channel.id, v))}
              placeholder="Add a topic (optional)"
              placeholderTextColor={c.textTertiary}
              accessibilityLabel={`Topic for ${channel.name}`}
            />
            <View style={styles.categoryPickerRow}>
              <CategoryChip
                label="No category"
                active={!channel.categoryId}
                onPress={() => mutate(setChannelCategoryInDraft(draft, channel.id, null))}
                styles={styles}
              />
              {draft.categories.map((category) => (
                <CategoryChip
                  key={category.id}
                  label={category.name}
                  active={channel.categoryId === category.id}
                  onPress={() => mutate(setChannelCategoryInDraft(draft, channel.id, category.id))}
                  styles={styles}
                />
              ))}
            </View>
            <View style={styles.channelFooter}>
              {archived ? <Text style={styles.archivedTag}>Archived</Text> : <View />}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={archived ? `Unarchive ${channel.name}` : `Archive ${channel.name}`}
                onPress={() => mutate(setChannelArchivedInDraft(draft, channel.id, !archived))}
                style={({ pressed }) => [styles.tinyAction, pressed && styles.pressed]}
              >
                <Text style={styles.tinyActionText}>{archived ? 'Unarchive' : 'Archive'}</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
      <View style={styles.addRow}>
        <TextInput
          style={styles.itemInput}
          value={newChannel}
          onChangeText={setNewChannel}
          placeholder="Add a channel"
          placeholderTextColor={c.textTertiary}
          accessibilityLabel="New channel name"
        />
        <Button title="Add channel" onPress={onAddChannel} disabled={newChannel.trim().length === 0} />
      </View>
      <View style={styles.kindRow}>
        {(['chat', 'canvas'] as const).map((kind) => (
          <Pressable
            key={kind}
            accessibilityRole="button"
            accessibilityLabel={kind === 'chat' ? 'New channel kind: Chat' : 'New channel kind: Canvas'}
            onPress={() => setNewChannelKind(kind)}
            style={[styles.kindChip, newChannelKind === kind && styles.kindChipActive]}
          >
            <Text style={[styles.kindChipText, newChannelKind === kind && styles.kindChipTextActive]}>
              {kind === 'chat' ? 'Chat' : 'Canvas'}
            </Text>
          </Pressable>
        ))}
        <Text style={styles.kindHint}>
          {newChannelKind === 'canvas'
            ? 'A freeform canvas members decorate together. Older app versions show it read-only.'
            : 'A standard chat channel.'}
        </Text>
      </View>

      <Text style={styles.limitText}>
        Archived channels are hidden from the channel list. Their messages and files are kept, not deleted.
      </Text>

      <View style={styles.saveRow}>
        <Button title="Save organization" onPress={onSave} disabled={!dirty} />
        {dirty ? <Button title="Cancel" variant="ghost" onPress={onCancel} /> : null}
      </View>
    </View>
  );
}

function MoveButtons({
  onUp,
  onDown,
  upDisabled,
  downDisabled,
  label,
  styles,
  color,
}: {
  onUp: () => void;
  onDown: () => void;
  upDisabled: boolean;
  downDisabled: boolean;
  label: string;
  styles: ReturnType<typeof makeStyles>;
  color: string;
}) {
  return (
    <View style={styles.moveButtons}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Move ${label} up`}
        disabled={upDisabled}
        onPress={onUp}
        style={({ pressed }) => [styles.moveBtn, (upDisabled || pressed) && styles.pressed]}
      >
        <ChevronUp size={18} color={color} strokeWidth={2} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Move ${label} down`}
        disabled={downDisabled}
        onPress={onDown}
        style={({ pressed }) => [styles.moveBtn, (downDisabled || pressed) && styles.pressed]}
      >
        <ChevronDown size={18} color={color} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

function CategoryChip({
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
      accessibilityLabel={`Assign to ${label}`}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.categoryChip, active && styles.categoryChipActive, pressed && styles.pressed]}
    >
      <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  panel: {
    backgroundColor: c.surface,
    borderColor: c.glassBorder,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 14,
    gap: 10,
  },
  groupLabel: { color: c.text, fontSize: 13, fontWeight: '800', marginTop: 4 },
  limitText: { color: c.textSecondary, fontSize: 12, lineHeight: 17 },
  kindRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  kindChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surfaceElevated,
  },
  kindChipActive: { backgroundColor: c.accent, borderColor: c.accent },
  kindChipText: { color: c.text, fontSize: 12 },
  kindChipTextActive: { color: c.onAccent, fontWeight: '600' },
  kindHint: { color: c.textTertiary, fontSize: 11, flex: 1 },
  layoutRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  layoutText: { flex: 1, minWidth: 0, gap: 2 },
  layoutCheck: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: c.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceElevated,
  },
  layoutCheckOn: { backgroundColor: c.accent, borderColor: c.accent },
  layoutCheckMark: { color: c.onAccent, fontSize: 15, fontWeight: '800' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  itemInput: {
    flex: 1,
    backgroundColor: c.surfaceElevated,
    borderRadius: MK_RADIUS.md,
    color: c.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  channelCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.glassBorder,
    borderRadius: MK_RADIUS.md,
    padding: 10,
    gap: 8,
    backgroundColor: c.surfaceElevated,
  },
  archivedCard: { opacity: 0.7 },
  categoryPickerRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  categoryChip: {
    minHeight: 30,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: MK_RADIUS.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.glassBorder,
    backgroundColor: c.surface,
  },
  categoryChipActive: { borderColor: c.accent, backgroundColor: c.glass },
  categoryChipText: { color: c.textSecondary, fontSize: 11, fontWeight: '800' },
  categoryChipTextActive: { color: c.accent },
  channelFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  archivedTag: { color: c.warning, fontSize: 11, fontWeight: '800' },
  moveButtons: { flexDirection: 'row', gap: 2 },
  moveBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  tinyAction: {
    minHeight: 30,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.glassBorder,
    borderRadius: MK_RADIUS.sm,
    paddingHorizontal: 9,
    backgroundColor: c.surface,
  },
  tinyActionText: { color: c.textSecondary, fontSize: 11, fontWeight: '800' },
  dangerAction: { borderColor: c.danger, backgroundColor: c.dangerSoft },
  dangerActionText: { color: c.danger },
  pressed: { opacity: 0.5 },
});
