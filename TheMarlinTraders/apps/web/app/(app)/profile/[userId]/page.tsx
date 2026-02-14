'use client'

import { useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@marlin/ui/primitives/tabs'
import { ProfileHeader, type ProfileHeaderData } from '@marlin/ui/trading/profile-header'
import { ProfileStats, type ProfileStatsData } from '@marlin/ui/trading/profile-stats'
import { IdeaCard, type IdeaCardData } from '@marlin/ui/trading/idea-card'
import { FollowList, type FollowUser } from '@marlin/ui/trading/follow-list'

// ── Mock data — will be replaced with tRPC queries ───────────────────────────
// trpc.profiles.getProfile.useQuery({ userId })
// trpc.profiles.isFollowing.useQuery({ userId })
// trpc.ideas.listByUser.useQuery({ userId })
// trpc.profiles.getFollowers.useQuery({ userId })
// trpc.profiles.getFollowing.useQuery({ userId })

const MOCK_PROFILE: ProfileHeaderData = {
  userId: 'user_abc123',
  displayName: 'TraderMike',
  avatarUrl: null,
  bio: 'Full-time equities trader focused on momentum breakouts. 8 years of experience in US markets.',
  strategyDescription: 'Momentum breakouts on large-cap tech with tight risk management. Focus on earnings catalysts.',
  website: 'https://tradermike.com',
  twitter: 'tradermike',
  followerCount: 142,
  followingCount: 38,
  badges: [
    { badgeType: 'identity_verified', verifiedAt: '2025-06-15T00:00:00Z' },
    { badgeType: 'broker_connected', verifiedAt: '2025-07-01T00:00:00Z' },
  ],
}

const MOCK_STATS: ProfileStatsData = {
  winRate: 58.3,
  sharpeRatio: 1.42,
  maxDrawdown: 1250.0,
  profitFactor: 1.87,
  totalTrades: 284,
  bestMonth: 4200.5,
}

const MOCK_IDEAS: IdeaCardData[] = [
  {
    id: '1',
    title: 'AAPL breaking out of ascending triangle -- targeting $195',
    symbol: 'AAPL',
    sentiment: 'bullish',
    tags: ['breakout', 'tech', 'swing'],
    chartSnapshotUrl: null,
    upvotes: 24,
    downvotes: 3,
    commentCount: 8,
    publishedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    userId: 'user_abc123',
    authorName: 'TraderMike',
  },
  {
    id: '2',
    title: 'NVDA cup and handle forming on the daily -- long above $920',
    symbol: 'NVDA',
    sentiment: 'bullish',
    tags: ['ai', 'pattern', 'swing'],
    chartSnapshotUrl: null,
    upvotes: 15,
    downvotes: 2,
    commentCount: 5,
    publishedAt: new Date(Date.now() - 86400000).toISOString(),
    userId: 'user_abc123',
    authorName: 'TraderMike',
  },
]

const MOCK_FOLLOWERS: FollowUser[] = [
  { userId: 'user_f1', displayName: 'ChartNinja', avatarUrl: null, isFollowing: false },
  { userId: 'user_f2', displayName: 'SwingKing', avatarUrl: null, isFollowing: true },
  { userId: 'user_f3', displayName: 'AlphaSeeker', avatarUrl: null, isFollowing: false },
]

const MOCK_FOLLOWING: FollowUser[] = [
  { userId: 'user_g1', displayName: 'MomentumPro', avatarUrl: null, isFollowing: true },
  { userId: 'user_g2', displayName: 'OptionsWiz', avatarUrl: null, isFollowing: true },
]

// ── Page Component ───────────────────────────────────────────────────────────

export default function ProfilePage() {
  const params = useParams<{ userId: string }>()
  const router = useRouter()
  const userId = params.userId

  // Will be replaced with tRPC query: trpc.profiles.isFollowing.useQuery({ userId })
  const [isFollowing, setIsFollowing] = useState(false)
  const [showFollowers, setShowFollowers] = useState(false)
  const [showFollowing, setShowFollowing] = useState(false)

  // Will be replaced with tRPC mutation: trpc.profiles.follow.useMutation()
  const handleFollow = useCallback(() => {
    setIsFollowing(true)
    console.log('Follow:', userId)
  }, [userId])

  // Will be replaced with tRPC mutation: trpc.profiles.unfollow.useMutation()
  const handleUnfollow = useCallback(() => {
    setIsFollowing(false)
    console.log('Unfollow:', userId)
  }, [userId])

  const handleVote = useCallback((ideaId: string, voteType: 'up' | 'down') => {
    // Will be replaced with tRPC mutation
    console.log('Vote:', ideaId, voteType)
  }, [])

  const handleClickIdea = useCallback(
    (ideaId: string) => {
      router.push(`/ideas/${ideaId}`)
    },
    [router],
  )

  const handleUserClick = useCallback(
    (targetUserId: string) => {
      router.push(`/profile/${targetUserId}`)
    },
    [router],
  )

  const handleFollowToggle = useCallback(
    (targetUserId: string, currentlyFollowing: boolean) => {
      // Will be replaced with tRPC mutation
      console.log(currentlyFollowing ? 'Unfollow:' : 'Follow:', targetUserId)
    },
    [],
  )

  // Mock: determine if viewing own profile
  // Will be replaced with: ctx.userId === userId
  const isOwnProfile = false

  // Mock: privacy settings from profile data
  const showStats = true

  return (
    <div className="flex h-full flex-col overflow-hidden bg-navy-black">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-navy-dark px-6 py-4">
        <h1 className="text-lg font-semibold text-text-primary">Profile</h1>
        <p className="text-xs text-text-muted">View trader profile and performance</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Profile Header */}
          <ProfileHeader
            profile={MOCK_PROFILE}
            isFollowing={isFollowing}
            isOwnProfile={isOwnProfile}
            onFollow={handleFollow}
            onUnfollow={handleUnfollow}
            onFollowersClick={() => setShowFollowers(true)}
            onFollowingClick={() => setShowFollowing(true)}
          />

          {/* Tabs: Ideas | Stats | Followers | Following */}
          <Tabs defaultValue="ideas">
            <TabsList>
              <TabsTrigger value="ideas">Ideas</TabsTrigger>
              <TabsTrigger value="stats">Stats</TabsTrigger>
              <TabsTrigger value="followers">
                Followers ({MOCK_PROFILE.followerCount})
              </TabsTrigger>
              <TabsTrigger value="following">
                Following ({MOCK_PROFILE.followingCount})
              </TabsTrigger>
            </TabsList>

            {/* Ideas tab */}
            <TabsContent value="ideas">
              <div className="space-y-3 pt-2">
                {MOCK_IDEAS.length > 0 ? (
                  MOCK_IDEAS.map((idea) => (
                    <IdeaCard
                      key={idea.id}
                      idea={idea}
                      onVote={handleVote}
                      onClick={handleClickIdea}
                    />
                  ))
                ) : (
                  <div className="rounded-lg border border-border bg-navy-dark py-12 text-center text-sm text-text-muted">
                    No published ideas yet
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Stats tab */}
            <TabsContent value="stats">
              <div className="pt-2">
                <ProfileStats
                  data={showStats ? MOCK_STATS : null}
                  isPrivate={!showStats}
                />
              </div>
            </TabsContent>

            {/* Followers tab */}
            <TabsContent value="followers">
              <div className="space-y-1 pt-2">
                {MOCK_FOLLOWERS.map((user) => (
                  <div
                    key={user.userId}
                    className="flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-navy-mid"
                  >
                    <button
                      type="button"
                      onClick={() => handleUserClick(user.userId)}
                      className="flex items-center gap-3"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 text-[10px] font-bold text-accent">
                        {(user.displayName ?? user.userId).charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-text-primary hover:underline">
                        {user.displayName ?? user.userId.slice(0, 12)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleFollowToggle(user.userId, !!user.isFollowing)
                      }
                      className={
                        user.isFollowing
                          ? 'ml-auto rounded-md border border-border px-3 py-1 text-xs font-medium text-text-secondary hover:border-trading-red hover:text-trading-red transition-colors'
                          : 'ml-auto rounded-md bg-accent px-3 py-1 text-xs font-medium text-text-primary hover:bg-accent-hover transition-colors'
                      }
                    >
                      {user.isFollowing ? 'Following' : 'Follow'}
                    </button>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Following tab */}
            <TabsContent value="following">
              <div className="space-y-1 pt-2">
                {MOCK_FOLLOWING.map((user) => (
                  <div
                    key={user.userId}
                    className="flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-navy-mid"
                  >
                    <button
                      type="button"
                      onClick={() => handleUserClick(user.userId)}
                      className="flex items-center gap-3"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 text-[10px] font-bold text-accent">
                        {(user.displayName ?? user.userId).charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-text-primary hover:underline">
                        {user.displayName ?? user.userId.slice(0, 12)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleFollowToggle(user.userId, !!user.isFollowing)
                      }
                      className="ml-auto rounded-md border border-border px-3 py-1 text-xs font-medium text-text-secondary hover:border-trading-red hover:text-trading-red transition-colors"
                    >
                      Following
                    </button>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Follow list modals */}
      <FollowList
        open={showFollowers}
        onOpenChange={setShowFollowers}
        title="Followers"
        users={MOCK_FOLLOWERS}
        onFollowToggle={handleFollowToggle}
        onUserClick={handleUserClick}
      />

      <FollowList
        open={showFollowing}
        onOpenChange={setShowFollowing}
        title="Following"
        users={MOCK_FOLLOWING}
        onFollowToggle={handleFollowToggle}
        onUserClick={handleUserClick}
      />
    </div>
  )
}
