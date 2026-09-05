import { Tabs } from 'expo-router';
import { ModuleLayoutWrapper } from '../../components/ModuleLayoutWrapper';

export default function PaymentsLayout() {
  return (
    <ModuleLayoutWrapper moduleId="payments">
      <Tabs.Screen name="index" options={{ title: 'Wallet' }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity' }} />
      <Tabs.Screen name="cards" options={{ title: 'Cards' }} />
      <Tabs.Screen name="protect" options={{ title: 'Protect' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      <Tabs.Screen name="[id]" options={{ href: null, title: 'Payment Detail' }} />
      <Tabs.Screen name="send" options={{ href: null, title: 'Send' }} />
      <Tabs.Screen name="request" options={{ href: null, title: 'Request' }} />
      <Tabs.Screen name="add" options={{ href: null, title: 'Add Money' }} />
      <Tabs.Screen name="withdraw" options={{ href: null, title: 'Withdraw' }} />
      <Tabs.Screen name="card" options={{ href: null, title: 'Card' }} />
      <Tabs.Screen name="card-transactions" options={{ href: null, title: 'Card Feed' }} />
      <Tabs.Screen name="scan" options={{ href: null, title: 'QR Pay' }} />
      <Tabs.Screen name="international" options={{ href: null, title: 'International' }} />
      <Tabs.Screen name="remittance/[id]" options={{ href: null, title: 'Remittance' }} />
    </ModuleLayoutWrapper>
  );
}
