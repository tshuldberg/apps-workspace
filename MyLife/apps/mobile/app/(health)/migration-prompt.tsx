import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, colors } from '@mylife/ui';
import {
  detectAbsorbedModuleData,
  isAbsorptionMigrated,
  migrateAbsorbedSettings,
  disableAbsorbedModules,
  HEALTH_ACCENT,
  HEALTH_SECONDARY,
  HEALTH_TERTIARY,
  HEALTH_SURFACES,
  HEALTH_TYPOGRAPHY,
  JAKARTA_FONTS,
  GlassCard,
  GradientButton,
} from '@mylife/health';
import { useDatabase } from '../../components/DatabaseProvider';

const FEATURES = [
  { icon: '\u{1F4CA}', title: 'Unified Dashboard', desc: 'All your health data in one place' },
  { icon: '\u{1F3AF}', title: 'Activity Rings', desc: 'Track daily movement goals' },
  { icon: '\u{1F319}', title: 'Sleep Analysis', desc: 'Detailed sleep stage insights' },
  { icon: '\u{1F9E0}', title: 'Mind Tab', desc: 'Mindfulness and mental wellness' },
  { icon: '\u{1F512}', title: 'Health Vault', desc: 'Secure document storage' },
] as const;

export default function MigrationPromptScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [migrating, setMigrating] = useState(false);
  const [progress, setProgress] = useState(0);

  const alreadyDone = useMemo(() => {
    try { return isAbsorptionMigrated(db); } catch { return false; }
  }, [db]);

  const data = useMemo(() => {
    try { return detectAbsorbedModuleData(db); } catch { return null; }
  }, [db]);

  const handleMigrate = useCallback(() => {
    setMigrating(true);
    setProgress(0);

    // Animate progress
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 0.9) {
          clearInterval(interval);
          return 0.9;
        }
        return p + 0.15;
      });
    }, 200);

    try {
      migrateAbsorbedSettings(db);
      disableAbsorbedModules(db);
    } catch {
      // Best effort -- settings copy is non-critical
    }

    clearInterval(interval);
    setProgress(1);
    setTimeout(() => {
      setMigrating(false);
      router.replace('/(health)');
    }, 400);
  }, [db, router]);

  const handleSkip = useCallback(() => {
    router.replace('/(health)');
  }, [router]);

  // If already migrated or no data, just go to health
  const shouldSkip = alreadyDone || !data || (!data.hasMedsData && !data.hasFastData);
  useEffect(() => {
    if (shouldSkip) router.replace('/(health)');
  }, [shouldSkip, router]);
  if (shouldSkip) return null;

  const detectedCount = [data.hasMedsData, data.hasFastData].filter(Boolean).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ── Welcome ── */}
      <View style={styles.heroSection}>
        <Text style={styles.shieldIcon}>{'\u{1F6E1}\uFE0F'}</Text>
        <View style={styles.privacyBadge}>
          <Text style={styles.privacyBadgeText}>PRIVACY FIRST</Text>
        </View>
        <Text style={styles.welcomeTitle}>Welcome to MyHealth</Text>
        <Text style={styles.welcomeSubtitle}>Your complete health hub</Text>
      </View>

      {/* ── What's New ── */}
      <View style={styles.sectionSpacing}>
        <Text style={styles.sectionLabel}>WHAT'S NEW</Text>
        <View style={styles.featureGrid}>
          {FEATURES.map((f) => (
            <GlassCard key={f.title} level={3} style={styles.featureCard}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </GlassCard>
          ))}
        </View>
      </View>

      {/* ── Existing Data Detected ── */}
      <View style={styles.sectionSpacing}>
        <Text style={styles.sectionLabel}>DATA MIGRATION</Text>
        <GlassCard level={1} style={styles.dataCard}>
          <View style={styles.dataCardHeader}>
            <Text style={styles.dataCardTitle}>Existing Data Detected</Text>
            <View style={styles.dataBadge}>
              <Text style={styles.dataBadgeText}>{detectedCount} {detectedCount === 1 ? 'app' : 'apps'}</Text>
            </View>
          </View>
          <Text style={styles.dataCardDesc}>
            All your data is already accessible in MyHealth. No data will be moved or deleted.
          </Text>

          {data.hasMedsData && (
            <View style={styles.dataRow}>
              <View style={[styles.dot, { backgroundColor: colors.modules.meds }]} />
              <View style={styles.dataRowText}>
                <Text style={styles.dataRowTitle}>MyMeds</Text>
                <Text style={styles.dataRowCount}>{data.medsCount} medications</Text>
              </View>
            </View>
          )}
          {data.hasFastData && (
            <View style={styles.dataRow}>
              <View style={[styles.dot, { backgroundColor: colors.modules.fast }]} />
              <View style={styles.dataRowText}>
                <Text style={styles.dataRowTitle}>MyFast</Text>
                <Text style={styles.dataRowCount}>{data.fastCount} fasting sessions</Text>
              </View>
            </View>
          )}
          {migrating && (
            <View style={styles.progressContainer}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressBar, { width: `${Math.round(progress * 100)}%` }]} />
              </View>
              <Text style={styles.progressText}>Importing data...</Text>
            </View>
          )}
        </GlassCard>
      </View>

      {/* ── Apple Health Sync ── */}
      <View style={styles.sectionSpacing}>
        <GlassCard level={2} style={styles.appleHealthCard}>
          <View style={styles.appleHealthHeader}>
            <Text style={styles.appleHealthIcon}>{'\u2764\uFE0F'}</Text>
            <Text style={styles.appleHealthTitle}>Connect Apple Health?</Text>
          </View>
          <Text style={styles.appleHealthDesc}>
            Sync steps, heart rate, sleep, and more. MyHealth reads data locally and never sends it to any server.
          </Text>
          <View style={styles.appleHealthButtons}>
            <Pressable style={styles.connectButton}>
              <Text style={styles.connectButtonText}>Connect</Text>
            </Pressable>
            <Pressable style={styles.laterButton}>
              <Text style={styles.laterButtonText}>Later</Text>
            </Pressable>
          </View>
        </GlassCard>
      </View>

      {/* ── Actions ── */}
      <View style={styles.actionsSection}>
        <GradientButton
          title={migrating ? 'Importing...' : 'Import All'}
          onPress={handleMigrate}
          variant="primary"
        />
        <Pressable style={styles.skipButton} onPress={handleSkip} disabled={migrating}>
          <Text style={styles.skipText}>Skip for now</Text>
        </Pressable>
        <Pressable onPress={handleSkip}>
          <Text style={styles.exploreText}>Explore Features</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: HEALTH_SURFACES.depth,
  },
  content: {
    paddingBottom: 100,
  },

  /* ── Hero ── */
  heroSection: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  shieldIcon: {
    fontSize: 64,
    marginBottom: 12,
  },
  privacyBadge: {
    backgroundColor: HEALTH_SURFACES.focus,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  privacyBadgeText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 10,
    letterSpacing: 1.5,
    color: HEALTH_SECONDARY,
  },
  welcomeTitle: {
    ...HEALTH_TYPOGRAPHY.displayLg,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  /* ── Sections ── */
  sectionSpacing: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: HEALTH_ACCENT,
    marginBottom: 12,
  },

  /* ── Feature Grid ── */
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  featureCard: {
    width: '48%' as unknown as number,
    padding: 14,
    gap: 6,
  },
  featureIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  featureTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 13,
    color: colors.text,
  },
  featureDesc: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 15,
  },

  /* ── Data Migration Card ── */
  dataCard: {
    padding: 16,
    gap: 12,
  },
  dataCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dataCardTitle: {
    ...HEALTH_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  dataBadge: {
    backgroundColor: HEALTH_ACCENT + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  dataBadgeText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 11,
    color: HEALTH_ACCENT,
  },
  dataCardDesc: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dataRowText: {
    flex: 1,
    gap: 2,
  },
  dataRowTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 14,
    color: colors.text,
  },
  dataRowCount: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },

  /* ── Progress ── */
  progressContainer: {
    gap: 6,
    paddingTop: 4,
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: HEALTH_SURFACES.focus,
    overflow: 'hidden',
  },
  progressBar: {
    height: 3,
    borderRadius: 2,
    backgroundColor: HEALTH_ACCENT,
  },
  progressText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  /* ── Apple Health ── */
  appleHealthCard: {
    padding: 16,
    gap: 12,
  },
  appleHealthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  appleHealthIcon: {
    fontSize: 28,
  },
  appleHealthTitle: {
    ...HEALTH_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  appleHealthDesc: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  appleHealthButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  connectButton: {
    flex: 1,
    backgroundColor: HEALTH_ACCENT,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  connectButtonText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  laterButton: {
    flex: 1,
    backgroundColor: HEALTH_SURFACES.focus,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  laterButtonText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: colors.textSecondary,
  },

  /* ── Actions ── */
  actionsSection: {
    paddingHorizontal: 16,
    gap: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  skipButton: {
    paddingVertical: 8,
  },
  skipText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: colors.textSecondary,
  },
  exploreText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: HEALTH_TERTIARY,
  },
});
