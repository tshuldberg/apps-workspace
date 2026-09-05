// Plan 38 Phase 2 (web): the OWNER-ONLY "Organization" section of community
// settings. A draft-based channel manager -- create, rename, topic, category
// assign, archive/unarchive (hidden, never deleted), reorder, and category
// create/rename/reorder/delete (delete only unassigns, never deletes channels).
// Every edit batches locally; Save commits ONE reviseCommunity revision (the
// batching rule), Cancel discards. Members never see this section (owner-gated by
// the caller). Honesty: a save writes locally; existing members pick the change
// up only by rejoining from a fresh invite link (descriptors do not auto-sync).

import { useMemo, useState } from 'react';
import {
  bytesToHex,
  channelArchived,
  communityLayout,
  generateSyncRandomBytes,
  type CommunityChannel,
} from '@mylife/sync';
import { useMeerkat } from '../../lib/MeerkatProvider';
import {
  buildOrgDraft,
  draftAddCategory,
  draftAddChannel,
  draftAssignCategory,
  draftDeleteCategory,
  draftMoveCategory,
  draftMoveChannel,
  draftRenameCategory,
  draftRenameChannel,
  draftSetArchived,
  draftSetTopic,
  finalizeOrg,
  type OrgDraft,
} from '../../lib/community-organization-core';
import { Button } from '../shell/Button';
import { HonestNotice } from '../shell/HonestNotice';

function newCategoryId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `cat-${crypto.randomUUID()}`;
  }
  return `cat-${Date.now().toString(36)}-${bytesToHex(generateSyncRandomBytes(6))}`;
}

function fingerprint(draft: OrgDraft): string {
  return JSON.stringify(finalizeOrg(draft));
}

export function CommunityOrganizationSection({ communityId }: { communityId: string }): React.ReactElement {
  const m = useMeerkat();
  void m.revision;
  const community = m.listCommunities().find((c) => c.communityId === communityId) ?? null;
  const descriptor = community?.descriptor ?? null;

  // The baseline is the finalized form of the current descriptor. Re-derived when
  // the descriptor revision changes (e.g. after our own save).
  const baseline = useMemo(
    () => (descriptor ? fingerprint(buildOrgDraft(descriptor)) : ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [descriptor?.revision, communityId],
  );
  const [draft, setDraft] = useState<OrgDraft>(() =>
    descriptor ? buildOrgDraft(descriptor) : { channels: [], categories: [] },
  );
  const [loadedFor, setLoadedFor] = useState<string>(() => baseline);
  const [channelName, setChannelName] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const groups = useMemo(() => {
    const catIds = new Set(draft.categories.map((c) => c.id));
    const active = draft.channels.filter((c) => !channelArchived(c));
    const uncategorized = active.filter((c) => !c.categoryId || !catIds.has(c.categoryId));
    return {
      uncategorized,
      byCategory: draft.categories.map((cat) => ({
        category: cat,
        channels: active.filter((c) => c.categoryId === cat.id),
      })),
      archived: draft.channels.filter((c) => channelArchived(c)),
    };
  }, [draft]);

  // Reset the draft when the underlying descriptor changes out from under us
  // (adjusting state during render; converges on the next pass).
  if (descriptor && baseline !== loadedFor) {
    setDraft(buildOrgDraft(descriptor));
    setLoadedFor(baseline);
    setNotice(null);
  }

  if (!descriptor) {
    return (
      <section className="mk-card" aria-label="Organization">
        <h2 className="mk-h2">Organization</h2>
        <p className="mk-muted">This community is not on this device.</p>
      </section>
    );
  }

  const dirty = fingerprint(draft) !== baseline;

  const apply = (next: OrgDraft): void => {
    setDraft(next);
    setNotice(null);
  };

  const onAddChannel = (): void => {
    const result = draftAddChannel(draft, channelName);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setChannelName('');
    apply(result.draft);
  };

  const onAddCategory = (): void => {
    const result = draftAddCategory(draft, categoryName, newCategoryId());
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setCategoryName('');
    apply(result.draft);
  };

  const save = (): void => {
    const result = m.saveCommunityOrganization(communityId, finalizeOrg(draft));
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    // The descriptor revision changes, so the reset-on-revision branch reloads
    // the draft and clears dirty on the next render. Confirm honestly.
    setNotice('Saved. Existing members see the new structure after they rejoin from a fresh invite link.');
  };

  const cancel = (): void => {
    setDraft(buildOrgDraft(descriptor));
    setChannelName('');
    setCategoryName('');
    setNotice(null);
  };

  const renderChannelRow = (channel: CommunityChannel): React.ReactElement => (
    <div key={channel.id} className="mk-org-channel">
      <div className="mk-org-channel-main">
        <input
          className="mk-input"
          aria-label={`Channel name for ${channel.id}`}
          value={channel.name}
          onChange={(e) => {
            const r = draftRenameChannel(draft, channel.id, e.currentTarget.value);
            if (r.ok) apply(r.draft);
            else setDraft({ ...draft, channels: draft.channels.map((c) => (c.id === channel.id ? { ...c, name: e.currentTarget.value } : c)) });
          }}
        />
        <div className="mk-org-channel-actions">
          <Button variant="ghost" small aria-label={`Move ${channel.name} up`} onClick={() => apply(draftMoveChannel(draft, channel.id, 'up'))}>
            ↑
          </Button>
          <Button variant="ghost" small aria-label={`Move ${channel.name} down`} onClick={() => apply(draftMoveChannel(draft, channel.id, 'down'))}>
            ↓
          </Button>
          <Button variant="ghost" small onClick={() => apply(draftSetArchived(draft, channel.id, true))}>
            Archive
          </Button>
        </div>
      </div>
      <input
        className="mk-input mk-org-topic"
        aria-label={`Topic for ${channel.name}`}
        placeholder="Topic (optional)"
        value={channel.topic ?? ''}
        onChange={(e) => apply(draftSetTopic(draft, channel.id, e.currentTarget.value))}
      />
      <label className="mk-org-cat-select">
        <span className="mk-sr-only">Category for {channel.name}</span>
        <select
          className="mk-input"
          value={channel.categoryId ?? ''}
          onChange={(e) => apply(draftAssignCategory(draft, channel.id, e.currentTarget.value || null))}
        >
          <option value="">No category</option>
          {draft.categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </label>
    </div>
  );

  return (
    <section className="mk-card mk-community-organization" aria-label="Organization">
      <h2 className="mk-h2">Organization</h2>
      <p className="mk-muted" style={{ fontSize: 13, marginTop: 0 }}>
        Create channels, group them into categories, set topics, reorder, and archive channels you no
        longer use. Only you (the owner) can change this.
      </p>

      {/* Layout: chat-first vs library-first (G10/B.1). A one-revision toggle,
          committed on change, independent of the channel draft below. */}
      <div className="mk-org-block mk-org-layout">
        <h3 className="mk-h3">Home screen</h3>
        <label className="mk-template-adopt">
          <input
            type="checkbox"
            checked={communityLayout(descriptor) === 'library_first'}
            onChange={(e) => {
              const result = m.setCommunityLayout(communityId, e.currentTarget.checked ? 'library_first' : 'chat_first');
              setNotice(result.ok ? 'Home screen updated.' : result.error);
            }}
          />
          <span>Open on Library</span>
        </label>
        <p className="mk-muted" style={{ fontSize: 12, marginTop: 0 }}>
          On opens this community on its Libraries home, with Chat one tap away. Off opens on Chat.
        </p>
      </div>

      {/* Categories */}
      <div className="mk-org-block">
        <h3 className="mk-h3">Categories</h3>
        {draft.categories.length === 0 ? (
          <p className="mk-muted" style={{ fontSize: 13 }}>No categories yet. Channels show under one list.</p>
        ) : (
          draft.categories.map((cat) => (
            <div key={cat.id} className="mk-org-category-row">
              <input
                className="mk-input"
                aria-label={`Category name for ${cat.id}`}
                value={cat.name}
                onChange={(e) => {
                  const r = draftRenameCategory(draft, cat.id, e.currentTarget.value);
                  if (r.ok) apply(r.draft);
                  else setDraft({ ...draft, categories: draft.categories.map((c) => (c.id === cat.id ? { ...c, name: e.currentTarget.value } : c)) });
                }}
              />
              <div className="mk-org-channel-actions">
                <Button variant="ghost" small aria-label={`Move category ${cat.name} up`} onClick={() => apply(draftMoveCategory(draft, cat.id, 'up'))}>↑</Button>
                <Button variant="ghost" small aria-label={`Move category ${cat.name} down`} onClick={() => apply(draftMoveCategory(draft, cat.id, 'down'))}>↓</Button>
                <Button variant="ghost" small onClick={() => apply(draftDeleteCategory(draft, cat.id))}>Delete</Button>
              </div>
            </div>
          ))
        )}
        <div className="mk-org-add">
          <input
            className="mk-input"
            placeholder="New category name"
            value={categoryName}
            onChange={(e) => setCategoryName(e.currentTarget.value)}
          />
          <Button variant="ghost" small disabled={categoryName.trim().length === 0} onClick={onAddCategory}>
            Add category
          </Button>
        </div>
      </div>

      {/* Channels */}
      <div className="mk-org-block">
        <h3 className="mk-h3">Channels</h3>
        {groups.uncategorized.map(renderChannelRow)}
        {/* The add row creates an UNCATEGORIZED channel (assign a category on its
            row afterward), so it renders with the uncategorized rows. Placed after
            the category groups it visually implied "add into the last category". */}
        <div className="mk-org-add">
          <input
            className="mk-input"
            placeholder="new-channel-name"
            value={channelName}
            onChange={(e) => setChannelName(e.currentTarget.value)}
          />
          <Button variant="ghost" small disabled={channelName.trim().length === 0} onClick={onAddChannel}>
            Add channel
          </Button>
        </div>
        {groups.byCategory.map(({ category, channels }) => (
          <div key={category.id} className="mk-org-cat-group">
            <div className="mk-org-cat-heading">{category.name}</div>
            {channels.length === 0 ? (
              <p className="mk-muted" style={{ fontSize: 12 }}>No channels in this category.</p>
            ) : (
              channels.map(renderChannelRow)
            )}
          </div>
        ))}
      </div>

      {/* Archived */}
      {groups.archived.length > 0 ? (
        <div className="mk-org-block">
          <h3 className="mk-h3">Archived</h3>
          <p className="mk-muted" style={{ fontSize: 12, marginTop: 0 }}>
            Archived channel. Content is preserved and read-only here.
          </p>
          {groups.archived.map((channel) => (
            <div key={channel.id} className="mk-org-archived-row">
              <span>{channel.name}</span>
              <Button variant="ghost" small onClick={() => apply(draftSetArchived(draft, channel.id, false))}>
                Unarchive
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      {notice ? <p className="mk-community-profile-notice">{notice}</p> : null}

      <HonestNotice>
        Saving revises this community locally. Existing members do not see the new structure until they
        rejoin from a fresh invite link. There is no automatic descriptor sync.
      </HonestNotice>

      <div className="mk-btn-row">
        <Button variant="ghost" small disabled={!dirty} onClick={save}>Save organization</Button>
        <Button variant="ghost" small disabled={!dirty} onClick={cancel}>Cancel</Button>
      </div>
    </section>
  );
}
