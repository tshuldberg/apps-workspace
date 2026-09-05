import { useState } from 'react';
import { View } from 'react-native';
import { useIdentity } from '../providers/IdentityProvider';
import { hostedRelayAccess, hostedRelayConfig } from '../data/hosted-relay';
import { Button, HonestNotice } from './kit';

export function HostedRelayAccessCard() {
  const { identity } = useIdentity();
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { relayUrl } = hostedRelayConfig();
  if (!relayUrl) return <HonestNotice text="Extra paid connection capacity is not configured in this build. Your free or own connection server remains available through Connection options." />;
  const check = async (): Promise<void> => {
    setChecking(true);
    setNotice(null);
    const access = hostedRelayAccess(identity);
    access.reset();
    try {
      const token = await access.tokenFor(relayUrl);
      setNotice(token
        ? 'A current hosted access token was received. The connection server still checks it when you connect; no messages were sent by this check.'
        : 'Paid connection access is not configured securely in this build.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Hosted access could not be checked.');
    } finally { setChecking(false); }
  };
  return <View style={{ gap: 8 }}>
    <HonestNotice text="Extra paid connection capacity requires an active hosted plan for this identity. The app unlock is a separate purchase. Access is checked when you connect; this does not change your connection server." />
    <Button title={checking ? 'Checking hosted access...' : 'Check hosted access'} variant="secondary" disabled={checking} onPress={() => { void check(); }} />
    {notice ? <HonestNotice text={notice} /> : null}
  </View>;
}
