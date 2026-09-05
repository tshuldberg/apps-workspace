'use client';

import { useMemo, useState } from 'react';
import {
  TOKENS,
  chipStyle,
  eyebrowStyle,
  ghostButtonStyle,
  gradientButtonStyle,
  inputStyle,
  panelStyle,
  subtitleStyle,
  textareaStyle,
  titleStyle,
} from '../ui';

interface ThreadItem {
  id: string;
  title: string;
  body: string;
  voteScore: number;
  replyCount: number;
  createdAt: string;
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function CycleCommunityPage() {
  const [sort, setSort] = useState<'new' | 'top'>('new');
  const [selectedThread, setSelectedThread] = useState<ThreadItem | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [threads, setThreads] = useState<ThreadItem[]>([]);

  const sortedThreads = useMemo(
    () =>
      sort === 'top'
        ? [...threads].sort((left, right) => right.voteScore - left.voteScore)
        : threads,
    [sort, threads],
  );

  function handleCreate() {
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (trimmedTitle.length < 3 || !trimmedBody) return;
    const createdAt = new Date().toISOString();
    setThreads((current) => [
      {
        id: `local-${Date.now()}`,
        title: trimmedTitle,
        body: trimmedBody,
        voteScore: 0,
        replyCount: 0,
        createdAt,
      },
      ...current,
    ]);
    setTitle('');
    setBody('');
    setShowCreate(false);
  }

  if (selectedThread) {
    return (
      <div style={{ maxWidth: 880, margin: '0 auto', display: 'grid', gap: 18 }}>
        <button type="button" onClick={() => setSelectedThread(null)} style={{ ...ghostButtonStyle, justifySelf: 'flex-start' }}>
          Back to threads
        </button>

        <section
          style={{
            ...panelStyle('mid'),
            padding: 26,
            background:
              'radial-gradient(circle at top left, rgba(244,114,182,0.12), transparent 34%), linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
          }}
        >
          <p style={eyebrowStyle}>Thread</p>
          <h1 style={{ ...titleStyle, fontSize: 34, marginTop: 12 }}>{selectedThread.title}</h1>
          <p style={{ ...subtitleStyle, marginTop: 12 }}>
            {formatRelativeTime(selectedThread.createdAt)} • {selectedThread.voteScore} votes • {selectedThread.replyCount} replies
          </p>
          <p style={{ ...subtitleStyle, fontSize: 15, marginTop: 18, color: TOKENS.text }}>
            {selectedThread.body}
          </p>
        </section>

        <section style={{ ...panelStyle('low'), padding: 22 }}>
          <p style={eyebrowStyle}>Replies</p>
          <div style={{ ...panelStyle('base'), padding: 18, marginTop: 18 }}>
            <p style={subtitleStyle}>No replies yet. This refreshed web view keeps the conversation structure, but reply authoring still lands in the mobile flow first.</p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="cy-grid-3-2" style={{ maxWidth: 1040, margin: '0 auto' }}>
      <div className="cy-card-stack">
        <section
          style={{
            ...panelStyle('mid'),
            padding: 26,
            background:
              'radial-gradient(circle at top left, rgba(244,114,182,0.14), transparent 36%), linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
          }}
        >
          <p style={eyebrowStyle}>MyCycle Circle</p>
          <h1 style={{ ...titleStyle, marginTop: 12 }}>Community</h1>
          <p style={{ ...subtitleStyle, marginTop: 12, maxWidth: 520 }}>
            Discuss periods, fertility, recovery, and symptom tracking in a calmer space that matches the rest of the Obsidian Noir cycle experience.
          </p>
        </section>

        <section style={{ ...panelStyle('low'), padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setSort('new')} style={chipStyle(sort === 'new', TOKENS.accent)}>
                Recent
              </button>
              <button type="button" onClick={() => setSort('top')} style={chipStyle(sort === 'top', TOKENS.accent)}>
                Top
              </button>
            </div>
            <button type="button" onClick={() => setShowCreate((value) => !value)} style={gradientButtonStyle}>
              {showCreate ? 'Hide editor' : 'New Thread'}
            </button>
          </div>

          {showCreate ? (
            <div style={{ ...panelStyle('base'), padding: 18, marginTop: 18 }}>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Thread title"
                maxLength={300}
                style={inputStyle}
              />
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="What is on your mind?"
                rows={5}
                maxLength={40000}
                style={{ ...textareaStyle, marginTop: 10 }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                <button type="button" onClick={handleCreate} style={gradientButtonStyle}>
                  Post Thread
                </button>
              </div>
            </div>
          ) : null}

          <div style={{ display: 'grid', gap: 14, marginTop: 18 }}>
            {sortedThreads.length === 0 ? (
              <div style={{ ...panelStyle('base'), padding: '28px 22px', textAlign: 'center' }}>
                <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>Start a conversation</h2>
                <p style={{ ...subtitleStyle, marginTop: 12 }}>
                  Ask a question, share a pattern you noticed, or leave a note for the next person who needs it.
                </p>
              </div>
            ) : (
              sortedThreads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => setSelectedThread(thread)}
                  style={{ ...panelStyle('base'), padding: 18, textAlign: 'left', cursor: 'pointer' }}
                >
                  <h3 style={{ fontSize: 18, fontWeight: 800 }}>{thread.title}</h3>
                  <p style={{ ...subtitleStyle, marginTop: 10 }}>{thread.body}</p>
                  <p style={{ ...subtitleStyle, marginTop: 12, fontSize: 12 }}>
                    {thread.voteScore} votes • {thread.replyCount} replies • {formatRelativeTime(thread.createdAt)}
                  </p>
                </button>
              ))
            )}
          </div>
        </section>
      </div>

      <aside className="cy-card-stack">
        <section style={{ ...panelStyle('low'), padding: 22 }}>
          <p style={eyebrowStyle}>At a glance</p>
          <div className="cy-grid-2" style={{ marginTop: 18 }}>
            <div style={{ ...panelStyle('base'), padding: 18 }}>
              <p style={{ fontSize: 30, fontWeight: 800 }}>{threads.length}</p>
              <p style={{ ...subtitleStyle, marginTop: 8 }}>Threads in this session</p>
            </div>
            <div style={{ ...panelStyle('base'), padding: 18 }}>
              <p style={{ fontSize: 30, fontWeight: 800 }}>{sortedThreads.reduce((sum, thread) => sum + thread.replyCount, 0)}</p>
              <p style={{ ...subtitleStyle, marginTop: 8 }}>Replies visible</p>
            </div>
          </div>
        </section>

        <section style={{ ...panelStyle('low'), padding: 22 }}>
          <p style={eyebrowStyle}>Community Notes</p>
          <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
            {[
              'This refreshed web page keeps the current lightweight discussion model intact.',
              'Use descriptive titles so patterns and questions are easy to skim later.',
              'Avoid posting personally identifying medical details in shared threads.',
            ].map((note) => (
              <div key={note} style={{ ...panelStyle('base'), padding: 16 }}>
                <p style={subtitleStyle}>{note}</p>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
