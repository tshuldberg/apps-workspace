import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors } from '@mylife/ui';

interface SocialStatePanelProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SocialStatePanel({
  title,
  description,
  actionLabel,
  onAction,
}: SocialStatePanelProps) {
  return (
    <View style={styles.card}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{'\u{1F91D}'}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionLabel && onAction ? (
        <TouchableOpacity onPress={onAction} style={styles.button}>
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    margin: 16,
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 12,
  },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C4DFF1A',
  },
  badgeText: {
    fontSize: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  button: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#7C4DFF',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
