import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CURRENT_TERMS_VERSION } from '@mylife/mynews';
import { tokens } from '../theme/tokens';
import { PrimaryButton, SecondaryButton } from '../components/Buttons';
import { useMyNewsCloud } from './CloudProvider';
import { getMyNewsRuntimeLegalContent } from '../data/runtime-capabilities';
import { ErrorText } from '../components/ErrorText';

/**
 * Terms-acceptance gate UX. Before a user publishes or suggests, the write flow
 * calls ensureTermsAccepted(): if the signed-in user has already accepted the
 * CURRENT terms version, it resolves true immediately; otherwise it shows a
 * blocking prompt (Terms + Privacy + Community Guidelines summary + Accept), and
 * on Accept records acceptance via the port and resolves true. Declining
 * resolves false so the caller aborts the write. A version bump re-gates
 * everyone because the check is for the CURRENT version specifically; the server
 * gate in mynews-publish / mynews-suggest is the real enforcement.
 */
interface TermsGateContextValue {
  ensureTermsAccepted: () => Promise<boolean>;
}

const TermsGateContext = createContext<TermsGateContextValue>({
  ensureTermsAccepted: async () => true,
});

export function useTermsGate(): TermsGateContextValue {
  return useContext(TermsGateContext);
}

export function TermsGateProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { port } = useMyNewsCloud();
  const termsSummary = useMemo(() => getMyNewsRuntimeLegalContent().promptSummary, []);
  const [visible, setVisible] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resolverRef = useRef<((accepted: boolean) => void) | null>(null);

  const settle = useCallback((accepted: boolean) => {
    setVisible(false);
    setAccepting(false);
    setError(null);
    resolverRef.current?.(accepted);
    resolverRef.current = null;
  }, []);

  const ensureTermsAccepted = useCallback(async (): Promise<boolean> => {
    if (!port) return false;
    try {
      const accepted = await port.getAcceptedTermsVersions();
      if (accepted.includes(CURRENT_TERMS_VERSION)) return true;
    } catch {
      // Fall through to the prompt; the server gate still enforces.
    }
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setError(null);
      setVisible(true);
    });
  }, [port]);

  const onAccept = useCallback(async () => {
    if (!port) {
      settle(false);
      return;
    }
    setAccepting(true);
    setError(null);
    const result = await port.acceptTerms(CURRENT_TERMS_VERSION);
    if (result.ok) {
      settle(true);
    } else {
      setAccepting(false);
      setError('Could not record your acceptance. Check your connection and try again.');
    }
  }, [port, settle]);

  const value = useMemo(() => ({ ensureTermsAccepted }), [ensureTermsAccepted]);

  return (
    <TermsGateContext.Provider value={value}>
      {children}
      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => settle(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <ScrollView contentContainerStyle={styles.sheetContent}>
              <Text style={styles.title}>Before you publish</Text>
              <Text style={styles.body}>
                Please review and accept the MyNews Terms, Privacy Policy, and Community Guidelines.
                You only need to do this once per version.
              </Text>

              <View style={styles.summaryCard}>
                {termsSummary.map((point) => (
                  <View key={point} style={styles.bulletRow}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.bulletText}>{point}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.linkRow}>
                <Pressable
                  onPress={() => router.push('/(root)/legal/terms' as never)}
                  accessibilityRole="link"
                  accessibilityLabel="Read the terms"
                >
                  <Text style={styles.link}>Terms</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push('/(root)/legal/privacy' as never)}
                  accessibilityRole="link"
                  accessibilityLabel="Read the privacy"
                >
                  <Text style={styles.link}>Privacy</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push('/(root)/legal/guidelines' as never)}
                  accessibilityRole="link"
                  accessibilityLabel="Read the guidelines"
                >
                  <Text style={styles.link}>Guidelines</Text>
                </Pressable>
              </View>

              {error ? <ErrorText style={styles.error}>{error}</ErrorText> : null}

              <PrimaryButton
                label={accepting ? 'Recording...' : 'I agree'}
                onPress={() => void onAccept()}
                disabled={accepting}
              />
              <SecondaryButton label="Not now" onPress={() => settle(false)} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </TermsGateContext.Provider>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: tokens.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: tokens.border,
    maxHeight: '86%',
  },
  sheetContent: { padding: 22, paddingBottom: 40, gap: 12 },
  title: { color: tokens.text, fontSize: 22, fontWeight: '800' },
  body: { color: tokens.textSecondary, fontSize: 14, lineHeight: 21 },
  summaryCard: {
    backgroundColor: tokens.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 16,
    gap: 10,
  },
  bulletRow: { flexDirection: 'row', gap: 8 },
  bulletDot: { color: tokens.accent, fontSize: 15, lineHeight: 21 },
  bulletText: { color: tokens.textSecondary, fontSize: 14, lineHeight: 21, flex: 1 },
  linkRow: { flexDirection: 'row', gap: 20, paddingVertical: 4 },
  link: { color: tokens.accent, fontSize: 14, fontWeight: '700' },
  error: { color: tokens.danger, fontSize: 13, lineHeight: 19 },
});
