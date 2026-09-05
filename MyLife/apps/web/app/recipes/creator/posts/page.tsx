'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getPostsByAuthorAction } from '../../creator-actions';

/* ------------------------------------------------------------------ */
/*  Tokens                                                             */
/* ------------------------------------------------------------------ */

const T = {
  bg: '#131318',
  surfaceLow: '#1B1B20',
  surface: '#1F1F25',
  surfaceHigh: '#2A292F',
  text: '#E4E1E9',
  textSecondary: '#D6C3B5',
  green: '#22C55E',
  greenLight: '#4ADE80',
  gold: '#C9894D',
  goldLight: '#FFB877',
  dimText: 'rgba(228,225,233,0.45)',
  danger: '#FFB4AB',
} as const;

const POST_TYPE_TABS = [
  { key: 'all', label: 'All' },
  { key: 'blog', label: 'Blog' },
  { key: 'exclusive_recipe', label: 'Exclusive' },
  { key: 'announcement', label: 'Announcements' },
] as const;

const VISIBILITY_COLORS: Record<string, { bg: string; text: string }> = {
  public: { bg: `${T.green}22`, text: T.green },
  subscribers: { bg: `${T.gold}22`, text: T.goldLight },
  tier_specific: { bg: '#8BCFF022', text: '#8BCFF0' },
};

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PostData {
  id: string;
  authorId: string;
  title: string;
  body: string;
  postType: string;
  visibility: string;
  coverImageUrl: string | null;
  likeCount: number;
  commentCount: number;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function CreatorPostsPage() {
  const profileId = 'current-user';

  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('all');

  useEffect(() => {
    (async () => {
      try {
        const postType = activeTab === 'all' ? undefined : activeTab;
        const res = await getPostsByAuthorAction(profileId, { postType });
        if (res.ok && res.data) {
          setPosts(res.data as unknown as PostData[]);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, [profileId, activeTab]);

  return (
    <div style={{ minHeight: '100vh', color: T.text, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 32,
      }}>
        <div>
          <Link
            href="/recipes/creator"
            style={{
              color: T.textSecondary,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              textDecoration: 'none',
              marginBottom: 8,
              display: 'inline-block',
            }}
          >
            &#x2190; Dashboard
          </Link>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>
            Posts
          </h1>
        </div>
        <button
          type="button"
          style={{
            padding: '12px 24px',
            borderRadius: 9999,
            border: 'none',
            background: `linear-gradient(135deg, ${T.green}, ${T.greenLight})`,
            color: '#131318',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Write Post
        </button>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: 4,
        marginBottom: 24,
        background: T.surfaceLow,
        borderRadius: 12,
        padding: 4,
        width: 'fit-content',
      }}>
        {POST_TYPE_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => { setActiveTab(tab.key); setLoading(true); }}
            style={{
              padding: '8px 18px',
              borderRadius: 8,
              border: 'none',
              background: activeTab === tab.key ? T.surfaceHigh : 'transparent',
              color: activeTab === tab.key ? T.text : T.dimText,
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              transition: 'background 0.2s, color 0.2s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Post list */}
      {loading ? (
        <div style={{ padding: '80px 0', textAlign: 'center', color: T.dimText, fontSize: 14 }}>
          Loading posts...
        </div>
      ) : posts.length === 0 ? (
        <div style={{
          background: T.surfaceLow,
          borderRadius: 16,
          padding: '60px 24px',
          textAlign: 'center',
          color: T.dimText,
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{'\u{270D}\u{FE0F}'}</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 8 }}>
            No posts yet
          </div>
          <div style={{ fontSize: 14 }}>
            Share your cooking journey, exclusive recipes, or announcements.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {posts.map((post) => {
            const visColor = VISIBILITY_COLORS[post.visibility] ?? VISIBILITY_COLORS.public;
            const excerpt = post.body.length > 200
              ? post.body.slice(0, 200) + '...'
              : post.body;

            return (
              <article
                key={post.id}
                style={{
                  background: T.surfaceLow,
                  borderRadius: 16,
                  overflow: 'hidden',
                  display: 'flex',
                  transition: 'background 0.2s',
                }}
              >
                {/* Cover image */}
                {post.coverImageUrl && (
                  <div style={{
                    width: 180,
                    flexShrink: 0,
                    background: T.surfaceHigh,
                    overflow: 'hidden',
                  }}>
                    <img
                      src={post.coverImageUrl}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                )}

                {/* Content */}
                <div style={{ flex: 1, padding: 20, minWidth: 0 }}>
                  {/* Top row: type badge + visibility badge */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 10,
                  }}>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      padding: '3px 10px',
                      borderRadius: 9999,
                      background: T.surfaceHigh,
                      color: T.textSecondary,
                    }}>
                      {post.postType.replace('_', ' ')}
                    </span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      padding: '3px 10px',
                      borderRadius: 9999,
                      background: visColor.bg,
                      color: visColor.text,
                    }}>
                      {post.visibility.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 style={{
                    fontSize: 17,
                    fontWeight: 700,
                    marginBottom: 8,
                    lineHeight: 1.3,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {post.title}
                  </h3>

                  {/* Excerpt */}
                  <p style={{
                    fontSize: 13,
                    color: T.textSecondary,
                    lineHeight: 1.5,
                    marginBottom: 12,
                  }}>
                    {excerpt}
                  </p>

                  {/* Footer */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    fontSize: 12,
                    color: T.dimText,
                  }}>
                    <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                    <span>{'\u{2764}'} {post.likeCount}</span>
                    <span>{'\u{1F4AC}'} {post.commentCount}</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
