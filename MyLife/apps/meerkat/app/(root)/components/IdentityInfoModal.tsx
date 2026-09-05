// A plain-words explainer for the Identity screen, aimed at a first-time user
// (target reading level: a 14-year-old). It never claims a name is verified, and
// it keeps the transport-honesty boundary: no fake online status, no fake
// delivery. Built from kit primitives so it follows the active Meerkat palette.

import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { Button } from './kit';
import { type MkColors, MK_RADIUS } from '../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../providers/AppThemeProvider';

interface InfoSection {
  title: string;
  body: string;
}

const SECTIONS: InfoSection[] = [
  {
    title: 'Your name',
    body:
      'This is the name people see for you. Pick anything you like. It is just a label, so it does not prove who you are by itself. Anyone could pick the same name.',
  },
  {
    title: 'Your friend code',
    body:
      'Share this code so a friend can find you. You can make your own by typing a word, and Meerkat adds random characters to the end so nobody can guess it. The code lets a friend ask to connect; it does not let them read your stuff.',
  },
  {
    title: 'Safety code',
    body:
      'This is the one part nobody can fake. If you and a friend both read your safety codes out loud and they match, you both know for sure it is really each other. Use it when you want to be 100 percent certain.',
  },
  {
    title: 'Where this lives',
    body:
      'Everything here stays on your device. There is no company server holding your account, and there is no password to forget. If you reset the app, this identity is gone, so keep your device safe.',
  },
  {
    title: 'The honest promise',
    body:
      'Meerkat never pretends. It will not show a green "online" dot it cannot back up, and it will not say a message was delivered or read unless the real proof arrived. If something has not happened yet, the app says so.',
  },
];

export function IdentityInfoModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={[styles.handleRow, { paddingTop: insets.top + 8 }]}>
            <Text style={styles.heading}>How identity works</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
            >
              <X size={20} color={c.textSecondary} strokeWidth={2} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {SECTIONS.map((section) => (
              <View key={section.title} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionBody}>{section.body}</Text>
              </View>
            ))}
            <Button title="Got it" onPress={onClose} style={styles.doneButton} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: c.background,
    borderTopLeftRadius: MK_RADIUS.lg,
    borderTopRightRadius: MK_RADIUS.lg,
    maxHeight: '88%',
  },
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  heading: {
    color: c.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  closeBtn: {
    padding: 6,
    borderRadius: MK_RADIUS.pill,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 18,
  },
  section: {
    gap: 6,
  },
  sectionTitle: {
    color: c.accent,
    fontSize: 15,
    fontWeight: '700',
  },
  sectionBody: {
    color: c.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  doneButton: {
    marginTop: 4,
  },
  pressed: {
    opacity: 0.7,
  },
});
