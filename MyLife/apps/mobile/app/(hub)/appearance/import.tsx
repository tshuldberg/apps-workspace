import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  Text,
  ThemeProvider,
  useTheme,
  validateTheme,
  type ThemeProfile,
} from '@mylife/ui';
import { saveThemeProfile } from '@mylife/db';
import { useDatabase } from '../../../components/DatabaseProvider';

const JSON_PLACEHOLDER = `{
  "id": "my-theme",
  "name": "My Theme",
  "colorMode": "dark",
  "colors": { "background": "#...", ... },
  "fonts": { "display": "...", "body": "..." },
  "surfaces": { "treatment": "glass", ... },
  "layout": { "dashboardStyle": "bento-grid", ... }
}`;

type Tab = 'paste' | 'qr';

type ValidationState =
  | { kind: 'idle' }
  | { kind: 'valid'; theme: ThemeProfile }
  | { kind: 'invalid'; errors: string[] };

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'theme';
}

export default function ImportThemeScreen() {
  const router = useRouter();
  const db = useDatabase();
  const theme = useTheme();
  const { colors, glass, surfaces, typeScale, layout } = theme;
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<Tab>('paste');
  const [input, setInput] = useState('');
  const [validation, setValidation] = useState<ValidationState>({ kind: 'idle' });

  const handleValidate = useCallback(() => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(input);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid JSON';
      setValidation({ kind: 'invalid', errors: [`JSON parse error: ${message}`] });
      return;
    }
    const result = validateTheme(parsed);
    if (result.success) {
      setValidation({ kind: 'valid', theme: result.theme });
      Haptics.selectionAsync().catch(() => {});
    } else {
      setValidation({ kind: 'invalid', errors: result.errors });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
  }, [input]);

  const promptForName = useCallback(
    (previewTheme: ThemeProfile) => {
      Alert.prompt(
        'Name this theme',
        'Save as',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Import',
            onPress: (name?: string) => {
              const finalName = (name ?? '').trim() || previewTheme.name || 'Imported Theme';
              const id = `${slugify(finalName)}-${Date.now()}`;
              saveThemeProfile(db, {
                id,
                name: finalName,
                json: input,
                source: 'imported',
              });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              router.back();
            },
          },
        ],
        'plain-text',
        previewTheme.name,
      );
    },
    [db, input, router],
  );

  const handleImport = useCallback(() => {
    if (validation.kind !== 'valid') return;
    promptForName(validation.theme);
  }, [promptForName, validation]);

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
          Import Theme
        </Text>
        <View style={styles.headerButton} />
      </View>

      <View
        style={{
          flexDirection: 'row',
          gap: layout.spacing.sm,
          paddingHorizontal: layout.spacing.md,
          paddingTop: layout.spacing.md,
        }}
      >
        <TabPill
          label="Paste JSON"
          active={tab === 'paste'}
          onPress={() => setTab('paste')}
        />
        <TabPill
          label="Scan QR"
          active={tab === 'qr'}
          onPress={() => setTab('qr')}
        />
      </View>

      {tab === 'paste' ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: layout.spacing.md,
            paddingBottom: Math.max(insets.bottom, 16) + 40,
            gap: layout.spacing.md,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={{
              backgroundColor: glass.cardFill,
              borderColor: glass.cardBorder,
              borderWidth: 1,
              borderRadius: surfaces.cornerRadius.card,
              padding: layout.spacing.sm,
            }}
          >
            <TextInput
              value={input}
              onChangeText={(text) => {
                setInput(text);
                if (validation.kind !== 'idle') setValidation({ kind: 'idle' });
              }}
              placeholder={JSON_PLACEHOLDER}
              placeholderTextColor={colors.textTertiary}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              style={{
                minHeight: 320,
                color: colors.text,
                fontSize: 13,
                lineHeight: 18,
                fontFamily: 'Courier',
                textAlignVertical: 'top',
              }}
            />
          </View>

          <Pressable
            onPress={handleValidate}
            disabled={input.trim().length === 0}
            style={{
              backgroundColor:
                input.trim().length === 0 ? colors.surfaceElevated : colors.primary,
              borderRadius: surfaces.cornerRadius.button,
              paddingVertical: 14,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontSize: typeScale.body.size,
                fontWeight: '700',
                color:
                  input.trim().length === 0 ? colors.textTertiary : colors.background,
              }}
            >
              Validate & Preview
            </Text>
          </Pressable>

          {validation.kind === 'invalid' && (
            <View
              style={{
                backgroundColor: glass.cardFill,
                borderColor: colors.danger,
                borderWidth: 1,
                borderRadius: surfaces.cornerRadius.card,
                padding: layout.spacing.md,
                gap: layout.spacing.xs,
              }}
            >
              <Text
                style={{
                  fontSize: typeScale.label.size,
                  fontWeight: '700',
                  color: colors.danger,
                  letterSpacing: typeScale.label.letterSpacing,
                }}
              >
                VALIDATION FAILED
              </Text>
              {validation.errors.slice(0, 10).map((err, idx) => (
                <Text
                  key={idx}
                  style={{
                    fontSize: typeScale.caption.size,
                    color: colors.danger,
                  }}
                >
                  - {err}
                </Text>
              ))}
              {validation.errors.length > 10 && (
                <Text
                  style={{
                    fontSize: typeScale.caption.size,
                    color: colors.danger,
                    fontStyle: 'italic',
                  }}
                >
                  ...and {validation.errors.length - 10} more
                </Text>
              )}
            </View>
          )}

          {validation.kind === 'valid' && (
            <ValidPreview
              theme={validation.theme}
              onImport={handleImport}
            />
          )}
        </ScrollView>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: layout.spacing.md,
            paddingBottom: Math.max(insets.bottom, 16) + 40,
            gap: layout.spacing.md,
          }}
        >
          <View
            style={{
              backgroundColor: glass.cardFill,
              borderColor: glass.cardBorder,
              borderWidth: 1,
              borderRadius: surfaces.cornerRadius.card,
              paddingVertical: 64,
              paddingHorizontal: layout.spacing.lg,
              alignItems: 'center',
              gap: layout.spacing.md,
            }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: surfaces.cornerRadius.icon,
                backgroundColor: colors.surfaceElevated,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 32 }}>⊡</Text>
            </View>
            <Text
              style={{
                fontSize: typeScale.subheading.size,
                fontWeight: typeScale.subheading.weight,
                color: colors.text,
                textAlign: 'center',
              }}
            >
              QR scanning coming soon
            </Text>
            <Text
              style={{
                fontSize: typeScale.caption.size,
                color: colors.textSecondary,
                textAlign: 'center',
                lineHeight: 18,
              }}
            >
              Themes can be shared as QR codes. This feature requires expo-camera and will land in a future update.
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

interface TabPillProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

function TabPill({ label, active, onPress }: TabPillProps) {
  const theme = useTheme();
  const { colors, surfaces, typeScale } = theme;
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        backgroundColor: active ? colors.primary : colors.surfaceElevated,
        paddingVertical: 10,
        borderRadius: surfaces.cornerRadius.button,
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          fontSize: typeScale.label.size,
          fontWeight: '700',
          color: active ? colors.background : colors.textSecondary,
          letterSpacing: typeScale.label.letterSpacing,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

interface ValidPreviewProps {
  theme: ThemeProfile;
  onImport: () => void;
}

function ValidPreview({ theme, onImport }: ValidPreviewProps) {
  const outer = useTheme();
  const sample = useMemo(
    () => [theme.colors.primary, theme.colors.primaryContainer, theme.colors.accent, theme.colors.success],
    [theme],
  );
  return (
    <View
      style={{
        backgroundColor: outer.glass.cardFill,
        borderColor: outer.colors.success,
        borderWidth: 1,
        borderRadius: outer.surfaces.cornerRadius.card,
        padding: outer.layout.spacing.md,
        gap: outer.layout.spacing.sm,
      }}
    >
      <Text
        style={{
          fontSize: outer.typeScale.label.size,
          fontWeight: '700',
          color: outer.colors.success,
          letterSpacing: outer.typeScale.label.letterSpacing,
        }}
      >
        VALID THEME
      </Text>
      <Text
        style={{
          fontSize: outer.typeScale.subheading.size,
          fontWeight: outer.typeScale.subheading.weight,
          color: outer.colors.text,
        }}
      >
        {theme.name}
      </Text>
      {theme.description && (
        <Text
          style={{
            fontSize: outer.typeScale.caption.size,
            color: outer.colors.textSecondary,
          }}
        >
          {theme.description}
        </Text>
      )}
      <ThemeProvider theme={theme}>
        <View
          style={{
            marginTop: outer.layout.spacing.sm,
            height: 120,
            backgroundColor: theme.colors.background,
            borderColor: theme.colors.border,
            borderWidth: 1,
            borderRadius: theme.surfaces.cornerRadius.card,
            padding: theme.layout.spacing.md,
            gap: theme.layout.spacing.sm,
          }}
        >
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {sample.map((bg, i) => (
              <View
                key={i}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: theme.surfaces.cornerRadius.icon,
                  backgroundColor: bg,
                }}
              />
            ))}
          </View>
          <View
            style={{
              flex: 1,
              backgroundColor: theme.colors.surfaceElevated,
              borderRadius: theme.surfaces.cornerRadius.card,
            }}
          />
        </View>
      </ThemeProvider>
      <Pressable
        onPress={onImport}
        style={{
          backgroundColor: outer.colors.primary,
          borderRadius: outer.surfaces.cornerRadius.button,
          paddingVertical: 14,
          alignItems: 'center',
          marginTop: outer.layout.spacing.sm,
        }}
      >
        <Text
          style={{
            fontSize: outer.typeScale.body.size,
            fontWeight: '700',
            color: outer.colors.background,
          }}
        >
          Import
        </Text>
      </Pressable>
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
