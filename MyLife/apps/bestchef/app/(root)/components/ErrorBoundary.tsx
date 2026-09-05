import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { getUgcLanguage } from '../data/app-language';
import type { LanguageCode } from '../i18n/languages';
import { translateText } from '../i18n/translations';
import { captureAppException } from '../observability/sentry';

// Class components cannot use the useI18n hook, and the boundary may catch
// crashes from inside the provider tree itself. The app-language holder is
// seeded synchronously by the I18nProvider, so reading it here localizes
// the crash screen without any hook or context dependency.
function tSafe(key: string): string {
  try {
    return translateText(getUgcLanguage() as LanguageCode, key);
  } catch {
    return key;
  }
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  resetKey: number;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, resetKey: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Keep visible in dev for debugging
    console.error('[ErrorBoundary]', error, info.componentStack);
    // Report the render crash for operational triage. No-op unless Sentry is
    // configured; the payload is PII-scrubbed by beforeSend (audit H14).
    captureAppException(error);
  }

  handleReload = (): void => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      resetKey: prev.resetKey + 1,
    }));
    try {
      router.replace('/');
    } catch (err) {
      console.warn('[ErrorBoundary] reload failed', err);
    }
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>{tSafe('Something went wrong')}</Text>
          <Text style={styles.message}>
            {this.state.error?.message ?? tSafe('An unexpected error occurred.')}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tSafe('Reload app')}
            style={({ pressed }) => [
              styles.button,
              pressed && { opacity: 0.82, transform: [{ scale: 0.98 }] },
            ]}
            onPress={this.handleReload}
          >
            <Text style={styles.buttonText}>{tSafe('Reload app')}</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#131318',
    paddingHorizontal: 32,
    gap: 16,
  },
  title: {
    color: '#E4E1E9',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    color: '#D6C3B5',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    marginTop: 8,
    backgroundColor: '#22C55E',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  buttonText: {
    color: '#131318',
    fontSize: 15,
    fontWeight: '700',
  },
});
