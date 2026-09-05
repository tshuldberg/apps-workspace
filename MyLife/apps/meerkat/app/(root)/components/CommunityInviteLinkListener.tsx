import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Button } from './kit';
import { useAppThemeColors } from '../providers/AppThemeProvider';
import { subscribeInvitationIntent, clearInvitationIntent, getInvitationIntent, saveInvitationIntent, INVITATION_SAVED_COPY } from '../data/invitation-intent-core';
import * as Linking from 'expo-linking';
import { InvitePreviewSheet } from './InvitePreviewSheet';
import { useMeerkatDatabase } from '../providers/DatabaseProvider';
import { isCommunityInviteUrl } from '../data/join-flow';
import { markOnboardingComplete, setDeepLinkInvitePending } from '../data/onboarding-core';

// Catches an incoming `meerkat://community/join#<payload>` deep link (cold start
// via getInitialURL, or the `url` event while running) and presents the ONE
// InvitePreviewSheet over whatever screen is active (Plan 31 Phase 1, T1.3). It
// never auto-joins: the sheet's Join button is the only join trigger (NC-1). A
// malformed/failed link renders the existing reason text inside the sheet.
// Mounted once inside the provider tree (the sheet needs router + db + sync).
//
// First-run coordination (M1): while this sheet is up it raises
// setDeepLinkInvitePending(true) so OnboardingGate suppresses its own modal (the
// two never co-present); a successful join calls markOnboardingComplete so a
// cold-start invite install lands the user IN the joined channel with onboarding
// dismissed (an existing user is already complete, so it is a no-op there).
export function CommunityInviteLinkListener({ unlocked, agePassed }: { unlocked: boolean; agePassed: boolean }): React.ReactElement {
  const db = useMeerkatDatabase();
  const colors = useAppThemeColors();
  const [link, setLink] = useState<string | null>(() => getInvitationIntent(db));
  const [previewing, setPreviewing] = useState(false);
  const handled = useRef<string | null>(null);
  useEffect(() => subscribeInvitationIntent(() => setLink(getInvitationIntent(db))), [db]);

  useEffect(() => {
    const handle = (incoming: string | null): void => {
      if (!incoming || incoming === handled.current) return;
      if (!isCommunityInviteUrl(incoming)) return;
      if (!saveInvitationIntent(db, incoming)) return;
      handled.current = incoming;
      setLink(incoming);
      setPreviewing(false);
    };
    Linking.getInitialURL().then(handle).catch(() => {});
    const sub = Linking.addEventListener('url', (event) => handle(event.url));
    return () => sub.remove();
  }, [db]);

  useEffect(() => {
    setDeepLinkInvitePending(previewing && unlocked && agePassed);
    return () => setDeepLinkInvitePending(false);
  }, [previewing, unlocked, agePassed]);

  const dismiss = useCallback(() => {
    // Reset the dedup so re-tapping the SAME invite link after a dismiss presents
    // again, and clear the pending flag so first-run onboarding resumes on cancel.
    handled.current = null;
    if (link) clearInvitationIntent(db, link);
    setPreviewing(false);
    setLink(null);
    setDeepLinkInvitePending(false);
  }, [db, link]);

  return (
    <>
    {link && agePassed && !previewing && <View style={{ padding: 12 }}>
      <Text style={{ color: colors.text }}>{INVITATION_SAVED_COPY}</Text>
      {unlocked && <Button title="Return to your invitation" onPress={() => setPreviewing(true)} />}
      <Button title="Discard invitation" variant="ghost" onPress={dismiss} />
    </View>}
    <InvitePreviewSheet
      link={link}
      visible={previewing && unlocked && agePassed && link !== null}
      onClose={() => setPreviewing(false)}
      onJoined={(result) => {
        // Completing onboarding is idempotent for an existing user (already '1'),
        // and lands a first-run invite install in the joined channel.
        dismiss();
        markOnboardingComplete(db);
        Alert.alert('Community access', result.notice);
      }}
    />
    </>
  );
}
