'use client';

import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  PresenceCard,
  PresenceEmptyState,
  PresenceMetricCard,
  PresenceSectionHeading,
  TOKENS,
  chipStyle,
  ghostButtonStyle,
  gradientButtonStyle,
  inputStyle,
  modalBackdropStyle,
  modalCardStyle,
} from '../ui';
import {
  doDeactivateIntention,
  doDeleteIntention,
  doUpsertIntention,
  fetchAppLibrary,
  fetchIntentions,
} from '../actions';

interface IntentionRow {
  app_id: string;
  app_name: string;
  daily_open_limit: number | null;
  per_open_minutes: number | null;
  breathing_pause: number;
}

interface AppLibraryEntry {
  appId: string;
  name: string;
  category: string;
  description: string;
}

export default function IntentionsPage() {
  const [intentions, setIntentions] = useState<IntentionRow[]>([]);
  const [appLibrary, setAppLibrary] = useState<AppLibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAppId, setSelectedAppId] = useState('');
  const [openLimit, setOpenLimit] = useState('6');
  const [perOpenMinutes, setPerOpenMinutes] = useState('10');
  const [breathingPause, setBreathingPause] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadData() {
    try {
      setError(null);
      const [nextIntentions, nextLibrary] = await Promise.all([
        fetchIntentions(),
        fetchAppLibrary(),
      ]);
      setIntentions((nextIntentions as IntentionRow[]) ?? []);
      setAppLibrary((nextLibrary as AppLibraryEntry[]) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load intentions.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const availableApps = useMemo(
    () => appLibrary.filter((app) => !intentions.some((intention) => intention.app_id === app.appId)),
    [appLibrary, intentions],
  );

  const breathingCount = intentions.filter((intention) => intention.breathing_pause === 1).length;

  async function saveNewIntention() {
    if (!selectedAppId) {
      setError('Pick an app before saving.');
      return;
    }

    const app = appLibrary.find((entry) => entry.appId === selectedAppId);
    if (!app) return;

    try {
      setSaving(true);
      await doUpsertIntention({
        app_id: app.appId,
        app_name: app.name,
        daily_open_limit: Number(openLimit) || null,
        per_open_minutes: Number(perOpenMinutes) || null,
        breathing_pause: breathingPause,
      });
      setModalOpen(false);
      setSelectedAppId('');
      setOpenLimit('6');
      setPerOpenMinutes('10');
      setBreathingPause(true);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the intention.');
    } finally {
      setSaving(false);
    }
  }

  async function patchIntention(intention: IntentionRow, patch: Partial<IntentionRow>) {
    try {
      await doUpsertIntention({
        app_id: intention.app_id,
        app_name: patch.app_name ?? intention.app_name,
        daily_open_limit: patch.daily_open_limit ?? intention.daily_open_limit,
        per_open_minutes: patch.per_open_minutes ?? intention.per_open_minutes,
        breathing_pause: (patch.breathing_pause ?? intention.breathing_pause) === 1,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the intention.');
    }
  }

  if (loading) {
    return (
      <div className="pr-card-stack">
        <PresenceCard style={{ minHeight: 180 }} />
        <PresenceCard style={{ minHeight: 220 }} />
      </div>
    );
  }

  if (error && intentions.length === 0) {
    return (
      <PresenceEmptyState
        icon="warning"
        title="Intentions unavailable"
        body={error}
      />
    );
  }

  return (
    <div className="pr-main-stack">
      <PresenceCard>
        <PresenceSectionHeading
          title="App Intentions"
          subtitle="Set a boundary for each high-friction app: how often you can open it, how long each visit should last, and whether Presence forces a breathing pause first."
          action={(
            <button type="button" onClick={() => setModalOpen(true)} style={gradientButtonStyle}>
              Add App
            </button>
          )}
        />

        <div className="pr-grid-3" style={{ marginTop: 20 }}>
          <PresenceMetricCard label="Active Intentions" value={`${intentions.length}`} tone={TOKENS.accentLight} detail="apps with boundaries" />
          <PresenceMetricCard label="Breathing Pause" value={`${breathingCount}`} tone={TOKENS.info} detail="apps that trigger a reset prompt" />
          <PresenceMetricCard label="Settings" value="Report + Limits" tone={TOKENS.warning} detail="linked to daily report compliance" />
        </div>
      </PresenceCard>

      {intentions.length === 0 ? (
        <PresenceEmptyState
          icon="psychology"
          title="No intentions configured"
          body="Pick the apps that hijack your attention most often and give each one a clear rule."
          action={(
            <button type="button" onClick={() => setModalOpen(true)} style={gradientButtonStyle}>
              Add First App
            </button>
          )}
        />
      ) : (
        <PresenceCard>
          <PresenceSectionHeading
            title="Per-App Controls"
            subtitle="Use the inline steppers to tighten or relax each app without reopening a modal."
            action={<Link href="/presence/report" style={{ ...ghostButtonStyle, textDecoration: 'none' }}>Open Report</Link>}
          />

          <div style={{ display: 'grid', gap: 14, marginTop: 18 }}>
            {intentions.map((intention) => (
              <div
                key={intention.app_id}
                style={{
                  padding: 20,
                  borderRadius: 24,
                  background: 'rgba(255,255,255,0.04)',
                  border: `1.5px solid ${TOKENS.border}`,
                  display: 'grid',
                  gap: 14,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{intention.app_name}</div>
                    <div style={{ color: TOKENS.textTertiary, fontSize: 12, marginTop: 6 }}>{intention.app_id}</div>
                  </div>
                  <div className="pr-chip-row">
                    <button
                      type="button"
                      onClick={() => void doDeactivateIntention(intention.app_id).then(loadData)}
                      style={chipStyle(false)}
                    >
                      Deactivate
                    </button>
                    <button
                      type="button"
                      onClick={() => void doDeleteIntention(intention.app_id).then(loadData)}
                      style={{ ...chipStyle(false), color: TOKENS.danger }}
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="pr-grid-3">
                  <StepperBlock
                    label="Daily opens"
                    value={intention.daily_open_limit ?? 0}
                    onDecrease={() => void patchIntention(intention, { daily_open_limit: Math.max(1, (intention.daily_open_limit ?? 1) - 1) })}
                    onIncrease={() => void patchIntention(intention, { daily_open_limit: (intention.daily_open_limit ?? 0) + 1 })}
                  />
                  <StepperBlock
                    label="Per open minutes"
                    value={intention.per_open_minutes ?? 0}
                    onDecrease={() => void patchIntention(intention, { per_open_minutes: Math.max(1, (intention.per_open_minutes ?? 1) - 1) })}
                    onIncrease={() => void patchIntention(intention, { per_open_minutes: (intention.per_open_minutes ?? 0) + 1 })}
                  />
                  <div style={toggleBlockStyle}>
                    <div>
                      <div style={sectionLabelStyle}>Breathing pause</div>
                      <div style={{ color: TOKENS.textSecondary, fontSize: 13, marginTop: 6 }}>
                        Force a quick check-in before the app opens.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void patchIntention(intention, { breathing_pause: intention.breathing_pause === 1 ? 0 : 1 })}
                      style={chipStyle(intention.breathing_pause === 1)}
                    >
                      {intention.breathing_pause === 1 ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </PresenceCard>
      )}

      <PresenceCard>
        <PresenceSectionHeading
          title="Breathing Pause Preview"
          subtitle="When enabled, Presence can interrupt the reflex loop before an app opens and ask for a more intentional reason."
        />
        <div style={{ marginTop: 18, padding: 24, borderRadius: 24, background: 'linear-gradient(135deg, rgba(34,211,238,0.12), rgba(255,255,255,0.03))', border: `1.5px solid ${TOKENS.borderStrong}` }}>
          <div style={{ color: TOKENS.accentLight, fontSize: 12, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
            Before opening Instagram
          </div>
          <div style={{ marginTop: 12, fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>
            Take one breath and decide what this visit is for.
          </div>
          <div style={{ marginTop: 10, color: TOKENS.textSecondary, fontSize: 14, lineHeight: 1.7 }}>
            The pause can ask whether you are posting, replying, or just scrolling. That short interruption is often enough to break autopilot.
          </div>
        </div>
      </PresenceCard>

      {modalOpen ? (
        <div style={modalBackdropStyle} onClick={() => setModalOpen(false)}>
          <div style={modalCardStyle} onClick={(event) => event.stopPropagation()}>
            <PresenceSectionHeading title="Add app intention" subtitle="Choose an app and define the constraints Presence should enforce." />

            <div className="pr-form-grid" style={{ marginTop: 18 }}>
              <label style={fieldStyle}>
                <span style={sectionLabelStyle}>App</span>
                <select value={selectedAppId} onChange={(event) => setSelectedAppId(event.target.value)} style={inputStyle}>
                  <option value="">Choose an app</option>
                  {availableApps.map((app) => (
                    <option key={app.appId} value={app.appId}>
                      {app.name} · {app.category}
                    </option>
                  ))}
                </select>
              </label>

              <div className="pr-grid-2">
                <label style={fieldStyle}>
                  <span style={sectionLabelStyle}>Daily opens</span>
                  <input value={openLimit} onChange={(event) => setOpenLimit(event.target.value)} style={inputStyle} inputMode="numeric" />
                </label>
                <label style={fieldStyle}>
                  <span style={sectionLabelStyle}>Per-open minutes</span>
                  <input value={perOpenMinutes} onChange={(event) => setPerOpenMinutes(event.target.value)} style={inputStyle} inputMode="numeric" />
                </label>
              </div>

              <button type="button" onClick={() => setBreathingPause((current) => !current)} style={chipStyle(breathingPause)}>
                Breathing pause {breathingPause ? 'on' : 'off'}
              </button>

              <div className="pr-chip-row" style={{ justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setModalOpen(false)} style={chipStyle(false)}>
                  Cancel
                </button>
                <button type="button" onClick={() => void saveNewIntention()} style={gradientButtonStyle} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Intention'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StepperBlock({
  label,
  value,
  onDecrease,
  onIncrease,
}: {
  label: string;
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <div style={toggleBlockStyle}>
      <div>
        <div style={sectionLabelStyle}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', marginTop: 8 }}>{value}</div>
      </div>
      <div className="pr-chip-row">
        <button type="button" onClick={onDecrease} style={chipStyle(false)}>
          -
        </button>
        <button type="button" onClick={onIncrease} style={chipStyle(false)}>
          +
        </button>
      </div>
    </div>
  );
}

const toggleBlockStyle: CSSProperties = {
  padding: 16,
  borderRadius: 20,
  background: 'rgba(255,255,255,0.03)',
  border: `1.5px solid ${TOKENS.border}`,
  display: 'grid',
  gap: 14,
};

const sectionLabelStyle: CSSProperties = {
  color: TOKENS.textTertiary,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
};

const fieldStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
};
