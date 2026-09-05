import React, { useMemo, useState } from 'react';
import { CalendarDays, ShieldCheck } from 'lucide-react-native';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  evaluateYearnAgeGate,
  getYearnAdultBirthdateCutoff,
  type YearnAgeGateResult,
} from '../lib/ageGate';
import {
  YEARN_GUIDELINES_URL,
  YEARN_PRIVACY_URL,
  YEARN_TERMS_URL,
} from '../lib/legalLinks';
import {
  yearnColors,
  yearnRadius,
  yearnSpacing,
  yearnTypography,
} from '../theme/yearnTheme';

interface AgeGatePanelProps {
  onAccepted: (birthdate: string) => void;
  now?: () => Date;
}

export function AgeGatePanel({ onAccepted, now = () => new Date() }: AgeGatePanelProps) {
  const [birthdate, setBirthdate] = useState('');
  const [result, setResult] = useState<YearnAgeGateResult | null>(null);
  const cutoff = useMemo(() => getYearnAdultBirthdateCutoff(now()), [now]);

  const handleContinue = () => {
    const nextResult = evaluateYearnAgeGate(birthdate, now());
    setResult(nextResult);
    if (nextResult.status === 'accepted' && nextResult.birthdate) {
      onAccepted(nextResult.birthdate);
    }
  };

  const isAccepted = result?.status === 'accepted';

  return (
    <View style={styles.panel}>
      <View style={styles.iconWrap}>
        <ShieldCheck size={28} color={yearnColors.sage} strokeWidth={2.3} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.kicker}>Adults only</Text>
        <Text style={styles.title}>Confirm you are 18+</Text>
      </View>

      <View style={styles.inputWrap}>
        <CalendarDays size={18} color={yearnColors.gold} strokeWidth={2.2} />
        <TextInput
          accessibilityLabel="Birthdate"
          autoCapitalize="none"
          autoCorrect={false}
          inputMode="numeric"
          onChangeText={setBirthdate}
          placeholder={cutoff}
          placeholderTextColor={yearnColors.textTertiary}
          style={styles.input}
          value={birthdate}
        />
      </View>

      {result?.message ? (
        <Text style={styles.error}>{result.message}</Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Continue after age confirmation"
        onPress={handleContinue}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          isAccepted && styles.buttonAccepted,
        ]}
      >
        <Text style={styles.buttonText}>{isAccepted ? 'Confirmed' : 'Continue'}</Text>
      </Pressable>

      <Text style={styles.consent}>
        By continuing you confirm you are 18+ and agree to our{' '}
        <Text
          style={styles.consentLink}
          accessibilityRole="link"
          onPress={() => { void Linking.openURL(YEARN_TERMS_URL).catch(() => {}); }}
        >
          Terms
        </Text>
        ,{' '}
        <Text
          style={styles.consentLink}
          accessibilityRole="link"
          onPress={() => { void Linking.openURL(YEARN_PRIVACY_URL).catch(() => {}); }}
        >
          Privacy Policy
        </Text>
        , and{' '}
        <Text
          style={styles.consentLink}
          accessibilityRole="link"
          onPress={() => { void Linking.openURL(YEARN_GUIDELINES_URL).catch(() => {}); }}
        >
          Community Guidelines
        </Text>
        , including our zero-tolerance policy for objectionable content and abusive behavior.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    alignItems: 'stretch',
    backgroundColor: yearnColors.surface,
    borderColor: yearnColors.line,
    borderRadius: yearnRadius.md,
    borderWidth: 1,
    gap: yearnSpacing.lg,
    padding: yearnSpacing.xl,
  },
  iconWrap: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(168, 184, 155, 0.12)',
    borderColor: 'rgba(168, 184, 155, 0.28)',
    borderRadius: yearnRadius.md,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  copy: {
    gap: 3,
  },
  kicker: {
    color: yearnColors.gold,
    ...yearnTypography.label,
    textTransform: 'uppercase',
  },
  title: {
    color: yearnColors.vellum,
    ...yearnTypography.title,
  },
  inputWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(245, 230, 216, 0.08)',
    borderColor: yearnColors.line,
    borderRadius: yearnRadius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: yearnSpacing.sm,
    minHeight: 50,
    paddingHorizontal: 12,
  },
  input: {
    color: yearnColors.vellum,
    flex: 1,
    fontSize: 16,
    minHeight: 48,
  },
  error: {
    color: yearnColors.alarm,
    fontSize: 13,
    lineHeight: 18,
  },
  button: {
    alignItems: 'center',
    backgroundColor: yearnColors.coral,
    borderRadius: yearnRadius.sm,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 18,
  },
  buttonPressed: {
    backgroundColor: yearnColors.coralPressed,
  },
  buttonAccepted: {
    backgroundColor: yearnColors.success,
  },
  buttonText: {
    color: yearnColors.inkwine,
    fontSize: 15,
    fontWeight: '800',
  },
  consent: {
    color: yearnColors.textTertiary,
    ...yearnTypography.label,
    lineHeight: 17,
  },
  consentLink: {
    color: yearnColors.gold,
    textDecorationLine: 'underline',
  },
});
