import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

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
    backgroundColor: '#E4572E',
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
