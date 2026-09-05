import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, borderRadius, colors, spacing } from '@mylife/ui';
import {
  listCertifications,
  listExpiring,
  type CertificationRow,
} from '@mylife/classes';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  CLASSES_ACCENT,
  ClassesEmptyCard,
  ClassesMetricRow,
  ClassesScreen,
  useClassesFocusedSnapshot,
} from '../_ui';
import { CertListCard } from './_ui';

interface Snapshot {
  all: CertificationRow[];
  expiringSoon: CertificationRow[];
}

export default function CertificationsListScreen() {
  const db = useDatabase();
  const router = useRouter();

  const load = useCallback((): Snapshot => {
    const all = listCertifications(db);
    const expiringSoon = listExpiring(db, 90);
    return { all, expiringSoon };
  }, [db]);

  const snap = useClassesFocusedSnapshot(load);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ClassesScreen
        title="Certifications"
        subtitle="Your professional credential wallet."
      >
        <ClassesMetricRow
          items={[
            { label: 'Total', value: String(snap.all.length) },
            { label: 'Expiring 90d', value: String(snap.expiringSoon.length) },
          ]}
        />

        {snap.all.length === 0 ? (
          <ClassesEmptyCard
            title="No certifications yet"
            body="Log professional credentials so renewals and expirations never sneak up."
            actionLabel="Add a credential"
            onAction={() => router.push('/(classes)/lifelong/cert/add')}
          />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {snap.all.map((c) => (
              <Pressable
                key={c.id}
                onPress={() =>
                  router.push(`/(classes)/lifelong/cert/${c.id}`)
                }
              >
                <CertListCard cert={c} />
              </Pressable>
            ))}
          </View>
        )}
      </ClassesScreen>

      <Pressable
        style={[styles.fab, { backgroundColor: CLASSES_ACCENT }]}
        onPress={() => router.push('/(classes)/lifelong/cert/add')}
      >
        <Text style={[styles.fabLabel, { color: colors.background }]}>
          + Credential
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.pill,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabLabel: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
