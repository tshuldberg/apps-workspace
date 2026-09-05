'use client';

import { startTransition, useEffect, useMemo, useState } from 'react';
import { useEffectEvent } from '@/lib/react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  fetchConversationById,
  fetchMessages,
  sendMessageAction,
} from '../../actions';
import {
  Avatar,
  EmptyState,
  GlassCard,
  MaterialSymbol,
  SectionIntro,
  SurfaceCard,
} from '../../components';
import {
  TOKENS,
  chipStyle,
  formatRelativeTime,
  gradientButtonStyle,
  inputStyle,
} from '../../ui';

interface ConversationRow {
  id: string;
  title: string | null;
  isGroup: boolean | number;
}

interface MessageRow {
  id: string;
  senderId: string;
  body: string;
  mediaUrl: string | null;
  createdAt: string;
  isEdited: boolean | number;
}

export default function ConversationPage() {
  const params = useParams<{ id: string }>();
  const [conversation, setConversation] = useState<ConversationRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConversation = useEffectEvent(async () => {
    try {
      const [conversationResult, messageResult] = await Promise.all([
        fetchConversationById(params.id),
        fetchMessages(params.id, { limit: 120 }),
      ]);
      startTransition(() => {
        setConversation((conversationResult as ConversationRow) ?? null);
        setMessages((messageResult as MessageRow[]) ?? []);
      });
    } catch {
      setError('Could not load this conversation.');
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    void loadConversation();
  }, [loadConversation]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadConversation();
    }, 12000);
    return () => window.clearInterval(interval);
  }, [loadConversation]);

  const grouped = useMemo(() => {
    return [...messages].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
  }, [messages]);

  async function handleSend() {
    if (!draft.trim()) return;
    setSending(true);
    try {
      const created = await sendMessageAction({
        conversationId: params.id,
        body: draft.trim(),
      });
      setMessages((current) => [...current, created as MessageRow]);
      setDraft('');
    } catch {
      setError('Message failed to send.');
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return <GlassCard style={{ minHeight: 420, animation: 'pulse 1.5s ease-in-out infinite' }} />;
  }

  if (error || !conversation) {
    return (
      <EmptyState
        icon="chat"
        title="Conversation unavailable"
        description={error ?? 'This room could not be opened.'}
        actionHref="/forums/messages"
        actionLabel="Back to inbox"
      />
    );
  }

  return (
    <div className="forums-page-stack">
      <SectionIntro
        eyebrow="Conversation"
        title={conversation.title ?? 'Direct message'}
        description={conversation.isGroup ? 'Encrypted group room with realtime polling.' : 'Encrypted direct message room with composer and voice-ready message bubbles.'}
        actions={
          <Link href="/forums/messages" style={backLinkStyle}>
            Back to inbox
          </Link>
        }
      />

      <SurfaceCard style={{ display: 'grid', gap: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <Avatar label={conversation.title ?? 'Conversation'} size={58} />
            <div style={{ display: 'grid', gap: 4 }}>
              <strong style={{ fontSize: 22 }}>{conversation.title ?? 'Conversation'}</strong>
              <span style={{ color: TOKENS.textTertiary, fontSize: 12 }}>
                {conversation.isGroup ? 'Group channel' : '1:1 encrypted room'}
              </span>
            </div>
          </div>
          <div className="forums-chip-row">
            <span style={chipStyle(true, 'trust')}>Realtime active</span>
            <span style={chipStyle(false, 'neutral')}>Voice-ready</span>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 12, minHeight: 360 }}>
          {grouped.length === 0 ? (
            <p style={{ margin: 0, color: TOKENS.textSecondary, lineHeight: 1.65 }}>
              No messages yet. Open with context and set the tone for the room.
            </p>
          ) : (
            grouped.map((message) => {
              const mine = message.senderId === 'local-user';
              return (
                <div key={message.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                  <div
                    style={{
                      maxWidth: '78%',
                      padding: '12px 14px',
                      borderRadius: 20,
                      background: mine ? `linear-gradient(135deg, ${TOKENS.primaryLight}, ${TOKENS.primary})` : 'rgba(255,255,255,0.05)',
                      color: mine ? '#2E1600' : TOKENS.text,
                    }}
                  >
                    <p style={{ margin: 0, lineHeight: 1.55 }}>{message.body}</p>
                    {message.mediaUrl ? (
                      <audio controls src={message.mediaUrl} style={{ width: '100%', marginTop: 10 }} />
                    ) : null}
                    <span style={{ display: 'block', marginTop: 6, color: mine ? 'rgba(46,22,0,0.65)' : TOKENS.textTertiary, fontSize: 11 }}>
                      {formatRelativeTime(message.createdAt)}{message.isEdited ? ' · edited' : ''}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <GlassCard>
          <div style={{ display: 'grid', gap: 14 }}>
            <div className="forums-chip-row">
              <button type="button" onClick={() => setDraft((current) => `${current}${current ? '\n' : ''}> voice memo placeholder`)} style={chipStyle(false, 'neutral')}>
                <MaterialSymbol name="mic" size={16} color={TOKENS.primaryLight} />
                Voice note
              </button>
              <button type="button" onClick={() => setDraft((current) => `${current}${current ? '\n' : ''}• shared context`)} style={chipStyle(false, 'neutral')}>
                <MaterialSymbol name="attach_file" size={16} color={TOKENS.primaryLight} />
                Attach context
              </button>
            </div>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Type a message..."
              style={inputStyle}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  void handleSend();
                }
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ color: TOKENS.textTertiary, fontSize: 12 }}>Cmd/Ctrl+Enter sends</span>
              <button type="button" onClick={() => void handleSend()} disabled={sending || !draft.trim()} style={submitButtonStyle(sending || !draft.trim())}>
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </GlassCard>
      </SurfaceCard>
    </div>
  );
}

const backLinkStyle = {
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

function submitButtonStyle(disabled: boolean) {
  return {
    ...gradientButtonStyle,
    opacity: disabled ? 0.48 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
  } as const;
}
