import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { YearnCloudProvider } from '@/src/providers/YearnCloudProvider';
import { installYearnSecureRandom } from '@/src/lib/e2eeRandom';
import { configureYearnNotificationHandler } from '@/src/lib/push';
import { yearnColors, yearnRadius, yearnSpacing, yearnTypography } from '@/src/theme/yearnTheme';

// Guarantee a native CSPRNG for tweetnacl before any E2EE code runs. Without
// this, Hermes may lack globalThis.crypto and every keypair/encrypt would throw
// on first use (audit Y4).
installYearnSecureRandom();

// Foreground pushes render as banners instead of being silently swallowed.
configureYearnNotificationHandler();

interface ErrorBoundaryState {
  hasError: boolean;
}

// A malformed row or an unexpected runtime error in any screen must not leave
// the user on a blank white screen with no recovery (audit B1). This catches
// render-time throws app-wide and offers a retry.
class YearnErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.fallback}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.body}>
            Yearn hit an unexpected error on this screen. Your data is safe.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Try again"
            onPress={this.handleReset}
            style={styles.button}
          >
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <YearnErrorBoundary>
        <YearnCloudProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </YearnCloudProvider>
      </YearnErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: yearnSpacing.xl,
    backgroundColor: yearnColors.inkwine,
    gap: yearnSpacing.md,
  },
  title: {
    ...yearnTypography.title,
    color: yearnColors.vellum,
    textAlign: 'center',
  },
  body: {
    ...yearnTypography.body,
    color: yearnColors.textSecondary,
    textAlign: 'center',
  },
  button: {
    marginTop: yearnSpacing.sm,
    paddingVertical: yearnSpacing.sm,
    paddingHorizontal: yearnSpacing.lg,
    borderRadius: yearnRadius.pill,
    backgroundColor: yearnColors.coral,
  },
  buttonText: {
    ...yearnTypography.body,
    color: yearnColors.inkwine,
    fontWeight: '700',
  },
});
