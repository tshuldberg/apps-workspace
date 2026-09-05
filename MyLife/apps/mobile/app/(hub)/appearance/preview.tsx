import { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  Text,
  ThemeProvider,
  THEME_PRESETS,
  useTheme,
  validateTheme,
  type ThemeProfile,
} from '@mylife/ui';
import { getThemeProfile, setActiveThemeId } from '@mylife/db';
import { useDatabase } from '../../../components/DatabaseProvider';

/** Resolve a theme id to a profile: check presets first, then custom themes. */
function resolveThemeById(
  db: ReturnType<typeof useDatabase>,
  themeId: string,
): ThemeProfile | null {
  const preset = THEME_PRESETS[themeId];
  if (preset) return preset;
  const row = getThemeProfile(db, themeId);
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.json);
    const result = validateTheme(parsed);
    if (!result.success) return null;
    return result.theme;
  } catch {
    return null;
  }
}

export default function ThemePreviewScreen() {
  const params = useLocalSearchParams<{ themeId?: string }>();
  const router = useRouter();
  const db = useDatabase();
  const fallbackTheme = useTheme();

  const previewTheme = useMemo(() => {
    if (!params.themeId) return fallbackTheme;
    return resolveThemeById(db, params.themeId) ?? fallbackTheme;
  }, [db, params.themeId, fallbackTheme]);

  const handleApply = () => {
    setActiveThemeId(db, previewTheme.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.back();
  };

  return (
    <ThemeProvider theme={previewTheme}>
      <PreviewBody theme={previewTheme} onApply={handleApply} onClose={() => router.back()} />
    </ThemeProvider>
  );
}

interface PreviewBodyProps {
  theme: ThemeProfile;
  onApply: () => void;
  onClose: () => void;
}

function PreviewBody({ theme, onApply, onClose }: PreviewBodyProps) {
  const insets = useSafeAreaInsets();
  const { colors, surfaces, layout, typeScale, glass } = theme;

  const moduleIconColors = [
    colors.primary,
    colors.primaryContainer,
    colors.accent,
    colors.success,
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            paddingHorizontal: layout.spacing.md,
            paddingBottom: layout.spacing.sm,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable onPress={onClose} hitSlop={8} style={styles.headerButton}>
          <Text
            style={{
              fontSize: typeScale.body.size,
              color: colors.text,
            }}
          >
            {'< Back'}
          </Text>
        </Pressable>
        <Text
          numberOfLines={1}
          style={{
            fontSize: typeScale.subheading.size,
            fontWeight: typeScale.subheading.weight,
            color: colors.text,
            flex: 1,
            textAlign: 'center',
          }}
        >
          {theme.name}
        </Text>
        <Pressable onPress={onApply} hitSlop={8} style={styles.headerButton}>
          <Text
            style={{
              fontSize: typeScale.body.size,
              fontWeight: '700',
              color: colors.primary,
            }}
          >
            Apply
          </Text>
        </Pressable>
      </View>

      {/* Mock dashboard body */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: layout.spacing.md,
          paddingBottom: 160,
          gap: layout.spacing.lg,
        }}
      >
        <View>
          <Text
            style={{
              fontSize: typeScale.heroTitle.size,
              fontWeight: typeScale.heroTitle.weight,
              lineHeight: typeScale.heroTitle.lineHeight,
              color: colors.text,
            }}
          >
            Good evening
          </Text>
          <Text
            style={{
              fontSize: typeScale.caption.size,
              color: colors.textSecondary,
              letterSpacing: typeScale.label.letterSpacing,
              textTransform: 'uppercase',
              marginTop: layout.spacing.xs,
            }}
          >
            Thursday, April 20
          </Text>
        </View>

        {/* Module icon row */}
        <View style={{ flexDirection: 'row', gap: layout.spacing.md, justifyContent: 'space-between' }}>
          {moduleIconColors.map((bg, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                aspectRatio: 1,
                backgroundColor: bg,
                borderRadius: surfaces.cornerRadius.icon,
              }}
            />
          ))}
        </View>

        {/* Bento grid 2x2 */}
        <View style={{ gap: layout.spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: layout.spacing.sm }}>
            <MockCard theme={theme} title="Today" subtitle="3 actions pending" height={120} />
            <MockCard theme={theme} title="Streak" subtitle="7 days" height={120} accent />
          </View>
          <View style={{ flexDirection: 'row', gap: layout.spacing.sm }}>
            <MockCard theme={theme} title="Insight" subtitle="Morning energy up" height={100} />
            <MockCard theme={theme} title="Mood" subtitle="Logged at 9:32" height={100} />
          </View>
        </View>

        <View>
          <Text
            style={{
              fontSize: 11,
              fontWeight: '600',
              letterSpacing: 2,
              color: colors.textSecondary,
              marginBottom: layout.spacing.sm,
            }}
          >
            RECENT
          </Text>
          <View
            style={{
              backgroundColor: glass.cardFill,
              borderColor: glass.cardBorder,
              borderWidth: 1,
              borderRadius: surfaces.cornerRadius.card,
              padding: layout.spacing.md,
              gap: layout.spacing.sm,
            }}
          >
            {['Morning pages', 'Walk 2.1 mi', 'Logged groceries'].map((line) => (
              <View
                key={line}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                }}
              >
                <Text style={{ fontSize: typeScale.body.size, color: colors.text }}>
                  {line}
                </Text>
                <Text
                  style={{ fontSize: typeScale.caption.size, color: colors.textSecondary }}
                >
                  2h ago
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Mock tab bar */}
      <MockTabBar theme={theme} />

      {/* Sticky footer Apply button */}
      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, 12),
            paddingHorizontal: layout.spacing.md,
            paddingTop: layout.spacing.sm,
            backgroundColor: colors.background,
            borderTopColor: colors.border,
          },
        ]}
      >
        <Pressable
          onPress={onApply}
          style={{
            backgroundColor: colors.primary,
            borderRadius: surfaces.cornerRadius.button,
            paddingVertical: 14,
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              fontSize: typeScale.body.size,
              fontWeight: '700',
              color: colors.background,
            }}
          >
            Apply {theme.name}
          </Text>
        </Pressable>
        <Pressable
          onPress={onClose}
          hitSlop={8}
          style={{ alignItems: 'center', paddingTop: layout.spacing.sm }}
        >
          <Text
            style={{
              fontSize: typeScale.caption.size,
              color: colors.textSecondary,
              textDecorationLine: 'underline',
            }}
          >
            Customize first
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

interface MockCardProps {
  theme: ThemeProfile;
  title: string;
  subtitle: string;
  height: number;
  accent?: boolean;
}

function MockCard({ theme, title, subtitle, height, accent }: MockCardProps) {
  const { colors, surfaces, layout, typeScale, glass } = theme;
  return (
    <View
      style={{
        flex: 1,
        height,
        padding: layout.spacing.md,
        backgroundColor: accent ? colors.primaryContainer : glass.cardFill,
        borderWidth: 1,
        borderColor: accent ? colors.primaryContainer : glass.cardBorder,
        borderRadius: surfaces.cornerRadius.card,
        justifyContent: 'space-between',
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 1.5,
          color: accent ? colors.background : colors.textSecondary,
        }}
      >
        {title.toUpperCase()}
      </Text>
      <Text
        style={{
          fontSize: typeScale.subheading.size,
          fontWeight: typeScale.subheading.weight,
          color: accent ? colors.background : colors.text,
        }}
      >
        {subtitle}
      </Text>
    </View>
  );
}

function MockTabBar({ theme }: { theme: ThemeProfile }) {
  const { colors, surfaces, glass, layout } = theme;
  const style = layout.tabBarStyle;
  const dots = ['Home', 'Discover', 'Search', 'Sync', 'Settings'];
  return (
    <View
      style={{
        marginHorizontal: style === 'floating-pill' ? layout.spacing.md : 0,
        marginBottom: style === 'floating-pill' ? 80 : 72,
        backgroundColor: glass.dockFill,
        borderColor: glass.dockBorder,
        borderWidth: 1,
        borderRadius:
          style === 'floating-pill' ? surfaces.cornerRadius.tabBar : 0,
        paddingVertical: 12,
        paddingHorizontal: 16,
        flexDirection: 'row',
        justifyContent: 'space-around',
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 60,
      }}
    >
      {dots.map((label, i) => (
        <View key={label} style={{ alignItems: 'center', gap: 4 }}>
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 6,
              backgroundColor: i === 0 ? colors.primary : colors.textTertiary,
            }}
          />
          {style !== 'minimal-dots' && (
            <Text
              style={{
                fontSize: 9,
                color: i === 0 ? colors.primary : colors.textSecondary,
              }}
            >
              {label}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    gap: 8,
  },
  headerButton: {
    minWidth: 72,
  },
  footer: {
    borderTopWidth: 1,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
