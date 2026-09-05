'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  fetchBookmarks,
  fetchCommunityById,
  fetchProfilesByIds,
  fetchThreadById,
  toggleBookmarkAction,
} from '../actions';
import {
  DesktopThreadCard,
  EmptyState,
  GlassCard,
  SectionIntro,
} from '../components';
import { TOKENS, chipStyle, gradientButtonStyle, truncate } from '../ui';

interface SavedThread {
  bookmarkId: string;
  threadId: string;
  title: string;
  body: string;
  voteScore: number;
  replyCount: number;
  createdAt: string;
  viewCount: number;
  communityId: string;
  authorId: string;
}

interface CommunityRow {
  id: string;
  displayName: string;
}

interface ProfileRow {
  id: string;
  displayName: string;
  karma: number;
  isVerified: boolean | number;
}

type FilterMode = 'all' | 'recent' | 'high-score';

export default function SavedPage() {
  const [items, setItems] = useState<SavedThread[]>([]);
  const [communities, setCommunities] = useState<Record<string, CommunityRow>>({});
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [filter, setFilter] = useState<FilterMode>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const bookmarks = await fetchBookmarks();
        const resolved = await Promise.all(
          bookmarks.map(async (bookmark) => {
            const thread = await fetchThreadById(bookmark.threadId);
            if (!thread) return null;
            return {
              bookmarkId: bookmark.id,
              threadId: thread.id,
              title: thread.title,
              body: thread.body,
              voteScore: thread.voteScore,
              replyCount: thread.replyCount,
              createdAt: thread.createdAt,
              viewCount: thread.viewCount,
              communityId: thread.communityId,
              authorId: thread.authorId,
            } satisfies SavedThread;
          }),
        );
        const nextItems = resolved.filter(Boolean) as SavedThread[];
        const authorIds = Array.from(new Set(nextItems.map((item) => item.authorId)));
        const communityIds = Array.from(new Set(nextItems.map((item) => item.communityId)));
        const [profileRows, communityRows] = await Promise.all([
          fetchProfilesByIds(authorIds),
          Promise.all(communityIds.map((id) => fetchCommunityById(id))),
        ]);
        if (cancelled) return;
        setItems(nextItems);
        setProfiles(
          Object.fromEntries((profileRows as ProfileRow[]).map((profile) => [profile.id, profile])),
        );
        setCommunities(
          Object.fromEntries(
            communityRows
              .filter(Boolean)
              .map((community) => [community!.id, { id: community!.id, displayName: community!.displayName }]),
          ),
        );
      } catch {
        if (!cancelled) setError('Could not load archived threads.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function removeBookmark(threadId: string) {
    const previous = items;
    setItems((current) => current.filter((item) => item.threadId !== threadId));
    try {
      await toggleBookmarkAction(threadId);
    } catch {
      setItems(previous);
    }
  }

  const filtered = useMemo(() => {
    const next = [...items];
    if (filter === 'recent') {
      next.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
    } else if (filter === 'high-score') {
      next.sort((left, right) => right.voteScore - left.voteScore);
    }
    return next;
  }, [filter, items]);

  if (loading) {
    return <GlassCard style={{ minHeight: 320, animation: 'pulse 1.5s ease-in-out infinite' }} />;
  }

  if (error) {
    return (
      <EmptyState
        icon="bookmark"
        title="Bookmarks unavailable"
        description={error}
        actionHref="/forums"
        actionLabel="Return to feed"
      />
    );
  }

  return (
    <div className="forums-page-stack" style={{ maxWidth: 1024, margin: '0 auto' }}>
      <SectionIntro
        eyebrow="Saved"
        title="Your archived reads"
        description="Desktop-adapted saved threads drop the swipe mechanics and replace them with hover-era quick actions that fit the Curator shell."
        actions={
          <Link href="/forums" style={{ ...gradientButtonStyle, textDecoration: 'none' }}>
            Browse feed
          </Link>
        }
      />

      <div className="forums-chip-row">
        {(['all', 'recent', 'high-score'] as FilterMode[]).map((value) => (
          <button key={value} type="button" onClick={() => setFilter(value)} style={chipStyle(filter === value, value === 'high-score' ? 'trust' : 'neutral')}>
            {value === 'high-score' ? 'High score' : value}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="bookmark"
          title="Nothing archived yet"
          description="When you archive threads from the feed or a community, they will show up here in a desktop stack."
          actionHref="/forums"
          actionLabel="Open feed"
        />
      ) : (
        filtered.map((item) => {
          const profile = profiles[item.authorId];
          const community = communities[item.communityId];
          return (
            <DesktopThreadCard
              key={item.bookmarkId}
              href={`/forums/thread/${item.threadId}`}
              title={item.title}
              body={truncate(item.body.replace(/\s+/g, ' ').trim(), 220)}
              communityLabel={community?.displayName}
              authorLabel={profile?.displayName ?? 'Curator'}
              createdAt={item.createdAt}
              replies={item.replyCount}
              votes={item.voteScore}
              views={item.viewCount}
              trust={{ karma: profile?.karma ?? 0, isVerified: profile?.isVerified ?? false }}
              footer={
                <div className="forums-chip-row">
                  <Link href={`/forums/thread/${item.threadId}`} style={footerLinkStyle}>
                    Open
                  </Link>
                  <button type="button" onClick={() => void removeBookmark(item.threadId)} style={footerButtonStyle}>
                    Remove
                  </button>
                </div>
              }
            />
          );
        })
      )}
    </div>
  );
}

const footerLinkStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 38,
  padding: '0 14px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.05)',
  color: TOKENS.textSecondary,
  fontSize: 13,
  fontWeight: 700,
  textDecoration: 'none',
} as const;

const footerButtonStyle = {
  border: 'none',
  borderRadius: 999,
  minHeight: 38,
  padding: '0 14px',
  background: 'rgba(255,255,255,0.05)',
  color: TOKENS.textSecondary,
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
} as const;
