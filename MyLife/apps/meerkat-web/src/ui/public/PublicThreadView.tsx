// Public post thread (Plan 39 P10/P11, screen S7). WEB twin of the native thread
// screen: the dual-verified root post, its verified replies, and a reply composer.
// Replies are gated writes exactly like posts (parentPostId), riding the SAME
// submit client + three server-side gates; a reply "sent" state appears only off a
// real acceptance receipt (NC-3).

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AcceptedPublicPost } from '@mylife/sync';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { personaServiceConfig, getStoredPersona, personaHandle, resolvePersonaKeys } from '../../lib/persona-core';
import { commonsFeedConfig, MAX_PUBLIC_POST_BODY, PUBLIC_FEED_TOPICS } from '../../lib/public-feed';
import { loadPublicThread, replyCountLabel, type PublicThread } from '../../lib/public-thread';
import { isAppUnlocked, submitPublicPost, type SubmitFailReason } from '../../lib/public-post-client';
import {
  PUBLIC_REPORT_CATEGORIES,
  REPORT_SHEET_SUBMIT,
  REPORT_SHEET_SUBTITLE,
  REPORT_SHEET_TITLE,
  submitPublicReport,
  type SubmitReportReason,
} from '../../lib/public-report';
import type { PublicReportReason, PublicReportTargetKind } from '@mylife/sync';
import { Button } from '../shell/Button';
import { HonestNotice } from '../shell/HonestNotice';
import { blockPublicPersona } from '../../lib/public-safety';

// Verbatim thread copy (mockup S7), parity-locked against the native twin.
export const THREAD_SIGNED_PREFIX = 'Signed by';
export const THREAD_HOST_SUFFIX = 'accepted by the Meerkat host';
export const THREAD_REPLY_PLACEHOLDER = 'Reply as your public name…';
export const THREAD_REPLY_LOCKED = 'Replies need the one-time unlock, like every public post.';

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

function reportFailMessage(reason: SubmitReportReason): string {
  switch (reason) {
    case 'not_configured': return 'Reporting needs a connection to a Meerkat account server, and this build has none configured.';
    case 'no_persona': return 'Verify your public account first, then you can report.';
    case 'topic_not_wired': return 'This feed is not connected in this build, so the report could not be sent.';
    case 'key_unavailable': return 'Your public key is unavailable on this device, so the report could not be signed.';
    case 'unreachable': return 'The feed server could not be reached. Try again when you are online.';
    default: return 'The report was not accepted. Nothing was sent.';
  }
}

function replyFailMessage(reason: SubmitFailReason): string {
  switch (reason) {
    case 'needs_verification': return 'Your public session needs to reconnect before replying. Open the Public tab and try again.';
    case 'needs_unlock': case 'unlock': case 'unlock_unavailable': return 'Replying needs the one-time unlock confirmed with the connection server.';
    case 'needs_terms': return 'Review and accept the Terms of Use and Community Standards before replying.';
    case 'session': return 'Your public session was not accepted. Reconnect and try again.';
    case 'humanity': return 'Your verification pass was not accepted. Verify again, then reply.';
    case 'caps': return 'You are replying too fast, or this feed is full for now. Wait a little and try again.';
    case 'policy': return 'Replying to this feed is closed right now.';
    case 'unreachable': return 'The feed server could not be reached. Try again when you are online.';
    default: return 'The reply was not accepted. Nothing was posted.';
  }
}

export function PublicThreadView({
  postId,
  channelId,
  onBack,
  onOpenSettings,
  onOpenProfile,
  onOpenTopic,
}: {
  postId: string;
  channelId: string;
  onBack: () => void;
  onOpenSettings: () => void;
  onOpenProfile: (personaPubkey: string) => void;
  onOpenTopic: (channelId: string) => void;
}): React.ReactElement {
  const m = useMeerkat();
  const personaConfig = useMemo(() => personaServiceConfig(), []);
  const feedConfig = useMemo(() => commonsFeedConfig(), []);
  const topicMeta = PUBLIC_FEED_TOPICS.find((t) => t.channelId === channelId) ?? PUBLIC_FEED_TOPICS[0]!;
  const persona = getStoredPersona(m.db);
  const unlocked = isAppUnlocked();

  const [state, setState] = useState<{ loading: boolean; thread: PublicThread | null; error: string | null }>({ loading: true, thread: null, error: null });
  const [aliases, setAliases] = useState<Record<string, string>>({});
  const [reloadKey, setReloadKey] = useState(0);
  const [replyBody, setReplyBody] = useState('');
  const [replyPhase, setReplyPhase] = useState<'idle' | 'posting' | 'sent' | 'failed'>('idle');
  const [replyFail, setReplyFail] = useState<SubmitFailReason | null>(null);
  const [reportTarget, setReportTarget] = useState<{ targetId: string; targetKind: PublicReportTargetKind } | null>(null);
  const [reportPhase, setReportPhase] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [reportFail, setReportFail] = useState<SubmitReportReason | null>(null);

  const onReport = useCallback((reason: PublicReportReason) => {
    if (!reportTarget) return;
    const target = reportTarget;
    setReportPhase('sending');
    setReportFail(null);
    void submitPublicReport({ db: m.db, feedConfig }, { channelId, targetKind: target.targetKind, targetId: target.targetId, reason }).then((r) => {
      if (r.ok) {
        setReportPhase('sent');
        // Close only THIS report's sheet; a report opened for another card in the
        // meantime must not be stomped by a stale timer.
        setTimeout(() => {
          setReportTarget((cur) => (cur === target ? null : cur));
          setReportPhase((p) => (p === 'sent' ? 'idle' : p));
        }, 1400);
      } else {
        setReportFail(r.reason);
        setReportPhase('failed');
      }
    });
  }, [reportTarget, m.db, feedConfig, channelId]);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    void loadPublicThread(m.db, feedConfig, channelId, postId).then((r) => {
      if (cancelled) return;
      if (r.ok) {
        setState({ loading: false, thread: r.thread, error: null });
        const keys = [r.thread.root, ...r.thread.replies].map((x) => x.post.personaPubkey);
        void resolvePersonaKeys(personaConfig, keys).then((map) => { if (!cancelled) setAliases(map); });
      } else {
        setState({ loading: false, thread: null, error: r.reason });
      }
    });
    return () => { cancelled = true; };
  }, [m.db, feedConfig, channelId, postId, personaConfig, reloadKey]);

  const onReply = useCallback(() => {
    const trimmed = replyBody.trim();
    if (trimmed.length === 0) return;
    setReplyPhase('posting');
    setReplyFail(null);
    void submitPublicPost({ db: m.db, personaConfig, feedConfig, channelId, body: trimmed, parentPostId: postId }).then((outcome) => {
      void m.db.flush().catch(() => undefined);
      if (outcome.ok) {
        setReplyBody('');
        setReplyPhase('sent');
        setReloadKey((k) => k + 1);
        setTimeout(() => setReplyPhase('idle'), 1200);
      } else {
        setReplyFail(outcome.reason);
        setReplyPhase('failed');
      }
    });
  }, [replyBody, m.db, personaConfig, feedConfig, channelId, postId]);

  const renderCard = (accepted: AcceptedPublicPost, isReply: boolean): React.ReactElement => {
    const mine = persona?.personaPubkey === accepted.post.personaPubkey;
    return (
      <div key={accepted.post.postId} className="mk-box" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginLeft: isReply ? 14 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            role="button"
            tabIndex={0}
            onClick={() => onOpenProfile(accepted.post.personaPubkey)}
            style={{ fontFamily: 'var(--mk-mono, monospace)', fontWeight: 700, cursor: 'pointer' }}
          >{personaHandle(aliases, accepted.post.personaPubkey, shortId(accepted.post.personaPubkey))}</span>
          {mine
            ? <span className="mk-pill" style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 999 }}>you</span>
            : <span className="mk-pill" style={{ background: 'var(--mk-success, #19805f)', color: '#0A3F31', fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 999 }}>human</span>}
          <span className="mk-muted" style={{ marginLeft: 'auto', fontSize: 12 }}>{relativeTime(accepted.post.createdAt)}</span>
        </div>
        {!mine ? (
          <div style={{ display: 'flex', gap: 14 }}>
            {persona ? (
              <span
                role="button"
                tabIndex={0}
                className="mk-muted"
                style={{ fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                onClick={() => { setReportTarget({ targetId: accepted.post.postId, targetKind: isReply ? 'reply' : 'post' }); setReportPhase('idle'); setReportFail(null); }}
              >Report</span>
            ) : null}
            <span
              role="button"
              tabIndex={0}
              className="mk-muted"
              style={{ fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              onClick={() => {
                // A block is a real device-local write; confirm before hiding the
                // author everywhere and leaving the thread.
                if (!window.confirm('Block this public name? Their public posts stop appearing on this device. Nothing is sent to them.')) return;
                blockPublicPersona(m.db, accepted.post.personaPubkey);
                void m.db.flush().catch(() => undefined);
                onBack();
              }}
            >Block author</span>
          </div>
        ) : null}
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>{accepted.post.body}</p>
        {!isReply ? (
          <>
            <span role="button" tabIndex={0} className="mk-muted" style={{ fontSize: 12.5, cursor: 'pointer' }} onClick={() => onOpenTopic(channelId)}>in {topicMeta.emoji} {topicMeta.title}</span>
            <div style={{ height: 1, background: 'var(--mk-border, rgba(0,0,0,0.08))', margin: '4px 0' }} />
            <span className="mk-muted" style={{ fontSize: 12 }}>🛡️ {THREAD_SIGNED_PREFIX} {personaHandle(aliases, accepted.post.personaPubkey, shortId(accepted.post.personaPubkey))} · {THREAD_HOST_SUFFIX}</span>
          </>
        ) : null}
      </div>
    );
  };

  return (
    <section className="mk-main-scroll" style={{ padding: 'var(--mk-space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--mk-space-sm)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button type="button" className="mk-chip" onClick={onBack}>‹ Back</button>
        <h2 className="mk-view-title" style={{ margin: 0 }}>Post</h2>
      </div>

      {state.loading ? (
        <div className="mk-box"><p className="mk-muted">Loading the thread…</p></div>
      ) : state.error || !state.thread ? (
        <div className="mk-box">
          <div className="mk-settings-section-title">{state.error === 'not_found' ? 'This post is not on the feed' : 'Could not load the thread'}</div>
          <p className="mk-muted">{state.error === 'unreachable' ? 'The feed server could not be reached. Try again when you are online.' : 'Nothing to show here right now.'}</p>
        </div>
      ) : (
        <>
          {renderCard(state.thread.root, false)}
          <div className="mk-settings-section-title">{replyCountLabel(state.thread.replies.length)} · newest</div>
          {state.thread.replies.map((r) => renderCard(r, true))}

          {persona ? (
            unlocked ? (
              <div className="mk-box" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value.slice(0, MAX_PUBLIC_POST_BODY))}
                  placeholder={THREAD_REPLY_PLACEHOLDER}
                  rows={3}
                  disabled={replyPhase === 'posting'}
                  style={{ width: '100%', resize: 'vertical', background: 'transparent', color: 'inherit', border: 'none', outline: 'none', fontSize: 15, lineHeight: 1.5 }}
                />
                {replyPhase === 'sent' ? <HonestNotice>Reply posted and signed. It will appear as it propagates.</HonestNotice> : null}
                {replyPhase === 'failed' && replyFail ? <HonestNotice>{replyFailMessage(replyFail)}</HonestNotice> : null}
                <Button onClick={onReply} disabled={replyPhase === 'posting' || replyBody.trim().length === 0}>{replyPhase === 'posting' ? 'Posting…' : 'Reply'}</Button>
              </div>
            ) : (
              <div className="mk-box">
                <HonestNotice>{THREAD_REPLY_LOCKED}</HonestNotice>
                <Button onClick={onOpenSettings}>Unlock to reply</Button>
              </div>
            )
          ) : null}
        </>
      )}

      {reportTarget !== null ? (
        <div
          role="presentation"
          onClick={() => setReportTarget(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50 }}
        >
          <div
            role="dialog"
            aria-label={REPORT_SHEET_TITLE}
            onClick={(e) => e.stopPropagation()}
            className="mk-box"
            style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 10, borderRadius: '16px 16px 0 0' }}
          >
            <div style={{ fontSize: 18, fontWeight: 800 }}>{REPORT_SHEET_TITLE}</div>
            <p className="mk-muted" style={{ margin: 0, fontSize: 13 }}>{REPORT_SHEET_SUBTITLE}</p>
            {reportPhase === 'sent' ? (
              <HonestNotice>Report sent to Meerkat trust &amp; safety.</HonestNotice>
            ) : (
              <>
                {reportPhase === 'failed' && reportFail ? <HonestNotice>{reportFailMessage(reportFail)}</HonestNotice> : null}
                {PUBLIC_REPORT_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    disabled={reportPhase === 'sending'}
                    onClick={() => onReport(cat.id)}
                    className="mk-chip"
                    style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 2, padding: '12px 14px' }}
                  >
                    <span style={{ fontWeight: 600 }}>{cat.label}</span>
                    {cat.hint ? <span className="mk-muted" style={{ fontSize: 12 }}>{cat.hint}</span> : null}
                  </button>
                ))}
                <span className="mk-muted" style={{ fontSize: 12, textAlign: 'center' }}>{reportPhase === 'sending' ? 'Sending…' : REPORT_SHEET_SUBMIT}</span>
              </>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
