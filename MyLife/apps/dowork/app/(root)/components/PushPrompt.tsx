// Inline push-notification nudge.
//
// Coaching pushes (form checks, feedback, new videos) only reach a device that
// registered an Expo token, and that registration otherwise lives buried in
// Settings > Notifications. This dismissible card offers a one-tap enable at the
// moments push matters most: right after a trainer redeems their invite, right
// after a client joins, and at the top of the client's trainer space.
//
// Honesty rules (shared with notification-preferences):
//   * Enable reuses registerPushToken from data/push - the SAME path Settings
//     uses. No path fakes a registered token or a "push on" state.
//   * If the app is not provisioned for the store (founder-ops F2), or there is
//     no cloud session, the card simply does not appear (nothing to enable).
//   * If the OS has already denied permission, Enable surfaces that honestly and
//     routes to device Settings instead of pretending it worked.
//   * Dismissal and success are persisted in hub_settings so the card never
//     nags again once the user has answered it.

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Bell, Check, X } from 'lucide-react-native';
import type { DatabaseAdapter } from '@mylife/db';
import { WK_FONTS } from '@mylife/workouts';
import { useDatabase } from '../providers/DatabaseProvider';
import { useDoWorkCloud } from '../providers/DoWorkCloudProvider';
import { hasPushTokens, isPushProvisioned, registerPushToken } from '../data/push';
import { friendlyError } from '../data/friendly-errors';
import { DW_ACCENT, DW_BORDER, DW_ON_ACCENT, DW_SURFACES, DW_TEXT } from '../theme/tokens';

// ── Persisted state (hub_settings KV, per auth uid) ────────────────────────
//
// Keyed by user id so an answer on a shared device belongs to the account
// that gave it: user B signing in after user A dismissed still gets offered.
// The pre-existing un-keyed 'dowork.push_prompt.v1' row is intentionally NOT
// read as a fallback (its answerer is unknowable); the worst case is one
// extra nudge for an existing user.

export const PUSH_PROMPT_KV_PREFIX = 'dowork.push_prompt.v1';

export function pushPromptKvKey(userId: string): string {
  return `${PUSH_PROMPT_KV_PREFIX}:${userId}`;
}

export interface PushPromptState {
  // The user tapped "Not now"; never offer again.
  dismissed: boolean;
  // Push was registered from this card (or found already registered); never
  // offer again.
  registered: boolean;
}

const EMPTY_STATE: PushPromptState = { dismissed: false, registered: false };

// Reads the persisted prompt state. A missing or corrupt row is treated as
// "never answered" so a bad payload can only cost one extra nudge, never a crash.
export function readPushPromptState(db: DatabaseAdapter, userId: string): PushPromptState {
  try {
    const rows = db.query<{ value: string }>(
      'SELECT value FROM hub_settings WHERE key = ? LIMIT 1',
      [pushPromptKvKey(userId)],
    );
    const raw = rows[0]?.value;
    if (!raw) return { ...EMPTY_STATE };
    const parsed = JSON.parse(raw) as Partial<PushPromptState>;
    return {
      dismissed: parsed.dismissed === true,
      registered: parsed.registered === true,
    };
  } catch {
    return { ...EMPTY_STATE };
  }
}

function writePushPromptState(db: DatabaseAdapter, userId: string, state: PushPromptState): void {
  db.execute(
    `INSERT INTO hub_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [pushPromptKvKey(userId), JSON.stringify(state)],
  );
}

export function markPushPromptDismissed(db: DatabaseAdapter, userId: string): void {
  writePushPromptState(db, userId, { ...readPushPromptState(db, userId), dismissed: true });
}

export function markPushPromptRegistered(db: DatabaseAdapter, userId: string): void {
  writePushPromptState(db, userId, { ...readPushPromptState(db, userId), registered: true });
}

// Pure gate for whether the nudge should ever be shown. Kept free of React and
// native modules so the decision matrix is unit-tested directly.
export function shouldOfferPushPrompt(input: {
  state: PushPromptState;
  cloudReady: boolean;
  provisioned: boolean;
  alreadyRegistered: boolean;
}): boolean {
  if (!input.cloudReady) return false; // no session to attach a token to
  if (!input.provisioned) return false; // store provisioning (F2) not done yet
  if (input.alreadyRegistered) return false; // device already has a token
  if (input.state.registered) return false; // answered "yes" before
  if (input.state.dismissed) return false; // answered "no" before
  return true;
}

// ── Component ──────────────────────────────────────────────────────────────

type Phase = 'checking' | 'offer' | 'working' | 'denied' | 'error' | 'done' | 'hidden';

export function PushPrompt() {
  const db = useDatabase();
  const { supabase, userId, isReady, isConfigured } = useDoWorkCloud();
  const [phase, setPhase] = useState<Phase>('checking');
  const [errorText, setErrorText] = useState<string | null>(null);

  const cloudReady = isConfigured && Boolean(supabase) && Boolean(userId);

  const evaluate = useCallback(async () => {
    if (!userId) {
      setPhase('hidden');
      return;
    }
    const provisioned = isPushProvisioned();
    const state = readPushPromptState(db, userId);

    let alreadyRegistered = false;
    if (cloudReady && provisioned) {
      const tokens = await hasPushTokens(supabase, userId);
      alreadyRegistered = tokens.ok ? tokens.exists : false;
      // Reflect server truth so future mounts skip the round-trip.
      if (alreadyRegistered) markPushPromptRegistered(db, userId);
    }

    setPhase(
      shouldOfferPushPrompt({ state, cloudReady, provisioned, alreadyRegistered })
        ? 'offer'
        : 'hidden',
    );
  }, [db, cloudReady, supabase, userId]);

  useEffect(() => {
    if (!isReady) return;
    void evaluate();
  }, [isReady, evaluate]);

  const handleEnable = useCallback(async () => {
    setPhase('working');
    setErrorText(null);
    const result = await registerPushToken(supabase, userId, { promptIfNeeded: true });
    if (result.ok) {
      if (userId) markPushPromptRegistered(db, userId);
      setPhase('done');
      return;
    }
    if (result.reason === 'permission_denied') {
      setPhase('denied');
      return;
    }
    // not_provisioned / unsupported / cloud_unavailable / error: honest copy.
    setErrorText(friendlyError(result.error));
    setPhase('error');
  }, [db, supabase, userId]);

  const handleDismiss = useCallback(() => {
    if (userId) markPushPromptDismissed(db, userId);
    setPhase('hidden');
  }, [db, userId]);

  if (phase === 'checking' || phase === 'hidden') return null;

  if (phase === 'done') {
    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.iconCircle}>
            <Check size={18} color={DW_ACCENT} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.title}>Notifications on</Text>
            <Text style={styles.body}>We&rsquo;ll ping this device when it matters.</Text>
          </View>
          <Pressable
            style={styles.closeButton}
            onPress={handleDismiss}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          >
            <X size={16} color={DW_TEXT.tertiary} />
          </Pressable>
        </View>
      </View>
    );
  }

  if (phase === 'denied') {
    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.iconCircle}>
            <Bell size={18} color={DW_ACCENT} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.title}>Notifications are turned off</Text>
            <Text style={styles.body}>
              Turn them on for DoWork in your device Settings to get coaching alerts.
            </Text>
          </View>
        </View>
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.primary, pressed && { opacity: 0.86 }]}
            onPress={() => void Linking.openSettings()}
            accessibilityRole="button"
            accessibilityLabel="Open device Settings"
          >
            <Text style={styles.primaryText}>Open Settings</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.ghost, pressed && { opacity: 0.8 }]}
            onPress={handleDismiss}
            accessibilityRole="button"
            accessibilityLabel="Not now"
          >
            <Text style={styles.ghostText}>Not now</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const busy = phase === 'working';

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconCircle}>
          <Bell size={18} color={DW_ACCENT} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>Get pinged when it matters</Text>
          <Text style={styles.body}>
            Turn on notifications for coaching replies, form checks, and new videos.
          </Text>
        </View>
      </View>

      {phase === 'error' && errorText ? (
        <View style={styles.errorStrip}>
          <Text style={styles.errorText}>{errorText}</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.primary, pressed && { opacity: 0.86 }, busy && { opacity: 0.6 }]}
          onPress={() => void handleEnable()}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={phase === 'error' ? 'Try again' : 'Enable notifications'}
        >
          {busy ? (
            <ActivityIndicator color={DW_ON_ACCENT} />
          ) : (
            <Text style={styles.primaryText}>{phase === 'error' ? 'Try again' : 'Enable'}</Text>
          )}
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.ghost, pressed && { opacity: 0.8 }]}
          onPress={handleDismiss}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Not now"
        >
          <Text style={styles.ghostText}>Not now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: DW_SURFACES.low,
    borderColor: DW_BORDER.default,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${DW_ACCENT}18`,
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontFamily: WK_FONTS.bold,
    fontSize: 15,
    color: DW_TEXT.primary,
  },
  body: {
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    color: DW_TEXT.secondary,
    lineHeight: 19,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DW_SURFACES.high,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  primary: {
    flex: 1,
    backgroundColor: DW_ACCENT,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontFamily: WK_FONTS.bold,
    fontSize: 14,
    color: DW_ON_ACCENT,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  ghost: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 13,
    color: DW_TEXT.tertiary,
  },
  errorStrip: {
    backgroundColor: 'rgba(255, 107, 107, 0.10)',
    borderColor: 'rgba(255, 107, 107, 0.32)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    color: '#FF8B7A',
    lineHeight: 18,
  },
});
