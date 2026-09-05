import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { getLocales } from 'expo-localization';
import { Check, FileText, Globe2, Languages, ShieldCheck } from 'lucide-react-native';
import { JAKARTA_FONTS, minimumAgeForRegion } from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useAppThemeColors as useThemeColors, useAppThemeProfile as useTheme } from '../providers/AppThemeProvider';
import { useDatabase } from '../providers/DatabaseProvider';
import { useBestChefCloud } from '../providers/BestChefCloudProvider';
import { useI18n } from './I18nProvider';
import { LANGUAGE_OPTIONS } from './languages';
import { LANGUAGE_COMPLETENESS, LANGUAGE_COMPLIANCE_COMPLETENESS } from './catalogs';
import { isLocalePartiallyEnglish } from './value-completeness';
import { CURRENT_TERMS_VERSION, recordTermsAcceptanceCloud } from '../data/cloud-terms';
import { LEGAL_URLS } from '../constants/legal';
import { BackArrow } from '../components/DirectionalIcons';

const AGE_CONFIRMED_KEY = 'age_confirmed';
const AGE_CONFIRMED_MINIMUM_KEY = 'age_confirmed_minimum';

/**
 * Minimum age for the device's storefront region (plan 33 Phase 1.7):
 * DE/IE-class markets 16, FR 15, IT/ES-class 14, floor 13.
 */
function deviceMinimumAge(): number {
  try {
    return minimumAgeForRegion(getLocales()[0]?.regionCode);
  } catch {
    return minimumAgeForRegion(null);
  }
}

function loadAgeConfirmed(db: ReturnType<typeof useDatabase>): boolean {
  try {
    const rows = db.query<{ value: string }>(
      `SELECT value FROM rc_settings WHERE key = ?`,
      [AGE_CONFIRMED_KEY],
    );
    return rows[0]?.value === 'true';
  } catch (err) {
    if (__DEV__) console.warn('[LanguageOnboardingGate] load age_confirmed', err);
    return false;
  }
}

function saveAgeConfirmed(
  db: ReturnType<typeof useDatabase>,
  value: boolean,
  minimumAge: number,
): void {
  try {
    db.execute(
      `INSERT OR REPLACE INTO rc_settings (key, value) VALUES (?, ?)`,
      [AGE_CONFIRMED_KEY, value ? 'true' : 'false'],
    );
    // Audit which threshold was shown when the user answered (per-country gate).
    db.execute(
      `INSERT OR REPLACE INTO rc_settings (key, value) VALUES (?, ?)`,
      [AGE_CONFIRMED_MINIMUM_KEY, String(minimumAge)],
    );
  } catch (err) {
    console.warn('[LanguageOnboardingGate] save age_confirmed', err);
  }
}

const TERMS_ACCEPTED_KEY = 'terms_accepted_version';

function loadTermsVersion(db: ReturnType<typeof useDatabase>): string | null {
  try {
    const rows = db.query<{ value: string }>(
      `SELECT value FROM rc_settings WHERE key = ?`,
      [TERMS_ACCEPTED_KEY],
    );
    return rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

function saveTermsVersion(db: ReturnType<typeof useDatabase>, version: string): void {
  try {
    db.execute(
      `INSERT OR REPLACE INTO rc_settings (key, value) VALUES (?, ?)`,
      [TERMS_ACCEPTED_KEY, version],
    );
  } catch (err) {
    console.warn('[LanguageOnboardingGate] save terms_accepted_version', err);
  }
}

function openTermsUrl(url: string): void {
  void Linking.openURL(url).catch(() => {
    // The in-app acceptance is the binding gate; an unopened link is non-fatal.
  });
}

export function LanguageOnboardingGate({ children }: { children: React.ReactNode }) {
  const tc = useThemeColors();
  const theme = useTheme();
  const db = useDatabase();
  const cloud = useBestChefCloud();
  const {
    ready,
    language,
    languageOption,
    deviceLanguage,
    setLanguage,
    completeLanguageOnboarding,
    isLanguageOnboardingComplete,
    t,
  } = useI18n();
  const [showFullList, setShowFullList] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState<boolean | null>(null);
  const [termsVersion, setTermsVersion] = useState<string | null | undefined>(undefined);
  const [ageStepActive, setAgeStepActive] = useState(false);
  const [ageDenied, setAgeDenied] = useState(false);
  const [minimumAge] = useState(deviceMinimumAge);

  useEffect(() => {
    if (!ready) return;
    setAgeConfirmed(loadAgeConfirmed(db));
    setTermsVersion(loadTermsVersion(db));
  }, [ready, db]);

  if (!ready || ageConfirmed === null || termsVersion === undefined) {
    return (
      <View style={[styles.center, { backgroundColor: tc.background }]}>
        <ActivityIndicator size="large" color={tc.accent} />
      </View>
    );
  }

  const termsAccepted = termsVersion === CURRENT_TERMS_VERSION;

  const acceptTerms = () => {
    saveTermsVersion(db, CURRENT_TERMS_VERSION);
    setTermsVersion(CURRENT_TERMS_VERSION);
    if (cloud.supabase && cloud.profile?.id) {
      void recordTermsAcceptanceCloud(cloud.supabase, cloud.profile.id, CURRENT_TERMS_VERSION);
    }
  };

  if (isLanguageOnboardingComplete && ageConfirmed && termsAccepted) {
    return <>{children}</>;
  }

  if (ageDenied) {
    return (
      <View style={[styles.screen, { backgroundColor: tc.background }]}>
        <View style={styles.heroContent}>
          <View style={[styles.heroIcon, { backgroundColor: `${tc.accent}1A` }]}>
            <ShieldCheck size={36} color={tc.accent} strokeWidth={1.8} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={[styles.title, { color: tc.text }]}>
              {t('You must be {age}+ to use BestChef.', { age: String(minimumAge) })}
            </Text>
            <Text style={[styles.subtitle, { color: tc.textSecondary }]}>
              {t('BestChef contains user-generated content and requires age verification.')}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (ageStepActive || (isLanguageOnboardingComplete && !ageConfirmed)) {
    return (
      <View style={[styles.screen, { backgroundColor: tc.background }]}>
        <View style={styles.heroContent}>
          <View style={[styles.heroIcon, { backgroundColor: `${tc.accent}1A` }]}>
            <ShieldCheck size={36} color={tc.accent} strokeWidth={1.8} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={[styles.eyebrow, { color: tc.accent }]}>BESTCHEF</Text>
            <Text style={[styles.title, { color: tc.text }]}>
              {t('Age verification')}
            </Text>
            <Text style={[styles.subtitle, { color: tc.textSecondary }]}>
              {t('This app contains user-generated content. Are you {age} or older?', { age: String(minimumAge) })}
            </Text>
          </View>
        </View>
        <View style={[styles.footer, { backgroundColor: tc.background, borderTopColor: theme.glass.cardBorder }]}>
          <Pressable
            style={[styles.continueButton, { backgroundColor: tc.accent }]}
            onPress={() => {
              saveAgeConfirmed(db, true, minimumAge);
              setAgeConfirmed(true);
              setAgeStepActive(false);
              if (!isLanguageOnboardingComplete) {
                completeLanguageOnboarding();
              }
            }}
          >
            <Text style={[styles.continueButtonText, { color: tc.background }]}>
              {t('Yes, I am {age} or older', { age: String(minimumAge) })}
            </Text>
          </Pressable>
          <Pressable
            style={styles.secondaryAction}
            onPress={() => {
              saveAgeConfirmed(db, false, minimumAge);
              setAgeDenied(true);
            }}
          >
            <Text style={[styles.secondaryActionText, { color: tc.textSecondary }]}>
              {t('No')}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (isLanguageOnboardingComplete && ageConfirmed && !termsAccepted) {
    return (
      <View style={[styles.screen, { backgroundColor: tc.background }]}>
        <View style={styles.heroContent}>
          <View style={[styles.heroIcon, { backgroundColor: `${tc.accent}1A` }]}>
            <FileText size={36} color={tc.accent} strokeWidth={1.8} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={[styles.eyebrow, { color: tc.accent }]}>BESTCHEF</Text>
            <Text style={[styles.title, { color: tc.text }]}>{t('Community rules')}</Text>
            <Text style={[styles.subtitle, { color: tc.textSecondary }]}>
              {t('BestChef has zero tolerance for objectionable content and abusive behavior. Posts that break this are removed and accounts can be banned.')}
            </Text>
            <View style={styles.termsLinks}>
              <Pressable onPress={() => openTermsUrl(LEGAL_URLS.terms)} hitSlop={8}>
                <Text style={[styles.termsLink, { color: tc.accent }]}>{t('Terms of Service')}</Text>
              </Pressable>
              <Pressable onPress={() => openTermsUrl(LEGAL_URLS.guidelines)} hitSlop={8}>
                <Text style={[styles.termsLink, { color: tc.accent }]}>{t('Community Guidelines')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
        <View style={[styles.footer, { backgroundColor: tc.background, borderTopColor: theme.glass.cardBorder }]}>
          <Text style={[styles.footerLanguage, { color: tc.textTertiary }]}>
            {t('By continuing you agree to the Terms and the zero-tolerance policy.')}
          </Text>
          <Pressable
            style={[styles.continueButton, { backgroundColor: tc.accent }]}
            onPress={acceptTerms}
          >
            <Text style={[styles.continueButtonText, { color: tc.background }]}>{t('I agree')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const detectedOption = LANGUAGE_OPTIONS.find((option) => option.code === deviceLanguage)
    ?? LANGUAGE_OPTIONS[0];

  if (!showFullList) {
    return (
      <View style={[styles.screen, { backgroundColor: tc.background }]}>
        <View style={styles.heroContent}>
          <View style={[styles.heroIcon, { backgroundColor: `${tc.accent}1A` }]}>
            <Languages size={36} color={tc.accent} strokeWidth={1.8} />
          </View>

          <View style={styles.heroCopy}>
            <Text style={[styles.eyebrow, { color: tc.accent }]}>BESTCHEF</Text>
            <Text style={[styles.title, { color: tc.text }]}>{t('Choose your language')}</Text>
            <Text style={[styles.subtitle, { color: tc.textSecondary }]}>
              {t('Recipe content stays native. Interface copy uses your selected language.')}
            </Text>
          </View>

          <View style={[styles.detectedCard, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
            <Globe2 size={18} color={tc.accent} strokeWidth={2} />
            <View style={styles.detectedBody}>
              <Text style={[styles.detectedLabel, { color: tc.textSecondary }]}>
                {t('Detected from your device')}
              </Text>
              <Text style={[styles.detectedValue, { color: tc.text }]}>
                {detectedOption.nativeName}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.footer, { backgroundColor: tc.background, borderTopColor: theme.glass.cardBorder }]}>
          <Pressable
            style={[styles.continueButton, { backgroundColor: tc.accent }]}
            onPress={() => {
              setLanguage(deviceLanguage);
              setAgeStepActive(true);
            }}
          >
            <Text style={[styles.continueButtonText, { color: tc.background }]}>
              {t('Continue')}
            </Text>
          </Pressable>
          <Pressable style={styles.secondaryAction} onPress={() => setShowFullList(true)}>
            <Text style={[styles.secondaryActionText, { color: tc.textSecondary }]}>
              {t('Change Language')}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: tc.background }]}>
      <View style={styles.listHeader}>
        <Pressable onPress={() => setShowFullList(false)} hitSlop={12} style={styles.backButton}>
          <BackArrow size={20} color={tc.text} strokeWidth={2} />
        </Pressable>
        <Text style={[styles.listHeaderTitle, { color: tc.text }]}>
          {t('Choose your language')}
        </Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.languageList} showsVerticalScrollIndicator={false}>
        {LANGUAGE_OPTIONS.map((option) => {
          const isSelected = option.code === language;
          const completeness = LANGUAGE_COMPLETENESS[option.code] ?? 0;
          const completenessPct = Math.round(completeness * 100);
          const safetyComplete = (LANGUAGE_COMPLIANCE_COMPLETENESS[option.code] ?? 0) >= 1;
          // "Partly in English" is driven by the checked-in value-completeness
          // manifest (non-allowlisted identical-to-EN values above threshold),
          // not just the coarse value-differs percentage.
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
              onPress={() => setLanguage(option.code)}
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

      <View style={[styles.footer, { backgroundColor: tc.background, borderTopColor: theme.glass.cardBorder }]}>
        <Text style={[styles.footerLanguage, { color: tc.textSecondary }]}>
          {t('App interface language')}: {languageOption.nativeName}
        </Text>
        <Pressable
          style={[styles.continueButton, { backgroundColor: tc.accent }]}
          onPress={() => setAgeStepActive(true)}
        >
          <Text style={[styles.continueButtonText, { color: tc.background }]}>{t('Start Cooking')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroContent: { flex: 1, paddingHorizontal: 24, paddingTop: 96, gap: 28 },
  heroIcon: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: { gap: 12 },
  eyebrow: { fontFamily: JAKARTA_FONTS.bold, fontSize: 11, letterSpacing: 2 },
  title: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 34, lineHeight: 41, letterSpacing: -1 },
  subtitle: { fontFamily: JAKARTA_FONTS.medium, fontSize: 15, lineHeight: 23 },
  detectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  detectedBody: { flex: 1, gap: 2 },
  detectedLabel: { fontFamily: JAKARTA_FONTS.medium, fontSize: 12 },
  detectedValue: { fontFamily: JAKARTA_FONTS.bold, fontSize: 17 },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 16,
  },
  backButton: { width: 32, alignItems: 'flex-start', justifyContent: 'center' },
  listHeaderTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 20, flex: 1, textAlign: 'center' },
  languageList: { paddingHorizontal: 20, paddingBottom: 160, gap: 10 },
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
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 36,
    borderTopWidth: 1,
    gap: 12,
  },
  footerLanguage: { fontFamily: JAKARTA_FONTS.medium, fontSize: 12, textAlign: 'center' },
  continueButton: {
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueButtonText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 15 },
  secondaryAction: { alignItems: 'center', paddingVertical: 8 },
  secondaryActionText: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 13 },
  termsLinks: { flexDirection: 'row', gap: 20, marginTop: 4 },
  termsLink: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 14, textDecorationLine: 'underline' },
});
