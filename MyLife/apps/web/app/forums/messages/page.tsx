'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  fetchConversations,
  fetchMessages,
} from '../actions';
import {
  Avatar,
  EmptyState,
  GlassCard,
  SectionIntro,
  SurfaceCard,
} from '../components';
import {
  TOKENS,
  chipStyle,
  formatRelativeTime,
  gradientButtonStyle,
  truncate,
} from '../ui';

interface ConversationRow {
  id: string;
  title: string | null;
  isGroup: boolean | number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  createdAt: string;
}

interface MessageRow {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
  isEdited: boolean | number;
}

type FilterMode = 'all' | 'groups' | 'unread';

export default function MessagesPage() {
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await fetchConversations();
        const sorted = [...((result as ConversationRow[]) ?? [])].sort((left, right) => {
          const leftTime = left.lastMessageAt ?? left.createdAt;
          const rightTime = right.lastMessageAt ?? right.createdAt;
          return new Date(rightTime).getTime() - new Date(leftTime).getTime();
        });
        if (cancelled) return;
        setConversations(sorted);
        setSelectedId(sorted[0]?.id ?? null);
      } catch {
        if (!cancelled) setError('Could not load conversations.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await fetchMessages(selectedId, { limit: 40 });
        if (!cancelled) setMessages((result as MessageRow[]) ?? []);
      } catch {
        if (!cancelled) setMessages([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const filtered = useMemo(() => {
    if (filter === 'groups') return conversations.filter((conversation) => Boolean(conversation.isGroup));
    if (filter === 'unread') {
      return conversations.filter((conversation) => conversation.lastMessageAt && Date.now() - new Date(conversation.lastMessageAt).getTime() < 3 * 24 * 60 * 60 * 1000);
    }
    return conversations;
  }, [conversations, filter]);

  const selectedConversation = useMemo(
    () => filtered.find((conversation) => conversation.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );

  useEffect(() => {
    if (!selectedConversation) return;
    setSelectedId(selectedConversation.id);
  }, [selectedConversation]);

  if (loading) {
    return <GlassCard style={{ minHeight: 420, animation: 'pulse 1.5s ease-in-out infinite' }} />;
  }

  if (error) {
    return (
      <EmptyState
        icon="chat"
        title="Messages unavailable"
        description={error}
        actionHref="/forums"
        actionLabel="Return to feed"
      />
    );
  }

  if (conversations.length === 0) {
    return (
      <EmptyState
        icon="chat"
        title="No conversations yet"
        description="Once you start messaging other members, the split-view inbox appears here with unread badges and conversation previews."
        actionHref="/forums/messages/new"
        actionLabel="Start a conversation"
      />
    );
  }

  return (
    <div className="forums-page-stack">
      <SectionIntro
        eyebrow="Messages"
        title="Encrypted rooms for slower conversation"
        description="Desktop messaging keeps the list and the current conversation visible at once, with group and unread filters staying in the same shell language as the feed."
        actions={
          <Link href="/forums/messages/new" style={{ ...gradientButtonStyle, textDecoration: 'none' }}>
            New message
          </Link>
        }
      />

      <div className="forums-chip-row">
        {(['all', 'groups', 'unread'] as FilterMode[]).map((value) => (
          <button key={value} type="button" onClick={() => setFilter(value)} style={chipStyle(filter === value, value === 'unread' ? 'trust' : 'neutral')}>
            {value}
          </button>
        ))}
      </div>

      <div className="forums-detail-grid" style={{ gridTemplateColumns: '320px minmax(0, 1fr)' }}>
        <GlassCard className="forums-sidebar-card">
          <div style={{ display: 'grid', gap: 10 }}>
            {filtered.map((conversation) => {
              const active = conversation.id === selectedConversation?.id;
              const unread = conversation.lastMessageAt && Date.now() - new Date(conversation.lastMessageAt).getTime() < 3 * 24 * 60 * 60 * 1000;
              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => setSelectedId(conversation.id)}
                  style={{
                    border: 'none',
                    borderRadius: 24,
                    padding: 14,
                    background: active ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                    color: TOKENS.text,
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <Avatar label={conversation.title ?? 'Direct message'} size={44} />
                    <div style={{ flex: 1, display: 'grid', gap: 4, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                        <strong style={{ fontSize: 14 }}>{conversation.title ?? 'Direct message'}</strong>
                        {conversation.lastMessageAt ? (
                          <span style={{ color: TOKENS.textTertiary, fontSize: 11 }}>{formatRelativeTime(conversation.lastMessageAt)}</span>
                        ) : null}
                      </div>
                      <span style={{ color: TOKENS.textSecondary, fontSize: 13 }}>
                        {truncate(conversation.lastMessagePreview ?? 'No messages yet', 54)}
                      </span>
                    </div>
                    {unread ? <span style={unreadPillStyle}>New</span> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </GlassCard>

        {selectedConversation ? (
          <SurfaceCard style={{ display: 'grid', gap: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <Avatar label={selectedConversation.title ?? 'Direct message'} size={56} />
                <div style={{ display: 'grid', gap: 4 }}>
                  <strong style={{ fontSize: 20 }}>{selectedConversation.title ?? 'Direct message'}</strong>
                  <span style={{ color: TOKENS.textTertiary, fontSize: 12 }}>
                    {selectedConversation.isGroup ? 'Encrypted group' : 'Encrypted direct message'}
                  </span>
                </div>
              </div>
              <Link href={`/forums/messages/${selectedConversation.id}`} style={openLinkStyle}>
                Open room
              </Link>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              {messages.length === 0 ? (
                <p style={{ margin: 0, color: TOKENS.textSecondary, lineHeight: 1.65 }}>
                  No messages yet. Open the room to send the first note.
                </p>
              ) : (
                messages.slice(-6).map((message) => {
                  const mine = message.senderId === 'local-user';
                  return (
                    <div key={message.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                      <div
                        style={{
                          maxWidth: '78%',
                          padding: '12px 14px',
                          borderRadius: 18,
                          background: mine ? `linear-gradient(135deg, ${TOKENS.primaryLight}, ${TOKENS.primary})` : 'rgba(255,255,255,0.05)',
                          color: mine ? '#2E1600' : TOKENS.text,
                        }}
                      >
                        <p style={{ margin: 0, lineHeight: 1.55 }}>{message.body}</p>
                        <span style={{ display: 'block', marginTop: 6, color: mine ? 'rgba(46,22,0,0.65)' : TOKENS.textTertiary, fontSize: 11 }}>
                          {formatRelativeTime(message.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </SurfaceCard>
        ) : null}
      </div>
    </div>
  );
}

const unreadPillStyle = {
  padding: '6px 10px',
  borderRadius: 999,
  background: 'rgba(124,77,255,0.18)',
  color: TOKENS.trustLight,
  fontSize: 11,
  fontWeight: 800,
} as const;

const openLinkStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 40,
  padding: '0 14px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.05)',
  color: TOKENS.textSecondary,
  textDecoration: 'none',
  fontSize: 13,
  fontWeight: 700,
} as const;
