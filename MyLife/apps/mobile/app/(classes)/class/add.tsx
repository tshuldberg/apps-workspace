import { useCallback, useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  createClass,
  createTeacher,
  listSemesters,
  listTeachers,
  type ClassInput,
  type SemesterRow,
  type TeacherRow,
} from '@mylife/classes';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { AddClassSheet } from '../../../components/classes/AddClassSheet';
import { useDatabase } from '../../../components/DatabaseProvider';
import { uuid } from '../../../lib/uuid';

const ACCENT = colors.modules.classes;

interface AddContext {
  semester: SemesterRow | null;
  teachers: TeacherRow[];
}

export default function ClassAddScreen() {
  const db = useDatabase();
  const router = useRouter();

  const context = useMemo<AddContext>(() => {
    const semesters = listSemesters(db);
    const semester =
      semesters.find((entry) => entry.is_current === 1) ?? semesters[0] ?? null;
    return {
      semester,
      teachers: listTeachers(db),
    };
  }, [db]);

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  const handleSubmit = useCallback(
    (input: ClassInput) => {
      try {
        const created = createClass(db, uuid(), input);
        router.replace(`/(classes)/class/${created.id}` as never);
      } catch (error) {
        Alert.alert(
          'Save failed',
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    [db, router],
  );

  const handleCreateTeacher = useCallback(
    (name: string): TeacherRow | null => createTeacher(db, uuid(), { name }),
    [db],
  );

  if (!context.semester) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Add class',
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
          }}
        />
        <ScrollView
          style={styles.screen}
          contentContainerStyle={styles.content}
        >
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Create a semester first</Text>
            <Text variant="body" color={colors.textSecondary}>
              Classes need a semester home. Add one in Settings, then come back
              here to build the schedule.
            </Text>
            <Pressable
              style={styles.primaryBtn}
              onPress={() => router.replace('/(classes)/settings' as never)}
            >
              <Text style={styles.primaryBtnLabel}>Open Settings</Text>
            </Pressable>
          </Card>
        </ScrollView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Add class',
          headerShown: false,
        }}
      />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Card style={styles.launchCard}>
          <Text style={styles.launchTitle}>Adding to {context.semester.name}</Text>
        </Card>
      </ScrollView>
      <AddClassSheet
        visible
        onClose={handleClose}
        onSubmit={handleSubmit}
        closeOnSubmit={false}
        semesterId={context.semester.id}
        teachers={context.teachers}
        onCreateTeacher={handleCreateTeacher}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  emptyCard: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: 20,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  primaryBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: ACCENT,
  },
  primaryBtnLabel: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '700',
  },
  launchCard: {
    alignItems: 'center',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: spacing.lg,
  },
  launchTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
});
