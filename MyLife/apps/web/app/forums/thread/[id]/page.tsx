'use client';

import { startTransition, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  castVoteAction,
  createReplyAction,
  fetchCommunityById,
  fetchProfilesByIds,
  fetchReplies,
  fetchThreadById,
  fetchThreads,
  toggleBookmarkAction,
} from '../../actions';
import {
  Avatar,
  GlassCard,
  HumanVerifiedChip,
  MaterialSymbol,
  SurfaceCard,
} from '../../components';
import {
  TOKENS,
  chipStyle,
  formatCount,
  formatRelativeTime,
  gradientButtonStyle,
  inputStyle,
  textareaStyle,
} from '../../ui';

interface ThreadRow {
  id: string;
  communityId: string;
  authorId: string;
  title: string;
  body: string;
  voteScore: number;
  replyCount: number;
  viewCount: number;
  createdAt: string;
  isPinned: boolean | number;
}

interface ReplyRow {
  id: string;
  threadId: string;
  parentReplyId: string | null;
  authorId: string;
  body: string;
  voteScore: number;
  depth: number;
  createdAt: string;
}

interface CommunityRow {
  id: string;
  displayName: string;
  description: string | null;
  humansOnly: boolean | number;
  memberCount: number;
  threadCount: number;
}

interface ProfileRow {
  id: string;
  displayName: string;
  username: string;
  karma: number;
  isVerified: boolean | number;
  avatarUrl: string | null;
}

type ReplySort = 'best' | 'top' | 'new' | 'old';

export default function ThreadDetailPage() {
  const params = useParams<{ id: string }>();
  const [thread, setThread] = useState<ThreadRow | null>(null);
  const [community, setCommunity] = useState<CommunityRow | null>(null);
  const [replies, setReplies] = useState<ReplyRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [relatedThreads, setRelatedThreads] = useState<ThreadRow[]>([]);
  const [replyDraft, setReplyDraft] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replySort, setReplySort] = useState<ReplySort>('best');
  const [bookmarked, setBookmarked] = useState(false);
  const [threadVote, setThreadVote] = useState<'up' | 'down' | null>(null);
  const [replyVotes, setReplyVotes] = useState<Record<string, 'up' | 'down' | null>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const threadResult = await fetchThreadById(params.id);
        if (!threadResult) {
          if (!cancelled) setError('Thread not found.');
          return;
        }
        const nextThread = threadResult as ThreadRow;
        const [communityResult, replyResult, relatedResult] = await Promise.all([
          fetchCommunityById(nextThread.communityId),
          fetchReplies(nextThread.id),
          fetchThreads(nextThread.communityId, { sort: 'hot', limit: 8 }),
        ]);
        const nextReplies = (replyResult as ReplyRow[]) ?? [];
        const authorIds = Array.from(new Set([nextThread.authorId, ...nextReplies.map((reply) => reply.authorId)]));
        const profileRows = (await fetchProfilesByIds(authorIds)) as ProfileRow[];
        const profileMap = Object.fromEntries(profileRows.map((profile) => [profile.id, profile]));
        if (cancelled) return;
        startTransition(() => {
          setThread(nextThread);
          setCommunity((communityResult as CommunityRow) ?? null);
          setReplies(nextReplies);
          setProfiles(profileMap);
          setRelatedThreads(
            ((relatedResult as ThreadRow[]) ?? []).filter((entry) => entry.id !== nextThread.id).slice(0, 4),
          );
        });
      } catch {
        if (!cancelled) setError('Could not load this thread.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const sortedReplies = useMemo(() => {
    const next = [...replies];
    next.sort((left, right) => {
      if (replySort === 'new') return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      if (replySort === 'old') return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
      return right.voteScore - left.voteScore || new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    });
    return next;
  }, [replies, replySort]);

  const replyTree = useMemo(() => {
    const children = new Map<string, ReplyRow[]>();
    for (const reply of sortedReplies) {
      if (!reply.parentReplyId) continue;
      const current = children.get(reply.parentReplyId) ?? [];
      current.push(reply);
      children.set(reply.parentReplyId, current);
    }
    return children;
  }, [sortedReplies]);

  async function voteOnThread(direction: 'up' | 'down') {
    if (!thread) return;
    const previous = threadVote;
    const next = previous === direction ? null : direction;
    const delta =
      next == null
        ? previous === 'up'
          ? -1
          : 1
        : previous == null
          ? direction === 'up'
            ? 1
            : -1
          : direction === 'up'
            ? 2
            : -2;
    setThreadVote(next);
    setThread({ ...thread, voteScore: thread.voteScore + delta });
    try {
      await castVoteAction('thread', thread.id, direction);
    } catch {
      setThreadVote(previous);
      setThread({ ...thread, voteScore: thread.voteScore });
    }
  }

  async function voteOnReply(replyId: string, direction: 'up' | 'down') {
    const previous = replyVotes[replyId] ?? null;
    const next = previous === direction ? null : direction;
    const delta =
      next == null
        ? previous === 'up'
          ? -1
          : 1
        : previous == null
          ? direction === 'up'
            ? 1
            : -1
          : direction === 'up'
            ? 2
            : -2;
    setReplyVotes((current) => ({ ...current, [replyId]: next }));
    setReplies((current) =>
      current.map((reply) =>
        reply.id === replyId ? { ...reply, voteScore: reply.voteScore + delta } : reply,
      ),
    );
    try {
      await castVoteAction('reply', replyId, direction);
    } catch {
      setReplyVotes((current) => ({ ...current, [replyId]: previous }));
    }
  }

  async function handleSubmitReply() {
    if (!thread || !replyDraft.trim()) return;
    setSubmitting(true);
    try {
      const created = (await createReplyAction({
        threadId: thread.id,
        body: replyDraft.trim(),
        parentReplyId: replyTo ?? undefined,
      })) as ReplyRow;
      setReplies((current) => [created, ...current]);
      setThread((current) => (current ? { ...current, replyCount: current.replyCount + 1 } : current));
      setReplyDraft('');
      setReplyTo(null);
    } catch {
      setError('Reply could not be posted.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="forums-detail-grid">
        <GlassCard style={{ minHeight: 480, animation: 'pulse 1.5s ease-in-out infinite' }} />
        <GlassCard style={{ minHeight: 320, animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
    );
  }

  if (error || !thread) {
    return (
      <GlassCard>
        <div style={{ display: 'grid', gap: 12, maxWidth: 460 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>Missing thread</h1>
          <p style={{ margin: 0, color: TOKENS.textSecondary, lineHeight: 1.6 }}>
            {error ?? 'This thread is no longer available.'}
          </p>
          <Link href="/forums" style={{ ...gradientButtonStyle, textDecoration: 'none' }}>
            Back to feed
          </Link>
        </div>
      </GlassCard>
    );
  }

  const author = profiles[thread.authorId];

  return (
    <div className="forums-detail-grid">
      <div style={{ display: 'grid', gap: 20 }}>
        <Link href={community ? `/forums/community/${community.id}` : '/forums'} style={{ color: TOKENS.textSecondary, textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>
          ← Back to {community?.displayName ?? 'feed'}
        </Link>

        <SurfaceCard style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '72px minmax(0, 1fr)' }}>
            <div
              style={{
                display: 'grid',
                justifyItems: 'center',
                alignContent: 'start',
                gap: 8,
                padding: '28px 18px',
                background: 'rgba(255,255,255,0.03)',
              }}
            >
              <button type="button" onClick={() => void voteOnThread('up')} style={voteButtonStyle(threadVote === 'up', TOKENS.upvote)}>
                <MaterialSymbol name="stat_3" filled={threadVote === 'up'} size={18} color={threadVote === 'up' ? TOKENS.upvote : TOKENS.textTertiary} />
              </button>
              <strong style={{ fontSize: 20, color: thread.voteScore > 0 ? TOKENS.upvote : thread.voteScore < 0 ? TOKENS.downvote : TOKENS.text }}>
                {formatCount(thread.voteScore)}
              </strong>
              <button type="button" onClick={() => void voteOnThread('down')} style={voteButtonStyle(threadVote === 'down', TOKENS.downvote)}>
                <MaterialSymbol name="stat_3" filled={threadVote === 'down'} size={18} color={threadVote === 'down' ? TOKENS.downvote : TOKENS.textTertiary} style={{ transform: 'rotate(180deg)' }} />
              </button>
            </div>

            <div style={{ padding: 30, display: 'grid', gap: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div style={{ display: 'grid', gap: 14 }}>
                  <div className="forums-chip-row">
                    {community ? (
                      <span style={communityPillStyle}>
                        {community.displayName}
                      </span>
                    ) : null}
                    {thread.isPinned ? <span style={chipStyle(true)}>Pinned</span> : null}
                    {community?.humansOnly ? <span style={chipStyle(true, 'trust')}>Humans Only</span> : null}
                  </div>
                  <h1 style={{ margin: 0, fontSize: 44, lineHeight: 1.04, fontWeight: 800, letterSpacing: '-0.05em' }}>
                    {thread.title}
                  </h1>
                </div>

                <div style={{ display: 'grid', gap: 10, justifyItems: 'end' }}>
                  <button
                    type="button"
                    onClick={async () => {
                      const next = !bookmarked;
                      setBookmarked(next);
                      try {
                        await toggleBookmarkAction(thread.id);
                      } catch {
                        setBookmarked(!next);
                      }
                    }}
                    style={bookmarkButtonStyle(bookmarked)}
                  >
                    <MaterialSymbol name="bookmark" size={18} color={bookmarked ? '#2E1600' : TOKENS.primaryLight} filled={bookmarked} />
                    {bookmarked ? 'Archived' : 'Archive'}
                  </button>
                  <span style={{ color: TOKENS.textTertiary, fontSize: 12 }}>{thread.viewCount} views</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <Avatar label={author?.displayName ?? 'Curator'} size={44} imageUrl={author?.avatarUrl} />
                <div style={{ display: 'grid', gap: 4 }}>
                  <strong>{author?.displayName ?? 'Curator'}</strong>
                  <span style={{ color: TOKENS.textTertiary, fontSize: 12 }}>
                    @{author?.username ?? 'unknown'} · {formatRelativeTime(thread.createdAt)}
                  </span>
                </div>
                {author ? <HumanVerifiedChip karma={author.karma} isVerified={author.isVerified} compact /> : null}
              </div>

              <div className="forums-rich-markdown" style={{ color: TOKENS.textSecondary, fontSize: 16, lineHeight: 1.8 }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{thread.body}</ReactMarkdown>
              </div>

              <div className="forums-chip-row">
                <span style={metaPillStyle}>
                  <MaterialSymbol name="forum" size={16} color={TOKENS.primaryLight} />
                  {thread.replyCount} replies
                </span>
                <span style={metaPillStyle}>
                  <MaterialSymbol name="visibility" size={16} color={TOKENS.primaryLight} />
                  {thread.viewCount} views
                </span>
              </div>
            </div>
          </div>
        </SurfaceCard>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <span style={{ color: TOKENS.primary, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 800 }}>
              Replies
            </span>
            <h2 style={{ margin: '6px 0 0', fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>
              {thread.replyCount} responses
            </h2>
          </div>
          <div className="forums-chip-row">
            {(['best', 'top', 'new', 'old'] as ReplySort[]).map((value) => (
              <button key={value} type="button" onClick={() => setReplySort(value)} style={chipStyle(replySort === value, value === 'best' ? 'gold' : 'neutral')}>
                {value}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 18 }}>
          {sortedReplies.length === 0 ? (
            <GlassCard>
              <p style={{ margin: 0, color: TOKENS.textSecondary, lineHeight: 1.65 }}>
                No replies yet. Start the thread beneath the main post.
              </p>
            </GlassCard>
          ) : (
            sortedReplies
              .filter((reply) => !reply.parentReplyId)
              .map((reply) => (
                <ReplyNode
                  key={reply.id}
                  reply={reply}
                  profiles={profiles}
                  childrenMap={replyTree}
                  onVote={voteOnReply}
                  onReply={setReplyTo}
                  voteState={replyVotes}
                />
              ))
          )}
        </div>

        <div className="forums-sticky-composer">
          <GlassCard>
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'grid', gap: 4 }}>
                  <strong style={{ fontSize: 18 }}>Reply composer</strong>
                  <span style={{ color: TOKENS.textTertiary, fontSize: 12 }}>
                    {replyTo ? 'Replying to a nested comment.' : 'Respond to the original post.'}
                  </span>
                </div>
                {replyTo ? (
                  <button type="button" onClick={() => setReplyTo(null)} style={chipStyle(false, 'neutral')}>
                    Cancel reply
                  </button>
                ) : null}
              </div>

              <textarea
                value={replyDraft}
                onChange={(event) => setReplyDraft(event.target.value)}
                placeholder="Add your reply with markdown support..."
                style={textareaStyle}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <div className="forums-chip-row">
                  <span style={metaPillStyle}>
                    <MaterialSymbol name="markdown" size={16} color={TOKENS.primaryLight} />
                    Markdown
                  </span>
                  <span style={metaPillStyle}>
                    <MaterialSymbol name="attach_file" size={16} color={TOKENS.primaryLight} />
                    Attachments soon
                  </span>
                </div>
                <button type="button" onClick={() => void handleSubmitReply()} disabled={submitting || !replyDraft.trim()} style={submitButtonStyle(submitting || !replyDraft.trim())}>
                  {submitting ? 'Posting…' : 'Send reply'}
                </button>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        <GlassCard className="forums-sidebar-card">
          <div style={{ display: 'grid', gap: 18 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <span style={{ color: TOKENS.primary, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 800 }}>
                About this thread
              </span>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' }}>Context</h2>
            </div>
            <p style={{ margin: 0, color: TOKENS.textSecondary, lineHeight: 1.65 }}>
              {community?.description ?? 'This thread lives inside a community that values slower, human-verifiable discussion.'}
            </p>
            <div style={{ display: 'grid', gap: 10 }}>
              <span style={sideLabelStyle}>Participants</span>
              {Object.values(profiles).slice(0, 5).map((profile) => (
                <div key={profile.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar label={profile.displayName} size={34} imageUrl={profile.avatarUrl} />
                  <div style={{ display: 'grid', gap: 2 }}>
                    <strong style={{ fontSize: 13 }}>{profile.displayName}</strong>
                    <span style={{ color: TOKENS.textTertiary, fontSize: 12 }}>@{profile.username}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div style={{ display: 'grid', gap: 14 }}>
            <span style={sideLabelStyle}>Related threads</span>
            {relatedThreads.length === 0 ? (
              <p style={{ margin: 0, color: TOKENS.textSecondary, lineHeight: 1.65 }}>
                More related reading appears here once the community has additional active threads.
              </p>
            ) : (
              relatedThreads.map((entry) => (
                <Link key={entry.id} href={`/forums/thread/${entry.id}`} style={{ textDecoration: 'none', color: TOKENS.text }}>
                  <div style={{ display: 'grid', gap: 6, padding: 14, borderRadius: 20, background: 'rgba(255,255,255,0.04)' }}>
                    <strong style={{ fontSize: 14 }}>{entry.title}</strong>
                    <span style={{ color: TOKENS.textTertiary, fontSize: 12 }}>
                      {formatRelativeTime(entry.createdAt)} · {entry.replyCount} replies
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function ReplyNode({
  reply,
  profiles,
  childrenMap,
  voteState,
  onVote,
  onReply,
}: {
  reply: ReplyRow;
  profiles: Record<string, ProfileRow>;
  childrenMap: Map<string, ReplyRow[]>;
  voteState: Record<string, 'up' | 'down' | null>;
  onVote: (replyId: string, direction: 'up' | 'down') => Promise<void>;
  onReply: (replyId: string) => void;
}) {
  const author = profiles[reply.authorId];
  const children = childrenMap.get(reply.id) ?? [];
  return (
    <div style={{ marginLeft: Math.min(reply.depth, 5) * 28, display: 'grid', gap: 14 }}>
      <SurfaceCard style={{ padding: 20 }}>
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Avatar label={author?.displayName ?? 'Curator'} size={38} imageUrl={author?.avatarUrl} />
              <div style={{ display: 'grid', gap: 4 }}>
                <strong style={{ fontSize: 14 }}>{author?.displayName ?? 'Curator'}</strong>
                <span style={{ color: TOKENS.textTertiary, fontSize: 12 }}>{formatRelativeTime(reply.createdAt)}</span>
              </div>
            </div>
            {author ? <HumanVerifiedChip compact karma={author.karma} isVerified={author.isVerified} /> : null}
          </div>
          <div className="forums-rich-markdown" style={{ color: TOKENS.textSecondary, lineHeight: 1.7 }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{reply.body}</ReactMarkdown>
          </div>
          <div className="forums-chip-row">
            <button type="button" onClick={() => void onVote(reply.id, 'up')} style={voteButtonStyle(voteState[reply.id] === 'up', TOKENS.upvote)}>
              <MaterialSymbol name="thumb_up" size={16} color={voteState[reply.id] === 'up' ? TOKENS.upvote : TOKENS.textTertiary} filled={voteState[reply.id] === 'up'} />
              {formatCount(reply.voteScore)}
            </button>
            <button type="button" onClick={() => void onVote(reply.id, 'down')} style={voteButtonStyle(voteState[reply.id] === 'down', TOKENS.downvote)}>
              <MaterialSymbol name="thumb_down" size={16} color={voteState[reply.id] === 'down' ? TOKENS.downvote : TOKENS.textTertiary} filled={voteState[reply.id] === 'down'} />
            </button>
            <button type="button" onClick={() => onReply(reply.id)} style={replyActionStyle}>
              <MaterialSymbol name="reply" size={16} color={TOKENS.primaryLight} />
              Reply
            </button>
          </div>
        </div>
      </SurfaceCard>

      {children.length > 0 ? (
        <div style={{ display: 'grid', gap: 14 }}>
          {children.map((child) => (
            <ReplyNode
              key={child.id}
              reply={child}
              profiles={profiles}
              childrenMap={childrenMap}
              voteState={voteState}
              onVote={onVote}
              onReply={onReply}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

const communityPillStyle = {
  padding: '7px 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.05)',
  color: TOKENS.primaryLight,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
} as const;

const metaPillStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 14px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.05)',
  color: TOKENS.textSecondary,
  fontSize: 13,
  fontWeight: 700,
} as const;

const sideLabelStyle = {
  color: TOKENS.textTertiary,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
} as const;

function voteButtonStyle(active: boolean, color: string) {
  return {
    border: 'none',
    borderRadius: 999,
    background: active ? `${color}22` : 'rgba(255,255,255,0.04)',
    color,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 36,
    padding: '0 12px',
    cursor: 'pointer',
    fontWeight: 700,
  } as const;
}

function bookmarkButtonStyle(active: boolean) {
  return {
    border: 'none',
    borderRadius: 999,
    minHeight: 40,
    padding: '0 14px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: active ? `linear-gradient(135deg, ${TOKENS.primaryLight}, ${TOKENS.primary})` : 'rgba(255,255,255,0.05)',
    color: active ? '#2E1600' : TOKENS.textSecondary,
    cursor: 'pointer',
    fontWeight: 800,
  } as const;
}

function submitButtonStyle(disabled: boolean) {
  return {
    ...gradientButtonStyle,
    opacity: disabled ? 0.48 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
  } as const;
}

const replyActionStyle = {
  border: 'none',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.05)',
  color: TOKENS.textSecondary,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  minHeight: 36,
  padding: '0 12px',
  cursor: 'pointer',
  fontWeight: 700,
} as const;
