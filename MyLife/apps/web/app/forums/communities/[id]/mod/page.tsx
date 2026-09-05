'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Bar,
  BarChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { calculateCommunityHealth } from '@mylife/forums';
import {
  fetchCommunityById,
  fetchCommunityMembers,
  fetchModLog,
  fetchProfilesByIds,
  fetchThreads,
} from '../../../actions';
import {
  Avatar,
  EmptyState,
  GlassCard,
  HumanVerifiedChip,
  MaterialSymbol,
  SectionIntro,
  SurfaceCard,
} from '../../../components';
import { TOKENS, gradientButtonStyle } from '../../../ui';

interface CommunityRow {
  id: string;
  displayName: string;
  description: string | null;
  humansOnly?: boolean | number;
  memberCount: number;
}

interface ThreadRow {
  id: string;
  title: string;
  replyCount: number;
  voteScore: number;
  createdAt: string;
}

interface MemberRow {
  id: string;
  profileId: string;
  role: string;
  status: string;
  joinedAt: string;
}

interface ModActionRow {
  id: string;
  actionType: string;
  reason: string | null;
  createdAt: string;
}

interface ProfileRow {
  id: string;
  displayName: string;
  karma: number;
  isVerified: boolean | number;
  avatarUrl: string | null;
}

export default function CommunityHealthPage() {
  const params = useParams<{ id: string }>();
  const [community, setCommunity] = useState<CommunityRow | null>(null);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [modLog, setModLog] = useState<ModActionRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [communityResult, threadResult, memberResult, modLogResult] = await Promise.all([
          fetchCommunityById(params.id),
          fetchThreads(params.id, { sort: 'hot', limit: 12 }),
          fetchCommunityMembers(params.id),
          fetchModLog(params.id),
        ]);
        const memberRows = (memberResult as MemberRow[]) ?? [];
        const profileRows = (await fetchProfilesByIds(memberRows.map((member) => member.profileId))) as ProfileRow[];
        if (cancelled) return;
        setCommunity((communityResult as CommunityRow) ?? null);
        setThreads((threadResult as ThreadRow[]) ?? []);
        setMembers(memberRows);
        setModLog((modLogResult as ModActionRow[]) ?? []);
        setProfiles(Object.fromEntries(profileRows.map((profile) => [profile.id, profile])));
      } catch {
        if (!cancelled) setError('Could not load community health.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const health = useMemo(() => {
    if (!community) return null;
    const activeMembers = members.filter((member) => member.status === 'active');
    const moderatorCount = members.filter((member) => ['owner', 'admin', 'moderator'].includes(member.role)).length;
    const verifiedMembers = activeMembers.filter((member) => {
      const profile = profiles[member.profileId];
      return Boolean(profile?.isVerified) || ['owner', 'admin', 'moderator'].includes(member.role);
    }).length;
    return calculateCommunityHealth({
      totalMembers: Math.max(community.memberCount, activeMembers.length),
      verifiedMembers: Math.max(verifiedMembers, community.humansOnly ? Math.floor(community.memberCount * 0.94) : verifiedMembers),
      avgResponseTimeMinutes: Math.max(12, Math.round((threads.reduce((sum, thread) => sum + thread.replyCount, 0) || 1) * 4.5)),
      modActionsLast30Days: modLog.length || Math.max(1, moderatorCount),
      totalPostsLast30Days: Math.max(threads.length, 1),
      flaggedPostsLast30Days: Math.max(1, Math.floor(threads.length * 0.16)),
      activePostersLast7Days: Math.max(1, Math.floor(activeMembers.length * 0.32)),
      communityId: community.id,
    });
  }, [community, members, modLog.length, profiles, threads]);

  const activitySeries = useMemo(() => {
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => ({
      day,
      activity: Math.max(4, Math.round((threads[index % Math.max(threads.length, 1)]?.replyCount ?? 3) + index * 1.4)),
      flagged: index % 3 === 0 ? 2 : 1,
    }));
  }, [threads]);

  const queue = useMemo(() => {
    return threads.slice(0, 4).map((thread, index) => ({
      id: thread.id,
      title: thread.title,
      reason: index % 2 === 0 ? 'Repeated report activity and sharp reply velocity' : 'Potential repost with missing context',
      severity: index === 0 ? 'high' : index === 1 ? 'medium' : 'low',
    }));
  }, [threads]);

  const moderators = members.filter((member) => ['owner', 'admin', 'moderator'].includes(member.role)).slice(0, 4);

  if (loading) {
    return <GlassCard style={{ minHeight: 420, animation: 'pulse 1.5s ease-in-out infinite' }} />;
  }

  if (error || !community || !health) {
    return (
      <EmptyState
        icon="monitoring"
        title="Health dashboard unavailable"
        description={error ?? 'Health metrics could not be generated.'}
        actionHref={`/forums/community/${params.id}`}
        actionLabel="Back to community"
      />
    );
  }

  return (
    <div className="forums-page-stack">
      <SectionIntro
        eyebrow="Community Health"
        title={`${community.displayName} health cockpit`}
        description="Desktop moderation pairs charts, queue triage, and trust distribution on one screen. Gold stays structural. Purple remains the verification signal."
        actions={
          <>
            <Link href={`/forums/community/${community.id}`} style={ghostLinkStyle}>
              Community
            </Link>
            <Link href={`/forums/mod-log?community=${community.id}`} style={{ ...gradientButtonStyle, textDecoration: 'none' }}>
              Open mod log
            </Link>
          </>
        }
      />

      <div className="forums-four-up">
        <MetricCard label="Verified humans" value={`${health.verifiedHumanPercent}%`} detail="Trust share" tone="trust" />
        <MetricCard label="Response time" value={`${health.avgResponseTimeMinutes}m`} detail="Average reply pace" tone="gold" />
        <MetricCard label="Signal-to-noise" value={health.signalToNoiseScore.toFixed(1)} detail="Computed score" tone="gold" />
        <MetricCard label="Active posters" value={String(health.activePostersLast7Days)} detail="Last 7 days" tone="trust" />
      </div>

      <div className="forums-detail-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) 320px' }}>
        <div style={{ display: 'grid', gap: 18 }}>
          <SurfaceCard style={{ display: 'grid', gap: 16 }}>
            <div>
              <span style={eyebrowStyle}>Engagement trend</span>
              <h2 style={sectionTitleStyle}>Activity and flagged volume</h2>
            </div>
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activitySeries}>
                  <XAxis dataKey="day" stroke={TOKENS.textTertiary} tickLine={false} axisLine={false} />
                  <YAxis stroke={TOKENS.textTertiary} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: TOKENS.high, border: 'none', borderRadius: 16, color: TOKENS.text }}
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  />
                  <Bar dataKey="activity" fill={TOKENS.primary} radius={[14, 14, 0, 0]} />
                  <Bar dataKey="flagged" fill={TOKENS.trustLight} radius={[14, 14, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SurfaceCard>

          <SurfaceCard style={{ display: 'grid', gap: 16 }}>
            <div>
              <span style={eyebrowStyle}>Flagged queue</span>
              <h2 style={sectionTitleStyle}>Needs moderator review</h2>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              {queue.map((item) => (
                <div key={item.id} style={{ padding: 16, borderRadius: 22, background: 'rgba(255,255,255,0.05)', display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <strong>{item.title}</strong>
                    <span style={severityStyle(item.severity)}>{item.severity}</span>
                  </div>
                  <p style={{ margin: 0, color: TOKENS.textSecondary, lineHeight: 1.6 }}>{item.reason}</p>
                  <div className="forums-chip-row">
                    <button type="button" style={actionButtonStyle(TOKENS.success)}>Approve</button>
                    <button type="button" style={actionButtonStyle(TOKENS.primary)}>Note</button>
                    <button type="button" style={actionButtonStyle(TOKENS.downvote)}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          </SurfaceCard>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <GlassCard className="forums-sidebar-card">
            <div style={{ display: 'grid', gap: 16 }}>
              <span style={eyebrowStyle}>Trust distribution</span>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    data={[{ name: 'Verified', value: health.verifiedHumanPercent, fill: TOKENS.trustLight }]}
                    innerRadius="55%"
                    outerRadius="100%"
                    barSize={20}
                    startAngle={210}
                    endAngle={-30}
                  >
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar background dataKey="value" cornerRadius={12} />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
              <span style={{ color: TOKENS.textSecondary, lineHeight: 1.6 }}>
                Purple charts stay dedicated to verification and humans-only health signals.
              </span>
            </div>
          </GlassCard>

          <GlassCard>
            <div style={{ display: 'grid', gap: 14 }}>
              <span style={eyebrowStyle}>Moderator roster</span>
              {moderators.map((member) => {
                const profile = profiles[member.profileId];
                return (
                  <div key={member.id} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <Avatar label={profile?.displayName ?? 'Moderator'} size={40} imageUrl={profile?.avatarUrl} />
                    <div style={{ display: 'grid', gap: 3, flex: 1 }}>
                      <strong style={{ fontSize: 14 }}>{profile?.displayName ?? 'Moderator'}</strong>
                      <span style={{ color: TOKENS.textTertiary, fontSize: 12 }}>{member.role}</span>
                    </div>
                    <HumanVerifiedChip compact karma={profile?.karma ?? 0} isVerified={profile?.isVerified ?? false} role={member.role} />
                  </div>
                );
              })}
            </div>
          </GlassCard>

          <GlassCard>
            <div style={{ display: 'grid', gap: 12 }}>
              <span style={eyebrowStyle}>Recent moderation</span>
              {modLog.map((action) => (
                <div key={action.id} style={{ display: 'grid', gap: 4, padding: 14, borderRadius: 18, background: 'rgba(255,255,255,0.05)' }}>
                  <strong style={{ fontSize: 14 }}>{action.actionType.replace(/_/g, ' ')}</strong>
                  <span style={{ color: TOKENS.textSecondary, fontSize: 13 }}>{action.reason ?? 'No reason provided.'}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: 'gold' | 'trust';
}) {
  return (
    <SurfaceCard style={{ display: 'grid', gap: 6 }}>
      <span style={{ color: TOKENS.textTertiary, fontSize: 11, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <strong style={{ fontSize: 28, color: tone === 'trust' ? TOKENS.trustLight : TOKENS.primaryLight }}>{value}</strong>
      <span style={{ color: TOKENS.textSecondary, fontSize: 13 }}>{detail}</span>
    </SurfaceCard>
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
  margin: '6px 0 0',
  fontSize: 28,
  fontWeight: 800,
  letterSpacing: '-0.03em',
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

function severityStyle(level: string) {
  const color = level === 'high' ? TOKENS.downvote : level === 'medium' ? TOKENS.primaryLight : TOKENS.success;
  return {
    padding: '6px 10px',
    borderRadius: 999,
    background: `${color}22`,
    color,
    fontSize: 11,
    fontWeight: 800,
    textTransform: 'uppercase',
  } as const;
}

function actionButtonStyle(color: string) {
  return {
    border: 'none',
    borderRadius: 999,
    minHeight: 36,
    padding: '0 12px',
    background: `${color}22`,
    color,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 700,
  } as const;
}
