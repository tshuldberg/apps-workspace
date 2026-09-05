'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { forkRecipeAction, getSubmissionByIdAction } from '../comment-actions';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SnapshotInfo {
  id: string;
  title: string;
  profileId: string;
}

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
  accent: '#22C55E',
  accentLight: '#4ADE80',
  dimText: 'rgba(228,225,233,0.45)',
  glass: 'rgba(255,255,255,0.03)',
  glassBorder: 'rgba(255,255,255,0.10)',
  danger: '#FFB4AB',
  success: '#30D158',
} as const;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function RemixPageContent() {
  const searchParams = useSearchParams();
  const snapshotId = searchParams.get('snapshotId') ?? '';

  const [source, setSource] = useState<SnapshotInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    snapshotId: string;
  } | null>(null);

  const loadSource = useCallback(async () => {
    if (!snapshotId) {
      setError('No snapshot ID provided');
      setLoading(false);
      return;
    }
    try {
      const result = await getSubmissionByIdAction(snapshotId);
      if (result.ok && result.data) {
        const data = result.data as unknown as {
          snapshot: { id: string; title: string; profileId: string };
        };
        setSource({
          id: data.snapshot.id,
          title: data.snapshot.title,
          profileId: data.snapshot.profileId,
        });
      } else {
        setError('Recipe not found');
      }
    } catch {
      setError('Failed to load recipe');
    } finally {
      setLoading(false);
    }
  }, [snapshotId]);

  useEffect(() => {
    loadSource();
  }, [loadSource]);

  const handleFork = async () => {
    if (!source) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const modifications = description.trim()
        ? { description: description.trim() }
        : undefined;
      const result = await forkRecipeAction(source.id, 'current-user', modifications);
      if (result.ok && result.data) {
        setSuccessResult({ snapshotId: result.data.snapshot.id });
      } else {
        setSubmitError(result.error ?? 'Failed to create remix');
      }
    } catch {
      setSubmitError('Failed to create remix');
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Render states                                                    */
  /* ---------------------------------------------------------------- */

  if (!snapshotId) {
    return (
      <div style={{ minHeight: '100vh', color: T.text, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        <div style={{ padding: '120px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{'\u{1F500}'}</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: T.danger, marginBottom: 8 }}>
            Missing snapshot ID
          </div>
          <Link
            href="/recipes"
            style={{ color: T.accent, fontSize: 14, textDecoration: 'none', fontWeight: 600 }}
          >
            Back to recipes
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', color: T.text, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        <div style={{ padding: '120px 0', textAlign: 'center', color: T.dimText, fontSize: 14 }}>
          Loading recipe...
        </div>
      </div>
    );
  }

  if (error || !source) {
    return (
      <div style={{ minHeight: '100vh', color: T.text, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        <div style={{ padding: '120px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{'\u{1F614}'}</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: T.danger, marginBottom: 8 }}>
            {error ?? 'Recipe not found'}
          </div>
          <Link
            href="/recipes"
            style={{ color: T.accent, fontSize: 14, textDecoration: 'none', fontWeight: 600 }}
          >
            Back to recipes
          </Link>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Success state                                                    */
  /* ---------------------------------------------------------------- */

  if (successResult) {
    return (
      <div style={{ minHeight: '100vh', color: T.text, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        <div style={{ padding: '120px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 20 }}>{'\u{1F389}'}</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>
            Remix Created!
          </h1>
          <p style={{ fontSize: 15, color: T.textSecondary, marginBottom: 8 }}>
            Your remix of &ldquo;{source.title}&rdquo; is ready.
          </p>
          <p style={{
            fontSize: 13,
            fontStyle: 'italic',
            color: T.textSecondary,
            marginBottom: 32,
          }}>
            Inspired by @{source.profileId.slice(0, 8)}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Link
              href="/recipes"
              style={{
                padding: '12px 28px',
                borderRadius: 9999,
                border: `1px solid ${T.glassBorder}`,
                color: T.text,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: 'none',
                transition: 'background 0.2s',
              }}
            >
              Back to Recipes
            </Link>
            <Link
              href={`/recipes/lineage?snapshotId=${successResult.snapshotId}`}
              style={{
                padding: '12px 28px',
                borderRadius: 9999,
                background: `linear-gradient(135deg, ${T.accent}, ${T.accentLight})`,
                color: '#131318',
                fontSize: 14,
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              View Lineage
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Main render                                                      */
  /* ---------------------------------------------------------------- */

  return (
    <div style={{ minHeight: '100vh', color: T.text, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      {/* Breadcrumb */}
      <Link
        href="/recipes"
        style={{
          color: T.textSecondary,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          textDecoration: 'none',
          marginBottom: 24,
          display: 'inline-block',
        }}
      >
        &#x2190; Back
      </Link>

      <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 24 }}>
        Remix Recipe
      </h1>

      {/* Source recipe card */}
      <div style={{
        background: T.glass,
        border: `1px solid ${T.glassBorder}`,
        borderRadius: 14,
        padding: '16px 20px',
        marginBottom: 32,
      }}>
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
          color: T.dimText,
          marginBottom: 8,
        }}>
          Remixing
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 4 }}>
          {source.title}
        </div>
        <div style={{ fontSize: 13, fontStyle: 'italic', color: T.textSecondary }}>
          by @{source.profileId.slice(0, 8)}
        </div>
      </div>

      {/* Modification form */}
      <div style={{
        background: T.glass,
        border: `1px solid ${T.glassBorder}`,
        borderRadius: 16,
        padding: 24,
        marginBottom: 24,
      }}>
        <h3 style={{
          fontSize: 14,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: 16,
        }}>
          What did you change?
        </h3>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your modifications (optional). e.g., &quot;Swapped butter for coconut oil and added cardamom&quot;"
          style={{
            width: '100%',
            minHeight: 120,
            background: T.surfaceLow,
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 12,
            padding: '12px 16px',
            color: T.text,
            fontSize: 14,
            lineHeight: 1.6,
            resize: 'vertical',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 16,
        }}>
          <p style={{ fontSize: 13, fontStyle: 'italic', color: T.textSecondary, margin: 0 }}>
            Attribution: Inspired by @{source.profileId.slice(0, 8)}
          </p>
          <button
            type="button"
            onClick={handleFork}
            disabled={submitting}
            style={{
              padding: '12px 32px',
              borderRadius: 9999,
              border: 'none',
              background: `linear-gradient(135deg, ${T.accent}, ${T.accentLight})`,
              color: '#131318',
              fontWeight: 700,
              fontSize: 14,
              cursor: submitting ? 'default' : 'pointer',
              opacity: submitting ? 0.6 : 1,
              transition: 'all 0.2s',
            }}
          >
            {submitting ? 'Creating Remix...' : 'Create Remix'}
          </button>
        </div>

        {submitError && (
          <p style={{ fontSize: 13, color: T.danger, marginTop: 12 }}>{submitError}</p>
        )}
      </div>
    </div>
  );
}

export default function RemixPage() {
  return (
    <Suspense fallback={null}>
      <RemixPageContent />
    </Suspense>
  );
}
