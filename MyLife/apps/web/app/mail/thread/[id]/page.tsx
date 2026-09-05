'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { fetchThreadAction, fetchMessagesByThreadAction, markAsReadAction } from '../../actions';
import { formatFullDate, generateInitials, getAvatarColor, MAIL_COLORS as C } from '../../ui';

const { accent: ACCENT, text: TEXT, textSec: TEXT_SEC, textTert: TEXT_TERT, surface: SURFACE, border: BORDER, glass: GLASS, glassStrong: GLASS_STRONG } = C;

interface Thread {
  id: string; subject: string; participantEmails: string[];
  messageCount: number; unreadCount: number; latestMessageAt: string;
}
interface Message {
  id: string; subject: string; from: string; to: string[];
  body: string; isRead: boolean; isStarred: boolean; folder: string;
  receivedAt: string;
}

export default function ThreadDetailPage() {
  const params = useParams();
  const threadId = params.id as string;
  const [thread, setThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadThread = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [t, msgs] = await Promise.all([
        fetchThreadAction(threadId),
        fetchMessagesByThreadAction(threadId),
      ]);
      setThread(t as Thread | null);
      setMessages(msgs as Message[]);
      const firstUnread = (msgs as Message[]).find((m) => !m.isRead);
      if (firstUnread) void markAsReadAction(firstUnread.id);
    } catch {
      setError('Could not load conversation. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => { void loadThread(); }, [loadThread]);

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ width: '40%', height: 20, borderRadius: 4, backgroundColor: SURFACE, marginBottom: 16, opacity: 0.6 }} />
        {[1, 2].map((i) => (
          <div key={i} style={{ padding: 20, borderRadius: 12, backgroundColor: SURFACE, border: `1px solid ${BORDER}`, marginBottom: 16 }}>
            <div style={{ width: '30%', height: 14, borderRadius: 4, backgroundColor: GLASS_STRONG, marginBottom: 8 }} />
            <div style={{ width: '100%', height: 12, borderRadius: 4, backgroundColor: GLASS, marginBottom: 4 }} />
            <div style={{ width: '80%', height: 12, borderRadius: 4, backgroundColor: GLASS }} />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <p style={{ color: '#FF453A', fontSize: 14 }}>{error}</p>
        <button type="button" onClick={() => void loadThread()} style={{
          marginTop: 12, padding: '8px 16px', borderRadius: 8, backgroundColor: ACCENT,
          color: '#fff', fontWeight: 600, fontSize: 13, border: 'none', cursor: 'pointer',
        }}>
          Retry
        </button>
        <div style={{ marginTop: 16 }}>
          <Link href="/mail" style={{ color: ACCENT, fontSize: 13, textDecoration: 'none' }}>Back to Inbox</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ padding: '16px 24px', borderBottom: `1px solid ${BORDER}`, backgroundColor: GLASS_STRONG }}>
        <Link href="/mail" style={{ color: ACCENT, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Back to Inbox</Link>
        <h2 style={{ margin: '8px 0 0', fontSize: 18, fontWeight: 700, color: TEXT }}>
          {thread?.subject ?? '(no subject)'}
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: TEXT_SEC }}>
          {messages.length} message{messages.length !== 1 ? 's' : ''}
          {thread?.participantEmails && thread.participantEmails.length > 0 && (
            <> with {thread.participantEmails.slice(0, 3).join(', ')}{thread.participantEmails.length > 3 ? ` +${thread.participantEmails.length - 3}` : ''}</>
          )}
        </p>
        {messages.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <Link href={`/mail/compose?replyTo=${messages[messages.length - 1].id}`} style={{
              padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600,
              backgroundColor: ACCENT, color: '#fff', textDecoration: 'none',
            }}>Reply</Link>
            <Link href={`/mail/compose?replyAll=${messages[messages.length - 1].id}`} style={{
              padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600,
              backgroundColor: GLASS, border: `1px solid ${BORDER}`, color: TEXT_SEC, textDecoration: 'none',
            }}>Reply All</Link>
            <Link href={`/mail/compose?forward=${messages[messages.length - 1].id}`} style={{
              padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600,
              backgroundColor: GLASS, border: `1px solid ${BORDER}`, color: TEXT_SEC, textDecoration: 'none',
            }}>Forward</Link>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.map((msg) => {
          const senderName = msg.from.split('@')[0];
          const avatarColor = getAvatarColor(msg.from);
          return (
            <div key={msg.id} style={{ padding: 20, borderRadius: 12, backgroundColor: SURFACE, border: `1px solid ${BORDER}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 999, backgroundColor: avatarColor,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
                }}>
                  {generateInitials(senderName)}
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{senderName}</span>
                  <span style={{ fontSize: 12, color: TEXT_TERT, marginLeft: 8 }}>{msg.from}</span>
                </div>
                <span style={{ fontSize: 12, color: TEXT_TERT }}>{formatFullDate(msg.receivedAt)}</span>
              </div>
              {msg.to.length > 0 && (
                <p style={{ fontSize: 12, color: TEXT_TERT, marginBottom: 8 }}>
                  To: {msg.to.join(', ')}
                </p>
              )}
              <div style={{ fontSize: 14, lineHeight: 1.7, color: TEXT_SEC, whiteSpace: 'pre-wrap' }}>
                {msg.body}
              </div>
              {msg.isStarred && (
                <div style={{ marginTop: 8 }}>
                  <span style={{ fontSize: 12, color: '#F59E0B' }}>Starred</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
