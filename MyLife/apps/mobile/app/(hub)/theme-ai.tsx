import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  COOL_OBSIDIAN,
  Text,
  ThemeProvider,
  mergeTheme,
  useTheme,
  validateTheme,
  type ColorMode,
  type DashboardStyle,
  type SurfaceTreatment,
  type TabBarStyle,
  type ThemeProfile,
} from '@mylife/ui';
import { saveThemeProfile, setActiveThemeId } from '@mylife/db';
import { useDatabase } from '../../components/DatabaseProvider';
import { HUB_TAB_BAR_CLEARANCE } from './_layout';

// --------------------------------------------------------------------------
// Example prompts
// --------------------------------------------------------------------------

const EXAMPLE_PROMPTS: readonly string[] = [
  'Dark blue like the ocean at night with warm orange accents',
  'Minimal black and white, bold typography, no rounded corners',
  'Pastel pink and lavender, soft and calming, rounded everything',
  'Like the Spotify dark theme but with green replaced by amber',
  'High contrast for reading at night, easy on the eyes',
  'Retro terminal look, green on black, monospace font',
];

// --------------------------------------------------------------------------
// Mock generator (TODO: Replace with real Claude API call via backend proxy)
// --------------------------------------------------------------------------

interface ColorPalette {
  background: string;
  surface: string;
  surfaceElevated: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  primary: string;
  primaryContainer: string;
}

const DARK_PALETTE: ColorPalette = {
  background: '#0B0B10',
  surface: '#131318',
  surfaceElevated: '#1F1F27',
  text: '#E8E6EE',
  textSecondary: '#B4B0BD',
  textTertiary: 'rgba(232,230,238,0.35)',
  border: 'rgba(255,255,255,0.08)',
  primary: '#FFB877',
  primaryContainer: '#C9894D',
};

const LIGHT_PALETTE: ColorPalette = {
  background: '#F8F7F4',
  surface: '#FFFFFF',
  surfaceElevated: '#F0EEE8',
  text: '#1A1A1F',
  textSecondary: '#5A5661',
  textTertiary: 'rgba(26,26,31,0.4)',
  border: 'rgba(0,0,0,0.08)',
  primary: '#2563EB',
  primaryContainer: '#DBEAFE',
};

// Color word -> hex accent
const COLOR_KEYWORDS: Array<{ words: string[]; accent: string; container: string }> = [
  { words: ['blue', 'ocean', 'navy', 'sea'], accent: '#0066CC', container: '#1E3A8A' },
  { words: ['red', 'ruby', 'crimson', 'cherry'], accent: '#DC2626', container: '#7F1D1D' },
  { words: ['green', 'forest', 'emerald', 'lime'], accent: '#059669', container: '#064E3B' },
  { words: ['pink', 'rose', 'blush', 'magenta'], accent: '#EC4899', container: '#831843' },
  { words: ['purple', 'violet', 'lavender', 'lilac'], accent: '#8B5CF6', container: '#4C1D95' },
  { words: ['orange', 'amber', 'warm', 'tangerine'], accent: '#D97706', container: '#78350F' },
  { words: ['gold', 'honey', 'yellow', 'mustard'], accent: '#B8860B', container: '#713F12' },
  { words: ['teal', 'cyan', 'aqua', 'turquoise'], accent: '#0D9488', container: '#134E4A' },
  { words: ['terminal', 'matrix', 'hacker'], accent: '#00FF41', container: '#003D10' },
];

const FONT_KEYWORDS: Array<{ words: string[]; display: string; body: string }> = [
  { words: ['terminal', 'code', 'mono', 'monospace', 'retro'], display: 'JetBrains Mono', body: 'JetBrains Mono' },
  { words: ['serif', 'classic', 'elegant', 'editorial'], display: 'Playfair Display', body: 'Newsreader' },
  { words: ['minimal', 'clean', 'modern', 'bold'], display: 'Space Grotesk', body: 'Inter' },
  { words: ['playful', 'fun', 'rounded', 'friendly'], display: 'Nunito', body: 'Nunito' },
  { words: ['warm', 'cozy', 'approachable'], display: 'DM Sans', body: 'DM Sans' },
];

function detectColorMode(prompt: string): ColorMode {
  const p = prompt.toLowerCase();
  const darkHits = /(dark|night|midnight|deep|black|noir)/.test(p);
  const lightHits = /(light|bright|clean|white|pastel|soft)/.test(p);
  if (lightHits && !darkHits) return 'light';
  return 'dark';
}

function detectAccentColor(prompt: string): { accent: string; container: string } | null {
  const p = prompt.toLowerCase();
  for (const entry of COLOR_KEYWORDS) {
    if (entry.words.some((w) => p.includes(w))) {
      return { accent: entry.accent, container: entry.container };
    }
  }
  return null;
}

function detectFonts(prompt: string): { display: string; body: string } | null {
  const p = prompt.toLowerCase();
  for (const entry of FONT_KEYWORDS) {
    if (entry.words.some((w) => p.includes(w))) {
      return { display: entry.display, body: entry.body };
    }
  }
  return null;
}

function detectTreatment(prompt: string): SurfaceTreatment {
  const p = prompt.toLowerCase();
  if (/(glass|transparent|blur|frosted)/.test(p)) return 'glass';
  if (/(flat|minimal|clean)/.test(p)) return 'flat';
  if (/(gradient|shift|aurora|fade)/.test(p)) return 'gradient';
  if (/(raised|3d|soft|neumorphic|neumorph)/.test(p)) return 'neumorphic';
  if (/(solid|card)/.test(p)) return 'solid';
  return 'glass';
}

function detectDashboardStyle(prompt: string): DashboardStyle {
  const p = prompt.toLowerCase();
  if (/(list|minimal|dense)/.test(p)) return 'list';
  if (/(horizontal|swipe|carousel)/.test(p)) return 'cards-horizontal';
  return 'bento-grid';
}

function detectTabBarStyle(prompt: string): TabBarStyle {
  const p = prompt.toLowerCase();
  if (/(attached|bottom|fixed)/.test(p)) return 'bottom-attached';
  if (/(dots|minimal|tiny)/.test(p)) return 'minimal-dots';
  return 'floating-pill';
}

function detectCornerRadius(prompt: string): number {
  const p = prompt.toLowerCase();
  if (/(sharp|square|angular|no.*round|no rounded)/.test(p)) return 0;
  if (/(round|pill|soft|circle|bubble)/.test(p)) return 24;
  return 16;
}

function detectSpacing(prompt: string): 'compact' | 'default' | 'spacious' {
  const p = prompt.toLowerCase();
  if (/(compact|dense|tight)/.test(p)) return 'compact';
  if (/(spacious|airy|open|breathable)/.test(p)) return 'spacious';
  return 'default';
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return `rgba(255,255,255,${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function generateThemeFromPrompt(
  prompt: string,
  baseTheme: ThemeProfile = COOL_OBSIDIAN,
): ThemeProfile {
  // TODO: Replace with real Claude API call via backend proxy
  const mode = detectColorMode(prompt);
  const palette: ColorPalette = mode === 'light' ? { ...LIGHT_PALETTE } : { ...DARK_PALETTE };
  const accent = detectAccentColor(prompt);
  if (accent) {
    palette.primary = accent.accent;
    palette.primaryContainer = accent.container;
  }

  const fonts = detectFonts(prompt);
  const treatment = detectTreatment(prompt);
  const dashStyle = detectDashboardStyle(prompt);
  const tabStyle = detectTabBarStyle(prompt);
  const radius = detectCornerRadius(prompt);
  const spacingKey = detectSpacing(prompt);
  const spacingMap = {
    compact: { xs: 2, sm: 4, md: 10, lg: 16, xl: 24 },
    default: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
    spacious: { xs: 6, sm: 12, md: 20, lg: 32, xl: 40 },
  } as const;

  const overrides: Partial<ThemeProfile> = {
    colorMode: mode,
    colors: {
      background: palette.background,
      surface: palette.surface,
      surfaceElevated: palette.surfaceElevated,
      text: palette.text,
      textSecondary: palette.textSecondary,
      textTertiary: palette.textTertiary,
      border: palette.border,
      danger: '#EF4444',
      success: '#22C55E',
      warning: '#F59E0B',
      accent: palette.primary,
      primary: palette.primary,
      primaryContainer: palette.primaryContainer,
    },
    glass: {
      cardFill: mode === 'light' ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)',
      cardBorder: mode === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)',
      strongFill: mode === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)',
      strongBorder: mode === 'light' ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)',
      dockFill: mode === 'light' ? 'rgba(255,255,255,0.65)' : hexToRgba(palette.background, 0.65),
      dockBorder: mode === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)',
      blurIntensity: treatment === 'glass' ? 60 : 20,
    },
    surfaces: {
      treatment,
      cornerRadius: {
        card: radius,
        button: Math.max(0, radius - 4),
        icon: Math.max(0, Math.min(12, radius - 4)),
        tabBar: radius + 4,
      },
      shadows: {
        card: radius === 0 ? 'none' : '0 2px 4px rgba(0,0,0,0.15)',
        elevated: radius === 0 ? 'none' : '0 4px 8px rgba(0,0,0,0.25)',
      },
    },
    layout: {
      dashboardStyle: dashStyle,
      moduleGridColumns: 4,
      tabBarStyle: tabStyle,
      headerStyle: 'wordmark',
      spacing: spacingMap[spacingKey],
    },
  };

  if (fonts) {
    overrides.fonts = { display: fonts.display, body: fonts.body };
  }

  const merged = mergeTheme(baseTheme, overrides);
  return {
    ...merged,
    id: `ai-${Date.now().toString(36)}`,
    name: deriveThemeName(prompt),
    description: `AI-generated: ${prompt.slice(0, 60)}`,
    author: 'AI',
    version: '1.0.0',
  };
}

function deriveThemeName(prompt: string): string {
  const trimmed = prompt.trim();
  if (trimmed.length === 0) return 'AI Theme';
  const first = trimmed.slice(0, 20).trim();
  const capped = first.charAt(0).toUpperCase() + first.slice(1);
  return `${capped} Theme`;
}

// --------------------------------------------------------------------------
// History entry
// --------------------------------------------------------------------------

interface HistoryEntry {
  prompt: string;
  theme: ThemeProfile;
}

// --------------------------------------------------------------------------
// Main screen
// --------------------------------------------------------------------------

export default function ThemeAIScreen() {
  const router = useRouter();
  const db = useDatabase();
  const chrome = useTheme();

  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedTheme, setGeneratedTheme] = useState<ThemeProfile | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showExamples, setShowExamples] = useState(false);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [refinePrompt, setRefinePrompt] = useState('');

  const pulseAnim = useRef(new Animated.Value(1)).current;

  const cc = chrome.colors;
  const cs = chrome.surfaces;
  const cl = chrome.layout;

  const startPulse = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.5,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [pulseAnim]);

  const stopPulse = useCallback(() => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  }, [pulseAnim]);

  const runGeneration = useCallback(
    (inputPrompt: string, baseTheme?: ThemeProfile) => {
      const trimmed = inputPrompt.trim();
      if (trimmed.length === 0) return;

      setIsGenerating(true);
      startPulse();

      // Simulate async generation with a short delay so the pulse is visible.
      setTimeout(() => {
        const theme = generateThemeFromPrompt(trimmed, baseTheme);
        const validation = validateTheme(theme);
        if (!validation.success) {
          Alert.alert('Generation failed', validation.errors.slice(0, 3).join('\n'));
          setIsGenerating(false);
          stopPulse();
          return;
        }
        const validated = validation.theme;
        setGeneratedTheme(validated);
        setHistory((prev) => [...prev, { prompt: trimmed, theme: validated }]);
        setIsGenerating(false);
        stopPulse();
      }, 900);
    },
    [startPulse, stopPulse],
  );

  const handleGenerate = useCallback(() => {
    runGeneration(prompt);
  }, [prompt, runGeneration]);

  const handleRefine = useCallback(() => {
    const trimmed = refinePrompt.trim();
    if (trimmed.length === 0 || !generatedTheme) return;
    const combined = `${prompt}. ${trimmed}`;
    runGeneration(combined, generatedTheme);
    setRefinePrompt('');
  }, [refinePrompt, generatedTheme, prompt, runGeneration]);

  const handleStartOver = useCallback(() => {
    setGeneratedTheme(null);
    setRefinePrompt('');
  }, []);

  const handleUseExample = useCallback((example: string) => {
    setPrompt(example);
    setShowExamples(false);
  }, []);

  const handleSavePress = useCallback(() => {
    if (!generatedTheme) return;
    setSaveName(deriveThemeName(prompt));
    setShowSavePrompt(true);
  }, [generatedTheme, prompt]);

  const commitSave = useCallback(() => {
    if (!generatedTheme) return;
    const trimmed = saveName.trim();
    if (trimmed.length === 0) {
      Alert.alert('Name required', 'Please enter a theme name.');
      return;
    }
    const id = `ai-${Date.now().toString(36)}`;
    const finalTheme: ThemeProfile = { ...generatedTheme, id, name: trimmed };
    const validation = validateTheme(finalTheme);
    if (!validation.success) {
      Alert.alert('Invalid Theme', validation.errors.slice(0, 3).join('\n'));
      return;
    }
    saveThemeProfile(db, {
      id,
      name: trimmed,
      json: JSON.stringify(validation.theme),
      source: 'ai-generated',
    });
    setActiveThemeId(db, id);
    setShowSavePrompt(false);
    router.back();
  }, [db, generatedTheme, router, saveName]);

  const revertToHistory = useCallback((entry: HistoryEntry) => {
    setGeneratedTheme(entry.theme);
    setPrompt(entry.prompt);
  }, []);

  const canGenerate = prompt.trim().length > 0 && !isGenerating;
  const canRefine = refinePrompt.trim().length > 0 && !isGenerating && generatedTheme !== null;

  return (
    <View style={{ flex: 1, backgroundColor: cc.background }}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: cc.surface,
            borderBottomColor: cc.border,
            paddingHorizontal: cl.spacing.md,
            paddingVertical: cl.spacing.sm,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={{ color: cc.textSecondary, fontSize: 16 }}>Back</Text>
        </Pressable>
        <Text style={{ color: cc.text, fontSize: 17, fontWeight: '700' }}>AI Theme Creator</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: cl.spacing.md,
          paddingBottom: HUB_TAB_BAR_CLEARANCE,
          gap: cl.spacing.md,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title + subtitle */}
        <View style={{ gap: 4 }}>
          <Text style={{ color: cc.text, fontSize: 28, fontWeight: '800' }}>AI Theme Creator</Text>
          <Text style={{ color: cc.textSecondary, fontSize: 15 }}>
            Describe your ideal theme in plain English
          </Text>
        </View>

        {/* Input area */}
        <View style={{ gap: 8 }}>
          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            multiline
            textAlignVertical="top"
            placeholder="Describe your ideal theme..."
            placeholderTextColor={cc.textTertiary}
            style={{
              minHeight: 96,
              backgroundColor: cc.surface,
              color: cc.text,
              borderWidth: 1,
              borderColor: cc.border,
              borderRadius: cs.cornerRadius.card,
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontSize: 15,
              lineHeight: 22,
            }}
          />
          <Pressable
            onPress={() => setShowExamples(true)}
            style={{ alignSelf: 'flex-start', paddingVertical: 4 }}
            hitSlop={8}
          >
            <Text style={{ color: cc.primary, fontSize: 14, fontWeight: '600' }}>See examples</Text>
          </Pressable>
        </View>

        {/* Generate button */}
        <Animated.View style={{ opacity: isGenerating ? pulseAnim : 1 }}>
          <Pressable
            onPress={handleGenerate}
            disabled={!canGenerate}
            style={{
              backgroundColor: canGenerate ? cc.primary : cc.surfaceElevated,
              paddingVertical: 16,
              borderRadius: cs.cornerRadius.button,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: canGenerate ? cc.background : cc.textTertiary,
                fontSize: 16,
                fontWeight: '700',
              }}
            >
              {isGenerating ? 'Designing your theme...' : 'Generate Theme'}
            </Text>
          </Pressable>
        </Animated.View>

        {/* Result area */}
        {generatedTheme && !isGenerating ? (
          <View style={{ gap: cl.spacing.md }}>
            <Text
              style={{
                color: cc.textSecondary,
                fontSize: 12,
                fontWeight: '700',
                letterSpacing: 1,
              }}
            >
              PREVIEW
            </Text>

            <ThemeProvider theme={generatedTheme}>
              <DashboardMock />
            </ThemeProvider>

            {/* Save action */}
            <Pressable
              onPress={handleSavePress}
              style={{
                backgroundColor: cc.primary,
                paddingVertical: 14,
                borderRadius: cs.cornerRadius.button,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: cc.background, fontSize: 16, fontWeight: '700' }}>
                Looks good, save it
              </Text>
            </Pressable>

            {/* Refine */}
            <View style={{ gap: 8 }}>
              <Text
                style={{
                  color: cc.textSecondary,
                  fontSize: 12,
                  fontWeight: '700',
                  letterSpacing: 1,
                }}
              >
                REFINE
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  value={refinePrompt}
                  onChangeText={setRefinePrompt}
                  placeholder="Make changes..."
                  placeholderTextColor={cc.textTertiary}
                  style={{
                    flex: 1,
                    backgroundColor: cc.surface,
                    color: cc.text,
                    borderWidth: 1,
                    borderColor: cc.border,
                    borderRadius: cs.cornerRadius.button,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    fontSize: 14,
                  }}
                />
                <Pressable
                  onPress={handleRefine}
                  disabled={!canRefine}
                  style={{
                    backgroundColor: canRefine ? cc.primaryContainer : cc.surfaceElevated,
                    paddingHorizontal: 18,
                    justifyContent: 'center',
                    borderRadius: cs.cornerRadius.button,
                  }}
                >
                  <Text
                    style={{
                      color: canRefine ? cc.text : cc.textTertiary,
                      fontWeight: '700',
                      fontSize: 14,
                    }}
                  >
                    Refine
                  </Text>
                </Pressable>
              </View>
            </View>

            <Pressable onPress={handleStartOver} style={{ alignItems: 'center', paddingVertical: 8 }}>
              <Text style={{ color: cc.textSecondary, fontSize: 14 }}>Start over</Text>
            </Pressable>
          </View>
        ) : null}

        {/* History */}
        {history.length >= 2 ? (
          <HistoryList history={history} onRevert={revertToHistory} chrome={chrome} />
        ) : null}
      </ScrollView>

      {/* Examples sheet */}
      <Modal
        visible={showExamples}
        transparent
        animationType="slide"
        onRequestClose={() => setShowExamples(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setShowExamples(false)}>
          <Pressable
            style={[
              styles.sheet,
              {
                backgroundColor: cc.surface,
                borderTopColor: cc.border,
                borderTopLeftRadius: cs.cornerRadius.card,
                borderTopRightRadius: cs.cornerRadius.card,
              },
            ]}
            onPress={() => undefined}
          >
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: cc.border,
                alignSelf: 'center',
                marginBottom: 12,
              }}
            />
            <Text style={{ color: cc.text, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
              Example prompts
            </Text>
            <View style={{ gap: 8 }}>
              {EXAMPLE_PROMPTS.map((example) => (
                <Pressable
                  key={example}
                  onPress={() => handleUseExample(example)}
                  style={{
                    padding: 14,
                    borderRadius: cs.cornerRadius.button,
                    backgroundColor: cc.surfaceElevated,
                    borderWidth: 1,
                    borderColor: cc.border,
                  }}
                >
                  <Text style={{ color: cc.text, fontSize: 14, lineHeight: 20 }}>{example}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              onPress={() => setShowExamples(false)}
              style={{ alignItems: 'center', paddingVertical: 14, marginTop: 8 }}
            >
              <Text style={{ color: cc.primary, fontSize: 15, fontWeight: '600' }}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Save naming modal */}
      <Modal
        visible={showSavePrompt}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSavePrompt(false)}
      >
        <View style={styles.namingBackdrop}>
          <View
            style={[
              styles.namingSheet,
              {
                backgroundColor: cc.surface,
                borderColor: cc.border,
                borderRadius: cs.cornerRadius.card,
              },
            ]}
          >
            <Text
              style={{ color: cc.text, fontSize: 18, fontWeight: '700', marginBottom: 12 }}
            >
              Name your theme
            </Text>
            <TextInput
              value={saveName}
              onChangeText={setSaveName}
              maxLength={30}
              autoFocus
              style={[
                styles.nameInput,
                {
                  backgroundColor: cc.surfaceElevated,
                  color: cc.text,
                  borderColor: cc.border,
                  borderRadius: cs.cornerRadius.button,
                },
              ]}
              placeholder="My AI Theme"
              placeholderTextColor={cc.textTertiary}
            />
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'flex-end',
                gap: 16,
                marginTop: 16,
              }}
            >
              <Pressable onPress={() => setShowSavePrompt(false)}>
                <Text style={{ color: cc.textSecondary, fontSize: 15 }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={commitSave}>
                <Text style={{ color: cc.primary, fontSize: 15, fontWeight: '700' }}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// --------------------------------------------------------------------------
// Dashboard mock (uses scoped theme via ThemeProvider)
// --------------------------------------------------------------------------

function DashboardMock() {
  const theme = useTheme();
  const c = theme.colors;
  const s = theme.surfaces;
  const t = theme.typeScale;
  const f = theme.fonts;

  const moduleIcons = ['📚', '💰', '🏃', '🍎', '🌱', '🧘'];

  return (
    <View
      style={{
        backgroundColor: c.background,
        borderRadius: s.cornerRadius.card,
        borderWidth: 1,
        borderColor: c.border,
        padding: 16,
        gap: 16,
        overflow: 'hidden',
      }}
    >
      {/* Greeting */}
      <View style={{ gap: 2 }}>
        <Text
          style={{
            color: c.text,
            fontSize: Math.min(22, t.heading.size),
            fontWeight: t.heading.weight,
            fontFamily: f.display,
          }}
        >
          Good morning
        </Text>
        <Text
          style={{
            color: c.textSecondary,
            fontSize: t.caption.size,
            fontFamily: f.body,
          }}
        >
          5 modules active
        </Text>
      </View>

      {/* Module icons row */}
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        {moduleIcons.map((icon, idx) => (
          <View
            key={idx}
            style={{
              width: 48,
              height: 48,
              borderRadius: s.cornerRadius.icon,
              backgroundColor: idx === 0 ? c.primary : c.surfaceElevated,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: c.border,
            }}
          >
            <Text style={{ fontSize: 22 }}>{icon}</Text>
          </View>
        ))}
      </View>

      {/* Bento cards */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View
          style={{
            flex: 2,
            backgroundColor: c.surface,
            borderRadius: s.cornerRadius.card,
            borderWidth: 1,
            borderColor: c.border,
            padding: 14,
            gap: 4,
          }}
        >
          <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>
            PROGRESS
          </Text>
          <Text
            style={{
              color: c.text,
              fontSize: 24,
              fontWeight: '700',
              fontFamily: f.display,
            }}
          >
            12 / 20
          </Text>
          <View
            style={{
              height: 6,
              backgroundColor: c.surfaceElevated,
              borderRadius: 3,
              overflow: 'hidden',
              marginTop: 4,
            }}
          >
            <View
              style={{
                width: '60%',
                height: '100%',
                backgroundColor: c.primary,
              }}
            />
          </View>
        </View>
        <View
          style={{
            flex: 1,
            backgroundColor: c.primaryContainer,
            borderRadius: s.cornerRadius.card,
            padding: 14,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: c.background, fontSize: 28, fontWeight: '800' }}>7</Text>
          <Text style={{ color: c.background, fontSize: 11 }}>streak</Text>
        </View>
      </View>

      {/* Tab bar mock */}
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: c.surfaceElevated,
          borderRadius: s.cornerRadius.tabBar,
          paddingVertical: 10,
          paddingHorizontal: 14,
          justifyContent: 'space-around',
          marginTop: 4,
        }}
      >
        {['Home', 'Discover', 'Settings'].map((label, idx) => (
          <Text
            key={label}
            style={{
              color: idx === 0 ? c.primary : c.textTertiary,
              fontSize: 12,
              fontWeight: '600',
            }}
          >
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

// --------------------------------------------------------------------------
// History list
// --------------------------------------------------------------------------

interface HistoryListProps {
  history: HistoryEntry[];
  onRevert: (entry: HistoryEntry) => void;
  chrome: ThemeProfile;
}

function HistoryList({ history, onRevert, chrome }: HistoryListProps) {
  const [expanded, setExpanded] = useState(false);
  const cc = chrome.colors;

  const entries = [...history].reverse();
  const visible = expanded ? entries : entries.slice(0, 3);

  return (
    <View style={{ gap: 8 }}>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        hitSlop={8}
      >
        <Text style={{ color: cc.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>
          ITERATION HISTORY ({history.length})
        </Text>
        <Text style={{ color: cc.primary, fontSize: 13, fontWeight: '600' }}>
          {expanded ? 'Collapse' : 'Expand'}
        </Text>
      </Pressable>
      {visible.map((entry, idx) => (
        <Pressable
          key={`${idx}-${entry.prompt}`}
          onPress={() => onRevert(entry)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            padding: 12,
            borderRadius: chrome.surfaces.cornerRadius.button,
            backgroundColor: cc.surface,
            borderWidth: 1,
            borderColor: cc.border,
          }}
        >
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <View
              style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: entry.theme.colors.background,
                borderWidth: 1,
                borderColor: cc.border,
              }}
            />
            <View
              style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: entry.theme.colors.primary,
              }}
            />
            <View
              style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: entry.theme.colors.surface,
                borderWidth: 1,
                borderColor: cc.border,
              }}
            />
          </View>
          <Text
            style={{ color: cc.text, fontSize: 13, flex: 1 }}
            numberOfLines={1}
          >
            {entry.prompt}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// --------------------------------------------------------------------------
// Styles
// --------------------------------------------------------------------------

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    padding: 20,
    borderTopWidth: 1,
    paddingBottom: 36,
  },
  namingBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  namingSheet: {
    padding: 20,
    borderWidth: 1,
  },
  nameInput: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
});
