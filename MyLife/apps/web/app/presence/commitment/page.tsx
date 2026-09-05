'use client';

import { useEffect, useState } from 'react';
import {
  PresenceCard,
  PresenceEmptyState,
  PresenceSectionHeading,
  TOKENS,
  chipStyle,
  gradientButtonStyle,
  textareaStyle,
} from '../ui';
import {
  doCreateCommitment,
  doDeleteCommitment,
  doUpdateCommitment,
  fetchCommitmentSnapshot,
} from '../actions';

interface CommitmentSnapshot {
  active: {
    id: string;
    text: string;
  } | null;
  commitments: Array<{
    id: string;
    text: string;
    active: boolean;
    updatedAt: number;
  }>;
}

export default function CommitmentPage() {
  const [data, setData] = useState<CommitmentSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadData() {
    try {
      setError(null);
      const snapshot = (await fetchCommitmentSnapshot()) as CommitmentSnapshot;
      setData(snapshot);
      setDraft(snapshot.active?.text ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load commitments.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function saveCommitment() {
    try {
      setSaving(true);
      if (data?.active) {
        await doUpdateCommitment(data.active.id, draft);
      } else {
        await doCreateCommitment(draft);
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the commitment.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <PresenceCard style={{ minHeight: 240 }} />;
  }

  if (error && data == null) {
    return (
      <PresenceEmptyState
        icon="warning"
        title="Commitment unavailable"
        body={error}
      />
    );
  }

  return (
    <div className="pr-main-stack">
      <PresenceCard>
        <PresenceSectionHeading
          title="Commitment Contract"
          subtitle="A place to write the message your future self needs when the day starts slipping."
        />
      </PresenceCard>

      <div className="pr-grid-2">
        <PresenceCard>
          <PresenceSectionHeading title="Editor" subtitle="The active commitment is the one surfaced in your home and report screens." />
          <div style={{ display: 'grid', gap: 16, marginTop: 18 }}>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="I committed to being present because…"
              style={textareaStyle}
            />
            <div className="pr-chip-row" style={{ justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setDraft(data?.active?.text ?? '')} style={chipStyle(false)}>
                Reset
              </button>
              <button type="button" onClick={() => void saveCommitment()} style={gradientButtonStyle} disabled={saving}>
                {saving ? 'Saving…' : 'Save Commitment'}
              </button>
            </div>
          </div>
        </PresenceCard>

        <PresenceCard>
          <PresenceSectionHeading title="Why it matters" subtitle="A written commitment makes it easier to interrupt an urge with something bigger than the urge itself." />
          <div style={{ color: TOKENS.textSecondary, fontSize: 15, lineHeight: 1.8, marginTop: 18 }}>
            Use this space for the sentence you want to see when your day gets noisy: who you want to be around, what you want to protect, and what being present actually gives back.
          </div>
        </PresenceCard>
      </div>

      {data?.commitments.length === 0 ? (
        <PresenceEmptyState
          icon="handshake"
          title="No commitment history yet"
          body="Write your first commitment and Presence will keep older versions in a local history list."
        />
      ) : (
        <PresenceCard>
          <PresenceSectionHeading title="History" subtitle="Older versions are kept so you can see how your language evolves over time." />
          <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
            {data?.commitments.map((commitment) => (
              <div key={commitment.id} style={{ padding: 18, borderRadius: 24, background: 'rgba(255,255,255,0.04)', border: `1.5px solid ${commitment.active ? TOKENS.borderStrong : TOKENS.border}`, display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ color: commitment.active ? TOKENS.accentLight : TOKENS.textTertiary, fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                    {commitment.active ? 'Active now' : new Date(commitment.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                  <button type="button" onClick={() => void doDeleteCommitment(commitment.id).then(loadData)} style={{ ...chipStyle(false), color: TOKENS.danger }}>
                    Delete
                  </button>
                </div>
                <div style={{ color: TOKENS.text, fontSize: 15, lineHeight: 1.8 }}>
                  {commitment.text}
                </div>
              </div>
            ))}
          </div>
        </PresenceCard>
      )}
    </div>
  );
}
