import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Text, colors, surfaceTiers, spacing, glassFills, glassBorders } from '@mylife/ui';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@mylife/auth';
import {
  useSyncStatus,
  useSetSyncTier,
  isCloudTier,
  tierRequiresAuth,
  type SyncTier,
} from '@mylife/sync';
import { PRODUCTS } from '@mylife/billing-config';
import { useEntitlements, usePayment } from '../../components/EntitlementsProvider';
import { HUB_TAB_BAR_CLEARANCE } from './_layout';

const TIER_OPTIONS: Array<{
  tier: SyncTier;
  label: string;
  description: string;
  price: string | null;
}> = [
  {
    tier: 'local_only',
    label: 'Local Only',
    description: 'Data stays on this device. No sync, maximum privacy.',
    price: null,
  },
  {
    tier: 'p2p',
    label: 'Peer-to-Peer',
    description: 'Sync directly between your devices via WebRTC. No cloud, no account needed.',
    price: null,
  },
  {
    tier: 'free_cloud',
    label: 'Free Cloud',
    description: '1 GB cloud sync. Requires a free account.',
    price: 'Free',
  },
  {
    tier: 'starter_cloud',
    label: 'Starter Cloud',
    description: '5 GB cloud sync with priority support.',
    price: `$${PRODUCTS.storageTiers.starter.price.toFixed(2)}/mo`,
  },
  {
    tier: 'power_cloud',
    label: 'Power Cloud',
    description: '25 GB cloud sync with priority support.',
    price: `$${PRODUCTS.storageTiers.power.price.toFixed(2)}/mo`,
  },
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = bytes / 1024;
  return `${kb.toFixed(0)} KB`;
}

function formatLimit(bytes: number): string {
  if (!isFinite(bytes)) return 'Unlimited';
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(0)} GB`;
}

/**
 * Data & Sync settings screen.
 *
 * Shows current sync mode, allows switching tiers, handles P2P pairing,
 * and shows cloud authentication/storage usage.
 */
export default function DataSyncScreen() {
  const syncStatus = useSyncStatus();
  const setSyncTier = useSetSyncTier();
  const { isAuthenticated, signIn, signUp, isLoading: authLoading } = useAuth();
  const entitlements = useEntitlements();
  const { paymentService } = usePayment();

  const [changingTier, setChangingTier] = useState<SyncTier | null>(null);
  const [pairCode, setPairCode] = useState('');

  // Auth form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const usedPercent =
    isFinite(syncStatus.storageLimitBytes) && syncStatus.storageLimitBytes > 0
      ? Math.min((syncStatus.storageUsedBytes / syncStatus.storageLimitBytes) * 100, 100)
      : 0;

  const handleTierChange = async (tier: SyncTier) => {
    setChangingTier(tier);
    try {
      // For paid cloud tiers, upgrade storage first
      if (tier === 'starter_cloud' && paymentService) {
        await paymentService.upgradeStorage('starter');
      } else if (tier === 'power_cloud' && paymentService) {
        await paymentService.upgradeStorage('power');
      }
      await setSyncTier(tier);
    } finally {
      setChangingTier(null);
    }
  };

  const handleAuth = async () => {
    setAuthSubmitting(true);
    setAuthError(null);
    try {
      const result = authMode === 'signin'
        ? await signIn(email, password)
        : await signUp(email, password);
      if (!result.success) {
        setAuthError(result.error ?? 'Authentication failed');
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setAuthSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
    >
      {/* Page header */}
      <View style={styles.headerBlock}>
        <Text style={styles.pageTitle}>Data &amp; Sync</Text>
      </View>

      {/* Sync Tiers */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>SYNC TIERS</Text>
        {TIER_OPTIONS.map((option) => {
          const isActive = syncStatus.tier === option.tier;
          const isChanging = changingTier === option.tier;
          const needsAuth = tierRequiresAuth(option.tier) && !isAuthenticated;

          return (
            <Pressable
              key={option.tier}
              style={[
                styles.tierCard,
                isActive && styles.tierCardActive,
              ]}
              onPress={() => void handleTierChange(option.tier)}
              disabled={isActive || changingTier !== null}
            >
              <View style={styles.tierHeader}>
                <Text style={styles.tierLabel}>{option.label}</Text>
                <View style={styles.tierRight}>
                  {option.price && (
                    <Text style={styles.tierPrice}>{option.price}</Text>
                  )}
                  {isChanging && <ActivityIndicator color={colors.textSecondary} size="small" />}
                  {isActive && (
                    <View style={styles.activePill}>
                      <Text style={styles.activePillText}>ACTIVE</Text>
                    </View>
                  )}
                </View>
              </View>
              <Text style={styles.tierDescription}>{option.description}</Text>
              {needsAuth && (
                <Text style={styles.authNote}>Requires sign-in</Text>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Archival Usage (cloud tiers) */}
      {isCloudTier(syncStatus.tier) && (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>ARCHIVAL USAGE</Text>
          <View style={styles.card}>
            <Text style={styles.bodyText}>
              {formatBytes(syncStatus.storageUsedBytes)} of {formatLimit(syncStatus.storageLimitBytes)} used
            </Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${usedPercent}%` }]} />
            </View>
          </View>
        </View>
      )}

      {/* Device Pairing (P2P) */}
      {syncStatus.tier === 'p2p' && (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>DEVICE PAIRING</Text>
          <View style={styles.card}>
            <Text style={styles.captionText}>
              Enter a pairing code from your other device, or share your code to connect.
            </Text>
            <TextInput
              style={styles.pairInput}
              value={pairCode}
              onChangeText={setPairCode}
              placeholder="XXXX-XXXX"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="characters"
            />
          </View>
        </View>
      )}

      {/* Network Nodes */}
      {syncStatus.connected && (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>NETWORK NODES</Text>
          <View style={styles.card}>
            <View style={styles.nodeRow}>
              <View style={styles.nodeStatusDot} />
              <Text style={styles.bodyText}>This device</Text>
              <Text style={styles.captionTextInline}>Connected</Text>
            </View>
            {syncStatus.lastSyncedAt && (
              <Text style={styles.captionText}>
                Last synced: {syncStatus.lastSyncedAt.toLocaleString()}
              </Text>
            )}
            {syncStatus.pendingChanges > 0 && (
              <Text style={styles.captionText}>
                {syncStatus.pendingChanges} pending change{syncStatus.pendingChanges !== 1 ? 's' : ''}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Auth section for cloud tiers */}
      {tierRequiresAuth(syncStatus.tier) && !isAuthenticated && (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>SIGN IN FOR CLOUD SYNC</Text>
          <View style={styles.card}>
            <Text style={styles.captionText}>
              A free account is required to enable cloud sync.
            </Text>
            <TextInput
              style={styles.authInput}
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={styles.authInput}
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={colors.textTertiary}
              secureTextEntry
            />
            {authError && (
              <Text style={styles.authError}>{authError}</Text>
            )}
            <Pressable
              disabled={authSubmitting}
              style={[authSubmitting && styles.disabled]}
              onPress={() => void handleAuth()}
            >
              <LinearGradient
                colors={[colors.hubAccentLight, colors.hubAccent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.authButton}
              >
                {authSubmitting ? (
                  <ActivityIndicator color={colors.text} size="small" />
                ) : (
                  <Text style={styles.authButtonText}>
                    {authMode === 'signin' ? 'Sign In' : 'Sign Up'}
                  </Text>
                )}
              </LinearGradient>
            </Pressable>
            <Pressable
              onPress={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
              style={styles.toggleAuth}
            >
              <Text style={styles.captionText}>
                {authMode === 'signin'
                  ? 'Need an account? Sign up'
                  : 'Already have an account? Sign in'}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
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
    paddingBottom: HUB_TAB_BAR_CLEARANCE,
  },
  headerBlock: {
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
  captionTextInline: {
    fontSize: 13,
    color: colors.textSecondary,
  },

  // Tier cards
  tierCard: {
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: glassBorders.subtle,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  tierCardActive: {
    backgroundColor: surfaceTiers.high,
    borderColor: `${colors.hubAccent}4D`,
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  tierLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  tierRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tierPrice: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  activePill: {
    backgroundColor: `${colors.hubAccent}26`,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  activePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.hubAccent,
    letterSpacing: 1,
  },
  tierDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  authNote: {
    fontSize: 12,
    color: colors.textTertiary,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },

  // Progress bar
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: surfaceTiers.highest,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.hubAccent,
  },

  // Device pairing
  pairInput: {
    backgroundColor: surfaceTiers.lowest,
    borderWidth: 1,
    borderColor: glassBorders.subtle,
    borderRadius: 16,
    padding: spacing.md,
    color: colors.hubAccent,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 4,
    textAlign: 'center',
    fontFamily: 'monospace',
    marginTop: spacing.sm,
  },

  // Network nodes
  nodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nodeStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.hubAccent,
    shadowColor: colors.hubAccent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },

  // Auth
  authInput: {
    backgroundColor: surfaceTiers.lowest,
    borderWidth: 1,
    borderColor: glassBorders.subtle,
    borderRadius: 12,
    padding: spacing.sm,
    color: colors.text,
    fontSize: 16,
    marginTop: spacing.sm,
  },
  authError: {
    fontSize: 13,
    color: colors.danger,
    marginTop: spacing.sm,
  },
  authButton: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  authButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  toggleAuth: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
});
