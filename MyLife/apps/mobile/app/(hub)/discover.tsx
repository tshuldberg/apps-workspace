import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { icons } from 'lucide-react-native';
import {
  MODULE_ICONS,
  MODULE_METADATA,
  getModuleReleaseDescription,
  getModuleReleaseLabel,
  getModuleReleaseState,
  isUserVisibleModule,
  type ModuleDefinition,
  type ModuleId,
} from '@mylife/module-registry';
import { useEnabledModules, useModuleRegistry } from '@mylife/module-registry';
import {
  Text,
  colors,
  surfaceTiers,
  borderRadius,
  HealthDataConsentDialog,
  useThemeColors,
  useThemeLayout,
  useThemeSurfaces,
  type BaseColors,
} from '@mylife/ui';
import { useModuleToggle } from '../../hooks/use-module-toggle';
import { HUB_TAB_BAR_CLEARANCE } from './_layout';

/** Convert "kebab-case" Lucide name to PascalCase key used by the icons map. */
function toPascalCase(name: string): string {
  return name
    .split('-')
    .map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1))
    .join('');
}

/** Resolve a Lucide icon component by its kebab-case name. */
function getIcon(name: string) {
  const key = toPascalCase(name);
  return (icons as Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>>)[key] ?? null;
}

/**
 * Category groupings for module discovery.
 * Includes every registered module ID; the sections filter through
 * `isUserVisibleModule` at render time so hidden modules drop out
 * without breaking the category structure. That way re-enabling a
 * module in release-states.ts brings it back automatically.
 */
const MODULE_CATEGORIES: { title: string; moduleIds: ModuleId[] }[] = [
  {
    title: 'Lifestyle',
    moduleIds: ['books', 'classes', 'recipes', 'habits', 'words', 'journal', 'notes', 'flash'],
  },
  {
    title: 'Health & Fitness',
    moduleIds: ['health', 'workouts', 'fast', 'meds', 'nutrition', 'mood', 'cycle', 'presence'],
  },
  {
    title: 'Finance',
    moduleIds: ['budget', 'subs'],
  },
  {
    title: 'Home & Auto',
    moduleIds: ['homes', 'car', 'garden', 'closet'],
  },
  {
    title: 'Social & Events',
    moduleIds: ['rsvp', 'forums', 'market', 'mail', 'voice'],
  },
  {
    title: 'Exploration',
    moduleIds: ['surf', 'trails', 'stars', 'pets'],
  },
];

const SearchIcon = getIcon('search');

/**
 * Discover screen -- browse all suite modules grouped by category.
 * Every module is free and unlocked while we transition to feature-level
 * Pro gating. Tapping a module toggles it on/off (persisted to SQLite).
 * Modules marked "hidden" in release-states.ts are filtered out completely.
 */
export default function DiscoverScreen() {
  const registry = useModuleRegistry();
  const { toggle, pendingConsent, confirmConsent, declineConsent } = useModuleToggle();
  const [searchQuery, setSearchQuery] = useState('');
  // Subscribe to enabled state changes so the list re-renders on toggle
  useEnabledModules();

  const themeColors = useThemeColors();
  const themeLayout = useThemeLayout();
  const themeSurfaces = useThemeSurfaces();
  const spacing = themeLayout.spacing;
  const styles = useMemo(
    () => makeStyles(themeColors, spacing, themeSurfaces.cornerRadius.card),
    [themeColors, spacing, themeSurfaces.cornerRadius.card],
  );

  const sections = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return MODULE_CATEGORIES.map((cat) => ({
      title: cat.title,
      data: cat.moduleIds
        .filter((id) => isUserVisibleModule(id))
        .map((id) => MODULE_METADATA[id])
        .filter((mod) => {
          if (!query) return true;
          return (
            mod.name.toLowerCase().includes(query) ||
            mod.tagline.toLowerCase().includes(query)
          );
        }),
    })).filter((section) => section.data.length > 0);
  }, [searchQuery]);

  const handleModulePress = useCallback(
    (item: ModuleDefinition) => {
      toggle(item.id);
    },
    [toggle],
  );

  const renderModule = useCallback(
    (item: ModuleDefinition) => {
      const isEnabled = registry.isEnabled(item.id);
      const releaseState = getModuleReleaseState(item.id);
      const releaseLabel = getModuleReleaseLabel(item.id);
      const releaseDescription = getModuleReleaseDescription(item.id);
      const iconName = MODULE_ICONS[item.id] ?? 'circle';
      const IconComponent = getIcon(iconName);

      return (
        <Pressable
          key={item.id}
          style={({ pressed }) => [styles.moduleRow, pressed && styles.moduleRowPressed]}
          onPress={() => handleModulePress(item)}
          accessibilityLabel={`${item.name}, ${item.tagline}`}
        >
          <View style={styles.moduleCard}>
            <View style={styles.moduleContent}>
              {/* Icon */}
              <View style={styles.iconWrapper}>
                <View style={styles.iconCircle}>
                  {IconComponent ? (
                    <IconComponent size={22} color={themeColors.primaryContainer} strokeWidth={1.8} />
                  ) : (
                    <Text style={styles.moduleIcon}>{item.icon}</Text>
                  )}
                </View>
              </View>

              {/* Info */}
              <View style={styles.moduleInfo}>
                <View style={styles.titleRow}>
                  <Text variant="subheading">{item.name}</Text>
                  <View
                    style={[
                      styles.releaseBadge,
                      releaseState === 'ga' ? styles.releaseBadgeGa : styles.releaseBadgeBeta,
                    ]}
                  >
                    <Text
                      variant="label"
                      color={releaseState === 'ga' ? themeColors.success : themeColors.textSecondary}
                    >
                      {releaseLabel}
                    </Text>
                  </View>
                </View>
                <Text variant="caption" color={themeColors.textSecondary}>
                  {item.tagline}
                </Text>
                {/* textTertiary is not in BaseColors schema; keep static token */}
                <Text variant="caption" color={colors.textTertiary}>
                  {releaseDescription}
                </Text>
              </View>

              {/* Status */}
              <View
                style={[
                  styles.statusBadge,
                  isEnabled ? styles.enabledBadge : styles.disabledBadge,
                ]}
              >
                <Text
                  variant="label"
                  color={isEnabled ? themeColors.primaryContainer : colors.textTertiary}
                >
                  {isEnabled ? 'ON' : 'OFF'}
                </Text>
              </View>
            </View>
          </View>
        </Pressable>
      );
    },
    [registry, handleModulePress, styles, themeColors],
  );

  return (
    <>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>
            Expand Your{'\n'}
            <Text style={styles.heroAccent}>Ecosystem</Text>
          </Text>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          {SearchIcon && (
            <View style={styles.searchIconWrapper}>
              <SearchIcon size={18} color={colors.textTertiary} strokeWidth={1.8} />
            </View>
          )}
          <TextInput
            style={styles.searchInput}
            placeholder="Search modules..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>

        {/* Sections */}
        {sections.map((section) => (
          <View key={section.title} style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title.toUpperCase()}</Text>
            </View>
            {section.data.map((item) => renderModule(item))}
          </View>
        ))}
      </ScrollView>

      <HealthDataConsentDialog
        visible={pendingConsent !== null}
        moduleName={pendingConsent?.moduleName ?? ''}
        moduleIcon={pendingConsent?.moduleIcon ?? ''}
        dataTypes={pendingConsent?.dataTypes ?? []}
        onConsent={confirmConsent}
        onDecline={declineConsent}
      />
    </>
  );
}

function makeStyles(
  themeColors: BaseColors,
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number },
  cardRadius: number,
) {
  return StyleSheet.create({
    scrollView: {
      flex: 1,
      backgroundColor: themeColors.background,
    },
    container: {
      padding: spacing.md,
      paddingBottom: HUB_TAB_BAR_CLEARANCE,
    },

    // Hero
    hero: {
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
      paddingHorizontal: spacing.xs,
    },
    heroTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: themeColors.text,
      lineHeight: 36,
    },
    heroAccent: {
      color: themeColors.primaryContainer,
      fontSize: 28,
      fontWeight: '700',
      lineHeight: 36,
    },

    // Search
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: surfaceTiers.highest,
      borderRadius: borderRadius.pill,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.lg,
      height: 44,
    },
    searchIconWrapper: {
      marginRight: spacing.sm,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: themeColors.text,
      height: 44,
      padding: 0,
    },

    // Sections
    sectionBlock: {
      marginBottom: spacing.md,
    },
    sectionHeader: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
      marginBottom: spacing.xs,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: '600',
      color: `rgba(201,137,77,0.6)`,
      letterSpacing: 2,
      textTransform: 'uppercase',
    },

    // Module card
    moduleRow: {
      marginBottom: spacing.sm,
    },
    moduleRowPressed: {
      opacity: 0.7,
    },
    moduleCard: {
      backgroundColor: surfaceTiers.low,
      borderRadius: cardRadius,
      padding: spacing.md,
      overflow: 'hidden',
    },
    moduleContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    iconWrapper: {
      width: 44,
      height: 44,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.md,
    },
    iconCircle: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: surfaceTiers.highest,
    },
    moduleIcon: {
      fontSize: 20,
    },
    moduleInfo: {
      flex: 1,
      gap: 2,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },

    // Release badges
    releaseBadge: {
      paddingHorizontal: spacing.xs + 2,
      paddingVertical: 2,
      borderRadius: borderRadius.sm,
    },
    releaseBadgeGa: {
      backgroundColor: 'rgba(48, 209, 88, 0.14)',
    },
    releaseBadgeBeta: {
      backgroundColor: surfaceTiers.highest,
    },

    // Status badges
    statusBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.sm,
      marginLeft: spacing.sm,
    },
    enabledBadge: {
      backgroundColor: 'rgba(201, 137, 77, 0.1)',
    },
    disabledBadge: {
      backgroundColor: surfaceTiers.highest,
    },
  });
}
