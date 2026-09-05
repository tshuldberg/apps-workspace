'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { fetchSetting, doSetSetting, fetchProperties } from '../actions';
import type { Property } from '@mylife/homes';

const ACCENT = 'var(--accent-homes)';
const GLASS_CARD: CSSProperties = {
  background: 'var(--glass)', border: '1px solid var(--border)',
  borderRadius: 16, padding: 16,
};

export default function SettingsPage() {
  const [notifications, setNotifications] = useState(true);
  const [defaultOffers, setDefaultOffers] = useState(true);
  const [insuranceRenewals, setInsuranceRenewals] = useState(true);
  const [costAlerts, setCostAlerts] = useState(false);
  const [defaultPropertyId, setDefaultPropertyId] = useState('');
  const [defaultCurrency, setDefaultCurrency] = useState('USD');
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [notif, notifLegacy, offers, offersLegacy, renewals, alerts, currency, propId, props] = await Promise.all([
        fetchSetting('reminders_enabled'),
        fetchSetting('reminderNotificationsEnabled'),
        fetchSetting('offer_default_schedules'),
        fetchSetting('defaultRemindersOffered'),
        fetchSetting('insurance_renewal_alerts'),
        fetchSetting('cost_alerts'),
        fetchSetting('default_currency'),
        fetchSetting('default_property_id'),
        fetchProperties(),
      ]);
      setNotifications((notif ?? notifLegacy ?? 'true') !== 'false');
      setDefaultOffers((offers ?? offersLegacy ?? 'true') !== 'false');
      setInsuranceRenewals((renewals ?? 'true') !== 'false');
      setCostAlerts((alerts ?? 'false') === 'true');
      setDefaultCurrency(currency ?? 'USD');
      setDefaultPropertyId(propId ?? '');
      setProperties(props);
    } catch { /* use defaults */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggle = async (keys: string[], current: boolean, setter: (v: boolean) => void) => {
    const next = !current;
    setter(next);
    try {
      await Promise.all(keys.map((key) => doSetSetting(key, String(next))));
    } catch {
      setter(current);
    }
  };

  const setDefaultProp = async (value: string) => {
    setDefaultPropertyId(value);
    try { await doSetSetting('default_property_id', value); } catch { /* */ }
  };

  const setCurrency = async (value: string) => {
    setDefaultCurrency(value);
    try { await doSetSetting('default_currency', value); } catch { /* */ }
  };

  if (loading) {
    return <div style={{ display: 'grid', gap: 16 }}>
      {[1, 2, 3].map((i) => <div key={i} style={{ ...GLASS_CARD, height: 56, opacity: 0.5 }} />)}
    </div>;
  }

  const toggleStyle: CSSProperties = {
    width: 48, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
    position: 'relative', transition: 'background 200ms',
  };
  const knobStyle = (on: boolean): CSSProperties => ({
    width: 22, height: 22, borderRadius: 11, background: '#fff',
    position: 'absolute', top: 3, left: on ? 23 : 3, transition: 'left 200ms',
  });

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 760 }}>
      <div
        style={{
          ...GLASS_CARD,
          background: 'rgba(245,158,11,0.11)',
          borderColor: 'rgba(245,158,11,0.22)',
          display: 'grid',
          gap: 8,
        }}
      >
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
          MyHomes Control Center
        </p>
        <h2 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Settings</h2>
        <p style={{ margin: 0, color: 'var(--text-secondary)', maxWidth: 560 }}>
          Tune reminder behavior, default property context, export preferences, and the operational surfaces that keep the homes module predictable.
        </p>
      </div>

      <div style={{ ...GLASS_CARD, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ margin: 0, fontWeight: 500 }}>Reminder Notifications</p>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
            Get notified when maintenance tasks are due
          </p>
        </div>
        <button type="button" onClick={() => void toggle(['reminders_enabled', 'reminderNotificationsEnabled'], notifications, setNotifications)}
          style={{ ...toggleStyle, background: notifications ? ACCENT : 'var(--glass-strong)' }}>
          <div style={knobStyle(notifications)} />
        </button>
      </div>

      <div style={{ ...GLASS_CARD, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ margin: 0, fontWeight: 500 }}>Default Reminders</p>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
            Auto-create maintenance schedules for new properties
          </p>
        </div>
        <button type="button" onClick={() => void toggle(['offer_default_schedules', 'defaultRemindersOffered'], defaultOffers, setDefaultOffers)}
          style={{ ...toggleStyle, background: defaultOffers ? ACCENT : 'var(--glass-strong)' }}>
          <div style={knobStyle(defaultOffers)} />
        </button>
      </div>

      <div style={{ ...GLASS_CARD, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ margin: 0, fontWeight: 500 }}>Insurance Renewal Alerts</p>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
            Surface policy renewals before coverage lapses
          </p>
        </div>
        <button type="button" onClick={() => void toggle(['insurance_renewal_alerts'], insuranceRenewals, setInsuranceRenewals)}
          style={{ ...toggleStyle, background: insuranceRenewals ? ACCENT : 'var(--glass-strong)' }}>
          <div style={knobStyle(insuranceRenewals)} />
        </button>
      </div>

      <div style={{ ...GLASS_CARD, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ margin: 0, fontWeight: 500 }}>Cost Alerts</p>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
            Highlight unusual spend and recurring home costs
          </p>
        </div>
        <button type="button" onClick={() => void toggle(['cost_alerts'], costAlerts, setCostAlerts)}
          style={{ ...toggleStyle, background: costAlerts ? ACCENT : 'var(--glass-strong)' }}>
          <div style={knobStyle(costAlerts)} />
        </button>
      </div>

      {properties.length > 0 && (
        <div style={GLASS_CARD}>
          <p style={{ margin: '0 0 8px', fontWeight: 500 }}>Default Property</p>
          <select value={defaultPropertyId} onChange={(e) => void setDefaultProp(e.target.value)}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '10px 12px', color: 'var(--text)', width: '100%', fontSize: 14,
            }}>
            <option value="">None</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}

      <div style={GLASS_CARD}>
        <p style={{ margin: '0 0 8px', fontWeight: 500 }}>Default Currency</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['USD', 'EUR', 'GBP', 'CAD'].map((currency) => {
            const active = defaultCurrency === currency;
            return (
              <button
                key={currency}
                type="button"
                onClick={() => void setCurrency(currency)}
                style={{
                  background: active ? ACCENT : 'var(--glass-strong)',
                  color: active ? 'var(--background)' : 'var(--text-secondary)',
                  border: active ? '1px solid rgba(245,158,11,0.28)' : '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 999,
                  padding: '8px 14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {currency}
              </button>
            );
          })}
        </div>
      </div>

      <div style={GLASS_CARD}>
        <p style={{ margin: '0 0 8px', fontWeight: 500 }}>Export</p>
        <div style={{ display: 'grid', gap: 8 }}>
          {['Export all MyHomes data as CSV', 'Export inventory CSV', 'Export cost ledger JSON'].map((label) => (
            <button
              key={label}
              type="button"
              style={{
                background: 'rgba(245,158,11,0.10)',
                color: ACCENT,
                border: '1px solid rgba(245,158,11,0.18)',
                borderRadius: 12,
                padding: '10px 14px',
                textAlign: 'left',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ ...GLASS_CARD, borderColor: 'rgba(255,69,58,0.24)' }}>
        <p style={{ margin: '0 0 8px', fontWeight: 500, color: 'var(--danger)' }}>Danger Zone</p>
        <button
          type="button"
          style={{
            background: 'rgba(255,69,58,0.12)',
            color: 'var(--danger)',
            border: '1px solid rgba(255,69,58,0.24)',
            borderRadius: 12,
            padding: '10px 14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Delete all MyHomes data
        </button>
      </div>
    </div>
  );
}
