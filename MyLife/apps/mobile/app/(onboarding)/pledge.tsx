import { useCallback, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Text, colors, spacing } from '@mylife/ui';

const PLEDGE_ITEMS: readonly { n: number; title: string; body: string }[] = [
  { n: 1, title: 'No ads, ever.', body: 'Not now, not later. Your attention is not for sale.' },
  { n: 2, title: 'No data sale, ever.', body: 'We will never sell, rent, or share your personal data.' },
  { n: 3, title: 'Free features stay free.', body: 'What ships free today stays free tomorrow.' },
  { n: 4, title: 'Export everything, anytime.', body: 'One tap to export a complete copy of every module.' },
  { n: 5, title: 'Delete everything, anytime.', body: 'Wipe your data from the device whenever you want. No recovery loopholes.' },
  { n: 6, title: 'Content filters are your choice.', body: 'Default is off. You decide what to hide in forums, market, and social surfaces.' },
  { n: 7, title: 'The exit door is always open.', body: 'Disable a module and keep its data. Leave entirely and take it with you.' },
];

const FULL_PLEDGE_BODY =
  'MyLife is built on a single promise: your life stays yours.\n\n' +
  'The seven commitments above are the product contract. They apply to every module, every update, and every version. Breaking one is a breach of trust and we treat it that way.\n\n' +
  'MyLife is privacy-first by architecture, not by policy: all local modules run offline on your device by default. Cloud modules are explicit opt-ins, per module, and their data paths are documented. No analytics, no telemetry, no behavioral tracking of any kind.\n\n' +
  'You can export or delete everything at any time from Settings. Disabling a module preserves its data so you can re-enable it later; deleting a module removes it permanently.\n\n' +
  'Tap "I accept" to continue.';

export default function PledgeScreen() {
  const router = useRouter();
  const [showFull, setShowFull] = useState(false);

  const handleAccept = useCallback(() => {
    router.replace('/(onboarding)/goal');
  }, [router]);

  return (
    <View style={s.root}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.hero}>
          <Text style={s.heroEmoji}>{'\u{1F91D}'}</Text>
          <Text style={s.heroTitle}>Our pledge to you</Text>
          <Text style={s.heroSubtitle}>
            Seven commitments that define how MyLife treats you and your data.
          </Text>
        </View>

        <View style={s.pledgeList}>
          {PLEDGE_ITEMS.map((item) => (
            <View key={item.n} style={s.pledgeRow}>
              <View style={s.pledgeNumber}>
                <Text style={s.pledgeNumberText}>{item.n}</Text>
              </View>
              <View style={s.pledgeTextBlock}>
                <Text style={s.pledgeTitle}>{item.title}</Text>
                <Text style={s.pledgeBody}>{item.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={s.buttons}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="I accept"
            style={({ pressed }) => [s.primaryBtn, pressed && s.btnPressed]}
            onPress={handleAccept}
          >
            <Text style={s.primaryBtnText}>I accept</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Read full pledge"
            style={({ pressed }) => [s.secondaryBtn, pressed && s.btnPressed]}
            onPress={() => setShowFull(true)}
          >
            <Text style={s.secondaryBtnText}>Read full pledge</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        visible={showFull}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowFull(false)}
      >
        <View style={s.modalRoot}>
          <ScrollView
            style={s.modalScroll}
            contentContainerStyle={s.modalContent}
          >
            <Text style={s.modalTitle}>Full pledge</Text>
            <Text style={s.modalBody}>{FULL_PLEDGE_BODY}</Text>
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={({ pressed }) => [
              s.primaryBtn,
              s.modalClose,
              pressed && s.btnPressed,
            ]}
            onPress={() => setShowFull(false)}
          >
            <Text style={s.primaryBtnText}>Close</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: 72,
    paddingBottom: 48,
    flexGrow: 1,
    justifyContent: 'center',
  },
  hero: { alignItems: 'center', marginBottom: spacing.xl },
  heroEmoji: { fontSize: 52, marginBottom: spacing.md },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  heroSubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.md,
  },
  pledgeList: { gap: spacing.md, marginBottom: spacing.xl },
  pledgeRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  pledgeNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.glassStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  pledgeNumberText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  pledgeTextBlock: { flex: 1 },
  pledgeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  pledgeBody: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  buttons: { gap: 12 },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
  secondaryBtn: {
    backgroundColor: colors.glassStrong,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '500',
  },
  btnPressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  modalRoot: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    paddingTop: 72,
  },
  modalScroll: { flex: 1 },
  modalContent: { paddingBottom: spacing.xl },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  modalBody: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 23,
  },
  modalClose: { marginTop: spacing.md },
});
