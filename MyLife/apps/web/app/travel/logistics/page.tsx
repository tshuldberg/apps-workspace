import type { CSSProperties } from 'react';
import {
  checkExpiry,
  getTotalMiles,
  getTotalPoints,
  listDocuments,
  listLoyaltyPrograms,
  type DocumentRow,
  type ExpiryItem,
  type ExpiryUrgency,
  type LoyaltyProgramRow,
} from '@mylife/travel';
import { ensureModuleMigrations, getAdapter } from '@/lib/db';
import { TravelBulletList, TravelPanel } from '../_ui';
import { DocForm } from './DocForm';
import { LoyaltyForm } from './LoyaltyForm';

export const dynamic = 'force-dynamic';

interface LogisticsViewData {
  expiry: ExpiryItem[];
  passports: DocumentRow[];
  visas: DocumentRow[];
  other: DocumentRow[];
  loyalty: LoyaltyProgramRow[];
  totalHotelPoints: number;
  totalAirlineMiles: number;
}

function loadLogistics(): LogisticsViewData | { error: string } {
  try {
    ensureModuleMigrations('travel');
    const db = getAdapter();
    const report = checkExpiry(db, { windowDays: 90 });
    const allDocs = listDocuments(db);
    return {
      expiry: [
        ...report.expired,
        ...report.critical,
        ...report.warning,
        ...report.ok,
      ],
      passports: allDocs.filter((d) => d.type === 'passport'),
      visas: allDocs.filter((d) => d.type === 'visa'),
      other: allDocs.filter((d) => !['passport', 'visa'].includes(d.type)),
      loyalty: listLoyaltyPrograms(db),
      totalHotelPoints: getTotalPoints(db, 'hotel'),
      totalAirlineMiles: getTotalMiles(db, 'airline'),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to load logistics' };
  }
}

export default function TravelLogisticsPage() {
  const result = loadLogistics();

  if ('error' in result) {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        <TravelPanel
          eyebrow="Logistics"
          title="Could not load logistics"
          body={result.error}
        >
          <TravelBulletList
            items={[
              'Try refreshing the page to retry the query.',
              'If the error persists, check that the travel module is enabled.',
            ]}
          />
        </TravelPanel>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <TravelPanel
        eyebrow="Logistics"
        title="Documents and loyalty"
        body="Track expiry dates, store program numbers, and keep every travel detail in one place."
      />

      <ExpiryPanel items={result.expiry} />

      <div style={styles.totalsRow}>
        <div style={{ ...styles.totalsCard, ...styles.totalsCardLeft }}>
          <span style={styles.totalsLabel}>Hotel points</span>
          <span style={styles.totalsValue}>
            {result.totalHotelPoints.toLocaleString()}
          </span>
        </div>
        <div style={styles.totalsCard}>
          <span style={styles.totalsLabel}>Airline miles</span>
          <span style={styles.totalsValue}>
            {result.totalAirlineMiles.toLocaleString()}
          </span>
        </div>
      </div>

      <DocSection label="Passports" rows={result.passports} />
      <DocSection label="Visas" rows={result.visas} />
      <DocSection
        label="Insurance, memberships, other"
        rows={result.other}
      />
      <LoyaltySection rows={result.loyalty} />

      <DocForm />
      <LoyaltyForm />
    </div>
  );
}

// ── Expiry panel ──────────────────────────────────────────────────────

function urgencyColor(urgency: ExpiryUrgency): string {
  switch (urgency) {
    case 'expired':
      return '#93000A';
    case 'critical':
      return '#FFB4AB';
    case 'warning':
      return '#C9894D';
    case 'ok':
    default:
      return '#9F8E81';
  }
}

function urgencyLabel(urgency: ExpiryUrgency): string {
  switch (urgency) {
    case 'expired':
      return 'Expired';
    case 'critical':
      return 'Critical';
    case 'warning':
      return 'Warning';
    case 'ok':
    default:
      return 'OK';
  }
}

function ExpiryPanel({ items }: { items: ExpiryItem[] }) {
  if (items.length === 0) {
    return (
      <section style={styles.panel}>
        <h3 style={styles.sectionTitle}>Expiry radar</h3>
        <p style={styles.muted}>
          Nothing expiring soon. Add a document or loyalty program with an expiry date to monitor it here.
        </p>
      </section>
    );
  }
  return (
    <section style={styles.panel}>
      <h3 style={styles.sectionTitle}>Expiry radar</h3>
      <p style={styles.mutedSmall}>Window: next 90 days. Ordered by urgency.</p>
      <ul style={styles.list}>
        {items.map((item) => (
          <li key={`${item.source}:${item.id}`} style={styles.row}>
            <div style={styles.rowMain}>
              <span style={styles.rowTitle}>{item.name_or_provider}</span>
              <span style={styles.rowSub}>
                {item.source === 'document' ? 'Document' : 'Loyalty'} ·{' '}
                {item.type} · expires {item.expiry_date}
              </span>
            </div>
            <span
              style={{
                ...styles.badge,
                borderColor: urgencyColor(item.urgency),
                color: urgencyColor(item.urgency),
              }}
            >
              {urgencyLabel(item.urgency)} · {item.days_until_expiry}d
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Doc section ───────────────────────────────────────────────────────

function DocSection({ label, rows }: { label: string; rows: DocumentRow[] }) {
  return (
    <section style={styles.panel}>
      <h3 style={styles.sectionTitle}>{label}</h3>
      {rows.length === 0 ? (
        <p style={styles.muted}>No documents in this group yet.</p>
      ) : (
        <ul style={styles.list}>
          {rows.map((row) => (
            <li key={row.id} style={styles.row}>
              <div style={styles.rowMain}>
                <span style={styles.rowTitle}>{row.name}</span>
                <span style={styles.rowSub}>
                  {row.type}
                  {row.country ? ` · ${row.country}` : ''}
                  {row.expiry_date ? ` · expires ${row.expiry_date}` : ''}
                  {row.renewal_reminder_days
                    ? ` · remind ${row.renewal_reminder_days}d out`
                    : ''}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Loyalty ───────────────────────────────────────────────────────────

function LoyaltySection({ rows }: { rows: LoyaltyProgramRow[] }) {
  return (
    <section style={styles.panel}>
      <h3 style={styles.sectionTitle}>Loyalty programs</h3>
      {rows.length === 0 ? (
        <p style={styles.muted}>
          No loyalty programs yet. Add your airline, hotel, and car rental programs to track balances.
        </p>
      ) : (
        <ul style={styles.list}>
          {rows.map((row) => {
            const balance =
              row.type === 'airline'
                ? `${row.miles_balance.toLocaleString()} miles`
                : `${row.points_balance.toLocaleString()} points`;
            return (
              <li key={row.id} style={styles.row}>
                <div style={styles.rowMain}>
                  <span style={styles.rowTitle}>{row.provider}</span>
                  <span style={styles.rowSub}>
                    {row.type}
                    {row.status_tier ? ` · ${row.status_tier}` : ''}
                    {row.member_number ? ` · ${row.member_number}` : ''}
                  </span>
                </div>
                <span style={styles.rowValue}>{balance}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ── Styles ────────────────────────────────────────────────────────────

const styles: Record<string, CSSProperties> = {
  panel: {
    display: 'grid',
    gap: 10,
    padding: 18,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
  },
  sectionTitle: {
    margin: 0,
    fontSize: 16,
    color: 'var(--text)',
  },
  muted: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.5,
    color: 'var(--text-secondary)',
  },
  mutedSmall: {
    margin: 0,
    fontSize: 12,
    color: 'var(--text-secondary)',
  },
  list: {
    margin: 0,
    padding: 0,
    listStyle: 'none',
    display: 'grid',
    gap: 8,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 0',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  rowMain: {
    flex: 1,
    display: 'grid',
    gap: 2,
  },
  rowTitle: {
    color: 'var(--text)',
    fontSize: 14,
    fontWeight: 600,
  },
  rowSub: {
    color: 'var(--text-secondary)',
    fontSize: 12,
  },
  rowValue: {
    color: 'var(--text)',
    fontSize: 13,
    fontWeight: 700,
  },
  badge: {
    padding: '4px 10px',
    borderRadius: 999,
    border: '1px solid',
    fontSize: 11,
    fontWeight: 700,
  },
  totalsRow: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
  },
  totalsCard: {
    flex: 1,
    minWidth: 160,
    padding: 16,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
    display: 'grid',
    gap: 4,
  },
  totalsCardLeft: {
    background: 'rgba(14,165,233,0.10)',
    border: '1px solid rgba(14,165,233,0.28)',
  },
  totalsLabel: {
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  totalsValue: {
    color: 'var(--text)',
    fontSize: 22,
    fontWeight: 800,
  },
};
