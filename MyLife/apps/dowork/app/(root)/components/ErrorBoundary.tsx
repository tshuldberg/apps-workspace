import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { DW_ACCENT, DW_ON_ACCENT, DW_SURFACES, DW_TEXT } from '../theme/tokens';

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
    console.error('[DoWork ErrorBoundary]', error, info.componentStack);
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
      console.warn('[DoWork ErrorBoundary] reload failed', err);
    }
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reload app"
            style={({ pressed }) => [
              styles.button,
              pressed && { opacity: 0.82, transform: [{ scale: 0.98 }] },
            ]}
            onPress={this.handleReload}
          >
            <Text style={styles.buttonText}>Reload app</Text>
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
    backgroundColor: DW_SURFACES.base,
    paddingHorizontal: 32,
    gap: 16,
  },
  title: {
    color: DW_TEXT.primary,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    color: DW_TEXT.secondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    marginTop: 8,
    backgroundColor: DW_ACCENT,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  buttonText: {
    color: DW_ON_ACCENT,
    fontSize: 15,
    fontWeight: '700',
  },
});
