// AgeGate.tsx: the neutral first-launch minimum-age gate (legal readiness
// 2026-07-18). Renders BEFORE onboarding; the root layout mounts OnboardingGate
// only after this gate has passed, so the two modals never co-present (M1).
//
// Neutrality: the entry screen asks for a birth date without revealing the
// passing threshold. A real underage answer locks the app durably (honest
// lock screen, no immediate retry); entry errors are correctable in place.
// The birth date itself is never persisted.

import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarDays, ShieldAlert } from 'lucide-react-native';
import { useMeerkatDatabase } from '../providers/DatabaseProvider';
import {
  configuredMinimumAge,
  isAgeGateLocked,
  isAgeGatePassed,
  submitAgeGateBirthDate,
} from '../data/age-gate';
import { Button } from './kit';
import { type MkColors, MK_RADIUS } from '../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../providers/AppThemeProvider';

const ENTRY_ERROR_COPY: Record<'invalid_date' | 'in_future' | 'implausible', string> = {
  invalid_date: 'That date does not exist. Check the month and day.',
  in_future: 'That date is in the future. Enter your real birth date.',
  implausible: 'That date is not plausible. Check the year.',
};

export function AgeGate() {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const db = useMeerkatDatabase();

  const [passed, setPassed] = useState(() => isAgeGatePassed(db));
  const [locked, setLocked] = useState(() => isAgeGateLocked(db));
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [year, setYear] = useState('');
  const [error, setError] = useState<string | null>(null);
  const dayRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);

  useEffect(() => {
    setPassed(isAgeGatePassed(db));
    setLocked(isAgeGateLocked(db));
  }, [db]);

  if (passed) return null;

  const submit = () => {
    const birth = {
      year: Number.parseInt(year, 10),
      month: Number.parseInt(month, 10),
      day: Number.parseInt(day, 10),
    };
    const result = submitAgeGateBirthDate(db, birth);
    if (result.ok) {
      setPassed(true);
      return;
    }
    if (result.reason === 'underage') {
      setLocked(true);
      return;
    }
    setError(ENTRY_ERROR_COPY[result.reason]);
  };

  const complete = month.length > 0 && day.length > 0 && year.length === 4;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => undefined} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.scrim} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.sheet}>
            {locked ? (
              <>
                <View style={styles.header}>
                  <View style={styles.mark}><ShieldAlert size={24} color={c.danger} strokeWidth={1.9} /></View>
                  <View style={styles.headerText}>
                    <Text style={styles.title}>Meerkat is not available for you yet</Text>
                    <Text style={styles.subtitle}>
                      You do not meet the minimum age requirement ({configuredMinimumAge()}+) to use
                      Meerkat. This device stays locked; your birth date was not saved.
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <>
                <View style={styles.header}>
                  <View style={styles.mark}><CalendarDays size={24} color={c.accent} strokeWidth={1.9} /></View>
                  <View style={styles.headerText}>
                    <Text style={styles.title}>When were you born?</Text>
                    <Text style={styles.subtitle}>
                      We ask once to confirm you can use Meerkat. Your birth date is checked on this
                      device and never stored or sent anywhere.
                    </Text>
                  </View>
                </View>
                <View style={styles.panel}>
                  <View style={styles.dateRow}>
                    <View style={styles.dateField}>
                      <Text style={styles.fieldLabel}>Month</Text>
                      <TextInput
                        style={styles.input}
                        value={month}
                        onChangeText={(v) => {
                          setError(null);
                          const next = v.replace(/[^0-9]/g, '').slice(0, 2);
                          setMonth(next);
                          if (next.length === 2) dayRef.current?.focus();
                        }}
                        placeholder="MM"
                        placeholderTextColor={c.textTertiary}
                        keyboardType="number-pad"
                        returnKeyType="next"
                        accessibilityLabel="Birth month"
                        onSubmitEditing={() => dayRef.current?.focus()}
                      />
                    </View>
                    <View style={styles.dateField}>
                      <Text style={styles.fieldLabel}>Day</Text>
                      <TextInput
                        ref={dayRef}
                        style={styles.input}
                        value={day}
                        onChangeText={(v) => {
                          setError(null);
                          const next = v.replace(/[^0-9]/g, '').slice(0, 2);
                          setDay(next);
                          if (next.length === 2) yearRef.current?.focus();
                        }}
                        placeholder="DD"
                        placeholderTextColor={c.textTertiary}
                        keyboardType="number-pad"
                        returnKeyType="next"
                        accessibilityLabel="Birth day"
                        onSubmitEditing={() => yearRef.current?.focus()}
                      />
                    </View>
                    <View style={[styles.dateField, styles.yearField]}>
                      <Text style={styles.fieldLabel}>Year</Text>
                      <TextInput
                        ref={yearRef}
                        style={styles.input}
                        value={year}
                        onChangeText={(v) => {
                          setError(null);
                          const next = v.replace(/[^0-9]/g, '').slice(0, 4);
                          setYear(next);
                          if (next.length === 4) yearRef.current?.blur();
                        }}
                        placeholder="YYYY"
                        placeholderTextColor={c.textTertiary}
                        keyboardType="number-pad"
                        returnKeyType="done"
                        accessibilityLabel="Birth year"
                        onSubmitEditing={submit}
                      />
                    </View>
                  </View>
                  {error ? <Text style={styles.errorText}>{error}</Text> : null}
                  <Button title="Continue" onPress={submit} disabled={!complete} />
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.34)' },
  scrollContent: { minHeight: '100%', justifyContent: 'center', paddingHorizontal: 16 },
  sheet: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 18,
    gap: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  header: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  mark: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceHigh },
  headerText: { flex: 1, minWidth: 0, gap: 4 },
  title: { color: c.text, fontSize: 24, lineHeight: 29, fontWeight: '800' },
  subtitle: { color: c.textSecondary, fontSize: 13.5, lineHeight: 20 },
  panel: {
    backgroundColor: c.surfaceElevated,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    padding: 14,
    gap: 10,
  },
  dateRow: { flexDirection: 'row', gap: 10 },
  dateField: { flex: 1, gap: 6 },
  yearField: { flex: 1.5 },
  fieldLabel: { color: c.textSecondary, fontSize: 12, fontWeight: '700' },
  input: {
    minHeight: 44,
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    color: c.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    textAlign: 'center',
  },
  errorText: { color: c.danger, fontSize: 13, lineHeight: 18 },
});
