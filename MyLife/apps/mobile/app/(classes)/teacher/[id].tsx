import { useCallback, useMemo } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Card, Text, borderRadius, colors, spacing } from '@mylife/ui';
import {
  deleteTeacher,
  getSemester,
  getTeacher,
  listClassesByTeacher,
  type ClassRow,
  type DayTime,
  type SemesterRow,
  type TeacherRow,
} from '@mylife/classes';
import { useDatabase } from '../../../components/DatabaseProvider';
import { useClassesFocusedSnapshot } from '../_ui';

const ACCENT = colors.modules.classes;

interface OfficeHourBlock {
  day: string;
  start_time: string;
  end_time: string;
}

interface TeacherSnapshot {
  teacher: TeacherRow | null;
  officeHours: OfficeHourBlock[];
  classes: Array<{ cls: ClassRow; semester: SemesterRow | null }>;
}

const DAY_LABELS: Record<string, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

function parseOfficeHours(raw: string | null): OfficeHourBlock[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OfficeHourBlock[]) : [];
  } catch {
    return [];
  }
}

function Stars({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <Text style={styles.stars}>
      {'★'.repeat(Math.max(0, Math.min(max, value)))}
      {'☆'.repeat(Math.max(0, max - value))}
    </Text>
  );
}

export default function TeacherDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useDatabase();

  const snapshot = useClassesFocusedSnapshot<TeacherSnapshot>(
    useCallback(() => {
      if (!id) {
        return { teacher: null, officeHours: [], classes: [] };
      }
      const teacher = getTeacher(db, id);
      if (!teacher) {
        return { teacher: null, officeHours: [], classes: [] };
      }
      const classes = listClassesByTeacher(db, teacher.id);
      const taught: Array<{ cls: ClassRow; semester: SemesterRow | null }> = [];
      for (const cls of classes) {
        const semester = getSemester(db, cls.semester_id);
        taught.push({ cls, semester });
      }
      return {
        teacher,
        officeHours: parseOfficeHours(teacher.office_hours),
        classes: taught,
      };
    }, [db, id]),
  );

  const handleEmail = useCallback(() => {
    if (!snapshot.teacher?.email) return;
    Linking.openURL(`mailto:${snapshot.teacher.email}`).catch(() => {});
  }, [snapshot.teacher]);

  const handleOpenMap = useCallback(() => {
    const loc = snapshot.teacher?.office_location;
    if (!loc) return;
    const url = `https://maps.apple.com/?q=${encodeURIComponent(loc)}`;
    Linking.openURL(url).catch(() => {});
  }, [snapshot.teacher]);

  const handleEdit = useCallback(() => {
    if (!snapshot.teacher) return;
    router.push(`/(classes)/teacher/edit/${snapshot.teacher.id}` as never);
  }, [router, snapshot.teacher]);

  const handleDelete = useCallback(() => {
    if (!snapshot.teacher) return;
    Alert.alert(
      'Delete teacher',
      `Remove ${snapshot.teacher.name}? Classes will keep their schedule but lose the teacher link.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteTeacher(db, snapshot.teacher!.id);
            router.back();
          },
        },
      ],
    );
  }, [db, router, snapshot.teacher]);

  const subtitle = useMemo(() => {
    if (!snapshot.teacher) return '';
    const parts: string[] = [];
    if (snapshot.teacher.title) parts.push(snapshot.teacher.title);
    if (snapshot.teacher.department) parts.push(snapshot.teacher.department);
    return parts.join(' · ');
  }, [snapshot.teacher]);

  if (!snapshot.teacher) {
    return (
      <View style={styles.errorScreen}>
        <Text variant="heading" style={styles.errorTitle}>
          Teacher not found
        </Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.back()}>
          <Text style={[styles.primaryBtnLabel, { color: colors.background }]}>
            Back
          </Text>
        </Pressable>
      </View>
    );
  }

  const t = snapshot.teacher;

  return (
    <>
      <Stack.Screen
        options={{
          title: t.name,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
        }}
      />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.heroSection}>
          <Text style={[styles.eyebrow, { color: ACCENT }]}>Teacher profile</Text>
          <Text style={styles.title}>{t.name}</Text>
          {subtitle ? (
            <Text variant="body" color={colors.textSecondary}>
              {subtitle}
            </Text>
          ) : null}
          {t.email ? (
            <Pressable onPress={handleEmail}>
              <Text style={[styles.emailLink, { color: ACCENT }]}>{t.email}</Text>
            </Pressable>
          ) : null}
        </View>

        <Section title="Office">
          <Card style={styles.card}>
            {t.office_location ? (
              <Pressable onPress={handleOpenMap}>
                <Text variant="body">{t.office_location}</Text>
                <Text style={[styles.mapLink, { color: ACCENT }]}>
                  Open in Maps →
                </Text>
              </Pressable>
            ) : (
              <Text variant="body" color={colors.textSecondary}>
                No office location on file.
              </Text>
            )}
            {snapshot.officeHours.length > 0 ? (
              <View style={{ gap: 6, marginTop: spacing.sm }}>
                {snapshot.officeHours.map((b, idx) => (
                  <View key={idx} style={styles.officeRow}>
                    <Text variant="body">{DAY_LABELS[b.day] ?? b.day}</Text>
                    <Text variant="body" color={colors.textSecondary}>
                      {b.start_time}–{b.end_time}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text
                variant="caption"
                color={colors.textSecondary}
                style={{ marginTop: 6 }}
              >
                No office hours set.
              </Text>
            )}
          </Card>
        </Section>

        <Section title="Ratings">
          <Card style={styles.card}>
            <View style={styles.ratingRow}>
              <Text variant="body" color={colors.textSecondary}>
                Recommendation potential
              </Text>
              <Stars value={t.rec_potential ?? 0} />
            </View>
            <View style={styles.ratingRow}>
              <Text variant="body" color={colors.textSecondary}>
                Personal rating
              </Text>
              <Stars value={t.rating ?? 0} />
            </View>
            <Text variant="caption" color={colors.textSecondary}>
              Private — never shared.
            </Text>
          </Card>
        </Section>

        {t.teaching_style_notes ? (
          <Section title="Teaching style">
            <Card style={styles.card}>
              <Text variant="body" style={styles.notesBody}>
                {t.teaching_style_notes}
              </Text>
            </Card>
          </Section>
        ) : null}

        {t.grading_notes ? (
          <Section title="Grading personality">
            <Card style={styles.card}>
              <Text variant="body" style={styles.notesBody}>
                {t.grading_notes}
              </Text>
            </Card>
          </Section>
        ) : null}

        {t.notes_md ? (
          <Section title="Private notes">
            <Card style={styles.card}>
              <Text variant="body" style={styles.notesBody}>
                {t.notes_md}
              </Text>
            </Card>
          </Section>
        ) : null}

        <Section title={`Classes taught (${snapshot.classes.length})`}>
          {snapshot.classes.length === 0 ? (
            <Card style={styles.card}>
              <Text variant="body" color={colors.textSecondary}>
                No classes attached to this teacher yet.
              </Text>
            </Card>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {snapshot.classes.map(({ cls, semester }) => (
                <Pressable
                  key={cls.id}
                  onPress={() => router.push(`/(classes)/class/${cls.id}` as never)}
                >
                  <Card style={styles.card}>
                    <Text variant="body" style={styles.classRowName}>
                      {cls.name}
                    </Text>
                    <Text variant="caption" color={colors.textSecondary}>
                      {[cls.code, semester?.name ?? null].filter(Boolean).join(' · ')}
                    </Text>
                  </Card>
                </Pressable>
              ))}
            </View>
          )}
        </Section>

        <Section title="Actions">
          <View style={{ gap: spacing.sm }}>
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: ACCENT }]}
              onPress={handleEdit}
            >
              <Text
                style={[styles.primaryBtnLabel, { color: colors.background }]}
              >
                Edit teacher
              </Text>
            </Pressable>
            <Pressable style={styles.dangerBtn} onPress={handleDelete}>
              <Text style={styles.dangerBtnLabel}>Delete teacher</Text>
            </Pressable>
          </View>
        </Section>
      </ScrollView>
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

// Mark unused import as referenced for linters that flag DayTime as unused.
type _RefDayTime = DayTime;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  errorScreen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  errorTitle: { textAlign: 'center' },
  heroSection: { gap: spacing.xs },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  emailLink: { fontSize: 15, fontWeight: '700', marginTop: spacing.xs },
  mapLink: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  section: { gap: spacing.sm },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  card: { gap: spacing.xs },
  officeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stars: { color: '#FFB877', fontSize: 18, letterSpacing: 2 },
  notesBody: { lineHeight: 22 },
  classRowName: { fontWeight: '700' },
  primaryBtn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    backgroundColor: ACCENT,
  },
  primaryBtnLabel: { fontSize: 15, fontWeight: '700' },
  dangerBtn: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,180,171,0.4)',
    backgroundColor: 'rgba(255,180,171,0.08)',
  },
  dangerBtnLabel: { fontSize: 14, fontWeight: '700', color: '#FFB4AB' },
});
