import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, colors, surfaceTiers, spacing, glassFills, glassBorders } from '@mylife/ui';
import { SOCIAL_CAPABLE_MODULES } from '@mylife/social';
import {
  getAllSharingPreferences,
  getActiveSharingPreferences,
  getSharingConsent,
  recordSharingConsent,
  revokeSharingConsent,
  updateSharingPreference,
  revokeAllSharing,
  deleteAllSharingPreferences,
  type SharingPreferenceView,
  type SharingConsent as SharingConsentType,
} from '@mylife/db';
import { useDatabase } from '../../components/DatabaseProvider';

/** Data types available for sharing, per module. */
const MODULE_DATA_TYPES: Record<string, string[]> = {
  books: ['reading_activity', 'reviews', 'shelves'],
  budget: ['goals', 'streaks'],
  fast: ['completions', 'streaks'],
  forums: ['threads', 'replies'],
  habits: ['completions', 'streaks'],
  health: ['milestones'],
  market: ['listings', 'reviews'],
  meds: ['adherence_streaks'],
  recipes: ['cooked', 'created'],
  surf: ['sessions', 'spots'],
  words: ['learned', 'streaks'],
  workouts: ['completions', 'personal_bests', 'streaks'],
};

function humanize(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function SharingScreen() {
  const db = useDatabase();
  const [consent, setConsent] = useState<SharingConsentType>({ consented: false, consentedAt: null });
  const [preferences, setPreferences] = useState<SharingPreferenceView[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setConsent(getSharingConsent(db));
    setPreferences(getAllSharingPreferences(db));
    setActiveCount(getActiveSharingPreferences(db).length);
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleConsent = () => {
    recordSharingConsent(db);
    refresh();
  };

  const handleRevokeConsent = () => {
    Alert.alert(
      'Revoke Sharing Consent?',
      'This will disable all data sharing across all modules. Your shared data on the cloud will remain until you explicitly delete it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: () => {
            revokeSharingConsent(db);
            refresh();
          },
        },
      ],
    );
  };

  const handleToggle = (moduleId: string, dataType: string, shared: boolean) => {
    updateSharingPreference(db, { moduleId, dataType, shared });
    refresh();
  };

  const handleRevokeAll = () => {
    Alert.alert(
      'Disable All Sharing?',
      'This will turn off sharing for all data types across all modules.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disable All',
          style: 'destructive',
          onPress: () => {
            revokeAllSharing(db);
            refresh();
          },
        },
      ],
    );
  };

  const handleDeleteAll = () => {
    Alert.alert(
      'Delete All Shared Data?',
      'This will remove all sharing preferences and request deletion of your shared data from the cloud. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: () => {
            deleteAllSharingPreferences(db);
            revokeSharingConsent(db);
            refresh();
          },
        },
      ],
    );
  };

  const isShared = (moduleId: string, dataType: string): boolean => {
    return preferences.some(
      (p) => p.moduleId === moduleId && p.dataType === dataType && p.shared,
    );
  };

  // Consent gate: show consent flow first
  if (!consent.consented) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.breadcrumb}>PRIVACY CONTROL CENTER</Text>
          <Text style={styles.pageTitle}>SHARING PREFERENCES</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>DATA SHARING CONSENT</Text>
          <View style={styles.card}>
            <Text style={styles.consentText}>
              MyLife social features let you share activity with friends and the community.
              Before any data is shared, you need to review and accept these principles:
            </Text>
            <View style={styles.principleList}>
              <Text style={styles.principle}>
                1. All sharing is opt-in. Nothing is shared without your explicit choice.
              </Text>
              <Text style={styles.principle}>
                2. You choose exactly which data types from which modules are shared.
              </Text>
              <Text style={styles.principle}>
                3. Shared data is anonymized by default.
              </Text>
              <Text style={styles.principle}>
                4. We never sell your data. Ever.
              </Text>
              <Text style={styles.principle}>
                5. You can delete all shared data at any time from this screen.
              </Text>
            </View>
            <Pressable onPress={handleConsent}>
              <LinearGradient
                colors={[colors.hubAccentLight, colors.hubAccent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaButton}
              >
                <Text style={styles.ctaText}>I Understand, Enable Sharing Controls</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      {/* Page header */}
      <View style={styles.header}>
        <Text style={styles.breadcrumb}>PRIVACY CONTROL CENTER</Text>
        <Text style={styles.pageTitle}>SHARING PREFERENCES</Text>
      </View>

      {/* Global sharing toggle */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>GLOBAL SHARING</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bodyText}>Active sharing</Text>
              <Text style={styles.captionText}>
                {activeCount} data {activeCount === 1 ? 'type' : 'types'} shared
              </Text>
            </View>
            <Switch
              value={activeCount > 0}
              onValueChange={(val) => {
                if (!val) handleRevokeAll();
              }}
              trackColor={{ false: surfaceTiers.highest, true: colors.hubAccent }}
              thumbColor={colors.text}
            />
          </View>
          <Text style={styles.helpText}>
            All shared data is anonymized. You control every toggle below.
          </Text>
        </View>
      </View>

      {/* Active collaborators (placeholder) */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>ACTIVE COLLABORATORS</Text>
        <View style={styles.card}>
          <View style={styles.avatarRow}>
            {['TJ', 'KM', 'AB'].map((initials) => (
              <View key={initials} style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            ))}
            <Text style={styles.captionTextInline}>3 collaborators</Text>
          </View>
        </View>
      </View>

      {/* Per-module sharing cards (accordion) */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>MODULE SHARING</Text>
        {SOCIAL_CAPABLE_MODULES.map((moduleId) => {
          const dataTypes = MODULE_DATA_TYPES[moduleId] ?? [];
          if (dataTypes.length === 0) return null;
          const isExpanded = expandedModule === moduleId;
          const anyShared = dataTypes.some((dt) => isShared(moduleId, dt));
          const allShared = dataTypes.every((dt) => isShared(moduleId, dt));

          return (
            <View key={moduleId} style={[styles.card, styles.moduleCard]}>
              <Pressable
                style={styles.moduleHeader}
                onPress={() => setExpandedModule(isExpanded ? null : moduleId)}
              >
                <Text style={styles.moduleName}>{humanize(moduleId)}</Text>
                <View style={allShared ? styles.publicBadge : anyShared ? styles.restrictedBadge : styles.privateBadge}>
                  <Text style={allShared ? styles.publicBadgeText : anyShared ? styles.restrictedBadgeText : styles.privateBadgeText}>
                    {allShared ? 'PUBLIC' : anyShared ? 'RESTRICTED' : 'PRIVATE'}
                  </Text>
                </View>
                <Text style={styles.chevron}>{isExpanded ? '\u25B4' : '\u25BE'}</Text>
              </Pressable>

              {isExpanded && (
                <View style={styles.expandedContent}>
                  {dataTypes.map((dataType) => (
                    <View key={dataType} style={styles.toggleRow}>
                      <Text style={styles.toggleLabel}>{humanize(dataType)}</Text>
                      <View style={styles.toggleRight}>
                        <View style={isShared(moduleId, dataType) ? styles.editBadge : styles.viewBadge}>
                          <Text style={isShared(moduleId, dataType) ? styles.editBadgeText : styles.viewBadgeText}>
                            {isShared(moduleId, dataType) ? 'Can Edit' : 'View Only'}
                          </Text>
                        </View>
                        <Switch
                          value={isShared(moduleId, dataType)}
                          onValueChange={(val) => handleToggle(moduleId, dataType, val)}
                          trackColor={{ false: surfaceTiers.highest, true: colors.hubAccent }}
                          thumbColor={colors.text}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Sharing activity log */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>SHARING ACTIVITY</Text>
        <View style={styles.card}>
          <View style={styles.activityRow}>
            <View style={styles.timelineDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.activityText}>Sharing preferences updated</Text>
              <Text style={styles.activityTime}>Just now</Text>
            </View>
          </View>
          {consent.consentedAt && (
            <View style={styles.activityRow}>
              <View style={styles.timelineDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.activityText}>Sharing consent granted</Text>
                <Text style={styles.activityTime}>
                  {new Date(consent.consentedAt).toLocaleDateString()}
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Data Controls (danger zone) */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>DATA CONTROLS</Text>
        <View style={styles.card}>
          <Pressable style={styles.dangerRow} onPress={handleRevokeAll}>
            <Text style={styles.bodyText}>Disable All Sharing</Text>
            <Text style={styles.captionText}>Turns off all toggles above</Text>
          </Pressable>
          <View style={styles.separator} />
          <Pressable style={styles.dangerRow} onPress={handleRevokeConsent}>
            <Text style={styles.bodyText}>Revoke Consent</Text>
            <Text style={styles.captionText}>Disables sharing and resets consent</Text>
          </Pressable>
          <View style={styles.separator} />
          <Pressable style={styles.dangerRow} onPress={handleDeleteAll}>
            <Text style={styles.dangerText}>Delete All Shared Data</Text>
            <Text style={styles.dangerCaption}>
              Permanently removes all sharing data
            </Text>
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
  breadcrumb: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  captionTextInline: {
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  helpText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  chevron: {
    fontSize: 14,
    color: colors.textTertiary,
    marginLeft: spacing.sm,
  },
  separator: {
    height: 1,
    backgroundColor: glassBorders.subtle,
    marginVertical: spacing.sm,
  },

  // Consent
  consentText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  principleList: {
    marginBottom: spacing.lg,
  },
  principle: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  ctaButton: {
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },

  // Avatar row
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.hubAccent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -8,
    borderWidth: 2,
    borderColor: surfaceTiers.low,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },

  // Module accordion
  moduleCard: {
    marginBottom: spacing.sm,
  },
  moduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  moduleName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  publicBadge: {
    backgroundColor: `${colors.hubAccent}1A`,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  publicBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.hubAccent,
    letterSpacing: 0.5,
  },
  restrictedBadge: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  restrictedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F59E0B',
    letterSpacing: 0.5,
  },
  privateBadge: {
    backgroundColor: surfaceTiers.highest,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  privateBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  expandedContent: {
    paddingTop: spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: glassBorders.subtle,
  },
  toggleLabel: {
    fontSize: 14,
    color: colors.text,
  },
  toggleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editBadge: {
    backgroundColor: `${colors.hubAccent}1A`,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  editBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.hubAccent,
  },
  viewBadge: {
    backgroundColor: surfaceTiers.highest,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  viewBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },

  // Activity timeline
  activityRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.hubAccent,
    marginTop: 5,
  },
  activityText: {
    fontSize: 14,
    color: colors.text,
  },
  activityTime: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2,
  },

  // Danger zone
  dangerRow: {
    paddingVertical: spacing.sm,
  },
  dangerText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.danger,
  },
  dangerCaption: {
    fontSize: 13,
    color: colors.danger,
    lineHeight: 18,
    marginTop: 4,
    opacity: 0.8,
  },
});
