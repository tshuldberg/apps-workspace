import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, colors, surfaceTiers, spacing, borderRadius, glassFills, glassBorders } from '@mylife/ui';
import {
  GA_MODULE_IDS,
  PUBLIC_BETA_MODULE_IDS,
  HEALTH_DATA_MODULE_IDS,
  MODULE_METADATA,
} from '@mylife/module-registry';
import { useLocalAuth } from '@mylife/auth';
import {
  listAllHealthConsents,
  withdrawHealthConsent,
  type HealthConsent,
} from '@mylife/db';
import { useDatabase } from '../../components/DatabaseProvider';
import { useEntitlements, usePayment } from '../../components/EntitlementsProvider';
import {
  getModeConfig,
  getStoredEntitlement,
  refreshEntitlementFromServer,
} from '../../lib/entitlements';
import { HUB_TAB_BAR_CLEARANCE } from './_layout';

/* ------------------------------------------------------------------ */
/*  Nav card descriptors                                               */
/* ------------------------------------------------------------------ */

const NAV_CARDS = [
  { title: 'Insights', subtitle: 'Cross-module correlations and trends', icon: '📊', route: '/(hub)/insights' as const },
  { title: 'Appearance', subtitle: 'Themes, colors, and layout', icon: '🎨', route: '/(hub)/appearance' as const },
  { title: 'Privacy Dashboard', subtitle: 'Review data access and permissions', icon: '🛡', route: '/(hub)/privacy' as const },
  { title: 'Sharing Preferences', subtitle: 'Control what you share', icon: '🔗', route: '/(hub)/sharing' as const },
  { title: 'Import Wizard', subtitle: 'Replace your existing apps', icon: '📥', route: '/(hub)/import-wizard' as const },
  { title: 'Data & Sync', subtitle: 'Manage sync and storage settings', icon: '🔄', route: '/(hub)/data-sync' as const },
  { title: 'Backup & Restore', subtitle: 'Protect your data', icon: '💾', route: '/(hub)/backup' as const },
  { title: 'Module Locks', subtitle: 'PIN-protect sensitive modules', icon: '🔒', route: '/(hub)/module-locks' as const },
] as const;

/* ------------------------------------------------------------------ */
/*  Sync mode options                                                  */
/* ------------------------------------------------------------------ */

const SYNC_MODES = ['Local', 'P2P', 'Cloud'] as const;

export default function SettingsScreen() {
  const router = useRouter();
  const db = useDatabase();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [subAction, setSubAction] = useState<string | null>(null);
  const [healthConsents, setHealthConsents] = useState<HealthConsent[]>([]);

  useEffect(() => {
    setHealthConsents(listAllHealthConsents(db));
  }, [db]);
  const modeConfig = getModeConfig(db);
  const entitlement = getStoredEntitlement(db);
  const entitlementState = useEntitlements();
  const { paymentService, refreshEntitlements } = usePayment();
  const { user, isAuthenticated, signOut } = useLocalAuth();

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const result = await refreshEntitlementFromServer(db);
      if (result.ok) {
        setRefreshMessage('Entitlement refreshed.');
      } else {
        setRefreshMessage(`Refresh failed: ${result.reason}`);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const activeSyncLabel = modeConfig.mode.charAt(0).toUpperCase() + modeConfig.mode.slice(1);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>

      {/* ── Subscription Hero Card ───────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>SUBSCRIPTION</Text>
        {entitlementState.hubUnlocked ? (
          <LinearGradient
            colors={[colors.hubAccentLight, colors.hubAccent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <Text style={styles.heroTitle}>MyLife Pro</Text>
            <Text style={styles.heroSubtitlePro}>
              {GA_MODULE_IDS.length} production modules + {PUBLIC_BETA_MODULE_IDS.length} in public beta unlocked.
              {entitlementState.updateEntitled ? ' Updates active.' : ' Update pack expired.'}
            </Text>
            {entitlementState.purchaseDate && (
              <Text style={styles.heroMeta}>
                Member since {entitlementState.purchaseDate.toLocaleDateString()}
              </Text>
            )}
            <Pressable
              style={styles.heroPillButton}
              onPress={async () => {
                setSubAction('restore');
                try {
                  await paymentService?.restore();
                  await refreshEntitlements();
                } finally {
                  setSubAction(null);
                }
              }}
              disabled={subAction !== null}
            >
              <Text style={styles.heroPillText}>
                {subAction === 'restore' ? 'Restoring...' : 'Manage Plan'}
              </Text>
            </Pressable>
          </LinearGradient>
        ) : (
          <View style={[styles.heroCard, styles.heroCardFree]}>
            <Text style={styles.heroTitleFree}>MyLife Free</Text>
            <Text variant="caption" color={colors.textSecondary} style={{ marginTop: spacing.xs }}>
              MyLife Pro guarantees {GA_MODULE_IDS.length} production-ready modules and includes
              access to {PUBLIC_BETA_MODULE_IDS.length} more in public beta.
            </Text>
            <Pressable
              style={styles.heroPillButtonFree}
              onPress={async () => {
                setSubAction('restore');
                try {
                  await paymentService?.restore();
                  await refreshEntitlements();
                } finally {
                  setSubAction(null);
                }
              }}
              disabled={subAction !== null}
            >
              <Text style={styles.heroPillTextFree}>
                {subAction === 'restore' ? 'Restoring...' : 'Upgrade to Pro'}
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* ── Account ──────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>ACCOUNT</Text>
        <View style={styles.glassCard}>
          {isAuthenticated && user ? (
            <>
              <View style={styles.row}>
                <Text variant="body">Signed in as</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {user.displayName}
                </Text>
              </View>
              <View style={[styles.row, styles.rowBorder]}>
                <Text variant="body">Email</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {user.email}
                </Text>
              </View>
              <Pressable style={[styles.actionButton, styles.dangerButton]} onPress={handleSignOut}>
                <Text variant="label" color={colors.danger}>Sign Out</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text variant="caption" color={colors.textSecondary}>
                Create an account to back up your data and sync across devices.
              </Text>
              <View style={styles.authButtons}>
                <Pressable style={styles.actionButton} onPress={() => router.push('/(auth)/sign-in')}>
                  <Text variant="label">Sign In</Text>
                </Pressable>
                <Pressable style={styles.actionButton} onPress={() => router.push('/(auth)/sign-up')}>
                  <Text variant="label">Create Account</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>

      {/* ── Sync Mode Strategy ───────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>SYNC MODE STRATEGY</Text>
        <View style={styles.segmentContainer}>
          {SYNC_MODES.map((mode) => {
            const isActive = activeSyncLabel === mode;
            return (
              <Pressable
                key={mode}
                style={[styles.segment, isActive && styles.segmentActive]}
                onPress={() => router.push('/(hub)/onboarding-mode')}
              >
                <Text
                  variant="label"
                  style={[
                    styles.segmentText,
                    isActive ? styles.segmentTextActive : styles.segmentTextInactive,
                  ]}
                >
                  {mode}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {modeConfig.serverUrl && (
          <Text variant="caption" color={colors.textSecondary} style={{ marginTop: spacing.xs, paddingHorizontal: spacing.xs }}>
            Server: {modeConfig.serverUrl}
          </Text>
        )}
        <Pressable style={[styles.actionButton, { marginTop: spacing.sm }]} onPress={() => router.push('/(hub)/self-host')}>
          <Text variant="label">Self-Host Setup</Text>
        </Pressable>
      </View>

      {/* ── Navigation Cards ─────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>PRIVACY & DATA</Text>
        <View style={styles.navCardsContainer}>
          {NAV_CARDS.map((card) => (
            <Pressable
              key={card.route}
              style={styles.navCard}
              onPress={() => router.push(card.route)}
            >
              <View style={styles.navCardIconCircle}>
                <Text style={styles.navCardIcon}>{card.icon}</Text>
              </View>
              <View style={styles.navCardText}>
                <Text variant="body">{card.title}</Text>
                <Text variant="caption" color={colors.textSecondary}>{card.subtitle}</Text>
              </View>
              <Text variant="caption" color={colors.hubAccent}>{'>'}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* ── Entitlements ─────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>ENTITLEMENTS</Text>
        <View style={styles.glassCard}>
          <View style={styles.row}>
            <Text variant="body">Sync</Text>
            <Pressable style={styles.actionButton} onPress={() => void handleRefresh()} disabled={isRefreshing}>
              <Text variant="label">{isRefreshing ? 'Refreshing...' : 'Refresh'}</Text>
            </Pressable>
          </View>
          {refreshMessage && (
            <Text variant="caption" color={colors.textSecondary} style={{ marginTop: spacing.xs }}>
              {refreshMessage}
            </Text>
          )}
          {entitlement ? (
            <>
              <View style={[styles.row, styles.rowBorder]}>
                <Text variant="body">Hosted</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {entitlement.hostedActive ? 'ACTIVE' : 'INACTIVE'}
                </Text>
              </View>
              <View style={[styles.row, styles.rowBorder]}>
                <Text variant="body">Self-host</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {entitlement.selfHostLicense ? 'LICENSED' : 'NO LICENSE'}
                </Text>
              </View>
              <View style={[styles.row, styles.rowBorder]}>
                <Text variant="body">Update Pack</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {entitlement.updatePackYear ?? 'None'}
                </Text>
              </View>
              <View style={[styles.row, styles.rowBorder]}>
                <Text variant="body">Storage Tier</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {entitlementState.storageTier.toUpperCase()}
                </Text>
              </View>
            </>
          ) : (
            <Text variant="caption" color={colors.textSecondary}>
              No entitlement cached
            </Text>
          )}
        </View>
      </View>

      {/* ── Health Data Consent ──────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>HEALTH DATA CONSENT</Text>
        <View style={styles.glassCard}>
          <Text variant="caption" color={colors.textSecondary}>
            Modules that collect consumer health data require your consent.
            You can withdraw consent at any time.
          </Text>
          {HEALTH_DATA_MODULE_IDS.map((moduleId) => {
            const meta = MODULE_METADATA[moduleId];
            const consent = healthConsents.find((c) => c.moduleId === moduleId);
            const isActive = consent !== undefined && consent.withdrawnAt === null;
            return (
              <View key={moduleId} style={[styles.row, styles.rowBorder]}>
                <View style={{ flex: 1 }}>
                  <Text variant="body">
                    {meta.icon} {meta.name}
                  </Text>
                  {isActive && consent?.consentedAt && (
                    <Text variant="caption" color={colors.textTertiary}>
                      Consented {new Date(consent.consentedAt).toLocaleDateString()}
                    </Text>
                  )}
                </View>
                {isActive ? (
                  <Pressable
                    style={[styles.actionButton, styles.dangerButton]}
                    onPress={() => {
                      Alert.alert(
                        'Withdraw Consent',
                        `Stop health data collection for ${meta.name}? Existing data will be preserved but no new data will be collected.`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Withdraw',
                            style: 'destructive',
                            onPress: () => {
                              withdrawHealthConsent(db, moduleId);
                              setHealthConsents(listAllHealthConsents(db));
                            },
                          },
                        ],
                      );
                    }}
                  >
                    <Text variant="label" color={colors.danger}>Withdraw</Text>
                  </Pressable>
                ) : (
                  <Text variant="caption" color={colors.textTertiary}>
                    {consent?.withdrawnAt ? 'Withdrawn' : 'Not consented'}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      </View>

      {/* ── Version Badge ────────────────────────────────────── */}
      <View style={styles.versionContainer}>
        <View style={styles.versionBadge}>
          <Text variant="caption" color={colors.textSecondary} style={styles.versionText}>
            MYLIFE BUILD 0.1.0
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.md,
    paddingBottom: HUB_TAB_BAR_CLEARANCE,
  },
  section: {
    marginBottom: spacing.lg,
  },

  /* Section headers */
  sectionHeader: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },

  /* Hero subscription card */
  heroCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    overflow: 'hidden',
  },
  heroCardFree: {
    backgroundColor: surfaceTiers.high,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#4B2700',
  },
  heroTitleFree: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  heroSubtitlePro: {
    fontSize: 14,
    color: '#4B2700',
    opacity: 0.8,
    marginTop: spacing.xs,
  },
  heroMeta: {
    fontSize: 12,
    color: '#4B2700',
    opacity: 0.6,
    marginTop: spacing.xs,
  },
  heroPillButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    backgroundColor: 'rgba(75,39,0,0.25)',
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  heroPillText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4B2700',
  },
  heroPillButtonFree: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    backgroundColor: colors.hubAccent,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  heroPillTextFree: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Glass cards */
  glassCard: {
    backgroundColor: glassFills.subtle,
    borderWidth: 1,
    borderColor: glassBorders.subtle,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },

  /* Sync mode segments */
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: surfaceTiers.lowest,
    borderRadius: borderRadius.pill,
    padding: 3,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
  },
  segmentActive: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: colors.hubAccent,
  },
  segmentTextInactive: {
    color: colors.text,
    opacity: 0.4,
  },

  /* Navigation cards */
  navCardsContainer: {
    gap: spacing.sm,
  },
  navCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: glassFills.subtle,
    borderWidth: 1,
    borderColor: glassBorders.subtle,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  navCardIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: surfaceTiers.high,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm + spacing.xs,
  },
  navCardIcon: {
    fontSize: 18,
  },
  navCardText: {
    flex: 1,
  },

  /* Rows */
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  /* Action buttons */
  actionButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: glassBorders.standard,
    backgroundColor: surfaceTiers.container,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  dangerButton: {
    borderColor: colors.danger,
    backgroundColor: 'rgba(255, 69, 58, 0.08)',
  },
  authButtons: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },

  /* Version badge */
  versionContainer: {
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  versionBadge: {
    backgroundColor: surfaceTiers.high,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  versionText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
  },
});
