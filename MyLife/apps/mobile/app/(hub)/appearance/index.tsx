import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  Text,
  useTheme,
  THEME_PRESETS,
  validateTheme,
  type ThemeProfile,
} from '@mylife/ui';
import {
  deleteThemeProfile,
  getThemeSetting,
  listThemeProfiles,
  setActiveThemeId,
  setThemeSetting,
  type ThemeProfileRow,
} from '@mylife/db';
import { useDatabase } from '../../../components/DatabaseProvider';
import { HUB_TAB_BAR_CLEARANCE } from '../_layout';

interface ResolvedCustomTheme {
  id: string;
  name: string;
  theme: ThemeProfile;
  row: ThemeProfileRow;
}

/** Parse a custom theme row's JSON payload. Returns null if invalid. */
function parseCustomTheme(row: ThemeProfileRow): ResolvedCustomTheme | null {
  try {
    const parsed = JSON.parse(row.json);
    const result = validateTheme(parsed);
    if (!result.success) return null;
    return { id: row.id, name: row.name, theme: result.theme, row };
  } catch {
    return null;
  }
}

export default function AppearanceScreen() {
  const router = useRouter();
  const db = useDatabase();
  const activeTheme = useTheme();
  const { colors, glass, surfaces, typeScale, layout } = activeTheme;

  const [customRows, setCustomRows] = useState<ThemeProfileRow[]>([]);
  const [matchSystem, setMatchSystem] = useState(false);
  const [animateTransitions, setAnimateTransitions] = useState(false);

  const refreshCustomThemes = useCallback(() => {
    setCustomRows(listThemeProfiles(db));
  }, [db]);

  useEffect(() => {
    refreshCustomThemes();
    setMatchSystem(getThemeSetting(db, 'theme_match_system'));
    setAnimateTransitions(getThemeSetting(db, 'theme_animate_transitions'));
  }, [db, refreshCustomThemes]);

  const customThemes = useMemo(
    () =>
      customRows
        .map(parseCustomTheme)
        .filter((t): t is ResolvedCustomTheme => t !== null),
    [customRows],
  );

  const isActiveCustom = useMemo(
    () => customThemes.some((t) => t.id === activeTheme.id),
    [customThemes, activeTheme.id],
  );

  const presetList = useMemo(
    () => Object.values(THEME_PRESETS),
    [],
  );

  const applyTheme = useCallback(
    (themeId: string) => {
      setActiveThemeId(db, themeId);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    },
    [db],
  );

  const openPreview = useCallback(
    (themeId: string) => {
      router.push({
        pathname: '/(hub)/appearance/preview',
        params: { themeId },
      });
    },
    [router],
  );

  const openNewThemeSheet = useCallback(() => {
    const options = [
      'Start from a preset',
      'Describe with AI',
      'Import JSON',
      'Cancel',
    ];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: 3,
          title: 'New Theme',
        },
        () => {
          // Screens 3-5 not yet implemented.
        },
      );
    } else {
      Alert.alert('New Theme', 'Custom theme creation is coming soon.');
    }
  }, []);

  const confirmDeleteCustom = useCallback(
    (row: ThemeProfileRow) => {
      Alert.alert(
        'Delete Theme',
        `Delete "${row.name}"? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              deleteThemeProfile(db, row.id);
              refreshCustomThemes();
            },
          },
        ],
      );
    },
    [db, refreshCustomThemes],
  );

  const handleMatchSystemChange = useCallback(
    (value: boolean) => {
      setMatchSystem(value);
      setThemeSetting(db, 'theme_match_system', value);
    },
    [db],
  );

  const handleAnimateChange = useCallback(
    (value: boolean) => {
      setAnimateTransitions(value);
      setThemeSetting(db, 'theme_animate_transitions', value);
    },
    [db],
  );

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        padding: layout.spacing.md,
        paddingBottom: HUB_TAB_BAR_CLEARANCE,
      }}
    >
      {/* Active Theme Hero */}
      <View style={{ marginBottom: layout.spacing.lg }}>
        <Text
          style={[styles.sectionHeader, { color: colors.textSecondary }]}
        >
          ACTIVE THEME
        </Text>
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: glass.strongFill,
              borderColor: glass.strongBorder,
              borderRadius: surfaces.cornerRadius.card,
              padding: layout.spacing.lg,
            },
          ]}
        >
          <Text
            style={{
              fontSize: typeScale.heading.size,
              fontWeight: typeScale.heading.weight,
              lineHeight: typeScale.heading.lineHeight,
              color: colors.text,
            }}
          >
            {activeTheme.name}
          </Text>
          <Text
            style={{
              fontSize: typeScale.caption.size,
              color: colors.textSecondary,
              marginTop: layout.spacing.xs,
            }}
          >
            {activeTheme.description}
          </Text>
          <ThemePreviewStrip theme={activeTheme} height={180} />
          {isActiveCustom && (
            <Pressable
              style={[
                styles.pill,
                {
                  backgroundColor: colors.primary,
                  borderRadius: surfaces.cornerRadius.button,
                  marginTop: layout.spacing.md,
                },
              ]}
              onPress={openNewThemeSheet}
            >
              <Text
                style={{
                  fontSize: typeScale.label.size,
                  fontWeight: '700',
                  color: colors.background,
                }}
              >
                Customize
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Built-in Themes */}
      <View style={{ marginBottom: layout.spacing.lg }}>
        <Text
          style={[styles.sectionHeader, { color: colors.textSecondary }]}
        >
          THEMES
        </Text>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={presetList}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{
            gap: layout.spacing.sm,
            paddingHorizontal: 2,
            paddingVertical: 2,
          }}
          renderItem={({ item }) => (
            <ThemePresetCard
              theme={item}
              isActive={activeTheme.id === item.id}
              onPress={() => applyTheme(item.id)}
              onLongPress={() => openPreview(item.id)}
            />
          )}
        />
      </View>

      {/* My Themes */}
      <View style={{ marginBottom: layout.spacing.lg }}>
        <View style={styles.sectionHeaderRow}>
          <Text
            style={[styles.sectionHeader, { color: colors.textSecondary, marginBottom: 0 }]}
          >
            MY THEMES
          </Text>
          <Pressable
            onPress={openNewThemeSheet}
            style={[
              styles.newButton,
              {
                backgroundColor: glass.cardFill,
                borderColor: glass.cardBorder,
                borderRadius: surfaces.cornerRadius.button,
              },
            ]}
          >
            <Text
              style={{
                fontSize: typeScale.label.size,
                fontWeight: '600',
                color: colors.primary,
                letterSpacing: typeScale.label.letterSpacing,
              }}
            >
              New +
            </Text>
          </Pressable>
        </View>
        {customThemes.length === 0 ? (
          <View
            style={[
              styles.emptyState,
              {
                backgroundColor: glass.cardFill,
                borderColor: glass.cardBorder,
                borderRadius: surfaces.cornerRadius.card,
                padding: layout.spacing.lg,
              },
            ]}
          >
            <Text
              style={{
                fontSize: typeScale.body.size,
                color: colors.textSecondary,
                textAlign: 'center',
              }}
            >
              Create your first custom theme
            </Text>
            <Text
              style={{
                fontSize: typeScale.caption.size,
                color: colors.textTertiary,
                textAlign: 'center',
                marginTop: layout.spacing.xs,
              }}
            >
              Start from a preset, describe one to AI, or import JSON.
            </Text>
          </View>
        ) : (
          <FlatList
            data={customThemes}
            numColumns={2}
            scrollEnabled={false}
            keyExtractor={(t) => t.id}
            columnWrapperStyle={{ gap: layout.spacing.sm }}
            contentContainerStyle={{ gap: layout.spacing.sm }}
            renderItem={({ item }) => (
              <View style={{ flex: 1 }}>
                <ThemePresetCard
                  theme={item.theme}
                  isActive={activeTheme.id === item.id}
                  onPress={() => applyTheme(item.id)}
                  onLongPress={() => openPreview(item.id)}
                  fullWidth
                />
                <Pressable
                  onPress={() => confirmDeleteCustom(item.row)}
                  style={{
                    alignSelf: 'flex-end',
                    marginTop: layout.spacing.xs,
                  }}
                  hitSlop={8}
                >
                  <Text
                    style={{
                      fontSize: typeScale.caption.size,
                      color: colors.danger,
                    }}
                  >
                    Delete
                  </Text>
                </Pressable>
              </View>
            )}
          />
        )}
      </View>

      {/* Quick Settings */}
      <View style={{ marginBottom: layout.spacing.lg }}>
        <Text
          style={[styles.sectionHeader, { color: colors.textSecondary }]}
        >
          QUICK SETTINGS
        </Text>
        <View
          style={[
            styles.quickCard,
            {
              backgroundColor: glass.cardFill,
              borderColor: glass.cardBorder,
              borderRadius: surfaces.cornerRadius.card,
              padding: layout.spacing.md,
            },
          ]}
        >
          <View style={styles.toggleRow}>
            <View style={{ flex: 1, paddingRight: layout.spacing.sm }}>
              <Text
                style={{
                  fontSize: typeScale.body.size,
                  color: colors.text,
                }}
              >
                Match system appearance
              </Text>
              <Text
                style={{
                  fontSize: typeScale.caption.size,
                  color: colors.textSecondary,
                  marginTop: 2,
                }}
              >
                Switch between dark and light presets automatically.
              </Text>
            </View>
            <Switch
              value={matchSystem}
              onValueChange={handleMatchSystemChange}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
          <View
            style={[
              styles.toggleRow,
              {
                borderTopWidth: 1,
                borderTopColor: colors.border,
                marginTop: layout.spacing.sm,
                paddingTop: layout.spacing.sm,
              },
            ]}
          >
            <View style={{ flex: 1, paddingRight: layout.spacing.sm }}>
              <Text
                style={{
                  fontSize: typeScale.body.size,
                  color: colors.text,
                }}
              >
                Animate transitions
              </Text>
              <Text
                style={{
                  fontSize: typeScale.caption.size,
                  color: colors.textSecondary,
                  marginTop: 2,
                }}
              >
                Cross-fade when switching themes.
              </Text>
            </View>
            <Switch
              value={animateTransitions}
              onValueChange={handleAnimateChange}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
          <Pressable
            style={[
              styles.guideLink,
              {
                borderTopWidth: 1,
                borderTopColor: colors.border,
                marginTop: layout.spacing.sm,
                paddingTop: layout.spacing.md,
              },
            ]}
            onPress={() => {
              Alert.alert(
                'Theme Creation Guide',
                'The theme creation guide is coming soon.',
              );
            }}
          >
            <Text
              style={{
                fontSize: typeScale.body.size,
                color: colors.primary,
              }}
            >
              Theme creation guide
            </Text>
            <Text
              style={{
                fontSize: typeScale.body.size,
                color: colors.primary,
              }}
            >
              {'>'}
            </Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */
/*  Preset card                                                         */
/* ------------------------------------------------------------------ */

interface ThemePresetCardProps {
  theme: ThemeProfile;
  isActive: boolean;
  onPress: () => void;
  onLongPress: () => void;
  fullWidth?: boolean;
}

function ThemePresetCard({
  theme,
  isActive,
  onPress,
  onLongPress,
  fullWidth,
}: ThemePresetCardProps) {
  const {
    colors: themeColors,
    surfaces: themeSurfaces,
    typeScale: themeTypeScale,
  } = theme;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={[
        styles.presetCard,
        {
          width: fullWidth ? '100%' : 140,
          borderRadius: themeSurfaces.cornerRadius.card,
          borderColor: isActive ? themeColors.primary : themeColors.border,
          borderWidth: isActive ? 2 : 1,
          backgroundColor: themeColors.surface,
        },
      ]}
    >
      <View
        style={{
          height: 110,
          backgroundColor: themeColors.background,
          borderTopLeftRadius: themeSurfaces.cornerRadius.card - 1,
          borderTopRightRadius: themeSurfaces.cornerRadius.card - 1,
          padding: 8,
          gap: 6,
        }}
      >
        <View
          style={{
            height: 10,
            width: '60%',
            borderRadius: 3,
            backgroundColor: themeColors.text,
            opacity: 0.9,
          }}
        />
        <View style={{ flexDirection: 'row', gap: 4, marginTop: 2 }}>
          <View
            style={{
              flex: 1,
              height: 32,
              backgroundColor: themeColors.surfaceElevated,
              borderRadius: themeSurfaces.cornerRadius.icon,
            }}
          />
          <View
            style={{
              flex: 1,
              height: 32,
              backgroundColor: themeColors.primary,
              borderRadius: themeSurfaces.cornerRadius.icon,
            }}
          />
          <View
            style={{
              flex: 1,
              height: 32,
              backgroundColor: themeColors.accent,
              borderRadius: themeSurfaces.cornerRadius.icon,
            }}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <View
            style={{
              flex: 2,
              height: 24,
              backgroundColor: themeColors.surfaceElevated,
              borderRadius: 6,
            }}
          />
          <View
            style={{
              flex: 1,
              height: 24,
              backgroundColor: themeColors.primaryContainer,
              borderRadius: 6,
            }}
          />
        </View>
      </View>
      <View
        style={{
          padding: 10,
          minHeight: 70,
          justifyContent: 'space-between',
        }}
      >
        <Text
          numberOfLines={2}
          style={{
            fontSize: themeTypeScale.caption.size,
            fontWeight: '600',
            color: themeColors.text,
          }}
        >
          {theme.name}
        </Text>
        {isActive ? (
          <View
            style={{
              alignSelf: 'flex-start',
              marginTop: 6,
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 4,
              backgroundColor: themeColors.primary,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: '700',
                color: themeColors.background,
                letterSpacing: 0.5,
              }}
            >
              ACTIVE
            </Text>
          </View>
        ) : (
          <Text
            style={{
              fontSize: 10,
              color: themeColors.textTertiary,
              marginTop: 6,
            }}
          >
            Tap to apply · Hold to preview
          </Text>
        )}
      </View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/*  Live preview strip (used inside hero)                              */
/* ------------------------------------------------------------------ */

interface ThemePreviewStripProps {
  theme: ThemeProfile;
  height: number;
}

function ThemePreviewStrip({ theme, height }: ThemePreviewStripProps) {
  const { colors: c, surfaces: s, layout: l } = theme;
  return (
    <View
      style={{
        marginTop: l.spacing.md,
        height,
        backgroundColor: c.background,
        borderRadius: s.cornerRadius.card,
        borderWidth: 1,
        borderColor: c.border,
        padding: l.spacing.md,
        gap: l.spacing.sm,
      }}
    >
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[c.primary, c.primaryContainer, c.accent, c.success].map((bg, i) => (
          <View
            key={i}
            style={{
              width: 36,
              height: 36,
              borderRadius: s.cornerRadius.icon,
              backgroundColor: bg,
            }}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: l.spacing.sm, flex: 1 }}>
        <View
          style={{
            flex: 1,
            backgroundColor: c.surfaceElevated,
            borderRadius: s.cornerRadius.card,
          }}
        />
        <View
          style={{
            flex: 1,
            backgroundColor: c.surface,
            borderRadius: s.cornerRadius.card,
            borderWidth: 1,
            borderColor: c.border,
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  newButton: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  heroCard: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  presetCard: {
    overflow: 'hidden',
  },
  emptyState: {
    borderWidth: 1,
    alignItems: 'center',
  },
  quickCard: {
    borderWidth: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  guideLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
