import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  getCalendarMonth,
  getAgendaView,
} from '@mylife/subs';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.subs;

export default function SubsCalendarScreen() {
  const db = useDatabase();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const calendarMonth = useMemo(
    () => getCalendarMonth(db, year, month),
    [db, year, month],
  );

  const agenda = useMemo(
    () => getAgendaView(db, 30),
    [db],
  );

  const handlePrevMonth = () => {
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else setMonth(month - 1);
  };

  const handleNextMonth = () => {
    if (month === 12) { setMonth(1); setYear(year + 1); }
    else setMonth(month + 1);
  };

  const monthName = new Date(year, month - 1).toLocaleString(undefined, { month: 'long', year: 'numeric' });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Month navigator */}
      <View style={styles.navRow}>
        <Pressable onPress={handlePrevMonth}>
          <Text variant="body" color={ACCENT}>{'< Prev'}</Text>
        </Pressable>
        <Text variant="subheading">{monthName}</Text>
        <Pressable onPress={handleNextMonth}>
          <Text variant="body" color={ACCENT}>{'Next >'}</Text>
        </Pressable>
      </View>

      {/* Month summary */}
      <Card>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: ACCENT }]}>
              ${(calendarMonth.totalCents / 100).toFixed(0)}
            </Text>
            <Text variant="caption" color={colors.textSecondary}>This Month</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: ACCENT }]}>{calendarMonth.renewalCount}</Text>
            <Text variant="caption" color={colors.textSecondary}>Renewals</Text>
          </View>
        </View>
      </Card>

      {/* Calendar days with renewals */}
      <Card>
        <Text variant="subheading">Renewal Days</Text>
        <View style={styles.list}>
          {calendarMonth.days.filter((d) => d.renewals.length > 0).map((day) => (
            <View key={day.date} style={styles.dayRow}>
              <Text variant="body" style={styles.dayLabel}>{day.date.slice(8)}</Text>
              <View style={styles.dayRenewals}>
                {day.renewals.map((r, i) => (
                  <View key={i} style={styles.renewalChip}>
                    <View style={[styles.dot, { backgroundColor: r.categoryColor ?? ACCENT }]} />
                    <Text variant="caption" color={colors.textSecondary}>
                      {r.subscriptionName} ${(r.amountCents / 100).toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
          {calendarMonth.days.filter((d) => d.renewals.length > 0).length === 0 && (
            <Text variant="caption" color={colors.textSecondary}>
              No renewals this month.
            </Text>
          )}
        </View>
      </Card>

      {/* Agenda view -- upcoming 30 days */}
      <Card>
        <Text variant="subheading">Upcoming 30 Days</Text>
        <View style={styles.list}>
          {agenda.length === 0 ? (
            <Text variant="caption" color={colors.textSecondary}>No upcoming renewals.</Text>
          ) : (
            agenda.filter((d) => d.renewals.length > 0).map((day) => (
              <View key={day.date} style={styles.agendaRow}>
                <Text variant="body" style={styles.agendaDate}>{day.date}</Text>
                <View style={{ flex: 1, gap: 2 }}>
                  {day.renewals.map((r, i) => (
                    <Text key={i} variant="caption" color={colors.textSecondary}>
                      {r.subscriptionName} ${(r.amountCents / 100).toFixed(2)}
                    </Text>
                  ))}
                </View>
                <Text variant="body" color={ACCENT}>
                  ${(day.totalCents / 100).toFixed(2)}
                </Text>
              </View>
            ))
          )}
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  navRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  statsGrid: { flexDirection: 'row', gap: spacing.sm },
  statCard: {
    flex: 1, padding: spacing.sm, borderRadius: 12, alignItems: 'center',
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border, gap: 2,
  },
  statValue: { fontSize: 20, fontWeight: '700' },
  list: { gap: spacing.sm, marginTop: spacing.sm },
  dayRow: {
    flexDirection: 'row', gap: spacing.sm,
    padding: spacing.sm, borderRadius: 10,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
  },
  dayLabel: { width: 28, fontWeight: '700' },
  dayRenewals: { flex: 1, gap: 4 },
  renewalChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
  agendaRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.sm, borderRadius: 10,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
  },
  agendaDate: { width: 80 },
  agendaName: { flex: 1 },
});
