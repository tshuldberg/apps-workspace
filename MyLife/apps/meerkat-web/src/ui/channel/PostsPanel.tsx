import { useMemo, useState } from 'react';
import { canvasPostBody, createCanvasPostCanvas, parseCanvasPostBody } from '../../lib/canvas-core';
import { createCommunityAudienceRule } from '@mylife/sync';
import { useMeerkat } from '../../lib/MeerkatProvider';
import type { ChannelPostCard, MessageReactionGroup } from '../../lib/meerkat-data';
import { useView } from '../navigation/useView';
import { AudienceBadge } from '../audience/AudienceRule';
import { Button } from '../shell/Button';
import { formatWhen } from '../format';
import { EmojiPicker } from './EmojiPicker';
import { QUICK_REACTIONS } from './emoji-data';

const EMPTY_REACTIONS: readonly MessageReactionGroup[] = Object.freeze([]);

export function PostsPanel({
  communityId,
  channelId,
  posts,
  resolveName,
  onOpenPost,
  getReactions,
  onToggleReaction,
  composerHidden = false,
}: {
  communityId: string;
  channelId: string;
  posts: ChannelPostCard[];
  resolveName: (deviceId: string) => string;
  onOpenPost: (postId: string) => void;
  /** Reaction groups keyed by the reacted-to event id (the post root id). */
  getReactions?: (id: string) => readonly MessageReactionGroup[];
  /** Toggle a reaction on the post root (rides the same react/removeReaction path). */
  onToggleReaction?: (eventId: string, emoji: string, postId: string) => void;
  /** True for an archived (read-only) channel: posts render, the composer does not. */
  composerHidden?: boolean;
}): React.ReactElement {
  const m = useMeerkat();
  const { dispatch } = useView();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const audienceRule = useMemo(() => createCommunityAudienceRule(communityId), [communityId]);
  const canPost = body.trim().length > 0;
  const myRole = m.listCommunities().find((c) => c.communityId === communityId)?.myRole ?? null;
  const canPublishPublic = myRole === 'owner' || myRole === 'admin';

  const send = (): void => {
    const result = m.sendChannelPost(communityId, channelId, body);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setBody('');
  };

  // 4.5: a canvas post. The canvas exists FIRST (author-signed, kind 'post');
  // the post root carries only the deterministic token, and the thread renders
  // the canvas through CanvasHost. Opens the thread so the author decorates
  // immediately.
  const sendCanvasPost = (): void => {
    try {
      const canvas = createCanvasPostCanvas(m.db, m.identity, communityId, m.recordLocalChange);
      const result = m.sendChannelPost(communityId, channelId, canvasPostBody(canvas.id));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      void m.db.flush().catch(() => undefined);
      setError(null);
      const postId = result.event?.postId;
      if (postId) onOpenPost(postId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create a canvas post.');
    }
  };

  const reportPost = (post: ChannelPostCard): void => {
    const ok = window.confirm(
      'Report and hide this post? This hides the post on this device and adds it to local owner review.',
    );
    if (!ok) return;
    m.reportCommunityContent({
      communityId,
      channelId,
      targetKind: 'post',
      targetId: post.postId,
      targetAuthorDeviceId: post.root.authorDeviceId,
      targetLabel: `Post from ${resolveName(post.root.authorDeviceId)}`,
      reason: 'Reported from channel',
    });
  };

  return (
    <section className="mk-posts-panel" aria-label="Channel posts">
      <div className="mk-section-head">
        <div>
          <h2>Posts</h2>
          <p>Threads in this community channel.</p>
        </div>
      </div>
      {composerHidden ? null : (
      <div className="mk-post-composer">
        {/* Plan 30 mobile parity: the ONE channel header audience line covers this;
            the per-composer AudienceRuleSummary is removed (mobile dropped all). */}
        {error ? <div className="mk-box is-error" role="alert">{error}</div> : null}
        <textarea
          className="mk-textarea mk-post-input"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Start a post"
          aria-label="Post body"
        />
        <div className="mk-post-composer-actions">
          <Button onClick={send} disabled={!canPost}>
            Post
          </Button>
          <Button variant="ghost" onClick={sendCanvasPost}>
            Canvas post
          </Button>
        </div>
      </div>
      )}
      {posts.length === 0 ? (
        <p className="mk-muted mk-post-empty">No posts in this channel yet.</p>
      ) : (
        <div className="mk-post-card-list">
          {posts.map((post) => (
            <div key={post.postId} className="mk-post-card">
              <button
                type="button"
                className="mk-post-card-main"
                onClick={() => onOpenPost(post.postId)}
              >
                <span className="mk-post-card-head">
                  <span className="mk-post-author">{resolveName(post.root.authorDeviceId)}</span>
                  <AudienceBadge rule={audienceRule} />
                </span>
                <span className="mk-post-body">{parseCanvasPostBody(post.root.body) ? 'A freeform canvas post. Open it to see the canvas.' : post.root.body}</span>
                <span className="mk-post-meta">
                  <span>
                    {post.replyCount === 0
                      ? 'No replies yet'
                      : `${post.replyCount} repl${post.replyCount === 1 ? 'y' : 'ies'}`}
                  </span>
                  <span>Last activity {formatWhen(post.lastActivity.wall)}</span>
                </span>
              </button>
              {getReactions && onToggleReaction ? (
                <div className="mk-post-reactions">
                  {(getReactions(post.root.id) ?? EMPTY_REACTIONS).map((group) => (
                    <button
                      key={group.emoji}
                      type="button"
                      className={`mk-chat-reaction-chip ${group.mine ? 'is-mine' : ''}`}
                      aria-pressed={group.mine}
                      aria-label={`${group.emoji} ${group.count}${group.mine ? ', including you. Click to remove.' : '. Click to add.'}`}
                      onClick={() => onToggleReaction(post.root.id, group.emoji, post.postId)}
                    >
                      <span className="mk-chat-reaction-emoji">{group.emoji}</span>
                      <span className="mk-chat-reaction-count">{group.count}</span>
                    </button>
                  ))}
                  {/* Archived (read-only) channels keep chips visible but offer no add affordance. */}
                  {composerHidden ? null : (
                  <div className="mk-post-react-add-host">
                    <button
                      type="button"
                      className="mk-chat-reaction-chip mk-post-react-add"
                      aria-label="Add a reaction"
                      aria-expanded={pickerFor === post.postId}
                      onClick={() => setPickerFor((v) => (v === post.postId ? null : post.postId))}
                    >
                      + 🙂
                    </button>
                    {pickerFor === post.postId ? (
                      <div className="mk-chat-picker-pop">
                        <div className="mk-post-quickreacts">
                          {QUICK_REACTIONS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              className="mk-chat-hover-btn"
                              aria-label={`React with ${emoji}`}
                              onClick={() => { setPickerFor(null); onToggleReaction(post.root.id, emoji, post.postId); }}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                        <EmojiPicker
                          onSelect={(emoji) => { setPickerFor(null); onToggleReaction(post.root.id, emoji, post.postId); }}
                          onClose={() => setPickerFor(null)}
                        />
                      </div>
                    ) : null}
                  </div>
                  )}
                </div>
              ) : null}
              <div className="mk-post-card-actions">
                {canPublishPublic ? (
                  <button
                    type="button"
                    className="mk-inline-publish"
                    onClick={() =>
                      dispatch({
                        type: 'OPEN_OVERLAY',
                        overlay: { kind: 'publish', communityId, channelId, postId: post.postId },
                      })
                    }
                  >
                    Publish publicly
                  </button>
                ) : null}
                {post.root.authorDeviceId !== m.identity.publicKey ? (
                  <button type="button" className="mk-inline-report" onClick={() => reportPost(post)}>
                    Report
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
