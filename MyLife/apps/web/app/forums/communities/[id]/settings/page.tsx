'use client';

import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { fetchCommunityById, updateCommunityAction } from '../../../actions';
import {
  EmptyState,
  GlassCard,
  MaterialSymbol,
  SectionIntro,
  SurfaceCard,
} from '../../../components';
import {
  TOKENS,
  chipStyle,
  formatCount,
  gradientButtonStyle,
  inputStyle,
  textareaStyle,
} from '../../../ui';

interface CommunityRow {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  communityType: 'public' | 'private' | 'restricted';
  humansOnly?: boolean | number;
  linkedModuleId?: string | null;
  memberCount: number;
  threadCount?: number;
}

type SectionKey = 'general' | 'access' | 'integrations' | 'signals';

const SECTION_COPY: Record<SectionKey, { title: string; description: string }> = {
  general: {
    title: 'General',
    description: 'Name, slug, and summary copy that shape how the room appears across feed cards.',
  },
  access: {
    title: 'Access',
    description: 'Community type and humans-only gating stay here so trust signals remain explicit.',
  },
  integrations: {
    title: 'Integrations',
    description: 'Link the room to a MyLife module for cross-app context and discovery.',
  },
  signals: {
    title: 'Signals',
    description: 'Review the current publishing posture before you save changes.',
  },
};

export default function CommunitySettingsPage() {
  const params = useParams<{ id: string }>();
  const [community, setCommunity] = useState<CommunityRow | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [communityType, setCommunityType] = useState<'public' | 'private' | 'restricted'>('public');
  const [humansOnly, setHumansOnly] = useState(false);
  const [linkedModuleId, setLinkedModuleId] = useState('');
  const [activeSection, setActiveSection] = useState<SectionKey>('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = (await fetchCommunityById(params.id)) as CommunityRow | undefined;
        if (!result || cancelled) return;
        setCommunity(result);
        setDisplayName(result.displayName);
        setDescription(result.description ?? '');
        setCommunityType(result.communityType ?? 'public');
        setHumansOnly(Boolean(result.humansOnly));
        setLinkedModuleId(result.linkedModuleId ?? '');
      } catch {
        if (!cancelled) setError('Could not load this settings surface.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const stats = useMemo(() => {
    if (!community) return [];
    return [
      { label: 'Members', value: formatCount(community.memberCount) },
      { label: 'Threads', value: formatCount(community.threadCount ?? 0) },
      { label: 'Mode', value: community.communityType },
    ];
  }, [community]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!community) return;
    setSaving(true);
    setError(null);
    setSavedMessage(null);
    try {
      const updated = (await updateCommunityAction(community.id, {
        displayName: displayName.trim(),
        description: description.trim(),
        communityType,
        humansOnly,
        linkedModuleId: linkedModuleId.trim() || null,
      })) as CommunityRow | undefined;
      if (!updated) {
        setError('The community could not be updated.');
        return;
      }
      setCommunity(updated);
      setSavedMessage('Settings saved.');
    } catch {
      setError('Saving failed. Try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <GlassCard style={{ minHeight: 420, animation: 'pulse 1.5s ease-in-out infinite' }} />;
  }

  if (error && !community) {
    return (
      <EmptyState
        icon="settings"
        title="Settings unavailable"
        description={error}
        actionHref="/forums/communities"
        actionLabel="Back to browser"
      />
    );
  }

  if (!community) {
    return (
      <EmptyState
        icon="settings"
        title="Community missing"
        description="This room could not be found, so its settings could not be opened."
        actionHref="/forums/communities"
        actionLabel="Back to browser"
      />
    );
  }

  return (
    <div className="forums-page-stack">
      <SectionIntro
        eyebrow="Community Settings"
        title={`${community.displayName} control panel`}
        description="The left rail keeps settings grouped by decision type so moderators can move through access, integrations, and trust posture without leaving the desktop shell."
        actions={
          <>
            <Link href={`/forums/community/${community.id}`} style={ghostLinkStyle}>
              View community
            </Link>
            <Link href={`/forums/mod-log?community=${community.id}`} style={ghostLinkStyle}>
              Mod log
            </Link>
          </>
        }
      />

      <div className="forums-detail-grid" style={{ gridTemplateColumns: '240px minmax(0, 1fr)' }}>
        <GlassCard className="forums-sidebar-card" style={{ display: 'grid', gap: 18 }}>
          <div style={{ display: 'grid', gap: 8 }}>
            {(
              [
                ['general', 'General'],
                ['access', 'Access'],
                ['integrations', 'Integrations'],
                ['signals', 'Signals'],
              ] as Array<[SectionKey, string]>
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setActiveSection(value)}
                style={{
                  ...sidebarButtonStyle,
                  background: activeSection === value ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                  color: activeSection === value ? TOKENS.primaryLight : TOKENS.textSecondary,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            <span style={eyebrowStyle}>Current posture</span>
            {stats.map((stat) => (
              <div key={stat.label} style={statRowStyle}>
                <span style={{ color: TOKENS.textTertiary, fontSize: 12 }}>{stat.label}</span>
                <strong style={{ fontSize: 14 }}>{stat.value}</strong>
              </div>
            ))}
            <span style={humansOnly ? chipStyle(true, 'trust') : chipStyle(false, 'neutral')}>
              {humansOnly ? 'Humans only enabled' : 'Open membership'}
            </span>
          </div>
        </GlassCard>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 18 }}>
          <SurfaceCard style={{ display: 'grid', gap: 18 }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <span style={eyebrowStyle}>{SECTION_COPY[activeSection].title}</span>
              <h2 style={sectionTitleStyle}>{SECTION_COPY[activeSection].description}</h2>
            </div>

            {activeSection === 'general' ? (
              <div style={{ display: 'grid', gap: 16 }}>
                <label style={fieldStyle}>
                  <span style={fieldLabelStyle}>Display name</span>
                  <input
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    style={inputStyle}
                    required
                  />
                </label>
                <label style={fieldStyle}>
                  <span style={fieldLabelStyle}>Slug</span>
                  <input value={community.name} style={{ ...inputStyle, opacity: 0.58 }} disabled />
                  <span style={fieldHintStyle}>This route stays stable so bookmarks and deep links do not break.</span>
                </label>
                <label style={fieldStyle}>
                  <span style={fieldLabelStyle}>Description</span>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    style={textareaStyle}
                    rows={5}
                    maxLength={500}
                  />
                  <span style={fieldHintStyle}>{description.length}/500 characters</span>
                </label>
              </div>
            ) : null}

            {activeSection === 'access' ? (
              <div style={{ display: 'grid', gap: 16 }}>
                <label style={fieldStyle}>
                  <span style={fieldLabelStyle}>Community type</span>
                  <select
                    value={communityType}
                    onChange={(event) => setCommunityType(event.target.value as 'public' | 'private' | 'restricted')}
                    style={selectStyle}
                  >
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                    <option value="restricted">Restricted</option>
                  </select>
                </label>
                <div style={{ display: 'grid', gap: 10 }}>
                  <span style={fieldLabelStyle}>Membership gate</span>
                  <div className="forums-chip-row">
                    <button
                      type="button"
                      onClick={() => setHumansOnly(false)}
                      style={chipStyle(!humansOnly, 'gold')}
                    >
                      Open membership
                    </button>
                    <button
                      type="button"
                      onClick={() => setHumansOnly(true)}
                      style={chipStyle(humansOnly, 'trust')}
                    >
                      Humans only
                    </button>
                  </div>
                  <span style={fieldHintStyle}>Purple remains reserved for verified-human trust states.</span>
                </div>
              </div>
            ) : null}

            {activeSection === 'integrations' ? (
              <div style={{ display: 'grid', gap: 16 }}>
                <label style={fieldStyle}>
                  <span style={fieldLabelStyle}>Linked module ID</span>
                  <input
                    value={linkedModuleId}
                    onChange={(event) => setLinkedModuleId(event.target.value)}
                    placeholder="myforums, mygarden, myrecipes..."
                    style={inputStyle}
                  />
                </label>
                <GlassCard style={{ display: 'grid', gap: 10, padding: 18 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <MaterialSymbol name="hub" size={18} color={TOKENS.primaryLight} />
                    <strong style={{ fontSize: 14 }}>Cross-module context</strong>
                  </div>
                  <p style={{ margin: 0, color: TOKENS.textSecondary, lineHeight: 1.6 }}>
                    Linked modules let the community surface related discussions in the hub without changing the forum data model.
                  </p>
                </GlassCard>
              </div>
            ) : null}

            {activeSection === 'signals' ? (
              <div style={{ display: 'grid', gap: 14 }}>
                <div style={signalRowStyle}>
                  <span style={fieldLabelStyle}>Chrome</span>
                  <span style={{ color: TOKENS.primaryLight, fontWeight: 700 }}>Warm gold</span>
                </div>
                <div style={signalRowStyle}>
                  <span style={fieldLabelStyle}>Verification signal</span>
                  <span style={{ color: TOKENS.trustLight, fontWeight: 700 }}>Purple only</span>
                </div>
                <div style={signalRowStyle}>
                  <span style={fieldLabelStyle}>Saved from this page</span>
                  <span style={{ color: TOKENS.textSecondary, fontWeight: 700 }}>
                    {savedMessage ?? 'Not yet in this session'}
                  </span>
                </div>
              </div>
            ) : null}
          </SurfaceCard>

          <GlassCard style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'grid', gap: 4 }}>
              {error ? <span style={{ color: TOKENS.danger, fontSize: 13 }}>{error}</span> : null}
              {savedMessage ? <span style={{ color: TOKENS.success, fontSize: 13 }}>{savedMessage}</span> : null}
              <span style={{ color: TOKENS.textTertiary, fontSize: 12 }}>Community updates apply instantly to the cached forums surface.</span>
            </div>
            <button type="submit" disabled={saving} style={submitButtonStyle(saving)}>
              {saving ? 'Saving...' : 'Save settings'}
            </button>
          </GlassCard>
        </form>
      </div>
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

const sectionTitleStyle = {
  margin: 0,
  fontSize: 18,
  color: TOKENS.textSecondary,
  lineHeight: 1.65,
  fontWeight: 500,
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

const fieldHintStyle = {
  color: TOKENS.textTertiary,
  fontSize: 12,
  lineHeight: 1.55,
} as const;

const sidebarButtonStyle = {
  border: 'none',
  minHeight: 42,
  borderRadius: 18,
  padding: '0 14px',
  textAlign: 'left' as const,
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 700,
} as const;

const statRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'center',
  padding: '10px 12px',
  borderRadius: 16,
  background: 'rgba(255,255,255,0.04)',
} as const;

const signalRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  alignItems: 'center',
  padding: '14px 16px',
  borderRadius: 20,
  background: 'rgba(255,255,255,0.05)',
} as const;

const selectStyle = {
  ...inputStyle,
  appearance: 'none',
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
    opacity: disabled ? 0.56 : 1,
    cursor: disabled ? 'wait' : 'pointer',
  } as const;
}
