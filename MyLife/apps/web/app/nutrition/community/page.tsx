'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AVATAR_EMOJIS } from '@mylife/nutrition';
import {
  acceptCommunityConnection,
  blockCommunityConnection,
  cheerCommunityFeedItem,
  createCommunityProfile,
  declineCommunityConnection,
  fetchAcceptedConnections,
  fetchActiveChallenges,
  fetchChallengeLeaderboard,
  fetchCommunityFeed,
  fetchCommunityProfile,
  fetchPendingRequests,
  sendCommunityConnectionRequest,
} from './actions';
import {
  NUTRITION_CHROME,
  alpha,
  formatNutritionDate,
  humanizeNutritionValue,
} from '../_lib/design';
import {
  MaterialSymbol,
  NutritionBadge,
  NutritionButton,
  NutritionEmptyState,
  NutritionKicker,
  NutritionPageHeader,
  NutritionPanel,
} from '../_components/NutritionPrimitives';

type Profile = Awaited<ReturnType<typeof fetchCommunityProfile>>;
type Connection = Awaited<ReturnType<typeof fetchAcceptedConnections>>[number];
type PendingConnection = Awaited<ReturnType<typeof fetchPendingRequests>>[number];
type Challenge = Awaited<ReturnType<typeof fetchActiveChallenges>>[number];
type FeedItem = Awaited<ReturnType<typeof fetchCommunityFeed>>[number];
type LeaderboardEntry = Awaited<ReturnType<typeof fetchChallengeLeaderboard>>[number];

const ACTIVITY_ICONS: Record<string, string> = {
  streak: 'local_fire_department',
  goal_hit: 'flag',
  challenge_joined: 'sports_score',
  challenge_complete: 'emoji_events',
  milestone: 'military_tech',
  custom: 'auto_awesome',
};

function relativeTime(value: string): string {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(diffMs / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function challengeStatusTone(status: string): { color: string; background: string } {
  if (status === 'active') {
    return {
      color: NUTRITION_CHROME.success,
      background: alpha(NUTRITION_CHROME.success, 0.16),
    };
  }

  if (status === 'upcoming') {
    return {
      color: NUTRITION_CHROME.accentLight,
      background: alpha(NUTRITION_CHROME.accent, 0.16),
    };
  }

  return {
    color: NUTRITION_CHROME.textMuted,
    background: alpha('#FFFFFF', 0.08),
  };
}

function daysLeft(endDate: string): string {
  const today = new Date();
  const end = new Date(`${endDate}T00:00:00`);
  const diff = Math.ceil((end.getTime() - today.getTime()) / 86400000);
  if (diff <= 0) return 'Ends today';
  if (diff === 1) return '1 day left';
  return `${diff} days left`;
}

export default function NutritionCommunityPage() {
  const [profile, setProfile] = useState<Profile>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [pending, setPending] = useState<PendingConnection[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [leaderboards, setLeaderboards] = useState<Record<string, LeaderboardEntry[]>>({});
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(null);
  const [feedLimit, setFeedLimit] = useState(12);
  const [setupName, setSetupName] = useState('');
  const [setupEmoji, setSetupEmoji] = useState<(typeof AVATAR_EMOJIS)[number]>(AVATAR_EMOJIS[0]);
  const [friendCode, setFriendCode] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const nextProfile = await fetchCommunityProfile();
      setProfile(nextProfile);

      if (!nextProfile) {
        setConnections([]);
        setPending([]);
        setChallenges([]);
        setFeed([]);
        setLeaderboards({});
        setSelectedChallengeId(null);
        return;
      }

      const [nextConnections, nextPending, nextChallenges, nextFeed] = await Promise.all([
        fetchAcceptedConnections(nextProfile.id),
        fetchPendingRequests(nextProfile.id),
        fetchActiveChallenges(nextProfile.id),
        fetchCommunityFeed(nextProfile.id, feedLimit),
      ]);

      const challengeEntries = await Promise.all(
        nextChallenges.map(async (challenge) => [
          challenge.id,
          await fetchChallengeLeaderboard(challenge.id),
        ] as const),
      );

      const nextLeaderboards = Object.fromEntries(challengeEntries) as Record<string, LeaderboardEntry[]>;

      setConnections(nextConnections);
      setPending(nextPending);
      setChallenges(nextChallenges);
      setFeed(nextFeed);
      setLeaderboards(nextLeaderboards);
      setSelectedChallengeId((current) => {
        if (current && nextLeaderboards[current]) {
          return current;
        }
        return nextChallenges[0]?.id ?? null;
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load the community hub.');
    } finally {
      setLoading(false);
    }
  }, [feedLimit]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedLeaderboard = useMemo(() => {
    if (!selectedChallengeId) return [];
    return leaderboards[selectedChallengeId] ?? [];
  }, [leaderboards, selectedChallengeId]);

  const selectedChallenge = useMemo(
    () => challenges.find((challenge) => challenge.id === selectedChallengeId) ?? null,
    [challenges, selectedChallengeId],
  );

  const handleCreateProfile = useCallback(async () => {
    const trimmed = setupName.trim();
    if (!trimmed) {
      setNotice('Choose a display name before joining the community.');
      return;
    }

    setBusyId('setup');
    setNotice(null);

    try {
      await createCommunityProfile({
        displayName: trimmed,
        avatarEmoji: setupEmoji,
      });
      setSetupName('');
      await load();
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'Profile creation failed.');
    } finally {
      setBusyId(null);
    }
  }, [load, setupEmoji, setupName]);

  const handleConnect = useCallback(async () => {
    if (!profile) return;

    const code = friendCode.trim().toUpperCase();
    if (!code) {
      setNotice('Enter a share code to connect with a friend.');
      return;
    }

    setBusyId('connect');
    setNotice(null);

    try {
      await sendCommunityConnectionRequest(profile.id, code);
      setFriendCode('');
      setNotice(`Connection request sent to ${code}.`);
      await load();
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'Unable to send the request.');
    } finally {
      setBusyId(null);
    }
  }, [friendCode, load, profile]);

  const handlePendingDecision = useCallback(
    async (connectionId: string, action: 'accept' | 'decline') => {
      setBusyId(connectionId);
      setNotice(null);

      try {
        if (action === 'accept') {
          await acceptCommunityConnection(connectionId);
        } else {
          await declineCommunityConnection(connectionId);
        }
        await load();
      } catch (reason) {
        setNotice(reason instanceof Error ? reason.message : 'Unable to update the request.');
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const handleBlockConnection = useCallback(
    async (targetProfileId: string) => {
      if (!profile) return;
      setBusyId(targetProfileId);
      setNotice(null);

      try {
        await blockCommunityConnection(profile.id, targetProfileId);
        await load();
      } catch (reason) {
        setNotice(reason instanceof Error ? reason.message : 'Unable to block this connection.');
      } finally {
        setBusyId(null);
      }
    },
    [load, profile],
  );

  const handleCheer = useCallback(
    async (feedItemId: string) => {
      setBusyId(feedItemId);
      setNotice(null);

      try {
        await cheerCommunityFeedItem(feedItemId);
        await load();
      } catch (reason) {
        setNotice(reason instanceof Error ? reason.message : 'Unable to cheer this update.');
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 20 }}>
        <NutritionPageHeader
          kicker={<NutritionKicker>Community</NutritionKicker>}
          title="Community Hub"
          description="Loading connections, active challenges, and your shared activity feed."
        />
        <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'minmax(0, 1.25fr) minmax(320px, 0.9fr)' }}>
          <NutritionPanel style={{ minHeight: 360, opacity: 0.46 }} />
          <NutritionPanel style={{ minHeight: 360, opacity: 0.34 }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <NutritionEmptyState
        title="Community temporarily unavailable"
        description={error}
        action={<NutritionButton onClick={() => void load()}>Retry</NutritionButton>}
      />
    );
  }

  if (!profile) {
    return (
      <div style={{ display: 'grid', gap: 24, maxWidth: 1040 }}>
        <NutritionPageHeader
          kicker={<NutritionKicker color={NUTRITION_CHROME.accentLight}>Community</NutritionKicker>}
          title="Build your community profile"
          description="Share only what you choose. The profile code lets friends connect without a public directory."
          action={
            <Link href="/nutrition">
              <NutritionButton tone="ghost">Back To Home</NutritionButton>
            </Link>
          }
        />

        <NutritionPanel tone="focus" style={{ padding: 28 }}>
          <div style={{ display: 'grid', gap: 24 }}>
            <div style={{ display: 'grid', gap: 10 }}>
              <NutritionKicker color={NUTRITION_CHROME.accentLight}>Profile Setup</NutritionKicker>
              <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.8 }}>
                Choose a name and avatar
              </div>
              <div style={{ color: NUTRITION_CHROME.textMuted, lineHeight: 1.7, maxWidth: 720 }}>
                Friends use your share code to request access. No feed or challenge data appears until you explicitly connect.
              </div>
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              <label style={fieldLabelStyle}>Display Name</label>
              <input
                value={setupName}
                maxLength={30}
                onChange={(event) => setSetupName(event.target.value)}
                placeholder="Nutrition Curator"
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              <label style={fieldLabelStyle}>Avatar</label>
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(64px, 1fr))' }}>
                {AVATAR_EMOJIS.map((emoji) => {
                  const active = emoji === setupEmoji;
                  return (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setSetupEmoji(emoji)}
                      style={{
                        height: 64,
                        borderRadius: 20,
                        cursor: 'pointer',
                        border: 'none',
                        background: active ? alpha(NUTRITION_CHROME.accent, 0.18) : alpha('#FFFFFF', 0.05),
                        boxShadow: active
                          ? `inset 0 0 0 1.5px ${alpha(NUTRITION_CHROME.accentLight, 0.42)}`
                          : `inset 0 0 0 1.5px ${alpha('#FFFFFF', 0.04)}`,
                        fontSize: 28,
                      }}
                    >
                      {emoji}
                    </button>
                  );
                })}
              </div>
            </div>

            {notice ? (
              <div style={noticeStyle}>
                <MaterialSymbol name="info" size={16} color={NUTRITION_CHROME.accentLight} />
                {notice}
              </div>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <NutritionButton onClick={() => void handleCreateProfile()} disabled={busyId === 'setup'}>
                {busyId === 'setup' ? 'Creating...' : 'Join Community'}
              </NutritionButton>
            </div>
          </div>
        </NutritionPanel>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <NutritionPageHeader
        kicker={<NutritionKicker color={NUTRITION_CHROME.accentLight}>Community</NutritionKicker>}
        title="Community Hub"
        description="Active challenges, pending requests, and a feed of shared wins across your nutrition circle."
        action={
          <>
            <Link href="/nutrition/diary">
              <NutritionButton tone="ghost">Open Diary</NutritionButton>
            </Link>
            <Link href="/nutrition/settings">
              <NutritionButton>Settings</NutritionButton>
            </Link>
          </>
        }
      />

      {notice ? (
        <div style={noticeStyle}>
          <MaterialSymbol name="info" size={16} color={NUTRITION_CHROME.accentLight} />
          {notice}
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'minmax(0, 1.25fr) minmax(320px, 0.85fr)' }}>
        <NutritionPanel tone="focus" style={{ padding: 24 }}>
          <div style={{ display: 'grid', gap: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div
                  style={{
                    width: 82,
                    height: 82,
                    borderRadius: 28,
                    display: 'grid',
                    placeItems: 'center',
                    background: alpha(NUTRITION_CHROME.accent, 0.16),
                    fontSize: 34,
                  }}
                >
                  {profile.avatarEmoji}
                </div>
                <div style={{ display: 'grid', gap: 6 }}>
                  <NutritionKicker color={NUTRITION_CHROME.accentLight}>Profile</NutritionKicker>
                  <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1 }}>{profile.displayName}</div>
                  <div style={{ color: NUTRITION_CHROME.textMuted }}>
                    Share code <strong style={{ color: NUTRITION_CHROME.text }}>{profile.id}</strong>
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gap: 10, minWidth: 220 }}>
                <NutritionBadge color={NUTRITION_CHROME.success}>
                  <MaterialSymbol name="group" size={14} color={NUTRITION_CHROME.success} />
                  {connections.length} connections
                </NutritionBadge>
                <NutritionBadge color={NUTRITION_CHROME.calorie}>
                  <MaterialSymbol name="emoji_events" size={14} color={NUTRITION_CHROME.calorie} />
                  {challenges.length} active challenges
                </NutritionBadge>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              <label style={fieldLabelStyle}>Add a friend by share code</label>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <input
                  value={friendCode}
                  onChange={(event) => setFriendCode(event.target.value.toUpperCase())}
                  placeholder="NUTR-ABCD"
                  style={{ ...inputStyle, flex: '1 1 240px', textTransform: 'uppercase' }}
                />
                <NutritionButton onClick={() => void handleConnect()} disabled={busyId === 'connect'}>
                  {busyId === 'connect' ? 'Sending...' : 'Send Request'}
                </NutritionButton>
              </div>
            </div>

            {pending.length > 0 ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ fontSize: 12, letterSpacing: 1.8, textTransform: 'uppercase', color: NUTRITION_CHROME.calorie }}>
                  Pending Requests
                </div>
                <div style={{ display: 'grid', gap: 12 }}>
                  {pending.map((request) => (
                    <div key={request.id} style={rowCardStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={avatarRailStyle}>{request.profile.avatarEmoji}</div>
                        <div style={{ display: 'grid', gap: 4 }}>
                          <strong>{request.profile.displayName}</strong>
                          <span style={subtleTextStyle}>Requested access to your nutrition feed.</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <NutritionButton
                          tone="ghost"
                          onClick={() => void handlePendingDecision(request.id, 'decline')}
                          disabled={busyId === request.id}
                        >
                          Decline
                        </NutritionButton>
                        <NutritionButton
                          onClick={() => void handlePendingDecision(request.id, 'accept')}
                          disabled={busyId === request.id}
                        >
                          Accept
                        </NutritionButton>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </NutritionPanel>

        <NutritionPanel style={{ padding: 24 }}>
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <NutritionKicker color={NUTRITION_CHROME.water}>Friends Rail</NutritionKicker>
              <div style={{ color: NUTRITION_CHROME.textMuted, lineHeight: 1.7 }}>
                Your accepted connections. Remove friction by keeping share codes and challenge access close at hand.
              </div>
            </div>

            {connections.length > 0 ? (
              <div style={{ display: 'grid', gap: 10 }}>
                {connections.map((connection) => (
                  <div key={connection.id} style={rowCardStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={avatarRailStyle}>{connection.profile.avatarEmoji}</div>
                      <div style={{ display: 'grid', gap: 4 }}>
                        <strong>{connection.profile.displayName}</strong>
                        <span style={subtleTextStyle}>Connected {formatNutritionDate(connection.updatedAt)}</span>
                      </div>
                    </div>
                    <NutritionButton
                      tone="danger"
                      onClick={() => void handleBlockConnection(connection.profile.id)}
                      disabled={busyId === connection.profile.id}
                    >
                      Block
                    </NutritionButton>
                  </div>
                ))}
              </div>
            ) : (
              <div style={emptyBlockStyle}>
                <MaterialSymbol name="groups" size={26} color={NUTRITION_CHROME.textMuted} />
                <div style={{ fontWeight: 700 }}>No connections yet</div>
                <div style={subtleTextStyle}>Share your code to unlock the community feed and challenge surfaces.</div>
              </div>
            )}
          </div>
        </NutritionPanel>
      </div>

      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'minmax(0, 1.1fr) minmax(320px, 0.9fr)' }}>
        <NutritionPanel style={{ padding: 24 }}>
          <div style={{ display: 'grid', gap: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'grid', gap: 6 }}>
                <NutritionKicker color={NUTRITION_CHROME.calorie}>Challenges</NutritionKicker>
                <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.7 }}>Active challenge grid</div>
              </div>
              {selectedChallenge ? (
                <NutritionBadge
                  color={challengeStatusTone(selectedChallenge.status).color}
                  background={challengeStatusTone(selectedChallenge.status).background}
                >
                  {humanizeNutritionValue(selectedChallenge.status)}
                </NutritionBadge>
              ) : null}
            </div>

            {challenges.length > 0 ? (
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                {challenges.map((challenge) => {
                  const board = leaderboards[challenge.id] ?? [];
                  const active = challenge.id === selectedChallengeId;
                  return (
                    <button
                      key={challenge.id}
                      type="button"
                      onClick={() => setSelectedChallengeId(challenge.id)}
                      style={{
                        cursor: 'pointer',
                        border: 'none',
                        textAlign: 'left',
                        borderRadius: 24,
                        padding: 18,
                        background: active ? alpha(NUTRITION_CHROME.accent, 0.15) : alpha('#FFFFFF', 0.04),
                        boxShadow: active
                          ? `inset 0 0 0 1.5px ${alpha(NUTRITION_CHROME.accentLight, 0.36)}`
                          : `inset 0 0 0 1.5px ${alpha('#FFFFFF', 0.03)}`,
                      }}
                    >
                      <div style={{ display: 'grid', gap: 10 }}>
                        <NutritionBadge
                          color={challengeStatusTone(challenge.status).color}
                          background={challengeStatusTone(challenge.status).background}
                        >
                          {humanizeNutritionValue(challenge.challengeType)}
                        </NutritionBadge>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>{challenge.title}</div>
                        <div style={subtleTextStyle}>
                          {challenge.description ?? 'Keep the streak alive and compare progress against your crew.'}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: NUTRITION_CHROME.textMuted, fontSize: 12 }}>
                          <span>{board.length} members</span>
                          <span>{daysLeft(challenge.endDate)}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div style={emptyBlockStyle}>
                <MaterialSymbol name="sports_score" size={26} color={NUTRITION_CHROME.textMuted} />
                <div style={{ fontWeight: 700 }}>No active challenges</div>
                <div style={subtleTextStyle}>Join or create a challenge on mobile to light up the leaderboard on web.</div>
              </div>
            )}
          </div>
        </NutritionPanel>

        <NutritionPanel tone="focus" style={{ padding: 24 }}>
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <NutritionKicker color={NUTRITION_CHROME.success}>Leaderboard</NutritionKicker>
              <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.7 }}>
                {selectedChallenge ? selectedChallenge.title : 'Challenge standings'}
              </div>
              <div style={subtleTextStyle}>
                {selectedChallenge
                  ? `${formatNutritionDate(selectedChallenge.startDate)} to ${formatNutritionDate(selectedChallenge.endDate)}`
                  : 'Choose a challenge to inspect current standings.'}
              </div>
            </div>

            {selectedLeaderboard.length > 0 ? (
              <div style={{ display: 'grid', gap: 10 }}>
                {selectedLeaderboard.slice(0, 6).map((entry) => (
                  <div key={entry.id} style={rowCardStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          ...avatarRailStyle,
                          background: entry.rank === 1 ? alpha(NUTRITION_CHROME.accent, 0.22) : alpha('#FFFFFF', 0.05),
                        }}
                      >
                        {entry.avatarEmoji}
                      </div>
                      <div style={{ display: 'grid', gap: 4 }}>
                        <strong>#{entry.rank} {entry.displayName}</strong>
                        <span style={subtleTextStyle}>{entry.currentValue.toFixed(0)} current points</span>
                      </div>
                    </div>
                    <NutritionBadge color={entry.rank === 1 ? NUTRITION_CHROME.accentLight : NUTRITION_CHROME.text}>
                      {entry.completedAt ? 'Completed' : 'In Progress'}
                    </NutritionBadge>
                  </div>
                ))}
              </div>
            ) : (
              <div style={emptyBlockStyle}>
                <MaterialSymbol name="leaderboard" size={26} color={NUTRITION_CHROME.textMuted} />
                <div style={{ fontWeight: 700 }}>No leaderboard data yet</div>
                <div style={subtleTextStyle}>Invite friends into a challenge to generate standings here.</div>
              </div>
            )}
          </div>
        </NutritionPanel>
      </div>

      <NutritionPanel style={{ padding: 24 }}>
        <div style={{ display: 'grid', gap: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <NutritionKicker color={NUTRITION_CHROME.water}>Activity Feed</NutritionKicker>
              <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.7 }}>Shared progress</div>
            </div>
            {feed.length >= feedLimit ? (
              <NutritionButton tone="ghost" onClick={() => setFeedLimit((current) => current + 12)}>
                Load More
              </NutritionButton>
            ) : null}
          </div>

          {feed.length > 0 ? (
            <div style={{ display: 'grid', gap: 12 }}>
              {feed.map((item) => (
                <div key={item.id} style={feedCardStyle}>
                  <div style={{ display: 'flex', gap: 14 }}>
                    <div style={avatarRailStyle}>{item.avatarEmoji}</div>
                    <div style={{ display: 'grid', gap: 6, flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        <strong>{item.displayName}</strong>
                        <span style={subtleTextStyle}>{relativeTime(item.createdAt)}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <NutritionBadge color={NUTRITION_CHROME.accentLight}>
                          <MaterialSymbol
                            name={ACTIVITY_ICONS[item.activityType] ?? 'auto_awesome'}
                            size={14}
                            color={NUTRITION_CHROME.accentLight}
                          />
                          {humanizeNutritionValue(item.activityType)}
                        </NutritionBadge>
                        <span style={{ fontWeight: 700 }}>{item.title}</span>
                      </div>
                      {item.body ? <div style={subtleTextStyle}>{item.body}</div> : null}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                    <span style={subtleTextStyle}>Visibility: {humanizeNutritionValue(item.visibility)}</span>
                    <NutritionButton
                      tone={item.cheered ? 'ghost' : 'accent'}
                      onClick={() => void handleCheer(item.id)}
                      disabled={item.cheered || busyId === item.id}
                    >
                      {item.cheered ? 'Cheered' : 'Cheer'}
                    </NutritionButton>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={emptyBlockStyle}>
              <MaterialSymbol name="dynamic_feed" size={28} color={NUTRITION_CHROME.textMuted} />
              <div style={{ fontWeight: 700 }}>No shared activity yet</div>
              <div style={subtleTextStyle}>Once friends log meals, hit streaks, or finish challenges, their updates will land here.</div>
            </div>
          )}
        </div>
      </NutritionPanel>
    </div>
  );
}

const inputStyle: CSSProperties = {
  minHeight: 52,
  width: '100%',
  border: 'none',
  borderRadius: 18,
  padding: '0 16px',
  background: alpha('#FFFFFF', 0.05),
  color: NUTRITION_CHROME.text,
  boxShadow: `inset 0 0 0 1.5px ${alpha('#FFFFFF', 0.04)}`,
};

const fieldLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 1.8,
  textTransform: 'uppercase',
  color: NUTRITION_CHROME.textMuted,
};

const noticeStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minHeight: 52,
  padding: '0 16px',
  borderRadius: 18,
  background: alpha(NUTRITION_CHROME.accent, 0.12),
  color: NUTRITION_CHROME.text,
  boxShadow: `inset 0 0 0 1.5px ${alpha(NUTRITION_CHROME.accentLight, 0.18)}`,
};

const subtleTextStyle: CSSProperties = {
  color: NUTRITION_CHROME.textMuted,
  lineHeight: 1.7,
};

const avatarRailStyle: CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: 18,
  display: 'grid',
  placeItems: 'center',
  background: alpha('#FFFFFF', 0.05),
  fontSize: 24,
};

const rowCardStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'center',
  flexWrap: 'wrap',
  padding: 14,
  borderRadius: 20,
  background: alpha('#FFFFFF', 0.04),
};

const emptyBlockStyle: CSSProperties = {
  minHeight: 220,
  borderRadius: 24,
  display: 'grid',
  placeItems: 'center',
  gap: 10,
  textAlign: 'center',
  padding: 24,
  background: alpha('#FFFFFF', 0.03),
};

const feedCardStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: 18,
  borderRadius: 24,
  background: alpha('#FFFFFF', 0.04),
};
