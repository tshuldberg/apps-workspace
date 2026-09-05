'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createCommunityAction } from '../../actions';
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

type StepKey = 'identity' | 'description' | 'type' | 'trust' | 'cover' | 'rules';
type CommunityType = 'public' | 'restricted' | 'private';

const STEPS: Array<{ key: StepKey; title: string; description: string }> = [
  { key: 'identity', title: 'Identity', description: 'Name the room and set the URL slug.' },
  { key: 'description', title: 'Description', description: 'Explain what belongs here.' },
  { key: 'type', title: 'Type', description: 'Choose the access posture.' },
  { key: 'trust', title: 'Trust', description: 'Decide if the room is humans-only.' },
  { key: 'cover', title: 'Cover', description: 'Pick the atmosphere for the banner.' },
  { key: 'rules', title: 'Rules', description: 'Set the first moderation expectations.' },
] as const;

export default function CreateCommunityPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [communityType, setCommunityType] = useState<CommunityType>('public');
  const [humansOnly, setHumansOnly] = useState(true);
  const [coverMood, setCoverMood] = useState('Warm shelves');
  const [rulesText, setRulesText] = useState('Lead with context.\nNo link-only spam.\nLeave moderation notes when removing.');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const progress = ((step + 1) / STEPS.length) * 100;
  const active = STEPS[step];

  const canAdvance = useMemo(() => {
    if (active.key === 'identity') return displayName.trim().length > 0 && slug.trim().length > 2;
    if (active.key === 'description') return description.trim().length > 20;
    return true;
  }, [active.key, description, displayName, slug]);

  async function handleCreate() {
    setSubmitting(true);
    setError(null);
    try {
      const community = await createCommunityAction({
        name: slug.trim().toLowerCase().replace(/\s+/g, '-'),
        displayName: displayName.trim(),
        description: description.trim() || undefined,
        communityType,
        humansOnly,
      });
      router.push(`/forums/community/${community.id}`);
    } catch {
      setError('The community could not be created.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="forums-page-stack">
      <SectionIntro
        eyebrow="Create Community"
        title="Open a new room in the archive"
        description="This wizard mirrors the mobile flow, but tuned for desktop. Only the core community fields persist today; cover and rule scaffolding help you shape the launch before moderators take over."
      />

      <GlassCard>
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <strong>{active.title}</strong>
            <span style={{ color: TOKENS.textTertiary, fontSize: 12 }}>
              Step {step + 1} of {STEPS.length}
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: `linear-gradient(135deg, ${TOKENS.primaryLight}, ${TOKENS.primary})` }} />
          </div>
          <div className="forums-chip-row">
            {STEPS.map((item, index) => (
              <button key={item.key} type="button" onClick={() => setStep(index)} style={chipStyle(step === index, step === index ? 'gold' : 'neutral')}>
                {item.title}
              </button>
            ))}
          </div>
        </div>
      </GlassCard>

      <div style={{ maxWidth: 720, margin: '0 auto', width: '100%' }}>
        <SurfaceCard style={{ display: 'grid', gap: 20 }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <span style={labelStyle}>{active.title}</span>
            <h2 style={{ margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: '-0.04em' }}>{active.description}</h2>
          </div>

          {active.key === 'identity' ? (
            <>
              <div style={{ display: 'grid', gap: 8 }}>
                <span style={labelStyle}>Display name</span>
                <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="The Design Reading Room" style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                <span style={labelStyle}>URL slug</span>
                <input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="design-reading-room" style={inputStyle} />
              </div>
            </>
          ) : null}

          {active.key === 'description' ? (
            <div style={{ display: 'grid', gap: 8 }}>
              <span style={labelStyle}>What belongs here</span>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the tone, subject matter, and what kinds of threads should thrive here." style={textareaStyle} />
            </div>
          ) : null}

          {active.key === 'type' ? (
            <div className="forums-chip-row">
              {(['public', 'restricted', 'private'] as CommunityType[]).map((value) => (
                <button key={value} type="button" onClick={() => setCommunityType(value)} style={chipStyle(communityType === value, value === 'private' ? 'trust' : 'gold')}>
                  {value}
                </button>
              ))}
            </div>
          ) : null}

          {active.key === 'trust' ? (
            <div style={{ display: 'grid', gap: 16 }}>
              <button type="button" onClick={() => setHumansOnly((current) => !current)} style={chipStyle(humansOnly, 'trust')}>
                Humans only
              </button>
              <p style={{ margin: 0, color: TOKENS.textSecondary, lineHeight: 1.65 }}>
                When enabled, the room uses purple trust semantics more heavily and signals that verification matters before participation.
              </p>
            </div>
          ) : null}

          {active.key === 'cover' ? (
            <div style={{ display: 'grid', gap: 16 }}>
              <input value={coverMood} onChange={(event) => setCoverMood(event.target.value)} placeholder="Warm shelves" style={inputStyle} />
              <div
                style={{
                  height: 180,
                  borderRadius: 28,
                  background: `linear-gradient(135deg, rgba(14,14,19,0.9), rgba(201,137,77,0.4)), radial-gradient(circle at top right, rgba(255,255,255,0.12), transparent 24%)`,
                  display: 'grid',
                  placeItems: 'center',
                  color: TOKENS.primaryLight,
                  fontSize: 22,
                  fontWeight: 800,
                }}
              >
                {coverMood}
              </div>
            </div>
          ) : null}

          {active.key === 'rules' ? (
            <div style={{ display: 'grid', gap: 8 }}>
              <span style={labelStyle}>Launch rules</span>
              <textarea value={rulesText} onChange={(event) => setRulesText(event.target.value)} style={textareaStyle} />
              <div style={{ display: 'grid', gap: 8 }}>
                {rulesText.split('\n').filter(Boolean).map((rule, index) => (
                  <div key={`${rule}-${index}`} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: 12, borderRadius: 18, background: 'rgba(255,255,255,0.05)' }}>
                    <span style={{ color: TOKENS.primaryLight, fontSize: 12, fontWeight: 800 }}>{index + 1}</span>
                    <span style={{ color: TOKENS.textSecondary, lineHeight: 1.55 }}>{rule}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {error ? (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: TOKENS.downvote }}>
              <MaterialSymbol name="error" size={18} color={TOKENS.downvote} />
              <span>{error}</span>
            </div>
          ) : null}

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <Link href="/forums/communities" style={ghostLinkStyle}>Cancel</Link>
            <div className="forums-chip-row">
              <button type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} style={ghostButtonStyle} disabled={step === 0}>
                Back
              </button>
              {step < STEPS.length - 1 ? (
                <button type="button" onClick={() => setStep((current) => Math.min(STEPS.length - 1, current + 1))} style={nextButtonStyle(!canAdvance)} disabled={!canAdvance}>
                  Next
                </button>
              ) : (
                <button type="button" onClick={() => void handleCreate()} style={nextButtonStyle(submitting)} disabled={submitting}>
                  {submitting ? 'Creating…' : 'Create community'}
                </button>
              )}
            </div>
          </div>
        </SurfaceCard>
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
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 700,
} as const;

function nextButtonStyle(disabled: boolean) {
  return {
    ...gradientButtonStyle,
    opacity: disabled ? 0.48 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
  } as const;
}
