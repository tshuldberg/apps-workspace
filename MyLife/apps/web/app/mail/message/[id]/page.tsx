'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { fetchMessageAction, toggleStarAction, moveToFolderAction, fetchAttachmentsByMessageAction } from '../../actions';
import { formatFullDate, generateInitials, getAvatarColor, formatFileSize, MAIL_COLORS as C } from '../../ui';

const { accent: ACCENT, text: TEXT, textSec: TEXT_SEC, textTert: TEXT_TERT, surface: SURFACE, border: BORDER, glass: GLASS, glassStrong: GLASS_STRONG } = C;

interface Message {
  id: string; subject: string; from: string; to: string[];
  body: string; isRead: boolean; isStarred: boolean; folder: string;
  receivedAt: string; accountId: string;
}
interface Attachment { id: string; filename: string; mimeType: string; sizeBytes: number }

export default function MessageDetailPage() {
  const params = useParams();
  const messageId = params.id as string;
  const [message, setMessage] = useState<Message | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMessage = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const msg = await fetchMessageAction(messageId);
      setMessage(msg as Message | null);
      if (msg) {
        const atts = await fetchAttachmentsByMessageAction(messageId);
        setAttachments(atts as Attachment[]);
      }
    } catch {
      setError('Could not load message. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [messageId]);

  useEffect(() => { void loadMessage(); }, [loadMessage]);

  const handleStar = useCallback(async () => {
    if (!message) return;
    try {
      const updated = await toggleStarAction(message.id);
      if (updated) setMessage(updated as Message);
    } catch { /* silent */ }
  }, [message]);

  const handleTrash = useCallback(async () => {
    if (!message) return;
    try {
      await moveToFolderAction(message.id, 'Trash');
      setMessage((prev) => prev ? { ...prev, folder: 'Trash' } : null);
    } catch { /* silent */ }
  }, [message]);

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ width: '30%', height: 20, borderRadius: 4, backgroundColor: SURFACE, marginBottom: 16, opacity: 0.6 }} />
        <div style={{ padding: 24, borderRadius: 12, backgroundColor: SURFACE, border: `1px solid ${BORDER}` }}>
          <div style={{ width: '50%', height: 14, borderRadius: 4, backgroundColor: GLASS_STRONG, marginBottom: 12 }} />
          <div style={{ width: '100%', height: 12, borderRadius: 4, backgroundColor: GLASS, marginBottom: 4 }} />
          <div style={{ width: '90%', height: 12, borderRadius: 4, backgroundColor: GLASS }} />
        </div>
      </div>
    );
  }

  if (error || !message) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <p style={{ color: '#FF453A', fontSize: 14 }}>{error ?? 'Message not found'}</p>
        <button type="button" onClick={() => void loadMessage()} style={{
          marginTop: 12, padding: '8px 16px', borderRadius: 8, backgroundColor: ACCENT,
          color: '#fff', fontWeight: 600, fontSize: 13, border: 'none', cursor: 'pointer',
        }}>Retry</button>
        <div style={{ marginTop: 16 }}>
          <Link href="/mail" style={{ color: ACCENT, fontSize: 13, textDecoration: 'none' }}>Back to Inbox</Link>
        </div>
      </div>
    );
  }

  const senderName = message.from.split('@')[0];
  const avatarColor = getAvatarColor(message.from);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ padding: '16px 24px', borderBottom: `1px solid ${BORDER}`, backgroundColor: GLASS_STRONG }}>
        <Link href="/mail" style={{ color: ACCENT, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Back to Inbox</Link>
        <h2 style={{ margin: '8px 0 0', fontSize: 20, fontWeight: 700, color: TEXT }}>
          {message.subject || '(no subject)'}
        </h2>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <Link href={`/mail/compose?replyTo=${message.id}`} style={{
            padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600,
            backgroundColor: ACCENT, color: '#fff', textDecoration: 'none',
          }}>Reply</Link>
          <Link href={`/mail/compose?forward=${message.id}`} style={{
            padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600,
            backgroundColor: GLASS, border: `1px solid ${BORDER}`, color: TEXT_SEC, textDecoration: 'none',
          }}>Forward</Link>
          <button type="button" onClick={() => void handleStar()} style={{
            padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600,
            backgroundColor: GLASS, border: `1px solid ${BORDER}`, color: message.isStarred ? '#F59E0B' : TEXT_SEC, cursor: 'pointer',
          }}>{message.isStarred ? 'Unstar' : 'Star'}</button>
          <button type="button" onClick={() => void handleTrash()} style={{
            padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600,
            backgroundColor: GLASS, border: `1px solid ${BORDER}`, color: '#FF453A', cursor: 'pointer',
          }}>Trash</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
        <div style={{ padding: 24, borderRadius: 12, backgroundColor: SURFACE, border: `1px solid ${BORDER}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 999, backgroundColor: avatarColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0,
            }}>
              {generateInitials(senderName)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: TEXT }}>{senderName}</div>
              <div style={{ fontSize: 13, color: TEXT_TERT }}>{message.from}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, color: TEXT_TERT }}>{formatFullDate(message.receivedAt)}</div>
              <span style={{
                display: 'inline-block', marginTop: 2, padding: '1px 6px', borderRadius: 4,
                backgroundColor: GLASS, border: `1px solid ${BORDER}`, fontSize: 11, color: TEXT_TERT,
              }}>{message.folder}</span>
            </div>
          </div>

          {message.to.length > 0 && (
            <p style={{ fontSize: 13, color: TEXT_TERT, marginBottom: 16 }}>To: {message.to.join(', ')}</p>
          )}

          <div style={{ fontSize: 15, lineHeight: 1.7, color: TEXT, whiteSpace: 'pre-wrap' }}>
            {message.body}
          </div>

          {attachments.length > 0 && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${BORDER}` }}>
              <p style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: TEXT_TERT, marginBottom: 8 }}>
                Attachments ({attachments.length})
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {attachments.map((att) => (
                  <div key={att.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 12px', borderRadius: 8, backgroundColor: GLASS,
                    border: `1px solid ${BORDER}`, fontSize: 13, color: TEXT_SEC,
                  }}>
                    <span>📎</span>
                    <span>{att.filename}</span>
                    <span style={{ fontSize: 11, color: TEXT_TERT }}>{formatFileSize(att.sizeBytes)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
