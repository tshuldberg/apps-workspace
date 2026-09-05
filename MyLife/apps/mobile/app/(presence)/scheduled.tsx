import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import {
  APP_LIBRARY,
  GlassPanel,
  MaterialSymbol,
  PR_ACCENT_LIGHT,
  PR_FONTS,
  PR_SURFACES,
  PR_TEXT,
  PR_TEXT_SECONDARY,
  PR_TYPOGRAPHY,
  createScheduledSession,
  deleteScheduledSession,
  formatScreenTime,
  getScheduledSessions,
  listUpcomingScheduled,
  toggleScheduledSession,
  updateScheduledSession,
  type ScheduledSession,
  type SessionType,
} from '@mylife/presence';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  PresenceBottomSheet,
  PresenceChip,
  PresenceEmptyState,
  PresenceHero,
  PresenceMetricPill,
  PresencePillButton,
  PresenceRow,
  PresenceScrollScreen,
  PresenceSectionHeader,
  presenceScreenKitStyles,
} from './_screen-kit';

const DURATION_OPTIONS = [15, 30, 45, 60, 90];
const SESSION_TYPES: SessionType[] = ['solo', 'group', 'beast'];
const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

function formatWeekdays(days: number[]): string {
  if (days.length === 7) return 'Every day';
  return WEEKDAY_OPTIONS.filter((day) => days.includes(day.value)).map((day) => day.label).join(' · ');
}

function formatUpcoming(date: Date): string {
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

type FormState = {
  id: string | null;
  name: string;
  startTime: string;
  durationMinutes: number;
  daysOfWeek: number[];
  sessionType: SessionType;
  whitelist: string[];
  active: boolean;
};

const EMPTY_FORM: FormState = {
  id: null,
  name: '',
  startTime: '08:00',
  durationMinutes: 30,
  daysOfWeek: [1, 2, 3, 4, 5],
  sessionType: 'solo',
  whitelist: [],
  active: true,
};

export default function ScheduledSessionsScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const refresh = useCallback(() => setTick((value) => value + 1), []);

  const scheduledSessions = useMemo(() => getScheduledSessions(db), [db, tick]);
  const upcoming = useMemo(
    () => listUpcomingScheduled(scheduledSessions.filter((item) => item.active), 14),
    [scheduledSessions],
  );

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setSheetVisible(true);
  };

  const openEdit = (session: ScheduledSession) => {
    setForm({
      id: session.id,
      name: session.name,
      startTime: session.startTime,
      durationMinutes: session.durationMinutes,
      daysOfWeek: session.daysOfWeek,
      sessionType: session.sessionType,
      whitelist: session.whitelist,
      active: session.active,
    });
    setSheetVisible(true);
  };

  const closeSheet = () => {
    setSheetVisible(false);
    setForm(EMPTY_FORM);
  };

  const handleSave = () => {
    if (form.name.trim().length === 0) {
      Alert.alert('Missing name', 'Name the scheduled session before saving.');
      return;
    }
    if (form.daysOfWeek.length === 0) {
      Alert.alert('Pick a day', 'Select at least one day of the week.');
      return;
    }

    try {
      if (form.id == null) {
        createScheduledSession(db, {
          name: form.name,
          startTime: form.startTime,
          durationMinutes: form.durationMinutes,
          daysOfWeek: form.daysOfWeek,
          sessionType: form.sessionType,
          whitelist: form.whitelist,
          active: form.active,
        });
      } else {
        updateScheduledSession(db, form.id, {
          name: form.name,
          startTime: form.startTime,
          durationMinutes: form.durationMinutes,
          daysOfWeek: form.daysOfWeek,
          sessionType: form.sessionType,
          whitelist: form.whitelist,
          active: form.active,
        });
      }
      closeSheet();
      refresh();
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Could not save the scheduled session.');
    }
  };

  return (
    <>
      <PresenceScrollScreen>
        <PresenceHero
          eyebrow="Recurring focus"
          title="Scheduled Sessions"
          subtitle="Plan your repeatable focus windows now, then let Presence show what is up next."
          action={<PresencePillButton label="Add" icon="add" onPress={openCreate} />}
        />

        <GlassPanel padding={18} style={styles.upNextCard}>
          <PresenceSectionHeader title="Up Next" />
          {upcoming.length === 0 ? (
            <Text style={styles.helperText}>No active scheduled sessions yet. Add one to preview the next run window.</Text>
          ) : (
            <View style={presenceScreenKitStyles.stack}>
              <View style={styles.upNextHero}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={styles.upNextTitle}>{upcoming[0].scheduled.name}</Text>
                  <Text style={styles.helperText}>{formatUpcoming(upcoming[0].datetime)}</Text>
                </View>
                <PresenceMetricPill label="Duration" value={formatScreenTime(upcoming[0].scheduled.durationMinutes)} />
              </View>
              {upcoming.slice(1, 3).map((entry) => (
                <PresenceRow
                  key={`${entry.scheduled.id}-${entry.datetime.toISOString()}`}
                  icon="schedule"
                  title={entry.scheduled.name}
                  subtitle={`${formatUpcoming(entry.datetime)} · ${formatWeekdays(entry.scheduled.daysOfWeek)}`}
                />
              ))}
            </View>
          )}
        </GlassPanel>

        <PresenceSectionHeader
          title="All schedules"
          action={<PresenceMetricPill label="Active" value={String(scheduledSessions.filter((item) => item.active).length)} />}
        />

        {scheduledSessions.length === 0 ? (
          <PresenceEmptyState
            icon="repeat"
            title="Nothing scheduled yet"
            body="Create recurring solo, group, or beast sessions for the hours where you want Presence to step in automatically."
          />
        ) : (
          <View style={presenceScreenKitStyles.stack}>
            {scheduledSessions.map((session) => (
              <PresenceRow
                key={session.id}
                icon="schedule"
                title={session.name}
                subtitle={`${session.startTime} · ${formatWeekdays(session.daysOfWeek)} · ${formatScreenTime(session.durationMinutes)}`}
                onPress={() => openEdit(session)}
                right={(
                  <View style={styles.rowRight}>
                    <Switch
                      value={session.active}
                      onValueChange={(value) => {
                        try {
                          toggleScheduledSession(db, session.id, value);
                          refresh();
                        } catch {
                          Alert.alert('Update failed', 'Could not change the scheduled session state.');
                        }
                      }}
                      trackColor={{ false: PR_SURFACES.high, true: `${PR_ACCENT_LIGHT}66` }}
                      thumbColor={session.active ? PR_ACCENT_LIGHT : '#ffffff'}
                    />
                    <Pressable
                      onPress={() => {
                        Alert.alert('Delete schedule', `Remove "${session.name}"?`, [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: () => {
                              try {
                                deleteScheduledSession(db, session.id);
                                refresh();
                              } catch {
                                Alert.alert('Delete failed', 'Could not delete the scheduled session.');
                              }
                            },
                          },
                        ]);
                      }}
                    >
                      <MaterialSymbol name="delete_forever" size={18} color={PR_TEXT_SECONDARY} />
                    </Pressable>
                  </View>
                )}
              />
            ))}
          </View>
        )}
      </PresenceScrollScreen>

      <PresenceBottomSheet visible={sheetVisible} onClose={closeSheet}>
        <Text style={styles.sheetTitle}>{form.id == null ? 'New schedule' : 'Edit schedule'}</Text>

        <View>
          <Text style={presenceScreenKitStyles.fieldLabel}>Session name</Text>
          <TextInput
            value={form.name}
            onChangeText={(value) => setForm((current) => ({ ...current, name: value }))}
            placeholder="Morning reset"
            placeholderTextColor={PR_TEXT_SECONDARY}
            style={presenceScreenKitStyles.input}
          />
        </View>

        <View style={styles.timeRow}>
          <View style={{ flex: 1 }}>
            <Text style={presenceScreenKitStyles.fieldLabel}>Start time</Text>
            <TextInput
              value={form.startTime}
              onChangeText={(value) => setForm((current) => ({ ...current, startTime: value }))}
              placeholder="08:00"
              placeholderTextColor={PR_TEXT_SECONDARY}
              style={presenceScreenKitStyles.input}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={presenceScreenKitStyles.fieldLabel}>Duration</Text>
            <View style={styles.chipWrap}>
              {DURATION_OPTIONS.map((minutes) => (
                <PresenceChip
                  key={minutes}
                  label={`${minutes}m`}
                  selected={form.durationMinutes === minutes}
                  onPress={() => setForm((current) => ({ ...current, durationMinutes: minutes }))}
                />
              ))}
            </View>
          </View>
        </View>

        <View>
          <Text style={presenceScreenKitStyles.fieldLabel}>Days</Text>
          <View style={styles.chipWrap}>
            {WEEKDAY_OPTIONS.map((day) => (
              <PresenceChip
                key={day.label}
                label={day.label}
                selected={form.daysOfWeek.includes(day.value)}
                onPress={() => {
                  setForm((current) => ({
                    ...current,
                    daysOfWeek: current.daysOfWeek.includes(day.value)
                      ? current.daysOfWeek.filter((value) => value !== day.value)
                      : [...current.daysOfWeek, day.value],
                  }));
                }}
              />
            ))}
          </View>
        </View>

        <View>
          <Text style={presenceScreenKitStyles.fieldLabel}>Session type</Text>
          <View style={styles.chipWrap}>
            {SESSION_TYPES.map((type) => (
              <PresenceChip
                key={type}
                label={type}
                selected={form.sessionType === type}
                onPress={() => setForm((current) => ({ ...current, sessionType: type }))}
              />
            ))}
          </View>
        </View>

        <View>
          <Text style={presenceScreenKitStyles.fieldLabel}>Whitelist apps</Text>
          <View style={styles.chipWrap}>
            {APP_LIBRARY.map((app) => (
              <PresenceChip
                key={app.appId}
                label={app.name}
                selected={form.whitelist.includes(app.appId)}
                onPress={() => {
                  setForm((current) => ({
                    ...current,
                    whitelist: current.whitelist.includes(app.appId)
                      ? current.whitelist.filter((value) => value !== app.appId)
                      : [...current.whitelist, app.appId],
                  }));
                }}
              />
            ))}
          </View>
        </View>

        <View style={styles.switchRow}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.rowTitle}>Active</Text>
            <Text style={styles.helperText}>Disabled schedules stay saved but stop appearing in Up Next.</Text>
          </View>
          <Switch
            value={form.active}
            onValueChange={(value) => setForm((current) => ({ ...current, active: value }))}
            trackColor={{ false: PR_SURFACES.high, true: `${PR_ACCENT_LIGHT}66` }}
            thumbColor={form.active ? PR_ACCENT_LIGHT : '#ffffff'}
          />
        </View>

        <View style={presenceScreenKitStyles.actionRow}>
          <Pressable style={presenceScreenKitStyles.secondaryButton} onPress={closeSheet}>
            <Text style={presenceScreenKitStyles.secondaryButtonText}>Cancel</Text>
          </Pressable>
          <Pressable style={presenceScreenKitStyles.primaryButton} onPress={handleSave}>
            <Text style={presenceScreenKitStyles.primaryButtonText}>Save</Text>
          </Pressable>
        </View>
      </PresenceBottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  upNextCard: {
    gap: 14,
  },
  upNextHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  upNextTitle: {
    ...PR_TYPOGRAPHY.headlineMd,
    color: PR_TEXT,
    fontFamily: PR_FONTS.bold,
  },
  helperText: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT_SECONDARY,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sheetTitle: {
    ...PR_TYPOGRAPHY.headlineMd,
    color: PR_TEXT,
    fontFamily: PR_FONTS.bold,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: PR_SURFACES.mid,
    borderRadius: 20,
    padding: 16,
  },
  rowTitle: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
    fontFamily: PR_FONTS.semiBold,
  },
});
