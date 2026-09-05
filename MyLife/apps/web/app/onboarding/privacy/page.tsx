'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  validatePassword,
  getPasswordStrength,
  generatePassphraseSuggestion,
} from '@mylife/auth/password-validation';
import type { PasswordStrength } from '@mylife/auth/types';

// ── Page data ──────────────────────────────────────────────────────

const PAGES = [
  {
    icon: '\uD83D\uDD12',
    title: 'Your data stays yours',
    subtitle:
      'MyLife stores everything on your device. No tracking, no telemetry, no cloud by default. Your personal data never leaves your device unless you choose otherwise.',
    features: [
      { icon: '\uD83D\uDCF1', text: 'All data stored locally on your device' },
      { icon: '\uD83D\uDEAB', text: 'Zero analytics, zero telemetry' },
      { icon: '\u2708\uFE0F', text: 'Works completely offline' },
      { icon: '\uD83D\uDC41\uFE0F', text: 'Open source so you can verify' },
    ],
  },
  {
    icon: '\uD83C\uDF10',
    title: 'Some features need the internet',
    subtitle:
      'A few modules connect to the cloud for live data or cross-device sync. This is always your choice and can be changed in Settings.',
    features: [
      { icon: '\uD83C\uDFC4', text: 'MySurf fetches live wave and tide data' },
      { icon: '\uD83C\uDFCB\uFE0F', text: 'MyWorkouts syncs across your devices' },
      { icon: '\uD83C\uDFE0', text: 'MyHomes connects to listing services' },
      { icon: '\u2705', text: 'Everything else stays fully offline' },
    ],
  },
] as const;

const STRENGTH_SEGMENTS: Record<PasswordStrength, number> = {
  weak: 1,
  fair: 2,
  strong: 3,
  very_strong: 4,
};

const STRENGTH_COLORS: Record<PasswordStrength, string> = {
  weak: '#CC5555',
  fair: '#D97706',
  strong: '#5BA55B',
  very_strong: '#22C55E',
};

const STRENGTH_LABELS: Record<PasswordStrength, string> = {
  weak: 'Weak',
  fair: 'Fair',
  strong: 'Strong',
  very_strong: 'Very Strong',
};

// ── Component ──────────────────────────────────────────────────────

export default function PrivacyOnboardingPage() {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const next = useCallback(() => setPage((p) => p + 1), []);
  const skipToPassword = useCallback(() => setPage(2), []);

  const validation = password.length > 0 ? validatePassword(password) : null;
  const isValid = validation?.valid ?? false;

  const handleComplete = useCallback(() => {
    if (!isValid) return;
    // Password will be consumed by the auth registration flow (Task #4).
    // Proceed to mode selection for now.
    router.push('/onboarding/mode');
  }, [isValid, router]);

  const handleGenerate = useCallback(() => {
    setSuggestion(generatePassphraseSuggestion());
  }, []);

  const handleUseSuggestion = useCallback(() => {
    if (suggestion) setPassword(suggestion);
  }, [suggestion]);

  // ── Story pages (0 & 1) ────────────────────────────────────────

  if (page < 2) {
    const data = PAGES[page]!;
    return (
      <div style={s.wrapper}>
        <div style={s.hero}>
          <span style={s.icon}>{data.icon}</span>
          <h1 style={s.title}>{data.title}</h1>
          <p style={s.subtitle}>{data.subtitle}</p>
        </div>
        <div style={s.features}>
          {data.features.map((f) => (
            <div key={f.text} style={s.featureRow}>
              <span style={s.featureIcon}>{f.icon}</span>
              <span style={s.featureText}>{f.text}</span>
            </div>
          ))}
        </div>
        <div style={s.footer}>
          <button style={s.primaryButton} onClick={next}>
            Continue
          </button>
          <button style={s.ghostButton} onClick={skipToPassword}>
            Skip to password
          </button>
        </div>
      </div>
    );
  }

  // ── Password page (2) ─────────────────────────────────────────

  const strength = validation?.strength ?? 'weak';

  return (
    <div style={s.wrapper}>
      <div style={s.hero}>
        <span style={s.icon}>{'\uD83D\uDEE1\uFE0F'}</span>
        <h1 style={s.title}>Protect your data</h1>
        <p style={s.subtitle}>
          Create a password to secure your local data. We recommend a passphrase:
          just pick 4 random words.
        </p>
      </div>

      {/* Password input */}
      <div style={s.inputSection}>
        <label style={s.label}>PASSWORD</label>
        <div style={s.inputRow}>
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            style={s.input}
            autoComplete="new-password"
          />
          <button
            style={s.toggleButton}
            onClick={() => setShowPassword((v) => !v)}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>

        {/* Strength meter */}
        {password.length > 0 && (
          <div style={s.meterArea}>
            <div style={s.meterBar}>
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    ...s.meterSegment,
                    backgroundColor:
                      i < STRENGTH_SEGMENTS[strength]
                        ? STRENGTH_COLORS[strength]
                        : 'var(--border)',
                  }}
                />
              ))}
            </div>
            <span
              style={{
                ...s.meterLabel,
                color: STRENGTH_COLORS[strength],
              }}
            >
              {STRENGTH_LABELS[strength]}
            </span>
          </div>
        )}

        {/* Validation errors */}
        {validation && validation.errors.length > 0 && (
          <div style={s.errors}>
            {validation.errors.map((msg: string) => (
              <span key={msg} style={s.errorText}>
                {msg}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Passphrase recommendation */}
      <div style={s.card}>
        <h2 style={s.cardTitle}>Try a passphrase instead</h2>
        <p style={s.cardBody}>
          Pick 4 random words. Longer passwords don't need special characters.
        </p>
        <button style={s.secondaryButton} onClick={handleGenerate}>
          Generate suggestion
        </button>
        {suggestion && (
          <div style={s.suggestionArea}>
            <div style={s.suggestionBox}>
              <span style={s.suggestionText}>{suggestion}</span>
            </div>
            <div style={s.meterArea}>
              <div style={s.meterBar}>
                {(() => {
                  const sStrength = getPasswordStrength(suggestion);
                  return [0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      style={{
                        ...s.meterSegment,
                        backgroundColor:
                          i < STRENGTH_SEGMENTS[sStrength]
                            ? STRENGTH_COLORS[sStrength]
                            : 'var(--border)',
                      }}
                    />
                  ));
                })()}
              </div>
              <span
                style={{
                  ...s.meterLabel,
                  color: STRENGTH_COLORS[getPasswordStrength(suggestion)],
                }}
              >
                {STRENGTH_LABELS[getPasswordStrength(suggestion)]}
              </span>
            </div>
            <button style={s.successButton} onClick={handleUseSuggestion}>
              Use this
            </button>
          </div>
        )}
      </div>

      <div style={s.footer}>
        <button
          style={{
            ...s.primaryButton,
            opacity: isValid ? 1 : 0.4,
            cursor: isValid ? 'pointer' : 'not-allowed',
          }}
          onClick={handleComplete}
          disabled={!isValid}
        >
          Create Account
        </button>
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  wrapper: {
    maxWidth: '560px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    paddingTop: '48px',
    paddingBottom: '48px',
  },
  hero: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  icon: {
    fontSize: '56px',
    marginBottom: '16px',
  },
  title: {
    margin: 0,
    fontSize: '28px',
    fontWeight: 700,
    color: 'var(--text)',
  },
  subtitle: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: '16px',
    lineHeight: '24px',
  },
  features: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  featureRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  featureIcon: {
    fontSize: '22px',
    width: '32px',
    textAlign: 'center',
  },
  featureText: {
    color: 'var(--text-secondary)',
    fontSize: '16px',
  },
  footer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    paddingTop: '16px',
  },
  primaryButton: {
    border: 'none',
    background: 'var(--text)',
    color: 'var(--background)',
    borderRadius: 'var(--radius-md)',
    padding: '14px 24px',
    fontWeight: 600,
    fontSize: '16px',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'center',
  },
  ghostButton: {
    border: 'none',
    background: 'transparent',
    color: 'var(--text-tertiary)',
    padding: '10px 24px',
    fontWeight: 500,
    fontSize: '14px',
    cursor: 'pointer',
    textAlign: 'center',
  },
  secondaryButton: {
    border: 'none',
    background: 'var(--surface-elevated)',
    color: 'var(--success, #5BA55B)',
    borderRadius: 'var(--radius-md)',
    padding: '10px 16px',
    fontWeight: 500,
    fontSize: '13px',
    cursor: 'pointer',
    alignSelf: 'flex-start',
  },
  successButton: {
    border: 'none',
    background: '#5BA55B',
    color: 'var(--text)',
    borderRadius: 'var(--radius-md)',
    padding: '10px 16px',
    fontWeight: 500,
    fontSize: '13px',
    cursor: 'pointer',
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: '12px',
    fontWeight: 600,
    letterSpacing: '0.8px',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
  },
  inputSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  inputRow: {
    display: 'flex',
    alignItems: 'center',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    borderRadius: 'var(--radius-md)',
    padding: '0 12px',
    height: '48px',
  },
  input: {
    flex: 1,
    border: 'none',
    background: 'transparent',
    color: 'var(--text)',
    fontFamily: 'Inter, sans-serif',
    fontSize: '16px',
    outline: 'none',
    padding: 0,
  },
  toggleButton: {
    border: 'none',
    background: 'transparent',
    color: 'var(--text-tertiary)',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    marginLeft: '8px',
  },
  meterArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  meterBar: {
    display: 'flex',
    gap: '4px',
    height: '4px',
  },
  meterSegment: {
    flex: 1,
    borderRadius: '4px',
  },
  meterLabel: {
    fontSize: '13px',
    fontWeight: 500,
  },
  errors: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  errorText: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#CC5555',
  },
  card: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--surface)',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  cardTitle: {
    margin: 0,
    color: 'var(--text)',
    fontSize: '18px',
    fontWeight: 600,
  },
  cardBody: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: '16px',
    lineHeight: '24px',
  },
  suggestionArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginTop: '4px',
  },
  suggestionBox: {
    background: 'var(--background)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '16px',
  },
  suggestionText: {
    fontFamily: 'Inter, sans-serif',
    fontSize: '18px',
    fontWeight: 500,
    letterSpacing: '0.5px',
    color: 'var(--text)',
  },
};
