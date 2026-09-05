import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, colors, surfaceTiers, spacing, glassFills, glassBorders } from '@mylife/ui';
import {
  createBackup,
  deleteBackup,
  getBackupConfig,
  listBackups,
  restoreFromBackup,
  setBackupConfig,
  validateBackupCompatibility,
  type BackupMetadata,
  type BackupValidationResult,
} from '@mylife/db';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  createMobileBackupOps,
  exportBackupViaShareSheet,
  openBackupForValidation,
  pickBackupFile,
  stageImportedBackup,
} from '../../lib/backup';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function BackupScreen() {
  const db = useDatabase();
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [autoEnabled, setAutoEnabled] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setBackups(listBackups(db));
    const config = getBackupConfig(db);
    setAutoEnabled(config.autoEnabled);
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleToggleAuto = (value: boolean) => {
    setBackupConfig(db, { autoEnabled: value });
    setAutoEnabled(value);
  };

  const handleBackupNow = async () => {
    setIsCreating(true);
    try {
      const ops = createMobileBackupOps();
      await createBackup(db, ops, { type: 'manual', label: 'Manual backup' });
      refresh();
    } catch (err) {
      Alert.alert('Backup Failed', err instanceof Error ? err.message : String(err));
    } finally {
      setIsCreating(false);
    }
  };

  // R20.1: Export backup via system share sheet
  const handleExport = async (backup: BackupMetadata) => {
    setIsExporting(backup.id);
    try {
      await exportBackupViaShareSheet(backup.filePath);
    } catch (err) {
      Alert.alert('Export Failed', err instanceof Error ? err.message : String(err));
    } finally {
      setIsExporting(null);
    }
  };

  // R20.1-R20.5: Import backup from file picker with validation
  const handleImportBackup = async () => {
    setIsImporting(true);
    try {
      // Step 1: Pick file
      const picked = await pickBackupFile();
      if (!picked) {
        setIsImporting(false);
        return;
      }

      // Step 2: Stage the file in backup directory
      const stagedPath = await stageImportedBackup(picked.uri);

      // Step 3: Validate compatibility (R20.3)
      let validation: BackupValidationResult;
      let closeValidation: (() => void) | null = null;
      try {
        const { adapter: backupAdapter, close } = await openBackupForValidation(stagedPath);
        closeValidation = close;
        validation = validateBackupCompatibility(db, backupAdapter);
        close();
        closeValidation = null;
      } catch (err) {
        closeValidation?.();
        // R20.3: reject incompatible/corrupt backups with descriptive error
        Alert.alert(
          'Invalid Backup',
          `The selected file is not a valid MyLife backup.\n\n${err instanceof Error ? err.message : String(err)}`,
        );
        // Clean up staged file
        const ops = createMobileBackupOps();
        await ops.deleteFile(stagedPath);
        setIsImporting(false);
        return;
      }

      if (!validation.compatible) {
        // R20.3: reject with descriptive error
        Alert.alert(
          'Incompatible Backup',
          `This backup cannot be restored:\n\n${validation.issues.join('\n')}`,
        );
        const ops = createMobileBackupOps();
        await ops.deleteFile(stagedPath);
        setIsImporting(false);
        return;
      }

      // Step 4: Confirm overwrite (R20.4)
      const warningLines = [
        `File: ${picked.name}`,
        `Size: ${formatBytes(picked.size)}`,
        `Modules: ${validation.backupModuleCount}`,
      ];
      if (validation.issues.length > 0) {
        warningLines.push('', 'Notes:', ...validation.issues);
      }

      setIsImporting(false);

      Alert.alert(
        'Restore from File?',
        `This will replace ALL current data with data from this backup. This cannot be undone.\n\n${warningLines.join('\n')}`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: async () => {
              const ops = createMobileBackupOps();
              await ops.deleteFile(stagedPath);
            },
          },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: () => void performImportRestore(stagedPath),
          },
        ],
      );
    } catch (err) {
      Alert.alert('Import Failed', err instanceof Error ? err.message : String(err));
      setIsImporting(false);
    }
  };

  // R20.2, R20.5: Replace database with imported backup
  const performImportRestore = async (stagedPath: string) => {
    setRestoringId('import');
    try {
      const ops = createMobileBackupOps();
      // R20.5: restoreDatabase copies over the live DB; if it throws,
      // the existing DB is preserved (copy failed before overwrite completed)
      await ops.restoreDatabase(stagedPath);
      Alert.alert(
        'Restored Successfully',
        'Your data has been restored from the imported backup. Please restart the app to load the restored data.',
      );
      refresh();
    } catch (err) {
      // R20.5: preserve existing database and show error
      Alert.alert(
        'Restore Failed',
        `Your existing data has been preserved.\n\n${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setRestoringId(null);
    }
  };

  // Restore from internal backup list
  const handleRestore = (backup: BackupMetadata) => {
    Alert.alert(
      'Restore Backup?',
      `This will replace your current data with the backup from ${formatDate(backup.createdAt)}. The app will need to restart.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            setRestoringId(backup.id);
            try {
              const ops = createMobileBackupOps();
              await restoreFromBackup(db, ops, backup.id);
              Alert.alert('Restored', 'Please restart the app to load the restored data.');
            } catch (err) {
              Alert.alert('Restore Failed', err instanceof Error ? err.message : String(err));
            } finally {
              setRestoringId(null);
            }
          },
        },
      ],
    );
  };

  const handleDelete = (backup: BackupMetadata) => {
    Alert.alert(
      'Delete Backup?',
      `Delete the backup from ${formatDate(backup.createdAt)}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const ops = createMobileBackupOps();
            await deleteBackup(db, ops, backup.id);
            refresh();
          },
        },
      ],
    );
  };

  const isRestoring = restoringId !== null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      {/* Page header */}
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Backup &amp; Restore</Text>
        <Text style={styles.subtitle}>ARCHIVE STATUS: PROTECTED</Text>
      </View>

      {/* Local Archive section */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>LOCAL ARCHIVE</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.bodyText}>Daily Auto-Backup</Text>
              <Text style={styles.captionText}>
                Backs up your database once per day
              </Text>
            </View>
            <Switch
              value={autoEnabled}
              onValueChange={handleToggleAuto}
              trackColor={{ false: surfaceTiers.highest, true: colors.hubAccent }}
              thumbColor={colors.text}
            />
          </View>

          <View style={styles.separator} />

          <Text style={styles.captionText}>
            Create a backup before making major changes. Manual backups are never auto-deleted.
          </Text>

          <View style={styles.buttonRow}>
            <Pressable
              onPress={() => void handleBackupNow()}
              disabled={isCreating}
              style={[isCreating && styles.disabled]}
            >
              <LinearGradient
                colors={[colors.hubAccentLight, colors.hubAccent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientPill}
              >
                {isCreating ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <Text style={styles.pillText}>Export Backup</Text>
                )}
              </LinearGradient>
            </Pressable>
            <Pressable
              style={[styles.glassPill, (isImporting || isRestoring) && styles.disabled]}
              onPress={() => void handleImportBackup()}
              disabled={isImporting || isRestoring}
            >
              {isImporting ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <Text style={styles.pillText}>Import Backup</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>

      {/* Cloud Sync section */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>CLOUD SYNC</Text>
        <View style={styles.elevatedCard}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.bodyText}>Sync History</Text>
              <Text style={styles.captionText}>
                {backups.length} backup{backups.length !== 1 ? 's' : ''} available
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Recent Backups */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>RECENT BACKUPS ({backups.length})</Text>
        {backups.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.captionText}>
              No backups yet. Enable auto-backup or create one manually.
            </Text>
          </View>
        ) : (
          backups.map((backup) => (
            <View key={backup.id} style={[styles.card, styles.backupCard]}>
              <View style={styles.backupHeader}>
                <Text style={styles.bodyText}>{formatDate(backup.createdAt)}</Text>
                <Text style={styles.captionText}>
                  {formatBytes(backup.sizeBytes)} · {backup.moduleCount} modules · {backup.type}
                </Text>
                {backup.label && (
                  <Text style={styles.labelText}>{backup.label}</Text>
                )}
              </View>
              <View style={styles.backupActions}>
                <Pressable
                  onPress={() => void handleExport(backup)}
                  disabled={isExporting === backup.id}
                >
                  <LinearGradient
                    colors={[colors.hubAccentLight, colors.hubAccent]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.smallGradientPill}
                  >
                    {isExporting === backup.id ? (
                      <ActivityIndicator size="small" color={colors.text} />
                    ) : (
                      <Text style={styles.smallPillText}>Export</Text>
                    )}
                  </LinearGradient>
                </Pressable>
                <Pressable
                  style={[styles.smallGlassPill, isRestoring && styles.disabled]}
                  onPress={() => handleRestore(backup)}
                  disabled={isRestoring}
                >
                  {restoringId === backup.id ? (
                    <ActivityIndicator size="small" color={colors.text} />
                  ) : (
                    <Text style={styles.smallPillText}>Restore</Text>
                  )}
                </Pressable>
                <Pressable
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(backup)}
                >
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </View>

      {/* System Restore (danger zone) */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>SYSTEM RESTORE</Text>
        <View style={styles.dangerCard}>
          <Text style={styles.bodyText}>Factory Reset</Text>
          <Text style={styles.captionText}>
            Restore from a previous backup. This will replace all current data and cannot be undone.
          </Text>
          <Pressable
            style={[styles.dangerButton, isRestoring && styles.disabled]}
            onPress={() => {
              if (backups.length > 0) handleRestore(backups[0]!);
            }}
            disabled={isRestoring || backups.length === 0}
          >
            <Text style={styles.dangerButtonText}>Restore Latest Backup</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.lg,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    letterSpacing: 2,
    fontWeight: '600',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    color: `${colors.hubAccent}99`,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  card: {
    backgroundColor: surfaceTiers.low,
    borderRadius: 16,
    padding: spacing.md,
  },
  elevatedCard: {
    backgroundColor: surfaceTiers.high,
    borderRadius: 16,
    padding: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowText: {
    flex: 1,
    marginRight: spacing.md,
  },
  bodyText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  captionText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: 4,
  },
  labelText: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: glassBorders.subtle,
    marginVertical: spacing.md,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  gradientPill: {
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    minWidth: 140,
  },
  glassPill: {
    backgroundColor: glassFills.subtle,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    minWidth: 140,
    borderWidth: 1,
    borderColor: glassBorders.subtle,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  disabled: {
    opacity: 0.5,
  },
  backupCard: {
    marginBottom: spacing.sm,
  },
  backupHeader: {
    marginBottom: spacing.sm,
  },
  backupActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  smallGradientPill: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    minWidth: 70,
  },
  smallGlassPill: {
    backgroundColor: glassFills.subtle,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    minWidth: 70,
    borderWidth: 1,
    borderColor: glassBorders.subtle,
  },
  smallPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  deleteBtn: {
    backgroundColor: 'rgba(255,69,58,0.08)',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
  },
  deleteBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.danger,
  },
  dangerCard: {
    backgroundColor: surfaceTiers.low,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,69,58,0.1)',
  },
  dangerButton: {
    backgroundColor: 'rgba(147,0,10,0.8)',
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: spacing.md,
  },
  dangerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
});
