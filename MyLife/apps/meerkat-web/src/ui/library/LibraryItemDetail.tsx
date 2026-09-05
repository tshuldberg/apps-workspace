// Plan 38 Phase 5/6 (WEB): the item detail screen. Poster/cover (lazy full image),
// per-type metadata, a "Held on this device" badge from real local state, tags,
// collections, edit-metadata (curator/author), tombstone-with-confirm, and the
// open action: images render in a sealed in-app viewer; epub/cbz open in the
// sealed in-app reader; video/audio play in the in-app player over the honest
// container matrix (MSE / object-URL / download-or-mobile); other documents
// download the verified bytes. Nothing is fetched from a third party.

import { useEffect, useMemo, useState } from 'react';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { useView } from '../navigation/useView';
import { Button } from '../shell/Button';
import { HonestNotice } from '../shell/HonestNotice';
import { Modal } from '../shell/Modal';
import { TextField } from '../shell/Field';
import { bytesToBlob, formatBytes, isInlineRenderSafeMimeType } from '../format';
import { LIBRARY_STRINGS, itemMetadata } from '../../lib/library-browse-core';
import { KEEP_ON_DEVICE_LABEL, LAST_COPY_DELETE_CONFIRM } from '../../lib/library-storage-core';
import type { LibraryItemPinInfo } from '../../lib/library-store';
import type { LibraryItemEvent } from '../../lib/library-data-core';
import { readerKindFor, type ReaderKind } from '../../lib/library-reader-core';
import { useLibrary } from './useLibrary';
import { MEDIA_TYPE_META } from './media-meta';
import { LibrarySealedImage } from './LibrarySealedImage';
import { LibraryPlayer } from './LibraryPlayer';
import { CbzReader } from './CbzReader';
import { EpubReader } from './EpubReader';

type OpenKind = 'image' | 'pdf' | 'av' | 'reader' | 'download';

function openKindFor(mime: string | null, title: string | null): OpenKind {
  if (readerKindFor(mime, title)) return 'reader';
  const type = (mime ?? '').toLowerCase().split(';')[0]!.trim();
  if (type.startsWith('image/') && type !== 'image/svg+xml') return 'image';
  if (type === 'application/pdf') return 'pdf';
  if (type.startsWith('video/') || type.startsWith('audio/')) return 'av';
  return 'download';
}

export function LibraryItemDetail({
  workspaceId,
  channelId,
  itemId,
}: {
  workspaceId: string;
  channelId: string;
  itemId: string;
}): React.ReactElement {
  const m = useMeerkat();
  const { dispatch } = useView();
  const lib = useLibrary();
  const revision = m.revision;

  const config = useMemo(() => {
    void revision;
    return lib.getLibrary(channelId);
  }, [lib, channelId, revision]);
  const item = useMemo(() => {
    void revision;
    return lib.getItem(itemId);
  }, [lib, itemId, revision]);
  const canCurate = lib.canCurate(workspaceId, channelId);

  const [editing, setEditing] = useState(false);
  const [showImage, setShowImage] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [readerOpen, setReaderOpen] = useState<ReaderKind | null>(null);
  const [newTag, setNewTag] = useState('');
  const [collectionOpen, setCollectionOpen] = useState(false);

  const backToLibrary = (): void => dispatch({ type: 'OPEN_LIBRARY', workspaceId, channelId });

  const tags = useMemo(
    () => {
      void revision;
      return item ? lib.listTags(channelId, item.id) : [];
    },
    [lib, channelId, item, revision],
  );

  const isCommunity = useMemo(
    () => {
      void revision;
      return m.listCommunities().some((c) => c.communityId === workspaceId);
    },
    [m, workspaceId, revision],
  );
  // Real local-availability signal (not just authorship): authored items are
  // always sealed here; a received community item's blocks may not have arrived.
  const [heldLocally, setHeldLocally] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!item) {
      setHeldLocally(null);
      return;
    }
    if (item.authorDeviceId === m.identity.publicKey) {
      setHeldLocally(true);
      return;
    }
    void lib.isContentHeld(item).then((h) => {
      if (!cancelled) setHeldLocally(h);
    });
    return () => {
      cancelled = true;
    };
  }, [lib, item, m.identity.publicKey]);

  // Plan 38 C.7 "Keep on this device" state (held + class + kept marker).
  const [pinInfo, setPinInfo] = useState<LibraryItemPinInfo | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!item) { setPinInfo(null); return; }
    void lib.itemPinInfo(item).then((info) => { if (!cancelled) setPinInfo(info); });
    return () => { cancelled = true; };
  }, [lib, item, revision]);

  const onToggleKeep = (): void => {
    if (!item || !pinInfo) return;
    if (!pinInfo.kept) {
      void lib.keepItem(item).then(
        () => lib.itemPinInfo(item).then(setPinInfo),
        (err: unknown) => window.alert(err instanceof Error ? err.message : String(err)),
      );
      return;
    }
    if (!window.confirm(LAST_COPY_DELETE_CONFIRM)) return;
    void lib.releaseItem(item).then(
      () => lib.itemPinInfo(item).then(setPinInfo),
      (err: unknown) => window.alert(err instanceof Error ? err.message : String(err)),
    );
  };

  if (!config || !item) {
    return (
      <div className="mk-main-scroll">
        <div className="mk-lib-view-header">
          <Button variant="ghost" small onClick={backToLibrary}>← Back</Button>
          <h1 className="mk-h1" style={{ margin: 0 }}>Item unavailable</h1>
        </div>
        <HonestNotice>This item is no longer on this device, or its signature did not verify.</HonestNotice>
      </div>
    );
  }

  const meta = itemMetadata({ event: item, mediaType: config.mediaType, metadataUnknownType: false });
  const held = heldLocally === true; // authored here, or its sealed blocks are present locally
  // A community item whose blocks are not on this device yet: say so honestly.
  const awaitingSync = isCommunity && heldLocally === false;
  const openKind = openKindFor(item.mimeType, item.title);

  const doDownload = (): void => {
    setOpenError(null);
    void (async () => {
      try {
        const bytes = await lib.openContent(item);
        if (!bytes) {
          setOpenError('This file is not on this device yet. Nothing was fetched from a server.');
          return;
        }
        const url = URL.createObjectURL(bytesToBlob(bytes, item.mimeType ?? 'application/octet-stream'));
        const a = document.createElement('a');
        a.href = url;
        a.download = item.title || 'file';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      } catch (e) {
        setOpenError(e instanceof Error ? e.message : 'This file could not be opened.');
      }
    })();
  };

  const doOpenPdf = (): void => {
    setOpenError(null);
    void (async () => {
      try {
        const bytes = await lib.openContent(item);
        if (!bytes) {
          setOpenError('This file is not on this device yet. Nothing was fetched from a server.');
          return;
        }
        if (!isInlineRenderSafeMimeType(item.mimeType ?? '')) {
          doDownload();
          return;
        }
        const url = URL.createObjectURL(bytesToBlob(bytes, item.mimeType ?? 'application/pdf'));
        window.open(url, '_blank', 'noopener,noreferrer');
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      } catch (e) {
        setOpenError(e instanceof Error ? e.message : 'This file could not be opened.');
      }
    })();
  };

  const onOpen = (): void => {
    // Opening counts as a use: refresh LRU recency for a cached copy.
    if (item) void lib.touchItemUse(item);
    if (openKind === 'image') setShowImage(true);
    else if (openKind === 'pdf') doOpenPdf();
    else if (openKind === 'reader') setReaderOpen(readerKindFor(item.mimeType, item.title));
    else if (openKind === 'av') setShowPlayer(true);
    else doDownload();
  };

  const openLabel =
    openKind === 'image' ? 'View'
      : openKind === 'pdf' ? 'Open'
        : openKind === 'reader' ? 'Read'
          : openKind === 'av' ? 'Play'
            : 'Download';

  const onRemove = (): void => {
    const ok = window.confirm(
      `Remove "${item.title}" from this library? The item is tombstoned and its sealed copy on this device is freed when nothing else references it. This cannot be undone here.`,
    );
    if (!ok) return;
    void lib.tombstoneItem(item.id).then(
      () => backToLibrary(),
      (err: unknown) => setOpenError(err instanceof Error ? err.message : 'This item could not be removed.'),
    );
  };

  return (
    <div className="mk-main-scroll mk-lib-detail">
      <div className="mk-lib-view-header">
        <Button variant="ghost" small onClick={backToLibrary}>← Back</Button>
      </div>

      <div className="mk-lib-detail-top">
        <div className="mk-lib-detail-poster">
          <LibrarySealedImage
            item={item}
            source={config.mediaType === 'photo' && !item.coverCid ? 'content' : 'cover'}
            alt={item.title}
          />
        </div>
        <div className="mk-lib-detail-info">
          <h1 className="mk-h1" style={{ margin: 0 }}>{item.title}</h1>
          <div className="mk-lib-detail-badges">
            <span className="mk-pill">{MEDIA_TYPE_META[config.mediaType].icon} {MEDIA_TYPE_META[config.mediaType].label}</span>
            {held ? <span className="mk-pill is-success">{LIBRARY_STRINGS.heldOnThisDevice}</span> : null}
            {awaitingSync ? <span className="mk-pill">Not on this device</span> : null}
            {item.metadataSource && item.metadataSource !== 'local'
              ? <span className="mk-pill is-info">Metadata: {item.metadataSource}</span>
              : <span className="mk-pill">Local metadata</span>}
          </div>

          <dl className="mk-lib-meta-grid">
            {item.year ? <><dt>Year</dt><dd>{item.year}</dd></> : null}
            {typeof meta['artist'] === 'string' ? <><dt>Artist</dt><dd>{meta['artist'] as string}</dd></> : null}
            {typeof meta['album'] === 'string' ? <><dt>Album</dt><dd>{meta['album'] as string}</dd></> : null}
            {typeof meta['series'] === 'string' ? <><dt>Series</dt><dd>{meta['series'] as string}</dd></> : null}
            {Array.isArray(meta['authors']) ? <><dt>Author</dt><dd>{(meta['authors'] as string[]).join(', ')}</dd></> : null}
            {Array.isArray(meta['genres']) ? <><dt>Genres</dt><dd>{(meta['genres'] as string[]).join(', ')}</dd></> : null}
            {typeof meta['capturedAt'] === 'string' ? <><dt>Taken</dt><dd>{new Date(meta['capturedAt'] as string).toLocaleString()}</dd></> : null}
            {typeof meta['pages'] === 'number' ? <><dt>Pages</dt><dd>{meta['pages'] as number}</dd></> : null}
            {item.sizeBytes ? <><dt>Size</dt><dd>{formatBytes(item.sizeBytes)}</dd></> : null}
            {item.mimeType ? <><dt>Type</dt><dd>{item.mimeType}</dd></> : null}
          </dl>

          {typeof meta['plot'] === 'string' && meta['plot'] ? (
            <p className="mk-lib-detail-plot">{meta['plot'] as string}</p>
          ) : null}

          <div className="mk-lib-detail-actions">
            <Button onClick={onOpen}>{openLabel}</Button>
            {pinInfo?.held && pinInfo.pinClass !== 'authored' ? (
              <Button variant="ghost" onClick={onToggleKeep}>
                {pinInfo.kept ? `Kept · ${KEEP_ON_DEVICE_LABEL}` : KEEP_ON_DEVICE_LABEL}
              </Button>
            ) : null}
            {canCurate ? <Button variant="ghost" onClick={() => setEditing(true)}>Edit</Button> : null}
            {canCurate ? <Button variant="ghost" onClick={() => setCollectionOpen(true)}>Add to collection</Button> : null}
            {canCurate ? <Button variant="danger" onClick={onRemove}>Remove</Button> : null}
          </div>

          {awaitingSync ? (
            <HonestNotice>{LIBRARY_STRINGS.availableFromMembers}</HonestNotice>
          ) : null}

          {openError ? <div className="mk-box is-error" role="alert">{openError}</div> : null}

          <div className="mk-lib-detail-tags">
            <span className="mk-label">Tags</span>
            <div className="mk-lib-tag-row">
              {tags.length === 0 ? <span className="mk-muted">No tags</span> : null}
              {tags.map((t) => <span key={t} className="mk-lib-tag">{t}</span>)}
            </div>
            {canCurate ? (
              <div className="mk-lib-tag-add">
                <input
                  className="mk-input"
                  placeholder="Add a tag"
                  value={newTag}
                  onChange={(e) => setNewTag(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newTag.trim()) {
                      try {
                        lib.addTag(channelId, workspaceId, item.id, newTag.trim());
                      } catch (err) {
                        window.alert(`Could not add tag. ${err instanceof Error ? err.message : String(err)}`);
                        return;
                      }
                      setNewTag('');
                    }
                  }}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {showImage ? (
        <Modal title={item.title} onClose={() => setShowImage(false)}>
          <div className="mk-lib-image-viewer">
            <LibrarySealedImage item={item} source="content" alt={item.title} className="mk-lib-image-full" />
            <HonestNotice>Rendered from the sealed copy on this device. Nothing is loaded from a server.</HonestNotice>
          </div>
        </Modal>
      ) : null}

      {showPlayer ? (
        <LibraryPlayer
          item={item}
          workspaceId={workspaceId}
          onClose={() => setShowPlayer(false)}
          onDownload={() => { setShowPlayer(false); doDownload(); }}
        />
      ) : null}

      {readerOpen === 'cbz' ? (
        <CbzReader item={item} workspaceId={workspaceId} onClose={() => setReaderOpen(null)} />
      ) : null}
      {readerOpen === 'epub' ? (
        <EpubReader item={item} workspaceId={workspaceId} onClose={() => setReaderOpen(null)} />
      ) : null}

      {editing ? (
        <EditMetadataModal
          item={item}
          mediaType={config.mediaType}
          baseMeta={meta}
          onClose={() => setEditing(false)}
          onSave={(fields) => {
            // Signing seam: close the editor only on a real save, like the mobile twin.
            try {
              lib.editItemMetadata(item.id, fields);
            } catch (err) {
              window.alert(`Could not save details. ${err instanceof Error ? err.message : String(err)}`);
              return;
            }
            setEditing(false);
          }}
        />
      ) : null}

      {collectionOpen ? (
        <AddToCollectionModal
          channelId={channelId}
          workspaceId={workspaceId}
          itemId={item.id}
          onClose={() => setCollectionOpen(false)}
        />
      ) : null}
    </div>
  );
}

function EditMetadataModal({
  item,
  mediaType,
  baseMeta,
  onClose,
  onSave,
}: {
  item: LibraryItemEvent;
  mediaType: string;
  baseMeta: Record<string, unknown>;
  onClose: () => void;
  onSave: (fields: { title: string; sortTitle?: string | null; year?: number | null; metadata?: Record<string, unknown> }) => void;
}): React.ReactElement {
  const [title, setTitle] = useState(item.title);
  const [year, setYear] = useState(item.year ? String(item.year) : '');
  const [genres, setGenres] = useState(Array.isArray(baseMeta['genres']) ? (baseMeta['genres'] as string[]).join(', ') : '');
  const [plot, setPlot] = useState(typeof baseMeta['plot'] === 'string' ? (baseMeta['plot'] as string) : '');
  const hasGenres = mediaType === 'movie' || mediaType === 'show' || mediaType === 'music';
  const hasPlot = mediaType === 'movie' || mediaType === 'show' || mediaType === 'book';

  const save = (): void => {
    // Merge onto the existing metadata so type-required keys (series/artist) survive.
    const metadata: Record<string, unknown> = { ...baseMeta };
    if (hasGenres) {
      const list = genres.split(',').map((g) => g.trim()).filter(Boolean);
      if (list.length > 0) metadata.genres = list; else delete metadata.genres;
    }
    if (hasPlot) {
      if (plot.trim()) metadata.plot = plot.trim(); else delete metadata.plot;
    }
    onSave({
      title: title.trim() || item.title,
      year: year.trim() ? Number(year.trim()) : null,
      metadata,
    });
  };

  return (
    <Modal title="Edit details" onClose={onClose}>
      <div className="mk-lib-edit">
        <TextField label="Title" value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
        <TextField label="Year" inputMode="numeric" value={year} onChange={(e) => setYear(e.currentTarget.value)} />
        {hasGenres ? <TextField label="Genres (comma separated)" value={genres} onChange={(e) => setGenres(e.currentTarget.value)} /> : null}
        {hasPlot ? (
          <label className="mk-field">
            <span className="mk-label">Description</span>
            <textarea className="mk-textarea" value={plot} onChange={(e) => setPlot(e.currentTarget.value)} />
          </label>
        ) : null}
        <div className="mk-lib-create-actions">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}

function AddToCollectionModal({
  channelId,
  workspaceId,
  itemId,
  onClose,
}: {
  channelId: string;
  workspaceId: string;
  itemId: string;
  onClose: () => void;
}): React.ReactElement {
  const lib = useLibrary();
  const collections = lib.listCollections(channelId);
  const [name, setName] = useState('');
  const [pinned, setPinned] = useState(false);

  const addExisting = (collectionId: string): void => {
    try {
      lib.addToCollection(channelId, workspaceId, collectionId, itemId);
    } catch (err) {
      window.alert(`Could not add to collection. ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    onClose();
  };
  const createAndAdd = (): void => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const collection = lib.createCollection(channelId, workspaceId, trimmed, pinned);
      lib.addToCollection(channelId, workspaceId, collection.id, itemId);
    } catch (err) {
      window.alert(`Could not create collection. ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    onClose();
  };

  return (
    <Modal title="Add to collection" onClose={onClose}>
      <div className="mk-lib-collections-modal">
        {collections.length > 0 ? (
          <ul className="mk-lib-collection-list">
            {collections.map((c) => (
              <li key={c.id}>
                <button type="button" className="mk-lib-collection-pick" onClick={() => addExisting(c.id)}>
                  {c.pinned ? '📌 ' : ''}{c.name}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mk-muted">No collections yet. Create one:</p>
        )}
        <div className="mk-lib-collection-create">
          <TextField label="New collection" value={name} placeholder="Favorites, Watch later…" onChange={(e) => setName(e.currentTarget.value)} />
          <label className="mk-lib-filter-check">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.currentTarget.checked)} />
            <span>Pin to the top</span>
          </label>
          <Button onClick={createAndAdd} disabled={!name.trim()}>Create and add</Button>
        </div>
      </div>
    </Modal>
  );
}
