// Plan 56 C2 (feature 5, WEB): community emoji + sticker packs. Any member
// creates packs and uploads items (a unicode glyph, or an image sealed under
// the community's current epoch); an uploader removes their own entries and a
// curator can remove anyone's (moderation tombstone). Reserved trust glyphs
// die at the protocol layer. Every list here renders VERIFIED rows only.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { assetPackByteCap, type ResolvedAssetPack } from '@mylife/sync';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { Button } from '../shell/Button';
import { HonestNotice } from '../shell/HonestNotice';
import {
  addAssetPackItem,
  defineAssetPack,
  listCommunityAssetPacks,
  tombstoneAssetPack,
  tombstoneAssetPackItem,
} from '../../lib/asset-packs-core';
import { resolveSealedAssetUri, sealCanvasImageAsset } from '../../lib/canvas-assets';
import { shortHex } from '../format';

export function CommunityAssetPacksSection({
  communityId,
  isCurator,
}: {
  communityId: string;
  isCurator: boolean;
}): React.ReactElement {
  const m = useMeerkat();
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [newPackName, setNewPackName] = useState('');
  const [newPackKind, setNewPackKind] = useState<'emoji' | 'sticker'>('emoji');
  const [itemDrafts, setItemDrafts] = useState<Record<string, { slug: string; glyph: string }>>({});
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingImagePack = useRef<ResolvedAssetPack | null>(null);

  const packs = useMemo(() => { void revision; return listCommunityAssetPacks(m.db, communityId); }, [m.db, communityId, revision]);
  const bump = useCallback(() => setRevision((v) => v + 1), []);

  const createPack = useCallback(() => {
    try {
      defineAssetPack(m.db, m.identity, { communityId, name: newPackName, packKind: newPackKind }, m.recordLocalChange);
      void m.db.flush().catch(() => undefined);
      setNewPackName('');
      setNotice('Pack created. Add items below; members receive it when a sync connects.');
      bump();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not create that pack.');
    }
  }, [m, communityId, newPackName, newPackKind, bump]);

  const draftFor = useCallback((packId: string) => itemDrafts[packId] ?? { slug: '', glyph: '' }, [itemDrafts]);
  const setDraft = useCallback((packId: string, patch: Partial<{ slug: string; glyph: string }>) => {
    setItemDrafts((prev) => ({ ...prev, [packId]: { ...(prev[packId] ?? { slug: '', glyph: '' }), ...patch } }));
  }, []);

  const addGlyphItem = useCallback((pack: ResolvedAssetPack) => {
    const draft = draftFor(pack.packId);
    try {
      addAssetPackItem(m.db, m.identity, {
        communityId, packId: pack.packId, slug: draft.slug.trim(), glyph: draft.glyph.trim(),
      }, m.recordLocalChange);
      void m.db.flush().catch(() => undefined);
      setDraft(pack.packId, { slug: '', glyph: '' });
      setNotice(null);
      bump();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not add that item.');
    }
  }, [m, communityId, draftFor, setDraft, bump]);

  const onImagePicked = useCallback((file: File) => {
    const pack = pendingImagePack.current;
    pendingImagePack.current = null;
    if (!pack) return;
    const slug = draftFor(pack.packId).slug.trim();
    if (!slug) { setNotice('Give the item a slug first (like happy-dance).'); return; }
    const cap = assetPackByteCap(pack.packKind);
    if (file.size > cap) {
      setNotice(`That image is ${Math.round(file.size / 1024)} KB; the cap for ${pack.packKind} items is ${Math.round(cap / 1024)} KB. Pick a smaller image.`);
      return;
    }
    setBusy(true);
    void (async () => {
      try {
        const buffer = new Uint8Array(await file.arrayBuffer());
        let binary = '';
        for (const byte of buffer) binary += String.fromCharCode(byte);
        const base64 = btoa(binary);
        const asset = await sealCanvasImageAsset({ db: m.db, store: m.nodeStore, identity: m.identity, communityId, base64 });
        if (!asset) {
          setNotice('This browser has no encryption key for this community yet, so it cannot seal an image.');
          return;
        }
        addAssetPackItem(m.db, m.identity, { communityId, packId: pack.packId, slug, asset }, m.recordLocalChange);
        void m.db.flush().catch(() => undefined);
        setDraft(pack.packId, { slug: '', glyph: '' });
        setNotice(null);
        bump();
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'Could not add that image.');
      } finally {
        setBusy(false);
      }
    })();
  }, [m, communityId, draftFor, setDraft, bump]);

  const removeItem = useCallback((pack: ResolvedAssetPack, slug: string) => {
    try {
      tombstoneAssetPackItem(m.db, m.identity, { communityId, packId: pack.packId, slug }, m.recordLocalChange);
      void m.db.flush().catch(() => undefined);
      bump();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not remove that item.');
    }
  }, [m, communityId, bump]);

  const removePack = useCallback((pack: ResolvedAssetPack) => {
    try {
      tombstoneAssetPack(m.db, m.identity, { communityId, packId: pack.packId, name: pack.name, packKind: pack.packKind }, m.recordLocalChange);
      void m.db.flush().catch(() => undefined);
      bump();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not remove that pack.');
    }
  }, [m, communityId, bump]);

  return (
    <section className="mk-settings-section" aria-label="Emoji and sticker packs">
      <h3>Emoji and sticker packs</h3>
      <p className="mk-muted">
        Custom reactions and stickers for this community. Emoji packs appear in the reaction picker; sticker packs in the sticker tray. Items travel when a sync connects.
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="mk-sr-only"
        aria-label="Choose a pack image"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (file) onImagePicked(file);
        }}
      />
      {packs.length === 0 ? <p className="mk-muted">No packs yet.</p> : null}
      {packs.map((pack) => {
        const mayManagePack = isCurator || pack.uploadedBy === m.identity.publicKey;
        const draft = draftFor(pack.packId);
        return (
          <div key={pack.packId} className="mk-pack-block">
            <div className="mk-pack-head">
              <span className="mk-pack-name">{pack.name}</span>
              <span className="mk-muted">{pack.packKind} · {pack.items.length}/64</span>
              {mayManagePack ? (
                <Button variant="ghost" small onClick={() => removePack(pack)}>Remove</Button>
              ) : null}
            </div>
            <div className="mk-pack-items">
              {pack.items.map((item) => (
                <span key={item.slug} className="mk-pack-item">
                  {item.glyph ? (
                    <span className="mk-pack-item-glyph">{item.glyph}</span>
                  ) : (
                    <PackItemImage communityId={communityId} item={item} />
                  )}
                  <span className="mk-pack-item-slug">:{item.slug}:</span>
                  {(isCurator || item.uploadedBy === m.identity.publicKey) ? (
                    <button
                      type="button"
                      className="mk-pack-item-remove"
                      aria-label={`Remove ${item.slug}`}
                      onClick={() => removeItem(pack, item.slug)}
                    >
                      ✕
                    </button>
                  ) : null}
                </span>
              ))}
            </div>
            <div className="mk-pack-add-row">
              <input
                className="mk-input"
                style={{ flex: 1 }}
                placeholder="slug"
                value={draft.slug}
                maxLength={32}
                onChange={(event) => setDraft(pack.packId, { slug: event.currentTarget.value.toLowerCase() })}
                aria-label={`New item slug for ${pack.name}`}
              />
              <input
                className="mk-input"
                style={{ width: 56, textAlign: 'center' }}
                placeholder="🦫"
                value={draft.glyph}
                maxLength={16}
                onChange={(event) => setDraft(pack.packId, { glyph: event.currentTarget.value })}
                aria-label={`New item glyph for ${pack.name}`}
              />
              <Button variant="ghost" small disabled={!draft.slug.trim() || !draft.glyph.trim()} onClick={() => addGlyphItem(pack)}>Add</Button>
              <Button
                variant="ghost"
                small
                disabled={busy || !draft.slug.trim()}
                onClick={() => { pendingImagePack.current = pack; fileInputRef.current?.click(); }}
              >
                {busy ? 'Sealing…' : 'Add image'}
              </Button>
            </div>
            <p className="mk-muted" style={{ fontSize: 11 }}>Uploaded by {shortHex(pack.uploadedBy)}</p>
          </div>
        );
      })}
      <div className="mk-pack-add-row">
        <input
          className="mk-input"
          style={{ flex: 1 }}
          placeholder="New pack name"
          value={newPackName}
          maxLength={60}
          onChange={(event) => setNewPackName(event.currentTarget.value)}
          aria-label="New pack name"
        />
        <Button variant="ghost" small onClick={() => setNewPackKind((kind) => (kind === 'emoji' ? 'sticker' : 'emoji'))}>
          {newPackKind === 'emoji' ? 'Emoji' : 'Sticker'}
        </Button>
        <Button disabled={!newPackName.trim()} onClick={createPack}>Create pack</Button>
      </div>
      {notice ? <HonestNotice>{notice}</HonestNotice> : null}
    </section>
  );
}

/** A sealed pack item preview: the decrypted image, or the honest pending dot. */
function PackItemImage({
  communityId,
  item,
}: {
  communityId: string;
  item: ResolvedAssetPack['items'][number];
}): React.ReactElement {
  const m = useMeerkat();
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    if (!item.asset) return;
    let cancelled = false;
    void (async () => {
      const resolved = await resolveSealedAssetUri({
        db: m.db, store: m.nodeStore, identity: m.identity, communityId,
        asset: item.asset!, authorDevice: item.uploadedBy,
      });
      if (!cancelled) setUri(resolved);
    })();
    return () => { cancelled = true; };
  }, [m, communityId, item]);
  if (uri) return <img className="mk-pack-item-image" src={uri} alt={`:${item.slug}:`} />;
  return <span className="mk-muted">…</span>;
}
