import React from 'react';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { router } from 'expo-router';
import { MK_PALETTES, type MkColors } from '../theme/tokens';

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
        <ErrorFallback
          message={this.state.error?.message ?? 'An unexpected error occurred.'}
          onReload={this.handleReload}
        />
      );
    }

    return (
      <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>
    );
  }
}

// The boundary catches before AppThemeProvider mounts, so the fallback reads
// the OS color scheme directly rather than the themed context.
function ErrorFallback({ message, onReload }: { message: string; onReload: () => void }) {
  const scheme = useColorScheme();
  const styles = makeStyles(MK_PALETTES[scheme === 'dark' ? 'dark' : 'light']);
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.message}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Reload app"
        style={({ pressed }) => [
          styles.button,
          pressed && { opacity: 0.82, transform: [{ scale: 0.98 }] },
        ]}
        onPress={onReload}
      >
        <Text style={styles.buttonText}>Reload app</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.background,
    paddingHorizontal: 32,
    gap: 16,
  },
  title: {
    color: c.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    color: c.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    marginTop: 8,
    backgroundColor: c.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  buttonText: {
    color: c.onAccent,
    fontSize: 15,
    fontWeight: '700',
  },
});
