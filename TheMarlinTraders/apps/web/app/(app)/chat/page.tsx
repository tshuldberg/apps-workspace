'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChatRoomList,
  type ChatRoomListItem,
} from '@marlin/ui/trading/chat-room-list'

// ── Mock data — will be replaced with tRPC query ─────────────────────────────
// TODO: Replace with trpc.chat.listRooms.useQuery()

const MOCK_ROOMS: ChatRoomListItem[] = [
  {
    id: 'room-1',
    name: 'General Trading',
    type: 'general',
    description: 'Open discussion about markets, strategies, and trading ideas. All experience levels welcome.',
    memberCount: 142,
    lastMessage: {
      body: 'Anyone watching the FOMC minutes today?',
      authorName: 'TraderMike',
      createdAt: new Date(Date.now() - 120000).toISOString(),
    },
  },
  {
    id: 'room-2',
    name: 'AAPL Discussion',
    type: 'ticker',
    symbol: 'AAPL',
    description: 'Apple Inc. real-time discussion, earnings plays, and technical analysis.',
    memberCount: 89,
    lastMessage: {
      body: 'Support holding at $185, looking for a bounce here',
      authorName: 'ChartNinja',
      createdAt: new Date(Date.now() - 300000).toISOString(),
    },
  },
  {
    id: 'room-3',
    name: 'TSLA Discussion',
    type: 'ticker',
    symbol: 'TSLA',
    description: 'Tesla Inc. discussion. Earnings, delivery numbers, and EV market trends.',
    memberCount: 203,
    lastMessage: {
      body: 'Delivery numbers next week, expecting a big move either direction',
      authorName: 'EVBull',
      createdAt: new Date(Date.now() - 600000).toISOString(),
    },
  },
  {
    id: 'room-4',
    name: 'Options Strategies',
    type: 'strategy',
    description: 'Discuss iron condors, spreads, straddles, and other options strategies.',
    memberCount: 67,
    lastMessage: {
      body: 'IV is elevated on SPY, selling premium here',
      authorName: 'ThetaGang',
      createdAt: new Date(Date.now() - 1800000).toISOString(),
    },
  },
  {
    id: 'room-5',
    name: 'Momentum Scalping',
    type: 'strategy',
    description: 'High-frequency scalping strategies. Discuss entries, exits, and risk management.',
    memberCount: 45,
    lastMessage: {
      body: 'NVDA breaking VWAP with volume, going long',
      authorName: 'ScalpPro',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
  },
  {
    id: 'room-6',
    name: 'NVDA Discussion',
    type: 'ticker',
    symbol: 'NVDA',
    description: 'NVIDIA Corp discussion. AI chip demand, earnings, and technical setups.',
    memberCount: 156,
    lastMessage: {
      body: 'Cup and handle forming on the daily, target $1100',
      authorName: 'AIBull',
      createdAt: new Date(Date.now() - 7200000).toISOString(),
    },
  },
]

// ── Page Component ───────────────────────────────────────────────────────────

export default function ChatListPage() {
  const router = useRouter()
  const [rooms] = useState<ChatRoomListItem[]>(MOCK_ROOMS)

  const handleRoomClick = useCallback(
    (roomId: string) => {
      router.push(`/chat/${roomId}`)
    },
    [router],
  )

  return (
    <div className="flex h-full flex-col overflow-hidden bg-navy-black">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-navy-dark px-6 py-4">
        <h1 className="text-lg font-semibold text-text-primary">Discussion Rooms</h1>
        <p className="text-xs text-text-muted">
          {rooms.length} active {rooms.length === 1 ? 'room' : 'rooms'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl">
          <ChatRoomList
            rooms={rooms}
            onRoomClick={handleRoomClick}
            isLoading={false}
          />
        </div>
      </div>
    </div>
  )
}
