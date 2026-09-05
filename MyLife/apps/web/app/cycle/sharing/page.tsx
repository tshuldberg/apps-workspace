'use client';

import { useCallback, useEffect, useState } from 'react';
import { Copy, ShieldCheck } from 'lucide-react';
import {
  doCreatePartnerLink,
  doRevokePartnerLink,
  doUpdatePartnerLink,
  fetchActivePartnerLink,
  fetchSharedView,
} from '../actions';
import {
  PHASE_COLORS,
  TOKENS,
  eyebrowStyle,
  ghostButtonStyle,
  gradientButtonStyle,
  inputStyle,
  panelStyle,
  subtitleStyle,
  titleStyle,
} from '../ui';
import { formatMonthDayYear } from '../utils';

type PartnerLink = Awaited<ReturnType<typeof fetchActivePartnerLink>>;
type SharedView = Awaited<ReturnType<typeof fetchSharedView>>;

const PERMISSIONS = [
  {
    key: 'sharePhase',
    title: 'Cycle Dates',
    body: 'Current phase, cycle day, and rhythm timing.',
  },
  {
    key: 'shareSymptoms',
    title: 'Symptoms',
    body: 'Physical signals logged for today.',
  },
  {
    key: 'shareMood',
    title: 'Mood',
    body: 'Daily emotional check-ins and feeling trends.',
  },
  {
    key: 'sharePredictions',
    title: 'Predictions',
    body: 'Forecasted next period and cycle confidence.',
  },
  {
    key: 'shareTemperature',
    title: 'Temperature',
    body: 'Basal-body-temperature tracking and shift signals.',
  },
] as const;

type PermissionKey = (typeof PERMISSIONS)[number]['key'];

function ToggleRow({
  title,
  body,
  checked,
  onToggle,
}: {
  title: string;
  body: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={{ ...panelStyle('base'), padding: 16, display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 800 }}>{title}</h3>
        <p style={{ ...subtitleStyle, marginTop: 6 }}>{body}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: 54,
          height: 30,
          border: 'none',
          borderRadius: 999,
          background: checked ? PHASE_COLORS.ovulation : 'rgba(255,255,255,0.08)',
          cursor: 'pointer',
          padding: 3,
          position: 'relative',
        }}
      >
        <span
          style={{
            display: 'block',
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: checked ? '#fff' : 'rgba(255,255,255,0.5)',
            transform: checked ? 'translateX(24px)' : 'translateX(0)',
            transition: 'transform 0.15s ease',
          }}
        />
      </button>
    </div>
  );
}

export default function CycleSharingPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [partnerName, setPartnerName] = useState('');
  const [link, setLink] = useState<PartnerLink>(null);
  const [sharedView, setSharedView] = useState<SharedView>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextLink = await fetchActivePartnerLink();
      setLink(nextLink);
      setPartnerName(nextLink?.partnerName ?? '');
      setSharedView(nextLink ? await fetchSharedView() : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load partner sync');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      await doCreatePartnerLink(partnerName ? { partnerName } : undefined);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create partner link');
    } finally {
      setSaving(false);
    }
  }, [load, partnerName]);

  const handleToggle = useCallback(
    async (field: PermissionKey, value: boolean) => {
      if (!link) return;
      setSaving(true);
      setError(null);
      try {
        await doUpdatePartnerLink(link.id, { [field]: value });
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update sharing permissions');
      } finally {
        setSaving(false);
      }
    },
    [link, load],
  );

  const handleCopy = useCallback(async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.linkCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to copy the share code');
    }
  }, [link]);

  const handleRevoke = useCallback(async () => {
    if (!link || !window.confirm('Revoke this link? Your partner will immediately lose access.')) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await doRevokePartnerLink(link.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke the partner link');
    } finally {
      setSaving(false);
    }
  }, [link, load]);

  if (loading) {
    return (
      <div className="cy-grid-2">
        <div style={{ ...panelStyle('mid'), minHeight: 340, opacity: 0.5, animation: 'pulse 2s infinite' }} />
        <div style={{ ...panelStyle('low'), minHeight: 340, opacity: 0.45, animation: 'pulse 2s infinite' }} />
      </div>
    );
  }

  if (!link) {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gap: 24 }}>
        <section
          style={{
            ...panelStyle('mid'),
            padding: '52px 32px',
            textAlign: 'center',
            background:
              'radial-gradient(circle at top center, rgba(244,114,182,0.18), transparent 34%), linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
          }}
        >
          <p style={{ ...eyebrowStyle, color: PHASE_COLORS.ovulation }}>Partner Sync</p>
          <h1 style={{ ...titleStyle, marginTop: 12 }}>Secure sharing with precise control</h1>
          <p style={{ ...subtitleStyle, marginTop: 14, maxWidth: 520, margin: '14px auto 0' }}>
            Share only the parts of MyCycle that support communication and planning. You can
            revoke access instantly at any time.
          </p>
        </section>

        {error ? (
          <section style={{ ...panelStyle('low'), padding: 22 }}>
            <p style={{ color: TOKENS.danger, fontWeight: 700 }}>{error}</p>
          </section>
        ) : null}

        <section style={{ ...panelStyle('low'), padding: 24, maxWidth: 560, margin: '0 auto', width: '100%' }}>
          <p style={eyebrowStyle}>Create Share Code</p>
          <input
            value={partnerName}
            onChange={(event) => setPartnerName(event.target.value)}
            placeholder="Partner name (optional)"
            style={{ ...inputStyle, marginTop: 16 }}
          />
          <button type="button" onClick={() => void handleCreate()} disabled={saving} style={{ ...gradientButtonStyle, marginTop: 16 }}>
            {saving ? 'Creating…' : 'Create Partner Link'}
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="cy-grid-2" style={{ maxWidth: 980, margin: '0 auto' }}>
      <div className="cy-card-stack">
        {error ? (
          <section style={{ ...panelStyle('low'), padding: 22 }}>
            <p style={{ color: TOKENS.danger, fontWeight: 700 }}>{error}</p>
          </section>
        ) : null}

        <section
          style={{
            ...panelStyle('mid'),
            padding: 24,
            background:
              'radial-gradient(circle at top left, rgba(244,114,182,0.14), transparent 36%), linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <p style={{ ...eyebrowStyle, color: PHASE_COLORS.ovulation }}>Current Sync</p>
              <h1 style={{ ...titleStyle, fontSize: 34, marginTop: 12 }}>
                Connected{link.partnerName ? `: ${link.partnerName}` : ''}
              </h1>
            </div>
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 999,
                background: 'rgba(48,209,88,0.12)',
                color: TOKENS.success,
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              Active
            </div>
          </div>
          <p style={{ ...subtitleStyle, marginTop: 14 }}>
            Privacy-first sharing. Changes apply immediately to the partner view.
          </p>
        </section>

        <section style={{ ...panelStyle('low'), padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <p style={eyebrowStyle}>Share Code</p>
              <p style={{ ...subtitleStyle, marginTop: 8 }}>Give this code to your partner to connect.</p>
            </div>
            <button type="button" onClick={() => void handleCopy()} style={ghostButtonStyle}>
              <Copy size={16} />
            </button>
          </div>
          <div
            style={{
              ...panelStyle('base'),
              padding: '26px 20px',
              marginTop: 18,
              textAlign: 'center',
              color: PHASE_COLORS.ovulation,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 44,
              fontWeight: 800,
              letterSpacing: '0.18em',
            }}
          >
            {link.linkCode}
          </div>
          {copied ? (
            <p style={{ ...subtitleStyle, marginTop: 10, color: TOKENS.success }}>Code copied.</p>
          ) : null}
        </section>

        <section style={{ ...panelStyle('low'), padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ShieldCheck size={20} color={PHASE_COLORS.ovulation} />
            <div>
              <p style={{ fontSize: 16, fontWeight: 800 }}>Your data, your control</p>
              <p style={{ ...subtitleStyle, marginTop: 6 }}>
                Choose what is visible. The link can stay active while permissions shift over time.
              </p>
            </div>
          </div>
        </section>

        <button
          type="button"
          onClick={() => void handleRevoke()}
          disabled={saving}
          style={{ ...ghostButtonStyle, color: TOKENS.danger }}
        >
          {saving ? 'Working…' : 'Revoke Link'}
        </button>
      </div>

      <div className="cy-card-stack">
        <section style={{ ...panelStyle('low'), padding: 24 }}>
          <p style={eyebrowStyle}>Granular Privacy Control</p>
          <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
            {PERMISSIONS.map((permission) => (
              <ToggleRow
                key={permission.key}
                title={permission.title}
                body={permission.body}
                checked={Boolean(link[permission.key])}
                onToggle={() => void handleToggle(permission.key, !link[permission.key])}
              />
            ))}
          </div>
        </section>

        <section style={{ ...panelStyle('low'), padding: 24 }}>
          <p style={eyebrowStyle}>Partner Preview</p>
          <div style={{ ...panelStyle('base'), padding: 18, marginTop: 18, display: 'grid', gap: 12 }}>
            {sharedView?.currentPhase ? (
              <PreviewRow label="Phase" value={sharedView.currentPhase} />
            ) : null}
            {sharedView?.cycleDay != null ? (
              <PreviewRow label="Cycle Day" value={`Day ${sharedView.cycleDay}`} />
            ) : null}
            {sharedView?.predictedNextPeriod ? (
              <PreviewRow label="Next Period" value={formatMonthDayYear(sharedView.predictedNextPeriod)} />
            ) : null}
            {sharedView?.fertileWindowStart && sharedView?.fertileWindowEnd ? (
              <PreviewRow
                label="Fertile Window"
                value={`${formatMonthDayYear(sharedView.fertileWindowStart)} to ${formatMonthDayYear(sharedView.fertileWindowEnd)}`}
              />
            ) : null}
            {sharedView?.symptomSummary ? (
              <PreviewRow label="Symptoms" value={sharedView.symptomSummary} />
            ) : null}
            {sharedView?.pregnancyWeek != null ? (
              <PreviewRow label="Pregnancy" value={`Week ${sharedView.pregnancyWeek}`} />
            ) : null}
            {sharedView?.pregnancyDueDate ? (
              <PreviewRow label="Due Date" value={formatMonthDayYear(sharedView.pregnancyDueDate)} />
            ) : null}
            {!sharedView?.currentPhase &&
            sharedView?.cycleDay == null &&
            !sharedView?.predictedNextPeriod &&
            !sharedView?.symptomSummary ? (
              <p style={subtitleStyle}>No partner-facing data yet. Start logging to populate the preview.</p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
      <span style={{ color: TOKENS.textSecondary, fontSize: 13, fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 800, textTransform: 'capitalize' }}>{value}</span>
    </div>
  );
}
