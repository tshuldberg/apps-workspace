import { useEffect } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Check, Globe, X } from 'lucide-react-native';
import { JAKARTA_FONTS } from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useAppThemeColors as useThemeColors, useAppThemeProfile as useTheme } from '../providers/AppThemeProvider';
import { useI18n } from './I18nProvider';
import { LANGUAGE_OPTIONS, type LanguageCode } from './languages';
import { LANGUAGE_COMPLETENESS, LANGUAGE_COMPLIANCE_COMPLETENESS } from './catalogs';
import { isLocalePartiallyEnglish } from './value-completeness';

interface LanguagePickerProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  onSelect?: (language: LanguageCode) => void;
}

export function LanguagePicker({
  visible,
  title,
  onClose,
  onSelect,
}: LanguagePickerProps) {
  const tc = useThemeColors();
  const theme = useTheme();
  const { language, setLanguage, t, pendingRtlRestart, acknowledgeRtlRestart } = useI18n();

  useEffect(() => {
    if (!pendingRtlRestart) return;
    Alert.alert(
      t('Change Language'),
      t('App interface language'),
      [
        {
          text: t('Continue'),
          style: 'default',
          onPress: acknowledgeRtlRestart,
        },
      ],
      { cancelable: false },
    );
  }, [pendingRtlRestart, acknowledgeRtlRestart, t]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.modalScreen, { backgroundColor: tc.background }]}>
        <View style={styles.modalHeader}>
          <View style={styles.modalTitleRow}>
            <Globe size={18} color={tc.accent} strokeWidth={2} />
            <Text style={[styles.modalTitle, { color: tc.text }]}>{title}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={22} color={tc.text} strokeWidth={2} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.languageList} showsVerticalScrollIndicator={false}>
          {LANGUAGE_OPTIONS.map((option) => {
            const isSelected = option.code === language;
            const completeness = LANGUAGE_COMPLETENESS[option.code] ?? 0;
            const completenessPct = Math.round(completeness * 100);
            const safetyComplete = (LANGUAGE_COMPLIANCE_COMPLETENESS[option.code] ?? 0) >= 1;
            const partlyEnglish = isLocalePartiallyEnglish(option.code);
            const isPartial = partlyEnglish || completenessPct < 70 || !safetyComplete;
            return (
              <Pressable
                key={option.code}
                style={({ pressed }) => [
                  styles.languageRow,
                  { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder },
                  isSelected && { borderColor: tc.accent, backgroundColor: `${tc.accent}14` },
                  pressed && { opacity: 0.85 },
                ]}
                onPress={() => {
                  setLanguage(option.code);
                  onSelect?.(option.code);
                }}
              >
                <View style={styles.languageBody}>
                  <Text style={[styles.languageNativeName, { color: tc.text }]}>{option.nativeName}</Text>
                  <View style={styles.languageMetaRow}>
                    <Text style={[styles.languageMeta, { color: tc.textSecondary }]}>
                      {option.englishName} · {option.region}
                    </Text>
                    <View style={styles.completenessRow}>
                      {isPartial && <View style={[styles.completenessDot, { backgroundColor: '#F5C451' }]} />}
                      <Text style={[styles.completenessText, { color: isPartial ? '#F5C451' : tc.textTertiary }]}>
                        {completenessPct}%
                      </Text>
                    </View>
                  </View>
                  {partlyEnglish && safetyComplete && (
                    <Text
                      style={[styles.completenessText, { color: '#F5C451', flexShrink: 1 }]}
                      numberOfLines={1}
                    >
                      {t('Interface partly in English')}
                    </Text>
                  )}
                  {!safetyComplete && (
                    <Text
                      style={[styles.completenessText, { color: '#F5C451', flexShrink: 1 }]}
                      numberOfLines={1}
                    >
                      {t('Safety and legal notices may appear in English')}
                    </Text>
                  )}
                </View>
                {isSelected && (
                  <View style={[styles.selectedBadge, { backgroundColor: tc.accent }]}>
                    <Check size={14} color={tc.background} strokeWidth={3} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        <Pressable style={[styles.closeButton, { backgroundColor: tc.accent }]} onPress={onClose}>
          <Text style={[styles.closeButtonText, { color: tc.background }]}>{t('Continue')}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalScreen: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 20 },
  languageList: { paddingHorizontal: 20, paddingBottom: 120, gap: 10 },
  languageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  languageBody: { flex: 1, gap: 4 },
  languageNativeName: { fontFamily: JAKARTA_FONTS.bold, fontSize: 16 },
  languageMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  languageMeta: { fontFamily: JAKARTA_FONTS.medium, fontSize: 12, flex: 1 },
  completenessRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  completenessDot: { width: 6, height: 6, borderRadius: 3 },
  completenessText: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 11 },
  selectedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    position: 'absolute',
    bottom: 36,
    left: 24,
    right: 24,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  closeButtonText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 15 },
});
