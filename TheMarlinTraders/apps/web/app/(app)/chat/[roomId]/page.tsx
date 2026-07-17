'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChatRoom, type ChatMessageData } from '@marlin/ui/trading/chat-room'
import { TrpcClientError, trpcMutation, trpcQuery } from '../../../../lib/trpc-fetch.js'

interface ApiRoom {
  id: string
  name: string
  type: 'ticker' | 'strategy' | 'general'
  symbol: string | null
}

interface ApiMessage {
  id: string
  roomId: string
  userId: string
  parentId: string | null
  body: string
  isDeleted: boolean
  createdAt: string
  updatedAt: string
  displayName?: string | null
  avatarUrl?: string | null
}

interface ApiRoomPayload {
  room: ApiRoom
  messages: ApiMessage[]
}

interface ApiMessagePage {
  items: ApiMessage[]
  nextCursor?: string
}

function computeReplyCounts(messages: ApiMessage[]) {
  const counts = new Map<string, number>()
  for (const message of messages) {
    if (!message.parentId) continue
    counts.set(message.parentId, (counts.get(message.parentId) ?? 0) + 1)
  }
  return counts
}

function toUiMessages(messages: ApiMessage[]): ChatMessageData[] {
  const replyCounts = computeReplyCounts(messages)
  return messages.map((message) => ({
    id: message.id,
    roomId: message.roomId,
    userId: message.userId,
    parentId: message.parentId,
    body: message.body,
    isDeleted: message.isDeleted,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
    displayName: message.displayName ?? message.userId,
    avatarUrl: message.avatarUrl ?? null,
    reactions: [],
    replyCount: replyCounts.get(message.id) ?? 0,
  }))
}

export default function ChatRoomPage() {
  const params = useParams<{ roomId: string }>()
  const router = useRouter()
  const roomId = params.roomId

  const [roomInfo, setRoomInfo] = useState<ApiRoom | null>(null)
  const [messages, setMessages] = useState<ChatMessageData[]>([])
  const [loading, setLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined)
  const [canPost, setCanPost] = useState(true)
  const [gateReason, setGateReason] = useState<string | undefined>(undefined)
  const currentUserId = 'current_user'

  const loadRoom = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const payload = await trpcQuery<ApiRoomPayload>('chat.getRoom', { roomId })
      const mapped = toUiMessages(payload.messages)
      setRoomInfo(payload.room)
      setMessages(mapped)

      const sortedAsc = [...payload.messages].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )
      const oldest = sortedAsc[0]
      setNextCursor(oldest?.id)
      setCanPost(true)
      setGateReason(undefined)
    } catch (err) {
      const message =
        err instanceof TrpcClientError ? err.message : err instanceof Error ? err.message : String(err)
      setError(message)
      setRoomInfo(null)
      setMessages([])
      setCanPost(false)
      setGateReason('Room unavailable.')
    } finally {
      setLoading(false)
    }
  }, [roomId])

  useEffect(() => {
    loadRoom()
  }, [loadRoom])

  const mergeMessages = useCallback((incoming: ChatMessageData[]) => {
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id))
      const merged = [...incoming.filter((m) => !seen.has(m.id)), ...prev]
      merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      return merged
    })
  }, [])

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor) return

    try {
      const page = await trpcQuery<ApiMessagePage>('chat.getMessages', {
        roomId,
        cursor: nextCursor,
        limit: 50,
      })

      const pageAsc = [...page.items].reverse()
      mergeMessages(toUiMessages(pageAsc))
      setNextCursor(page.nextCursor)
    } catch (err) {
      const message =
        err instanceof TrpcClientError ? err.message : err instanceof Error ? err.message : String(err)
      setError(message)
    }
  }, [mergeMessages, nextCursor, roomId])

  const handleSendMessage = useCallback(
    async (body: string, parentId?: string) => {
      setIsSending(true)
      setError(null)
      try {
        const message = await trpcMutation<ApiMessage>('chat.sendMessage', {
          roomId,
          body,
          parentId,
        })

        setMessages((prev) => [
          ...prev,
          {
            id: message.id,
            roomId: message.roomId,
            userId: message.userId,
            parentId: message.parentId,
            body: message.body,
            isDeleted: message.isDeleted,
            createdAt: message.createdAt,
            updatedAt: message.updatedAt,
            displayName: message.displayName ?? 'You',
            avatarUrl: message.avatarUrl ?? null,
            reactions: [],
            replyCount: 0,
          },
        ])
      } catch (err) {
        const message =
          err instanceof TrpcClientError ? err.message : err instanceof Error ? err.message : String(err)
        setError(message)

        const code = err instanceof TrpcClientError ? err.code : undefined
        if (code === 'UNAUTHORIZED') {
          setCanPost(false)
          setGateReason('Sign in is required to post messages.')
        }
      } finally {
        setIsSending(false)
      }
    },
    [roomId],
  )

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    try {
      await trpcMutation('chat.deleteMessage', { messageId })
      setMessages((prev) => prev.map((msg) => (msg.id === messageId ? { ...msg, isDeleted: true } : msg)))
    } catch (err) {
      const message =
        err instanceof TrpcClientError ? err.message : err instanceof Error ? err.message : String(err)
      setError(message)
    }
  }, [])

  const handleAddReaction = useCallback(async (messageId: string, emoji: string) => {
    try {
      await trpcMutation('chat.addReaction', { messageId, emoji })
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== messageId) return msg
          const existing = msg.reactions?.find((r) => r.emoji === emoji)
          if (existing) {
            return {
              ...msg,
              reactions: msg.reactions?.map((r) =>
                r.emoji === emoji ? { ...r, count: r.count + 1, hasReacted: true } : r,
              ),
            }
          }
          return {
            ...msg,
            reactions: [...(msg.reactions ?? []), { emoji, count: 1, hasReacted: true }],
          }
        }),
      )
    } catch (err) {
      const message =
        err instanceof TrpcClientError ? err.message : err instanceof Error ? err.message : String(err)
      setError(message)
    }
  }, [])

  const handleRemoveReaction = useCallback(async (messageId: string, emoji: string) => {
    try {
      await trpcMutation('chat.removeReaction', { messageId, emoji })
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== messageId) return msg
          const next = (msg.reactions ?? [])
            .map((r) => (r.emoji === emoji ? { ...r, count: Math.max(0, r.count - 1), hasReacted: false } : r))
            .filter((r) => r.count > 0)
          return { ...msg, reactions: next }
        }),
      )
    } catch (err) {
      const message =
        err instanceof TrpcClientError ? err.message : err instanceof Error ? err.message : String(err)
      setError(message)
    }
  }, [])

  const handleSymbolClick = useCallback(
    (symbol: string) => {
      router.push(`/chart/${symbol}`)
    },
    [router],
  )

  const roomName = useMemo(() => roomInfo?.name ?? 'Chat Room', [roomInfo?.name])
  const roomType = useMemo(() => roomInfo?.type ?? 'general', [roomInfo?.type])
  const symbol = useMemo(() => roomInfo?.symbol ?? null, [roomInfo?.symbol])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-navy-black">
      {error && (
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-trading-red/5 px-4 py-2">
          <span className="text-xs text-trading-red">{error}</span>
          <button
            type="button"
            onClick={loadRoom}
            className="rounded bg-accent px-2 py-1 text-[10px] text-text-primary transition-colors hover:bg-accent/80"
          >
            Retry
          </button>
        </div>
      )}

      <ChatRoom
        roomId={roomId}
        roomName={roomName}
        roomType={roomType}
        symbol={symbol}
        messages={messages}
        hasMore={Boolean(nextCursor)}
        onLoadMore={handleLoadMore}
        isLoading={loading}
        onSendMessage={handleSendMessage}
        onDeleteMessage={handleDeleteMessage}
        onAddReaction={handleAddReaction}
        onRemoveReaction={handleRemoveReaction}
        onSymbolClick={handleSymbolClick}
        isSending={isSending}
        canPost={canPost}
        gateReason={gateReason}
        currentUserId={currentUserId}
      />
    </div>
  )
}
