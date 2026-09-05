'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createConversationAction, sendMessageAction } from '../../actions';
import {
  GlassCard,
  MaterialSymbol,
  SectionIntro,
  SurfaceCard,
} from '../../components';
import {
  TOKENS,
  chipStyle,
  gradientButtonStyle,
  inputStyle,
  textareaStyle,
} from '../../ui';

export default function NewMessagePage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [isGroup, setIsGroup] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const conversation = await createConversationAction({
        participantIds: ['local-user'],
        title: title.trim() || undefined,
        isGroup,
      });
      await sendMessageAction({
        conversationId: conversation.id,
        body: message.trim(),
      });
      router.push(`/forums/messages/${conversation.id}`);
    } catch {
      setError('Failed to create conversation.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="forums-page-stack">
      <SectionIntro
        eyebrow="New Message"
        title="Open a new encrypted room"
        description="Compose the opening note here, then move into the split-view inbox once the conversation exists."
        actions={
          <Link href="/forums/messages" style={ghostLinkStyle}>
            Back to inbox
          </Link>
        }
      />

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 18 }}>
        <SurfaceCard style={{ display: 'grid', gap: 18 }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <span style={eyebrowStyle}>Room type</span>
            <div className="forums-chip-row">
              <button type="button" onClick={() => setIsGroup(false)} style={chipStyle(!isGroup, 'gold')}>
                Direct room
              </button>
              <button type="button" onClick={() => setIsGroup(true)} style={chipStyle(isGroup, 'trust')}>
                Group room
              </button>
            </div>
          </div>

          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>Conversation title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={isGroup ? 'Design critique room' : 'Optional room name'}
              style={inputStyle}
            />
          </label>

          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>Opening message</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={6}
              required
              placeholder="Write the first note..."
              style={textareaStyle}
            />
          </label>
        </SurfaceCard>

        <GlassCard style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'grid', gap: 4 }}>
            {error ? <span style={{ color: TOKENS.danger, fontSize: 13 }}>{error}</span> : null}
            <span style={{ color: TOKENS.textTertiary, fontSize: 12 }}>
              Voice attachments and participant selection remain staged for a later messaging pass.
            </span>
          </div>
          <button type="submit" disabled={submitting} style={submitButtonStyle(submitting)}>
            <MaterialSymbol name="send" size={16} color="#2E1600" />
            {submitting ? 'Sending...' : 'Start room'}
          </button>
        </GlassCard>
      </form>
    </div>
  );
}

const eyebrowStyle = {
  color: TOKENS.primary,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
} as const;

const fieldStyle = {
  display: 'grid',
  gap: 8,
} as const;

const fieldLabelStyle = {
  color: TOKENS.text,
  fontSize: 13,
  fontWeight: 700,
} as const;

const ghostLinkStyle = {
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
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    opacity: disabled ? 0.56 : 1,
    cursor: disabled ? 'wait' : 'pointer',
  } as const;
}
