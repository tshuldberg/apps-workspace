import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Rocket } from 'lucide-react-native';
import type { AnySupabaseClient } from '../lib/supabase';
import {
  YearnBoostActivationError,
  YearnRepository,
  type YearnMembership,
} from '../lib/yearnRepository';
import {
  fetchYearnProductPrices,
  finishYearnPurchase,
  purchaseYearnProduct,
} from '../lib/iap';
import {
  yearnColors,
  yearnRadius,
  yearnSpacing,
  yearnTypography,
} from '../theme/yearnTheme';

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return null;
  return new Date(timestamp).toLocaleDateString();
}

function purchaseFailureText(error: unknown): string {
  if (error instanceof YearnBoostActivationError) return error.message;
  return error instanceof Error ? error.message : String(error);
}

interface MembershipSectionProps {
  supabase: AnySupabaseClient | null;
  userId: string | null;
}

/**
 * Server-truth membership panel: state comes from current_membership(), a
 * purchase sends the StoreKit JWS to yearn-membership-activate, and the
 * transaction is finished only after the server accepts it. Price copy is
 * the store's localized price; without store products the buttons render an
 * honest unavailable state instead of a hardcoded price.
 */
export function MembershipSection({ supabase, userId }: MembershipSectionProps) {
  const [membership, setMembership] = React.useState<YearnMembership | null>(null);
  const [price, setPrice] = React.useState<string | null>(null);
  const [isBusy, setIsBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [errorText, setErrorText] = React.useState<string | null>(null);
  const [reloadToken, setReloadToken] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    if (!supabase) return () => { cancelled = true; };
    void new YearnRepository(supabase).currentMembership()
      .then((next) => {
        if (!cancelled) setMembership(next);
      })
      .catch(() => {});
    void fetchYearnProductPrices()
      .then((prices) => {
        if (!cancelled) setPrice(prices.membership ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [supabase, reloadToken]);

  const handleJoin = React.useCallback(async () => {
    if (!supabase || !userId || isBusy) return;
    setIsBusy(true);
    setNotice(null);
    setErrorText(null);
    try {
      const purchase = await purchaseYearnProduct('membership', userId);
      if (!purchase.ok) {
        if (purchase.reason !== 'cancelled') setErrorText(purchase.error);
        return;
      }
      const activation = await new YearnRepository(supabase).activateMembership(purchase.jws);
      await finishYearnPurchase(purchase.purchase, 'membership');
      setNotice(
        activation.isMember
          ? `Membership active${formatDate(activation.expiresAt) ? ` until ${formatDate(activation.expiresAt)}` : ''}.`
          : 'The App Store confirmed the purchase, but the subscription is not active.',
      );
      setReloadToken((token) => token + 1);
    } catch (error) {
      setErrorText(purchaseFailureText(error));
    } finally {
      setIsBusy(false);
    }
  }, [isBusy, supabase, userId]);

  const handleRestore = React.useCallback(async () => {
    if (!supabase || isBusy) return;
    setIsBusy(true);
    setNotice(null);
    setErrorText(null);
    try {
      const { restoreYearnMembershipJws } = await import('../lib/iap');
      const jws = await restoreYearnMembershipJws();
      if (!jws) {
        setErrorText('No membership purchase was found on this Apple account.');
        return;
      }
      const activation = await new YearnRepository(supabase).activateMembership(jws);
      setNotice(
        activation.isMember ? 'Membership restored.' : 'That membership has expired.',
      );
      setReloadToken((token) => token + 1);
    } catch (error) {
      setErrorText(purchaseFailureText(error));
    } finally {
      setIsBusy(false);
    }
  }, [isBusy, supabase]);

  if (!supabase) return null;

  const isMember = Boolean(membership?.isMember);
  const renewalDate = formatDate(membership?.expiresAt ?? null);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>Membership</Text>
      {isMember ? (
        <Text style={styles.body}>
          {renewalDate ? `Yearn Membership is active until ${renewalDate}.` : 'Yearn Membership is active.'}
        </Text>
      ) : (
        <Text style={styles.body}>
          {price
            ? `Yearn Membership (${price}/year) supports the app.`
            : 'Yearn Membership is unavailable until App Store products are configured.'}
        </Text>
      )}
      <View style={styles.buttonRow}>
        {!isMember ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Join Yearn Membership"
            disabled={isBusy || !price || !userId}
            onPress={() => { void handleJoin(); }}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
              (isBusy || !price || !userId) && styles.disabled,
            ]}
          >
            {isBusy ? (
              <ActivityIndicator color={yearnColors.inkwine} size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Join</Text>
            )}
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Restore purchases"
          disabled={isBusy}
          onPress={() => { void handleRestore(); }}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.pressed,
            isBusy && styles.disabled,
          ]}
        >
          <Text style={styles.secondaryButtonText}>Restore purchases</Text>
        </Pressable>
      </View>
      {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
      {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
    </View>
  );
}

interface BoostButtonProps {
  supabase: AnySupabaseClient | null;
}

/**
 * Real boost purchase: StoreKit JWS -> yearn-boost-activate (signed chain
 * verification + appAccountToken binding) -> honest expiry copy. No success
 * state is ever shown without the server's activation response (audit U1/B5
 * closed for real, replacing the removed fabricated-success button).
 */
export function BoostButton({ supabase }: BoostButtonProps) {
  const [isBusy, setIsBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [errorText, setErrorText] = React.useState<string | null>(null);

  const handleBoost = React.useCallback(async () => {
    if (!supabase || isBusy) return;
    setIsBusy(true);
    setNotice(null);
    setErrorText(null);
    try {
      const { data } = await supabase.auth.getUser();
      const userId: string | null = data?.user?.id ?? null;
      if (!userId) {
        setErrorText('Sign in to boost your profile.');
        return;
      }
      const purchase = await purchaseYearnProduct('boost', userId);
      if (!purchase.ok) {
        if (purchase.reason !== 'cancelled') setErrorText(purchase.error);
        return;
      }
      const repository = new YearnRepository(supabase);
      const activation = await repository.activateBoost(purchase.jws);
      await finishYearnPurchase(purchase.purchase, 'boost');
      const until = formatDate(activation.expiresAt);
      setNotice(until ? `Boost active until ${until}.` : 'Boost active.');
    } catch (error) {
      setErrorText(purchaseFailureText(error));
    } finally {
      setIsBusy(false);
    }
  }, [isBusy, supabase]);

  if (!supabase) return null;

  return (
    <View style={styles.boostContainer}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Boost your profile"
        disabled={isBusy}
        onPress={() => { void handleBoost(); }}
        style={({ pressed }) => [
          styles.boostButton,
          pressed && styles.pressed,
          isBusy && styles.disabled,
        ]}
      >
        {isBusy ? (
          <ActivityIndicator color={yearnColors.inkwine} size="small" />
        ) : (
          <>
            <Rocket size={15} color={yearnColors.inkwine} strokeWidth={2.4} />
            <Text style={styles.boostButtonText}>Boost</Text>
          </>
        )}
      </Pressable>
      {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
      {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderTopColor: yearnColors.line,
    borderTopWidth: 1,
    gap: yearnSpacing.sm,
    paddingTop: yearnSpacing.md,
  },
  sectionLabel: {
    color: yearnColors.textSecondary,
    ...yearnTypography.label,
  },
  body: {
    color: yearnColors.textSecondary,
    ...yearnTypography.body,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: yearnSpacing.sm,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: yearnColors.coral,
    borderRadius: yearnRadius.pill,
    paddingHorizontal: yearnSpacing.lg,
    paddingVertical: 8,
  },
  primaryButtonText: {
    color: yearnColors.inkwine,
    ...yearnTypography.body,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: yearnColors.line,
    borderRadius: yearnRadius.pill,
    borderWidth: 1,
    paddingHorizontal: yearnSpacing.md,
    paddingVertical: 8,
  },
  secondaryButtonText: {
    color: yearnColors.gold,
    ...yearnTypography.body,
  },
  boostContainer: {
    gap: 4,
    marginBottom: yearnSpacing.md,
  },
  boostButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: yearnColors.gold,
    borderRadius: yearnRadius.pill,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: yearnSpacing.md,
    paddingVertical: 7,
  },
  boostButtonText: {
    color: yearnColors.inkwine,
    ...yearnTypography.body,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.5,
  },
  noticeText: {
    color: yearnColors.gold,
    ...yearnTypography.body,
  },
  errorText: {
    color: yearnColors.alarm,
    ...yearnTypography.body,
  },
});
