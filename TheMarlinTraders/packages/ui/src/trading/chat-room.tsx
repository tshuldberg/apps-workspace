'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { cn } from '../lib/utils.js'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessageData {
  id: string
  roomId: string
  userId: string
  parentId: string | null
  body: string
  isDeleted: boolean
  createdAt: string | Date
  updatedAt: string | Date
  displayName?: string
  avatarUrl?: string | null
  reactions?: { emoji: string; count: number; hasReacted: boolean }[]
  replyCount?: number
}

export interface ChatRoomProps {
  roomId: string
  roomName: string
  roomType: 'ticker' | 'strategy' | 'general'
  symbol?: string | null
  messages: ChatMessageData[]
  hasMore: boolean
  onLoadMore: () => void
  isLoading?: boolean
  onSendMessage: (body: string, parentId?: string) => void
  onDeleteMessage?: (messageId: string) => void
  onAddReaction?: (messageId: string, emoji: string) => void
  onRemoveReaction?: (messageId: string, emoji: string) => void
  onSymbolClick?: (symbol: string) => void
  isSending?: boolean
  canPost?: boolean
  gateReason?: string
  currentUserId?: string
  className?: string
}

// ── Constants ───────────────────────────────────────────────────────────────

const REACTION_EMOJIS = ['🔥', '📈', '📉', '💎', '🚀', '👍', '👎', '🤔']

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

/**
 * Detect $SYMBOL mentions in text and split into segments.
 */
function parseSymbolMentions(
  text: string,
): { type: 'text' | 'symbol'; value: string }[] {
  const regex = /\$([A-Z]{1,5})/g
  const segments: { type: 'text' | 'symbol'; value: string }[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    segments.push({ type: 'symbol', value: match[1]! })
    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) })
  }

  return segments.length > 0 ? segments : [{ type: 'text', value: text }]
}

// ── Single Message ──────────────────────────────────────────────────────────

interface SingleMessageProps {
  message: ChatMessageData
  isEven: boolean
  onReply: (messageId: string) => void
  onDelete?: (messageId: string) => void
  onAddReaction?: (messageId: string, emoji: string) => void
  onRemoveReaction?: (messageId: string, emoji: string) => void
  onSymbolClick?: (symbol: string) => void
  currentUserId?: string
  showReactionPicker: string | null
  onToggleReactionPicker: (messageId: string | null) => void
}

function SingleMessage({
  message,
  isEven,
  onReply,
  onDelete,
  onAddReaction,
  onRemoveReaction,
  onSymbolClick,
  currentUserId,
  showReactionPicker,
  onToggleReactionPicker,
}: SingleMessageProps) {
  const segments = useMemo(() => parseSymbolMentions(message.body), [message.body])
  const isOwn = currentUserId === message.userId
  const isPickerOpen = showReactionPicker === message.id

  return (
    <div
      className={cn(
        'group px-4 py-2.5 transition-colors hover:bg-navy-mid/50',
        isEven && 'bg-navy-dark/30',
      )}
    >
      <div className="flex gap-3">
        {/* Avatar */}
        {message.avatarUrl ? (
          <img
            src={message.avatarUrl}
            alt=""
            className="mt-0.5 h-8 w-8 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent">
            {(message.displayName ?? message.userId).charAt(0).toUpperCase()}
          </div>
        )}

        <div className="min-w-0 flex-1">
          {/* Author + time */}
          <div className="mb-0.5 flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary">
              {message.displayName ?? message.userId.slice(0, 12)}
            </span>
            <span className="text-[10px] text-text-muted">
              {timeAgo(message.createdAt)}
            </span>
          </div>

          {/* Body */}
          {message.isDeleted ? (
            <p className="text-sm italic text-text-muted">[message deleted]</p>
          ) : (
            <p className="text-sm leading-relaxed text-text-secondary">
              {segments.map((seg, i) =>
                seg.type === 'symbol' ? (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onSymbolClick?.(seg.value)}
                    className="font-semibold text-accent hover:underline"
                  >
                    ${seg.value}
                  </button>
                ) : (
                  <span key={i}>{seg.value}</span>
                ),
              )}
            </p>
          )}

          {/* Reactions */}
          {message.reactions && message.reactions.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {message.reactions.map((r) => (
                <button
                  key={r.emoji}
                  type="button"
                  onClick={() =>
                    r.hasReacted
                      ? onRemoveReaction?.(message.id, r.emoji)
                      : onAddReaction?.(message.id, r.emoji)
                  }
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors',
                    r.hasReacted
                      ? 'border-accent/40 bg-accent/10 text-accent'
                      : 'border-border bg-navy-dark text-text-muted hover:border-accent/40',
                  )}
                >
                  {r.emoji} <span className="font-mono tabular-nums">{r.count}</span>
                </button>
              ))}
            </div>
          )}

          {/* Actions (visible on hover) */}
          {!message.isDeleted && (
            <div className="mt-1 flex items-center gap-3 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={() => onReply(message.id)}
                className="text-[10px] text-text-muted transition-colors hover:text-text-secondary"
              >
                Reply
                {message.replyCount && message.replyCount > 0 && (
                  <span className="ml-1 font-mono tabular-nums">
                    ({message.replyCount})
                  </span>
                )}
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    onToggleReactionPicker(isPickerOpen ? null : message.id)
                  }
                  className="text-[10px] text-text-muted transition-colors hover:text-text-secondary"
                >
                  + React
                </button>
                {isPickerOpen && (
                  <div className="absolute bottom-6 left-0 z-10 flex gap-1 rounded-lg border border-border bg-navy-dark p-1.5 shadow-lg">
                    {REACTION_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          onAddReaction?.(message.id, emoji)
                          onToggleReactionPicker(null)
                        }}
                        className="rounded p-1 text-base transition-colors hover:bg-navy-mid"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {isOwn && onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(message.id)}
                  className="text-[10px] text-text-muted transition-colors hover:text-trading-red"
                >
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Thread Panel ────────────────────────────────────────────────────────────

interface ThreadPanelProps {
  parentMessage: ChatMessageData
  replies: ChatMessageData[]
  onClose: () => void
  onSendReply: (body: string) => void
  isSending?: boolean
  onSymbolClick?: (symbol: string) => void
}

function ThreadPanel({
  parentMessage,
  replies,
  onClose,
  onSendReply,
  isSending = false,
  onSymbolClick,
}: ThreadPanelProps) {
  const [replyText, setReplyText] = useState('')

  const handleSubmit = useCallback(() => {
    if (replyText.trim()) {
      onSendReply(replyText.trim())
      setReplyText('')
    }
  }, [replyText, onSendReply])

  return (
    <div className="flex w-80 shrink-0 flex-col border-l border-border bg-navy-dark">
      {/* Thread header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
          Thread
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-text-muted transition-colors hover:text-text-primary"
        >
          x
        </button>
      </div>

      {/* Parent message */}
      <div className="border-b border-border/50 px-4 py-3">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xs font-medium text-text-primary">
            {parentMessage.displayName ?? parentMessage.userId.slice(0, 12)}
          </span>
          <span className="text-[10px] text-text-muted">
            {timeAgo(parentMessage.createdAt)}
          </span>
        </div>
        <p className="text-sm text-text-secondary">{parentMessage.body}</p>
      </div>

      {/* Replies */}
      <div className="flex-1 overflow-y-auto">
        {replies.map((reply) => {
          const segments = parseSymbolMentions(reply.body)
          return (
            <div key={reply.id} className="border-b border-border/30 px-4 py-2.5">
              <div className="mb-0.5 flex items-center gap-2">
                {reply.avatarUrl ? (
                  <img
                    src={reply.avatarUrl}
                    alt=""
                    className="h-5 w-5 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/20 text-[8px] font-bold text-accent">
                    {(reply.displayName ?? reply.userId).charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-medium text-text-primary">
                  {reply.displayName ?? reply.userId.slice(0, 12)}
                </span>
                <span className="text-[10px] text-text-muted">
                  {timeAgo(reply.createdAt)}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-text-secondary">
                {segments.map((seg, i) =>
                  seg.type === 'symbol' ? (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onSymbolClick?.(seg.value)}
                      className="font-semibold text-accent hover:underline"
                    >
                      ${seg.value}
                    </button>
                  ) : (
                    <span key={i}>{seg.value}</span>
                  ),
                )}
              </p>
            </div>
          )
        })}
        {replies.length === 0 && (
          <div className="py-8 text-center text-xs text-text-muted">
            No replies yet
          </div>
        )}
      </div>

      {/* Reply input */}
      <div className="border-t border-border p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && replyText.trim()) {
                handleSubmit()
              }
            }}
            placeholder="Reply in thread..."
            className="flex-1 rounded border border-border bg-navy-black px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!replyText.trim() || isSending}
            className={cn(
              'rounded px-3 py-1.5 text-xs font-medium transition-colors',
              replyText.trim() && !isSending
                ? 'bg-accent text-text-primary hover:bg-accent-hover'
                : 'cursor-not-allowed bg-accent/30 text-text-muted',
            )}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────

export function ChatRoom({
  roomId,
  roomName,
  roomType,
  symbol,
  messages,
  hasMore,
  onLoadMore,
  isLoading = false,
  onSendMessage,
  onDeleteMessage,
  onAddReaction,
  onRemoveReaction,
  onSymbolClick,
  isSending = false,
  canPost = true,
  gateReason,
  currentUserId,
  className,
}: ChatRoomProps) {
  const [newMessage, setNewMessage] = useState('')
  const [activeThread, setActiveThread] = useState<string | null>(null)
  const [reactionPicker, setReactionPicker] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const handleSend = useCallback(() => {
    if (newMessage.trim()) {
      onSendMessage(newMessage.trim())
      setNewMessage('')
    }
  }, [newMessage, onSendMessage])

  const handleReply = useCallback((messageId: string) => {
    setActiveThread(messageId)
  }, [])

  const handleSendReply = useCallback(
    (body: string) => {
      if (activeThread) {
        onSendMessage(body, activeThread)
      }
    },
    [activeThread, onSendMessage],
  )

  // Get the parent message and its replies for the thread panel
  const threadParent = activeThread
    ? messages.find((m) => m.id === activeThread)
    : null
  const threadReplies = activeThread
    ? messages.filter((m) => m.parentId === activeThread)
    : []

  // Top-level messages only (no parentId)
  const topLevelMessages = messages.filter((m) => !m.parentId)

  return (
    <div className={cn('flex h-full', className)}>
      {/* Main chat area */}
      <div className="flex flex-1 flex-col">
        {/* Room header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-border bg-navy-dark px-4 py-3">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'rounded px-1.5 py-0.5 text-[10px] font-medium uppercase',
                roomType === 'ticker'
                  ? 'bg-trading-green/15 text-trading-green'
                  : roomType === 'strategy'
                    ? 'bg-accent/15 text-accent'
                    : 'bg-text-muted/15 text-text-muted',
              )}
            >
              {roomType}
            </span>
            <h2 className="text-sm font-semibold text-text-primary">{roomName}</h2>
            {symbol && (
              <button
                type="button"
                onClick={() => onSymbolClick?.(symbol)}
                className="font-mono text-xs font-semibold text-accent hover:underline"
              >
                ${symbol}
              </button>
            )}
          </div>
        </div>

        {/* Messages list */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto"
          onClick={() => setReactionPicker(null)}
        >
          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center py-3">
              <button
                type="button"
                onClick={onLoadMore}
                disabled={isLoading}
                className="text-xs text-accent hover:text-accent-hover"
              >
                {isLoading ? 'Loading...' : 'Load older messages'}
              </button>
            </div>
          )}

          {topLevelMessages.length > 0 ? (
            topLevelMessages.map((msg, i) => (
              <SingleMessage
                key={msg.id}
                message={msg}
                isEven={i % 2 === 0}
                onReply={handleReply}
                onDelete={onDeleteMessage}
                onAddReaction={onAddReaction}
                onRemoveReaction={onRemoveReaction}
                onSymbolClick={onSymbolClick}
                currentUserId={currentUserId}
                showReactionPicker={reactionPicker}
                onToggleReactionPicker={setReactionPicker}
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-16">
              <span className="text-sm text-text-muted">
                {isLoading ? 'Loading messages...' : 'No messages yet'}
              </span>
              {!isLoading && (
                <span className="text-xs text-text-muted">
                  Be the first to start the conversation
                </span>
              )}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Message input */}
        <div className="shrink-0 border-t border-border bg-navy-dark p-3">
          {canPost ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newMessage.trim()) {
                    handleSend()
                  }
                }}
                placeholder={`Message #${roomName}...`}
                className="flex-1 rounded-md border border-border bg-navy-black px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!newMessage.trim() || isSending}
                className={cn(
                  'rounded-md px-4 py-2 text-sm font-medium transition-colors',
                  newMessage.trim() && !isSending
                    ? 'bg-accent text-text-primary hover:bg-accent-hover'
                    : 'cursor-not-allowed bg-accent/30 text-text-muted',
                )}
              >
                {isSending ? 'Sending...' : 'Send'}
              </button>
            </div>
          ) : (
            <div className="rounded-md border border-border/50 bg-navy-black px-4 py-3 text-center">
              <span className="text-xs text-text-muted">
                {gateReason ?? 'You do not have permission to post in this room'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Thread panel */}
      {activeThread && threadParent && (
        <ThreadPanel
          parentMessage={threadParent}
          replies={threadReplies}
          onClose={() => setActiveThread(null)}
          onSendReply={handleSendReply}
          isSending={isSending}
          onSymbolClick={onSymbolClick}
        />
      )}
    </div>
  )
}
