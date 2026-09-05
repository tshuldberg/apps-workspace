'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  createThreadAction,
  fetchCommunityTags,
  fetchJoinedCommunities,
} from '../../actions';
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

interface CommunityRow {
  id: string;
  displayName: string;
}

interface TagRow {
  id: string;
  name: string;
  color: string | null;
}

const DRAFT_KEY = 'forums:web:create-thread-draft';

function CreateThreadPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCommunity = searchParams.get('community') ?? '';
  const [communities, setCommunities] = useState<CommunityRow[]>([]);
  const [tags, setTags] = useState<TagRow[]>([]);
  const [pickerQuery, setPickerQuery] = useState('');
  const [communityId, setCommunityId] = useState(preselectedCommunity);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [draftState, setDraftState] = useState<'idle' | 'saved'>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await fetchJoinedCommunities();
        if (cancelled) return;
        setCommunities((result as CommunityRow[]) ?? []);
      } catch {
        // Picker stays empty and the create flow still works once communities exist.
      }
    })();
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as {
        communityId?: string;
        title?: string;
        body?: string;
        selectedTags?: string[];
      };
      setCommunityId((current) => current || draft.communityId || '');
      setTitle(draft.title ?? '');
      setBody(draft.body ?? '');
      setSelectedTags(draft.selectedTags ?? []);
    } catch {
      // Ignore malformed drafts.
    }
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!communityId) {
      setTags([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const result = await fetchCommunityTags(communityId);
        if (!cancelled) setTags((result as TagRow[]) ?? []);
      } catch {
        if (!cancelled) setTags([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [communityId]);

  const visibleCommunities = useMemo(() => {
    if (!pickerQuery.trim()) return communities;
    const needle = pickerQuery.trim().toLowerCase();
    return communities.filter((community) => community.displayName.toLowerCase().includes(needle));
  }, [communities, pickerQuery]);

  function saveDraft() {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ communityId, title, body, selectedTags }),
    );
    setDraftState('saved');
    window.setTimeout(() => setDraftState('idle'), 1500);
  }

  async function handleSubmit() {
    if (!communityId || !title.trim() || !body.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const thread = await createThreadAction({
        communityId,
        title: title.trim(),
        body: body.trim(),
      });
      window.localStorage.removeItem(DRAFT_KEY);
      router.push(`/forums/thread/${thread.id}`);
    } catch {
      setError('The thread could not be created.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="forums-page-stack">
      <GlassCard style={{ position: 'sticky', top: 96, zIndex: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <SectionIntro
            eyebrow="Compose"
            title="Write a thread for the archive"
            description="Draft in markdown, preview beside the editor, and keep one eye on community rules while you write."
          />
          <div className="forums-chip-row">
            <Link href="/forums" style={ghostLinkStyle}>Cancel</Link>
            <button type="button" onClick={saveDraft} style={ghostButtonStyle}>
              Save Draft
            </button>
            <button type="button" onClick={() => void handleSubmit()} disabled={submitting || !communityId || !title.trim() || !body.trim()} style={submitButtonStyle(submitting || !communityId || !title.trim() || !body.trim())}>
              {submitting ? 'Posting…' : 'Post Thread'}
            </button>
          </div>
        </div>
      </GlassCard>

      <div className="forums-detail-grid" style={{ gridTemplateColumns: 'minmax(0, 1.2fr) minmax(320px, 0.8fr)' }}>
        <div style={{ display: 'grid', gap: 18 }}>
          <SurfaceCard style={{ display: 'grid', gap: 18 }}>
            <div style={{ display: 'grid', gap: 10 }}>
              <span style={labelStyle}>Title</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="The title that earns a click and a considered reply"
                style={{ ...inputStyle, fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em' }}
              />
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              <span style={labelStyle}>Community picker</span>
              <input
                value={pickerQuery}
                onChange={(event) => setPickerQuery(event.target.value)}
                placeholder="Search joined communities..."
                style={inputStyle}
              />
              <div className="forums-chip-row">
                {visibleCommunities.length === 0 ? (
                  <span style={{ color: TOKENS.textSecondary, fontSize: 13 }}>
                    Join a community first, or clear the search to see the current list.
                  </span>
                ) : (
                  visibleCommunities.map((community) => (
                    <button
                      key={community.id}
                      type="button"
                      onClick={() => setCommunityId(community.id)}
                      style={chipStyle(communityId === community.id)}
                    >
                      {community.displayName}
                    </button>
                  ))
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              <span style={labelStyle}>Tag picker</span>
              <div className="forums-chip-row">
                {tags.length === 0 ? (
                  <span style={{ color: TOKENS.textSecondary, fontSize: 13 }}>
                    Select a community to load tags. You can choose up to five.
                  </span>
                ) : (
                  tags.map((tag) => {
                    const active = selectedTags.includes(tag.name);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => {
                          setSelectedTags((current) => {
                            if (active) return current.filter((value) => value !== tag.name);
                            if (current.length >= 5) return current;
                            return [...current, tag.name];
                          });
                        }}
                        style={chipStyle(active, active ? 'trust' : 'neutral')}
                      >
                        {tag.name}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={labelStyle}>Markdown editor</span>
                <div className="forums-chip-row">
                  {['# Heading', '## Section', '- Bullet', '> Quote', '`code`'].map((snippet) => (
                    <button
                      key={snippet}
                      type="button"
                      onClick={() => setBody((current) => `${current}${current ? '\n' : ''}${snippet}`)}
                      style={chipStyle(false, 'neutral')}
                    >
                      {snippet}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Open with the context, show the evidence, and leave space for other people to think with you."
                style={{ ...textareaStyle, minHeight: 360 }}
              />
            </div>
          </SurfaceCard>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <GlassCard className="forums-sidebar-card">
            <div style={{ display: 'grid', gap: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <span style={labelStyle}>Live preview</span>
                <span style={{ color: TOKENS.textTertiary, fontSize: 12 }}>
                  {draftState === 'saved' ? 'Draft saved' : 'Unsaved changes'}
                </span>
              </div>

              <div style={{ display: 'grid', gap: 12 }}>
                <h2 style={{ margin: 0, fontSize: 28, lineHeight: 1.08, fontWeight: 800, letterSpacing: '-0.04em' }}>
                  {title || 'Your thread title appears here'}
                </h2>
                <div className="forums-chip-row">
                  {communityId ? (
                    <span style={selectedChipStyle}>
                      {communities.find((community) => community.id === communityId)?.displayName ?? 'Selected community'}
                    </span>
                  ) : null}
                  {selectedTags.map((tag) => (
                    <span key={tag} style={selectedChipStyle}>{tag}</span>
                  ))}
                </div>
                <div className="forums-rich-markdown" style={{ color: TOKENS.textSecondary, lineHeight: 1.75 }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {body || 'Preview your markdown here as you write.'}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard>
            <div style={{ display: 'grid', gap: 12 }}>
              <span style={labelStyle}>Rules reminder</span>
              <ul style={{ margin: 0, paddingLeft: 20, color: TOKENS.textSecondary, lineHeight: 1.6 }}>
                <li>Lead with context, not just the conclusion.</li>
                <li>Use markdown for structure if the argument needs sections.</li>
                <li>Keep trust purple for verification, not decorative emphasis.</li>
              </ul>
            </div>
          </GlassCard>

          {error ? (
            <GlassCard>
              <p style={{ margin: 0, color: TOKENS.downvote }}>{error}</p>
            </GlassCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const labelStyle = {
  color: TOKENS.textTertiary,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
} as const;

const ghostLinkStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 40,
  padding: '0 16px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.05)',
  color: TOKENS.textSecondary,
  textDecoration: 'none',
  fontSize: 13,
  fontWeight: 700,
} as const;

const ghostButtonStyle = {
  border: 'none',
  borderRadius: 999,
  minHeight: 40,
  padding: '0 16px',
  background: 'rgba(255,255,255,0.05)',
  color: TOKENS.textSecondary,
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
} as const;

const selectedChipStyle = {
  padding: '8px 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.05)',
  color: TOKENS.primaryLight,
  fontSize: 12,
  fontWeight: 700,
} as const;

function submitButtonStyle(disabled: boolean) {
  return {
    ...gradientButtonStyle,
    opacity: disabled ? 0.48 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
  } as const;
}

export default function CreateThreadPage() {
  return (
    <Suspense fallback={null}>
      <CreateThreadPageContent />
    </Suspense>
  );
}
