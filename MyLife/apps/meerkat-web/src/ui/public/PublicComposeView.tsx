// New public post composer (Plan 39 P10/P11, screens S5/S6). WEB twin of
// apps/meerkat/app/(root)/public/compose.tsx. The pay-to-post gate is the EXISTING
// founder-locked meerkat_app_unlock $4.99 one-time SKU (NC-P5); the sheet is UX,
// the real gate is server-side on /submit. A "posted" state appears ONLY after a
// real dual-signed acceptance receipt (NC-3); every rejection shows the honest bucket.

import { useEffect, useMemo, useState } from 'react';
import { MEERKAT_APP_UNLOCK_PRODUCT } from '@mylife/billing-config';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { getStoredPersona, personaServiceConfig } from '../../lib/persona-core';
import { getStoredHumanityTokenCount, humanityServiceConfig } from '../../lib/humanity-core';
import { isAppUnlocked, submitPublicPost, type SubmitFailReason } from '../../lib/public-post-client';
import { PUBLIC_FEED_TOPICS, MAX_PUBLIC_POST_BODY, PUBLIC_COMPOSE_PLACEHOLDER } from '../../lib/public-feed';
import { Button } from '../shell/Button';
import { HonestNotice } from '../shell/HonestNotice';
import { hasAcceptedPublicTerms } from '../../lib/public-safety';

// Verbatim composer copy (mockups S5/S6), parity-locked against the native twin.
export const COMPOSE_UNLOCK_TITLE = 'Unlock posting, once, forever';
export const COMPOSE_UNLOCK_BODY = 'Reading is free for every verified human. Posting anywhere on public Meerkat needs the one-time unlock. No subscription.';
export const COMPOSE_UNLOCK_PRICE_NOTE = 'one time · unlocks the full app too';
export const COMPOSE_UNLOCK_CTA = 'Unlock and post';
export const COMPOSE_RESTORE_CTA = 'Restore purchase';
export const COMPOSE_BEFORE_LIVE_TITLE = 'Before this goes live';
export const COMPOSE_BEFORE_SIGNED = 'Signed by your public name, not your device';
export const COMPOSE_BEFORE_PUBLIC = 'Public and visible to every verified member; removable by you or moderators';
export const COMPOSE_BEFORE_ADMISSION = 'Admission to this feed is checked by the Meerkat host, like any public platform';

// The price is founder-locked and sourced from @mylife/billing-config, never hardcoded.
const PRICE_LABEL = `$${MEERKAT_APP_UNLOCK_PRODUCT.price.toFixed(2)}`;

function walletNotice(remaining: number): string {
  return `1 verification pass will be spent to post. Wallet: ${remaining} remaining.`;
}

function failMessage(reason: SubmitFailReason, detail?: string): string {
  switch (reason) {
    case 'not_configured':
      return 'The public feed is not connected in this build, so there is nowhere to post yet.';
    case 'not_wired':
      return 'This topic is not on the feed yet.';
    case 'needs_verification':
      return 'Your public session needs to be renewed. Reconnect on the Public tab, then try again.';
    case 'needs_unlock':
      return 'Posting needs the one-time unlock first.';
    case 'needs_terms':
      return 'Review and accept the Terms of Use and Community Standards before posting.';
    case 'unlock_unavailable':
      return 'This account is unlocked, but the connection server could not confirm your purchase to post. Link your purchase, then try again.';
    case 'session':
      return 'Your public session was not accepted. Reconnect on the Public tab and try again.';
    case 'humanity':
      return 'Your verification pass was not accepted. Verify again, then post.';
    case 'unlock':
      return 'The server did not accept your unlock. Restore your purchase, then try again.';
    case 'policy':
      return 'Posting to this feed is closed right now.';
    case 'caps':
      return 'You are posting too fast, or this feed is full for now. Wait a little and try again.';
    case 'unreachable':
      return 'The feed server could not be reached. Try again when you are online.';
    case 'rejected':
    default:
      return detail === 'post_too_large'
        ? 'That post is longer than the feed allows. Shorten it and try again.'
        : 'The post was not accepted. Nothing was published.';
  }
}

export function PublicComposeView({
  topic,
  onPosted,
  onCancel,
  onOpenSettings,
}: {
  topic: string;
  /** Called after a real acceptance receipt, so the feed re-pages off the node. */
  onPosted: () => void;
  onCancel: () => void;
  /** Opens the settings overlay where the $4.99 unlock (Stripe) rail lives. */
  onOpenSettings: () => void;
}): React.ReactElement {
  const m = useMeerkat();
  const personaConfig = useMemo(() => personaServiceConfig(), []);
  const persona = getStoredPersona(m.db);
  const topicMeta = PUBLIC_FEED_TOPICS.find((t) => t.channelId === topic) ?? PUBLIC_FEED_TOPICS[0]!;
  const unlocked = isAppUnlocked();
  const termsAccepted = hasAcceptedPublicTerms(m.db);

  const [body, setBody] = useState('');
  const [phase, setPhase] = useState<'idle' | 'posting' | 'sent' | 'failed'>('idle');
  const [failReason, setFailReason] = useState<{ reason: SubmitFailReason; detail?: string } | null>(null);
  const [walletCount, setWalletCount] = useState(0);

  useEffect(() => {
    setWalletCount(getStoredHumanityTokenCount(m.db, humanityServiceConfig()));
  }, [m.db, phase]);

  const onPost = (): void => {
    const trimmed = body.trim();
    if (trimmed.length === 0) return;
    setPhase('posting');
    setFailReason(null);
    void submitPublicPost({ db: m.db, personaConfig, channelId: topic, body: trimmed }).then((outcome) => {
      void m.db.flush().catch(() => undefined);
      setWalletCount(getStoredHumanityTokenCount(m.db, humanityServiceConfig()));
      if (outcome.ok) {
        setPhase('sent');
        setTimeout(onPosted, 700);
      } else {
        setFailReason({ reason: outcome.reason, detail: outcome.detail });
        setPhase('failed');
      }
    });
  };

  const remaining = MAX_PUBLIC_POST_BODY - body.length;

  return (
    <section className="mk-main-scroll" style={{ padding: 'var(--mk-space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--mk-space-sm)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button type="button" className="mk-chip" onClick={onCancel}>‹ Back</button>
        <h2 className="mk-view-title" style={{ margin: 0 }}>New post</h2>
        {unlocked && persona && phase !== 'sent' ? (
          <button type="button" className="mk-btn-primary" style={{ marginLeft: 'auto' }} disabled={phase === 'posting' || !termsAccepted || body.trim().length === 0} onClick={onPost}>
            {phase === 'posting' ? 'Posting…' : 'Post'}
          </button>
        ) : null}
      </div>

      {!persona ? (
        <div className="mk-box"><HonestNotice>Create your public name first to post. Head to the Public tab to verify and pick an alias.</HonestNotice></div>
      ) : phase === 'sent' ? (
        <div className="mk-box">
          <div className="mk-settings-section-title">Posted</div>
          <p>Your post was accepted and signed. It will appear on the feed as it propagates.</p>
        </div>
      ) : (
        <>
          <div className="mk-box" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 700 }}>@{persona.alias}</span>
              <span className="mk-chip" style={{ marginLeft: 'auto' }}>{topicMeta.emoji} {topicMeta.title}</span>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, MAX_PUBLIC_POST_BODY))}
              placeholder={PUBLIC_COMPOSE_PLACEHOLDER}
              disabled={!unlocked}
              rows={4}
              style={{ width: '100%', resize: 'vertical', background: 'transparent', color: 'inherit', border: 'none', outline: 'none', fontSize: 15, lineHeight: 1.5 }}
            />
            <span className="mk-muted" style={{ textAlign: 'right', fontSize: 12 }}>{remaining}</span>
          </div>

          {unlocked ? (
            <>
              {!termsAccepted ? (
                <div className="mk-box">
                  <HonestNotice>Review and accept the Terms of Use and Community Standards before posting.</HonestNotice>
                  <Button onClick={onOpenSettings}>Review legal and safety</Button>
                </div>
              ) : null}
              <div className="mk-box">
                <div className="mk-settings-section-title">{COMPOSE_BEFORE_LIVE_TITLE}</div>
                <p style={{ margin: '4px 0' }}>✍️ {COMPOSE_BEFORE_SIGNED} (@{persona.alias})</p>
                <p style={{ margin: '4px 0' }}>🌍 {COMPOSE_BEFORE_PUBLIC}</p>
                <p style={{ margin: '4px 0' }}>⚖️ {COMPOSE_BEFORE_ADMISSION}</p>
              </div>
              <HonestNotice>{walletNotice(walletCount)}</HonestNotice>
              {phase === 'failed' && failReason ? <HonestNotice>{failMessage(failReason.reason, failReason.detail)}</HonestNotice> : null}
            </>
          ) : (
            <div className="mk-box" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
              <div style={{ fontSize: 26 }}>🔒</div>
              <div style={{ fontWeight: 800 }}>{COMPOSE_UNLOCK_TITLE}</div>
              <p className="mk-muted" style={{ maxWidth: 300, margin: 0 }}>{COMPOSE_UNLOCK_BODY}</p>
              <div style={{ fontSize: 32, fontWeight: 900 }}>{PRICE_LABEL}</div>
              <div className="mk-muted" style={{ fontSize: 12.5 }}>{COMPOSE_UNLOCK_PRICE_NOTE}</div>
              <Button onClick={onOpenSettings}>{COMPOSE_UNLOCK_CTA}</Button>
              <button type="button" className="mk-chip" onClick={onOpenSettings}>{COMPOSE_RESTORE_CTA}</button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
