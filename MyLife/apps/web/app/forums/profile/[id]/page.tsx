'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  fetchCommunitiesForProfile,
  fetchProfile,
  fetchRepliesByAuthor,
  fetchThreadsByAuthor,
} from '../../actions';
import {
  Avatar,
  EmptyState,
  GlassCard,
  HumanVerifiedChip,
  SectionIntro,
  SurfaceCard,
} from '../../components';
import {
  TOKENS,
  chipStyle,
  formatCount,
  formatRelativeTime,
} from '../../ui';

interface ProfileRow {
  id: string;
  displayName: string;
  username: string;
  bio: string;
  karma: number;
  threadCount: number;
  replyCount: number;
  communitiesJoined: number;
  isVerified: boolean | number;
  statusEmoji: string;
  statusText: string;
  location: string;
  websiteUrl: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
}

interface ThreadRow {
  id: string;
  title: string;
  body: string;
  voteScore: number;
  replyCount: number;
  createdAt: string;
}

interface ReplyRow {
  id: string;
  threadId: string;
  body: string;
  voteScore: number;
  createdAt: string;
  threadTitle: string | null;
}

interface CommunityRow {
  id: string;
  displayName: string;
  description: string | null;
}

type TabKey = 'posts' | 'replies' | 'communities';

export default function UserProfilePage() {
  const params = useParams<{ id: string }>();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [replies, setReplies] = useState<ReplyRow[]>([]);
  const [communities, setCommunities] = useState<CommunityRow[]>([]);
  const [tab, setTab] = useState<TabKey>('posts');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profileResult = await fetchProfile(params.id);
        if (!profileResult) {
          if (!cancelled) setError('Profile not found.');
          return;
        }
        const [threadResult, replyResult, communityResult] = await Promise.all([
          fetchThreadsByAuthor(params.id),
          fetchRepliesByAuthor(params.id),
          fetchCommunitiesForProfile(params.id),
        ]);
        if (cancelled) return;
        setProfile((profileResult as ProfileRow) ?? null);
        setThreads((threadResult as ThreadRow[]) ?? []);
        setReplies((replyResult as ReplyRow[]) ?? []);
        setCommunities((communityResult as CommunityRow[]) ?? []);
      } catch {
        if (!cancelled) setError('Could not load this profile.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const stats = useMemo(
    () => [
      { label: 'Karma', value: formatCount(profile?.karma ?? 0) },
      { label: 'Threads', value: formatCount(profile?.threadCount ?? 0) },
      { label: 'Replies', value: formatCount(profile?.replyCount ?? 0) },
      { label: 'Communities', value: formatCount(profile?.communitiesJoined ?? 0) },
    ],
    [profile],
  );

  if (loading) {
    return <GlassCard style={{ minHeight: 420, animation: 'pulse 1.5s ease-in-out infinite' }} />;
  }

  if (error || !profile) {
    return (
      <EmptyState
        icon="person"
        title="Profile unavailable"
        description={error ?? 'This profile could not be loaded.'}
        actionHref="/forums"
        actionLabel="Return to feed"
      />
    );
  }

  return (
    <div className="forums-page-stack">
      <div
        style={{
          height: 220,
          borderRadius: 36,
          background: profile.bannerUrl
            ? `url(${profile.bannerUrl}) center / cover`
            : 'linear-gradient(135deg, rgba(124,77,255,0.36), rgba(201,137,77,0.3), rgba(14,14,19,0.92))',
        }}
      />

      <div style={{ marginTop: -88, padding: '0 24px' }}>
        <GlassCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', gap: 18, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <Avatar label={profile.displayName} size={112} imageUrl={profile.avatarUrl} />
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'grid', gap: 8 }}>
                  <div className="forums-chip-row">
                    <HumanVerifiedChip karma={profile.karma} isVerified={profile.isVerified} />
                    {profile.statusText ? <span style={statusPillStyle}>{profile.statusEmoji} {profile.statusText}</span> : null}
                  </div>
                  <h1 style={{ margin: 0, fontSize: 38, lineHeight: 1.04, fontWeight: 800, letterSpacing: '-0.05em' }}>
                    {profile.displayName}
                  </h1>
                  <span style={{ color: TOKENS.textTertiary, fontSize: 14 }}>@{profile.username}</span>
                </div>
                <p style={{ margin: 0, color: TOKENS.textSecondary, maxWidth: 760, lineHeight: 1.7 }}>
                  {profile.bio || 'This curator has not added a bio yet.'}
                </p>
                <div className="forums-chip-row">
                  {profile.location ? <span style={metaPillStyle}>{profile.location}</span> : null}
                  {profile.websiteUrl ? (
                    <a href={profile.websiteUrl} target="_blank" rel="noreferrer" style={externalLinkStyle}>
                      Website
                    </a>
                  ) : null}
                  <Link href="/forums/messages/new" style={externalLinkStyle}>
                    Message
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="forums-four-up" style={{ marginTop: 24 }}>
            {stats.map((stat) => (
              <div key={stat.label} style={{ padding: 18, borderRadius: 22, background: 'rgba(255,255,255,0.05)', display: 'grid', gap: 6 }}>
                <span style={{ color: TOKENS.textTertiary, fontSize: 11, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                  {stat.label}
                </span>
                <strong style={{ fontSize: 24 }}>{stat.value}</strong>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <SectionIntro
        eyebrow="Profile content"
        title="Posts, replies, and communities"
        description="Desktop profile tabs widen the content grid, but keep the same trust-first hierarchy as mobile profile variant one."
      />

      <div className="forums-chip-row">
        {([
          ['posts', 'Posts'],
          ['replies', 'Replies'],
          ['communities', 'Communities'],
        ] as const).map(([value, label]) => (
          <button key={value} type="button" onClick={() => setTab(value)} style={chipStyle(tab === value, value === 'communities' ? 'trust' : 'neutral')}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'posts' ? (
        threads.length === 0 ? (
          <EmptyState icon="forum" title="No posts yet" description="Thread posts from this profile will appear here once they are cached." />
        ) : (
          <div className="forums-two-up">
            {threads.map((thread) => (
              <SurfaceCard key={thread.id} style={{ display: 'grid', gap: 10 }}>
                <Link href={`/forums/thread/${thread.id}`} style={{ color: TOKENS.text, textDecoration: 'none' }}>
                  <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>{thread.title}</h2>
                </Link>
                <p style={{ margin: 0, color: TOKENS.textSecondary, lineHeight: 1.65 }}>{thread.body}</p>
                <span style={{ color: TOKENS.textTertiary, fontSize: 12 }}>
                  {formatRelativeTime(thread.createdAt)} · {thread.replyCount} replies · {thread.voteScore} votes
                </span>
              </SurfaceCard>
            ))}
          </div>
        )
      ) : null}

      {tab === 'replies' ? (
        replies.length === 0 ? (
          <EmptyState icon="reply" title="No replies yet" description="When this curator joins discussions, reply cards appear here." />
        ) : (
          <div className="forums-two-up">
            {replies.map((reply) => (
              <SurfaceCard key={reply.id} style={{ display: 'grid', gap: 10 }}>
                <Link href={`/forums/thread/${reply.threadId}`} style={{ color: TOKENS.primaryLight, textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>
                  In {reply.threadTitle ?? 'thread'}
                </Link>
                <p style={{ margin: 0, color: TOKENS.textSecondary, lineHeight: 1.65 }}>{reply.body}</p>
                <span style={{ color: TOKENS.textTertiary, fontSize: 12 }}>
                  {formatRelativeTime(reply.createdAt)} · {reply.voteScore} votes
                </span>
              </SurfaceCard>
            ))}
          </div>
        )
      ) : null}

      {tab === 'communities' ? (
        communities.length === 0 ? (
          <EmptyState icon="groups" title="No communities yet" description="Joined communities will appear here once the membership cache is populated." />
        ) : (
          <div className="forums-three-up">
            {communities.map((community) => (
              <SurfaceCard key={community.id} style={{ display: 'grid', gap: 10 }}>
                <Link href={`/forums/community/${community.id}`} style={{ color: TOKENS.text, textDecoration: 'none' }}>
                  <strong style={{ fontSize: 18 }}>{community.displayName}</strong>
                </Link>
                <p style={{ margin: 0, color: TOKENS.textSecondary, lineHeight: 1.65 }}>
                  {community.description ?? 'Focused community discussion.'}
                </p>
              </SurfaceCard>
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}

const statusPillStyle = {
  padding: '8px 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.05)',
  color: TOKENS.textSecondary,
  fontSize: 12,
  fontWeight: 700,
} as const;

const metaPillStyle = {
  padding: '8px 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.05)',
  color: TOKENS.textSecondary,
  fontSize: 12,
  fontWeight: 700,
} as const;

const externalLinkStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 36,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.05)',
  color: TOKENS.textSecondary,
  textDecoration: 'none',
  fontSize: 12,
  fontWeight: 700,
} as const;
