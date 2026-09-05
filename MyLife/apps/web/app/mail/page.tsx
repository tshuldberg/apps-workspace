'use client';

import { Suspense, useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  fetchAccountsAction,
  fetchAllThreadsAction,
  fetchThreadsAction,
  fetchMessagesByThreadAction,
  markAsReadAction,
  starLatestInThreadAction,
  trashThreadAction,
} from './actions';
import { formatTime, generateInitials, getAvatarColor, groupThreadsByDate, MAIL_COLORS as C } from './ui';

const { accent: ACCENT, accentDim: ACCENT_DIM, accentBorder: ACCENT_BORDER, text: TEXT, textSec: TEXT_SEC, textTert: TEXT_TERT, surface: SURFACE, border: BORDER, glass: GLASS, glassStrong: GLASS_STRONG } = C;

interface Account { id: string; email: string; displayName: string }
interface Thread {
  id: string; accountId: string; subject: string; participantEmails: string[];
  messageCount: number; unreadCount: number; latestMessageAt: string; isMuted: boolean;
}
interface Message {
  id: string; accountId: string; subject: string; from: string; to: string[];
  body: string; isRead: boolean; isStarred: boolean; folder: string;
  receivedAt: string; createdAt: string;
}

function SkeletonRow() {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '12px 16px', borderBottom: `1px solid ${BORDER}` }}>
      <div style={{ width: 40, height: 40, borderRadius: 999, backgroundColor: SURFACE, opacity: 0.6 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ width: '40%', height: 14, borderRadius: 4, backgroundColor: SURFACE, opacity: 0.6 }} />
        <div style={{ width: '70%', height: 12, borderRadius: 4, backgroundColor: SURFACE, opacity: 0.6 }} />
        <div style={{ width: '90%', height: 12, borderRadius: 4, backgroundColor: SURFACE, opacity: 0.6 }} />
      </div>
    </div>
  );
}

function MailInboxPageContent() {
  const searchParams = useSearchParams();
  const folderParam = searchParams.get('folder');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [readingMessages, setReadingMessages] = useState<Message[]>([]);
  const [readingLoading, setReadingLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const accts = await fetchAccountsAction();
      setAccounts(accts as Account[]);
      if (accts.length === 0) {
        setThreads([]);
        return;
      }
      let t: Thread[];
      if (selectedAccountId) {
        t = await fetchThreadsAction(selectedAccountId, 50, 0) as Thread[];
      } else {
        t = await fetchAllThreadsAction(50) as Thread[];
      }
      setThreads(t);
    } catch {
      setError('Could not load inbox. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const loadThread = useCallback(async (threadId: string) => {
    try {
      setReadingLoading(true);
      setSelectedThreadId(threadId);
      const msgs = await fetchMessagesByThreadAction(threadId) as Message[];
      setReadingMessages(msgs);
      const firstUnread = msgs.find((m) => !m.isRead);
      if (firstUnread) {
        void markAsReadAction(firstUnread.id);
      }
    } catch {
      setReadingMessages([]);
    } finally {
      setReadingLoading(false);
    }
  }, []);

  const handleStar = useCallback(async (e: React.MouseEvent, threadId: string) => {
    e.stopPropagation();
    try {
      await starLatestInThreadAction(threadId);
      void loadData();
    } catch { /* silent */ }
  }, [loadData]);

  const handleTrash = useCallback(async (e: React.MouseEvent, threadId: string) => {
    e.stopPropagation();
    try {
      await trashThreadAction(threadId);
      if (selectedThreadId === threadId) {
        setSelectedThreadId(null);
        setReadingMessages([]);
      }
      void loadData();
    } catch { /* silent */ }
  }, [loadData, selectedThreadId]);

  const sections = useMemo(() => groupThreadsByDate(threads), [threads]);

  // No accounts state
  if (!loading && accounts.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: 32 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: TEXT }}>Welcome to MyMail</h2>
          <p style={{ margin: '12px 0 24px', color: TEXT_SEC, fontSize: 15 }}>
            Your email stays on your device. No cloud. No tracking. Add an account to get started.
          </p>
          <Link
            href="/mail/accounts/add"
            style={{
              display: 'inline-block', padding: '10px 20px', borderRadius: 8,
              backgroundColor: ACCENT, color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none',
            }}
          >
            + Add Account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Thread List Panel */}
      <div
        style={{
          width: 380, minWidth: 380, borderRight: `1px solid ${BORDER}`,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {/* Search + account filter */}
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}` }}>
          <Link
            href="/mail/search"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderRadius: 8,
              backgroundColor: SURFACE, border: `1px solid ${BORDER}`,
              color: TEXT_TERT, fontSize: 14, textDecoration: 'none',
            }}
          >
            Search mail...
          </Link>
          {accounts.length > 1 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setSelectedAccountId(null)}
                style={{
                  padding: '4px 10px', borderRadius: 999, border: `1px solid ${selectedAccountId === null ? ACCENT_BORDER : BORDER}`,
                  backgroundColor: selectedAccountId === null ? ACCENT_DIM : GLASS,
                  color: selectedAccountId === null ? ACCENT : TEXT_SEC, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                All
              </button>
              {accounts.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelectedAccountId(a.id)}
                  style={{
                    padding: '4px 10px', borderRadius: 999,
                    border: `1px solid ${selectedAccountId === a.id ? ACCENT_BORDER : BORDER}`,
                    backgroundColor: selectedAccountId === a.id ? ACCENT_DIM : GLASS,
                    color: selectedAccountId === a.id ? ACCENT : TEXT_SEC, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {a.email.split('@')[0]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Thread list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <>
              <SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow />
            </>
          ) : error ? (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <p style={{ color: '#FF453A', fontSize: 14 }}>{error}</p>
              <button
                type="button"
                onClick={() => void loadData()}
                style={{
                  marginTop: 12, padding: '8px 16px', borderRadius: 8,
                  backgroundColor: ACCENT, color: '#fff', fontWeight: 600, fontSize: 13,
                  border: 'none', cursor: 'pointer',
                }}
              >
                Retry
              </button>
            </div>
          ) : threads.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: TEXT }}>
                {folderParam ? `No messages in ${folderParam}` : 'Your inbox is clear'}
              </h3>
              <p style={{ margin: '8px 0 0', color: TEXT_SEC, fontSize: 14 }}>
                New messages will appear here
              </p>
            </div>
          ) : (
            sections.map((section) => (
              <div key={section.title}>
                <div style={{ padding: '8px 16px 4px', backgroundColor: 'rgba(10,10,15,0.8)' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: TEXT_TERT }}>
                    {section.title}
                  </span>
                </div>
                {section.data.map((thread) => {
                  const sender = thread.participantEmails[0] ?? 'Unknown';
                  const displayName = sender.split('@')[0];
                  const initials = generateInitials(displayName);
                  const avatarColor = getAvatarColor(sender);
                  const isUnread = thread.unreadCount > 0;
                  const isSelected = selectedThreadId === thread.id;

                  return (
                    <div
                      key={thread.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => void loadThread(thread.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter') void loadThread(thread.id); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 16px', cursor: 'pointer',
                        borderBottom: `1px solid ${BORDER}`,
                        borderLeft: isUnread ? `3px solid ${ACCENT}` : '3px solid transparent',
                        backgroundColor: isSelected ? GLASS_STRONG : 'transparent',
                      }}
                    >
                      <div
                        style={{
                          width: 36, height: 36, borderRadius: 999, flexShrink: 0,
                          backgroundColor: avatarColor, display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff',
                        }}
                      >
                        {initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <span style={{
                            fontSize: 14, fontWeight: isUnread ? 600 : 400,
                            color: isUnread ? TEXT : TEXT_SEC, overflow: 'hidden',
                            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {displayName}
                          </span>
                          <span style={{ fontSize: 11, color: TEXT_TERT, flexShrink: 0, marginLeft: 8 }}>
                            {formatTime(thread.latestMessageAt)}
                          </span>
                        </div>
                        <div style={{
                          fontSize: 13, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap', marginTop: 1,
                        }}>
                          {thread.subject || '(no subject)'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          <span style={{ fontSize: 12, color: TEXT_TERT }}>
                            {thread.messageCount} msg{thread.messageCount !== 1 ? 's' : ''}
                          </span>
                          {isUnread && (
                            <span style={{
                              width: 7, height: 7, borderRadius: 999, backgroundColor: ACCENT, flexShrink: 0,
                            }} />
                          )}
                        </div>
                      </div>
                      {/* Hover actions */}
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button
                          type="button"
                          title="Star"
                          onClick={(e) => void handleStar(e, thread.id)}
                          style={{
                            width: 28, height: 28, borderRadius: 6, border: 'none',
                            backgroundColor: 'transparent', color: TEXT_TERT, cursor: 'pointer',
                            fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          ⭐
                        </button>
                        <button
                          type="button"
                          title="Trash"
                          onClick={(e) => void handleTrash(e, thread.id)}
                          style={{
                            width: 28, height: 28, borderRadius: 6, border: 'none',
                            backgroundColor: 'transparent', color: TEXT_TERT, cursor: 'pointer',
                            fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Reading Pane */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!selectedThreadId ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', color: TEXT_TERT }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📧</div>
              <p style={{ fontSize: 15 }}>Select a conversation to read</p>
            </div>
          </div>
        ) : readingLoading ? (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[1, 2].map((i) => (
              <div key={i} style={{ padding: 20, borderRadius: 12, backgroundColor: SURFACE, border: `1px solid ${BORDER}` }}>
                <div style={{ width: '30%', height: 14, borderRadius: 4, backgroundColor: GLASS_STRONG, marginBottom: 8 }} />
                <div style={{ width: '100%', height: 12, borderRadius: 4, backgroundColor: GLASS, marginBottom: 4 }} />
                <div style={{ width: '80%', height: 12, borderRadius: 4, backgroundColor: GLASS }} />
              </div>
            ))}
          </div>
        ) : readingMessages.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: TEXT_TERT, fontSize: 14 }}>No messages in this thread</p>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div style={{
              padding: '16px 24px', borderBottom: `1px solid ${BORDER}`,
              backgroundColor: GLASS_STRONG,
            }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: TEXT }}>
                {readingMessages[0]?.subject || '(no subject)'}
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: TEXT_SEC }}>
                {readingMessages.length} message{readingMessages.length !== 1 ? 's' : ''}
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <Link
                  href={`/mail/compose?replyTo=${readingMessages[readingMessages.length - 1]?.id ?? ''}`}
                  style={{
                    padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600,
                    backgroundColor: ACCENT, color: '#fff', textDecoration: 'none',
                  }}
                >
                  Reply
                </Link>
                <Link
                  href={`/mail/compose?replyAll=${readingMessages[readingMessages.length - 1]?.id ?? ''}`}
                  style={{
                    padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600,
                    backgroundColor: GLASS, border: `1px solid ${BORDER}`, color: TEXT_SEC, textDecoration: 'none',
                  }}
                >
                  Reply All
                </Link>
                <Link
                  href={`/mail/compose?forward=${readingMessages[readingMessages.length - 1]?.id ?? ''}`}
                  style={{
                    padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600,
                    backgroundColor: GLASS, border: `1px solid ${BORDER}`, color: TEXT_SEC, textDecoration: 'none',
                  }}
                >
                  Forward
                </Link>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {readingMessages.map((msg) => {
                const senderName = msg.from.split('@')[0];
                const avatarColor = getAvatarColor(msg.from);
                return (
                  <div
                    key={msg.id}
                    style={{
                      padding: 20, borderRadius: 12,
                      backgroundColor: SURFACE, border: `1px solid ${BORDER}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <div
                        style={{
                          width: 32, height: 32, borderRadius: 999, backgroundColor: avatarColor,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
                        }}
                      >
                        {generateInitials(senderName)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{senderName}</span>
                        <span style={{ fontSize: 12, color: TEXT_TERT, marginLeft: 8 }}>{msg.from}</span>
                      </div>
                      <span style={{ fontSize: 12, color: TEXT_TERT }}>{formatTime(msg.receivedAt)}</span>
                    </div>
                    <div style={{ fontSize: 14, lineHeight: 1.7, color: TEXT_SEC, whiteSpace: 'pre-wrap' }}>
                      {msg.body}
                    </div>
                    {msg.isStarred && (
                      <div style={{ marginTop: 8 }}>
                        <span style={{ fontSize: 12, color: '#F59E0B' }}>⭐ Starred</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function MailInboxPage() {
  return (
    <Suspense fallback={null}>
      <MailInboxPageContent />
    </Suspense>
  );
}
