// Trainer subscription paywall.
//
// Opens from the public profile Subscribe CTA. Shows the store's localized price
// (never the static tier ladder), the auto-renewing subscription disclosure, what
// the subscription includes, and links to the hosted Terms and Privacy pages. The
// price is resolved from the store on open: a neutral loading state shows first,
// and a failed resolution blocks purchase with an honest retry rather than quoting
// a price we cannot confirm. The Purchase button drives the real RevenueCat flow
// through data/purchases.ts; entitlement flips only on the server-confirmed
// subscription row (never the local receipt), so a store purchase that has not yet
// been confirmed shows an honest "confirming" state.
//
// Never fakes a purchase: when RevenueCat is not configured the sheet shows an
// honest unavailable state with no purchase button. Founder decision 5: a viewer
// who already has an active coaching link with this trainer is told the library
// is included, not sold to.

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Check, Lock, Sparkles, X } from 'lucide-react-native';
import { WK_FONTS } from '@mylife/workouts';
import {
  getMySubscriptionForTrainer,
  isSubscriptionActive,
} from '../data/cloud-subscriptions';
import {
  ensurePurchasesConfigured,
  getProductForTier,
  purchaseTrainerSubscription,
  restoreTrainerPurchases,
} from '../data/purchases';
import { friendlyError } from '../data/friendly-errors';
import { DW_ACCENT, DW_BORDER, DW_ON_ACCENT, DW_SURFACES, DW_TEXT } from '../theme/tokens';

const TERMS_URL = 'https://dowork.app/terms';
const PRIVACY_URL = 'https://dowork.app/privacy';

export interface PaywallTrainer {
  id: string;
  displayName: string;
  priceTier: number;
}

interface PaywallSheetProps {
  visible: boolean;
  onClose: () => void;
  supabase: SupabaseClient;
  userId: string | null;
  trainer: PaywallTrainer;
  // Founder decision 5: an active client link already entitles the viewer.
  hasActiveClientLink: boolean;
  // Called after a server-confirmed purchase so the profile re-fetches and the
  // now-entitled premium rows appear (server truth).
  onConfirmed: () => void;
}

type Phase = 'idle' | 'working' | 'pending' | 'confirmed' | 'error';

const storeName = Platform.OS === 'android' ? 'Google Play' : 'the App Store';

export function PaywallSheet({
  visible,
  onClose,
  supabase,
  userId,
  trainer,
  hasActiveClientLink,
  onConfirmed,
}: PaywallSheetProps) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null);
  // Price is the store's word, never the static tier ladder. Until getProductForTier
  // resolves we show a neutral loading state; a failure blocks purchase honestly.
  const [priceStatus, setPriceStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [storePrice, setStorePrice] = useState<string | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const resolvePrice = useCallback(async () => {
    setPriceStatus('loading');
    setPriceError(null);
    const productResult = await getProductForTier(trainer.priceTier);
    if (productResult.ok) {
      setStorePrice(productResult.product.priceString);
      setPriceStatus('ready');
    } else {
      setStorePrice(null);
      setPriceError(friendlyError(productResult.error));
      setPriceStatus('error');
    }
  }, [trainer.priceTier]);

  // Resolve the live store price + configuration state when the sheet opens.
  useEffect(() => {
    if (!visible) return;
    setPhase('idle');
    setMessage(null);

    const cfg = ensurePurchasesConfigured();
    if (!cfg.configured) {
      setAvailable(false);
      setUnavailableReason(cfg.reason);
      return;
    }
    setAvailable(true);
    setUnavailableReason(null);
    void resolvePrice();
  }, [visible, resolvePrice]);

  const handlePurchase = useCallback(async () => {
    if (!userId) {
      setPhase('error');
      setMessage('Sign in before subscribing to a trainer.');
      return;
    }
    setPhase('working');
    setMessage(null);
    const outcome = await purchaseTrainerSubscription({
      supabase,
      userId,
      trainerId: trainer.id,
      priceTier: trainer.priceTier,
    });
    if (outcome.ok && outcome.confirmed) {
      setPhase('confirmed');
      setMessage(null);
      onConfirmed();
      return;
    }
    if (outcome.ok && !outcome.confirmed) {
      setPhase('pending');
      setMessage(null);
      return;
    }
    if (!outcome.ok && outcome.cancelled) {
      setPhase('idle');
      setMessage(null);
      return;
    }
    setPhase('error');
    setMessage(outcome.error);
  }, [supabase, userId, trainer.id, trainer.priceTier, onConfirmed]);

  const handleCheckAgain = useCallback(async () => {
    if (!userId) return;
    setPhase('working');
    const result = await getMySubscriptionForTrainer(supabase, userId, trainer.id);
    if (result.ok && result.subscription && isSubscriptionActive(result.subscription)) {
      setPhase('confirmed');
      onConfirmed();
      return;
    }
    setPhase('pending');
  }, [supabase, userId, trainer.id, onConfirmed]);

  const handleRestore = useCallback(async () => {
    if (!userId) {
      setPhase('error');
      setMessage('Sign in to restore purchases.');
      return;
    }
    setPhase('working');
    setMessage(null);
    const restore = await restoreTrainerPurchases(userId);
    if (!restore.ok) {
      setPhase('error');
      setMessage(restore.error);
      return;
    }
    // Restore replays receipts; confirm server-side before flipping entitlement.
    const result = await getMySubscriptionForTrainer(supabase, userId, trainer.id);
    if (result.ok && result.subscription && isSubscriptionActive(result.subscription)) {
      setPhase('confirmed');
      onConfirmed();
      return;
    }
    setPhase('pending');
    setMessage(
      restore.restoredProductIds.length > 0
        ? 'Purchases restored. Confirming your access now.'
        : 'No active subscription was found to restore for this account.',
    );
  }, [supabase, userId, trainer.id, onConfirmed]);

  const busy = phase === 'working';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.headerRow}>
            <View style={styles.iconCircle}>
              <Lock size={20} color={DW_ACCENT} />
            </View>
            <Pressable style={styles.closeButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
              <X size={20} color={DW_TEXT.secondary} />
            </Pressable>
          </View>

          {hasActiveClientLink ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.title}>You already train with {trainer.displayName}</Text>
              <Text style={styles.body}>
                Your coaching relationship includes {trainer.displayName}&rsquo;s full premium library,
                so there&rsquo;s nothing to buy here. Open any premium video to start.
              </Text>
              <Pressable style={styles.primaryButton} onPress={onClose} accessibilityRole="button">
                <Text style={styles.primaryButtonText}>Got it</Text>
              </Pressable>
            </ScrollView>
          ) : phase === 'confirmed' ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.successIcon}>
                <Check size={26} color={DW_ACCENT} />
              </View>
              <Text style={styles.title}>You&rsquo;re subscribed</Text>
              <Text style={styles.body}>
                {trainer.displayName}&rsquo;s premium library is unlocked. Enjoy every new upload while
                your subscription is active.
              </Text>
              <Pressable style={styles.primaryButton} onPress={onClose} accessibilityRole="button">
                <Text style={styles.primaryButtonText}>Start watching</Text>
              </Pressable>
            </ScrollView>
          ) : available === false ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.title}>Subscriptions aren&rsquo;t available yet</Text>
              <Text style={styles.body}>
                {unavailableReason ??
                  'Trainer subscriptions are not available in this build yet. Free videos play now.'}
              </Text>
              <Pressable style={styles.primaryButton} onPress={onClose} accessibilityRole="button">
                <Text style={styles.primaryButtonText}>Got it</Text>
              </Pressable>
            </ScrollView>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.title}>Subscribe to {trainer.displayName}</Text>
              {priceStatus === 'ready' && storePrice ? (
                <Text style={styles.price}>{storePrice}</Text>
              ) : null}

              <View style={styles.includeList}>
                <Include text={`${trainer.displayName}'s full premium video library`} />
                <Include text="Every new premium upload while you're subscribed" />
                <Include text="Hands-free voice control on every video" />
              </View>

              {phase === 'pending' ? (
                <View style={styles.pendingCard}>
                  <Text style={styles.pendingTitle}>Confirming your subscription</Text>
                  <Text style={styles.pendingBody}>
                    Your purchase went through. We&rsquo;re confirming it with our server, which can take
                    up to a minute. You can close this and pull to refresh, or check again.
                  </Text>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={handleCheckAgain}
                    disabled={busy}
                    accessibilityRole="button"
                  >
                    <Text style={styles.secondaryButtonText}>Check again</Text>
                  </Pressable>
                </View>
              ) : null}

              {phase === 'error' && message ? (
                <View style={styles.errorCard}>
                  <Text style={styles.errorText}>{message}</Text>
                </View>
              ) : null}

              {priceStatus === 'loading' ? (
                <View style={styles.priceLoadingRow}>
                  <ActivityIndicator color={DW_ACCENT} />
                  <Text style={styles.priceLoadingText}>Loading price…</Text>
                </View>
              ) : priceStatus === 'error' ? (
                <View style={styles.errorCard}>
                  <Text style={styles.errorText}>
                    {priceError ?? 'We could not load the price from the store. Try again.'}
                  </Text>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => void resolvePrice()}
                    disabled={priceStatus !== 'error'}
                    accessibilityRole="button"
                    accessibilityLabel="Retry loading price"
                  >
                    <Text style={styles.secondaryButtonText}>Retry</Text>
                  </Pressable>
                </View>
              ) : storePrice ? (
                <>
                  <Pressable
                    style={[styles.primaryButton, busy && { opacity: 0.6 }]}
                    onPress={handlePurchase}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel={`Subscribe for ${storePrice}`}
                  >
                    {busy ? (
                      <ActivityIndicator color={DW_ON_ACCENT} />
                    ) : (
                      <Text style={styles.primaryButtonText}>Subscribe {storePrice}</Text>
                    )}
                  </Pressable>

                  <Text style={styles.disclosure}>
                    This is an auto-renewing monthly subscription. Payment is charged to your {storeName}{' '}
                    account at confirmation. It renews at {storePrice} each month unless you cancel at
                    least 24 hours before the period ends. Manage or cancel anytime in your {storeName}{' '}
                    settings.
                  </Text>
                </>
              ) : null}

              <Pressable
                style={styles.restoreLink}
                onPress={handleRestore}
                disabled={busy}
                accessibilityRole="button"
              >
                <Text style={styles.restoreLinkText}>Restore purchases</Text>
              </Pressable>

              <View style={styles.legalRow}>
                <Pressable onPress={() => void Linking.openURL(TERMS_URL)} accessibilityRole="link">
                  <Text style={styles.legalLink}>Terms</Text>
                </Pressable>
                <Text style={styles.legalDot}>·</Text>
                <Pressable onPress={() => void Linking.openURL(PRIVACY_URL)} accessibilityRole="link">
                  <Text style={styles.legalLink}>Privacy</Text>
                </Pressable>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function Include({ text }: { text: string }) {
  return (
    <View style={styles.includeRow}>
      <View style={styles.includeCheck}>
        <Sparkles size={13} color={DW_ACCENT} />
      </View>
      <Text style={styles.includeText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
  },
  sheet: {
    maxHeight: '90%',
    backgroundColor: DW_SURFACES.mid,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 28,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: DW_BORDER.strong,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${DW_ACCENT}18`,
  },
  successIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${DW_ACCENT}18`,
    marginBottom: 12,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DW_SURFACES.high,
  },
  title: {
    fontFamily: WK_FONTS.extraBold,
    fontSize: 24,
    color: DW_TEXT.primary,
    letterSpacing: -0.5,
    marginTop: 4,
  },
  price: {
    fontFamily: WK_FONTS.bold,
    fontSize: 20,
    color: DW_ACCENT,
    marginTop: 6,
  },
  priceLoadingRow: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 15,
  },
  priceLoadingText: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 14,
    color: DW_TEXT.secondary,
  },
  body: {
    fontFamily: WK_FONTS.regular,
    fontSize: 15,
    color: DW_TEXT.secondary,
    lineHeight: 22,
    marginTop: 10,
  },
  includeList: {
    gap: 12,
    marginTop: 20,
    marginBottom: 4,
  },
  includeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  includeCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${DW_ACCENT}18`,
  },
  includeText: {
    flex: 1,
    fontFamily: WK_FONTS.medium,
    fontSize: 14,
    color: DW_TEXT.primary,
    lineHeight: 20,
  },
  pendingCard: {
    marginTop: 18,
    backgroundColor: DW_SURFACES.low,
    borderColor: DW_BORDER.default,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  pendingTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 15,
    color: DW_TEXT.primary,
  },
  pendingBody: {
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    color: DW_TEXT.secondary,
    lineHeight: 19,
  },
  errorCard: {
    marginTop: 16,
    backgroundColor: 'rgba(255, 107, 107, 0.10)',
    borderColor: 'rgba(255, 107, 107, 0.32)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  errorText: {
    fontFamily: WK_FONTS.medium,
    fontSize: 13,
    color: '#FF8B7A',
    lineHeight: 19,
  },
  primaryButton: {
    marginTop: 20,
    backgroundColor: DW_ACCENT,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontFamily: WK_FONTS.bold,
    fontSize: 15,
    color: DW_ON_ACCENT,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  secondaryButton: {
    marginTop: 4,
    backgroundColor: DW_SURFACES.high,
    borderColor: DW_BORDER.default,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontFamily: WK_FONTS.bold,
    fontSize: 14,
    color: DW_TEXT.primary,
  },
  restoreLink: {
    marginTop: 14,
    alignItems: 'center',
    paddingVertical: 6,
  },
  restoreLinkText: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 14,
    color: DW_TEXT.secondary,
  },
  disclosure: {
    marginTop: 18,
    fontFamily: WK_FONTS.regular,
    fontSize: 11,
    color: DW_TEXT.tertiary,
    lineHeight: 16,
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 14,
  },
  legalLink: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 13,
    color: DW_TEXT.secondary,
  },
  legalDot: {
    color: DW_TEXT.tertiary,
    fontSize: 13,
  },
});
