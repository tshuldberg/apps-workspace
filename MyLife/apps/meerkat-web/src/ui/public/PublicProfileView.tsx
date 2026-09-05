// Public persona profile (Plan 39 P10/P11, screen S8). WEB twin of the native
// profile screen: an alias is a real social identity you can follow and read. The
// profile is assembled PURELY from persona-signed public posts; the honest privacy
// line states there is nothing else to show. Follow writes cm_public_follows.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { personaHandle, personaServiceConfig, resolvePersonaKeys } from '../../lib/persona-core';
import { commonsFeedConfig, PUBLIC_FEED_TOPICS } from '../../lib/public-feed';
import { loadPersonaProfile, publicPostCountLabel, type PersonaProfile } from '../../lib/public-profile';
import { isFollowingPublic, toggleFollowPublic } from '../../lib/public-follows';
import { Button } from '../shell/Button';
import { HonestNotice } from '../shell/HonestNotice';

// Verbatim profile copy (mockup S8), parity-locked against the native twin.
export const PROFILE_PRIVACY_NOTE = 'Public personas show only what their owner posts publicly. No device, location, or private-community information exists here.';
export const PROFILE_FOLLOW = 'Follow';
export const PROFILE_FOLLOWING = 'Following';

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

export function PublicProfileView({
  personaPubkey,
  onBack,
  onOpenThread,
}: {
  personaPubkey: string;
  onBack: () => void;
  onOpenThread: (postId: string, channelId: string) => void;
}): React.ReactElement {
  const m = useMeerkat();
  const personaConfig = useMemo(() => personaServiceConfig(), []);
  const feedConfig = useMemo(() => commonsFeedConfig(), []);
  const key = personaPubkey.toLowerCase();

  const [state, setState] = useState<{ loading: boolean; profile: PersonaProfile | null; error: string | null }>({ loading: true, profile: null, error: null });
  const [aliases, setAliases] = useState<Record<string, string>>({});
  const [following, setFollowing] = useState(false);

  useEffect(() => { setFollowing(isFollowingPublic(m.db, 'persona', key)); }, [m.db, key]);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    void resolvePersonaKeys(personaConfig, [key]).then((map) => { if (!cancelled) setAliases(map); });
    void loadPersonaProfile(m.db, feedConfig, key).then((r) => {
      if (cancelled) return;
      if (r.ok) setState({ loading: false, profile: r.profile, error: null });
      else setState({ loading: false, profile: null, error: r.reason });
    });
    return () => { cancelled = true; };
  }, [m.db, feedConfig, personaConfig, key]);

  const handle = personaHandle(aliases, key, shortId(key));

  const onToggleFollow = useCallback(() => {
    const now = toggleFollowPublic(m.db, 'persona', key, handle);
    void m.db.flush().catch(() => undefined);
    setFollowing(now);
  }, [m.db, key, handle]);

  return (
    <section className="mk-main-scroll" style={{ padding: 'var(--mk-space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--mk-space-sm)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button type="button" className="mk-chip" onClick={onBack}>‹ Back</button>
        <h2 className="mk-view-title" style={{ margin: 0, fontFamily: 'var(--mk-mono, monospace)' }}>{handle}</h2>
      </div>

      <div className="mk-box" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
        <span style={{ display: 'inline-flex', width: 56, height: 56, borderRadius: 28, background: 'var(--mk-accent, #0E7C66)', color: '#fff', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 22 }}>{(handle.replace(/^@/, '')[0] ?? '?').toUpperCase()}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 800, fontSize: 17 }}>{handle}</span>
          <span className="mk-pill" style={{ background: 'var(--mk-success, #19805f)', color: '#0A3F31', fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 999 }}>human</span>
        </div>
        {state.profile ? <span className="mk-muted" style={{ fontSize: 13 }}>{publicPostCountLabel(state.profile.posts.length)}</span> : null}
        <Button onClick={onToggleFollow}>{following ? PROFILE_FOLLOWING : PROFILE_FOLLOW}</Button>
      </div>

      <HonestNotice>{PROFILE_PRIVACY_NOTE}</HonestNotice>

      <div className="mk-settings-section-title">Posts</div>
      {state.loading ? (
        <div className="mk-box"><p className="mk-muted">Loading posts…</p></div>
      ) : state.error ? (
        <div className="mk-box"><p className="mk-muted">{state.error === 'not_configured' ? 'The public feed is not connected in this build.' : 'Could not reach the feed to load this profile. Try again when you are online.'}</p></div>
      ) : !state.profile || state.profile.posts.length === 0 ? (
        <div className="mk-box"><p className="mk-muted">No public posts from this persona yet.</p></div>
      ) : (
        state.profile.posts.map((accepted) => {
          const channelId = state.profile!.channelByPostId[accepted.post.postId] ?? 'commons';
          const topic = PUBLIC_FEED_TOPICS.find((t) => t.channelId === channelId) ?? PUBLIC_FEED_TOPICS[0]!;
          return (
            <button
              key={accepted.post.postId}
              type="button"
              className="mk-box"
              onClick={() => onOpenThread(accepted.post.postId, channelId)}
              style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left', cursor: 'pointer', width: '100%' }}
            >
              <span className="mk-muted" style={{ fontSize: 12.5 }}>in {topic.emoji} {topic.title} · {relativeTime(accepted.post.createdAt)}</span>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>{accepted.post.body}</p>
            </button>
          );
        })
      )}
    </section>
  );
}
