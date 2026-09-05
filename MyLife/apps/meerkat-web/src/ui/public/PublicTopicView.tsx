// Topic channel (Plan 39 P10/P11, screen S9). WEB twin of the native topic
// screen: a Commons topic's dual-verified posts (recency order -- the only
// verifiable ranking signal, no fabricated Top/Rising, NC-P6), a follow toggle
// (cm_public_follows, topic kind), and a compose entry.

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AcceptedPublicPost } from '@mylife/sync';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { personaHandle, personaServiceConfig, resolvePersonaKeys } from '../../lib/persona-core';
import { commonsFeedConfig, loadCommonsTopic, PUBLIC_COMPOSE_PLACEHOLDER, PUBLIC_FEED_TOPICS } from '../../lib/public-feed';
import { isFollowingPublic, toggleFollowPublic } from '../../lib/public-follows';

// Verbatim topic copy (mockup S9), parity-locked against the native twin.
export const TOPIC_HOSTED_LINE = 'A Commons topic · hosted by Meerkat';
export const TOPIC_POSTING_LINE = 'Open posting for unlocked members. Moderated by the Meerkat trust and safety team.';
export const TOPIC_FOLLOW = 'Follow';
export const TOPIC_FOLLOWING = 'Following';

function relativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs}h` : `${Math.round(hrs / 24)}d`;
}
function shortId(hex: string): string { return `${hex.slice(0, 6)}…${hex.slice(-4)}`; }

export function PublicTopicView({
  channelId,
  onBack,
  onOpenThread,
  onOpenProfile,
  onCompose,
}: {
  channelId: string;
  onBack: () => void;
  onOpenThread: (postId: string, channelId: string) => void;
  onOpenProfile: (personaPubkey: string) => void;
  onCompose: (channelId: string) => void;
}): React.ReactElement {
  const m = useMeerkat();
  const personaConfig = useMemo(() => personaServiceConfig(), []);
  const feedConfig = useMemo(() => commonsFeedConfig(), []);
  const topic = PUBLIC_FEED_TOPICS.find((t) => t.channelId === channelId) ?? PUBLIC_FEED_TOPICS[0]!;

  const [feed, setFeed] = useState<{ loading: boolean; posts: AcceptedPublicPost[]; error: string | null }>({ loading: true, posts: [], error: null });
  const [aliases, setAliases] = useState<Record<string, string>>({});
  const [following, setFollowing] = useState(false);

  useEffect(() => { setFollowing(isFollowingPublic(m.db, 'topic', channelId)); }, [m.db, channelId]);

  useEffect(() => {
    let cancelled = false;
    setFeed((f) => ({ ...f, loading: true, error: null }));
    void loadCommonsTopic(m.db, feedConfig, channelId).then((r) => {
      if (cancelled) return;
      if (r.ok) {
        setFeed({ loading: false, posts: r.posts, error: null });
        void resolvePersonaKeys(personaConfig, r.posts.map((p) => p.post.personaPubkey)).then((map) => { if (!cancelled) setAliases(map); });
      } else {
        setFeed({ loading: false, posts: [], error: r.reason });
      }
    });
    return () => { cancelled = true; };
  }, [m.db, feedConfig, personaConfig, channelId]);

  const onToggleFollow = useCallback(() => {
    const now = toggleFollowPublic(m.db, 'topic', channelId, `${topic.emoji} ${topic.title}`);
    void m.db.flush().catch(() => undefined);
    setFollowing(now);
  }, [m.db, channelId, topic]);

  return (
    <section className="mk-main-scroll" style={{ padding: 'var(--mk-space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--mk-space-sm)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button type="button" className="mk-chip" onClick={onBack}>‹ Back</button>
        <h2 className="mk-view-title" style={{ margin: 0 }}>{topic.emoji} {topic.title}</h2>
        <button type="button" className={`mk-chip ${following ? 'is-active' : ''}`} style={{ marginLeft: 'auto' }} onClick={onToggleFollow}>{following ? `${TOPIC_FOLLOWING} ✓` : TOPIC_FOLLOW}</button>
      </div>

      <div className="mk-box">
        <p className="mk-muted" style={{ margin: '0 0 4px' }}>{TOPIC_HOSTED_LINE}</p>
        <p className="mk-muted" style={{ margin: 0 }}>{TOPIC_POSTING_LINE}</p>
      </div>

      <button type="button" className="mk-box" onClick={() => onCompose(channelId)} style={{ textAlign: 'left', cursor: 'pointer', width: '100%' }}>
        <span className="mk-muted">{PUBLIC_COMPOSE_PLACEHOLDER}</span>
      </button>

      {feed.loading ? (
        <div className="mk-box"><p className="mk-muted">Loading the feed…</p></div>
      ) : feed.error ? (
        <div className="mk-box">
          <div className="mk-settings-section-title">{feed.error === 'not_wired' ? 'This topic is not on the feed yet' : 'Could not load the feed'}</div>
          <p className="mk-muted">{feed.error === 'unreachable' ? 'The feed server could not be reached. Try again when you are online.' : 'Nothing to show for this topic right now.'}</p>
        </div>
      ) : feed.posts.length === 0 ? (
        <div className="mk-box"><p className="mk-muted">No posts in this topic yet. Only real, dual-signed posts appear here.</p></div>
      ) : (
        feed.posts.map((accepted) => (
          <button
            key={accepted.post.postId}
            type="button"
            className="mk-box"
            onClick={() => onOpenThread(accepted.post.postId, channelId)}
            style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left', cursor: 'pointer', width: '100%' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); onOpenProfile(accepted.post.personaPubkey); }}
                style={{ fontFamily: 'var(--mk-mono, monospace)', fontWeight: 700, cursor: 'pointer' }}
              >{personaHandle(aliases, accepted.post.personaPubkey, shortId(accepted.post.personaPubkey))}</span>
              <span className="mk-pill" style={{ background: 'var(--mk-success, #19805f)', color: '#0A3F31', fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 999 }}>human</span>
              <span className="mk-muted" style={{ marginLeft: 'auto', fontSize: 12 }}>{relativeTime(accepted.post.createdAt)}</span>
            </div>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>{accepted.post.body}</p>
          </button>
        ))
      )}
    </section>
  );
}
