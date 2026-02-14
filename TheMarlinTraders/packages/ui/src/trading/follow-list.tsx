'use client'

import { useState } from 'react'
import { cn } from '../lib/utils.js'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../primitives/dialog.js'

// ── Types ────────────────────────────────────────────────────────────────────

export interface FollowUser {
  userId: string
  displayName: string | null
  avatarUrl: string | null
  isFollowing?: boolean
}

export interface FollowListProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: 'Followers' | 'Following'
  users: FollowUser[]
  hasMore?: boolean
  onLoadMore?: () => void
  isLoading?: boolean
  onFollowToggle?: (userId: string, currentlyFollowing: boolean) => void
  onUserClick?: (userId: string) => void
  className?: string
}

// ── Component ────────────────────────────────────────────────────────────────

export function FollowList({
  open,
  onOpenChange,
  title,
  users,
  hasMore = false,
  onLoadMore,
  isLoading = false,
  onFollowToggle,
  onUserClick,
  className,
}: FollowListProps) {
  const [search, setSearch] = useState('')

  const filtered = search
    ? users.filter(
        (u) =>
          (u.displayName ?? u.userId)
            .toLowerCase()
            .includes(search.toLowerCase()),
      )
    : users

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('max-h-[70vh] flex flex-col', className)}>
        <DialogHeader>
          <DialogTitle>
            {title} ({users.length})
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="px-0 pb-2">
          <input
            type="text"
            placeholder={`Search ${title.toLowerCase()}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex h-9 w-full rounded-md border border-border bg-navy-dark px-3 py-1 text-sm text-text-primary shadow-sm placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          />
        </div>

        {/* User list */}
        <div className="flex-1 overflow-y-auto space-y-1">
          {filtered.map((user) => {
            const initials = (user.displayName ?? user.userId)
              .slice(0, 2)
              .toUpperCase()

            return (
              <div
                key={user.userId}
                className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-navy-mid"
              >
                {/* Avatar */}
                <button
                  type="button"
                  onClick={() => {
                    onUserClick?.(user.userId)
                    onOpenChange(false)
                  }}
                  className="flex shrink-0 items-center gap-3"
                >
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt=""
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 text-[10px] font-bold text-accent">
                      {initials}
                    </div>
                  )}
                  <span className="text-sm font-medium text-text-primary hover:underline">
                    {user.displayName ?? user.userId.slice(0, 12)}
                  </span>
                </button>

                {/* Follow/Unfollow button */}
                {onFollowToggle && (
                  <button
                    type="button"
                    onClick={() =>
                      onFollowToggle(user.userId, !!user.isFollowing)
                    }
                    className={cn(
                      'ml-auto shrink-0 rounded-md px-3 py-1 text-xs font-medium transition-colors',
                      user.isFollowing
                        ? 'border border-border text-text-secondary hover:border-trading-red hover:text-trading-red'
                        : 'bg-accent text-text-primary hover:bg-accent-hover',
                    )}
                  >
                    {user.isFollowing ? 'Following' : 'Follow'}
                  </button>
                )}
              </div>
            )
          })}

          {filtered.length === 0 && (
            <div className="py-8 text-center text-sm text-text-muted">
              {search ? 'No users match your search' : `No ${title.toLowerCase()} yet`}
            </div>
          )}
        </div>

        {/* Load more */}
        {hasMore && !search && (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={onLoadMore}
              disabled={isLoading}
              className="rounded-md border border-border px-4 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-navy-mid hover:text-text-primary disabled:opacity-50"
            >
              {isLoading ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
