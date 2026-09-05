// Public view (Plan 39 P10/P11, screen S1/S4). WEB twin of the native Public tab. The front door
// to the public tier: verify-to-view is enforced server-side (P9), and this is the honest client
// face -- the locked feed until the user has a verified persona + session, then the base-feed shell
// (The Commons). Nothing is fabricated; a card renders only from a real dual-verified post.

import { useEffect, useMemo, useState } from 'react';
import type { AcceptedPublicPost } from '@mylife/sync';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { useView } from '../navigation/useView';
import { ensurePersonaSession, personaServiceConfig } from '../../lib/persona-core';
import {
  SELF_HOSTED_BOUNDARY_NOTICE,
  VERIFY_TO_VIEW_LOCKED_BODY,
  VERIFY_TO_VIEW_LOCKED_TITLE,
  VERIFY_TO_VIEW_NOT_CONFIGURED,
  VERIFY_TO_VIEW_PRICE_LINE,
  verifyToViewState,
} from '../../lib/verify-to-view';
import { getStoredPersona, personaHandle, resolvePersonaKeys } from '../../lib/persona-core';
import { commonsFeedConfig, isCommonsFeedConfigured, loadCommonsTopic, PUBLIC_COMPOSE_PLACEHOLDER, PUBLIC_FEED_TOPICS } from '../../lib/public-feed';
import { Button } from '../shell/Button';
import { HonestNotice } from '../shell/HonestNotice';
import { PublicComposeView } from './PublicComposeView';
import { PublicThreadView } from './PublicThreadView';
import { PublicProfileView } from './PublicProfileView';
import { PublicTopicView } from './PublicTopicView';
import { PublicExploreView } from './PublicExploreView';

function relativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs}h` : `${Math.round(hrs / 24)}d`;
}

export function PublicView(): React.ReactElement {
  const m = useMeerkat();
  const { dispatch } = useView();
  const personaConfig = useMemo(() => personaServiceConfig(), []);
  const feedConfig = useMemo(() => commonsFeedConfig(), []);
  const [tick, setTick] = useState(0);
  const [reconnecting, setReconnecting] = useState(false);
  const [activeTopic, setActiveTopic] = useState('commons');
  const [composing, setComposing] = useState(false);
  const [viewingThread, setViewingThread] = useState<{ postId: string; channelId: string } | null>(null);
  const [viewingProfile, setViewingProfile] = useState<{ personaPubkey: string } | null>(null);
  const [viewingTopic, setViewingTopic] = useState<{ channelId: string } | null>(null);
  const [viewingExplore, setViewingExplore] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [feed, setFeed] = useState<{ loading: boolean; posts: AcceptedPublicPost[]; error: string | null }>({ loading: false, posts: [], error: null });
  const [aliases, setAliases] = useState<Record<string, string>>({});

  void tick;
  const state = verifyToViewState(m.db, personaConfig);
  const configured = isCommonsFeedConfigured(feedConfig);
  const persona = getStoredPersona(m.db);

  // Load the active topic's real, dual-verified posts when verified + a feed is connected.
  useEffect(() => {
    if (state !== 'verified' || !configured || composing || viewingThread || viewingProfile || viewingTopic || viewingExplore) return;
    let cancelled = false;
    setFeed((f) => ({ ...f, loading: true, error: null }));
    void loadCommonsTopic(m.db, feedConfig, activeTopic).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setFeed({ loading: false, posts: result.posts, error: null });
        void resolvePersonaKeys(personaConfig, result.posts.map((p) => p.post.personaPubkey)).then((map) => { if (!cancelled) setAliases(map); });
      } else {
        setFeed({ loading: false, posts: [], error: result.reason });
      }
    });
    return () => { cancelled = true; };
  }, [state, configured, activeTopic, m.db, feedConfig, personaConfig, composing, viewingThread, viewingProfile, viewingTopic, viewingExplore, reloadKey]);

  if (viewingExplore) {
    return (
      <PublicExploreView
        onBack={() => setViewingExplore(false)}
        onOpenTopic={(channelId) => { setViewingExplore(false); setViewingTopic({ channelId }); }}
        onBrowseCommunities={() => { setViewingExplore(false); dispatch({ type: 'OPEN_DISCOVER' }); }}
      />
    );
  }

  if (viewingTopic) {
    return (
      <PublicTopicView
        channelId={viewingTopic.channelId}
        onBack={() => { setViewingTopic(null); setReloadKey((k) => k + 1); }}
        onOpenThread={(postId, channelId) => { setViewingTopic(null); setViewingThread({ postId, channelId }); }}
        onOpenProfile={(personaPubkey) => { setViewingTopic(null); setViewingProfile({ personaPubkey }); }}
        onCompose={(channelId) => { setActiveTopic(channelId); setViewingTopic(null); setComposing(true); }}
      />
    );
  }

  if (viewingProfile) {
    return (
      <PublicProfileView
        personaPubkey={viewingProfile.personaPubkey}
        onBack={() => setViewingProfile(null)}
        onOpenThread={(postId, channelId) => { setViewingProfile(null); setViewingThread({ postId, channelId }); }}
      />
    );
  }

  if (composing) {
    return (
      <PublicComposeView
        topic={activeTopic}
        onPosted={() => { setComposing(false); setReloadKey((k) => k + 1); }}
        onCancel={() => setComposing(false)}
        onOpenSettings={() => dispatch({ type: 'OPEN_OVERLAY', overlay: { kind: 'settings' } })}
      />
    );
  }

  if (viewingThread) {
    return (
      <PublicThreadView
        postId={viewingThread.postId}
        channelId={viewingThread.channelId}
        onBack={() => { setViewingThread(null); setReloadKey((k) => k + 1); }}
        onOpenSettings={() => dispatch({ type: 'OPEN_OVERLAY', overlay: { kind: 'settings' } })}
        onOpenProfile={(personaPubkey) => setViewingProfile({ personaPubkey })}
        onOpenTopic={(channelId) => { setViewingThread(null); setViewingTopic({ channelId }); }}
      />
    );
  }

  const onReconnect = (): void => {
    setReconnecting(true);
    void ensurePersonaSession(m.db, personaConfig).then((result) => {
      void m.db.flush().catch(() => undefined);
      setReconnecting(false);
      // A failed renewal (empty humanity wallet) means the user must verify again; send them to
      // the persona flow (settings) instead of leaving Continue stuck.
      if (!result.ok && (result.reason === 'needs_verification' || result.reason === 'no_persona')) {
        dispatch({ type: 'OPEN_OVERLAY', overlay: { kind: 'settings' } });
        return;
      }
      setTick((t) => t + 1);
    });
  };

  return (
    <section className="mk-main-scroll" style={{ padding: 'var(--mk-space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--mk-space-sm)' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <h2 className="mk-view-title" style={{ flex: 1, margin: 0 }}>Public</h2>
        {state === 'verified' ? (
          <button type="button" className="mk-chip" onClick={() => setViewingExplore(true)}>Explore</button>
        ) : null}
      </div>

      {state === 'not_configured' ? (
        <div className="mk-box">
          <div style={{ fontSize: 40, textAlign: 'center' }}>🔒</div>
          <h3>Public accounts are off in this build</h3>
          <HonestNotice>{VERIFY_TO_VIEW_NOT_CONFIGURED}</HonestNotice>
        </div>
      ) : state === 'locked' ? (
        <>
          <div className="mk-box" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 44 }}>🔒</div>
            <h3 style={{ margin: '6px 0' }}>{VERIFY_TO_VIEW_LOCKED_TITLE}</h3>
            <p className="mk-muted" style={{ maxWidth: 340, margin: '0 auto' }}>{VERIFY_TO_VIEW_LOCKED_BODY}</p>
          </div>
          <div className="mk-box">
            <div className="mk-settings-section-title">What verification means</div>
            <p style={{ margin: '4px 0' }}>{'✓'} Proves a human is behind the account, not a bot</p>
            <p style={{ margin: '4px 0' }}>{'✓'} Stores no name, email, or phone number</p>
            <p style={{ margin: '4px 0' }}>{'✓'} Your private communities never need this</p>
          </div>
          <Button onClick={() => dispatch({ type: 'OPEN_OVERLAY', overlay: { kind: 'settings' } })}>Verify I'm human</Button>
          <p className="mk-muted" style={{ textAlign: 'center', fontSize: 13 }}>{VERIFY_TO_VIEW_PRICE_LINE}</p>
          <HonestNotice>{SELF_HOSTED_BOUNDARY_NOTICE}</HonestNotice>
        </>
      ) : state === 'needs_session' ? (
        <div className="mk-box">
          <div className="mk-settings-section-title">Reconnecting your public session</div>
          <p>Your public session expired. Reconnect to browse the public feed. It uses one of your verification passes.</p>
          <Button onClick={onReconnect} disabled={reconnecting}>{reconnecting ? 'Reconnecting…' : 'Continue'}</Button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {PUBLIC_FEED_TOPICS.map((topic) => (
              <button
                key={topic.channelId}
                type="button"
                className={`mk-chip ${activeTopic === topic.channelId ? 'is-active' : ''}`}
                onClick={() => setActiveTopic(topic.channelId)}
              >
                {topic.emoji} {topic.title}
              </button>
            ))}
          </div>
          {persona ? (
            <button
              type="button"
              className="mk-box"
              onClick={() => setComposing(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', cursor: 'pointer', width: '100%' }}
            >
              <span style={{ display: 'inline-flex', width: 28, height: 28, borderRadius: 14, background: 'var(--mk-accent, #0E7C66)', color: '#fff', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>{(persona.alias[0] ?? '?').toUpperCase()}</span>
              <span className="mk-muted">{PUBLIC_COMPOSE_PLACEHOLDER}</span>
            </button>
          ) : null}
          {!configured ? (
            <div className="mk-box">
              <div className="mk-settings-section-title">The public feed is not connected in this build</div>
              <HonestNotice>You are verified, but this build has no first-party feed server connected yet, so there is nothing to show. Your private Meerkat works fully without it.</HonestNotice>
              <HonestNotice>{SELF_HOSTED_BOUNDARY_NOTICE}</HonestNotice>
            </div>
          ) : feed.loading ? (
            <div className="mk-box"><p className="mk-muted">Loading the feed…</p></div>
          ) : feed.error ? (
            <div className="mk-box">
              <div className="mk-settings-section-title">{feed.error === 'not_wired' ? 'This topic is not on the feed yet' : 'Could not load the feed'}</div>
              <p className="mk-muted">{feed.error === 'unreachable' ? 'The feed server could not be reached. Try again when you are online.' : 'Nothing to show for this topic right now.'}</p>
            </div>
          ) : feed.posts.length === 0 ? (
            <div className="mk-box">
              <div className="mk-settings-section-title">No posts yet</div>
              <p className="mk-muted">The feed will fill in as verified people post. Only real, dual-signed posts appear here.</p>
            </div>
          ) : (
            feed.posts.map((accepted) => (
              <button
                key={accepted.post.postId}
                type="button"
                className="mk-box"
                onClick={() => setViewingThread({ postId: accepted.post.postId, channelId: activeTopic })}
                style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left', cursor: 'pointer', width: '100%' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); setViewingProfile({ personaPubkey: accepted.post.personaPubkey }); }}
                    style={{ fontFamily: 'var(--mk-mono, monospace)', fontWeight: 700, cursor: 'pointer' }}
                  >{personaHandle(aliases, accepted.post.personaPubkey, `${accepted.post.personaPubkey.slice(0, 6)}…${accepted.post.personaPubkey.slice(-4)}`)}</span>
                  <span className="mk-pill" style={{ background: 'var(--mk-success, #19805f)', color: '#0A3F31', fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 999 }}>human</span>
                  <span className="mk-muted" style={{ marginLeft: 'auto', fontSize: 12 }}>{relativeTime(accepted.post.createdAt)}</span>
                </div>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>{accepted.post.body}</p>
              </button>
            ))
          )}
        </>
      )}
    </section>
  );
}
