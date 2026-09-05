import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import type { DatabaseAdapter } from '@mylife/db';
import {
  DEFAULT_CLASSES_SETTINGS,
  saveClassesSettings,
  getClassesSettings,
  applyImport,
  bundleToJSON,
  loadFullExport,
  parseImportJSON,
  type AssignmentView,
  type ClassesSettings,
  type GradeScale,
  type ScheduleDensity,
  type WeekStartsOn,
} from '@mylife/classes';
import { Card, Text, borderRadius, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { SettingsRow } from '../../components/classes/SettingsRow';
import {
  CLASSES_ACCENT,
  CLASSES_ACCENT_BORDER,
  CLASSES_ACCENT_DIM,
  ClassesScreen,
  ClassesSection,
  useClassesFocusedSnapshot,
} from './_ui';

const REMINDER_OPTIONS: ReadonlyArray<{ label: string; value: number }> = [
  { label: '1h', value: 60 },
  { label: '1d', value: 1440 },
  { label: '3d', value: 4320 },
  { label: '1w', value: 10080 },
];

type Status =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved' }
  | { kind: 'error'; message: string };

function settingsAreDefault(settings: ClassesSettings): boolean {
  return JSON.stringify(settings) === JSON.stringify(DEFAULT_CLASSES_SETTINGS);
}

export default function ClassesSettingsScreen() {
  const db = useDatabase();
  const persisted = useClassesFocusedSnapshot(useCallback(() => getClassesSettings(db), [db]));
  const [draft, setDraft] = useState<ClassesSettings>(persisted);
  const [committed, setCommitted] = useState<ClassesSettings>(persisted);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const showFirstRunHint = useMemo(() => settingsAreDefault(persisted), [persisted]);

  useEffect(() => {
    setDraft(persisted);
    setCommitted(persisted);
  }, [persisted]);

  useEffect(() => {
    if (status.kind === 'saved' || status.kind === 'error') {
      Animated.sequence([
        Animated.timing(toastOpacity, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.delay(1400),
        Animated.timing(toastOpacity, { toValue: 0, duration: 240, useNativeDriver: true }),
      ]).start(() => {
        setStatus((current) =>
          current.kind === 'saved' || current.kind === 'error' ? { kind: 'idle' } : current,
        );
      });
    }
  }, [status, toastOpacity]);

  const persist = useCallback(
    (next: ClassesSettings) => {
      const previous = committed;
      setDraft(next);
      setCommitted(next);
      setStatus({ kind: 'saving' });
      try {
        saveClassesSettings(db, next);
        setStatus({ kind: 'saved' });
      } catch (error) {
        setDraft(previous);
        setCommitted(previous);
        setStatus({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Failed to save settings.',
        });
      }
    },
    [committed, db],
  );

  const update = useCallback(
    <K extends keyof ClassesSettings>(key: K, value: ClassesSettings[K]) => {
      persist({ ...draft, [key]: value });
    },
    [draft, persist],
  );

  const reset = useCallback(() => {
    persist(DEFAULT_CLASSES_SETTINGS);
  }, [persist]);

  const [biometricError, setBiometricError] = useState<string | null>(null);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);

  const toggleBiometricLock = useCallback(
    async (next: boolean) => {
      if (biometricBusy) return;
      setBiometricBusy(true);
      setBiometricError(null);
      try {
        const hasHw = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        if (!hasHw || !enrolled) {
          setBiometricError(
            'Biometrics not available on this device. Set up Face ID/Touch ID first.',
          );
          return;
        }
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: next ? 'Confirm to enable lock' : 'Confirm to disable lock',
          cancelLabel: 'Cancel',
          fallbackLabel: 'Use passcode',
        });
        if (!result.success) {
          setBiometricError('Authentication cancelled. Setting unchanged.');
          return;
        }
        update('requireBiometricLock', next);
      } catch {
        setBiometricError('Biometric authentication failed.');
      } finally {
        setBiometricBusy(false);
      }
    },
    [biometricBusy, update],
  );

  const acknowledgePrivacy = useCallback(() => {
    if (!draft.privacyConsentAcknowledgedAt) {
      update('privacyConsentAcknowledgedAt', new Date().toISOString());
    }
    setPrivacyModalOpen(true);
  }, [draft.privacyConsentAcknowledgedAt, update]);

  return (
    <ClassesScreen
      title="Settings"
      subtitle="Tune the schedule, grading, study rhythm, and reminders that power MyClasses across mobile and web."
    >
      {showFirstRunHint ? (
        <View style={styles.firstRunCard}>
          <Text variant="caption" color={colors.textSecondary} style={styles.firstRunText}>
            Defaults are sensible. Tweak only what matters to you.
          </Text>
        </View>
      ) : null}

      <ClassesSection title="Schedule">
        <Card style={styles.groupCard}>
          <SettingsRow
            variant="child"
            label="Current term"
            description="Anchors schedule, assignments, and grades."
          >
            <TextInput
              value={draft.activeTermLabel}
              placeholder="Fall 2026"
              placeholderTextColor={colors.textTertiary}
              onChangeText={(value) => setDraft((current) => ({ ...current, activeTermLabel: value }))}
              onBlur={() => {
                if (draft.activeTermLabel !== committed.activeTermLabel) {
                  persist(draft);
                }
              }}
              style={styles.input}
            />
          </SettingsRow>
          <SettingsRow
            variant="child"
            label="Campus"
            description="Optional school or campus label."
          >
            <TextInput
              value={draft.campusLabel}
              placeholder="North Hall"
              placeholderTextColor={colors.textTertiary}
              onChangeText={(value) => setDraft((current) => ({ ...current, campusLabel: value }))}
              onBlur={() => {
                if (draft.campusLabel !== committed.campusLabel) {
                  persist(draft);
                }
              }}
              style={styles.input}
            />
          </SettingsRow>
          <SettingsRow<WeekStartsOn>
            variant="segmented"
            label="Week starts on"
            options={[
              { label: 'Mon', value: 'monday' },
              { label: 'Sun', value: 'sunday' },
            ]}
            value={draft.weekStartsOn}
            onChange={(value) => update('weekStartsOn', value)}
          />
          <SettingsRow
            variant="toggle"
            label="Show weekends"
            description="Include Saturday and Sunday in the planner."
            value={draft.showWeekends}
            onChange={(value) => update('showWeekends', value)}
          />
          <SettingsRow<ScheduleDensity>
            variant="segmented"
            label="Schedule density"
            options={[
              { label: 'Comfy', value: 'comfortable' },
              { label: 'Compact', value: 'compact' },
            ]}
            value={draft.scheduleDensity}
            onChange={(value) => update('scheduleDensity', value)}
          />
        </Card>
      </ClassesSection>

      <ClassesSection title="Grading">
        <Card style={styles.groupCard}>
          <SettingsRow<GradeScale>
            variant="segmented"
            label="Grade scale"
            description="How grades surface across class detail and term GPA."
            options={[
              { label: 'Percent', value: 'percent' },
              { label: 'Letter', value: 'letter' },
              { label: '4.0', value: 'gpa_4' },
            ]}
            value={draft.gradeScale}
            onChange={(value) => update('gradeScale', value)}
          />
        </Card>
      </ClassesSection>

      <ClassesSection title="Study">
        <Card style={styles.groupCard}>
          <SettingsRow
            variant="stepper"
            label="Default focus block"
            description="Length of one study block before a break."
            value={draft.defaultStudyMinutes}
            min={15}
            max={240}
            step={5}
            unit="min"
            onChange={(value) => update('defaultStudyMinutes', value)}
          />
          <SettingsRow
            variant="stepper"
            label="Break length"
            description="Recovery time between focus blocks."
            value={draft.focusBreakMinutes}
            min={0}
            max={60}
            step={1}
            unit="min"
            onChange={(value) => update('focusBreakMinutes', value)}
          />
        </Card>
      </ClassesSection>

      <ClassesSection title="Reminders">
        <Card style={styles.groupCard}>
          <SettingsRow<AssignmentView>
            variant="segmented"
            label="Default queue"
            options={[
              { label: 'Upcoming', value: 'upcoming' },
              { label: 'Today', value: 'today' },
              { label: 'By class', value: 'class' },
            ]}
            value={draft.assignmentView}
            onChange={(value) => update('assignmentView', value)}
          />
          <SettingsRow<number>
            variant="chips"
            label="Reminder offsets"
            description="Pick when MyClasses should surface upcoming assignments."
            options={REMINDER_OPTIONS}
            values={draft.assignmentReminderOffsets}
            onChange={(values) =>
              update(
                'assignmentReminderOffsets',
                [...values].sort((left, right) => left - right),
              )
            }
          />
        </Card>
      </ClassesSection>

      <ClassesSection title="Privacy">
        <Card style={styles.groupCard}>
          <SettingsRow
            variant="toggle"
            label="Require biometric lock"
            description="Use Face ID, Touch ID, or device passcode to open MyClasses."
            value={draft.requireBiometricLock}
            onChange={(value) => void toggleBiometricLock(value)}
          />
          {biometricError ? (
            <View style={styles.inlineError}>
              <Text variant="caption" color={colors.danger}>
                {biometricError}
              </Text>
            </View>
          ) : null}
        </Card>
        <Card style={styles.privacyCard}>
          <Text style={styles.privacyTitle}>Local-first by design</Text>
          <Text variant="caption" color={colors.textSecondary} style={styles.privacyBody}>
            MyClasses data stays on this device. No analytics, no telemetry, no cloud sync
            (unless you enable backup explicitly).
          </Text>
          <Pressable onPress={acknowledgePrivacy} style={styles.learnMoreButton}>
            <Text variant="label" color={CLASSES_ACCENT}>
              Learn more
            </Text>
          </Pressable>
        </Card>
      </ClassesSection>

      <ClassesSection title="Backup & restore">
        <Card style={styles.groupCard}>
          <BackupRestoreCard db={db} />
        </Card>
      </ClassesSection>

      <Modal
        visible={privacyModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPrivacyModalOpen(false)}
      >
        <ScrollView style={styles.modalRoot} contentContainerStyle={styles.modalContent}>
          <Text style={styles.modalTitle}>How MyClasses handles your data</Text>
          <Text variant="body" color={colors.textSecondary} style={styles.modalParagraph}>
            What we store: semesters, classes, teachers, assignments, grades, study sessions,
            lifelong learning entries, degree progress, and applications. All of this is kept
            in a local SQLite database on your device.
          </Text>
          <Text variant="body" color={colors.textSecondary} style={styles.modalParagraph}>
            What we do not do: no analytics, no telemetry, no third-party trackers, and no
            cloud sync without explicit opt-in. There is no MyClasses server collecting your
            academic life.
          </Text>
          <Text variant="body" color={colors.textSecondary} style={styles.modalParagraph}>
            Sharing: any export of your data is initiated by you. Nothing leaves your device
            automatically. You decide when and where to share.
          </Text>
          <Text variant="body" color={colors.textSecondary} style={styles.modalParagraph}>
            Deletion: disabling the module hides MyClasses routes but preserves your data.
            Uninstalling MyLife removes the local database entirely.
          </Text>
          <Pressable
            style={styles.modalCloseButton}
            onPress={() => setPrivacyModalOpen(false)}
          >
            <Text variant="label" color={colors.background}>
              Close
            </Text>
          </Pressable>
        </ScrollView>
      </Modal>

      <View style={styles.actionsRow}>
        <Pressable style={styles.secondaryButton} onPress={reset} accessibilityRole="button">
          <Text variant="label">Reset to defaults</Text>
        </Pressable>
      </View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.toast,
          status.kind === 'error' ? styles.toastError : styles.toastSuccess,
          { opacity: toastOpacity },
        ]}
      >
        <Text variant="label" color={colors.background}>
          {status.kind === 'error'
            ? `Could not save: ${status.message}`
            : status.kind === 'saved'
              ? 'Saved.'
              : ''}
        </Text>
      </Animated.View>
    </ClassesScreen>
  );
}

type BackupBusy =
  | { kind: 'idle' }
  | { kind: 'busy'; label: string }
  | { kind: 'ok'; label: string }
  | { kind: 'error'; message: string };

function BackupRestoreCard({ db }: { db: DatabaseAdapter }) {
  const [busy, setBusy] = useState<BackupBusy>({ kind: 'idle' });

  const handleExportJSON = useCallback(async () => {
    setBusy({ kind: 'busy', label: 'Building export…' });
    try {
      const bundle = loadFullExport(db);
      const json = bundleToJSON(bundle, { pretty: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const path = `${FileSystem.cacheDirectory}myclasses-export-${stamp}.json`;
      await FileSystem.writeAsStringAsync(path, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, {
          mimeType: 'application/json',
          dialogTitle: 'Export MyClasses backup',
          UTI: 'public.json',
        });
      }
      setBusy({ kind: 'ok', label: 'Export ready.' });
    } catch (error) {
      setBusy({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Export failed.',
      });
    }
  }, [db]);

  const runImport = useCallback(
    async (mode: 'merge' | 'replace') => {
      setBusy({ kind: 'busy', label: 'Picking file…' });
      try {
        const pick = await DocumentPicker.getDocumentAsync({
          type: ['application/json', 'text/plain', '*/*'],
          copyToCacheDirectory: true,
        });
        if (pick.canceled || !pick.assets || pick.assets.length === 0) {
          setBusy({ kind: 'idle' });
          return;
        }
        const asset = pick.assets[0];
        const text = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        const parsed = parseImportJSON(text);
        if (!parsed.ok) {
          setBusy({ kind: 'error', message: parsed.error });
          return;
        }
        // Dry-run preview first.
        const preview = applyImport(db, parsed.bundle, { mode, dryRun: true });
        const totalCreate = preview.applied.to_create.reduce((s, p) => s + p.count, 0);
        const totalUpdate = preview.applied.to_update.reduce((s, p) => s + p.count, 0);
        const totalSkip = preview.applied.to_skip.reduce((s, p) => s + p.count, 0);
        const proceed = await new Promise<boolean>((resolve) => {
          Alert.alert(
            mode === 'replace' ? 'Replace local data?' : 'Merge backup?',
            `Will create ${totalCreate}, update ${totalUpdate}, skip ${totalSkip}.${
              preview.applied.warnings.length > 0
                ? ` Warnings: ${preview.applied.warnings.length}.`
                : ''
            }`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              {
                text: mode === 'replace' ? 'Replace' : 'Merge',
                style: mode === 'replace' ? 'destructive' : 'default',
                onPress: () => resolve(true),
              },
            ],
            { cancelable: true, onDismiss: () => resolve(false) },
          );
        });
        if (!proceed) {
          setBusy({ kind: 'idle' });
          return;
        }
        setBusy({ kind: 'busy', label: 'Applying import…' });
        const result = applyImport(db, parsed.bundle, { mode });
        if (result.errors.length > 0) {
          setBusy({ kind: 'error', message: result.errors.join('; ') });
          return;
        }
        setBusy({ kind: 'ok', label: 'Import applied. Restart to refresh.' });
      } catch (error) {
        setBusy({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Import failed.',
        });
      }
    },
    [db],
  );

  const statusColor =
    busy.kind === 'ok'
      ? CLASSES_ACCENT
      : busy.kind === 'error'
        ? colors.danger
        : colors.textSecondary;

  return (
    <View style={backupStyles.root}>
      <Pressable style={backupStyles.primaryButton} onPress={() => void handleExportJSON()}>
        <Text variant="label" color={colors.background}>
          Export full backup (JSON)
        </Text>
      </Pressable>
      <Pressable style={backupStyles.secondaryButton} onPress={() => void runImport('merge')}>
        <Text variant="label">Import (merge)</Text>
      </Pressable>
      <Pressable style={backupStyles.dangerButton} onPress={() => void runImport('replace')}>
        <Text variant="label" color={colors.background}>
          Import (replace)
        </Text>
      </Pressable>
      {busy.kind !== 'idle' ? (
        <View style={backupStyles.statusRow}>
          <Text variant="caption" color={statusColor}>
            {busy.kind === 'busy'
              ? busy.label
              : busy.kind === 'ok'
                ? busy.label
                : `Error: ${busy.message}`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const backupStyles = StyleSheet.create({
  root: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  primaryButton: {
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    backgroundColor: CLASSES_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerButton: {
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusRow: {
    paddingTop: 4,
  },
});

const styles = StyleSheet.create({
  firstRunCard: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: CLASSES_ACCENT_BORDER,
    backgroundColor: CLASSES_ACCENT_DIM,
  },
  firstRunText: {
    lineHeight: 19,
  },
  groupCard: {
    gap: 0,
  },
  input: {
    width: 200,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceElevated,
    color: colors.text,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    textAlign: 'right',
  },
  privacyCard: {
    backgroundColor: CLASSES_ACCENT_DIM,
    borderColor: CLASSES_ACCENT_BORDER,
    gap: spacing.xs,
  },
  privacyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  privacyBody: {
    lineHeight: 19,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  secondaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  toast: {
    position: 'absolute',
    bottom: 32,
    left: spacing.md,
    right: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastSuccess: {
    backgroundColor: CLASSES_ACCENT,
  },
  toastError: {
    backgroundColor: colors.danger,
  },
  inlineError: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  learnMoreButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    paddingVertical: 6,
  },
  modalRoot: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  modalParagraph: {
    lineHeight: 21,
  },
  modalCloseButton: {
    marginTop: spacing.md,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.pill,
    backgroundColor: CLASSES_ACCENT,
  },
});
