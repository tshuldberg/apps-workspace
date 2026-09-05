import React, { Component } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text, colors, spacing } from '@mylife/ui';
import { router } from 'expo-router';

interface Props {
  moduleName?: string;
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary that wraps each module's screen group.
 *
 * If a module crashes (rendering error, unhandled exception in a lifecycle
 * method, etc.), this boundary catches it and shows a recovery screen
 * instead of crashing the entire app. The user can tap "Back to Apps"
 * to return to the hub dashboard.
 */
export class ModuleErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(
      `[MyLife] Module crash${this.props.moduleName ? ` in ${this.props.moduleName}` : ''}:`,
      error,
      info.componentStack,
    );
  }

  private handleBackToHub = () => {
    this.setState({ hasError: false, error: null });
    router.replace('/(hub)');
  };

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.emoji}>⚠️</Text>
            <Text style={styles.title}>
              {this.props.moduleName
                ? `${this.props.moduleName} ran into a problem`
                : 'Something went wrong'}
            </Text>
            <Text style={styles.message}>
              This module crashed, but the rest of MyLife is fine. You can try again or head back
              to the hub.
            </Text>
            {this.state.error && (
              <Text style={styles.detail}>{this.state.error.message}</Text>
            )}
            <Pressable style={styles.primaryButton} onPress={this.handleRetry}>
              <Text style={styles.primaryText}>Try Again</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={this.handleBackToHub}>
              <Text style={styles.secondaryText}>Back to Apps</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  content: {
    alignItems: 'center',
    maxWidth: 320,
  },
  emoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  message: {
    color: colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  detail: {
    color: colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    fontFamily: 'Courier',
    opacity: 0.7,
    marginBottom: spacing.lg,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: spacing.sm,
    width: '100%',
    alignItems: 'center',
  },
  primaryText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  secondaryText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
});
