import { useCallback, useMemo, useState } from 'react';
import { CanvasHost } from '../canvas/CanvasHost';
import { getCanvasById, parseCanvasPostBody } from '../../lib/canvas-core';
import {
  channelArchived,
  createCommunityAudienceRule,
  createReplyAudienceRule,
  type AudienceRule,
  type ChannelMessageEvent,
} from '@mylife/sync';
import { useMeerkat } from '../../lib/MeerkatProvider';
import {
  isCommunityContentReportHidden,
  isCommunityPersonBlocked,
} from '../../lib/community-safety';
import type { ChannelPostThread, ChannelPostThreadNode, MessageReactionGroup } from '../../lib/meerkat-data';
import type { MentionCandidate } from '../../lib/chat-kit-core';
import type { SendMessageOpts } from '../../lib/chat-compose';
import { AudienceBadge, AudienceRuleSummary } from '../audience/AudienceRule';
import { Button } from '../shell/Button';
import { EmptyState } from '../shell/EmptyState';
import { HonestNotice } from '../shell/HonestNotice';
import { ChatComposer } from './ChatComposer';
import { QUICK_REACTIONS } from './emoji-data';
import { EmojiPicker } from './EmojiPicker';
import { formatWhen } from '../format';

const EMPTY_REACTIONS: readonly MessageReactionGroup[] = Object.freeze([]);

function filterThreadNode(
  node: ChannelPostThreadNode,
  isHidden: (event: ChannelMessageEvent) => boolean,
): ChannelPostThreadNode | null {
  if (isHidden(node.event)) return null;
  return {
    event: node.event,
    replies: node.replies
      .map((child) => filterThreadNode(child, isHidden))
      .filter((child): child is ChannelPostThreadNode => child !== null),
  };
}

function countThreadReplies(nodes: readonly ChannelPostThreadNode[]): number {
  return nodes.reduce((sum, node) => sum + 1 + countThreadReplies(node.replies), 0);
}

export function PostThreadView({
  communityId,
  channelId,
  postId,
  resolveName,
  onBack,
}: {
  communityId: string;
  channelId: string;
  postId: string;
  resolveName: (deviceId: string) => string;
  onBack: () => void;
}): React.ReactElement {
  const m = useMeerkat();
  const revision = m.revision;
  const ownDeviceId = m.identity.publicKey;
  const [draft, setDraft] = useState('');
  const [replyTarget, setReplyTarget] = useState<ChannelMessageEvent | null>(null);
  const [editingEvent, setEditingEvent] = useState<ChannelMessageEvent | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reactionsByParent = useMemo(
    () => m.channelReactions(communityId, channelId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [m, communityId, channelId, revision],
  );
  const getReactions = useCallback(
    (id: string): readonly MessageReactionGroup[] => reactionsByParent.get(id) ?? EMPTY_REACTIONS,
    [reactionsByParent],
  );
  // 4.5: a canvas-post root renders its canvas, not the token body.
  const community = useMemo(
    () => m.listCommunities().find((c) => c.communityId === communityId) ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [m, communityId, revision],
  );
  // Plan 38 Phase 2: an archived channel is read-only EVERYWHERE, including its
  // post threads; without this gate the thread composer was a reply back door.
  const descriptorChannel = community?.descriptor.channels.find((c) => c.id === channelId) ?? null;
  const channelIsArchived = descriptorChannel ? channelArchived(descriptorChannel) : false;

  const toggleReaction = useCallback((eventId: string, emoji: string, targetPostId?: string) => {
    // Archived channels are read-only: existing reaction chips stay visible as
    // preserved content, but no click may write a new react/remove event.
    if (channelIsArchived) return;
    const groups = reactionsByParent.get(eventId) ?? EMPTY_REACTIONS;
    const existing = groups.find((g) => g.emoji === emoji);
    if (existing && existing.mine && existing.myEventId) {
      m.removeReaction(communityId, channelId, existing.myEventId);
    } else {
      m.sendReaction(communityId, channelId, { eventId, postId: targetPostId ?? postId }, emoji);
    }
  }, [reactionsByParent, m, communityId, channelId, postId, channelIsArchived]);

  const mentionCandidates = useMemo<MentionCandidate[]>(() => {
    const out: MentionCandidate[] = [];
    for (const [deviceId, name] of m.communityPeerNames(communityId)) {
      if (deviceId === ownDeviceId) continue;
      out.push({ deviceId, name });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m, communityId, ownDeviceId, revision]);
  const thread = useMemo<ChannelPostThread | null>(
    () => {
      const raw = m.listChannelPostThread(communityId, channelId, postId);

      if (!raw) return null;
      const isHidden = (event: ChannelMessageEvent): boolean => {
        if (isCommunityPersonBlocked(m.db, communityId, event.authorDeviceId)) return true;
        if (isCommunityContentReportHidden(m.db, communityId, 'message', event.id)) return true;
        if (event.postId && isCommunityContentReportHidden(m.db, communityId, 'post', event.postId)) return true;
        return false;
      };
      if (isHidden(raw.root)) return null;
      const replies = raw.replies
        .map((node) => filterThreadNode(node, isHidden))
        .filter((node): node is ChannelPostThreadNode => node !== null);
      return { ...raw, replies, replyCount: countThreadReplies(replies) };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [m, communityId, channelId, postId, revision],
  );

  const rootCanvasId = thread ? parseCanvasPostBody(thread.root.body) : null;
  const rootCanvas = useMemo(
    () => (rootCanvasId ? getCanvasById(m.db, rootCanvasId) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [m.db, rootCanvasId, revision],
  );

  const audienceRule = useMemo(() => createCommunityAudienceRule(communityId), [communityId]);
  const replyAudienceRule = useMemo(() => createReplyAudienceRule(audienceRule), [audienceRule]);

  const beginEdit = (event: ChannelMessageEvent): void => {
    setEditingEvent(event);
    setEditDraft(event.body);
    setError(null);
  };

  const saveEdit = (): void => {
    if (!editingEvent) return;
    const result = m.editMessage(editingEvent, editDraft);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditingEvent(null);
    setEditDraft('');
    setError(null);
  };

  const deleteEvent = (event: ChannelMessageEvent): void => {
    // Same confirm as the channel view: Delete is destructive and the mobile
    // twin confirms; the thread's button used to delete on a single click.
    const ok = window.confirm('Delete this message? This records a deletion here and hides the message from this view.');
    if (!ok) return;
    const result = m.deleteMessage(event);
    if (!result.ok) setError(result.error);
  };

  const reportThreadEvent = (event: ChannelMessageEvent): void => {
    const root = event.id === thread?.root.id;
    const ok = window.confirm(
      root
        ? 'Report and hide this post? This hides the post on this device and adds it to local owner review.'
        : 'Report and hide this reply? This hides the reply on this device and adds it to local owner review.',
    );
    if (!ok) return;
    m.reportCommunityContent({
      communityId,
      channelId,
      targetKind: root ? 'post' : 'message',
      targetId: root ? postId : event.id,
      targetAuthorDeviceId: event.authorDeviceId,
      targetLabel: `${root ? 'Post' : 'Reply'} from ${resolveName(event.authorDeviceId)}`,
      reason: 'Reported from thread',
    });
  };

  const sendReply = (body: string, mentions: string[]): void => {
    const target = replyTarget ?? thread?.root ?? null;
    if (!target || body.trim().length === 0) return;
    // With signed mentions, build the reply through the v2 send path so the
    // mentions ride the event; the threading fields mirror createChannelPostReplyEvent
    // exactly (postId + parentId = the reply target + branchId inheritance). Without
    // mentions, replyToPost stays the canonical builder (unchanged thread semantics).
    let result;
    if (mentions.length > 0) {
      const opts: SendMessageOpts = {
        mentions,
        parentId: target.id,
        postId: target.postId,
        branchId: target.branchId ?? target.postId,
      };
      result = m.sendChannelMessage(communityId, channelId, body, opts);
    } else {
      result = m.replyToPost(target, body);
    }
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDraft('');
    setReplyTarget(null);
    setError(null);
  };

  if (!thread) {
    return (
      <div className="mk-channel-view">
        <div className="mk-thread-header">
          <Button variant="ghost" onClick={onBack}>Back</Button>
        </div>
        <EmptyState icon="🧵" title="Post unavailable">
          This browser does not have a verified root post for that thread.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="mk-thread-view">
      <div className="mk-thread-header">
        <Button variant="ghost" onClick={onBack}>Back</Button>
        <div>
          <h2>Post thread</h2>
          <p>{thread.replyCount} {thread.replyCount === 1 ? 'reply' : 'replies'}</p>
        </div>
      </div>
      {error ? <div className="mk-box is-error" role="alert">{error}</div> : null}
      <div className="mk-thread-scroll">
        {rootCanvasId ? (
          rootCanvas && community ? (
            <CanvasHost community={community} canvas={rootCanvas} />
          ) : (
            <p className="mk-muted">
              A canvas post. Its canvas has not arrived in this browser yet; it comes with a sync from a member who has it.
            </p>
          )
        ) : null}
        {rootCanvasId ? null : (
        <ThreadEvent
          event={thread.root}
          audienceRule={audienceRule}
          author={resolveName(thread.root.authorDeviceId)}
          ownDeviceId={ownDeviceId}
          root
          reactions={getReactions(thread.root.id)}
          onToggleReaction={toggleReaction}
          editing={editingEvent?.id === thread.root.id}
          editDraft={editDraft}
          onEditDraft={setEditDraft}
          onBeginEdit={beginEdit}
          onCancelEdit={() => setEditingEvent(null)}
          onSaveEdit={saveEdit}
          onDelete={deleteEvent}
          onReply={channelIsArchived ? undefined : setReplyTarget}
          onReport={thread.root.authorDeviceId === ownDeviceId ? undefined : reportThreadEvent}
          readOnly={channelIsArchived}
        />
        )}
        {thread.replies.length === 0 ? (
          <p className="mk-muted mk-thread-empty">No replies yet.</p>
        ) : (
          thread.replies.map((node) => (
            <ReplyNode
              key={node.event.id}
              node={node}
              audienceRule={audienceRule}
              resolveName={resolveName}
              ownDeviceId={ownDeviceId}
              getReactions={getReactions}
              onToggleReaction={toggleReaction}
              editingEventId={editingEvent?.id ?? null}
              editDraft={editDraft}
              onEditDraft={setEditDraft}
              onBeginEdit={beginEdit}
              onCancelEdit={() => setEditingEvent(null)}
              onSaveEdit={saveEdit}
              onDelete={deleteEvent}
              onReply={channelIsArchived ? undefined : setReplyTarget}
              onReport={reportThreadEvent}
              readOnly={channelIsArchived}
              depth={0}
            />
          ))
        )}
        <HonestNotice>
          This thread shows only signed post and reply events saved in this browser. Replies inherit the original audience.
        </HonestNotice>
      </div>
      <div className="mk-thread-reply">
        {channelIsArchived ? (
          <HonestNotice>Archived channel. Content is preserved and read-only here.</HonestNotice>
        ) : (
        <>
        <AudienceRuleSummary rule={replyAudienceRule} title="Reply audience" />
        <ChatComposer
          value={draft}
          onChangeText={setDraft}
          onSend={sendReply}
          mentionCandidates={mentionCandidates}
          placeholder="Write a reply"
          reply={replyTarget ? {
            authorName: resolveName(replyTarget.authorDeviceId),
            snippet: replyTarget.body.replace(/\s+/gu, ' ').trim().slice(0, 120) || 'Message',
          } : null}
          onCancelReply={() => setReplyTarget(null)}
        />
        </>
        )}
      </div>
    </div>
  );
}

function ReplyNode({
  node,
  audienceRule,
  resolveName,
  ownDeviceId,
  getReactions,
  onToggleReaction,
  editingEventId,
  editDraft,
  onEditDraft,
  onBeginEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onReply,
  onReport,
  readOnly,
  depth,
}: {
  node: ChannelPostThreadNode;
  audienceRule: AudienceRule;
  resolveName: (deviceId: string) => string;
  ownDeviceId: string;
  getReactions: (id: string) => readonly MessageReactionGroup[];
  onToggleReaction: (eventId: string, emoji: string, postId?: string) => void;
  editingEventId: string | null;
  editDraft: string;
  onEditDraft: (text: string) => void;
  onBeginEdit: (event: ChannelMessageEvent) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: (event: ChannelMessageEvent) => void;
  /** Absent for an archived (read-only) channel: no Reply affordance renders. */
  onReply?: (event: ChannelMessageEvent) => void;
  onReport: (event: ChannelMessageEvent) => void;
  /** True for an archived (read-only) channel: no react/edit/delete affordances render. */
  readOnly?: boolean;
  depth: number;
}): React.ReactElement {
  return (
    <div className={`mk-thread-reply-node ${depth > 0 ? 'is-nested' : ''}`}>
      <ThreadEvent
        event={node.event}
        audienceRule={audienceRule}
        author={resolveName(node.event.authorDeviceId)}
        ownDeviceId={ownDeviceId}
        reactions={getReactions(node.event.id)}
        onToggleReaction={onToggleReaction}
        editing={editingEventId === node.event.id}
        editDraft={editDraft}
        onEditDraft={onEditDraft}
        onBeginEdit={onBeginEdit}
        onCancelEdit={onCancelEdit}
        onSaveEdit={onSaveEdit}
        onDelete={onDelete}
        onReply={onReply}
        onReport={node.event.authorDeviceId === ownDeviceId ? undefined : onReport}
        readOnly={readOnly}
      />
      {node.replies.map((child) => (
        <ReplyNode
          key={child.event.id}
          node={child}
          audienceRule={audienceRule}
          resolveName={resolveName}
          ownDeviceId={ownDeviceId}
          getReactions={getReactions}
          onToggleReaction={onToggleReaction}
          editingEventId={editingEventId}
          editDraft={editDraft}
          onEditDraft={onEditDraft}
          onBeginEdit={onBeginEdit}
          onCancelEdit={onCancelEdit}
          onSaveEdit={onSaveEdit}
          onDelete={onDelete}
          onReply={onReply}
          onReport={onReport}
          readOnly={readOnly}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

function ThreadEvent({
  event,
  audienceRule,
  author,
  ownDeviceId,
  reactions,
  onToggleReaction,
  editing,
  editDraft,
  onEditDraft,
  onBeginEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onReply,
  onReport,
  readOnly,
  root,
}: {
  event: ChannelMessageEvent;
  audienceRule: AudienceRule;
  author: string;
  ownDeviceId: string;
  reactions: readonly MessageReactionGroup[];
  onToggleReaction: (eventId: string, emoji: string, postId?: string) => void;
  editing: boolean;
  editDraft: string;
  onEditDraft: (text: string) => void;
  onBeginEdit: (event: ChannelMessageEvent) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: (event: ChannelMessageEvent) => void;
  /** Absent for an archived (read-only) channel: no Reply affordance renders. */
  onReply?: (event: ChannelMessageEvent) => void;
  onReport?: (event: ChannelMessageEvent) => void;
  /** True for an archived (read-only) channel: no react/edit/delete affordances render. */
  readOnly?: boolean;
  root?: boolean;
}): React.ReactElement {
  const isOwn = event.authorDeviceId === ownDeviceId;
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <article className={`mk-thread-event ${root ? 'is-root' : ''}`}>
      <div className="mk-message-head">
        <span className="mk-message-author mk-mono">{author}</span>
        <span className="mk-message-when">{formatWhen(event.hlc.wall)}</span>
        <AudienceBadge rule={audienceRule} />
      </div>
      {editing ? (
        <div className="mk-message-edit">
          <textarea
            className="mk-textarea mk-message-edit-input"
            value={editDraft}
            onChange={(e) => onEditDraft(e.target.value)}
            aria-label="Edit thread item"
            autoFocus
          />
          <div className="mk-message-edit-actions">
            <Button small onClick={onSaveEdit} disabled={editDraft.trim().length === 0}>
              Save
            </Button>
            <Button variant="ghost" small onClick={onCancelEdit}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className={root ? 'mk-thread-root-body' : 'mk-message-body'}>{event.body}</div>
          <div className="mk-post-reactions">
            {reactions.map((group) => (
              <button
                key={group.emoji}
                type="button"
                className={`mk-chat-reaction-chip ${group.mine ? 'is-mine' : ''}`}
                aria-pressed={group.mine}
                aria-label={`${group.emoji} ${group.count}${group.mine ? ', including you. Click to remove.' : '. Click to add.'}`}
                onClick={() => onToggleReaction(event.id, group.emoji, event.postId)}
              >
                <span className="mk-chat-reaction-emoji">{group.emoji}</span>
                <span className="mk-chat-reaction-count">{group.count}</span>
              </button>
            ))}
            {/* Archived (read-only) channels keep chips visible but offer no add affordance. */}
            {readOnly ? null : (
            <div className="mk-post-react-add-host">
              <button
                type="button"
                className="mk-chat-reaction-chip mk-post-react-add"
                aria-label="Add a reaction"
                aria-expanded={pickerOpen}
                onClick={() => setPickerOpen((v) => !v)}
              >
                + 🙂
              </button>
              {pickerOpen ? (
                <div className="mk-chat-picker-pop">
                  <div className="mk-post-quickreacts">
                    {QUICK_REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="mk-chat-hover-btn"
                        aria-label={`React with ${emoji}`}
                        onClick={() => { setPickerOpen(false); onToggleReaction(event.id, emoji, event.postId); }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  <EmojiPicker
                    onSelect={(emoji) => { setPickerOpen(false); onToggleReaction(event.id, emoji, event.postId); }}
                    onClose={() => setPickerOpen(false)}
                  />
                </div>
              ) : null}
            </div>
            )}
          </div>
          <div className="mk-thread-actions">
            {onReply ? (
              <Button variant="ghost" small onClick={() => onReply(event)}>
                Reply
              </Button>
            ) : null}
            {isOwn && !readOnly ? (
              <>
                <Button variant="ghost" small onClick={() => onBeginEdit(event)}>
                  Edit
                </Button>
                <Button variant="ghost" small onClick={() => onDelete(event)}>
                  Delete
                </Button>
              </>
            ) : null}
            {!isOwn && onReport ? (
              <Button variant="danger" small onClick={() => onReport(event)}>
                Report
              </Button>
            ) : null}
          </div>
        </>
      )}
    </article>
  );
}
