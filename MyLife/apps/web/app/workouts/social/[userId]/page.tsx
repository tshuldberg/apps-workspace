'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { fetchWorkoutSocialProfile } from '../../actions';
import {
  ActionLink,
  EmptyState,
  SectionTitle,
  WorkoutsPageHeader,
  WorkoutsSurface,
  chipStyle,
  WORKOUTS_TOKENS,
} from '../../ui';

type SocialProfileView = Awaited<ReturnType<typeof fetchWorkoutSocialProfile>>;

export default function WorkoutSocialProfilePage() {
  const params = useParams<{ userId: string }>();
  const userId = Array.isArray(params?.userId) ? params.userId[0] : params?.userId;
  const [view, setView] = useState<SocialProfileView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setError('Profile not found.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        setLoading(true);
        const next = await fetchWorkoutSocialProfile(userId);
        if (cancelled) return;
        setView(next);
        setError(null);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load profile.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return <WorkoutsSurface tone="mid">Loading profile...</WorkoutsSurface>;
  }

  if (!view || !view.profile) {
    return (
      <EmptyState
        title="Profile unavailable"
        body={error ?? 'This workout profile could not be loaded.'}
        action={<ActionLink href="/workouts/social" label="Back To Feed" icon="arrow_back" secondary />}
      />
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <WorkoutsSurface tone="glass" style={{ display: 'grid', gap: 22 }}>
        <WorkoutsPageHeader
          eyebrow="Profile"
          title={view.profile.displayName}
          description={view.profile.bio}
          actions={<ActionLink href="/workouts/social" label="Back To Feed" icon="arrow_back" secondary />}
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={chipStyle(true)}>{view.profile.totalWorkouts} workouts</span>
          <span style={chipStyle(false)}>{view.profile.currentStreak} day streak</span>
          <span style={chipStyle(false)}>{view.profile.followerCount} followers</span>
        </div>
      </WorkoutsSurface>

      <WorkoutsSurface tone="low" style={{ display: 'grid', gap: 16 }}>
        <SectionTitle
          eyebrow="Recent Posts"
          title="Profile feed"
          description="Every visible workout share for this athlete."
        />
        <div style={{ display: 'grid', gap: 12 }}>
          {view.feed.map((item) => (
            <div key={item.id} style={{ padding: 18, borderRadius: 20, background: WORKOUTS_TOKENS.surfaceMid, display: 'grid', gap: 10 }}>
              <strong style={{ fontSize: 18 }}>{item.content.title}</strong>
              <span style={{ color: WORKOUTS_TOKENS.textSecondary }}>{item.caption}</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={chipStyle(false, item.focusAccent)}>{item.focusLabel}</span>
                <span style={chipStyle(false)}>{item.content.durationMinutes} min</span>
                <span style={chipStyle(false)}>{item.likeCount} reactions</span>
              </div>
            </div>
          ))}
        </div>
      </WorkoutsSurface>

      <div style={{ display: 'grid', gap: 12 }}>
        {Object.values(view.profiles)
          .filter((profile) => profile.userId !== view.profile?.userId)
          .slice(0, 3)
          .map((profile) => (
            <Link
              key={profile.userId}
              href={`/workouts/social/${profile.userId}`}
              style={{
                padding: 16,
                borderRadius: 18,
                background: WORKOUTS_TOKENS.surfaceHigh,
                color: WORKOUTS_TOKENS.text,
                textDecoration: 'none',
              }}
            >
              Explore {profile.displayName}
            </Link>
          ))}
      </div>
    </div>
  );
}
