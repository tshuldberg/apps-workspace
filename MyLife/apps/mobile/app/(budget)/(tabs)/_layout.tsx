import { Tabs, useRouter } from 'expo-router';
import { ModuleLayoutWrapper } from '../../../components/ModuleLayoutWrapper';

export default function BudgetTabsLayout() {
  const router = useRouter();

  return (
    <ModuleLayoutWrapper
      moduleId="budget"
      errorBoundary={false}
      lockGuard={false}
      fab={{
        icon: '+',
        onPress: () => router.push('/(budget)/transaction/create'),
        label: 'Add Transaction',
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Budget' }} />
      <Tabs.Screen name="transactions" options={{ title: 'Transactions' }} />
      <Tabs.Screen name="subscriptions" options={{ title: 'Subscriptions' }} />
      <Tabs.Screen name="reports" options={{ title: 'Reports' }} />
      <Tabs.Screen name="accounts" options={{ title: 'Accounts' }} />
    </ModuleLayoutWrapper>
  );
}
