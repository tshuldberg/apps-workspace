'use client'

import { cn } from '../lib/utils.js'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../primitives/tooltip.js'

// ── Types ────────────────────────────────────────────────────────────────────

export interface Badge {
  badgeType: 'identity_verified' | 'broker_connected' | 'performance_audited'
  verifiedAt: string | Date
}

export interface ProfileHeaderData {
  userId: string
  displayName: string | null
  avatarUrl: string | null
  bio: string | null
  strategyDescription: string | null
  website: string | null
  twitter: string | null
  followerCount: number
  followingCount: number
  badges: Badge[]
}

export interface ProfileHeaderProps {
  profile: ProfileHeaderData
  isFollowing?: boolean
  isOwnProfile?: boolean
  onFollow?: () => void
  onUnfollow?: () => void
  onFollowersClick?: () => void
  onFollowingClick?: () => void
  className?: string
}

// ── Badge config ─────────────────────────────────────────────────────────────

const BADGE_CONFIG: Record<Badge['badgeType'], { label: string; icon: string; color: string }> = {
  identity_verified: {
    label: 'Identity Verified',
    icon: '\u2713',
    color: 'bg-trading-green/20 text-trading-green',
  },
  broker_connected: {
    label: 'Broker Connected',
    icon: '\u26A1',
    color: 'bg-accent/20 text-accent',
  },
  performance_audited: {
    label: 'Performance Audited',
    icon: '\u2605',
    color: 'bg-yellow-500/20 text-yellow-400',
  },
}

// ── Component ────────────────────────────────────────────────────────────────

export function ProfileHeader({
  profile,
  isFollowing = false,
  isOwnProfile = false,
  onFollow,
  onUnfollow,
  onFollowersClick,
  onFollowingClick,
  className,
}: ProfileHeaderProps) {
  const initials = (profile.displayName ?? profile.userId)
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className={cn('rounded-lg border border-border bg-navy-dark p-6', className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
        {/* Avatar */}
        {profile.avatarUrl ? (
          <img
            src={profile.avatarUrl}
            alt={profile.displayName ?? 'User avatar'}
            className="h-16 w-16 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent/20 text-lg font-bold text-accent">
            {initials}
          </div>
        )}

        {/* Info */}
        <div className="min-w-0 flex-1">
          {/* Name row */}
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-text-primary">
              {profile.displayName ?? profile.userId.slice(0, 12)}
            </h2>

            {/* Verification badges */}
            {profile.badges.length > 0 && (
              <TooltipProvider>
                <div className="flex items-center gap-1">
                  {profile.badges.map((badge) => {
                    const config = BADGE_CONFIG[badge.badgeType]
                    return (
                      <Tooltip key={badge.badgeType}>
                        <TooltipTrigger asChild>
                          <span
                            className={cn(
                              'inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px]',
                              config.color,
                            )}
                          >
                            {config.icon}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{config.label}</TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
              </TooltipProvider>
            )}
          </div>

          <p className="text-xs text-text-muted">@{profile.userId.slice(0, 16)}</p>

          {/* Bio */}
          {profile.bio && (
            <p className="mt-2 text-sm text-text-secondary">{profile.bio}</p>
          )}

          {/* Strategy description */}
          {profile.strategyDescription && (
            <p className="mt-1 text-xs text-text-muted italic">
              Strategy: {profile.strategyDescription}
            </p>
          )}

          {/* Links */}
          {(profile.website || profile.twitter) && (
            <div className="mt-2 flex items-center gap-3">
              {profile.website && (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent hover:underline"
                >
                  {new URL(profile.website).hostname}
                </a>
              )}
              {profile.twitter && (
                <a
                  href={`https://x.com/${profile.twitter.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent hover:underline"
                >
                  @{profile.twitter.replace('@', '')}
                </a>
              )}
            </div>
          )}

          {/* Follow counts + Follow button */}
          <div className="mt-3 flex items-center gap-4">
            <button
              type="button"
              onClick={onFollowersClick}
              className="text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              <span className="font-semibold font-mono tabular-nums text-text-primary">
                {profile.followerCount}
              </span>{' '}
              {profile.followerCount === 1 ? 'Follower' : 'Followers'}
            </button>
            <button
              type="button"
              onClick={onFollowingClick}
              className="text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              <span className="font-semibold font-mono tabular-nums text-text-primary">
                {profile.followingCount}
              </span>{' '}
              Following
            </button>

            {!isOwnProfile && (
              <button
                type="button"
                onClick={isFollowing ? onUnfollow : onFollow}
                className={cn(
                  'ml-auto rounded-md px-4 py-1.5 text-xs font-medium transition-colors',
                  isFollowing
                    ? 'border border-border bg-transparent text-text-secondary hover:border-trading-red hover:text-trading-red'
                    : 'bg-accent text-text-primary hover:bg-accent-hover',
                )}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
