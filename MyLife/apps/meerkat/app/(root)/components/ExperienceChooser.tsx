import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PRESETS, getPreset, resolveProfile, type MkPaletteMode } from '@mylife/meerkat-theme';
import { ONBOARDING_EXPERIENCES, findOnboardingExperience, type ExperienceId } from '../data/onboarding-experience-core';
import { useMkStyles } from '../providers/AppThemeProvider';
import { MK_RADIUS, type MkColors } from '../theme/tokens';

interface Props {
  stage: 'intro' | 'layout' | 'theme';
  name: string;
  experienceId: ExperienceId;
  themeId: string;
  onExperienceChange: (id: ExperienceId) => void;
  onThemeChange: (id: string) => void;
}

export function ExperienceChooser({ stage, name, experienceId, themeId, onExperienceChange, onThemeChange }: Props) {
  const styles = useMkStyles(makeStyles);
  const [mode, setMode] = useState<MkPaletteMode>('light');
  const experience = findOnboardingExperience(stage === 'intro' ? 'standard' : experienceId)!;
  const profile = getPreset(stage === 'theme' ? themeId : 'open-burrow')!;
  const colors = resolveProfile(profile, mode);
  return <View style={styles.root}>
    <Text accessibilityRole="header" style={styles.title}>{stage === 'intro' ? 'Your standard community' : stage === 'layout' ? 'How should your community feel?' : 'Choose a theme for this layout'}</Text>
    <Text style={styles.detail}>{stage === 'intro' ? 'Start with general chat and announcements. Keep this layout, or choose a different way to organize your community.' : stage === 'layout' ? 'Choose a starting point. You can edit your layout later in community settings.' : 'This theme belongs to your new community. Your personal app theme stays the same.'}</Text>
    <View accessible accessibilityLabel={`${experience.name} layout preview. ${experience.preview.join('. ')}.`} style={[styles.preview, { backgroundColor: colors.background, borderColor: colors.borderStrong }]}>
      <Text style={[styles.previewName, { color: colors.text }]}>{name.trim() || 'Your community'}</Text>
      <Text style={[styles.caption, { color: colors.text }]}>{experience.ready ? 'Layout preview' : 'Starter layout preview'}</Text>
      <View style={[styles.previewBody, experience.id === 'discussion' && styles.stack]}>
        {experience.preview.map((label, index) => <View key={label} style={[
          styles.previewPart,
          { backgroundColor: colors.surface, borderColor: colors.borderStrong },
          experience.id === 'shorts' && index === 0 && styles.vertical,
          experience.id === 'live' && index === 0 && styles.stage,
          experience.id === 'video' && index === 0 && styles.stage,
        ]}>
          <Text style={[styles.caption, { color: colors.text }]}>{label}</Text>
          <View style={[styles.line, { backgroundColor: colors.surfaceHigh }]} />
          <View style={[styles.shortLine, { backgroundColor: colors.accent }]} />
        </View>)}
      </View>
      <Text style={[styles.caption, { color: colors.text }]}>{experience.name} · {stage === 'theme' ? profile.name : 'Open Burrow'}</Text>
    </View>
    {stage !== 'intro' && <Text accessibilityLiveRegion="polite" style={styles.detail}>{experience.description}{!experience.ready && ' You can load this starter now. Unfinished features show a notice; chat stays available.'}</Text>}
    {stage === 'layout' && <View style={styles.options}>
      {ONBOARDING_EXPERIENCES.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: experienceId === item.id }} onPress={() => onExperienceChange(item.id)} style={[styles.option, experienceId === item.id && styles.selected]}>
        <Text style={styles.optionTitle}>{item.name}{experienceId === item.id ? ' ✓' : ''}</Text>
        <Text style={styles.detail}>{item.reference}</Text>
        {!item.ready && <Text style={styles.detail}>Starter · Media unfinished</Text>}
      </Pressable>)}
    </View>}
    {stage === 'theme' && <>
      <View style={styles.modeRow}>
        {(['light', 'dark'] as const).map((value) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: mode === value }} onPress={() => setMode(value)} style={[styles.mode, mode === value && styles.selected]}><Text style={styles.optionTitle}>{value === 'light' ? 'Light preview' : 'Dark preview'}</Text></Pressable>)}
      </View>
      <ScrollView style={styles.themeScroller} nestedScrollEnabled keyboardShouldPersistTaps="handled"><View style={styles.themes}>
        {PRESETS.map((theme) => {
          const palette = resolveProfile(theme, mode);
          return <Pressable key={theme.id} accessibilityRole="button" accessibilityState={{ selected: themeId === theme.id }} onPress={() => onThemeChange(theme.id)} style={[styles.option, styles.theme, themeId === theme.id && styles.selected]}>
            <View style={styles.swatches}>{[palette.background, palette.surface, palette.accent, palette.text].map((color, i) => <View key={i} style={[styles.swatch, { backgroundColor: color }]} />)}</View>
            <Text style={styles.optionTitle}>{theme.name}{themeId === theme.id ? ' ✓' : ''}</Text>
          </Pressable>;
        })}
      </View></ScrollView>
    </>}
  </View>;
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  root: { gap: 12 }, title: { fontSize: 20, lineHeight: 26, fontWeight: '800', color: c.text },
  detail: { color: c.textSecondary, fontSize: 13, lineHeight: 19 },
  preview: { borderWidth: 1, borderRadius: MK_RADIUS.md, padding: 12, gap: 8 },
  previewName: { fontSize: 16, fontWeight: '700' }, caption: { fontSize: 11, lineHeight: 16 },
  previewBody: { flexDirection: 'row', gap: 6, minHeight: 130 }, stack: { flexDirection: 'column' },
  previewPart: { flex: 1, borderWidth: 1, borderRadius: 6, padding: 8, gap: 9, justifyContent: 'center' },
  vertical: { minHeight: 190, flex: 2, justifyContent: 'flex-end' }, stage: { flex: 2 },
  line: { width: '80%', height: 5, borderRadius: 3 }, shortLine: { width: '50%', height: 3, borderRadius: 3 },
  options: { gap: 8 }, option: { minHeight: 64, borderWidth: 2, borderColor: c.border, borderRadius: MK_RADIUS.md, backgroundColor: c.surface, padding: 12, gap: 5 },
  selected: { borderColor: c.accent, backgroundColor: c.surfaceHigh }, optionTitle: { color: c.text, fontSize: 14, fontWeight: '700' },
  themeScroller: { maxHeight: 248 },
  themes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, theme: { width: '48%', flexGrow: 1 },
  swatches: { flexDirection: 'row', gap: 4 }, swatch: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: c.borderStrong },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, mode: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderWidth: 2, borderColor: c.border, borderRadius: MK_RADIUS.sm },
});
