import { useCallback, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useRsvpContext } from '../../components/rsvp/RsvpContext';
import { useDatabase } from '../../components/DatabaseProvider';
import { getSetting, setSetting } from '@mylife/rsvp';

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="label" color={colors.textTertiary}>{title}</Text>
      <Card>{children}</Card>
    </View>
  );
}

function SettingsRow({
  label,
  value,
  onPress,
  danger,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={styles.row} disabled={!onPress}>
      <Text variant="body" color={danger ? colors.danger : colors.text}>
        {label}
      </Text>
      {value ? (
        <Text variant="caption" color={colors.textSecondary}>
          {value}
        </Text>
      ) : null}
    </Pressable>
  );
}

export default function RsvpSettingsScreen() {
  const db = useDatabase();
  const { events, refreshEvents } = useRsvpContext();
  const [, setTick] = useState(0);

  const defaultVisibility = getSetting(db, 'default_visibility') ?? 'private';
  const defaultApproval = getSetting(db, 'default_requires_approval') ?? 'false';
  const hostName = getSetting(db, 'host_name') ?? 'Host';

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const handleSetVisibility = () => {
    const options = ['public', 'unlisted', 'private'].map((v) => ({
      text: v.charAt(0).toUpperCase() + v.slice(1),
      onPress: () => {
        setSetting(db, 'default_visibility', v);
        refresh();
      },
    }));
    Alert.alert('Default Visibility', 'Choose visibility for new events.', [
      ...options,
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSetApproval = () => {
    const current = defaultApproval === 'true';
    setSetting(db, 'default_requires_approval', current ? 'false' : 'true');
    refresh();
  };

  const handleSetHostName = () => {
    Alert.prompt(
      'Host Name',
      'Enter your display name for events.',
      (text) => {
        const name = text.trim();
        if (name) {
          setSetting(db, 'host_name', name);
          refresh();
        }
      },
      'plain-text',
      hostName,
    );
  };

  const handleEraseAll = () => {
    Alert.alert(
      'Erase All RSVP Data',
      'This will permanently delete all events, invites, RSVPs, polls, and photos. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase Everything',
          style: 'destructive',
          onPress: () => {
            db.transaction(() => {
              db.execute('DELETE FROM rv_seat_assignments');
              db.execute('DELETE FROM rv_tables');
              db.execute('DELETE FROM rv_registry_items');
              db.execute('DELETE FROM rv_messages');
              db.execute('DELETE FROM rv_event_series');
              db.execute('DELETE FROM rv_recurrence_rules');
              db.execute('DELETE FROM rv_expense_splits');
              db.execute('DELETE FROM rv_expenses');
              db.execute('DELETE FROM rv_event_links');
              db.execute('DELETE FROM rv_photos');
              db.execute('DELETE FROM rv_comments');
              db.execute('DELETE FROM rv_announcements');
              db.execute('DELETE FROM rv_poll_votes');
              db.execute('DELETE FROM rv_polls');
              db.execute('DELETE FROM rv_question_responses');
              db.execute('DELETE FROM rv_questions');
              db.execute('DELETE FROM rv_rsvps');
              db.execute('DELETE FROM rv_invites');
              db.execute('DELETE FROM rv_event_cohosts');
              db.execute('DELETE FROM rv_events');
            });
            refreshEvents();
            Alert.alert('Done', 'All RSVP data has been erased.');
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentPadding}>
      <SettingsSection title="Defaults">
        <SettingsRow
          label="Default visibility"
          value={defaultVisibility.charAt(0).toUpperCase() + defaultVisibility.slice(1)}
          onPress={handleSetVisibility}
        />
        <SettingsRow
          label="Require approval by default"
          value={defaultApproval === 'true' ? 'Yes' : 'No'}
          onPress={handleSetApproval}
        />
        <SettingsRow
          label="Host name"
          value={hostName}
          onPress={handleSetHostName}
        />
      </SettingsSection>

      <SettingsSection title="Data">
        <SettingsRow label="Total events" value={String(events.length)} />
        <SettingsRow label="Erase all RSVP data" danger onPress={handleEraseAll} />
      </SettingsSection>

      <SettingsSection title="About">
        <SettingsRow label="Module" value="MyRSVP" />
        <SettingsRow label="Version" value="0.1.0" />
        <SettingsRow label="Privacy" value="No data collected. Ever." />
      </SettingsSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  contentPadding: { paddingBottom: spacing.xl },
  section: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
