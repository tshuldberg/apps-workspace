'use client';

import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  createProfileAction,
  fetchMyProfile,
  updateProfileAction,
} from '../../actions';
import {
  Avatar,
  GlassCard,
  MaterialSymbol,
  SectionIntro,
  SurfaceCard,
} from '../../components';
import {
  TOKENS,
  chipStyle,
  gradientButtonStyle,
  inputStyle,
  textareaStyle,
} from '../../ui';

interface ProfileRow {
  id: string;
  displayName: string;
  username: string;
  bio: string | null;
  statusText: string | null;
  statusEmoji: string | null;
  location: string | null;
  websiteUrl: string | null;
}

export default function EditProfilePage() {
  const router = useRouter();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [statusText, setStatusText] = useState('');
  const [statusEmoji, setStatusEmoji] = useState('');
  const [location, setLocation] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profile = (await fetchMyProfile()) as ProfileRow | undefined;
        if (!profile || cancelled) return;
        setProfileId(profile.id);
        setDisplayName(profile.displayName);
        setUsername(profile.username);
        setBio(profile.bio ?? '');
        setStatusText(profile.statusText ?? '');
        setStatusEmoji(profile.statusEmoji ?? '');
        setLocation(profile.location ?? '');
        setWebsiteUrl(profile.websiteUrl ?? '');
      } catch {
        // No existing profile yet is a valid state here.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const coverGradient = useMemo(() => {
    const seed = displayName || username || 'Curator';
    const hue = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360;
    return `linear-gradient(135deg, hsla(${hue}, 70%, 58%, 0.75), hsla(${(hue + 42) % 360}, 82%, 60%, 0.48), rgba(17,17,24,0.92))`;
  }, [displayName, username]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!displayName.trim() || !username.trim()) return;
    setSubmitting(true);
    setError(null);
    setSavedMessage(null);
    try {
      if (profileId) {
        await updateProfileAction(profileId, {
          displayName: displayName.trim(),
          bio: bio.trim(),
          statusText: statusText.trim(),
          statusEmoji: statusEmoji.trim(),
          location: location.trim(),
          websiteUrl: websiteUrl.trim() || null,
        });
      } else {
        await createProfileAction({
          displayName: displayName.trim(),
          username: username.trim().toLowerCase(),
          bio: bio.trim() || undefined,
        });
      }
      setSavedMessage('Profile saved.');
      router.push('/forums/profile');
    } catch {
      setError('Failed to save profile.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <GlassCard style={{ minHeight: 420, animation: 'pulse 1.5s ease-in-out infinite' }} />;
  }

  return (
    <div className="forums-page-stack">
      <SectionIntro
        eyebrow="Edit Profile"
        title={profileId ? 'Shape your public presence' : 'Create your profile'}
        description="This editor keeps profile details in one vertical pass, with avatar and cover previews built into the same form. Media upload affordances are staged visually while the text fields persist now."
        actions={
          <Link href="/forums/profile" style={ghostLinkStyle}>
            View profile
          </Link>
        }
      />

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 18 }}>
        <SurfaceCard style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ height: 180, background: coverGradient }} />
          <div style={{ padding: '0 24px 24px', display: 'grid', gap: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: -52 }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ padding: 6, borderRadius: 999, background: TOKENS.surface }}>
                  <Avatar label={displayName || username || 'Curator'} size={88} />
                </div>
                <div style={{ display: 'grid', gap: 8, paddingBottom: 10 }}>
                  <strong style={{ fontSize: 26 }}>{displayName || 'Display name preview'}</strong>
                  <span style={{ color: TOKENS.textSecondary, fontSize: 14 }}>
                    @{username || 'username'}{statusText ? ` · ${statusEmoji ? `${statusEmoji} ` : ''}${statusText}` : ''}
                  </span>
                </div>
              </div>
              <div className="forums-chip-row">
                <button type="button" style={chipStyle(false, 'neutral')}>
                  <MaterialSymbol name="image" size={16} color={TOKENS.primaryLight} />
                  Cover upload soon
                </button>
                <button type="button" style={chipStyle(false, 'neutral')}>
                  <MaterialSymbol name="photo_camera" size={16} color={TOKENS.primaryLight} />
                  Avatar upload soon
                </button>
              </div>
            </div>

            <GlassCard style={{ display: 'grid', gap: 8, padding: 18 }}>
              <span style={eyebrowStyle}>Preview notes</span>
              <p style={{ margin: 0, color: TOKENS.textSecondary, lineHeight: 1.6 }}>
                Gold handles shell chrome. Purple remains reserved for trust semantics elsewhere in the forum surface.
              </p>
            </GlassCard>
          </div>
        </SurfaceCard>

        <SurfaceCard style={{ display: 'grid', gap: 18 }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <span style={eyebrowStyle}>Identity</span>
            <h2 style={sectionTitleStyle}>Make it legible at a glance</h2>
          </div>

          <div style={{ display: 'grid', gap: 16 }}>
            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>Display name</span>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                required
                style={inputStyle}
              />
            </label>

            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>Username</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                disabled={Boolean(profileId)}
                style={{ ...inputStyle, opacity: profileId ? 0.58 : 1 }}
              />
              <span style={fieldHintStyle}>Lowercase letters, numbers, and hyphens. Existing usernames stay fixed.</span>
            </label>

            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>Bio</span>
              <textarea
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                rows={5}
                maxLength={500}
                style={textareaStyle}
              />
              <span style={fieldHintStyle}>{bio.length}/500 characters</span>
            </label>
          </div>
        </SurfaceCard>

        <SurfaceCard style={{ display: 'grid', gap: 18 }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <span style={eyebrowStyle}>Presence</span>
            <h2 style={sectionTitleStyle}>Set your current status and metadata</h2>
          </div>

          <div style={{ display: 'grid', gap: 16 }}>
            <div className="forums-two-up">
              <label style={fieldStyle}>
                <span style={fieldLabelStyle}>Status emoji</span>
                <input
                  value={statusEmoji}
                  onChange={(event) => setStatusEmoji(event.target.value)}
                  maxLength={10}
                  style={inputStyle}
                />
              </label>
              <label style={fieldStyle}>
                <span style={fieldLabelStyle}>Status text</span>
                <input
                  value={statusText}
                  onChange={(event) => setStatusText(event.target.value)}
                  maxLength={100}
                  style={inputStyle}
                />
              </label>
            </div>

            <div className="forums-two-up">
              <label style={fieldStyle}>
                <span style={fieldLabelStyle}>Location</span>
                <input
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  maxLength={100}
                  style={inputStyle}
                />
              </label>
              <label style={fieldStyle}>
                <span style={fieldLabelStyle}>Website</span>
                <input
                  value={websiteUrl}
                  onChange={(event) => setWebsiteUrl(event.target.value)}
                  type="url"
                  placeholder="https://"
                  style={inputStyle}
                />
              </label>
            </div>
          </div>
        </SurfaceCard>

        <GlassCard style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'grid', gap: 4 }}>
            {error ? <span style={{ color: TOKENS.danger, fontSize: 13 }}>{error}</span> : null}
            {savedMessage ? <span style={{ color: TOKENS.success, fontSize: 13 }}>{savedMessage}</span> : null}
            <span style={{ color: TOKENS.textTertiary, fontSize: 12 }}>
              Text fields persist today. Visual media upload slots are staged for a later bridge.
            </span>
          </div>
          <button type="submit" disabled={submitting} style={submitButtonStyle(submitting)}>
            {submitting ? 'Saving...' : 'Save profile'}
          </button>
        </GlassCard>
      </form>
    </div>
  );
}

const eyebrowStyle = {
  color: TOKENS.primary,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
} as const;

const sectionTitleStyle = {
  margin: 0,
  fontSize: 18,
  color: TOKENS.textSecondary,
  lineHeight: 1.65,
  fontWeight: 500,
} as const;

const fieldStyle = {
  display: 'grid',
  gap: 8,
} as const;

const fieldLabelStyle = {
  color: TOKENS.text,
  fontSize: 13,
  fontWeight: 700,
} as const;

const fieldHintStyle = {
  color: TOKENS.textTertiary,
  fontSize: 12,
  lineHeight: 1.55,
} as const;

const ghostLinkStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 40,
  padding: '0 14px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.05)',
  color: TOKENS.textSecondary,
  textDecoration: 'none',
  fontSize: 13,
  fontWeight: 700,
} as const;

function submitButtonStyle(disabled: boolean) {
  return {
    ...gradientButtonStyle,
    opacity: disabled ? 0.56 : 1,
    cursor: disabled ? 'wait' : 'pointer',
  } as const;
}
