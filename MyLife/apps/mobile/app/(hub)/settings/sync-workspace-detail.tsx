/**
 * Settings > Sync Workspace Detail.
 *
 * Shows members of a workspace with roles, last-seen timestamps, and
 * actions: invite device, remove device (with confirmation), and
 * archive workspace (group/community only).
 */
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, colors, spacing, surfaceTiers } from '@mylife/ui';
import {
  getWorkspace,
  getWorkspaceMembers,
  getSecurityPreferenceWithDefault,
  upsertSecurityPreference,
  removeWorkspaceMember,
  archiveWorkspace,
} from '@mylife/sync';
import type { SyncWorkspace, SyncWorkspaceMember } from '@mylife/sync';
import { useDatabase } from '../../../components/DatabaseProvider';

const ROLE_COLORS: Record<string, string> = {
  owner: colors.primary,
  admin: colors.tertiary,
  member: colors.textSecondary,
  viewer: colors.outline,
};

const DISAPPEAR_OPTIONS = [
  { label: '24h', seconds: 24 * 60 * 60 },
  { label: '7d', seconds: 7 * 24 * 60 * 60 },
  { label: '30d', seconds: 30 * 24 * 60 * 60 },
] as const;
const DEFAULT_DISAPPEAR_SECONDS = 7 * 24 * 60 * 60;

export default function SyncWorkspaceDetailScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { workspaceId } = useLocalSearchParams<{ workspaceId: string }>();
  const [workspace, setWorkspace] = useState<SyncWorkspace | null>(null);
  const [members, setMembers] = useState<SyncWorkspaceMember[]>([]);
  const [encryptionRequired, setEncryptionRequired] = useState(false);
  const [disappearingMessagesEnabled, setDisappearingMessagesEnabled] = useState(false);
  const [disappearAfterSeconds, setDisappearAfterSeconds] = useState<number>(
    DEFAULT_DISAPPEAR_SECONDS,
  );

  const refresh = useCallback(() => {
    if (!workspaceId) return;
    setWorkspace(getWorkspace(db, workspaceId));
    setMembers(getWorkspaceMembers(db, workspaceId));
    const pref = getSecurityPreferenceWithDefault(db, 'workspace', workspaceId);
    if (pref) {
      setEncryptionRequired(pref.encryptionMode === 'required');
      setDisappearingMessagesEnabled(pref.disappearingMessagesEnabled);
      if (pref.disappearAfterSeconds) {
        setDisappearAfterSeconds(pref.disappearAfterSeconds);
      }
    }
  }, [db, workspaceId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleRemoveMember = useCallback(
    (deviceId: string) => {
      if (!workspaceId) return;
      Alert.alert(
        'Remove Device',
        'This device will lose access to workspace data. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => {
              removeWorkspaceMember(db, workspaceId, deviceId);
              refresh();
            },
          },
        ],
      );
    },
    [db, workspaceId, refresh],
  );

  const handleArchive = useCallback(() => {
    if (!workspaceId || !workspace) return;
    if (workspace.workspaceType === 'personal') return;
    Alert.alert(
      'Archive Workspace',
      'This workspace will be hidden and no longer sync. Data is preserved. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: () => {
            archiveWorkspace(db, workspaceId);
            router.back();
          },
        },
      ],
    );
  }, [db, workspaceId, workspace, router]);

  const updateWorkspaceSecurity = useCallback(
    (next: {
      encryptionRequired?: boolean;
      disappearingEnabled?: boolean;
      disappearSeconds?: number;
    }) => {
      if (!workspaceId) return;
      const nextEncryptionRequired = next.encryptionRequired ?? encryptionRequired;
      const nextDisappearingEnabled = next.disappearingEnabled ?? disappearingMessagesEnabled;
      const nextDisappearSeconds = next.disappearSeconds ?? disappearAfterSeconds;
      upsertSecurityPreference(db, {
        subjectType: 'workspace',
        subjectId: workspaceId,
        encryptionMode: nextEncryptionRequired ? 'required' : 'opportunistic',
        disappearingMessagesEnabled: nextDisappearingEnabled,
        disappearAfterSeconds: nextDisappearingEnabled ? nextDisappearSeconds : null,
        updatedAt: new Date().toISOString(),
      });
    },
    [db, workspaceId, encryptionRequired, disappearingMessagesEnabled, disappearAfterSeconds],
  );

  const toggleEncryption = useCallback(
    (value: boolean) => {
      setEncryptionRequired(value);
      updateWorkspaceSecurity({ encryptionRequired: value });
    },
    [updateWorkspaceSecurity],
  );

  const toggleDisappearingMessages = useCallback(
    (value: boolean) => {
      setDisappearingMessagesEnabled(value);
      updateWorkspaceSecurity({ disappearingEnabled: value });
    },
    [updateWorkspaceSecurity],
  );

  const selectDisappearAfter = useCallback(
    (seconds: number) => {
      setDisappearAfterSeconds(seconds);
      updateWorkspaceSecurity({ disappearSeconds: seconds });
    },
    [updateWorkspaceSecurity],
  );

  if (!workspace) {
    return (
      <View style={styles.screen}>
        <View style={styles.container}>
          <Text style={styles.emptyBody}>Workspace not found.</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{workspace.displayName}</Text>
        <Text style={styles.subtitle}>
          {workspace.workspaceType} workspace · Key v{workspace.currentKeyVersion}
          {workspace.rotatedAt ? ` · Rotated ${workspace.rotatedAt.slice(0, 10)}` : ''}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Security</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.copy}>
            <Text style={styles.deviceName}>Require Encryption</Text>
            <Text style={styles.metaText}>Both sides must confirm before sync.</Text>
          </View>
          <Switch
            value={encryptionRequired}
            onValueChange={toggleEncryption}
            trackColor={{ false: surfaceTiers.highest, true: colors.primary }}
            thumbColor={colors.text}
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <View style={styles.copy}>
            <Text style={styles.deviceName}>Disappearing Messages</Text>
            <Text style={styles.metaText}>Enabled only when all sides confirm.</Text>
          </View>
          <Switch
            value={disappearingMessagesEnabled}
            onValueChange={toggleDisappearingMessages}
            trackColor={{ false: surfaceTiers.highest, true: colors.primary }}
            thumbColor={colors.text}
          />
        </View>
        {disappearingMessagesEnabled ? (
          <View style={styles.optionRow}>
            {DISAPPEAR_OPTIONS.map((option) => {
              const active = option.seconds === disappearAfterSeconds;
              return (
                <Pressable
                  key={option.seconds}
                  style={[styles.optionChip, active && styles.optionChipActive]}
                  onPress={() => selectDisappearAfter(option.seconds)}
                >
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      {/* Members */}
      <Text style={styles.sectionTitle}>
        Members ({members.length})
      </Text>

      {members.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyBody}>No members in this workspace.</Text>
        </View>
      ) : null}

      {members.map((member) => (
        <View key={member.deviceId} style={styles.card}>
          <View style={styles.row}>
            <View style={styles.copy}>
              <Text style={styles.deviceName}>
                {member.deviceId.slice(0, 12)}...
              </Text>
              <View style={styles.metaRow}>
                <View
                  style={[
                    styles.roleBadge,
                    { backgroundColor: ROLE_COLORS[member.role] ?? colors.outline },
                  ]}
                >
                  <Text style={styles.roleBadgeText}>{member.role}</Text>
                </View>
                <Text style={styles.metaText}>
                  Joined {member.invitedAt.slice(0, 10)}
                </Text>
              </View>
            </View>
            {member.role !== 'owner' ? (
              <Pressable
                onPress={() => handleRemoveMember(member.deviceId)}
                accessibilityLabel={`remove-${member.deviceId}`}
              >
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ))}

      {/* Invite */}
      <Pressable
        style={styles.actionButton}
        onPress={() =>
          router.push({
            pathname: '/(hub)/settings/pair-device',
            params: { workspaceId: workspace.id },
          } as never)
        }
        accessibilityLabel="invite-device"
      >
        <Text style={styles.actionButtonText}>Invite Device</Text>
      </Pressable>

      {/* Archive (group/community only) */}
      {workspace.workspaceType !== 'personal' ? (
        <Pressable
          style={styles.dangerButton}
          onPress={handleArchive}
          accessibilityLabel="archive-workspace"
        >
          <Text style={styles.dangerButtonText}>Archive Workspace</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.md },
  header: { gap: spacing.xs, marginBottom: spacing.sm },
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: surfaceTiers.high,
    borderRadius: 16,
    padding: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  copy: { flex: 1, gap: 4 },
  deviceName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleBadgeText: {
    color: colors.background,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metaText: { color: colors.textSecondary, fontSize: 12 },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  optionChip: {
    backgroundColor: surfaceTiers.low,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  optionChipActive: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primary,
  },
  optionText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  optionTextActive: { color: colors.text },
  removeText: { color: colors.danger, fontSize: 14, fontWeight: '600' },
  emptyBody: { color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
  actionButton: {
    backgroundColor: colors.primaryContainer,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  actionButtonText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  dangerButton: {
    backgroundColor: colors.errorContainer,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  dangerButtonText: { color: colors.danger, fontSize: 15, fontWeight: '600' },
});
