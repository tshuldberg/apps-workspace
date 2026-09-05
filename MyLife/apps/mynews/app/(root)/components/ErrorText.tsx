import { useEffect } from 'react';
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { flattenText } from '../lib/announce';
import { tokens } from '../theme/tokens';

/**
 * An error message that a screen reader actually reports (plan 48 WP10).
 *
 * Every error in this app used to render as a plain `<Text>`. Sighted users see
 * it appear; a VoiceOver or TalkBack user submitting a form heard nothing at all,
 * so a failed publish, a rejected suggestion, or a declined payment simply looked
 * like nothing had happened. Retrying a submission you cannot tell failed is the
 * worst version of that bug.
 *
 * The two platforms need different mechanisms, which is the reason this is one
 * component rather than two props copied across forty call sites:
 *
 *  - Android: `accessibilityLiveRegion="assertive"` makes TalkBack read the node
 *    when it appears or changes.
 *  - iOS: VoiceOver does NOT announce on its own. `accessibilityRole="alert"`
 *    sets the right trait but stays silent, so the announcement is explicit.
 *    It is iOS-only so Android never hears the same message twice.
 *
 * `style` is passed through and defaults are merged underneath it, so each
 * screen's existing error styling renders exactly as before.
 */
export function ErrorText({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  const message = flattenText(children);

  useEffect(() => {
    if (!message) return;
    if (Platform.OS !== 'ios') return;
    AccessibilityInfo.announceForAccessibility(message);
  }, [message]);

  return (
    <Text
      style={[styles.error, style]}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  error: {
    color: tokens.danger,
    fontSize: 13,
    lineHeight: 19,
  },
});
