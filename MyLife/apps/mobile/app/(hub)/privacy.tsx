import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Text, colors, surfaceTiers, spacing, glassBorders } from '@mylife/ui';
import { useEnabledModules } from '@mylife/module-registry';
import type { ModuleDefinition } from '@mylife/module-registry';
import {
  deleteAllData,
  deleteModuleData,
  getModuleTableStats,
  CLOUD_STORAGE_MODULES,
} from '@mylife/db';
import { useDatabase } from '../../components/DatabaseProvider';

/** Per-module data descriptions for the Privacy Dashboard. */
const MODULE_DATA_DESCRIPTIONS: Record<string, string[]> = {
  books: ['Library catalog', 'Reading lists', 'Ratings and reviews (private)', 'Reading sessions', 'Import history'],
  budget: ['Accounts', 'Envelopes', 'Transactions', 'Recurring rules', 'Debt payoff plans'],
  car: ['Vehicles', 'Service records', 'Fuel logs', 'Reminders'],
  closet: ['Wardrobe items', 'Outfits', 'Categories'],
  cycle: ['Period logs', 'Symptoms', 'Predictions'],
  fast: ['Fasting sessions', 'Streaks', 'Settings'],
  flash: ['Decks', 'Cards', 'Study sessions', 'Performance stats'],
  forums: ['Posts and replies (cloud)', 'Bookmarks and drafts (local)'],
  garden: ['Plants', 'Care journal', 'Zones', 'Seed inventory'],
  habits: ['Habits', 'Completions', 'Streaks', 'Timed sessions'],
  health: ['Vitals', 'Body measurements', 'Health events'],
  homes: ['Property listings (cloud)', 'Search history (local)'],
  journal: ['Journal entries', 'Tags', 'Moods'],
  mail: ['Email summaries (local cache)', 'Labels', 'Action items'],
  market: ['Listings and conversations (cloud)', 'Watchlist and drafts (local)'],
  meds: ['Medications', 'Doses', 'Reminders', 'Refills'],
  mood: ['Mood entries', 'Activities', 'Notes'],
  notes: ['Notes', 'Folders', 'Tags'],
  nutrition: ['Food logs', 'Meals', 'Nutrient totals'],
  pets: ['Pet profiles', 'Vet visits', 'Medications', 'Weight logs'],
  recipes: ['Recipes', 'Collections', 'Pantry', 'Grocery lists'],
  rsvp: ['Events', 'RSVPs', 'Guest lists'],
  stars: ['Ratings', 'Reviews', 'Lists'],
  subs: ['Subscriptions', 'Renewal dates', 'Costs'],
  surf: ['Spot ratings (cloud)', 'Saved spots (local)', 'Session logs (local)'],
  trails: ['Hikes', 'Trail logs', 'GPS tracks'],
  voice: ['Voice memos', 'Transcriptions', 'Tags'],
  words: ['Vocabulary', 'Study sessions', 'Progress'],
  workouts: ['Exercises', 'Workouts', 'Body measurements', 'Progress photos'],
};

const CLOUD_INFO: Record<string, string> = {
  forums: 'Posts and replies sync to the server for community visibility. Bookmarks and drafts stay on device.',
  homes: 'Property data syncs for multi-device access. Search history stays on device.',
  market: 'Listings and conversations sync for the marketplace. Watchlist and drafts stay on device.',
  surf: 'Spot ratings sync for the community. Saved spots and session logs stay on device.',
};

interface ModuleStats {
  tables: { tableName: string; rowCount: number }[];
  totalRows: number;
}

export default function PrivacyScreen() {
  const db = useDatabase();
  const router = useRouter();
  const enabledModules = useEnabledModules();

  const cloudModules = enabledModules.filter(
    (mod) => mod.storageType === 'supabase' || mod.storageType === 'drizzle',
  );
  const allLocal = cloudModules.length === 0;

  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [moduleStats, setModuleStats] = useState<Record<string, ModuleStats>>({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [moduleToDelete, setModuleToDelete] = useState<ModuleDefinition | null>(null);
  const [moduleDeleteInput, setModuleDeleteInput] = useState('');

  const loadModuleStats = useCallback((mod: ModuleDefinition) => {
    if (!mod.tablePrefix || moduleStats[mod.id]) return;
    const tables = getModuleTableStats(db, mod.tablePrefix);
    const totalRows = tables.reduce((sum, t) => sum + t.rowCount, 0);
    setModuleStats((prev) => ({ ...prev, [mod.id]: { tables, totalRows } }));
  }, [db, moduleStats]);

  useEffect(() => {
    if (expandedModule) {
      const mod = enabledModules.find((m) => m.id === expandedModule);
      if (mod) loadModuleStats(mod);
    }
  }, [expandedModule, enabledModules, loadModuleStats]);

  const handleDelete = () => {
    if (deleteInput !== 'DELETE') return;
    deleteAllData(db);
    setShowDeleteModal(false);
    // Navigate to fresh state
    router.replace('/');
  };

  const handleDeleteModule = (mod: ModuleDefinition) => {
    if (!mod.tablePrefix) return;
    setModuleToDelete(mod);
    setModuleDeleteInput('');
  };

  const confirmDeleteModule = () => {
    if (!moduleToDelete?.tablePrefix) return;
    if (moduleDeleteInput !== moduleToDelete.name) return;
    const result = deleteModuleData(db, moduleToDelete.id, moduleToDelete.tablePrefix);
    setModuleStats((prev) => {
      const next = { ...prev };
      delete next[moduleToDelete.id];
      return next;
    });
    const isCloud = result.hasCloudData;
    setModuleToDelete(null);
    setModuleDeleteInput('');
    if (isCloud) {
      Alert.alert(
        'Cloud Data',
        `Local data for ${result.moduleId} has been deleted. Cloud data must be deleted separately from your account settings on the server.`,
      );
    }
  };

  const sortedModules = [...enabledModules].sort((a, b) => a.name.localeCompare(b.name));

  // Compute total DB size estimate
  const totalRecords = Object.values(moduleStats).reduce((sum, s) => sum + s.totalRows, 0);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      {/* Page header */}
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Privacy Dashboard</Text>
      </View>

      {/* Storage visualization */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>STORAGE OVERVIEW</Text>
        <View style={styles.card}>
          <Text style={styles.statNumber}>{totalRecords.toLocaleString()}</Text>
          <Text style={styles.captionText}>Total records across all modules</Text>

          <View style={styles.complianceGrid}>
            <ComplianceRow
              icon="🗄️"
              label="Data stored locally"
              status={allLocal ? 'All Local' : `${cloudModules.length} use cloud`}
              isGreen={allLocal}
            />
            <ComplianceRow icon="📊" label="Analytics & telemetry" status="None" isGreen />
            <ComplianceRow icon="📦" label="Data export" status="Available" isGreen />
            <ComplianceRow icon="🚫" label="Ads shown" status="None. Ever." isGreen />
          </View>
        </View>
      </View>

      {/* Data Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>DATA ACTIONS</Text>
        <View style={styles.card}>
          <Pressable style={styles.actionRow} onPress={() => router.push('/(hub)/backup')}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bodyText}>Export All Data</Text>
              <Text style={styles.captionText}>
                CSV, JSON, and Markdown. Every module.
              </Text>
            </View>
            <Text style={styles.chevron}>{'>'}</Text>
          </Pressable>
        </View>
      </View>

      {/* Per-Module Accordion */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>MODULE DATA</Text>
        {sortedModules.map((mod) => {
          const isExpanded = expandedModule === mod.id;
          const stats = moduleStats[mod.id];
          const isCloud = mod.storageType === 'supabase' || mod.storageType === 'drizzle';
          const descriptions = MODULE_DATA_DESCRIPTIONS[mod.id] ?? [];
          const cloudInfo = CLOUD_INFO[mod.id];

          return (
            <View key={mod.id} style={[styles.card, styles.moduleCard]}>
              <Pressable
                style={styles.moduleHeader}
                onPress={() => setExpandedModule(isExpanded ? null : mod.id)}
              >
                <View style={styles.iconCircle}>
                  <Text style={styles.moduleIcon}>{mod.icon}</Text>
                </View>
                <Text style={styles.moduleName}>{mod.name}</Text>
                {stats && (
                  <Text style={styles.recordCount}>{stats.totalRows}</Text>
                )}
                <View style={isCloud ? styles.cloudBadge : styles.localBadge}>
                  <Text style={isCloud ? styles.cloudBadgeText : styles.localBadgeText}>
                    {isCloud ? 'CLOUD' : 'LOCAL'}
                  </Text>
                </View>
                <Text style={styles.chevron}>
                  {isExpanded ? '\u25B4' : '\u25BE'}
                </Text>
              </Pressable>

              {isExpanded && (
                <View style={styles.expandedContent}>
                  <View style={styles.expandedInner}>
                    {mod.tablePrefix && (
                      <Text style={styles.monoRow}>
                        Tables: {mod.tablePrefix}*
                      </Text>
                    )}
                    {stats && (
                      <Text style={styles.monoRow}>
                        {stats.tables.length} table{stats.tables.length !== 1 ? 's' : ''}, {stats.totalRows} row{stats.totalRows !== 1 ? 's' : ''} total
                      </Text>
                    )}
                    {descriptions.map((desc, i) => (
                      <View key={i} style={styles.dataRow}>
                        <Text style={styles.dotPrefix}>·</Text>
                        <Text style={styles.dataRowText}>{desc}</Text>
                      </View>
                    ))}
                  </View>
                  {isCloud && cloudInfo && (
                    <View style={styles.cloudInfo}>
                      <Text style={styles.cloudInfoIcon}>☁️</Text>
                      <Text style={styles.cloudInfoText}>{cloudInfo}</Text>
                    </View>
                  )}
                  {mod.tablePrefix && (
                    <Pressable
                      style={styles.deleteModuleButton}
                      onPress={() => handleDeleteModule(mod)}
                    >
                      <Text style={styles.deleteModuleButtonText}>Delete {mod.name} Data</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Destructive zone */}
      <View style={[styles.section, styles.destructiveZone]}>
        <Text style={styles.sectionHeader}>DANGER ZONE</Text>
        <View style={styles.card}>
          <Pressable onPress={() => setShowDeleteModal(true)}>
            <Text style={styles.dangerText}>Delete All My Data</Text>
            <Text style={styles.captionText}>
              Permanently removes everything. Cannot be undone.
            </Text>
          </Pressable>
        </View>
        <Pressable style={styles.dangerButton} onPress={() => setShowDeleteModal(true)}>
          <Text style={styles.dangerButtonText}>Delete All Data</Text>
        </Pressable>
      </View>

      {/* Delete All Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Delete All Data</Text>
            <Text style={styles.modalText}>
              This will permanently delete all data across all modules. This cannot be undone.
            </Text>
            <Text style={styles.modalLabel}>Type DELETE to confirm:</Text>
            <TextInput
              value={deleteInput}
              onChangeText={setDeleteInput}
              placeholder="Type DELETE"
              placeholderTextColor={colors.textTertiary}
              style={styles.modalInput}
              autoCapitalize="characters"
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => { setShowDeleteModal(false); setDeleteInput(''); }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.confirmButton,
                  { opacity: deleteInput === 'DELETE' ? 1 : 0.4 },
                ]}
                disabled={deleteInput !== 'DELETE'}
                onPress={handleDelete}
              >
                <Text style={styles.confirmButtonText}>Delete Everything</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Module Delete Confirmation Modal (R17.2: two-step) */}
      <Modal
        visible={moduleToDelete !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setModuleToDelete(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>
              Delete {moduleToDelete?.name} Data
            </Text>
            <Text style={styles.modalText}>
              This will permanently delete all {moduleToDelete?.name} data and disable the module. This cannot be undone.
            </Text>
            {moduleToDelete && CLOUD_STORAGE_MODULES.has(moduleToDelete.id) && (
              <Text style={styles.modalCloudWarning}>
                This module also stores data in the cloud. Local data will be deleted immediately. Cloud data deletion will be handled separately.
              </Text>
            )}
            <Text style={styles.modalLabel}>
              Type {moduleToDelete?.name} to confirm:
            </Text>
            <TextInput
              value={moduleDeleteInput}
              onChangeText={setModuleDeleteInput}
              placeholder={`Type ${moduleToDelete?.name ?? ''}`}
              placeholderTextColor={colors.textTertiary}
              style={styles.modalInput}
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => { setModuleToDelete(null); setModuleDeleteInput(''); }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.confirmButton,
                  { opacity: moduleDeleteInput === moduleToDelete?.name ? 1 : 0.4 },
                ]}
                disabled={moduleDeleteInput !== moduleToDelete?.name}
                onPress={confirmDeleteModule}
              >
                <Text style={styles.confirmButtonText}>Delete Data</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* The Pledge */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>THE PLEDGE</Text>
        <View style={styles.pledgeCard}>
          <Text style={styles.pledgeText}>
            MyLife is built on seven commitments that protect your data,
            your money, and your right to leave.
          </Text>
          <Pressable onPress={() => router.push('/(hub)/sharing')}>
            <Text style={styles.pledgeLink}>Review sharing preferences</Text>
          </Pressable>
        </View>
        <Text style={styles.pledgeFooter}>
          Pledge version 1.0 -- Any changes will be documented publicly.
        </Text>
      </View>
    </ScrollView>
  );
}

function ComplianceRow({
  icon,
  label,
  status,
  isGreen,
}: {
  icon: string;
  label: string;
  status: string;
  isGreen: boolean;
}) {
  return (
    <View style={styles.complianceRow}>
      <Text style={styles.complianceIcon}>{icon}</Text>
      <Text style={styles.complianceLabel}>{label}</Text>
      <View style={isGreen ? styles.greenPill : styles.amberPill}>
        <Text style={isGreen ? styles.greenPillText : styles.amberPillText}>
          {status}
        </Text>
      </View>
    </View>
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
  chevron: {
    fontSize: 14,
    color: colors.textTertiary,
  },

  // Storage stat
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },

  // Compliance
  complianceGrid: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: glassBorders.subtle,
    paddingTop: spacing.sm,
  },
  complianceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  complianceIcon: {
    fontSize: 18,
  },
  complianceLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  greenPill: {
    backgroundColor: 'rgba(48,209,88,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  greenPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.success,
  },
  amberPill: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  amberPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#F59E0B',
  },

  // Actions
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },

  // Module accordion
  moduleCard: {
    marginBottom: spacing.sm,
  },
  moduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${colors.hubAccent}1A`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleIcon: {
    fontSize: 18,
  },
  moduleName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  recordCount: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
    marginRight: 8,
  },
  localBadge: {
    backgroundColor: 'rgba(48,209,88,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginRight: 8,
  },
  localBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.success,
    letterSpacing: 0.5,
  },
  cloudBadge: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginRight: 8,
  },
  cloudBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F59E0B',
    letterSpacing: 0.5,
  },
  expandedContent: {
    paddingLeft: 48,
    paddingTop: spacing.sm,
  },
  expandedInner: {
    backgroundColor: surfaceTiers.lowest,
    borderRadius: 12,
    padding: spacing.sm,
  },
  monoRow: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: colors.textTertiary,
    marginBottom: 4,
  },
  dataRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  dotPrefix: {
    fontSize: 13,
    color: colors.textTertiary,
  },
  dataRowText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  cloudInfo: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    padding: 10,
    backgroundColor: surfaceTiers.lowest,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.2)',
    borderRadius: 12,
  },
  cloudInfoIcon: {
    fontSize: 16,
  },
  cloudInfoText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  deleteModuleButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,69,58,0.3)',
    backgroundColor: 'rgba(255,69,58,0.08)',
    alignSelf: 'flex-start',
  },
  deleteModuleButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.danger,
  },

  // Destructive zone
  destructiveZone: {
    marginTop: spacing.lg,
    backgroundColor: 'rgba(147,0,10,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(147,0,10,0.1)',
    borderRadius: 16,
    padding: spacing.md,
  },
  dangerText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.danger,
  },
  dangerButton: {
    backgroundColor: 'rgba(147,0,10,0.8)',
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  dangerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },

  // Modal
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: surfaceTiers.high,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: glassBorders.subtle,
    padding: spacing.lg,
    width: '90%',
    maxWidth: 420,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  modalText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  modalCloudWarning: {
    fontSize: 14,
    color: '#F59E0B',
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  modalLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: glassBorders.subtle,
    backgroundColor: surfaceTiers.lowest,
    color: colors.text,
    borderRadius: 12,
    padding: 10,
    fontSize: 14,
    marginBottom: spacing.md,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  cancelButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: glassBorders.subtle,
    backgroundColor: surfaceTiers.low,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  confirmButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.danger,
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },

  // Pledge
  pledgeCard: {
    backgroundColor: surfaceTiers.low,
    borderRadius: 16,
    padding: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.hubAccent,
  },
  pledgeText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 24,
    marginBottom: spacing.sm,
  },
  pledgeLink: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.hubAccent,
  },
  pledgeFooter: {
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
