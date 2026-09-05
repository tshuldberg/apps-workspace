// Plan 56 C2 (feature 5): community emoji + sticker packs. Any member creates
// packs and uploads items (a unicode glyph, or an image sealed under the
// community's current epoch); an uploader removes their own entries and a
// curator can remove anyone's (moderation tombstone). Reserved trust glyphs
// die at the protocol layer, so a custom "emoji" can never counterfeit a
// checkmark or lock. Every list here renders VERIFIED rows only.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image as RNImage, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import type { DatabaseAdapter } from '@mylife/db';
import { assetPackByteCap, type DeviceIdentity, type ResolvedAssetPack } from '@mylife/sync';
import { Button, HonestNotice, SectionHeader } from './kit';
import { useMkStyles } from '../providers/AppThemeProvider';
import { useNode } from '../providers/NodeProvider';
import { useSync } from '../providers/SyncProvider';
import { type MkColors, MK_RADIUS, shortHex } from '../theme/tokens';
import {
  addAssetPackItem,
  defineAssetPack,
  listCommunityAssetPacks,
  tombstoneAssetPack,
  tombstoneAssetPackItem,
} from '../data/asset-packs-core';
import { resolveSealedAssetUri, sealCanvasImageAsset } from '../data/canvas-assets';

export function CommunityAssetPacksSection({
  db,
  identity,
  communityId,
  isCurator,
}: {
  db: DatabaseAdapter;
  identity: DeviceIdentity;
  communityId: string;
  isCurator: boolean;
}) {
  const styles = useMkStyles(makeStyles);
  const node = useNode();
  const { recordLocalChange } = useSync();
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [newPackName, setNewPackName] = useState('');
  const [newPackKind, setNewPackKind] = useState<'emoji' | 'sticker'>('emoji');
  const [itemDrafts, setItemDrafts] = useState<Record<string, { slug: string; glyph: string }>>({});
  const [busy, setBusy] = useState(false);

  const packs = useMemo(() => { void revision; return listCommunityAssetPacks(db, communityId); }, [db, communityId, revision]);
  const bump = useCallback(() => setRevision((v) => v + 1), []);

  const createPack = useCallback(() => {
    try {
      defineAssetPack(db, identity, { communityId, name: newPackName, packKind: newPackKind }, recordLocalChange);
      setNewPackName('');
      setNotice('Pack created. Add items below; members receive it when a sync connects.');
      bump();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not create that pack.');
    }
  }, [db, identity, communityId, newPackName, newPackKind, recordLocalChange, bump]);

  const draftFor = useCallback((packId: string) => itemDrafts[packId] ?? { slug: '', glyph: '' }, [itemDrafts]);
  const setDraft = useCallback((packId: string, patch: Partial<{ slug: string; glyph: string }>) => {
    setItemDrafts((prev) => ({ ...prev, [packId]: { ...(prev[packId] ?? { slug: '', glyph: '' }), ...patch } }));
  }, []);

  const addGlyphItem = useCallback((pack: ResolvedAssetPack) => {
    const draft = draftFor(pack.packId);
    try {
      addAssetPackItem(db, identity, {
        communityId, packId: pack.packId, slug: draft.slug.trim(), glyph: draft.glyph.trim(),
      }, recordLocalChange);
      setDraft(pack.packId, { slug: '', glyph: '' });
      setNotice(null);
      bump();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not add that item.');
    }
  }, [db, identity, communityId, draftFor, setDraft, recordLocalChange, bump]);

  const addImageItem = useCallback((pack: ResolvedAssetPack) => {
    const draft = draftFor(pack.packId);
    const slug = draft.slug.trim();
    if (!slug) { setNotice('Give the item a slug first (like happy-dance).'); return; }
    setBusy(true);
    void (async () => {
      try {
        const picked = await DocumentPicker.getDocumentAsync({ type: 'image/*', copyToCacheDirectory: true });
        const file = picked.assets?.[0];
        if (!file) return;
        const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: 'base64' });
        const cap = assetPackByteCap(pack.packKind);
        const byteLength = Math.floor((base64.length * 3) / 4);
        if (byteLength > cap) {
          setNotice(`That image is ${Math.round(byteLength / 1024)} KB; the cap for ${pack.packKind} items is ${Math.round(cap / 1024)} KB. Pick a smaller image.`);
          return;
        }
        const asset = await sealCanvasImageAsset({ db, store: node.store, identity, communityId, base64 });
        if (!asset) {
          setNotice('This device has no encryption key for this community yet, so it cannot seal an image.');
          return;
        }
        addAssetPackItem(db, identity, { communityId, packId: pack.packId, slug, asset }, recordLocalChange);
        setDraft(pack.packId, { slug: '', glyph: '' });
        setNotice(null);
        bump();
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'Could not add that image.');
      } finally {
        setBusy(false);
      }
    })();
  }, [db, identity, node.store, communityId, draftFor, setDraft, recordLocalChange, bump]);

  const removeItem = useCallback((pack: ResolvedAssetPack, slug: string) => {
    try {
      tombstoneAssetPackItem(db, identity, { communityId, packId: pack.packId, slug }, recordLocalChange);
      bump();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not remove that item.');
    }
  }, [db, identity, communityId, recordLocalChange, bump]);

  const removePack = useCallback((pack: ResolvedAssetPack) => {
    try {
      tombstoneAssetPack(db, identity, { communityId, packId: pack.packId, name: pack.name, packKind: pack.packKind }, recordLocalChange);
      bump();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not remove that pack.');
    }
  }, [db, identity, communityId, recordLocalChange, bump]);

  return (
    <View style={styles.panel}>
      <SectionHeader
        title="Emoji and sticker packs"
        hint="Custom reactions and stickers for this community. Emoji packs appear in the reaction picker; sticker packs in the sticker tray. Items travel when a sync connects."
      />
      {packs.length === 0 ? <Text style={styles.emptyLine}>No packs yet.</Text> : null}
      {packs.map((pack) => {
        const mayManagePack = isCurator || pack.uploadedBy === identity.publicKey;
        const draft = draftFor(pack.packId);
        return (
          <View key={pack.packId} style={styles.packBlock}>
            <View style={styles.packHead}>
              <Text style={styles.packName} numberOfLines={1}>{pack.name}</Text>
              <Text style={styles.packMeta}>{pack.packKind} · {pack.items.length}/64</Text>
              {mayManagePack ? (
                <Button title="Remove" variant="ghost" onPress={() => removePack(pack)} />
              ) : null}
            </View>
            <View style={styles.itemsRow}>
              {pack.items.map((item) => {
                const mayRemove = isCurator || item.uploadedBy === identity.publicKey;
                return (
                  <View key={item.slug} style={styles.itemChip}>
                    {item.glyph ? (
                      <Text style={styles.itemGlyph}>{item.glyph}</Text>
                    ) : (
                      <PackItemImage db={db} identity={identity} communityId={communityId} item={item} />
                    )}
                    <Text style={styles.itemSlug} numberOfLines={1}>:{item.slug}:</Text>
                    {mayRemove ? (
                      <Text
                        style={styles.itemRemove}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${item.slug}`}
                        onPress={() => removeItem(pack, item.slug)}
                      >
                        ✕
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
            <View style={styles.addRow}>
              <TextInput
                style={[styles.input, styles.inputSlug]}
                placeholder="slug"
                autoCapitalize="none"
                value={draft.slug}
                onChangeText={(value) => setDraft(pack.packId, { slug: value.toLowerCase() })}
                maxLength={32}
                accessibilityLabel={`New item slug for ${pack.name}`}
              />
              <TextInput
                style={[styles.input, styles.inputGlyph]}
                placeholder="🦫"
                value={draft.glyph}
                onChangeText={(value) => setDraft(pack.packId, { glyph: value })}
                maxLength={16}
                accessibilityLabel={`New item glyph for ${pack.name}`}
              />
              <Button title="Add" variant="secondary" onPress={() => addGlyphItem(pack)} disabled={!draft.slug.trim() || !draft.glyph.trim()} />
              <Button title={busy ? 'Sealing…' : 'Add image'} variant="secondary" onPress={() => addImageItem(pack)} disabled={busy || !draft.slug.trim()} />
            </View>
            <Text style={styles.packMeta}>Uploaded by {shortHex(pack.uploadedBy)}</Text>
          </View>
        );
      })}
      <View style={styles.addRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="New pack name"
          value={newPackName}
          onChangeText={setNewPackName}
          maxLength={60}
          accessibilityLabel="New pack name"
        />
        <Button
          title={newPackKind === 'emoji' ? 'Emoji' : 'Sticker'}
          variant="ghost"
          onPress={() => setNewPackKind((kind) => (kind === 'emoji' ? 'sticker' : 'emoji'))}
        />
        <Button title="Create pack" onPress={createPack} disabled={!newPackName.trim()} />
      </View>
      {notice ? <HonestNotice text={notice} /> : null}
    </View>
  );
}

/** A sealed pack item preview: the decrypted image, or the honest slug tile. */
function PackItemImage({
  db,
  identity,
  communityId,
  item,
}: {
  db: DatabaseAdapter;
  identity: DeviceIdentity;
  communityId: string;
  item: ResolvedAssetPack['items'][number];
}) {
  const styles = useMkStyles(makeStyles);
  const node = useNode();
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    if (!item.asset) return;
    let cancelled = false;
    void (async () => {
      const resolved = await resolveSealedAssetUri({
        db, store: node.store, identity, communityId, asset: item.asset!, authorDevice: item.uploadedBy,
      });
      if (!cancelled) setUri(resolved);
    })();
    return () => { cancelled = true; };
  }, [db, identity, node.store, communityId, item]);
  if (uri) return <RNImage source={{ uri }} style={styles.itemImage} />;
  return <Text style={styles.itemPending}>…</Text>;
}

const makeStyles = (c: MkColors) =>
  StyleSheet.create({
    panel: {
      backgroundColor: c.surface,
      borderColor: c.glassBorder,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: MK_RADIUS.lg,
      padding: 14,
      gap: 10,
    },
    emptyLine: { color: c.textSecondary, fontSize: 13 },
    packBlock: { gap: 8 },
    packHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    packName: { color: c.text, fontSize: 14, fontWeight: '700', flex: 1 },
    packMeta: { color: c.textTertiary, fontSize: 11 },
    itemsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    itemChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: c.surfaceElevated,
      borderRadius: MK_RADIUS.sm,
      paddingHorizontal: 8,
      paddingVertical: 4,
      maxWidth: 160,
    },
    itemGlyph: { fontSize: 17 },
    itemImage: { width: 20, height: 20, borderRadius: 4 },
    itemPending: { color: c.textTertiary, fontSize: 13 },
    itemSlug: { color: c.textSecondary, fontSize: 12, flexShrink: 1 },
    itemRemove: { color: c.textTertiary, fontSize: 12, paddingHorizontal: 2 },
    addRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: MK_RADIUS.sm,
      paddingHorizontal: 10,
      paddingVertical: 8,
      color: c.text,
      backgroundColor: c.surfaceElevated,
      fontSize: 14,
    },
    inputSlug: { flex: 1 },
    inputGlyph: { width: 56, textAlign: 'center' },
  });
