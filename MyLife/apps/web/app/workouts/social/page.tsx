'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { fetchWorkoutSocialView } from '../actions';
import {
  ActionLink,
  EmptyState,
  SectionTitle,
  SymbolIcon,
  WorkoutsPageHeader,
  WorkoutsSurface,
  chipStyle,
  WORKOUTS_TOKENS,
} from '../ui';

type SocialView = Awaited<ReturnType<typeof fetchWorkoutSocialView>>;

function formatRelative(value: string): string {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffHours = Math.max(0, Math.round(diffMs / 3600000));
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function WorkoutSocialPage() {
  const [view, setView] = useState<SocialView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        setLoading(true);
        const next = await fetchWorkoutSocialView();
        if (cancelled) return;
        setView(next);
        setError(null);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load social feed.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredFeed = useMemo(() => view?.feed ?? [], [view]);

  if (loading) {
    return <WorkoutsSurface tone="mid">Loading social feed...</WorkoutsSurface>;
  }

  if (!view) {
    return (
      <EmptyState
        title="Social unavailable"
        body={error ?? 'The social feed could not be loaded.'}
        action={<ActionLink href="/workouts" label="Back To Dashboard" icon="arrow_back" secondary />}
      />
    );
  }

  const profiles = Object.values(view.profiles).slice(0, 4);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <WorkoutsSurface tone="glass" style={{ display: 'grid', gap: 22 }}>
        <WorkoutsPageHeader
          eyebrow="Social"
          title="Training feed"
          description="Your completed sessions rendered as share cards. This feed is stored on this device only; there is no server community yet, so nothing here is visible to anyone else."
        />
      </WorkoutsSurface>

      <WorkoutsSurface tone="mid" style={{ display: 'grid', gap: 16 }}>
        <SectionTitle
          eyebrow="Profile"
          title="Your athlete card"
          description="Your local training profile. Sharing to other people arrives with the server community."
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {profiles.map((profile) => (
            <Link
              key={profile.userId}
              href={`/workouts/social/${profile.userId}`}
              style={{
                display: 'grid',
                gap: 10,
                padding: 16,
                borderRadius: 20,
                background: WORKOUTS_TOKENS.surfaceHigh,
                color: WORKOUTS_TOKENS.text,
                textDecoration: 'none',
              }}
            >
              <strong>{profile.displayName}</strong>
              <span style={{ color: WORKOUTS_TOKENS.textSecondary, fontSize: 13 }}>{profile.bio}</span>
              <span style={{ color: WORKOUTS_TOKENS.textTertiary, fontSize: 12 }}>
                {profile.totalWorkouts} workouts · {profile.currentStreak} day streak
              </span>
            </Link>
          ))}
        </div>
      </WorkoutsSurface>

      {filteredFeed.length === 0 ? (
        <EmptyState
          title="No sessions to show yet"
          body="Complete a workout session and it will appear here as a share card."
        />
      ) : (
        <div className="workouts-masonry">
          {filteredFeed.map((item) => (
            <WorkoutsSurface key={item.id} tone="low" style={{ display: 'grid', gap: 16 }}>
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ display: 'grid', gap: 4 }}>
                    <Link
                      href={`/workouts/social/${item.userId}`}
                      style={{ color: WORKOUTS_TOKENS.text, textDecoration: 'none', fontWeight: 800 }}
                    >
                      {item.profile.displayName}
                    </Link>
                    <span style={{ color: WORKOUTS_TOKENS.textTertiary, fontSize: 12 }}>
                      {formatRelative(item.createdAt)}
                    </span>
                  </div>
                  <span style={chipStyle(false, item.privacyAccent)}>
                    <SymbolIcon name={item.privacyIcon} size={14} color={item.privacyAccent} />
                    {item.privacyLabel}
                  </span>
                </div>
                <strong style={{ fontSize: 20, letterSpacing: '-0.03em' }}>{item.content.title}</strong>
                <p style={{ margin: 0, color: WORKOUTS_TOKENS.textSecondary, lineHeight: 1.7 }}>{item.caption}</p>
              </div>

              <div
                style={{
                  display: 'grid',
                  gap: 8,
                  padding: 16,
                  borderRadius: 22,
                  background:
                    item.coverVariant === 'recovery'
                      ? 'linear-gradient(135deg, rgba(48,209,88,0.16), rgba(19,19,24,0.96))'
                      : item.coverVariant === 'metric'
                        ? 'linear-gradient(135deg, rgba(201,137,77,0.18), rgba(19,19,24,0.96))'
                        : 'linear-gradient(135deg, rgba(139,207,240,0.16), rgba(19,19,24,0.96))',
                }}
              >
                <span style={{ color: WORKOUTS_TOKENS.textTertiary, fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                  {item.coverCaption}
                </span>
                <strong style={{ fontSize: 34, letterSpacing: '-0.05em' }}>
                  {item.coverValue} <span style={{ fontSize: 16 }}>{item.coverUnit}</span>
                </strong>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={chipStyle(false, item.focusAccent)}>{item.focusLabel}</span>
                {item.hasNewPr ? <span style={chipStyle(true)}>New PR</span> : null}
                <span style={chipStyle(false)}>{item.content.durationMinutes} min</span>
              </div>

              <div style={{ display: 'grid', gap: 8 }}>
                {item.comments.map((comment) => (
                  <div key={comment.id} style={{ padding: 12, borderRadius: 16, background: WORKOUTS_TOKENS.surfaceHigh }}>
                    <strong style={{ display: 'block', marginBottom: 4 }}>{comment.authorName}</strong>
                    <span style={{ color: WORKOUTS_TOKENS.textSecondary, fontSize: 13 }}>{comment.body}</span>
                  </div>
                ))}
              </div>

              {item.likeCount + item.commentCount > 0 ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: WORKOUTS_TOKENS.textSecondary, fontSize: 13 }}>
                  <span>{item.likeCount} reactions</span>
                  <span>{item.commentCount} comments</span>
                </div>
              ) : null}
            </WorkoutsSurface>
          ))}
        </div>
      )}
    </div>
  );
}
