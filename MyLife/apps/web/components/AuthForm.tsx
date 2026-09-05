'use client';

import { useState, useCallback } from 'react';
import {
  validatePassword,
  getPasswordStrength,
  generatePassphraseSuggestion,
} from '@mylife/auth/password-validation';
import type { PasswordStrength } from '@mylife/auth/types';

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

interface AuthFormProps {
  mode: 'sign-up' | 'sign-in';
  onSubmit: (email: string, password: string, displayName?: string) => Promise<void>;
  error?: string;
  /** Link to the alternate mode (e.g. "Already have an account? Sign in") */
  altLink?: React.ReactNode;
}

export function WebAuthForm({ mode, onSubmit, error, altLink }: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSignUp = mode === 'sign-up';
  const validation = password.length > 0 ? validatePassword(password) : null;
  const strength = validation?.strength ?? 'weak';
  const canSubmit =
    email.trim().length > 0 &&
    password.length > 0 &&
    (validation?.valid ?? false) &&
    (!isSignUp || displayName.trim().length > 0) &&
    !loading;

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!canSubmit) return;
      setLoading(true);
      try {
        await onSubmit(email.trim(), password, isSignUp ? displayName.trim() : undefined);
      } finally {
        setLoading(false);
      }
    },
    [canSubmit, email, password, displayName, isSignUp, onSubmit],
  );

  const handleGenerate = useCallback(() => {
    setSuggestion(generatePassphraseSuggestion());
  }, []);

  const handleUseSuggestion = useCallback(() => {
    if (suggestion) setPassword(suggestion);
  }, [suggestion]);

  return (
    <div style={s.container}>
      <div style={s.header}>
        <h1 style={s.title}>{isSignUp ? 'Create account' : 'Welcome back'}</h1>
        <p style={s.subtitle}>
          {isSignUp
            ? 'Your data stays on your device. This password protects it.'
            : 'Enter your credentials to unlock your data.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} style={s.form}>
        {/* Email */}
        <div style={s.fieldGroup}>
          <label style={s.label}>EMAIL</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
            style={s.input}
          />
        </div>

        {/* Display name (sign-up only) */}
        {isSignUp && (
          <div style={s.fieldGroup}>
            <label style={s.label}>DISPLAY NAME</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              required
              autoComplete="name"
              style={s.input}
            />
          </div>
        )}

        {/* Password */}
        <div style={s.fieldGroup}>
          <label style={s.label}>PASSWORD</label>
          <div style={s.inputRow}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSignUp ? 'Create a password' : 'Enter your password'}
              required
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              style={{ ...s.input, border: 'none', padding: 0, height: 'auto' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              style={s.toggleButton}
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
                          : 'var(--border, #2A2520)',
                    }}
                  />
                ))}
              </div>
              <span style={{ fontSize: 13, fontWeight: 500, color: STRENGTH_COLORS[strength] }}>
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

        {/* Passphrase recommendation (sign-up only) */}
        {isSignUp && (
          <div style={s.card}>
            <h2 style={s.cardTitle}>Try a passphrase instead</h2>
            <p style={s.cardBody}>
              Pick 4 random words. Longer passwords don't need special characters.
            </p>
            <button type="button" style={s.generateButton} onClick={handleGenerate}>
              Generate suggestion
            </button>
            {suggestion && (
              <div style={s.suggestionArea}>
                <div style={s.suggestionBox}>
                  <span style={s.suggestionText}>{suggestion}</span>
                </div>
                {(() => {
                  const sStrength = getPasswordStrength(suggestion);
                  return (
                    <div style={s.meterArea}>
                      <div style={s.meterBar}>
                        {[0, 1, 2, 3].map((i) => (
                          <div
                            key={i}
                            style={{
                              ...s.meterSegment,
                              backgroundColor:
                                i < STRENGTH_SEGMENTS[sStrength]
                                  ? STRENGTH_COLORS[sStrength]
                                  : 'var(--border, #2A2520)',
                            }}
                          />
                        ))}
                      </div>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: STRENGTH_COLORS[sStrength],
                        }}
                      >
                        {STRENGTH_LABELS[sStrength]}
                      </span>
                    </div>
                  );
                })()}
                <button type="button" style={s.useButton} onClick={handleUseSuggestion}>
                  Use this
                </button>
              </div>
            )}
          </div>
        )}

        {/* Backend error */}
        {error && <span style={s.errorText}>{error}</span>}

        {/* Submit */}
        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            ...s.submitButton,
            opacity: canSubmit ? 1 : 0.4,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}
        >
          {loading
            ? isSignUp
              ? 'Creating account...'
              : 'Signing in...'
            : isSignUp
              ? 'Create Account'
              : 'Sign In'}
        </button>
      </form>

      {altLink && <div style={s.altLink}>{altLink}</div>}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 420,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    paddingTop: 48,
    paddingBottom: 48,
  },
  header: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 700,
    color: 'var(--text, #F4EDE2)',
  },
  subtitle: {
    margin: 0,
    fontSize: 16,
    lineHeight: '24px',
    color: 'var(--text-secondary, #A99E8E)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 0.8,
    color: 'var(--text-secondary, #A99E8E)',
    textTransform: 'uppercase' as const,
  },
  input: {
    border: '1px solid var(--border, #2A2520)',
    background: 'var(--surface, #1A1814)',
    color: 'var(--text, #F4EDE2)',
    borderRadius: 8,
    padding: '12px',
    fontSize: 16,
    fontFamily: 'Inter, sans-serif',
    outline: 'none',
  },
  inputRow: {
    display: 'flex',
    alignItems: 'center',
    border: '1px solid var(--border, #2A2520)',
    background: 'var(--surface, #1A1814)',
    borderRadius: 8,
    padding: '0 12px',
    height: 48,
  },
  toggleButton: {
    border: 'none',
    background: 'transparent',
    color: 'var(--text-tertiary, #6B6155)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    marginLeft: 8,
  },
  meterArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  meterBar: {
    display: 'flex',
    gap: 4,
    height: 4,
  },
  meterSegment: {
    flex: 1,
    borderRadius: 4,
  },
  errors: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  errorText: {
    fontSize: 13,
    fontWeight: 500,
    color: '#CC5555',
  },
  card: {
    border: '1px solid var(--border, #2A2520)',
    borderRadius: 12,
    background: 'var(--surface, #1A1814)',
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  cardTitle: {
    margin: 0,
    color: 'var(--text, #F4EDE2)',
    fontSize: 18,
    fontWeight: 600,
  },
  cardBody: {
    margin: 0,
    color: 'var(--text-secondary, #A99E8E)',
    fontSize: 16,
    lineHeight: '24px',
  },
  generateButton: {
    border: 'none',
    background: 'var(--surface-elevated, #23201A)',
    color: '#5BA55B',
    borderRadius: 8,
    padding: '10px 16px',
    fontWeight: 500,
    fontSize: 13,
    cursor: 'pointer',
    alignSelf: 'flex-start',
  },
  suggestionArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginTop: 4,
  },
  suggestionBox: {
    background: 'var(--background, #0E0C09)',
    border: '1px solid var(--border, #2A2520)',
    borderRadius: 8,
    padding: 16,
  },
  suggestionText: {
    fontFamily: 'Inter, sans-serif',
    fontSize: 18,
    fontWeight: 500,
    letterSpacing: 0.5,
    color: 'var(--text, #F4EDE2)',
  },
  useButton: {
    border: 'none',
    background: '#5BA55B',
    color: 'var(--text, #F4EDE2)',
    borderRadius: 8,
    padding: '10px 16px',
    fontWeight: 500,
    fontSize: 13,
    cursor: 'pointer',
    alignSelf: 'flex-start',
  },
  submitButton: {
    border: 'none',
    background: 'var(--text, #F4EDE2)',
    color: 'var(--background, #0E0C09)',
    borderRadius: 8,
    padding: '14px 24px',
    fontWeight: 600,
    fontSize: 16,
    cursor: 'pointer',
    width: '100%',
    textAlign: 'center' as const,
    marginTop: 8,
  },
  altLink: {
    textAlign: 'center' as const,
    fontSize: 14,
    color: 'var(--text-tertiary, #6B6155)',
  },
};
