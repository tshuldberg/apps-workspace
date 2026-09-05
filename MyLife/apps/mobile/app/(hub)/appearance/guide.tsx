import { useCallback, useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Text, useTheme, type ThemeProfile } from '@mylife/ui';

const AI_EXAMPLES = [
  '"A warm retro terminal with amber text on deep navy"',
  '"Calm ocean theme with soft blues and coral accents"',
  '"Brutalist black and white with stark edges and large type"',
  '"Pastel cottagecore, rounded corners, sage and butter yellow"',
  '"Cyberpunk neon on jet black, glowing pink and electric teal"',
];

const PROMPT_TEMPLATE = `Generate a MyLife theme JSON. Required fields:
- id, name, description, author, version: 1, colorMode: "dark" or "light"
- colors: background, surface, surfaceElevated, text, textSecondary, textTertiary, border, danger, success, warning, accent, primary, primaryContainer
- glass: cardFill, cardBorder, strongFill, strongBorder, dockFill, dockBorder, blurIntensity (0-100)
- fonts: display (heading font), body (text font)
- typeScale: heroTitle/heading/subheading/body/caption/label with size/weight/lineHeight
- surfaces: treatment (glass|solid|gradient|neumorphic|flat), cornerRadius {card,button,icon,tabBar}, shadows {card,elevated}
- layout: dashboardStyle (bento-grid|list|cards-horizontal), moduleGridColumns (3-5), tabBarStyle (floating-pill|bottom-attached|minimal-dots), headerStyle (wordmark|logo|minimal), spacing {xs,sm,md,lg,xl}

I want: [YOUR DESCRIPTION HERE]`;

const SCHEMA_REFERENCE: Array<{ key: string; desc: string }> = [
  { key: 'colors.background', desc: 'The main app background color' },
  { key: 'colors.accent', desc: 'The highlight color for buttons and active elements' },
  {
    key: 'surfaces.treatment',
    desc: 'How cards look: glass (see-through), solid (opaque), flat (no effects)',
  },
  {
    key: 'layout.dashboardStyle',
    desc: 'bento-grid (default), list, or cards-horizontal',
  },
];

export default function ThemeGuideScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { colors, typeScale, layout } = theme;
  const insets = useSafeAreaInsets();

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
          Theme Guide
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
        <CollapsibleSection title="Quick Start" defaultOpen>
          <NumberedStep
            n={1}
            title="Pick a preset you like"
            body="Swipe through built-in themes, tap to apply."
          />
          <NumberedStep
            n={2}
            title="Customize it"
            body="Long-press any theme, then tap Customize."
          />
          <NumberedStep
            n={3}
            title="Make it yours"
            body="Adjust colors, fonts, and layout. Save."
          />
        </CollapsibleSection>

        <CollapsibleSection title="Use AI to Design">
          <Text style={bodyStyle(theme)}>
            Open the AI Theme Creator from the Appearance screen.
          </Text>
          <Text style={bodyStyle(theme)}>
            Describe what you want in plain English.
          </Text>
          <Text
            style={{
              fontSize: typeScale.caption.size,
              color: colors.textSecondary,
              fontWeight: '700',
              letterSpacing: typeScale.label.letterSpacing,
              textTransform: 'uppercase',
              marginTop: layout.spacing.sm,
            }}
          >
            Examples that work well
          </Text>
          {AI_EXAMPLES.map((ex) => (
            <Text
              key={ex}
              style={{
                fontSize: typeScale.caption.size,
                color: colors.textSecondary,
                fontStyle: 'italic',
                lineHeight: 20,
              }}
            >
              {ex}
            </Text>
          ))}
          <Text
            style={{
              fontSize: typeScale.caption.size,
              color: colors.textTertiary,
              marginTop: layout.spacing.sm,
              lineHeight: 18,
            }}
          >
            Tips: Be specific about colors and mood. Reference apps or aesthetics you like.
          </Text>
        </CollapsibleSection>

        <CollapsibleSection title="Advanced: Edit JSON">
          <Text
            style={{
              fontSize: typeScale.caption.size,
              color: colors.textSecondary,
              fontWeight: '700',
              letterSpacing: typeScale.label.letterSpacing,
              textTransform: 'uppercase',
              marginBottom: layout.spacing.xs,
            }}
          >
            Schema reference
          </Text>
          {SCHEMA_REFERENCE.map((entry) => (
            <View key={entry.key} style={{ marginBottom: layout.spacing.xs }}>
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: 'Courier',
                  color: colors.accent,
                }}
              >
                {entry.key}
              </Text>
              <Text style={bodyStyle(theme)}>{entry.desc}</Text>
            </View>
          ))}

          <Text
            style={{
              fontSize: typeScale.caption.size,
              color: colors.textSecondary,
              fontWeight: '700',
              letterSpacing: typeScale.label.letterSpacing,
              textTransform: 'uppercase',
              marginTop: layout.spacing.md,
              marginBottom: layout.spacing.xs,
            }}
          >
            Copyable prompt template
          </Text>
          <CopyableCodeBlock content={PROMPT_TEMPLATE} />

          <Text
            style={[bodyStyle(theme), { marginTop: layout.spacing.sm }]}
          >
            Paste the result into Import Theme.
          </Text>
        </CollapsibleSection>

        <CollapsibleSection title="Share & Discover">
          <BulletLine theme={theme} text="Export: tap ... on any custom theme → Share → Copy JSON" />
          <BulletLine theme={theme} text="Import: Appearance → New+ → Import JSON → paste" />
          <BulletLine theme={theme} text="QR: coming soon — scan a friend's QR code to get their theme" />
        </CollapsibleSection>

        <CollapsibleSection title="Accessibility Tips">
          <BulletLine theme={theme} text="Text should have at least 4.5:1 contrast ratio against its background" />
          <BulletLine theme={theme} text="The theme editor shows a contrast warning if colors are too similar" />
          <BulletLine theme={theme} text="Dark themes are easier on eyes at night" />
          <BulletLine theme={theme} text="If you have vision needs, try the Extra Large type scale" />
        </CollapsibleSection>
      </ScrollView>
    </View>
  );
}

function bodyStyle(theme: ThemeProfile) {
  return {
    fontSize: theme.typeScale.body.size,
    lineHeight: 22,
    color: theme.colors.text,
  } as const;
}

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

function CollapsibleSection({ title, defaultOpen, children }: CollapsibleSectionProps) {
  const theme = useTheme();
  const { colors, glass, surfaces, typeScale, layout } = theme;
  const [open, setOpen] = useState(defaultOpen ?? false);

  const toggle = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setOpen((prev) => !prev);
  }, []);

  return (
    <View
      style={{
        backgroundColor: glass.cardFill,
        borderColor: glass.cardBorder,
        borderWidth: 1,
        borderRadius: surfaces.cornerRadius.card,
        overflow: 'hidden',
      }}
    >
      <Pressable
        onPress={toggle}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: layout.spacing.md,
          paddingVertical: layout.spacing.md,
        }}
      >
        <Text
          style={{
            fontSize: typeScale.subheading.size,
            fontWeight: typeScale.subheading.weight,
            color: colors.text,
            flex: 1,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontSize: 18,
            color: colors.textSecondary,
            transform: [{ rotate: open ? '90deg' : '0deg' }],
          }}
        >
          ›
        </Text>
      </Pressable>
      {open && (
        <View
          style={{
            paddingHorizontal: layout.spacing.md,
            paddingBottom: layout.spacing.md,
            gap: layout.spacing.xs,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingTop: layout.spacing.md,
          }}
        >
          {children}
        </View>
      )}
    </View>
  );
}

interface NumberedStepProps {
  n: number;
  title: string;
  body: string;
}

function NumberedStep({ n, title, body }: NumberedStepProps) {
  const theme = useTheme();
  const { colors, surfaces, typeScale, layout } = theme;
  return (
    <View style={{ flexDirection: 'row', gap: layout.spacing.sm, marginBottom: layout.spacing.sm }}>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: surfaces.cornerRadius.icon,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontSize: typeScale.caption.size,
            fontWeight: '700',
            color: colors.background,
          }}
        >
          {n}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: typeScale.body.size,
            fontWeight: '700',
            color: colors.text,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontSize: typeScale.caption.size,
            color: colors.textSecondary,
            marginTop: 2,
            lineHeight: 18,
          }}
        >
          {body}
        </Text>
      </View>
    </View>
  );
}

interface BulletLineProps {
  theme: ThemeProfile;
  text: string;
}

function BulletLine({ theme, text }: BulletLineProps) {
  const { colors, typeScale, layout } = theme;
  return (
    <View style={{ flexDirection: 'row', gap: layout.spacing.xs, paddingVertical: 2 }}>
      <Text style={{ fontSize: typeScale.body.size, color: colors.accent }}>•</Text>
      <Text
        style={{
          flex: 1,
          fontSize: typeScale.body.size,
          lineHeight: 22,
          color: colors.text,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

interface CopyableCodeBlockProps {
  content: string;
}

function CopyableCodeBlock({ content }: CopyableCodeBlockProps) {
  const theme = useTheme();
  const { colors, surfaces, typeScale, layout } = theme;
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(content);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can fail silently on some platforms; no surfaced error needed.
    }
  }, [content]);

  return (
    <View
      style={{
        backgroundColor: colors.surfaceElevated,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: surfaces.cornerRadius.card,
        padding: layout.spacing.sm,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          lineHeight: 18,
          fontFamily: 'Courier',
          color: colors.text,
        }}
      >
        {content}
      </Text>
      <Pressable
        onPress={onCopy}
        style={{
          alignSelf: 'flex-end',
          marginTop: layout.spacing.sm,
          paddingHorizontal: 14,
          paddingVertical: 6,
          borderRadius: surfaces.cornerRadius.button,
          backgroundColor: copied ? colors.success : colors.primary,
        }}
      >
        <Text
          style={{
            fontSize: typeScale.label.size,
            fontWeight: '700',
            color: colors.background,
            letterSpacing: typeScale.label.letterSpacing,
          }}
        >
          {copied ? 'Copied!' : 'Copy'}
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
