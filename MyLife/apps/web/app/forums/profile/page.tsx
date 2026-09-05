'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchMyProfile } from '../actions';
import {
  ACCENT, ACCENT_BORDER, TEXT, TEXT_SEC, TEXT_TER,
  SURFACE, BORDER, GLASS,
  formatCount,
} from '../ui';

interface Profile { id: string; displayName: string; username: string; bio: string; karma: number; threadCount: number; replyCount: number; communitiesJoined: number; isVerified: boolean | number; statusEmoji: string; statusText: string; location: string; websiteUrl: string | null; createdAt: string; }

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await fetchMyProfile();
        if (!cancelled) setProfile((p as Profile) ?? null);
      } catch {
        if (!cancelled) setError('Couldn\'t load profile');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <div style={{ height: 280, borderRadius: 16, background: SURFACE, border: `1px solid ${BORDER}`, animation: 'pulse 1.5s ease-in-out infinite' }} />
        
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <p style={{ fontSize: 18, fontWeight: 600, color: TEXT, margin: 0 }}>{error}</p>
        <button type="button" onClick={() => window.location.reload()} style={{ marginTop: 16, background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 600, cursor: 'pointer' }}>Retry</button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <div style={{ padding: 40, borderRadius: 24, border: `1px dashed ${ACCENT_BORDER}`, background: GLASS }}>
          <p style={{ fontSize: 36, margin: 0 }}>👤</p>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: TEXT, margin: '12px 0 0' }}>Create your profile</h2>
          <p style={{ color: TEXT_SEC, margin: '8px 0 20px' }}>Set up a forum profile to start posting and connecting with communities.</p>
          <Link href="/forums/edit-profile" style={{ display: 'inline-block', background: ACCENT, color: '#fff', borderRadius: 999, padding: '12px 24px', fontWeight: 700, textDecoration: 'none' }}>
            Set Up Profile
          </Link>
        </div>
      </div>
    );
  }

  const stats = [
    { label: 'Karma', value: profile.karma },
    { label: 'Threads', value: profile.threadCount },
    { label: 'Replies', value: profile.replyCount },
    { label: 'Communities', value: profile.communitiesJoined },
  ];

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <div style={{ padding: 32, borderRadius: 16, background: SURFACE, border: `1px solid ${BORDER}` }}>
        {/* Header */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: 999, background: `${ACCENT}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
            {profile.displayName.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{profile.displayName}</h1>
              {profile.isVerified && <span style={{ fontSize: 14, color: ACCENT }}>✓</span>}
            </div>
            <p style={{ margin: '2px 0 0', fontSize: 14, color: TEXT_TER }}>@{profile.username}</p>
          </div>
          <Link href="/forums/edit-profile" style={{ color: TEXT_SEC, fontSize: 14, textDecoration: 'none', padding: '8px 16px', borderRadius: 8, border: `1px solid ${BORDER}`, background: GLASS }}>
            Edit
          </Link>
        </div>

        {/* Status */}
        {(profile.statusEmoji || profile.statusText) && (
          <p style={{ margin: '16px 0 0', fontSize: 14, color: TEXT_SEC }}>
            {profile.statusEmoji} {profile.statusText}
          </p>
        )}

        {/* Bio */}
        {profile.bio && (
          <p style={{ margin: '16px 0 0', fontSize: 15, color: TEXT, lineHeight: 1.5 }}>{profile.bio}</p>
        )}

        {/* Meta */}
        <div style={{ display: 'flex', gap: 16, marginTop: 16, fontSize: 13, color: TEXT_TER, flexWrap: 'wrap' }}>
          {profile.location && <span>📍 {profile.location}</span>}
          {profile.websiteUrl && <a href={profile.websiteUrl} target="_blank" rel="noopener noreferrer" style={{ color: ACCENT, textDecoration: 'none' }}>🔗 Website</a>}
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 24 }}>
          {stats.map((s) => (
            <div key={s.label} style={{ textAlign: 'center', padding: 12, borderRadius: 12, background: GLASS, border: `1px solid ${BORDER}` }}>
              <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: TEXT }}>{formatCount(s.value)}</p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: TEXT_TER }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
