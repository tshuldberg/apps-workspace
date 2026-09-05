import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, surfaceTiers } from '@mylife/ui';
import {
  checkExpiry,
  getTotalMiles,
  getTotalPoints,
  listDocuments,
  listLoyaltyPrograms,
  type DocumentRow,
  type DocumentType,
  type ExpiryItem,
  type ExpiryUrgency,
  type LoyaltyProgramRow,
} from '@mylife/travel';
import { useDatabase } from '../../components/DatabaseProvider';
import { TRAVEL_ACCENT } from './_ui';
import { DocAddForm } from './_components/logistics-doc-form';
import { LoyaltyAddForm } from './_components/logistics-loyalty-form';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

interface LogisticsData {
  expiryItems: ExpiryItem[];
  passports: DocumentRow[];
  visas: DocumentRow[];
  other: DocumentRow[];
  loyalty: LoyaltyProgramRow[];
  totalHotelPoints: number;
  totalAirlineMiles: number;
}

const DOC_SECTIONS: Array<{ label: string; types: DocumentType[] }> = [
  { label: 'Passports', types: ['passport'] },
  { label: 'Visas', types: ['visa'] },
  { label: 'Insurance, memberships, other', types: ['insurance', 'membership', 'vaccination', 'other'] },
];

export default function TravelLogisticsScreen() {
  const db = useDatabase();
  const [status, setStatus] = useState<LoadState>('idle');
  const [data, setData] = useState<LogisticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [docFormOpen, setDocFormOpen] = useState(false);
  const [loyaltyFormOpen, setLoyaltyFormOpen] = useState(false);

  const load = useCallback(() => {
    setStatus('loading');
    try {
      const report = checkExpiry(db, { windowDays: 90 });
      const expiryItems: ExpiryItem[] = [
        ...report.expired,
        ...report.critical,
        ...report.warning,
        ...report.ok,
      ];
      const allDocs = listDocuments(db);
      const passports = allDocs.filter((d) => d.type === 'passport');
      const visas = allDocs.filter((d) => d.type === 'visa');
      const other = allDocs.filter((d) => !['passport', 'visa'].includes(d.type));
      const loyalty = listLoyaltyPrograms(db);
      setData({
        expiryItems,
        passports,
        visas,
        other,
        loyalty,
        totalHotelPoints: getTotalPoints(db, 'hotel'),
        totalAirlineMiles: getTotalMiles(db, 'airline'),
      });
      setError(null);
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load logistics');
      setStatus('error');
    }
  }, [db]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Logistics</Text>
        <Text style={styles.title}>Documents and loyalty</Text>
        <Text style={styles.subtitle}>
          Track expiry dates, store program numbers, and keep every travel detail in one place.
        </Text>
      </View>

      {status === 'loading' ? (
        <View style={styles.panel}>
          <ActivityIndicator color={TRAVEL_ACCENT} />
          <Text style={styles.muted}>Loading logistics...</Text>
        </View>
      ) : null}

      {status === 'error' ? (
        <View style={[styles.panel, styles.errorPanel]}>
          <Text style={styles.errorText}>{error ?? 'Something went wrong.'}</Text>
          <Pressable style={styles.retryButton} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {status === 'ready' && data ? (
        <>
          <ExpiryPanel items={data.expiryItems} />

          <LoyaltyTotals
            hotelPoints={data.totalHotelPoints}
            airlineMiles={data.totalAirlineMiles}
          />

          {DOC_SECTIONS.map((section) => {
            const rows = data.passports
              .concat(data.visas, data.other)
              .filter((r) => section.types.includes(r.type));
            return (
              <DocSection
                key={section.label}
                label={section.label}
                rows={rows}
              />
            );
          })}

          <LoyaltySection rows={data.loyalty} />

          <View style={styles.ctaRow}>
            <Pressable
              style={styles.primaryCta}
              onPress={() => setDocFormOpen(true)}
            >
              <Text style={styles.primaryCtaText}>+ Add document</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryCta}
              onPress={() => setLoyaltyFormOpen(true)}
            >
              <Text style={styles.secondaryCtaText}>+ Add loyalty program</Text>
            </Pressable>
          </View>
        </>
      ) : null}

      <DocAddForm
        visible={docFormOpen}
        onClose={() => setDocFormOpen(false)}
        onCreated={() => {
          setDocFormOpen(false);
          load();
        }}
      />
      <LoyaltyAddForm
        visible={loyaltyFormOpen}
        onClose={() => setLoyaltyFormOpen(false)}
        onCreated={() => {
          setLoyaltyFormOpen(false);
          load();
        }}
      />
    </ScrollView>
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
      return colors.textSecondary;
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
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Expiry radar</Text>
        <Text style={styles.muted}>
          Nothing expiring soon. Add a document or loyalty program with an expiry date to monitor it here.
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.panel}>
      <Text style={styles.sectionTitle}>Expiry radar</Text>
      <Text style={styles.mutedSmall}>
        Window: next 90 days. Ordered by urgency.
      </Text>
      <View style={styles.list}>
        {items.map((item) => (
          <View key={`${item.source}:${item.id}`} style={styles.row}>
            <View style={styles.rowMain}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.name_or_provider}
              </Text>
              <Text style={styles.rowSub}>
                {item.source === 'document' ? 'Document' : 'Loyalty'} · {item.type} · expires {item.expiry_date}
              </Text>
            </View>
            <View
              style={[
                styles.badge,
                { borderColor: urgencyColor(item.urgency) },
              ]}
            >
              <Text style={[styles.badgeText, { color: urgencyColor(item.urgency) }]}>
                {urgencyLabel(item.urgency)} · {item.days_until_expiry}d
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Doc section ───────────────────────────────────────────────────────

function DocSection({ label, rows }: { label: string; rows: DocumentRow[] }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.sectionTitle}>{label}</Text>
      {rows.length === 0 ? (
        <Text style={styles.muted}>No documents in this group yet.</Text>
      ) : (
        <View style={styles.list}>
          {rows.map((row) => (
            <View key={row.id} style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {row.name}
                </Text>
                <Text style={styles.rowSub}>
                  {row.type}
                  {row.country ? ` · ${row.country}` : ''}
                  {row.expiry_date ? ` · expires ${row.expiry_date}` : ''}
                  {row.renewal_reminder_days
                    ? ` · remind ${row.renewal_reminder_days}d out`
                    : ''}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Loyalty ───────────────────────────────────────────────────────────

function LoyaltyTotals({
  hotelPoints,
  airlineMiles,
}: {
  hotelPoints: number;
  airlineMiles: number;
}) {
  return (
    <View style={styles.totalsRow}>
      <View style={[styles.totalsCard, styles.totalsCardLeft]}>
        <Text style={styles.totalsLabel}>Hotel points</Text>
        <Text style={styles.totalsValue}>{hotelPoints.toLocaleString()}</Text>
      </View>
      <View style={styles.totalsCard}>
        <Text style={styles.totalsLabel}>Airline miles</Text>
        <Text style={styles.totalsValue}>{airlineMiles.toLocaleString()}</Text>
      </View>
    </View>
  );
}

function LoyaltySection({ rows }: { rows: LoyaltyProgramRow[] }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.sectionTitle}>Loyalty programs</Text>
      {rows.length === 0 ? (
        <Text style={styles.muted}>
          No loyalty programs yet. Add your airline, hotel, and car rental programs to track balances.
        </Text>
      ) : (
        <View style={styles.list}>
          {rows.map((row) => {
            const balance =
              row.type === 'airline'
                ? `${row.miles_balance.toLocaleString()} miles`
                : `${row.points_balance.toLocaleString()} points`;
            return (
              <View key={row.id} style={styles.row}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {row.provider}
                  </Text>
                  <Text style={styles.rowSub}>
                    {row.type}
                    {row.status_tier ? ` · ${row.status_tier}` : ''}
                    {row.member_number ? ` · ${row.member_number}` : ''}
                  </Text>
                </View>
                <Text style={styles.rowValue}>{balance}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: surfaceTiers.lowest,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 160,
    gap: 14,
  },
  hero: {
    gap: 8,
    padding: 20,
    borderRadius: 24,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: {
    color: TRAVEL_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  panel: {
    gap: 10,
    padding: 18,
    borderRadius: 20,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  errorPanel: {
    borderColor: '#93000A',
    backgroundColor: 'rgba(147,0,10,0.12)',
  },
  errorText: {
    color: '#FFB4AB',
    fontSize: 14,
    lineHeight: 20,
  },
  retryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: surfaceTiers.container,
  },
  retryText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  muted: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  mutedSmall: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  list: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowMain: {
    flex: 1,
    gap: 3,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  rowSub: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  rowValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  totalsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  totalsCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  totalsCardLeft: {
    backgroundColor: 'rgba(14,165,233,0.10)',
    borderColor: 'rgba(14,165,233,0.28)',
  },
  totalsLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  totalsValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  primaryCta: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: TRAVEL_ACCENT,
  },
  primaryCtaText: {
    color: '#0E0E13',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryCta: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryCtaText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
});
