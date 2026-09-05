// Shared layout primitives for the DoWork coaching-loop screens.
//
// Non-tab screens (clients, my-trainer, form-check, client-invite) use these so
// the trainer-client surfaces stay visually consistent with the rest of the
// app: iron-orange accent, matte surfaces, honest empty/error states, and a
// back affordance on every pushed screen.

import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { WK_FONTS } from '@mylife/workouts';
import { DW_ACCENT, DW_BORDER, DW_ON_ACCENT, DW_SURFACES, DW_TEXT } from '../../theme/tokens';

export function CoachingScreen({
  children,
  refreshControl,
  keyboardAvoiding = false,
}: {
  children: React.ReactNode;
  refreshControl?: React.ComponentProps<typeof ScrollView>['refreshControl'];
  // Opt-in for screens with a bottom composer (form-check). Lifts the scroll
  // area above the keyboard so a focused input at the bottom stays visible.
  keyboardAvoiding?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const scroll = (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40 },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  );
  if (!keyboardAvoiding) return scroll;
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={24}
    >
      {scroll}
    </KeyboardAvoidingView>
  );
}

export function CoachingHeader({
  title,
  subtitle,
  trailing,
}: {
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <View style={styles.header}>
      <Pressable
        style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.8 }]}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/(root)/(tabs)'))}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <ChevronLeft size={22} color={DW_TEXT.primary} />
      </Pressable>
      <View style={styles.headerText}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? <View>{trailing}</View> : null}
    </View>
  );
}

export function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewProps['style'] }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export type BadgeTone = 'pending' | 'reviewed' | 'active' | 'invited' | 'ended';

const BADGE_STYLES: Record<BadgeTone, { bg: string; fg: string; label: string }> = {
  pending: { bg: 'rgba(255, 184, 119, 0.16)', fg: '#FFB877', label: 'Awaiting review' },
  reviewed: { bg: 'rgba(48, 209, 88, 0.16)', fg: '#30D158', label: 'Reviewed' },
  active: { bg: 'rgba(48, 209, 88, 0.16)', fg: '#30D158', label: 'Active' },
  invited: { bg: 'rgba(255, 184, 119, 0.16)', fg: '#FFB877', label: 'Invited' },
  ended: { bg: 'rgba(245, 244, 248, 0.10)', fg: DW_TEXT.tertiary, label: 'Ended' },
};

export function StatusBadge({ tone, label }: { tone: BadgeTone; label?: string }) {
  const cfg = BADGE_STYLES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.badgeText, { color: cfg.fg }]}>{label ?? cfg.label}</Text>
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  busy,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.primaryButton,
        pressed && { opacity: 0.86 },
        (disabled || busy) && { opacity: 0.5 },
      ]}
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {busy ? (
        <ActivityIndicator color={DW_ON_ACCENT} />
      ) : (
        <Text style={styles.primaryButtonText}>{label}</Text>
      )}
    </Pressable>
  );
}

export function GhostButton({
  label,
  onPress,
  tone = 'default',
}: {
  label: string;
  onPress: () => void;
  tone?: 'default' | 'danger';
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.ghostButton,
        tone === 'danger' && styles.ghostDanger,
        pressed && { opacity: 0.8 },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[styles.ghostButtonText, tone === 'danger' && { color: '#FF6B6B' }]}>{label}</Text>
    </Pressable>
  );
}

export function EmptyState({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {cta ? (
        <View style={styles.emptyCta}>
          <PrimaryButton label={cta.label} onPress={cta.onPress} />
        </View>
      ) : null}
    </View>
  );
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={DW_ACCENT} />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.errorBlock}>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? <GhostButton label="Retry" onPress={onRetry} /> : null}
    </View>
  );
}

// Seconds -> m:ss for anchoring feedback to a moment in the video.
export function formatClock(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: DW_SURFACES.base,
  },
  content: {
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DW_SURFACES.low,
    borderWidth: 1,
    borderColor: DW_BORDER.subtle,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    fontFamily: WK_FONTS.extraBold,
    fontSize: 24,
    color: DW_TEXT.primary,
    letterSpacing: -0.6,
  },
  headerSubtitle: {
    fontFamily: WK_FONTS.medium,
    fontSize: 13,
    color: DW_TEXT.secondary,
  },
  sectionLabel: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 12,
    color: DW_TEXT.secondary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    paddingTop: 6,
  },
  card: {
    marginHorizontal: 16,
    backgroundColor: DW_SURFACES.low,
    borderColor: DW_BORDER.subtle,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontFamily: WK_FONTS.bold,
    fontSize: 11,
    letterSpacing: 0.3,
  },
  primaryButton: {
    backgroundColor: DW_ACCENT,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: DW_ON_ACCENT,
    fontFamily: WK_FONTS.bold,
    fontSize: 15,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  ghostButton: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: DW_BORDER.default,
    backgroundColor: DW_SURFACES.mid,
  },
  ghostDanger: {
    borderColor: 'rgba(255, 107, 107, 0.4)',
    backgroundColor: 'rgba(255, 107, 107, 0.08)',
  },
  ghostButtonText: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 13,
    color: DW_TEXT.primary,
    letterSpacing: 0.3,
  },
  emptyState: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 22,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: DW_BORDER.subtle,
    backgroundColor: DW_SURFACES.low,
    gap: 8,
    alignItems: 'center',
  },
  emptyTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 17,
    color: DW_TEXT.primary,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    color: DW_TEXT.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyCta: {
    marginTop: 8,
    alignSelf: 'stretch',
  },
  loading: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    color: DW_TEXT.secondary,
  },
  errorBlock: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.35)',
    backgroundColor: 'rgba(255, 107, 107, 0.08)',
    gap: 12,
    alignItems: 'center',
  },
  errorText: {
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    color: '#FF9A9A',
    textAlign: 'center',
    lineHeight: 20,
  },
});
