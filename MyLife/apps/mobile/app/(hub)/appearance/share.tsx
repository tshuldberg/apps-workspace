import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import {
  Text,
  THEME_PRESETS,
  useTheme,
  validateTheme,
  type ThemeProfile,
} from '@mylife/ui';
import { getThemeProfile } from '@mylife/db';
import { useDatabase } from '../../../components/DatabaseProvider';

interface ResolvedTheme {
  theme: ThemeProfile;
  json: string;
}

/** Resolve a theme id. Custom themes return raw DB JSON; presets are re-serialized. */
function resolveTheme(
  db: ReturnType<typeof useDatabase>,
  themeId: string | undefined,
): ResolvedTheme | null {
  if (!themeId) return null;
  const preset = THEME_PRESETS[themeId];
  if (preset) {
    return { theme: preset, json: JSON.stringify(preset, null, 2) };
  }
  const row = getThemeProfile(db, themeId);
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.json);
    const result = validateTheme(parsed);
    if (!result.success) return null;
    return { theme: result.theme, json: row.json };
  } catch {
    return null;
  }
}

export default function ThemeShareScreen() {
  const params = useLocalSearchParams<{ themeId?: string }>();
  const router = useRouter();
  const db = useDatabase();
  const outerTheme = useTheme();
  const { colors, glass, surfaces, typeScale, layout } = outerTheme;
  const insets = useSafeAreaInsets();

  const resolved = useMemo(
    () => resolveTheme(db, params.themeId),
    [db, params.themeId],
  );

  const [copied, setCopied] = useState(false);

  const handleCopyJson = useCallback(async () => {
    if (!resolved) return;
    try {
      await Clipboard.setStringAsync(resolved.json);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      try {
        await Share.share({ message: resolved.json });
      } catch {
        // User cancelled or platform refused; no-op.
      }
    }
  }, [resolved]);

  if (!resolved) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
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
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.headerButton}>
            <Text style={{ fontSize: typeScale.body.size, color: colors.text }}>
              {'< Back'}
            </Text>
          </Pressable>
          <Text
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: typeScale.subheading.size,
              fontWeight: typeScale.subheading.weight,
              color: colors.text,
            }}
          >
            Share Theme
          </Text>
          <View style={styles.headerButton} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: layout.spacing.lg }}>
          <Text style={{ fontSize: typeScale.body.size, color: colors.textSecondary, textAlign: 'center' }}>
            Theme not found.
          </Text>
        </View>
      </View>
    );
  }

  const { theme } = resolved;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
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
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.headerButton}>
          <Text style={{ fontSize: typeScale.body.size, color: colors.text }}>
            {'< Back'}
          </Text>
        </Pressable>
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: typeScale.subheading.size,
            fontWeight: typeScale.subheading.weight,
            color: colors.text,
          }}
        >
          Share {theme.name}
        </Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: layout.spacing.md,
          paddingBottom: Math.max(insets.bottom, 16) + 40,
          gap: layout.spacing.md,
        }}
      >
        {/* Theme Preview */}
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
          <View style={{ flexDirection: 'row', gap: layout.spacing.sm }}>
            <ColorBlock color={theme.colors.background} label="bg" />
            <ColorBlock color={theme.colors.surface} label="surface" />
            <ColorBlock color={theme.colors.accent} label="accent" />
            <ColorBlock color={theme.colors.primary} label="primary" />
          </View>
          <Text
            style={{
              fontSize: typeScale.subheading.size,
              fontWeight: typeScale.subheading.weight,
              color: colors.text,
              marginTop: layout.spacing.xs,
            }}
          >
            {theme.name}
          </Text>
          {theme.description && (
            <Text
              style={{
                fontSize: typeScale.caption.size,
                color: colors.textSecondary,
                lineHeight: 18,
              }}
            >
              {theme.description}
            </Text>
          )}
        </View>

        {/* Share Options */}
        <View style={{ gap: layout.spacing.sm }}>
          <ShareAction
            title={copied ? 'Copied!' : 'Copy JSON'}
            subtitle="Copies the full theme to your clipboard"
            active={copied}
            onPress={handleCopyJson}
          />

          <View
            style={{
              backgroundColor: glass.cardFill,
              borderColor: glass.cardBorder,
              borderWidth: 1,
              borderRadius: surfaces.cornerRadius.card,
              padding: layout.spacing.md,
              alignItems: 'center',
              gap: layout.spacing.sm,
            }}
          >
            <Text
              style={{
                fontSize: typeScale.label.size,
                fontWeight: '700',
                color: colors.textSecondary,
                letterSpacing: typeScale.label.letterSpacing,
                textTransform: 'uppercase',
              }}
            >
              QR Code
            </Text>
            <View
              style={{
                width: 200,
                height: 200,
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: surfaces.cornerRadius.card,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 48, color: colors.textTertiary }}>⊡</Text>
            </View>
            <Text
              style={{
                fontSize: typeScale.caption.size,
                color: colors.textSecondary,
                textAlign: 'center',
              }}
            >
              QR generation coming in a future update
            </Text>
          </View>

          <DisabledAction
            title="Share Link"
            subtitle="Coming soon"
          />
        </View>

        <Text
          style={{
            fontSize: typeScale.caption.size,
            color: colors.textTertiary,
            textAlign: 'center',
            lineHeight: 18,
            marginTop: layout.spacing.sm,
          }}
        >
          Others can import your theme via Appearance → New+ → Import JSON.
        </Text>
      </ScrollView>
    </View>
  );
}

interface ColorBlockProps {
  color: string;
  label: string;
}

function ColorBlock({ color, label }: ColorBlockProps) {
  const theme = useTheme();
  const { colors, surfaces, typeScale } = theme;
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
      <View
        style={{
          width: '100%',
          height: 44,
          backgroundColor: color,
          borderRadius: surfaces.cornerRadius.icon,
          borderColor: colors.border,
          borderWidth: 1,
        }}
      />
      <Text
        style={{
          fontSize: 10,
          color: colors.textTertiary,
          letterSpacing: typeScale.label.letterSpacing,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

interface ShareActionProps {
  title: string;
  subtitle: string;
  active?: boolean;
  onPress: () => void;
}

function ShareAction({ title, subtitle, active, onPress }: ShareActionProps) {
  const theme = useTheme();
  const { colors, glass, surfaces, typeScale, layout } = theme;
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: active ? colors.success : glass.cardFill,
        borderColor: active ? colors.success : glass.cardBorder,
        borderWidth: 1,
        borderRadius: surfaces.cornerRadius.card,
        padding: layout.spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: typeScale.body.size,
            fontWeight: '700',
            color: active ? colors.background : colors.text,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontSize: typeScale.caption.size,
            color: active ? colors.background : colors.textSecondary,
            marginTop: 2,
          }}
        >
          {subtitle}
        </Text>
      </View>
      <Text
        style={{
          fontSize: 20,
          color: active ? colors.background : colors.textSecondary,
          marginLeft: layout.spacing.sm,
        }}
      >
        {active ? '✓' : '›'}
      </Text>
    </Pressable>
  );
}

interface DisabledActionProps {
  title: string;
  subtitle: string;
}

function DisabledAction({ title, subtitle }: DisabledActionProps) {
  const theme = useTheme();
  const { colors, glass, surfaces, typeScale, layout } = theme;
  return (
    <View
      style={{
        backgroundColor: glass.cardFill,
        borderColor: glass.cardBorder,
        borderWidth: 1,
        borderRadius: surfaces.cornerRadius.card,
        padding: layout.spacing.md,
        opacity: 0.5,
      }}
    >
      <Text
        style={{
          fontSize: typeScale.body.size,
          fontWeight: '700',
          color: colors.textSecondary,
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          fontSize: typeScale.caption.size,
          color: colors.textTertiary,
          marginTop: 2,
        }}
      >
        {subtitle}
      </Text>
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
});
