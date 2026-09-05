'use client';

import { Suspense, useCallback, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createFlagAction, submitPhotoReportAction } from '../moderation-actions';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const T = {
  bg: '#131318',
  surfaceLow: '#1B1B20',
  surface: '#1F1F25',
  surfaceHigh: '#2A292F',
  text: '#E4E1E9',
  textSecondary: '#D6C3B5',
  accent: '#22C55E',
  dimText: 'rgba(228,225,233,0.45)',
  danger: '#FFB4AB',
  dangerBg: '#93000A',
} as const;

const REPORT_REASONS = [
  { value: 'ai_generated', label: 'AI-generated photo', description: 'This photo appears to be created by AI, not a real dish' },
  { value: 'stolen', label: 'Stolen photo', description: 'This photo was taken from another source without credit' },
  { value: 'inappropriate', label: 'Inappropriate content', description: 'This contains offensive or inappropriate material' },
  { value: 'wrong_dish', label: 'Wrong dish', description: 'This photo does not match the dish it was submitted for' },
  { value: 'other', label: 'Other', description: 'Another reason not listed above' },
] as const;

type ReportReason = (typeof REPORT_REASONS)[number]['value'];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function ReportContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const targetType = searchParams.get('type') ?? 'submission';
  const targetId = searchParams.get('targetId') ?? '';

  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<'success' | 'error' | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = useCallback(async () => {
    if (!reason || !targetId) return;

    setSubmitting(true);
    setResult(null);
    setErrorMsg('');

    try {
      // Photo reports use the dedicated photo report endpoint
      if (targetType === 'photo' || targetType === 'submission') {
        const reportResult = await submitPhotoReportAction(
          targetId,
          'current-user', // placeholder; auth provides real ID in production
          reason,
        );

        if (!reportResult.ok) {
          setResult('error');
          setErrorMsg(reportResult.error ?? 'Failed to submit report');
          return;
        }
      }

      // Also create a flag with the detailed reason
      const fullReason = details
        ? `${REPORT_REASONS.find((r) => r.value === reason)?.label}: ${details}`
        : REPORT_REASONS.find((r) => r.value === reason)?.label ?? reason;

      const flagResult = await createFlagAction(
        targetType === 'photo' ? 'photo' : targetType,
        targetId,
        'current-user',
        fullReason,
      );

      if (!flagResult.ok) {
        setResult('error');
        setErrorMsg(flagResult.error ?? 'Failed to create flag');
        return;
      }

      setResult('success');

      // Redirect back after a brief delay
      setTimeout(() => {
        router.back();
      }, 2000);
    } catch {
      setResult('error');
      setErrorMsg('An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  }, [reason, details, targetId, targetType, router]);

  /* ---------------------------------------------------------------- */
  /*  Missing target                                                    */
  /* ---------------------------------------------------------------- */

  if (!targetId) {
    return (
      <div style={{ minHeight: '100vh', color: T.text, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        <div style={{ padding: '120px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{'\u26A0\uFE0F'}</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: T.danger, marginBottom: 8 }}>
            Missing target
          </div>
          <div style={{ fontSize: 14, color: T.textSecondary, marginBottom: 24 }}>
            No item was specified to report.
          </div>
          <Link
            href="/recipes"
            style={{ color: T.accent, fontSize: 14, textDecoration: 'none', fontWeight: 600 }}
          >
            Back to Recipes
          </Link>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Success state                                                     */
  /* ---------------------------------------------------------------- */

  if (result === 'success') {
    return (
      <div style={{ minHeight: '100vh', color: T.text, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        <div style={{ padding: '120px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{'\u2705'}</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            Report submitted
          </div>
          <div style={{ fontSize: 14, color: T.textSecondary, marginBottom: 24 }}>
            Thank you for helping keep BestChef trustworthy. We will review your report.
          </div>
          <div style={{ fontSize: 12, color: T.dimText }}>
            Redirecting back...
          </div>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Main form                                                         */
  /* ---------------------------------------------------------------- */

  return (
    <div style={{ minHeight: '100vh', color: T.text, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      {/* Breadcrumb */}
      <button
        type="button"
        onClick={() => router.back()}
        style={{
          background: 'none',
          border: 'none',
          color: T.textSecondary,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          marginBottom: 24,
          display: 'inline-block',
          padding: 0,
        }}
      >
        &#x2190; Back
      </button>

      <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 8 }}>
        Report Content
      </h1>
      <p style={{ fontSize: 14, color: T.textSecondary, marginBottom: 32, lineHeight: 1.6 }}>
        Help us maintain quality by reporting content that violates our guidelines.
        Reports are reviewed by the community and moderation team.
      </p>

      {/* Reason selector */}
      <div style={{ marginBottom: 24 }}>
        <label style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
          color: T.textSecondary,
          display: 'block',
          marginBottom: 12,
        }}>
          Reason for report
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {REPORT_REASONS.map((r) => (
            <label
              key={r.value}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '14px 16px',
                borderRadius: 12,
                background: reason === r.value ? T.surfaceHigh : T.surfaceLow,
                border: `1px solid ${reason === r.value ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)'}`,
                cursor: 'pointer',
                transition: 'background 0.2s, border-color 0.2s',
              }}
            >
              <input
                type="radio"
                name="reason"
                value={r.value}
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
                style={{
                  marginTop: 2,
                  accentColor: T.accent,
                  width: 16,
                  height: 16,
                  flexShrink: 0,
                }}
              />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{r.label}</div>
                <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>
                  {r.description}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Additional details */}
      <div style={{ marginBottom: 32 }}>
        <label style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
          color: T.textSecondary,
          display: 'block',
          marginBottom: 8,
        }}>
          Additional details {reason === 'other' ? '(required)' : '(optional)'}
        </label>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Provide any additional context that might help reviewers..."
          maxLength={500}
          rows={4}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 12,
            background: T.surfaceLow,
            border: '1px solid rgba(255,255,255,0.06)',
            color: T.text,
            fontSize: 14,
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            resize: 'vertical',
            outline: 'none',
          }}
        />
        <div style={{ fontSize: 11, color: T.dimText, marginTop: 4, textAlign: 'right' }}>
          {details.length}/500
        </div>
      </div>

      {/* Error */}
      {result === 'error' && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 10,
          background: T.dangerBg,
          color: T.danger,
          fontSize: 13,
          marginBottom: 16,
        }}>
          {errorMsg}
        </div>
      )}

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!reason || submitting || (reason === 'other' && !details.trim())}
        style={{
          padding: '14px 32px',
          borderRadius: 9999,
          border: 'none',
          background: !reason || submitting || (reason === 'other' && !details.trim())
            ? T.surfaceHigh
            : '#EF4444',
          color: !reason || submitting || (reason === 'other' && !details.trim())
            ? T.dimText
            : '#fff',
          fontWeight: 700,
          fontSize: 14,
          cursor: !reason || submitting ? 'default' : 'pointer',
          transition: 'background 0.2s, color 0.2s',
          width: '100%',
        }}
      >
        {submitting ? 'Submitting...' : 'Submit Report'}
      </button>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={null}>
      <ReportContent />
    </Suspense>
  );
}
