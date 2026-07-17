'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChatRoomList, type ChatRoomListItem } from '@marlin/ui/trading/chat-room-list'
import { TrpcClientError, trpcQuery } from '../../../lib/trpc-fetch.js'

interface ApiRoomListItem {
  id: string
  name: string
  type: 'ticker' | 'strategy' | 'general'
  symbol: string | null
  description: string | null
  memberCount: number
  lastMessage?: {
    body: string
    authorName: string | null
    createdAt: string
  } | null
}

function toUiRoom(item: ApiRoomListItem): ChatRoomListItem {
  return {
    id: item.id,
    name: item.name,
    type: item.type,
    symbol: item.symbol,
    description: item.description,
    memberCount: item.memberCount,
    lastMessage: item.lastMessage
      ? {
          body: item.lastMessage.body,
          authorName: item.lastMessage.authorName ?? 'Unknown',
          createdAt: item.lastMessage.createdAt,
        }
      : null,
  }
}

export default function ChatListPage() {
  const router = useRouter()
  const [rooms, setRooms] = useState<ChatRoomListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadRooms = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await trpcQuery<ApiRoomListItem[]>('chat.listRooms')
      setRooms(data.map(toUiRoom))
    } catch (err) {
      const message =
        err instanceof TrpcClientError ? err.message : err instanceof Error ? err.message : String(err)
      setError(message)
      setRooms([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRooms()
  }, [loadRooms])

  const handleRoomClick = useCallback(
    (roomId: string) => {
      router.push(`/chat/${roomId}`)
    },
    [router],
  )

  return (
    <div className="flex h-full flex-col overflow-hidden bg-navy-black">
      <div className="shrink-0 border-b border-border bg-navy-dark px-6 py-4">
        <h1 className="text-lg font-semibold text-text-primary">Discussion Rooms</h1>
        <p className="text-xs text-text-muted">
          {rooms.length} active {rooms.length === 1 ? 'room' : 'rooms'}
        </p>
      </div>

      {error && (
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-trading-red/5 px-6 py-2">
          <span className="text-xs text-trading-red">Failed to load rooms: {error}</span>
          <button
            type="button"
            onClick={loadRooms}
            className="rounded bg-accent px-2 py-1 text-[10px] text-text-primary transition-colors hover:bg-accent/80"
          >
            Retry
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl">
          <ChatRoomList rooms={rooms} onRoomClick={handleRoomClick} isLoading={loading} />
        </div>
      </div>
    </div>
  )
}
