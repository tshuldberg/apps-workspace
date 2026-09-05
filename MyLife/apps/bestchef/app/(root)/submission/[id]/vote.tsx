/**
 * Legacy CookProof vote route -- redirect wrapper.
 *
 * Deep-links to /submission/:id/vote are forwarded to the new
 * ReviewedVoteSheet at /reviewed-vote/:id. This preserves existing
 * share links and external push notification payloads.
 */

import { useEffect } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppThemeColors } from '../../providers/AppThemeProvider';

export default function LegacyVoteRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const tc = useAppThemeColors();

  useEffect(() => {
    if (id) {
      router.replace(`/reviewed-vote/${id}`);
    }
  }, [id, router]);

  return <View style={{ flex: 1, backgroundColor: tc.background }} />;
}
