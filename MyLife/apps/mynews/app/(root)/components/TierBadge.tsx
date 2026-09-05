import { StyleSheet, Text, View } from 'react-native';
import { BadgeCheck } from 'lucide-react-native';
import type { VerificationStateView } from '@mylife/mynews';
import { tokens } from '../theme/tokens';

/**
 * Renders a verification pill only for verified journalists. Open-tier authors
 * get nothing (no fabricated trust signal), so callers can drop this inline.
 *
 * Plan 48 WP8: when the caller has the verification state from
 * nw_public_journalists, that state decides the badge and the tier column is
 * ignored. Only a live 'approved' verification renders a badge, so a tier that
 * drifted out of step with the verification record cannot claim one. Callers
 * without the state (feed and byline shapes built from the tier column alone)
 * keep the previous behavior.
 */
export function TierBadge({
  tier,
  verificationState,
  size = 'sm',
}: {
  tier: 'open' | 'verified';
  verificationState?: VerificationStateView;
  size?: 'sm' | 'md';
}) {
  const verified =
    verificationState === undefined ? tier === 'verified' : verificationState === 'approved';
  if (!verified) return null;
  const iconSize = size === 'md' ? 15 : 13;
  return (
    <View style={[styles.wrap, size === 'md' && styles.wrapMd]}>
      <BadgeCheck color={tokens.accent} size={iconSize} />
      <Text style={[styles.label, size === 'md' && styles.labelMd]}>Verified</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: tokens.accentDim,
  },
  wrapMd: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  label: {
    color: tokens.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  labelMd: {
    fontSize: 12,
  },
});
