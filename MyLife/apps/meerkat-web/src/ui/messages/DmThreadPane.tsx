// DmThreadPane (Plan 21 Phase 9): the web 1:1 / group DM thread pane. The web twin
// of the mobile dm/[conversationId].tsx screen. It renders on the SHARED pure
// chat-kit-core grouping (buildMessageRows + formatClockTime + the day/unread
// dividers) and the SHARED ChatComposer, adapting only the honest DM controls.
//
// HONESTY (Critical): the per-message receipt line derives ONLY from real
// dm_delivery rows (a park result, or a verified signed receipt) via
// summarizeDmDelivery/dmDeliveryLabel; "Delivered"/"Read" never come from a timer.
// DMs have NO reaction/reply/edit protocol, so the message actions are exactly
// Copy, Delete-for-everyone (mine, a real DM_SHRED), and Report (others) -- no fake
// reaction chips or reply/edit affordances. Block is a real local revocation.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DmMessageAttachment, DmMessageEvent } from '@mylife/sync';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { DM_PERSON_LINKS_SCOPE } from '../../lib/person-identity-core';
import { isSamePerson, resolvePersonName } from '../../lib/person-view-core';
import { ChatComposer } from '../channel/ChatComposer';
import { formatBytes } from '../format';
import { buildMessageRows, formatClockTime } from '../../lib/chat-kit-core';
import {
  deleteDmMessageRow,
  getDmConversation,
  getDmDelivery,
  getDmReadState,
  listDmMessages,
  listDmOwnDevices,
  listDmParticipants,
  setDmReadState,
  type DmParticipantRow,
} from '../../lib/dm-core';
import {
  computeDmReceiptsToEmit,
  dmDeliveryLabel,
  dmRetryAvailable,
  mapDmEventToKit,
  shouldStartDmRetry,
  summarizeDmDelivery,
  DM_EMPTY_THREAD_STATE,
} from '../../lib/dm-view-core';
import { DmGroupInfoPane } from './DmGroupInfoPane';
import { useCall } from '../../lib/CallProvider';
import { startCallFailureCopy } from '../../lib/call-log-core';

const MAX_DM_BODY = 100_000;
const DM_MODULE_ID = 'dm';

export function DmThreadPane({
  conversationId,
  onBack,
}: {
  conversationId: string;
  onBack: () => void;
}): React.ReactElement {
  const m = useMeerkat();
  const { canCallPeer, startCall } = useCall();
  const db = m.db;
  const selfDeviceId = m.identity.publicKey;

  const [revision, setRevision] = useState(0);
  const bump = useCallback(() => setRevision((r) => r + 1), []);
  const [draft, setDraft] = useState('');
  const [draftAttachments, setDraftAttachments] = useState<DmMessageAttachment[]>([]);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const retryInFlightRef = useRef(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const relayConfigured = m.relayUrl.startsWith('ws');

  // m.revision (provider) + local revision both drive re-reads.
  const rev = revision + m.revision;

  const conversation = useMemo(() => {
    void rev;
    return getDmConversation(db, conversationId);
  }, [db, conversationId, rev]);
  const isGroup = conversation?.kind === 'group';

  const participants = useMemo<DmParticipantRow[]>(
    () => {
      void rev;
      return conversation ? listDmParticipants(db, conversationId) : [];
    },
    [db, conversationId, conversation, rev],
  );

  const pairedNames = useMemo(() => {
    void rev;
    const map = new Map<string, string>();
    for (const device of m.pairedDevices()) {
      if (device.displayName) map.set(device.deviceId, device.displayName);
    }
    return map;
  }, [m, rev]);

  // Plan 52 P4: verified DM-peer person links, so a message authored on one of
  // YOUR OWN linked devices reads as you, and a peer's linked devices read as
  // that one person instead of as strangers.
  const personLinkMap = useMemo(() => {
    void rev;
    return m.personLinks(DM_PERSON_LINKS_SCOPE);
  }, [m, rev]);

  const resolveName = useCallback(
    (deviceId: string): string => {
      if (isSamePerson(personLinkMap, deviceId, selfDeviceId)) return 'You';
      return resolvePersonName(
        personLinkMap,
        deviceId,
        pairedNames,
        `${deviceId.slice(0, 6)}…${deviceId.slice(-4)}`,
      );
    },
    [selfDeviceId, pairedNames, personLinkMap],
  );

  const peerParticipant = useMemo(
    () => participants.find((p) => p.is_self === 0) ?? null,
    [participants],
  );
  const peerBlocked = peerParticipant ? m.isPeerRevoked(peerParticipant.device_id) : false;

  const title = useMemo(() => {
    if (isGroup) return conversation?.title?.trim() || 'Group';
    if (peerParticipant) return resolveName(peerParticipant.device_id);
    return 'Conversation';
  }, [isGroup, conversation, peerParticipant, resolveName]);

  const subtitle = isGroup
    ? `${participants.length} member${participants.length === 1 ? '' : 's'}`
    : 'Private, end-to-end encrypted';

  const messages = useMemo<DmMessageEvent[]>(
    () => {
      void rev;
      return conversation ? listDmMessages(db, conversationId) : [];
    },
    [db, conversationId, conversation, rev],
  );

  const messagesById = useMemo(() => {
    const map = new Map<string, DmMessageEvent>();
    for (const event of messages) map.set(event.id, event);
    return map;
  }, [messages]);

  const rows = useMemo(() => buildMessageRows(messages.map((e) => mapDmEventToKit(e, selfDeviceId))), [messages, selfDeviceId]);

  const deliveryById = useMemo(() => {
    void rev;
    const map = new Map<string, ReturnType<typeof getDmDelivery>>();
    for (const event of messages) {
      if (event.authorDeviceId !== selfDeviceId) continue;
      map.set(event.id, getDmDelivery(db, event.id));
    }
    return map;
  }, [db, messages, selfDeviceId, rev]);

  const ownDeviceIds = useMemo(
    () => {
      void rev;
      return new Set(listDmOwnDevices(db).map((d) => d.device_id));
    },
    [db, rev],
  );

  // On mount / focus: run a best-effort real drain, then emit honest read/delivered
  // receipts for newly-seen peer messages and advance the local read marker. Never
  // fabricates delivery; a no-relay drain is a genuine no-op.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await m.runForegroundDrain();
      } catch {
        // Best-effort: the thread still shows locally recorded state.
      }
      if (cancelled) return;
      const conv = getDmConversation(db, conversationId);
      if (!conv) return;
      const current = listDmMessages(db, conversationId);
      const rs = getDmReadState(db, conversationId);
      const { toEmit, nextLastRead } = computeDmReceiptsToEmit(
        current,
        selfDeviceId,
        { wall: rs.last_read_hlc_wall, counter: rs.last_read_hlc_counter },
        rs.read_receipts_enabled === 1,
        m.isPeerRevoked,
        (deviceId) => ownDeviceIds.has(deviceId),
      );
      for (const receipt of toEmit) {
        try {
          await m.queueDmReceipt(conversationId, receipt.messageId, receipt.state);
        } catch {
          // A receipt that cannot park leaves the sender honestly at "Sent".
        }
      }
      if (nextLastRead) setDmReadState(db, conversationId, nextLastRead.wall, nextLastRead.counter);
      if (!cancelled) bump();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const pickAttachment = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onFilesPicked = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    void (async () => {
      setAttachmentBusy(true);
      try {
        const next: DmMessageAttachment[] = [];
        for (const file of files) {
          const bytes = new Uint8Array(await file.arrayBuffer());
          const stored = await m.blobStore.putLocal(bytes, {
            moduleId: DM_MODULE_ID,
            mimeType: file.type || 'application/octet-stream',
          });
          next.push({
            id: `att_${stored.hash.slice(0, 16)}_${Date.now().toString(36)}`,
            blobHash: stored.hash,
            name: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: stored.size,
          });
        }
        if (next.length > 0) setDraftAttachments((cur) => [...cur, ...next]);
      } catch (error) {
        setNote(error instanceof Error ? error.message : 'Could not attach that file.');
      } finally {
        setAttachmentBusy(false);
      }
    })();
  }, [m]);

  const removeDraftAttachment = useCallback((id: string) => {
    setDraftAttachments((cur) => cur.filter((a) => a.id !== id));
  }, []);

  const submitMessage = useCallback(async (body: string): Promise<void> => {
    if (body.length > MAX_DM_BODY) {
      setNote('Message too long. Shorten it and try again.');
      return;
    }
    const attachments = draftAttachments.length > 0 ? draftAttachments : undefined;
    setSending(true);
    setNote(null);
    const pending = m.queueDmMessage(conversationId, body, attachments);
    setDraft('');
    setDraftAttachments([]);
    bump();
    try {
      await pending;
    } catch {
      // The message is still a real local row; its honest state stays "Not sent".
    } finally {
      setSending(false);
      bump();
    }
  }, [conversationId, draftAttachments, m, bump]);

  const retryMessage = useCallback((event: DmMessageEvent) => {
    if (!shouldStartDmRetry(retryInFlightRef.current)) return;
    retryInFlightRef.current = true;
    void (async () => {
      const body = event.body;
      const attachments = (event.attachments ?? []).length > 0 ? event.attachments : undefined;
      setSending(true);
      // The failed echo never parked to anyone, so dropping this local-only copy
      // loses nothing; re-run the same queueDmMessage path for a fresh attempt.
      deleteDmMessageRow(db, event.id);
      bump();
      try {
        await m.queueDmMessage(conversationId, body, attachments);
      } catch {
        // Still a real local row; its honest state stays "Not sent".
      } finally {
        retryInFlightRef.current = false;
        setSending(false);
        bump();
      }
    })();
  }, [db, conversationId, m, bump]);

  const confirmDelete = useCallback((messageId: string) => {
    if (!window.confirm(
      'Delete for everyone? This deletes your message on this device and asks each recipient to delete their copy. A device that never reconnects keeps its copy until the connection server drops the pending delete.',
    )) return;
    void (async () => {
      try {
        await m.queueDmShred(conversationId, [messageId]);
      } catch {
        setNote('Could not delete. The delete did not complete in this browser. Try again.');
      } finally {
        bump();
      }
    })();
  }, [conversationId, m, bump]);

  // A failed start must surface: silently dropping the result union is a dead click.
  const placeCall = useCallback((deviceId: string, media: 'voice' | 'video') => {
    void (async () => {
      try {
        const result = await startCall(deviceId, media);
        if (!result.ok) setNote(startCallFailureCopy(result.reason, 'browser'));
      } catch {
        setNote(startCallFailureCopy('unknown', 'browser'));
      }
    })();
  }, [startCall]);

  const copyBody = useCallback((body: string) => {
    const write = navigator.clipboard?.writeText(body);
    if (!write) {
      setNote('Could not copy the text.');
      return;
    }
    write.catch(() => setNote('Could not copy the text.'));
  }, []);

  const reportMessage = useCallback((event: DmMessageEvent) => {
    if (!window.confirm('Report this message? This records a local report for your own review. Nothing is sent to the other person.')) return;
    m.reportDm({
      conversationId,
      messageId: event.id,
      reportedDeviceId: event.authorDeviceId,
      reason: 'Reported from direct message',
    });
    setNote('A local report was recorded on this device. Nothing was sent.');
  }, [conversationId, m]);

  const confirmBlock = useCallback(() => {
    if (!peerParticipant) return;
    setOverflowOpen(false);
    if (!window.confirm(`Block ${resolveName(peerParticipant.device_id)}? This records a real local block so this browser stops accepting and sending messages with them.`)) return;
    m.blockDmParticipant(peerParticipant.device_id, 'blocked from direct message');
    bump();
  }, [peerParticipant, resolveName, m, bump]);

  const reportPerson = useCallback(() => {
    if (!peerParticipant) return;
    setOverflowOpen(false);
    m.reportDm({
      conversationId,
      reportedDeviceId: peerParticipant.device_id,
      reason: 'Reported person from direct message',
    });
    setNote('A local report was recorded on this device. Nothing was sent.');
  }, [peerParticipant, conversationId, m]);

  if (!conversation) {
    return (
      <div className="mk-main-scroll mk-dm-thread">
        <header className="mk-dm-thread-head">
          <button type="button" className="mk-icon-btn" aria-label="Back to messages" onClick={onBack}>←</button>
          <div className="mk-dm-thread-titles"><div className="mk-h2">Conversation unavailable</div></div>
        </header>
        <div className="mk-box is-info" role="status">
          This browser has no record of that conversation. Nothing is loaded from a fallback server.
        </div>
      </div>
    );
  }

  if (groupInfoOpen && isGroup) {
    return (
      <DmGroupInfoPane
        conversationId={conversationId}
        onBack={() => { setGroupInfoOpen(false); bump(); }}
      />
    );
  }

  return (
    <div className="mk-main-scroll mk-dm-thread">
      <header className="mk-dm-thread-head">
        <button type="button" className="mk-icon-btn" aria-label="Back to messages" onClick={onBack}>←</button>
        <div className="mk-dm-thread-titles">
          <div className="mk-dm-thread-title">{title}</div>
          <div className="mk-muted mk-dm-thread-sub">{subtitle}</div>
        </div>
        <div className="mk-dm-thread-actions">
          {!isGroup && peerParticipant && !peerBlocked && canCallPeer(peerParticipant.device_id) ? (
            <>
              <button
                type="button"
                className="mk-icon-btn"
                aria-label={`Voice call ${title}`}
                onClick={() => placeCall(peerParticipant.device_id, 'voice')}
              >
                ☎
              </button>
              <button
                type="button"
                className="mk-icon-btn"
                aria-label={`Video call ${title}`}
                onClick={() => placeCall(peerParticipant.device_id, 'video')}
              >
                📹
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="mk-icon-btn"
            aria-label="Conversation options"
            aria-expanded={overflowOpen}
            onClick={() => setOverflowOpen((v) => !v)}
          >
            ⋯
          </button>
          {overflowOpen ? (
            <div className="mk-chat-context-menu" role="menu">
              {isGroup ? (
                <button type="button" role="menuitem" className="mk-chat-menu-item" onClick={() => { setOverflowOpen(false); setGroupInfoOpen(true); }}>Group info</button>
              ) : (
                <>
                  <button type="button" role="menuitem" className="mk-chat-menu-item" onClick={reportPerson}>Report person</button>
                  {!peerBlocked ? (
                    <button type="button" role="menuitem" className="mk-chat-menu-item is-danger" onClick={confirmBlock}>Block</button>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>
      </header>

      {peerBlocked ? (
        <div className="mk-box is-error" role="status">
          You blocked this person. Unblock them from the People list to message again.
        </div>
      ) : null}
      {note ? <div className="mk-box is-info" role="status">{note}</div> : null}

      <div className="mk-chat-list mk-dm-list">
        {rows.length === 0 ? (
          <div className="mk-empty">
            <div className="mk-empty-title">No messages yet</div>
            <p className="mk-muted">{DM_EMPTY_THREAD_STATE}</p>
          </div>
        ) : (
          rows.map((row) => {
            if (row.type === 'day') {
              return <div key={row.key} className="mk-chat-day-divider"><span>{row.label}</span></div>;
            }
            if (row.type === 'unread') {
              return <div key={row.key} className="mk-chat-unread-divider"><span>New messages</span></div>;
            }
            const event = messagesById.get(row.item.id);
            if (!event) return null;
            const isMine = event.authorDeviceId === selfDeviceId;
            const kind = isGroup ? 'group' : 'direct';
            const summary = isMine ? summarizeDmDelivery(deliveryById.get(event.id) ?? [], kind, ownDeviceIds) : null;
            const receiptLine = summary ? dmDeliveryLabel(summary, kind, { relayConfigured }) : null;
            const canRetry = summary ? dmRetryAvailable(summary, isMine) : false;
            return (
              <div key={row.key} className={`mk-chat-row ${isMine ? 'is-mine' : 'is-other'}`}>
                <div className={`mk-chat-col ${isMine ? 'is-mine' : 'is-other'}`}>
                  {!isMine && row.isGroupStart ? <div className="mk-chat-author">{resolveName(event.authorDeviceId)}</div> : null}
                  <div className={`mk-chat-bubble ${isMine ? 'is-mine' : 'is-other'}`}>
                    {event.body ? <div className="mk-chat-body">{event.body}</div> : null}
                    {(event.attachments ?? []).map((att) => (
                      <DmAttachmentCard key={att.id} attachment={att} />
                    ))}
                    <div className="mk-chat-meta">
                      {formatClockTime(event.hlc.wall)}
                      {event.supersedes && !event.supersedes.deleted ? ' · Edited' : ''}
                    </div>
                    <div className="mk-dm-msg-actions">
                      {event.body.length > 0 ? (
                        <button type="button" className="mk-dm-msg-action" onClick={() => copyBody(event.body)}>Copy</button>
                      ) : null}
                      {isMine ? (
                        <button type="button" className="mk-dm-msg-action is-danger" onClick={() => confirmDelete(event.id)}>Delete</button>
                      ) : (
                        <button type="button" className="mk-dm-msg-action is-danger" onClick={() => reportMessage(event)}>Report</button>
                      )}
                    </div>
                  </div>
                  {receiptLine ? (
                    <div className={`mk-dm-receipt ${isMine ? 'is-mine' : ''}`}>
                      <span>{receiptLine}</span>
                      {canRetry ? (
                        <button type="button" className="mk-dm-retry" disabled={sending} onClick={() => retryMessage(event)}>Retry</button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mk-dm-composer">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={onFilesPicked}
          aria-hidden
        />
        {draftAttachments.length > 0 ? (
          <div className="mk-dm-draft-attachments">
            {draftAttachments.map((att) => (
              <span key={att.id} className="mk-attach-chip">
                <span className="mk-file-icon" aria-hidden>📎</span>
                <span className="mk-attach-chip-name" title={att.name}>{att.name}</span>
                <span className="mk-attach-chip-size">{formatBytes(att.size)}</span>
                <button type="button" className="mk-attach-chip-remove" aria-label={`Remove ${att.name}`} onClick={() => removeDraftAttachment(att.id)}>×</button>
              </span>
            ))}
          </div>
        ) : null}
        <ChatComposer
          value={draft}
          onChangeText={setDraft}
          onSend={(body) => submitMessage(body)}
          mentionCandidates={[]}
          placeholder="Message"
          sendDisabled={sending || attachmentBusy || peerBlocked}
          allowAttachments={!peerBlocked}
          onPickAttachment={pickAttachment}
          attachmentBusy={attachmentBusy}
          attachmentsPresent={draftAttachments.length > 0}
        />
      </div>
    </div>
  );
}

// One received DM attachment: live presence + View/Download. The over-cap
// re-request path is deferred (a later phase), so an absent blob is stated
// honestly, never a dead download button.
function DmAttachmentCard({ attachment }: { attachment: DmMessageAttachment }): React.ReactElement {
  const m = useMeerkat();
  const [present, setPresent] = useState<boolean | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  // A thrown presence probe must not strand the card on "Checking this device…"
  // forever; it renders an honest could-not-check state instead.
  const [checkFailed, setCheckFailed] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const isImage = attachment.mimeType.startsWith('image/');

  useEffect(() => {
    let cancelled = false;
    setPresent(null);
    setPreviewUri(null);
    setCheckFailed(false);
    void (async () => {
      try {
        const has = await m.hasBlob(attachment.blobHash);
        if (cancelled) return;
        setPresent(has);
        if (has && isImage) {
          const uri = await m.blobPreviewDataUri(attachment.blobHash, attachment.mimeType);
          if (!cancelled) setPreviewUri(uri);
        }
      } catch {
        if (!cancelled) setCheckFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [attachment.blobHash, attachment.mimeType, isImage, m]);

  const download = useCallback(() => {
    setDownloadError(null);
    void (async () => {
      try {
        const bytes = await m.getBlob(attachment.blobHash);
        if (!bytes) {
          setDownloadError('This browser has the file reference, but not the file bytes yet.');
          return;
        }
        // Copy into a fresh ArrayBuffer-backed view so the DOM Blob typing is happy
        // (the stored bytes may be backed by a SharedArrayBuffer-like buffer).
        const copy = new Uint8Array(bytes.length);
        copy.set(bytes);
        const blob = new Blob([copy.buffer], { type: attachment.mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = attachment.name;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        setDownloadError('This attachment could not be downloaded in this browser.');
      }
    })();
  }, [attachment, m]);

  if (checkFailed) {
    return (
      <div className="mk-dm-attach is-absent">
        <span className="mk-file-icon" aria-hidden>📄</span>
        <div>
          <div className="mk-dm-attach-name">{attachment.name}</div>
          <div className="mk-muted" style={{ fontSize: 12 }}>Could not check this browser for the file. Reopen the chat to try again.</div>
        </div>
      </div>
    );
  }

  if (present === false) {
    return (
      <div className="mk-dm-attach is-absent">
        <span className="mk-file-icon" aria-hidden>📄</span>
        <div>
          <div className="mk-dm-attach-name">{attachment.name}</div>
          <div className="mk-muted" style={{ fontSize: 12 }}>Not on this device yet. Large attachments are fetched on demand in a later update.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mk-dm-attach">
      {isImage && previewUri ? (
        <img src={previewUri} alt={attachment.name} className="mk-dm-attach-img" />
      ) : (
        <span className="mk-file-icon" aria-hidden>📄</span>
      )}
      <div className="mk-dm-attach-main">
        <div className="mk-dm-attach-name">{attachment.name}</div>
        <div className="mk-muted" style={{ fontSize: 12 }}>{present === null ? 'Checking this device…' : formatBytes(attachment.size)}</div>
        {downloadError ? <div className="mk-muted" style={{ fontSize: 12 }} role="alert">{downloadError}</div> : null}
      </div>
      <button type="button" className="mk-dm-msg-action" disabled={present !== true} onClick={download}>Download</button>
    </div>
  );
}
