'use client'

import { useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ChatRoom,
  type ChatMessageData,
} from '@marlin/ui/trading/chat-room'

// ── Mock data — will be replaced with tRPC queries ───────────────────────────
// TODO: Replace with trpc.chat.getRoom.useQuery({ roomId })
// TODO: Replace with trpc.chat.getMessages.useInfiniteQuery({ roomId })

const MOCK_ROOMS: Record<string, { name: string; type: 'ticker' | 'strategy' | 'general'; symbol?: string }> = {
  'room-1': { name: 'General Trading', type: 'general' },
  'room-2': { name: 'AAPL Discussion', type: 'ticker', symbol: 'AAPL' },
  'room-3': { name: 'TSLA Discussion', type: 'ticker', symbol: 'TSLA' },
  'room-4': { name: 'Options Strategies', type: 'strategy' },
  'room-5': { name: 'Momentum Scalping', type: 'strategy' },
  'room-6': { name: 'NVDA Discussion', type: 'ticker', symbol: 'NVDA' },
}

function generateMockMessages(roomId: string): ChatMessageData[] {
  const now = Date.now()
  return [
    {
      id: 'msg-1',
      roomId,
      userId: 'user_abc',
      parentId: null,
      body: 'Good morning everyone! Markets looking interesting today.',
      isDeleted: false,
      createdAt: new Date(now - 3600000 * 2).toISOString(),
      updatedAt: new Date(now - 3600000 * 2).toISOString(),
      displayName: 'TraderMike',
      reactions: [
        { emoji: '👍', count: 3, hasReacted: false },
        { emoji: '🔥', count: 1, hasReacted: true },
      ],
      replyCount: 2,
    },
    {
      id: 'msg-2',
      roomId,
      userId: 'user_def',
      parentId: null,
      body: 'Watching $SPY closely, 520 is the level to break. If it holds we could see 530 by EOW.',
      isDeleted: false,
      createdAt: new Date(now - 3600000 * 1.5).toISOString(),
      updatedAt: new Date(now - 3600000 * 1.5).toISOString(),
      displayName: 'ChartNinja',
      reactions: [
        { emoji: '📈', count: 5, hasReacted: false },
      ],
      replyCount: 0,
    },
    {
      id: 'msg-3',
      roomId,
      userId: 'user_ghi',
      parentId: null,
      body: 'Just entered a long position on $NVDA at 870. Targeting 920 with a stop at 855.',
      isDeleted: false,
      createdAt: new Date(now - 3600000).toISOString(),
      updatedAt: new Date(now - 3600000).toISOString(),
      displayName: 'AIBull',
      reactions: [
        { emoji: '💎', count: 2, hasReacted: false },
        { emoji: '🚀', count: 4, hasReacted: true },
      ],
      replyCount: 1,
    },
    {
      id: 'msg-4',
      roomId,
      userId: 'user_jkl',
      parentId: null,
      body: 'FOMC minutes at 2pm EST today. Expect volatility. Be careful with size.',
      isDeleted: false,
      createdAt: new Date(now - 1800000).toISOString(),
      updatedAt: new Date(now - 1800000).toISOString(),
      displayName: 'RiskManager',
      reactions: [
        { emoji: '🤔', count: 3, hasReacted: false },
      ],
      replyCount: 0,
    },
    {
      id: 'msg-5',
      roomId,
      userId: 'user_mno',
      parentId: null,
      body: '$AAPL showing a hammer candle on the 15m. Could be a good entry for a scalp long.',
      isDeleted: false,
      createdAt: new Date(now - 600000).toISOString(),
      updatedAt: new Date(now - 600000).toISOString(),
      displayName: 'ScalpPro',
      reactions: [],
      replyCount: 0,
    },
    {
      id: 'msg-reply-1',
      roomId,
      userId: 'user_def',
      parentId: 'msg-1',
      body: 'Morning! Yes, lots of catalysts today.',
      isDeleted: false,
      createdAt: new Date(now - 3500000).toISOString(),
      updatedAt: new Date(now - 3500000).toISOString(),
      displayName: 'ChartNinja',
      reactions: [],
      replyCount: 0,
    },
    {
      id: 'msg-reply-2',
      roomId,
      userId: 'user_ghi',
      parentId: 'msg-1',
      body: 'Agreed, pre-market action looks promising.',
      isDeleted: false,
      createdAt: new Date(now - 3400000).toISOString(),
      updatedAt: new Date(now - 3400000).toISOString(),
      displayName: 'AIBull',
      reactions: [],
      replyCount: 0,
    },
  ]
}

// ── Page Component ───────────────────────────────────────────────────────────

export default function ChatRoomPage() {
  const params = useParams<{ roomId: string }>()
  const router = useRouter()
  const roomId = params.roomId

  const roomInfo = MOCK_ROOMS[roomId] ?? { name: 'Unknown Room', type: 'general' as const }
  const [messages, setMessages] = useState<ChatMessageData[]>(generateMockMessages(roomId))

  // TODO: Replace with trpc.chat.sendMessage.useMutation()
  const handleSendMessage = useCallback(
    (body: string, parentId?: string) => {
      const newMsg: ChatMessageData = {
        id: `msg-${Date.now()}`,
        roomId,
        userId: 'current_user',
        parentId: parentId ?? null,
        body,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        displayName: 'You',
        reactions: [],
        replyCount: 0,
      }
      setMessages((prev) => [...prev, newMsg])
    },
    [roomId],
  )

  // TODO: Replace with trpc.chat.deleteMessage.useMutation()
  const handleDeleteMessage = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, isDeleted: true } : msg,
      ),
    )
  }, [])

  // TODO: Replace with trpc.chat.addReaction.useMutation()
  const handleAddReaction = useCallback((messageId: string, emoji: string) => {
    console.log('Add reaction:', messageId, emoji)
  }, [])

  // TODO: Replace with trpc.chat.removeReaction.useMutation()
  const handleRemoveReaction = useCallback((messageId: string, emoji: string) => {
    console.log('Remove reaction:', messageId, emoji)
  }, [])

  const handleSymbolClick = useCallback(
    (symbol: string) => {
      router.push(`/chart/${symbol}`)
    },
    [router],
  )

  return (
    <div className="flex h-full flex-col overflow-hidden bg-navy-black">
      <ChatRoom
        roomId={roomId}
        roomName={roomInfo.name}
        roomType={roomInfo.type}
        symbol={roomInfo.symbol}
        messages={messages}
        hasMore={false}
        onLoadMore={() => {}}
        isLoading={false}
        onSendMessage={handleSendMessage}
        onDeleteMessage={handleDeleteMessage}
        onAddReaction={handleAddReaction}
        onRemoveReaction={handleRemoveReaction}
        onSymbolClick={handleSymbolClick}
        isSending={false}
        canPost={true}
        currentUserId="current_user"
      />
    </div>
  )
}
