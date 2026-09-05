/**
 * Settings > Sync Workspaces.
 *
 * Lists all active sync workspaces (personal, group, community) with
 * member counts and last-synced timestamps. Tapping a workspace navigates
 * to the workspace detail screen. A "Create Workspace" action sits at
 * the bottom.
 */
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, colors, spacing, surfaceTiers } from '@mylife/ui';
import {
  getWorkspaces,
  getWorkspaceMembers,
  createWorkspace,
  getDeviceIdentity,
} from '@mylife/sync';
import type { SyncWorkspace, SyncWorkspaceMember } from '@mylife/sync';
import { useDatabase } from '../../../components/DatabaseProvider';

const WORKSPACE_TYPE_ICONS: Record<string, string> = {
  personal: '🏠',
  group: '👥',
  community: '🌐',
};

interface WorkspaceRow {
  workspace: SyncWorkspace;
  memberCount: number;
}

export default function SyncWorkspacesScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [rows, setRows] = useState<WorkspaceRow[]>([]);

  const refresh = useCallback(() => {
    const workspaces = getWorkspaces(db);
    const mapped: WorkspaceRow[] = workspaces.map((ws) => {
      const members: SyncWorkspaceMember[] = getWorkspaceMembers(db, ws.id);
      return { workspace: ws, memberCount: members.length };
    });
    // Personal workspace always first
    mapped.sort((a, b) => {
      if (a.workspace.workspaceType === 'personal') return -1;
      if (b.workspace.workspaceType === 'personal') return 1;
      return a.workspace.createdAt.localeCompare(b.workspace.createdAt);
    });
    setRows(mapped);
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCreateWorkspace = useCallback(() => {
    const identity = getDeviceIdentity(db);
    if (!identity) return;
    const id = `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    createWorkspace(db, {
      id,
      displayName: 'New Workspace',
      workspaceType: 'group',
      createdByDeviceId: identity.publicKey,
      createdAt: now,
      rotatedAt: null,
      currentKeyVersion: 1,
      archivedAt: null,
    });
    refresh();
  }, [db, refresh]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Sync Workspaces</Text>
        <Text style={styles.subtitle}>
          Manage your personal, group, and community sync workspaces.
        </Text>
      </View>

      {rows.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyTitle}>No workspaces</Text>
          <Text style={styles.emptyBody}>
            Workspaces are created automatically when you enable sync. You can
            also create group workspaces to share data with other devices.
          </Text>
        </View>
      ) : null}

      {rows.map(({ workspace, memberCount }) => (
        <Pressable
          key={workspace.id}
          style={styles.card}
          onPress={() =>
            router.push({
              pathname: '/(hub)/settings/sync-workspace-detail',
              params: { workspaceId: workspace.id },
            } as never)
          }
          accessibilityLabel={`workspace-${workspace.id}`}
        >
          <View style={styles.row}>
            <Text style={styles.icon}>
              {WORKSPACE_TYPE_ICONS[workspace.workspaceType] ?? '📁'}
            </Text>
            <View style={styles.copy}>
              <Text style={styles.wsName}>{workspace.displayName}</Text>
              <Text style={styles.wsMeta}>
                {workspace.workspaceType} · {memberCount} member
                {memberCount !== 1 ? 's' : ''}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </View>
        </Pressable>
      ))}

      <Pressable
        style={styles.createButton}
        onPress={handleCreateWorkspace}
        accessibilityLabel="create-workspace"
      >
        <Text style={styles.createButtonText}>+ Create Workspace</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.md },
  header: { gap: spacing.xs, marginBottom: spacing.sm },
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  card: {
    backgroundColor: surfaceTiers.high,
    borderRadius: 16,
    padding: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { fontSize: 24 },
  copy: { flex: 1, gap: 2 },
  wsName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  wsMeta: { color: colors.textSecondary, fontSize: 13 },
  chevron: { color: colors.textSecondary, fontSize: 20 },
  emptyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  emptyBody: { color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
  createButton: {
    backgroundColor: colors.primaryContainer,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  createButtonText: { color: colors.text, fontSize: 15, fontWeight: '600' },
});
