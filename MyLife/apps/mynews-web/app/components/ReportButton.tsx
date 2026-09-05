'use client';

import { useCallback, useId, useReducer, useRef, useState } from 'react';
import {
  REPORT_REASONS,
  REPORT_REASON_HINTS,
  REPORT_REASON_LABELS,
  reportErrorMessage,
  type ReportReason,
  type ReportTargetKind,
} from '@mylife/mynews/cloud-fetch';
import {
  INITIAL_OTP_STATE,
  isOtpBusy,
  isPlausibleEmail,
  otpErrorMessage,
  otpReducer,
  OTP_CODE_LENGTH,
  type OtpErrorCode,
} from '@/lib/otp-flow';

type ReportErrorCode = Parameters<typeof reportErrorMessage>[0];

/**
 * Public-web report affordance (plan 48 WP10, finding C10).
 *
 * The report path itself is unchanged: POST `/api/report`, which forwards to the
 * `mynews-report` edge function and the WP1 intake RPC behind it. What changed is
 * that a website reader can now hold the session that path requires.
 *
 * Sign-in is a sheet INSIDE this card, not a redirect to the app and not a
 * navigation to a login page. That is the design constraint: a reader who has
 * picked a reason and typed two sentences of detail must not lose either in order
 * to authenticate. Email OTP posts with `fetch`, nothing navigates, and the reason
 * and detail stay in component state throughout. When verification succeeds the
 * report submits immediately, so the reader's original click is what completes.
 *
 * Every state is driven by the typed envelope from the server. Nothing here
 * fabricates a success, and nothing claims a report was filed unless the function
 * said so.
 */
export function ReportButton({
  targetKind,
  targetId,
  label,
  /** Server-read session state. False means no verified session on this request. */
  signedIn,
  /**
   * `capabilities.webReporting`. False means this deployment has not switched on
   * website reporting, and the card says so instead of offering a form whose
   * outcome we cannot stand behind.
   */
  reportingEnabled,
}: {
  targetKind: ReportTargetKind;
  targetId: string;
  label?: string;
  signedIn: boolean;
  reportingEnabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<'submitted' | 'already-reported' | null>(null);

  // Sign-in is only revealed when it is actually needed: either the server said
  // there is no session, or the function rejected the token we sent.
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [otp, dispatch] = useReducer(otpReducer, INITIAL_OTP_STATE);

  const emailRef = useRef<HTMLInputElement>(null);
  const formId = useId();
  const hasSession = signedIn || otp.stage === 'signed-in';

  const submitReport = useCallback(
    async (chosen: ReportReason, body: string) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch('/api/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetKind, targetId, reason: chosen, detail: body.trim() }),
        });
        const payload = (await res.json().catch(() => null)) as
          | { ok: true; data?: { status?: 'submitted' | 'already-reported' } }
          | { ok: false; error?: string }
          | null;
        if (payload && payload.ok) {
          setDone(payload.data?.status === 'already-reported' ? 'already-reported' : 'submitted');
          return;
        }
        const code = mapCode(payload && !payload.ok ? payload.error : undefined);
        if (code === 'not-signed-in') {
          // The session we thought we had is gone or expired. Reveal sign-in
          // rather than telling the reader to go and use the app.
          setNeedsSignIn(true);
          dispatch({ type: 'restart' });
          requestAnimationFrame(() => emailRef.current?.focus());
          return;
        }
        setError(reportErrorMessage(code).message);
      } catch {
        setError(reportErrorMessage('network').message);
      } finally {
        setBusy(false);
      }
    },
    [targetId, targetKind],
  );

  function onSubmitClick() {
    if (!reason) return;
    if (!hasSession) {
      setNeedsSignIn(true);
      setError(null);
      requestAnimationFrame(() => emailRef.current?.focus());
      return;
    }
    void submitReport(reason, detail);
  }

  async function onSendCode(event: React.FormEvent) {
    event.preventDefault();
    dispatch({ type: 'send' });
    if (!isPlausibleEmail(otp.email)) return;
    try {
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: otp.email, next: window.location.pathname }),
      });
      const payload = (await res.json().catch(() => null)) as
        | { ok: true }
        | { ok: false; error?: string }
        | null;
      if (payload && payload.ok) {
        dispatch({ type: 'send-ok' });
      } else {
        dispatch({
          type: 'send-failed',
          error: mapOtpCode(payload && !payload.ok ? payload.error : undefined),
        });
      }
    } catch {
      dispatch({ type: 'send-failed', error: 'network' });
    }
  }

  async function onVerifyCode(event: React.FormEvent) {
    event.preventDefault();
    dispatch({ type: 'verify' });
    const code = otp.code;
    if (code.length !== OTP_CODE_LENGTH) return;
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: otp.email, code }),
      });
      const payload = (await res.json().catch(() => null)) as
        | { ok: true }
        | { ok: false; error?: string }
        | null;
      if (payload && payload.ok) {
        dispatch({ type: 'verify-ok' });
        setNeedsSignIn(false);
        // The reader already asked for this report to be sent; finish the job.
        if (reason) void submitReport(reason, detail);
      } else {
        dispatch({
          type: 'verify-failed',
          error: mapOtpCode(payload && !payload.ok ? payload.error : undefined),
        });
      }
    } catch {
      dispatch({ type: 'verify-failed', error: 'network' });
    }
  }

  if (!reportingEnabled) {
    return (
      <p className="muted report-note">
        Reporting from this website is not switched on for this deployment. Use the report tool in
        the MyNews app, which reaches the same review queue.
      </p>
    );
  }

  if (done) {
    return (
      <div className="card report-card" role="status">
        <h2 className="card-title">
          {done === 'already-reported' ? 'Already reported' : 'Report submitted'}
        </h2>
        <p className="card-body">
          {done === 'already-reported'
            ? 'You already have an open report on this. Our team reviews reports and takes action where needed.'
            : 'Thanks. Our team reviews reports and takes action where needed.'}
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        className="report-trigger"
        aria-expanded={false}
        onClick={() => setOpen(true)}
      >
        {label ?? 'Report'}
      </button>
    );
  }

  const otpBusy = isOtpBusy(otp);
  const signInVisible = needsSignIn && !hasSession;

  return (
    <div className="card report-card">
      <h2 className="card-title">Report this content</h2>
      <fieldset className="report-fieldset">
        <legend className="card-body">Choose the closest reason.</legend>
        <div className="report-reasons">
          {REPORT_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              className={`report-reason${reason === r ? ' report-reason-active' : ''}`}
              aria-pressed={reason === r}
              onClick={() => setReason(r)}
            >
              {REPORT_REASON_LABELS[r]}
            </button>
          ))}
        </div>
      </fieldset>
      {/* Plan 48 WP8: the taxonomy is thirteen reasons now, so the form explains
          the selected one. Reason accuracy is what the severity rank and the SLA
          routing depend on. */}
      <p className="report-hint" aria-live="polite">
        {reason ? REPORT_REASON_HINTS[reason] : ''}
      </p>
      <label className="report-label" htmlFor={`${formId}-detail`}>
        Add detail (optional)
      </label>
      <textarea
        id={`${formId}-detail`}
        className="report-detail"
        value={detail}
        maxLength={2000}
        onChange={(e) => setDetail(e.target.value)}
      />

      {signInVisible ? (
        <div className="signin-sheet">
          <h3 className="signin-title">Confirm it is you</h3>
          <p className="card-body">
            Reports are tied to an account so we can act on them and so you can be told what
            happened. We will email you a {OTP_CODE_LENGTH}-digit code. Your report stays on this
            page while you sign in.
          </p>
          {otp.stage === 'code' || otp.stage === 'verifying' ? (
            <form className="signin-form" onSubmit={onVerifyCode}>
              <p className="muted">
                Code sent to {otp.email}. It expires shortly, so check your email now.
              </p>
              <label className="report-label" htmlFor={`${formId}-code`}>
                {OTP_CODE_LENGTH}-digit code
              </label>
              <input
                id={`${formId}-code`}
                className="signin-input"
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={OTP_CODE_LENGTH}
                value={otp.code}
                disabled={otpBusy}
                onChange={(e) => dispatch({ type: 'edit-code', value: e.target.value })}
              />
              <div className="report-actions">
                <button className="report-submit" type="submit" disabled={otpBusy} aria-busy={otpBusy}>
                  {otp.stage === 'verifying' ? 'Checking...' : 'Verify and send report'}
                </button>
                <button
                  className="report-cancel"
                  type="button"
                  disabled={otpBusy}
                  onClick={() => dispatch({ type: 'restart' })}
                >
                  Use a different email
                </button>
              </div>
            </form>
          ) : (
            <form className="signin-form" onSubmit={onSendCode}>
              <label className="report-label" htmlFor={`${formId}-email`}>
                Email on your MyNews account
              </label>
              <input
                id={`${formId}-email`}
                ref={emailRef}
                className="signin-input"
                name="email"
                type="email"
                autoComplete="email"
                value={otp.email}
                disabled={otpBusy}
                onChange={(e) => dispatch({ type: 'edit-email', value: e.target.value })}
              />
              <p className="muted">
                Signing in here does not create an account. If you do not have one yet, create it in
                the MyNews app.
              </p>
              <div className="report-actions">
                <button className="report-submit" type="submit" disabled={otpBusy} aria-busy={otpBusy}>
                  {otp.stage === 'sending' ? 'Sending...' : 'Email me a code'}
                </button>
                <button
                  className="report-cancel"
                  type="button"
                  disabled={otpBusy}
                  onClick={() => setNeedsSignIn(false)}
                >
                  Not now
                </button>
              </div>
            </form>
          )}
          <p className="report-error" role="alert">
            {otp.error ? otpErrorMessage(otp.error) : ''}
          </p>
        </div>
      ) : null}

      <p className="report-error" role="alert">
        {error ?? ''}
      </p>
      {signInVisible ? null : (
        <div className="report-actions">
          <button
            type="button"
            className="report-submit"
            disabled={!reason || busy}
            aria-busy={busy}
            onClick={onSubmitClick}
          >
            {busy ? 'Submitting...' : 'Submit report'}
          </button>
          <button type="button" className="report-cancel" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function mapCode(error: string | undefined): ReportErrorCode {
  switch (error) {
    case 'not-signed-in':
    case 'no-profile':
    case 'bad-target':
    case 'rate-limited':
    case 'network':
      return error;
    case 'not-configured':
      return 'network';
    default:
      return 'unknown';
  }
}

function mapOtpCode(error: string | undefined): OtpErrorCode {
  switch (error) {
    case 'invalid-email':
    case 'invalid-code':
    case 'not-configured':
    case 'network':
      return error;
    default:
      return 'send-failed';
  }
}
