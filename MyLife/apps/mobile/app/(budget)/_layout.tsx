import React from 'react';
import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';
import { BG_ACCENT, BG_FONTS, BG_SURFACES } from '@mylife/budget';
import { colors } from '@mylife/ui';
import { ModuleErrorBoundary } from '../../components/ModuleErrorBoundary';
import { ModuleLockGuard } from '../../components/ModuleLockGuard';

export default function BudgetLayout() {
  const [fontsLoaded] = useFonts({
    [BG_FONTS.regular]: PlusJakartaSans_400Regular,
    [BG_FONTS.medium]: PlusJakartaSans_500Medium,
    [BG_FONTS.semiBold]: PlusJakartaSans_600SemiBold,
    [BG_FONTS.bold]: PlusJakartaSans_700Bold,
    [BG_FONTS.extraBold]: PlusJakartaSans_800ExtraBold,
  });

  if (!fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: BG_SURFACES.base,
        }}
      >
        <ActivityIndicator color={BG_ACCENT} />
      </View>
    );
  }

  return (
    <ModuleErrorBoundary moduleName="MyBudget">
      <ModuleLockGuard moduleId="budget" moduleName="MyBudget" moduleIcon={'\uD83D\uDCB0'} accentColor={colors.modules.budget}>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: BG_SURFACES.base },
          headerStyle: { backgroundColor: BG_SURFACES.base },
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: BG_FONTS.semiBold },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen
          name="(tabs)"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="create"
          options={{
            title: 'New Envelope',
          }}
        />
        <Stack.Screen
          name="[id]"
          options={{
            title: 'Envelope',
          }}
        />
        <Stack.Screen
          name="account/create"
          options={{
            title: 'New Account',
          }}
        />
        <Stack.Screen
          name="account/[id]"
          options={{
            title: 'Account',
          }}
        />
        <Stack.Screen
          name="transaction/create"
          options={{
            title: 'New Transaction',
          }}
        />
        <Stack.Screen
          name="transaction/[id]"
          options={{
            title: 'Transaction',
          }}
        />
        <Stack.Screen
          name="goals"
          options={{
            title: 'Goals',
          }}
        />
        <Stack.Screen
          name="goal/create"
          options={{
            title: 'New Goal',
          }}
        />
        <Stack.Screen
          name="goal/new"
          options={{
            title: 'New Goal',
          }}
        />
        <Stack.Screen
          name="goal/[id]"
          options={{
            title: 'Goal',
          }}
        />
        <Stack.Screen
          name="subscription/add"
          options={{
            title: 'Add Subscription',
          }}
        />
        <Stack.Screen
          name="subscription/[id]"
          options={{
            title: 'Subscription',
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            title: 'Settings',
          }}
        />
        <Stack.Screen
          name="onboarding"
          options={{
            title: 'Get Started',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="import-csv"
          options={{
            title: 'Import CSV',
          }}
        />
        <Stack.Screen
          name="renewal-calendar"
          options={{
            title: 'Renewal Calendar',
          }}
        />
        <Stack.Screen
          name="net-worth"
          options={{ title: 'Net Worth' }}
        />
        <Stack.Screen
          name="age-of-money"
          options={{ title: 'Age of Money' }}
        />
        <Stack.Screen
          name="no-spend-streaks"
          options={{ title: 'No-Spend Streaks' }}
        />
        <Stack.Screen
          name="spending-heatmap"
          options={{ title: 'Spending Heatmap' }}
        />
        <Stack.Screen
          name="weekly-digest"
          options={{ title: 'Weekly Digest' }}
        />
        <Stack.Screen
          name="income"
          options={{ title: 'Income' }}
        />
        <Stack.Screen
          name="debt-payoff"
          options={{ title: 'Debt Payoff' }}
        />
        <Stack.Screen
          name="debt-payoff/create"
          options={{ title: 'New Payoff Plan' }}
        />
        <Stack.Screen
          name="debt-payoff/[id]"
          options={{ title: 'Payoff Plan' }}
        />
        <Stack.Screen
          name="loan-planner"
          options={{ title: 'Loan Planner' }}
        />
        <Stack.Screen
          name="investments"
          options={{ title: 'Investments' }}
        />
        <Stack.Screen
          name="family"
          options={{ title: 'Family Sharing' }}
        />
        <Stack.Screen
          name="splitting"
          options={{ title: 'Expense Splitting' }}
        />
        <Stack.Screen
          name="splitting/new"
          options={{ title: 'New Split' }}
        />
        <Stack.Screen
          name="subscription-roi"
          options={{ title: 'Subscription ROI' }}
        />
        <Stack.Screen
          name="currencies"
          options={{ title: 'Currencies' }}
        />
        <Stack.Screen
          name="alerts"
          options={{ title: 'Budget Alerts' }}
        />
        <Stack.Screen
          name="rules"
          options={{ title: 'Transaction Rules' }}
        />
        <Stack.Screen
          name="rules/create"
          options={{ title: 'New Rule' }}
        />
        <Stack.Screen
          name="cash-flow"
          options={{ title: 'Cash Flow' }}
        />
        <Stack.Screen
          name="receipt-scan"
          options={{ title: 'Scan Receipt' }}
        />
        <Stack.Screen
          name="plan-tab"
          options={{ title: 'Plan' }}
        />
        <Stack.Screen
          name="category-target"
          options={{ title: 'Category Target' }}
        />
        <Stack.Screen
          name="checklist"
          options={{ title: 'Getting Started' }}
        />
        <Stack.Screen
          name="review-transactions"
          options={{ title: 'Review Transactions' }}
        />
        <Stack.Screen
          name="future-months"
          options={{ title: 'Future Months' }}
        />
      </Stack>
      </ModuleLockGuard>
    </ModuleErrorBoundary>
  );
}
