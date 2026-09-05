// ShareInbox (Plan 20, Phase 10 web): the OS-share / file-pick intake surface. It
// stages brought-in items DEVICE-LOCALLY through the real @mylife/sync
// share-intake engine (stageWebShare) and routes a staged item into an existing
// real channel/files message by REUSING the provider's composer attach+send
// (m.attachAndSend). Honesty guarantees enforced here:
//   - "Sent" renders ONLY after a REAL cm_messages row exists (isShareIntakeSent),
//     never from mk_share_intake.status.
//   - the direct-message destination is shown only when the live DM surface and
//     at least one eligible friend exist, then routes through the real DM provider.
//   - the payload MIME is re-sniffed at intake by the engine; the sender-declared
//     type is only a hint.
//   - the Web Share Target install hint is ABSENT when the browser cannot host it.

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { channelArchived } from '@mylife/sync';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { useView } from '../navigation/useView';
import { Modal } from '../shell/Modal';
import { Button } from '../shell/Button';
import { HonestNotice } from '../shell/HonestNotice';
import { EmptyState } from '../shell/EmptyState';
import {
  availableShareDestinations,
  discardStagedShare,
  isShareIntakeSent,
  listStagedShareItems,
  routeStagedShare,
  routeStagedShareToDm,
  stageWebShare,
  type ShareDmSend,
  type ShareRouteDestination,
  type StagedShareItem,
  type WebShareItemInput,
} from '../../lib/share-route';
import { buildFriendRows } from '../../lib/friends-core';
import { ensureDirectConversation } from '../../lib/dm-view-core';
import {
  drainWebShareTarget,
  hasPendingWebShare,
  isWebShareTargetSupported,
} from '../../lib/web-share-target';
// Plan 21 direct messages and Plan 40 share routing are live. Capability gating
// remains shared with capability-status through lib/dm-surface.ts.
import { DM_MESSAGES_SURFACE_ENABLED } from '../../lib/dm-surface';
import { useLibrary } from '../library/useLibrary';
import { LIBRARY_STRINGS } from '../../lib/library-browse-core';
import { MEDIA_TYPE_META } from '../library/media-meta';

// The share-intake surface routes into channels/files/DMs (ShareRouteDestination);
// Plan 38 adds a personal-library destination handled locally (a sealed library
// item, NOT a cm_message), so it rides alongside as a synthetic option.
type RowDestination = ShareRouteDestination | 'library';

const DESTINATION_LABELS: Record<RowDestination, string> = {
  channel: 'Post to a channel',
  files: 'Add to files',
  dm: 'Send to a direct message',
  library: LIBRARY_STRINGS.saveToLibrary,
};

function payloadSummary(item: StagedShareItem): string {
  return item.payloads
    .map((p) => {
      if (p.text_value != null && p.blob_hash == null) {
        const t = p.text_value.trim();
        return t.length > 60 ? `${t.slice(0, 57)}...` : t;
      }
      return p.filename ?? `${p.kind} file`;
    })
    .join(', ');
}

export function ShareInbox(): React.ReactElement {
  const m = useMeerkat();
  const { dispatch } = useView();
  const close = (): void => dispatch({ type: 'CLOSE_OVERLAY' });

  const communities = m.listCommunities();
  const destinations = useMemo(
    () => availableShareDestinations({ directMessages: DM_MESSAGES_SURFACE_ENABLED }),
    [],
  );
  const shareTargetSupported = useMemo(() => isWebShareTargetSupported(), []);

  const [items, setItems] = useState<StagedShareItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const reload = useCallback((): void => {
    setItems(listStagedShareItems(m.db));
  }, [m.db]);

  const stage = useCallback(
    async (raw: WebShareItemInput[], source: 'web_file_pick' | 'web_share_target'): Promise<void> => {
      if (raw.length === 0) return;
      setBusy(true);
      setError(null);
      try {
        const result = await stageWebShare(m.db, m.blobStore, { items: raw, source });
        if (result.errors.length > 0) setError(result.errors.join(' '));
        await m.db.flush();
        reload();
      } catch (e) {
        // A thrown stage (blob store write failure) must surface, not die as an
        // unhandled rejection with no feedback.
        setError(e instanceof Error ? e.message : 'Could not stage these files.');
      } finally {
        setBusy(false);
      }
    },
    [m.db, m.blobStore, reload],
  );

  // Boot: drain any pending Web Share Target payload, then list what is staged.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (hasPendingWebShare()) {
        try {
          const drained = await drainWebShareTarget();
          if (!cancelled && drained && drained.length > 0) {
            await stage(drained, 'web_share_target');
            return;
          }
        } catch (e) {
          // A thrown drain (cache read failure) must surface, not die as an
          // unhandled rejection that also leaves the staged list unrendered.
          if (!cancelled) setError(e instanceof Error ? e.message : 'Could not read the shared items.');
        }
      }
      if (!cancelled) reload();
    })();
    return () => {
      cancelled = true;
    };
  }, [reload, stage]);

  const onPickFiles = (files: FileList | null): void => {
    if (!files || files.length === 0) return;
    void (async () => {
      try {
        const raw: WebShareItemInput[] = [];
        for (const file of Array.from(files)) {
          const bytes = new Uint8Array(await file.arrayBuffer());
          // declaredMime is only a hint; the engine re-sniffs the real MIME.
          raw.push({ bytes, declaredMime: file.type || undefined, filename: file.name });
        }
        await stage(raw, 'web_file_pick');
      } catch (e) {
        // A file that cannot be read (revoked permission, removed drive) must
        // surface, not die as an unhandled rejection with no feedback.
        setError(e instanceof Error ? e.message : 'Could not read the picked files.');
      }
    })();
  };

  const onDrop = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setDragging(false);
    onPickFiles(e.dataTransfer?.files ?? null);
  };

  return (
    <Modal title="Bring in from your device" onClose={close} locked={busy}>
      <div className="mk-share-inbox">
        <div
          className={`mk-box mk-share-dropzone ${dragging ? 'is-active' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <p className="mk-share-heading">Drop a file here, or pick one to bring it in.</p>
          <p className="mk-muted">
            It is staged only on this device until you route it into a community. Nothing is sent
            until you choose a destination below.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            aria-hidden
            onChange={(e) => {
              onPickFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <Button variant="ghost" disabled={busy} onClick={() => fileInputRef.current?.click()}>
            Choose files
          </Button>
        </div>

        {shareTargetSupported ? (
          <HonestNotice>
            Install Meerkat to your home screen to share into it from other apps. Sharing into an
            installed app needs a device with a share sheet.
          </HonestNotice>
        ) : null}

        {error ? (
          <div className="mk-box is-error" role="alert">
            {error}
          </div>
        ) : null}

        {items.length === 0 ? (
          <EmptyState icon="📥" title="Nothing staged yet">
            <p className="mk-muted">Files you bring in show up here, ready to route.</p>
          </EmptyState>
        ) : (
          <ul className="mk-share-list">
            {items.map((item) => (
              <StagedShareRow
                key={item.intake.id}
                item={item}
                communities={communities}
                destinations={destinations}
                busy={busy}
                onChanged={reload}
              />
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

function StagedShareRow({
  item,
  communities,
  destinations,
  busy,
  onChanged,
}: {
  item: StagedShareItem;
  communities: ReturnType<ReturnType<typeof useMeerkat>['listCommunities']>;
  destinations: ShareRouteDestination[];
  busy: boolean;
  onChanged: () => void;
}): React.ReactElement {
  const m = useMeerkat();
  const lib = useLibrary();
  // Plan 40 R1: 'dm' is a live destination. Trusted, unblocked pairings are the
  // recipients; routeStagedShareToDm routes through the real DM provider.
  const dmRecipients = useMemo(
    () => buildFriendRows(m.pairedDevices(), {
      isPeerSasVerified: m.isPeerSasVerified,
      isPeerRevoked: m.isPeerRevoked,
    }).filter((friend) => friend.trustState !== 'blocked'),
    [m],
  );
  const canDm = destinations.includes('dm') && dmRecipients.length > 0;
  // channel/files need a community to route into; dm needs an eligible friend.
  // A destination that can only fail is not offered.
  const routable = destinations.filter((d) => (d === 'dm' ? canDm : communities.length > 0));
  // Plan 38: offer "Save to library" when a personal library exists (a sealed
  // library item, not a channel message).
  const personalLibs = useMemo(
    () => m.personalWorkspaceId ? lib.listLibraries(m.personalWorkspaceId) : [],
    [lib, m.personalWorkspaceId],
  );
  const rowDestinations = useMemo<RowDestination[]>(
    () => personalLibs.length > 0 ? [...routable, 'library'] : routable,
    [personalLibs, routable],
  );
  const [destination, setDestination] = useState<RowDestination>(rowDestinations[0] ?? 'channel');
  // Repair a selection that is no longer offered (a community left, the last
  // eligible friend was blocked) instead of leaving a dead Route button.
  useEffect(() => {
    if (rowDestinations.length === 0 || rowDestinations.includes(destination)) return;
    setDestination(rowDestinations[0]);
  }, [rowDestinations, destination]);
  const [communityId, setCommunityId] = useState<string>(communities[0]?.communityId ?? '');
  const community = communities.find((c) => c.communityId === communityId) ?? communities[0] ?? null;
  // Archived channels are read-only everywhere, so they are never offered as
  // send targets here (an external intake picker is a write entry point too).
  const channels = (community?.descriptor.channels ?? []).filter((ch) => !channelArchived(ch));
  const firstChannelId = channels[0]?.id ?? '';
  const [channelId, setChannelId] = useState<string>(channels[0]?.id ?? '');
  const [libraryChannelId, setLibraryChannelId] = useState<string>(personalLibs[0]?.id ?? '');
  const [dmRecipientId, setDmRecipientId] = useState<string>(dmRecipients[0]?.deviceId ?? '');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedToLibrary, setSavedToLibrary] = useState(false);
  // Repair a stale channel target (archived or removed since selection) instead
  // of routing a share into a channel that is no longer offered.
  useEffect(() => {
    if (channelId && channels.some((ch) => ch.id === channelId)) return;
    if (channelId !== firstChannelId) setChannelId(firstChannelId);
  }, [channels, channelId, firstChannelId]);

  const sent = isShareIntakeSent(m.db, item.intake.id);

  const sendDm: ShareDmSend = useCallback(
    async (conversationId, body, attachments) => {
      try {
        const result = await m.queueDmMessage(conversationId, body, attachments);
        return { ok: true, messageId: result.event.id };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Could not send this message.' };
      }
    },
    [m],
  );

  const onSendDm = (): void => {
    if (sending || !dmRecipientId) return;
    const recipient = m.pairedDevices().find((d) => d.deviceId === dmRecipientId);
    if (!recipient || !recipient.dhPublicKey) {
      setError('Choose a friend to send this to.');
      return;
    }
    setSending(true);
    setError(null);
    void (async () => {
      try {
        const conversationId = ensureDirectConversation(m.db, m.identity, {
          deviceId: recipient.deviceId,
          dhPublicKey: recipient.dhPublicKey,
        });
        const result = await routeStagedShareToDm(m.db, m.blobStore, sendDm, {
          intakeId: item.intake.id,
          conversationId,
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        await m.db.flush();
        onChanged();
      } catch (e) {
        // A thrown step must surface; the intake stays staged and retryable.
        setError(e instanceof Error ? e.message : 'Could not send this item.');
      } finally {
        setSending(false);
      }
    })();
  };

  const onSaveToLibrary = (): void => {
    if (sending || !m.personalWorkspaceId || !libraryChannelId) return;
    setSending(true);
    setError(null);
    void (async () => {
      try {
        await lib.ingestFromShareIntake({
          intakeId: item.intake.id,
          channelId: libraryChannelId,
          workspaceId: m.personalWorkspaceId as string,
        });
        setSavedToLibrary(true);
        onChanged();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save to the library.');
      } finally {
        setSending(false);
      }
    })();
  };

  const onSend = (): void => {
    if (sending || !community || !channelId || destination === 'library') return;
    const routeDestination: ShareRouteDestination = destination;
    setSending(true);
    setError(null);
    void (async () => {
      try {
        const result = await routeStagedShare(m.db, m.blobStore, m.attachAndSend, {
          intakeId: item.intake.id,
          communityId: community.communityId,
          channelId,
          destination: routeDestination,
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        await m.db.flush();
        onChanged();
      } catch (e) {
        // A thrown step must surface; the intake stays staged and retryable.
        setError(e instanceof Error ? e.message : 'Could not route this item.');
      } finally {
        setSending(false);
      }
    })();
  };

  const onDiscard = (): void => {
    discardStagedShare(m.db, item.intake.id);
    void m.db.flush().catch(() => undefined);
    onChanged();
  };

  return (
    <li className="mk-share-item mk-box">
      <div className="mk-share-item-head">
        <span className="mk-share-item-summary">{payloadSummary(item)}</span>
        {sent ? <span className="mk-pill is-success">Sent</span> : null}
        {savedToLibrary ? <span className="mk-pill is-success">Saved to library</span> : null}
      </div>

      {savedToLibrary ? (
        <p className="mk-muted">Sealed into a library on this device.</p>
      ) : sent ? (
        <p className="mk-muted">Routed into a real message on this device.</p>
      ) : rowDestinations.length === 0 ? (
        <HonestNotice>Create a library, or create or join a community, to route this item.</HonestNotice>
      ) : (
        <div className="mk-share-route-controls">
          <label className="mk-field">
            <span className="mk-label">Destination</span>
            <select
              className="mk-input"
              value={destination}
              aria-label="Destination"
              onChange={(e) => setDestination(e.currentTarget.value as RowDestination)}
            >
              {rowDestinations.map((d) => (
                <option key={d} value={d}>
                  {DESTINATION_LABELS[d]}
                </option>
              ))}
            </select>
          </label>

          {destination === 'library' ? (
            <>
              <label className="mk-field">
                <span className="mk-label">Library</span>
                <select
                  className="mk-input"
                  value={libraryChannelId}
                  aria-label="Library"
                  onChange={(e) => setLibraryChannelId(e.currentTarget.value)}
                >
                  {personalLibs.map((config) => (
                    <option key={config.id} value={config.id}>
                      {MEDIA_TYPE_META[config.mediaType].icon} {MEDIA_TYPE_META[config.mediaType].label}
                    </option>
                  ))}
                </select>
              </label>
              {error ? (
                <div className="mk-box is-error" role="alert">{error}</div>
              ) : null}
              <div className="mk-share-item-actions">
                <Button variant="ghost" disabled={sending || busy} onClick={onDiscard}>
                  Discard
                </Button>
                <Button disabled={sending || busy || !libraryChannelId} onClick={onSaveToLibrary}>
                  {sending ? 'Saving…' : LIBRARY_STRINGS.saveToLibrary}
                </Button>
              </div>
            </>
          ) : destination === 'dm' ? (
            <>
              <label className="mk-field">
                <span className="mk-label">Send to</span>
                <select
                  className="mk-input"
                  value={dmRecipientId}
                  aria-label="Recipient"
                  onChange={(e) => setDmRecipientId(e.currentTarget.value)}
                >
                  {dmRecipients.map((friend) => (
                    <option key={friend.deviceId} value={friend.deviceId}>
                      {friend.displayName}
                    </option>
                  ))}
                </select>
              </label>
              {error ? (
                <div className="mk-box is-error" role="alert">{error}</div>
              ) : null}
              <div className="mk-share-item-actions">
                <Button variant="ghost" disabled={sending || busy} onClick={onDiscard}>
                  Discard
                </Button>
                <Button disabled={sending || busy || !dmRecipientId} onClick={onSendDm}>
                  {sending ? 'Sending…' : 'Send to person'}
                </Button>
              </div>
            </>
          ) : (
          <>
          <label className="mk-field">
            <span className="mk-label">Community</span>
            <select
              className="mk-input"
              value={community?.communityId ?? ''}
              aria-label="Community"
              onChange={(e) => {
                setCommunityId(e.currentTarget.value);
                const next = communities.find((c) => c.communityId === e.currentTarget.value);
                setChannelId(next?.descriptor.channels.find((ch) => !channelArchived(ch))?.id ?? '');
              }}
            >
              {communities.map((c) => (
                <option key={c.communityId} value={c.communityId}>
                  {c.descriptor.name}
                </option>
              ))}
            </select>
          </label>

          <label className="mk-field">
            <span className="mk-label">Channel</span>
            <select
              className="mk-input"
              value={channelId}
              aria-label="Channel"
              onChange={(e) => setChannelId(e.currentTarget.value)}
            >
              {channels.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  #{ch.name}
                </option>
              ))}
            </select>
          </label>

          {error ? (
            <div className="mk-box is-error" role="alert">
              {error}
            </div>
          ) : null}

          <div className="mk-share-item-actions">
            <Button variant="ghost" disabled={sending || busy} onClick={onDiscard}>
              Discard
            </Button>
            <Button disabled={sending || busy || !channelId} onClick={onSend}>
              {sending ? 'Routing…' : 'Route'}
            </Button>
          </div>
          </>
          )}
        </div>
      )}
    </li>
  );
}
