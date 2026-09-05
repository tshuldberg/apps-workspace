'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  applyForCreatorAction,
  getApplicationAction,
} from '../../creator-actions';

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

const SPECIALTY_OPTIONS = [
  'Italian', 'Japanese', 'Mexican', 'Thai', 'French', 'Indian',
  'Korean', 'Chinese', 'Mediterranean', 'American', 'Middle Eastern',
  'Baking', 'Pastry', 'BBQ', 'Seafood', 'Vegan', 'Vegetarian',
  'Gluten-Free', 'Fermentation', 'Molecular Gastronomy',
];

const STATUS_CONFIG: Record<string, { icon: string; color: string; label: string; description: string }> = {
  pending: {
    icon: '\u{23F3}',
    color: T.goldLight,
    label: 'Application Pending',
    description: 'Your application is being reviewed. We will notify you once a decision is made.',
  },
  approved: {
    icon: '\u{2705}',
    color: T.green,
    label: 'Approved!',
    description: 'Congratulations! You are a verified creator. Head to your dashboard to get started.',
  },
  rejected: {
    icon: '\u{274C}',
    color: T.danger,
    label: 'Application Declined',
    description: 'Unfortunately your application was not approved at this time. You can reapply in the future.',
  },
};

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ApplicationData {
  id: string;
  profileId: string;
  platformLinks: unknown;
  bio: string;
  specialties: string[];
  status: string;
  reviewedAt: string | null;
  reviewerNote: string | null;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function CreatorApplyPage() {
  const profileId = 'current-user';

  const [existing, setExisting] = useState<ApplicationData | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [instagram, setInstagram] = useState('');
  const [youtube, setYoutube] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [website, setWebsite] = useState('');
  const [bio, setBio] = useState('');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await getApplicationAction(profileId);
        if (res.ok && res.data) {
          setExisting(res.data as unknown as ApplicationData);
        }
      } catch {
        // no existing application
      } finally {
        setLoading(false);
      }
    })();
  }, [profileId]);

  const toggleSpecialty = (s: string) => {
    setSpecialties((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  };

  const handleSubmit = useCallback(async () => {
    if (bio.trim().length === 0) {
      setResult({ type: 'error', msg: 'Bio is required' });
      return;
    }
    if (specialties.length === 0) {
      setResult({ type: 'error', msg: 'Select at least one specialty' });
      return;
    }

    setSubmitting(true);
    setResult(null);

    const platformLinks = {
      ...(instagram && { instagram }),
      ...(youtube && { youtube }),
      ...(tiktok && { tiktok }),
      ...(website && { website }),
    };

    try {
      const res = await applyForCreatorAction(profileId, platformLinks, bio, specialties);
      if (res.ok) {
        setResult({ type: 'success', msg: 'Application submitted!' });
        if (res.data) {
          setExisting(res.data as unknown as ApplicationData);
        }
      } else {
        setResult({ type: 'error', msg: res.error ?? 'Failed to submit' });
      }
    } catch {
      setResult({ type: 'error', msg: 'Something went wrong' });
    } finally {
      setSubmitting(false);
    }
  }, [bio, specialties, instagram, youtube, tiktok, website, profileId]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', color: T.text, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        <div style={{ padding: '120px 0', textAlign: 'center', color: T.dimText, fontSize: 14 }}>
          Loading...
        </div>
      </div>
    );
  }

  // Show existing application status
  if (existing) {
    const config = STATUS_CONFIG[existing.status] ?? STATUS_CONFIG.pending;
    return (
      <div style={{ minHeight: '100vh', color: T.text, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        <Link
          href="/recipes"
          style={{
            color: T.textSecondary,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            marginBottom: 32,
            display: 'inline-block',
          }}
        >
          &#x2190; Recipes
        </Link>

        <div style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center', paddingTop: 40 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>{config.icon}</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, color: config.color }}>
            {config.label}
          </h1>
          <p style={{ fontSize: 14, color: T.textSecondary, lineHeight: 1.6, marginBottom: 24 }}>
            {config.description}
          </p>

          {existing.reviewerNote && (
            <div style={{
              background: T.surfaceLow,
              borderRadius: 12,
              padding: 16,
              marginBottom: 24,
              textAlign: 'left',
            }}>
              <div style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                color: T.dimText,
                marginBottom: 8,
              }}>
                Reviewer Note
              </div>
              <p style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.5 }}>
                {existing.reviewerNote}
              </p>
            </div>
          )}

          <div style={{ fontSize: 12, color: T.dimText }}>
            Applied {new Date(existing.createdAt).toLocaleDateString()}
          </div>

          {existing.status === 'approved' && (
            <Link
              href="/recipes/creator"
              style={{
                display: 'inline-block',
                marginTop: 24,
                padding: '14px 32px',
                borderRadius: 9999,
                background: `linear-gradient(135deg, ${T.green}, ${T.greenLight})`,
                color: '#131318',
                fontWeight: 700,
                fontSize: 14,
                textDecoration: 'none',
              }}
            >
              Go to Dashboard
            </Link>
          )}
        </div>
      </div>
    );
  }

  // Application form
  return (
    <div style={{ minHeight: '100vh', color: T.text, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <Link
        href="/recipes"
        style={{
          color: T.textSecondary,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          textDecoration: 'none',
          marginBottom: 32,
          display: 'inline-block',
        }}
      >
        &#x2190; Recipes
      </Link>

      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>{'\u{1F468}\u{200D}\u{1F373}'}</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 8 }}>
            Become a Creator
          </h1>
          <p style={{ fontSize: 14, color: T.textSecondary, lineHeight: 1.6, maxWidth: 400, margin: '0 auto' }}>
            Earn from your cooking through tips, subscriptions, and exclusive content.
          </p>
        </div>

        {/* Result banner */}
        {result && (
          <div style={{
            background: result.type === 'success' ? `${T.green}15` : '#93000A22',
            border: `1px solid ${result.type === 'success' ? T.green : '#93000A'}`,
            borderRadius: 12,
            padding: '12px 16px',
            marginBottom: 16,
            fontSize: 13,
            color: result.type === 'success' ? T.green : T.danger,
          }}>
            {result.msg}
          </div>
        )}

        {/* Platform links */}
        <section style={{
          background: T.surfaceLow,
          borderRadius: 16,
          padding: 24,
          marginBottom: 20,
        }}>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            color: T.textSecondary,
            marginBottom: 16,
          }}>
            Platform Links
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <FormInput label="Instagram" value={instagram} onChange={setInstagram} placeholder="@username" />
            <FormInput label="YouTube" value={youtube} onChange={setYoutube} placeholder="Channel URL" />
            <FormInput label="TikTok" value={tiktok} onChange={setTiktok} placeholder="@username" />
            <FormInput label="Website" value={website} onChange={setWebsite} placeholder="https://" />
          </div>
        </section>

        {/* Bio */}
        <section style={{
          background: T.surfaceLow,
          borderRadius: 16,
          padding: 24,
          marginBottom: 20,
        }}>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            color: T.textSecondary,
            marginBottom: 12,
          }}>
            Bio
          </div>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell us about your cooking background, style, and what makes you unique..."
            rows={5}
            style={{
              width: '100%',
              padding: 14,
              borderRadius: 12,
              border: `1px solid ${T.surfaceHigh}`,
              background: T.surface,
              color: T.text,
              fontSize: 14,
              lineHeight: 1.6,
              resize: 'vertical',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
        </section>

        {/* Specialties */}
        <section style={{
          background: T.surfaceLow,
          borderRadius: 16,
          padding: 24,
          marginBottom: 24,
        }}>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            color: T.textSecondary,
            marginBottom: 16,
          }}>
            Specialties
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SPECIALTY_OPTIONS.map((s) => {
              const isSelected = specialties.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSpecialty(s)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 9999,
                    border: 'none',
                    background: isSelected ? `${T.green}22` : 'rgba(255,255,255,0.03)',
                    color: isSelected ? T.green : T.textSecondary,
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: 'pointer',
                    outline: isSelected ? `1px solid ${T.green}44` : '1px solid transparent',
                    transition: 'all 0.2s',
                  }}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </section>

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            width: '100%',
            padding: '16px 0',
            borderRadius: 9999,
            border: 'none',
            background: `linear-gradient(135deg, ${T.green}, ${T.greenLight})`,
            color: '#131318',
            fontWeight: 700,
            fontSize: 16,
            cursor: submitting ? 'not-allowed' : 'pointer',
            opacity: submitting ? 0.6 : 1,
            transition: 'opacity 0.2s',
          }}
        >
          {submitting ? 'Submitting...' : 'Submit Application'}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function FormInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label style={{
        display: 'block',
        fontSize: 12,
        fontWeight: 600,
        color: '#D6C3B5',
        marginBottom: 6,
      }}>
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '10px 14px',
          borderRadius: 10,
          border: '1px solid #2A292F',
          background: '#1F1F25',
          color: '#E4E1E9',
          fontSize: 14,
          outline: 'none',
        }}
      />
    </div>
  );
}
