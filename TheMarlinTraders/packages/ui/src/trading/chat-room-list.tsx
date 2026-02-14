'use client'

import { cn } from '../lib/utils.js'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ChatRoomListItem {
  id: string
  name: string
  type: 'ticker' | 'strategy' | 'general'
  symbol?: string | null
  description?: string | null
  memberCount: number
  lastMessage?: {
    body: string
    authorName: string
    createdAt: string | Date
  } | null
}

export interface ChatRoomListProps {
  rooms: ChatRoomListItem[]
  onRoomClick: (roomId: string) => void
  isLoading?: boolean
  className?: string
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(date: string | Date): string {
  const now = Date.now()
  const then = typeof date === 'string' ? new Date(date).getTime() : date.getTime()
  const diffMs = now - then
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffDay > 0) return `${diffDay}d ago`
  if (diffHr > 0) return `${diffHr}h ago`
  if (diffMin > 0) return `${diffMin}m ago`
  return 'just now'
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen).trimEnd() + '...'
}

// ── Component ───────────────────────────────────────────────────────────────

export function ChatRoomList({
  rooms,
  onRoomClick,
  isLoading = false,
  className,
}: ChatRoomListProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {rooms.length > 0 ? (
        rooms.map((room) => (
          <button
            key={room.id}
            type="button"
            onClick={() => onRoomClick(room.id)}
            className="group flex w-full items-start gap-4 rounded-lg border border-border bg-navy-dark p-4 text-left transition-colors hover:border-accent/40 hover:bg-navy-mid"
          >
            {/* Room info */}
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <span
                  className={cn(
                    'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase',
                    room.type === 'ticker'
                      ? 'bg-trading-green/15 text-trading-green'
                      : room.type === 'strategy'
                        ? 'bg-accent/15 text-accent'
                        : 'bg-text-muted/15 text-text-muted',
                  )}
                >
                  {room.type}
                </span>
                <span className="text-sm font-semibold text-text-primary group-hover:text-accent">
                  {room.name}
                </span>
                {room.symbol && (
                  <span className="font-mono text-xs text-accent">${room.symbol}</span>
                )}
              </div>

              {room.description && (
                <p className="mb-2 text-xs leading-relaxed text-text-muted">
                  {truncate(room.description, 120)}
                </p>
              )}

              {/* Last message preview */}
              {room.lastMessage && (
                <div className="flex items-center gap-1 text-xs text-text-muted">
                  <span className="font-medium text-text-secondary">
                    {room.lastMessage.authorName}:
                  </span>
                  <span className="truncate">
                    {truncate(room.lastMessage.body, 60)}
                  </span>
                  <span className="shrink-0 text-[10px]">
                    {timeAgo(room.lastMessage.createdAt)}
                  </span>
                </div>
              )}
            </div>

            {/* Member count */}
            <div className="shrink-0 text-right">
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-trading-green" />
                <span className="font-mono text-xs tabular-nums text-text-muted">
                  {room.memberCount}
                </span>
              </div>
              <span className="text-[10px] text-text-muted">online</span>
            </div>
          </button>
        ))
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 py-16">
          <span className="text-sm text-text-muted">
            {isLoading ? 'Loading rooms...' : 'No rooms available'}
          </span>
        </div>
      )}
    </div>
  )
}
