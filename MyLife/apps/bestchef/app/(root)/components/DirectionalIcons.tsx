/**
 * RTL-aware directional icons (plan 33 Phase 3.6).
 *
 * React Native flips flex layout automatically under I18nManager RTL, but
 * SVG icons keep their drawn direction: a back arrow keeps pointing left,
 * which is FORWARD in Arabic and Hebrew. Every semantically directional
 * icon (back, forward, disclosure) must render through these wrappers,
 * which mirror horizontally when the app runs RTL.
 *
 * `scripts/check-rtl-icons.mjs` (in the check:parity chain) blocks raw
 * lucide Arrow/Chevron Left/Right usage outside this file.
 *
 * I18nManager.isRTL is fixed at app start (the language switcher already
 * prompts for the required restart), so a static style is correct.
 */

import { I18nManager, StyleSheet, View } from 'react-native';
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  type LucideProps,
} from 'lucide-react-native';

const styles = StyleSheet.create({
  mirrored: { transform: [{ scaleX: -1 }] },
});

const mirror = I18nManager.isRTL ? styles.mirrored : undefined;

/** Points to "back" (left in LTR, right in RTL). */
export function BackArrow(props: LucideProps) {
  return (
    <View style={mirror}>
      <ArrowLeft {...props} />
    </View>
  );
}

/** Points to "forward" (right in LTR, left in RTL). */
export function ForwardArrow(props: LucideProps) {
  return (
    <View style={mirror}>
      <ArrowRight {...props} />
    </View>
  );
}

/** Chevron pointing "back". */
export function BackChevron(props: LucideProps) {
  return (
    <View style={mirror}>
      <ChevronLeft {...props} />
    </View>
  );
}

/** Chevron pointing "forward" (disclosure indicators). */
export function ForwardChevron(props: LucideProps) {
  return (
    <View style={mirror}>
      <ChevronRight {...props} />
    </View>
  );
}
