'use client';

import { useState, useMemo } from 'react';
import type { AudienceRule, Campaign } from '@/lib/marketing/types';
import { STARTER_SEGMENTS } from '@/lib/marketing/audience';
import { STARTER_TEMPLATES, renderTemplate } from '@/lib/marketing/templates';
import { preFlightCheckWithBody } from '@/lib/marketing/compliance';

type CampaignHistoryRow = {
  id: string;
  name: string;
  status: Campaign['status'];
  send_count: number;
  open_count: number;
  created_at: string;
};

const RULE_FIELDS = [
  { value: 'visit_count', label: 'Visit Count' },
  { value: 'lifetime_spend_cents', label: 'Lifetime Spend (cents)' },
  { value: 'vip', label: 'VIP Status' },
  { value: 'auto_tags', label: 'Auto Tags' },
];

const OPERATORS: { value: AudienceRule['operator']; label: string }[] = [
  { value: 'gte', label: '>=' },
  { value: 'lte', label: '<=' },
  { value: 'gt', label: '>' },
  { value: 'lt', label: '<' },
  { value: 'eq', label: '=' },
  { value: 'contains', label: 'contains' },
];

export default function MarketingPage() {
  // Audience builder
  const [rules, setRules] = useState<AudienceRule[]>([]);
  const [selectedSegment, setSelectedSegment] = useState<string>('');

  // Template selection
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [customBody, setCustomBody] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [channel, setChannel] = useState<'email' | 'sms'>('email');

  // Campaign state
  const [campaignName, setCampaignName] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);
  const [sending, setSending] = useState(false);

  // History (mock)
  const [history] = useState<CampaignHistoryRow[]>([
    { id: '1', name: 'Spring Win-Back', status: 'sent', send_count: 142, open_count: 67, created_at: '2026-04-15' },
    { id: '2', name: 'Birthday April', status: 'sent', send_count: 23, open_count: 18, created_at: '2026-04-10' },
    { id: '3', name: 'Weekend Special', status: 'draft', send_count: 0, open_count: 0, created_at: '2026-04-18' },
  ]);

  const activeTemplate = useMemo(() => {
    if (selectedTemplate) {
      return STARTER_TEMPLATES.find((t) => t.name === selectedTemplate);
    }
    return null;
  }, [selectedTemplate]);

  const resolvedBody = useMemo(() => {
    const body = activeTemplate?.body_md ?? customBody;
    if (!body) return '';
    // Preview with sample data
    return renderTemplate(body, {
      first_name: 'Jane',
      booking_link: 'https://reserve.example.com',
      unsubscribe_link: 'https://example.com/unsub',
      review_link: 'https://example.com/review',
      offer: '20% off your next meal',
      event_name: 'Wine Tasting Night',
      event_date: 'April 25, 2026',
      event_description: 'An evening of fine wines paired with seasonal bites.',
      season: 'Spring',
      menu_link: 'https://example.com/menu',
    });
  }, [activeTemplate, customBody]);

  const complianceResult = useMemo(() => {
    const fakeCampaign: Campaign = {
      id: '',
      restaurant_id: '',
      name: campaignName,
      channel,
      template_id: selectedTemplate || null,
      audience_id: null,
      scheduled_at: null,
      sent_at: null,
      send_count: 0,
      open_count: 0,
      click_count: 0,
      unsubscribe_count: 0,
      status: 'draft',
      consent_check_passed: consentChecked,
      created_at: '',
    };
    const audienceSize = rules.length > 0 || selectedSegment ? 1 : 0; // Simplified
    return preFlightCheckWithBody(fakeCampaign, audienceSize, resolvedBody);
  }, [campaignName, channel, selectedTemplate, consentChecked, rules, selectedSegment, resolvedBody]);

  function handlePresetSegment(segmentName: string) {
    setSelectedSegment(segmentName);
    const segment = STARTER_SEGMENTS.find((s) => s.name === segmentName);
    if (segment) setRules(segment.rules);
  }

  function addRule() {
    setRules([...rules, { field: 'visit_count', operator: 'gte', value: 1 }]);
  }

  function removeRule(index: number) {
    setRules(rules.filter((_, i) => i !== index));
  }

  function updateRule(index: number, patch: Partial<AudienceRule>) {
    setRules(rules.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  async function handleSend() {
    if (!complianceResult.pass) return;
    setSending(true);
    // In production: call server action to create + send campaign
    await new Promise((r) => setTimeout(r, 1500));
    setSending(false);
    alert('Campaign sent successfully!');
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem' }}>
        Email &amp; SMS Marketing
      </h1>

      {/* Step 1: Audience */}
      <section style={sectionStyle}>
        <h2 style={h2Style}>1. Select Audience</h2>

        <div style={{ marginBottom: '0.75rem' }}>
          <label style={labelStyle}>Preset Segments</label>
          <select
            value={selectedSegment}
            onChange={(e) => handlePresetSegment(e.target.value)}
            style={selectStyle}
          >
            <option value="">Custom rules</option>
            {STARTER_SEGMENTS.map((s) => (
              <option key={s.name} value={s.name}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Rule builder */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {rules.map((rule, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <select
                value={rule.field}
                onChange={(e) => updateRule(i, { field: e.target.value })}
                style={{ ...selectStyle, flex: 1 }}
              >
                {RULE_FIELDS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              <select
                value={rule.operator}
                onChange={(e) => updateRule(i, { operator: e.target.value as AudienceRule['operator'] })}
                style={{ ...selectStyle, width: 90 }}
              >
                {OPERATORS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <input
                type="text"
                value={rule.value}
                onChange={(e) => updateRule(i, { value: e.target.value })}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button onClick={() => removeRule(i)} style={removeButtonStyle}>x</button>
            </div>
          ))}
        </div>

        <button onClick={addRule} style={{ ...btnStyle, marginTop: '0.5rem' }}>
          + Add Rule
        </button>
      </section>

      {/* Step 2: Template */}
      <section style={sectionStyle}>
        <h2 style={h2Style}>2. Choose Template</h2>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
            <input
              type="radio"
              checked={channel === 'email'}
              onChange={() => setChannel('email')}
            />
            Email
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
            <input
              type="radio"
              checked={channel === 'sms'}
              onChange={() => setChannel('sms')}
            />
            SMS
          </label>
        </div>

        <select
          value={selectedTemplate}
          onChange={(e) => {
            setSelectedTemplate(e.target.value);
            const t = STARTER_TEMPLATES.find((t) => t.name === e.target.value);
            if (t) setChannel(t.channel);
          }}
          style={{ ...selectStyle, marginBottom: '0.75rem' }}
        >
          <option value="">Custom template</option>
          {STARTER_TEMPLATES.filter((t) => t.channel === channel).map((t) => (
            <option key={t.name} value={t.name}>{t.name}</option>
          ))}
        </select>

        {!selectedTemplate && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {channel === 'email' && (
              <input
                type="text"
                placeholder="Subject line"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                style={inputStyle}
              />
            )}
            <textarea
              placeholder="Template body (markdown, use {{variable}} for personalization)"
              value={customBody}
              onChange={(e) => setCustomBody(e.target.value)}
              rows={5}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>
        )}
      </section>

      {/* Step 3: Preview */}
      <section style={sectionStyle}>
        <h2 style={h2Style}>3. Preview</h2>
        <div style={previewStyle}>
          {resolvedBody ? (
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.875rem' }}>
              {resolvedBody}
            </pre>
          ) : (
            <p style={{ color: 'var(--text-tertiary)' }}>Select a template or write custom content above</p>
          )}
        </div>
      </section>

      {/* Step 4: Compliance */}
      <section style={sectionStyle}>
        <h2 style={h2Style}>4. Pre-Flight Checks</h2>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={consentChecked}
            onChange={(e) => setConsentChecked(e.target.checked)}
          />
          I confirm all recipients have opted in to receive marketing communications
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {complianceResult.pass ? (
            <div style={{ color: 'var(--success)', fontWeight: 500 }}>
              All checks passed
            </div>
          ) : (
            complianceResult.errors.map((err, i) => (
              <div key={i} style={{ color: 'var(--danger)', fontSize: '0.875rem' }}>
                {err}
              </div>
            ))
          )}
        </div>
      </section>

      {/* Step 5: Send */}
      <section style={sectionStyle}>
        <h2 style={h2Style}>5. Send Campaign</h2>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Campaign name"
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            onClick={handleSend}
            disabled={!complianceResult.pass || sending}
            style={{
              ...sendButtonStyle,
              opacity: complianceResult.pass && !sending ? 1 : 0.4,
              cursor: complianceResult.pass && !sending ? 'pointer' : 'not-allowed',
            }}
          >
            {sending ? 'Sending...' : 'Send Now'}
          </button>
        </div>
      </section>

      {/* Campaign History */}
      <section style={sectionStyle}>
        <h2 style={h2Style}>Campaign History</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Sent</th>
              <th style={thStyle}>Open Rate</th>
              <th style={thStyle}>Date</th>
            </tr>
          </thead>
          <tbody>
            {history.map((row) => (
              <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={tdStyle}>{row.name}</td>
                <td style={tdStyle}>
                  <span style={{ ...statusBadge, background: statusColor(row.status) }}>
                    {row.status}
                  </span>
                </td>
                <td style={tdStyle}>{row.send_count}</td>
                <td style={tdStyle}>
                  {row.send_count > 0 ? `${Math.round((row.open_count / row.send_count) * 100)}%` : '-'}
                </td>
                <td style={tdStyle}>{row.created_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function statusColor(status: Campaign['status']): string {
  switch (status) {
    case 'sent': return 'rgba(48, 209, 88, 0.15)';
    case 'sending': return 'rgba(139, 207, 240, 0.15)';
    case 'scheduled': return 'rgba(255, 184, 119, 0.15)';
    case 'draft': return 'var(--glass-strong)';
    case 'failed': return 'rgba(255, 180, 171, 0.15)';
  }
}

// Styles
const sectionStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '1.25rem',
  marginBottom: '1rem',
};

const h2Style: React.CSSProperties = {
  fontSize: '1rem',
  fontWeight: 600,
  marginBottom: '0.75rem',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: 'var(--text-secondary)',
  marginBottom: '0.25rem',
  display: 'block',
};

const selectStyle: React.CSSProperties = {
  background: 'var(--surface-low)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '0.5rem 0.75rem',
  color: 'var(--text)',
  width: '100%',
};

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-low)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '0.5rem 0.75rem',
  color: 'var(--text)',
  width: '100%',
};

const btnStyle: React.CSSProperties = {
  background: 'var(--glass-strong)',
  border: '1px solid var(--glass-border)',
  borderRadius: 6,
  padding: '0.4rem 0.75rem',
  color: 'var(--text)',
  fontSize: '0.8rem',
};

const removeButtonStyle: React.CSSProperties = {
  background: 'var(--glass-strong)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '0.25rem 0.5rem',
  color: 'var(--danger)',
  fontSize: '0.8rem',
};

const sendButtonStyle: React.CSSProperties = {
  background: 'var(--accent)',
  border: 'none',
  borderRadius: 8,
  padding: '0.6rem 1.5rem',
  color: '#fff',
  fontWeight: 600,
  fontSize: '0.9rem',
};

const previewStyle: React.CSSProperties = {
  background: 'var(--surface-low)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '1rem',
  minHeight: 80,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.5rem',
  color: 'var(--text-secondary)',
  fontWeight: 500,
};

const tdStyle: React.CSSProperties = {
  padding: '0.5rem',
};

const statusBadge: React.CSSProperties = {
  padding: '0.15rem 0.5rem',
  borderRadius: 4,
  fontSize: '0.75rem',
  fontWeight: 500,
};
