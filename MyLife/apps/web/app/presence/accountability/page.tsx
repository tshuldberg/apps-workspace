'use client';

import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import {
  PresenceCard,
  PresenceEmptyState,
  PresenceSectionHeading,
  TOKENS,
  chipStyle,
  gradientButtonStyle,
  inputStyle,
  modalBackdropStyle,
  modalCardStyle,
} from '../ui';
import {
  doCreateAccountabilityPartner,
  doRevokeAccountabilityPartner,
  doUpdateAccountabilityPartner,
  fetchAccountabilitySnapshot,
} from '../actions';

interface AccountabilitySnapshot {
  partners: Array<{
    id: string;
    partnerName: string;
    shareCode: string;
    active: boolean;
    notifyOverGoal: boolean;
    createdAt: number;
  }>;
}

export default function AccountabilityPage() {
  const [data, setData] = useState<AccountabilitySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [partnerName, setPartnerName] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadData() {
    try {
      setError(null);
      setData((await fetchAccountabilitySnapshot()) as AccountabilitySnapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accountability partners.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function createPartner() {
    try {
      setSaving(true);
      await doCreateAccountabilityPartner(partnerName);
      setPartnerName('');
      setModalOpen(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create that partner.');
    } finally {
      setSaving(false);
    }
  }

  async function copyCode(shareCode: string) {
    try {
      await navigator.clipboard.writeText(shareCode);
    } catch {
      setError('Could not copy the share code.');
    }
  }

  if (loading) {
    return <PresenceCard style={{ minHeight: 240 }} />;
  }

  if (error && data == null) {
    return (
      <PresenceEmptyState
        icon="warning"
        title="Accountability unavailable"
        body={error}
      />
    );
  }

  return (
    <div className="pr-main-stack">
      <PresenceCard>
        <PresenceSectionHeading
          title="Accountability Partners"
          subtitle="Invite a friend, coach, or partner who only needs the signal of whether you stayed aligned with your goal, never the raw underlying screen-time data."
          action={(
            <button type="button" onClick={() => setModalOpen(true)} style={gradientButtonStyle}>
              Add Partner
            </button>
          )}
        />
      </PresenceCard>

      {data?.partners.length === 0 ? (
        <PresenceEmptyState
          icon="groups"
          title="No accountability partners yet"
          body="Create a share code and give it to someone who should only see whether you stayed aligned with your goals."
        />
      ) : (
        <PresenceCard>
          <PresenceSectionHeading title="Partner List" subtitle="Toggle notifications, copy codes, or revoke access at any time." />
          <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
            {data?.partners.map((partner) => (
              <div key={partner.id} style={{ padding: 18, borderRadius: 24, background: 'rgba(255,255,255,0.04)', border: `1.5px solid ${partner.active ? TOKENS.borderStrong : TOKENS.border}`, display: 'grid', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{partner.partnerName}</div>
                    <div style={{ color: TOKENS.textSecondary, fontSize: 13, marginTop: 8 }}>Share code {partner.shareCode}</div>
                  </div>
                  <div style={{ color: partner.active ? TOKENS.success : TOKENS.textTertiary, fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                    {partner.active ? 'Active' : 'Revoked'}
                  </div>
                </div>
                <div className="pr-chip-row">
                  <button type="button" onClick={() => void doUpdateAccountabilityPartner(partner.id, { notifyOverGoal: !partner.notifyOverGoal }).then(loadData)} style={chipStyle(partner.notifyOverGoal)}>
                    {partner.notifyOverGoal ? 'Notify over goal' : 'Notifications off'}
                  </button>
                  <button type="button" onClick={() => void copyCode(partner.shareCode)} style={chipStyle(false)}>
                    Copy code
                  </button>
                  {partner.active ? (
                    <button type="button" onClick={() => void doRevokeAccountabilityPartner(partner.id).then(loadData)} style={{ ...chipStyle(false), color: TOKENS.danger }}>
                      Revoke
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </PresenceCard>
      )}

      {modalOpen ? (
        <div style={modalBackdropStyle} onClick={() => setModalOpen(false)}>
          <div style={modalCardStyle} onClick={(event) => event.stopPropagation()}>
            <PresenceSectionHeading title="Add accountability partner" subtitle="Create a local share code you can send outside the app." />
            <div style={{ display: 'grid', gap: 16, marginTop: 18 }}>
              <label style={fieldStyle}>
                <span style={sectionLabelStyle}>Partner name</span>
                <input value={partnerName} onChange={(event) => setPartnerName(event.target.value)} style={inputStyle} placeholder="Alex" />
              </label>
              <div className="pr-chip-row" style={{ justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setModalOpen(false)} style={chipStyle(false)}>
                  Cancel
                </button>
                <button type="button" onClick={() => void createPartner()} style={gradientButtonStyle} disabled={saving}>
                  {saving ? 'Saving…' : 'Create Partner'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const fieldStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
};

const sectionLabelStyle: CSSProperties = {
  color: TOKENS.textTertiary,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
};
