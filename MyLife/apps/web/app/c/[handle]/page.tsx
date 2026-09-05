'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getPublicProfileAction } from './actions';

interface PublicProfile {
  profileId: string;
  handle: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  cuisine: string | null;
  region: string | null;
}

const T = {
  bg: '#131318',
  surface: '#1B1B20',
  surfaceHigh: '#2A292F',
  text: '#E4E1E9',
  textSecondary: '#D6C3B5',
  accent: '#22C55E',
  accentLight: '#4ADE80',
  dimText: 'rgba(228,225,233,0.45)',
} as const;

export default function PublicChefProfilePage() {
  const params = useParams();
  const handle = (params?.handle as string) ?? '';

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const result = await getPublicProfileAction(handle);
      if (cancelled) return;
      if (!result.ok || !result.data) {
        setNotFound(true);
      } else {
        setProfile(result.data as PublicProfile);
      }
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [handle]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: T.bg,
          color: T.text,
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          padding: '120px 24px',
          textAlign: 'center',
        }}
      >
        <div style={{ color: T.dimText, fontSize: 14 }}>Loading chef profile...</div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: T.bg,
          color: T.text,
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          padding: '120px 24px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>{'\u{1F468}\u{200D}\u{1F373}'}</div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: '#FFB4AB',
            marginBottom: 8,
          }}
        >
          Chef not found or profile is private
        </div>
        <Link
          href="/recipes"
          style={{
            color: T.accent,
            fontSize: 14,
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          Browse BestChef
        </Link>
      </div>
    );
  }

  const subtitleParts = [profile.cuisine, profile.region].filter(Boolean) as string[];

  return (
    <div
      style={{
        minHeight: '100vh',
        background: T.bg,
        color: T.text,
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        padding: '40px 24px',
      }}
    >
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <section
          style={{
            background: T.surface,
            borderRadius: 16,
            padding: '32px 24px',
            display: 'flex',
            gap: 24,
            alignItems: 'center',
            marginBottom: 24,
          }}
        >
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: '50%',
              border: `2px solid ${T.accent}`,
              overflow: 'hidden',
              flexShrink: 0,
              background: T.surfaceHigh,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={profile.displayName}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <span style={{ fontSize: 32, color: T.accent, fontWeight: 700 }}>
                {profile.displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 800,
                letterSpacing: '-0.02em',
                marginBottom: 4,
              }}
            >
              {profile.displayName}
            </h1>
            <div style={{ fontSize: 14, color: T.textSecondary, marginBottom: 8 }}>
              @{profile.handle}
            </div>
            {subtitleParts.length > 0 ? (
              <div style={{ fontSize: 12, color: T.dimText, textTransform: 'capitalize' }}>
                {subtitleParts.join(' \u00b7 ')}
              </div>
            ) : null}
          </div>
        </section>

        {profile.bio ? (
          <section
            style={{
              background: T.surface,
              borderRadius: 16,
              padding: 20,
              marginBottom: 24,
            }}
          >
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.6,
                color: T.textSecondary,
                margin: 0,
              }}
            >
              {profile.bio}
            </p>
          </section>
        ) : null}

        <section
          style={{
            background: T.surface,
            borderRadius: 16,
            padding: 20,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 13,
              color: T.textSecondary,
              marginBottom: 12,
            }}
          >
            Get the BestChef app to follow this chef and explore their recipes.
          </div>
          <Link
            href="/recipes"
            style={{
              display: 'inline-block',
              padding: '10px 20px',
              borderRadius: 9999,
              background: `linear-gradient(135deg, ${T.accent}, ${T.accentLight})`,
              color: '#131318',
              fontWeight: 700,
              fontSize: 13,
              textDecoration: 'none',
            }}
          >
            Open BestChef
          </Link>
        </section>
      </div>
    </div>
  );
}
