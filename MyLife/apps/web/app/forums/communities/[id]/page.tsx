'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  fetchCommunityById,
  fetchCommunityMembers,
  fetchCommunityRules,
  fetchCommunityTags,
  fetchProfilesByIds,
  fetchThreads,
  joinCommunityAction,
  leaveCommunityAction,
} from '../../actions';
import {
  Avatar,
  DesktopThreadCard,
  EmptyState,
  GlassCard,
  HumanVerifiedChip,
  MaterialSymbol,
  SurfaceCard,
} from '../../components';
import {
  TOKENS,
  chipStyle,
  formatCount,
  formatRelativeTime,
  getCommunityCover,
  gradientButtonStyle,
  truncate,
} from '../../ui';

interface CommunityRow {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  communityType: string;
  humansOnly: boolean | number;
  memberCount: number;
  threadCount: number;
  createdAt?: string;
}

interface ThreadRow {
  id: string;
  communityId: string;
  authorId: string;
  title: string;
  body: string;
  isPinned: boolean | number;
  voteScore: number;
  replyCount: number;
  viewCount: number;
  createdAt: string;
}

interface MemberRow {
  id: string;
  profileId: string;
  role: string;
  status: string;
  joinedAt: string;
}

interface RuleRow {
  id: string;
  title: string;
  description: string;
  position: number;
}

interface TagRow {
  id: string;
  name: string;
  color: string | null;
}

interface ProfileRow {
  id: string;
  displayName: string;
  username: string;
  karma: number;
  isVerified: boolean | number;
  avatarUrl: string | null;
}

type TabKey = 'threads' | 'about' | 'rules' | 'members';
type SortMode = 'hot' | 'new' | 'top';

export default function CommunityDetailPage() {
  const params = useParams<{ id: string }>();
  const [community, setCommunity] = useState<CommunityRow | null>(null);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [tags, setTags] = useState<TagRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [joined, setJoined] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('threads');
  const [sort, setSort] = useState<SortMode>('hot');
  const [memberQuery, setMemberQuery] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const communityResult = await fetchCommunityById(params.id);
        if (!communityResult) {
          if (!cancelled) setError('Community not found.');
          return;
        }
        const [threadResult, memberResult, ruleResult, tagResult] = await Promise.all([
          fetchThreads(params.id, { sort, limit: 40 }),
          fetchCommunityMembers(params.id),
          fetchCommunityRules(params.id),
          fetchCommunityTags(params.id),
        ]);
        const memberRows = (memberResult as MemberRow[]) ?? [];
        const profileRows = (await fetchProfilesByIds(memberRows.map((member) => member.profileId))) as ProfileRow[];
        if (cancelled) return;
        setCommunity((communityResult as CommunityRow) ?? null);
        setThreads((threadResult as ThreadRow[]) ?? []);
        setMembers(memberRows);
        setRules((ruleResult as RuleRow[]) ?? []);
        setTags((tagResult as TagRow[]) ?? []);
        setProfiles(Object.fromEntries(profileRows.map((profile) => [profile.id, profile])));
        setJoined(memberRows.some((member) => member.profileId === 'local-user' && member.status === 'active'));
      } catch {
        if (!cancelled) setError('Could not load this community.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id, sort]);

  const pinnedThreads = threads.filter((thread) => Boolean(thread.isPinned)).slice(0, 3);
  const modTeam = useMemo(
    () => members.filter((member) => ['owner', 'admin', 'moderator'].includes(member.role)).slice(0, 6),
    [members],
  );
  const filteredMembers = useMemo(() => {
    const rows = members.filter((member) => member.status === 'active');
    return rows.filter((member) => {
      const profile = profiles[member.profileId];
      if (!memberQuery.trim()) return true;
      const haystack = `${profile?.displayName ?? ''} ${profile?.username ?? ''}`.toLowerCase();
      return haystack.includes(memberQuery.trim().toLowerCase());
    });
  }, [memberQuery, members, profiles]);
  const pagedMembers = filteredMembers.slice(page * 12, page * 12 + 12);

  async function toggleMembership() {
    if (!community) return;
    const next = !joined;
    setJoined(next);
    setCommunity({
      ...community,
      memberCount: Math.max(0, community.memberCount + (next ? 1 : -1)),
    });
    try {
      if (next) {
        await joinCommunityAction(community.id);
      } else {
        await leaveCommunityAction(community.id);
      }
    } catch {
      setJoined(!next);
      setCommunity(community);
    }
  }

  if (loading) {
    return (
      <div className="forums-page-stack">
        <GlassCard style={{ minHeight: 280, animation: 'pulse 1.5s ease-in-out infinite' }} />
        <GlassCard style={{ minHeight: 460, animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
    );
  }

  if (error || !community) {
    return (
      <EmptyState
        icon="travel_explore"
        title="Community unavailable"
        description={error ?? 'This community is not available right now.'}
        actionHref="/forums/communities"
        actionLabel="Back to browser"
      />
    );
  }

  return (
    <div className="forums-page-stack">
      <div style={{ marginTop: -12 }}>
        <div
          style={{
            height: 240,
            borderRadius: 36,
            background: `linear-gradient(180deg, transparent, rgba(14,14,19,0.9)), ${getCommunityCover(community.displayName)}`,
          }}
        />
        <div style={{ marginTop: -78, padding: '0 24px' }}>
          <GlassCard style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 18, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div
                  style={{
                    width: 104,
                    height: 104,
                    borderRadius: 32,
                    background: getCommunityCover(community.displayName),
                    boxShadow: '0 24px 50px rgba(0,0,0,0.28)',
                  }}
                />
                <div style={{ display: 'grid', gap: 12 }}>
                  <div className="forums-chip-row">
                    <span style={communityTypePillStyle}>{community.communityType}</span>
                    {community.humansOnly ? <span style={chipStyle(true, 'trust')}>Humans Only</span> : null}
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <h1 style={{ margin: 0, fontSize: 40, lineHeight: 1.04, fontWeight: 800, letterSpacing: '-0.05em' }}>
                      {community.displayName}
                    </h1>
                    <p style={{ margin: 0, color: TOKENS.textSecondary, maxWidth: 760, lineHeight: 1.65 }}>
                      {community.description ?? 'A careful, slower-moving discussion room curated for human readers.'}
                    </p>
                  </div>
                  <div className="forums-chip-row">
                    <span style={metaPillStyle}>
                      <MaterialSymbol name="groups" size={16} color={TOKENS.primaryLight} />
                      {formatCount(community.memberCount)} members
                    </span>
                    <span style={metaPillStyle}>
                      <MaterialSymbol name="forum" size={16} color={TOKENS.primaryLight} />
                      {formatCount(community.threadCount)} threads
                    </span>
                    <span style={metaPillStyle}>
                      <MaterialSymbol name="online_prediction" size={16} color={TOKENS.primaryLight} />
                      {Math.max(12, Math.round(community.memberCount * 0.07))} online
                    </span>
                  </div>
                </div>
              </div>

              <div className="forums-chip-row">
                <button type="button" onClick={() => void toggleMembership()} style={joined ? joinedButtonStyle : gradientButtonStyle}>
                  {joined ? 'Leave' : 'Join'}
                </button>
                <Link href={`/forums/create-thread?community=${community.id}`} style={{ ...gradientButtonStyle, textDecoration: 'none' }}>
                  Create thread
                </Link>
                <Link href={`/forums/community-settings/${community.id}`} style={ghostLinkStyle}>
                  <MaterialSymbol name="more_vert" size={18} color={TOKENS.primaryLight} />
                </Link>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      <div className="forums-chip-row">
        {([
          ['threads', 'Threads'],
          ['about', 'About'],
          ['rules', 'Rules'],
          ['members', 'Members'],
        ] as const).map(([value, label]) => (
          <button key={value} type="button" onClick={() => setActiveTab(value)} style={chipStyle(activeTab === value, value === 'members' ? 'trust' : 'gold')}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'threads' ? (
        <div className="forums-detail-grid">
          <div style={{ display: 'grid', gap: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <span style={eyebrowStyle}>Thread stack</span>
                <h2 style={sectionTitleStyle}>Current discussion</h2>
              </div>
              <div className="forums-chip-row">
                {(['hot', 'new', 'top'] as SortMode[]).map((value) => (
                  <button key={value} type="button" onClick={() => setSort(value)} style={chipStyle(sort === value, value === 'top' ? 'trust' : 'neutral')}>
                    {value}
                  </button>
                ))}
              </div>
            </div>

            {threads.length === 0 ? (
              <EmptyState
                icon="forum"
                title="This room is quiet"
                description="No threads have been posted in this community yet. Start the first one to establish the tone."
                actionHref={`/forums/create-thread?community=${community.id}`}
                actionLabel="Create thread"
              />
            ) : (
              threads.map((thread) => {
                const author = profiles[thread.authorId];
                return (
                  <DesktopThreadCard
                    key={thread.id}
                    href={`/forums/thread/${thread.id}`}
                    title={thread.title}
                    body={truncate(thread.body.replace(/\s+/g, ' ').trim(), 260)}
                    communityLabel={community.displayName}
                    authorLabel={author?.displayName ?? 'Curator'}
                    createdAt={thread.createdAt}
                    replies={thread.replyCount}
                    votes={thread.voteScore}
                    views={thread.viewCount}
                    pinned={Boolean(thread.isPinned)}
                    trust={{ karma: author?.karma ?? 0, isVerified: author?.isVerified ?? false }}
                  />
                );
              })
            )}
          </div>

          <div style={{ display: 'grid', gap: 16 }}>
            <GlassCard className="forums-sidebar-card">
              <div style={{ display: 'grid', gap: 16 }}>
                <span style={eyebrowStyle}>Pinned threads</span>
                {pinnedThreads.length === 0 ? (
                  <p style={{ margin: 0, color: TOKENS.textSecondary, lineHeight: 1.6 }}>
                    No pinned guidance yet.
                  </p>
                ) : (
                  pinnedThreads.map((thread) => (
                    <Link key={thread.id} href={`/forums/thread/${thread.id}`} style={{ textDecoration: 'none', color: TOKENS.text }}>
                      <div style={{ display: 'grid', gap: 6, padding: 16, borderRadius: 22, background: 'rgba(255,255,255,0.04)' }}>
                        <strong>{thread.title}</strong>
                        <span style={{ color: TOKENS.textTertiary, fontSize: 12 }}>
                          {formatRelativeTime(thread.createdAt)} · {thread.replyCount} replies
                        </span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </GlassCard>

            <GlassCard>
              <div style={{ display: 'grid', gap: 16 }}>
                <span style={eyebrowStyle}>Mod team</span>
                {modTeam.length === 0 ? (
                  <p style={{ margin: 0, color: TOKENS.textSecondary, lineHeight: 1.6 }}>
                    Moderators will appear here once the role roster is cached.
                  </p>
                ) : (
                  modTeam.map((member) => {
                    const profile = profiles[member.profileId];
                    return (
                      <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Avatar label={profile?.displayName ?? 'Moderator'} size={38} imageUrl={profile?.avatarUrl} />
                        <div style={{ display: 'grid', gap: 3 }}>
                          <strong style={{ fontSize: 14 }}>{profile?.displayName ?? 'Moderator'}</strong>
                          <span style={{ color: TOKENS.textTertiary, fontSize: 12 }}>{member.role}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </GlassCard>

            <GlassCard>
              <div style={{ display: 'grid', gap: 12 }}>
                <span style={eyebrowStyle}>Rules snapshot</span>
                {(rules.slice(0, 3) || []).map((rule) => (
                  <div key={rule.id} style={{ display: 'grid', gap: 4, padding: 14, borderRadius: 20, background: 'rgba(255,255,255,0.04)' }}>
                    <strong style={{ fontSize: 14 }}>{rule.position + 1}. {rule.title}</strong>
                    <span style={{ color: TOKENS.textSecondary, fontSize: 13, lineHeight: 1.55 }}>{rule.description}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        </div>
      ) : null}

      {activeTab === 'about' ? (
        <div className="forums-detail-grid">
          <SurfaceCard style={{ display: 'grid', gap: 18 }}>
            <div>
              <span style={eyebrowStyle}>About</span>
              <h2 style={sectionTitleStyle}>What this community curates</h2>
            </div>
            <p style={{ margin: 0, color: TOKENS.textSecondary, lineHeight: 1.8, fontSize: 16 }}>
              {community.description ?? 'This room is tuned for careful discussion, visible moderation, and high-trust participants.'}
            </p>
            <div className="forums-chip-row">
              {tags.length > 0 ? tags.map((tag) => (
                <span key={tag.id} style={tagPillStyle(tag.color)}>
                  {tag.name}
                </span>
              )) : <span style={tagPillStyle(null)}>No tags yet</span>}
            </div>
          </SurfaceCard>
          <GlassCard>
            <div style={{ display: 'grid', gap: 14 }}>
              <span style={eyebrowStyle}>Linked moderation context</span>
              <Link href={`/forums/community-health/${community.id}`} style={sidebarLinkStyle}>Community health</Link>
              <Link href={`/forums/mod-log?community=${community.id}`} style={sidebarLinkStyle}>Public moderation log</Link>
              <Link href={`/forums/community-settings/${community.id}`} style={sidebarLinkStyle}>Settings</Link>
            </div>
          </GlassCard>
        </div>
      ) : null}

      {activeTab === 'rules' ? (
        <div className="forums-two-up">
          {rules.map((rule, index) => (
            <SurfaceCard key={rule.id} style={{ display: 'grid', gap: 12 }}>
              <span style={{ color: TOKENS.primaryLight, fontSize: 12, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
                Rule {index + 1}
              </span>
              <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' }}>{rule.title}</h3>
              <p style={{ margin: 0, color: TOKENS.textSecondary, lineHeight: 1.7 }}>{rule.description}</p>
            </SurfaceCard>
          ))}
        </div>
      ) : null}

      {activeTab === 'members' ? (
        <div className="forums-page-stack">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              value={memberQuery}
              onChange={(event) => {
                setPage(0);
                setMemberQuery(event.target.value);
              }}
              placeholder="Search members..."
              style={{ border: 'none', borderRadius: 18, padding: '14px 16px', background: 'rgba(255,255,255,0.05)', color: TOKENS.text, minWidth: 280 }}
            />
            <span style={{ color: TOKENS.textTertiary, fontSize: 13 }}>{filteredMembers.length} members</span>
          </div>

          <div className="forums-three-up">
            {pagedMembers.map((member) => {
              const profile = profiles[member.profileId];
              return (
                <SurfaceCard key={member.id} style={{ display: 'grid', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <Avatar label={profile?.displayName ?? 'Curator'} size={52} imageUrl={profile?.avatarUrl} />
                    <HumanVerifiedChip compact karma={profile?.karma ?? 0} isVerified={profile?.isVerified ?? false} role={member.role} />
                  </div>
                  <div style={{ display: 'grid', gap: 4 }}>
                    <strong style={{ fontSize: 18 }}>{profile?.displayName ?? 'Curator'}</strong>
                    <span style={{ color: TOKENS.textTertiary, fontSize: 12 }}>@{profile?.username ?? 'unknown'}</span>
                  </div>
                  <div className="forums-chip-row">
                    <span style={metaPillStyle}>{member.role}</span>
                    <span style={metaPillStyle}>Joined {formatRelativeTime(member.joinedAt)}</span>
                  </div>
                </SurfaceCard>
              );
            })}
          </div>

          <div className="forums-chip-row" style={{ justifyContent: 'space-between' }}>
            <button type="button" onClick={() => setPage((current) => Math.max(0, current - 1))} style={chipStyle(false, 'neutral')}>
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => (current + 1) * 12 < filteredMembers.length ? current + 1 : current)}
              style={chipStyle(false)}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
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
  margin: '6px 0 0',
  fontSize: 28,
  fontWeight: 800,
  letterSpacing: '-0.03em',
} as const;

const metaPillStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 14px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.05)',
  color: TOKENS.textSecondary,
  fontSize: 13,
  fontWeight: 700,
} as const;

const communityTypePillStyle = {
  padding: '7px 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.05)',
  color: TOKENS.primaryLight,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
} as const;

const joinedButtonStyle = {
  border: 'none',
  borderRadius: 999,
  padding: '12px 18px',
  background: 'rgba(255,255,255,0.05)',
  color: TOKENS.text,
  fontSize: 13,
  fontWeight: 800,
  cursor: 'pointer',
} as const;

const ghostLinkStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 42,
  height: 42,
  borderRadius: 999,
  background: 'rgba(255,255,255,0.05)',
  textDecoration: 'none',
} as const;

function tagPillStyle(color: string | null) {
  return {
    padding: '8px 12px',
    borderRadius: 999,
    background: color ? `${color}22` : 'rgba(255,255,255,0.05)',
    color: color ?? TOKENS.textSecondary,
    fontSize: 12,
    fontWeight: 700,
  } as const;
}

const sidebarLinkStyle = {
  display: 'inline-flex',
  minHeight: 40,
  alignItems: 'center',
  padding: '0 14px',
  borderRadius: 999,
  textDecoration: 'none',
  background: 'rgba(255,255,255,0.05)',
  color: TOKENS.textSecondary,
  fontSize: 13,
  fontWeight: 700,
} as const;
