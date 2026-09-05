// Plan 38 Phase 5/7 (WEB): the "My Library" hub -- the personal-first surface. It
// lists a workspace's libraries (create CTA when none), plus an "On Deck" resume
// row and a "Recently added" row fed ONLY by real local rows (cm_library_progress
// + item HLCs). A community workspace reuses the same hub; the personal workspace
// is the zero-community default.

import { useMemo, useState } from 'react';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { useView } from '../navigation/useView';
import { Button } from '../shell/Button';
import { EmptyState } from '../shell/EmptyState';
import { HonestNotice } from '../shell/HonestNotice';
import { Modal } from '../shell/Modal';
import { TextField } from '../shell/Field';
import { LIBRARY_MEDIA_TYPES } from '../../lib/library-data-core';
import type { KnownMediaType } from '../../lib/library-metadata-core';
import type { ResolvedLibraryItem } from '../../lib/library-data-core';
import {
  LIBRARY_STRINGS,
  buildOnDeck,
  buildRecentlyAdded,
  type ItemProgress,
  type LibraryBrowseContext,
} from '../../lib/library-browse-core';
import { useLibrary } from './useLibrary';
import { MEDIA_TYPE_META } from './media-meta';
import { LibraryPosterCard } from './LibraryPosterCard';

export function LibraryHome({ workspaceId }: { workspaceId: string }): React.ReactElement {
  const m = useMeerkat();
  const { dispatch } = useView();
  const lib = useLibrary();
  const revision = m.revision;
  const [creating, setCreating] = useState(false);

  const kind = lib.workspaceKind(workspaceId);
  const canCreate = lib.canCurate(workspaceId, '');

  const libraries = useMemo(
    () => lib.listLibraries(workspaceId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lib, workspaceId, revision],
  );

  // Aggregate items + progress across every library for the two hub rows.
  const { onDeck, recentlyAdded } = useMemo(() => {
    const all: ResolvedLibraryItem[] = [];
    const progressByItem = new Map<string, ItemProgress>();
    for (const config of libraries) {
      for (const item of lib.listItems(config.id)) {
        all.push(item);
        const p = lib.getProgress(item.event.id);
        if (p) progressByItem.set(item.event.id, p);
      }
    }
    const ctx: LibraryBrowseContext = { tagsByItem: new Map(), progressByItem };
    return { onDeck: buildOnDeck(all, ctx), recentlyAdded: buildRecentlyAdded(all, 12) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lib, libraries, revision]);

  const openItem = (item: ResolvedLibraryItem): void =>
    dispatch({ type: 'OPEN_LIBRARY_ITEM', workspaceId, channelId: item.event.channelId, itemId: item.event.id });

  // A community's Libraries home keeps Chat one tap away (G10/B.1): the first
  // non-library channel of the workspace community, when there is one.
  const community = m.listCommunities().find((c) => c.communityId === workspaceId) ?? null;
  const firstChatChannel = community
    ? community.descriptor.channels.find((c) => c.kind !== 'library' && !c.archived) ?? null
    : null;

  return (
    <div className="mk-main-scroll mk-lib-home">
      <div className="mk-lib-home-header">
        <h1 className="mk-h1" style={{ margin: 0 }}>{community ? community.descriptor.name : LIBRARY_STRINGS.myLibrary}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {firstChatChannel ? (
            <Button
              variant="ghost"
              small
              onClick={() =>
                dispatch({ type: 'OPEN_CHANNEL', communityId: workspaceId, channelId: firstChatChannel.id })
              }
            >
              Chat
            </Button>
          ) : null}
          {canCreate && libraries.length > 0 ? (
            <Button small onClick={() => setCreating(true)}>{LIBRARY_STRINGS.newLibrary}</Button>
          ) : null}
        </div>
      </div>

      {kind === null ? (
        <HonestNotice>
          This device has no library workspace yet. Nothing is loaded from a server.
        </HonestNotice>
      ) : null}

      {onDeck.length > 0 ? (
        <section className="mk-lib-row">
          <h2 className="mk-lib-row-title">{LIBRARY_STRINGS.onDeck}</h2>
          <div className="mk-lib-poster-strip">
            {onDeck.map((entry) => (
              <LibraryPosterCard key={entry.item.event.id} item={entry.item} onOpen={() => openItem(entry.item)} progress={entry.progress} />
            ))}
          </div>
        </section>
      ) : null}

      {recentlyAdded.length > 0 ? (
        <section className="mk-lib-row">
          <h2 className="mk-lib-row-title">{LIBRARY_STRINGS.recentlyAdded}</h2>
          <div className="mk-lib-poster-strip">
            {recentlyAdded.map((item) => (
              <LibraryPosterCard key={item.event.id} item={item} onOpen={() => openItem(item)} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mk-lib-row">
        <h2 className="mk-lib-row-title">Libraries</h2>
        {libraries.length === 0 ? (
          <EmptyState icon="🗂" title="No libraries yet">
            <p className="mk-muted">
              Build a personal media hub on this device. Files you add are sealed locally and only
              this device holds them until you sync.
            </p>
            {canCreate ? (
              <Button onClick={() => setCreating(true)}>{LIBRARY_STRINGS.newLibrary}</Button>
            ) : (
              <HonestNotice>Only the community owner can create a library here.</HonestNotice>
            )}
          </EmptyState>
        ) : (
          <ul className="mk-lib-list">
            {libraries.map((config) => {
              const meta = MEDIA_TYPE_META[config.mediaType];
              const count = lib.listItems(config.id).length;
              return (
                <li key={config.id}>
                  <button
                    type="button"
                    className="mk-lib-list-row"
                    onClick={() => dispatch({ type: 'OPEN_LIBRARY', workspaceId, channelId: config.id })}
                  >
                    <span className="mk-lib-list-icon" aria-hidden>{meta.icon}</span>
                    <span className="mk-lib-list-text">
                      <span className="mk-lib-list-name">{libraryName(config.id, config.mediaType, m)}</span>
                      <span className="mk-muted">{meta.label} · {count} {count === 1 ? 'item' : 'items'}</span>
                    </span>
                    <span className="mk-lib-list-chevron" aria-hidden>›</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {creating ? (
        <CreateLibraryModal
          workspaceId={workspaceId}
          onClose={() => setCreating(false)}
          onCreated={(channelId) => {
            setCreating(false);
            dispatch({ type: 'OPEN_LIBRARY', workspaceId, channelId });
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * A library's display name: the community descriptor carries the channel name;
 * the personal workspace has no descriptor, so it falls back to the media label.
 */
function libraryName(channelId: string, mediaType: KnownMediaType, m: ReturnType<typeof useMeerkat>): string {
  for (const community of m.listCommunities()) {
    const channel = community.descriptor.channels.find((c) => c.id === channelId);
    if (channel) return channel.name;
  }
  return MEDIA_TYPE_META[mediaType].label;
}

function CreateLibraryModal({
  workspaceId,
  onClose,
  onCreated,
}: {
  workspaceId: string;
  onClose: () => void;
  onCreated: (channelId: string) => void;
}): React.ReactElement {
  const lib = useLibrary();
  const [name, setName] = useState('');
  const [mediaType, setMediaType] = useState<KnownMediaType>('movie');
  const [error, setError] = useState<string | null>(null);

  const submit = (): void => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Give the library a name.');
      return;
    }
    try {
      const config = lib.createLibrary(workspaceId, trimmed, mediaType);
      onCreated(config.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the library.');
    }
  };

  return (
    <Modal title={LIBRARY_STRINGS.newLibrary} onClose={onClose}>
      <div className="mk-lib-create">
        <TextField
          label="Name"
          value={name}
          autoFocus
          placeholder="Movies, Family photos, Course notes…"
          onChange={(e) => setName(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <label className="mk-field">
          <span className="mk-label">Type</span>
          <select className="mk-input" value={mediaType} onChange={(e) => setMediaType(e.currentTarget.value as KnownMediaType)}>
            {LIBRARY_MEDIA_TYPES.map((t) => (
              <option key={t} value={t}>{MEDIA_TYPE_META[t].icon} {MEDIA_TYPE_META[t].label}</option>
            ))}
          </select>
        </label>
        {error ? <div className="mk-box is-error" role="alert">{error}</div> : null}
        <div className="mk-lib-create-actions">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>{LIBRARY_STRINGS.newLibrary}</Button>
        </div>
      </div>
    </Modal>
  );
}
