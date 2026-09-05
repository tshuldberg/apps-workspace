'use client';

import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Card } from './Card';
import { colors } from '../tokens/colors';
import { borderRadius, spacing } from '../tokens/spacing';

interface HealthDataConsentDialogProps {
  visible: boolean;
  moduleName: string;
  moduleIcon: string;
  dataTypes: readonly string[];
  onConsent: () => void;
  onDecline: () => void;
}

/**
 * MHMDA-compliant affirmative consent dialog for health data collection.
 *
 * Presents the user with a clear description of what health data a module
 * collects and requires explicit consent before any data collection begins.
 * Compliant with WA MHMDA, NV SB 370, and CT CTDPA requirements.
 */
export function HealthDataConsentDialog({
  visible,
  moduleName,
  moduleIcon,
  dataTypes,
  onConsent,
  onDecline,
}: HealthDataConsentDialogProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  const handleConsent = () => {
    setAcknowledged(false);
    onConsent();
  };

  const handleDecline = () => {
    setAcknowledged(false);
    onDecline();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleDecline}
    >
      <View style={styles.overlay}>
        <Card style={styles.dialog}>
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text variant="heading" style={styles.title}>
              {moduleIcon} Health Data Consent
            </Text>

            <Text variant="body" color={colors.textSecondary} style={styles.description}>
              {moduleName} collects consumer health data as defined by applicable
              health privacy laws. Your explicit consent is required before any
              data collection begins.
            </Text>

            <View style={styles.dataSection}>
              <Text variant="label" style={styles.dataTitle}>
                Data collected by {moduleName}:
              </Text>
              {dataTypes.map((type) => (
                <View key={type} style={styles.dataRow}>
                  <Text variant="body" color={colors.textSecondary}>
                    {'\u2022'} {type}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.privacySection}>
              <Text variant="label" style={styles.dataTitle}>
                Your rights:
              </Text>
              <Text variant="caption" color={colors.textSecondary} style={styles.rightItem}>
                {'\u2022'} All health data is stored locally on your device
              </Text>
              <Text variant="caption" color={colors.textSecondary} style={styles.rightItem}>
                {'\u2022'} We never sell, share, or transmit your health data to third parties
              </Text>
              <Text variant="caption" color={colors.textSecondary} style={styles.rightItem}>
                {'\u2022'} You can withdraw consent at any time in Settings
              </Text>
              <Text variant="caption" color={colors.textSecondary} style={styles.rightItem}>
                {'\u2022'} You can request deletion of all your health data
              </Text>
            </View>

            <View style={styles.disclaimerSection}>
              <Text variant="caption" color={colors.warning} style={styles.disclaimer}>
                MyLife is not a medical device and does not provide medical advice.
                Health data in this module is for personal tracking purposes only.
                Always consult a healthcare professional for medical decisions.
              </Text>
            </View>

            <Pressable
              style={styles.checkboxRow}
              onPress={() => setAcknowledged(!acknowledged)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: acknowledged }}
            >
              <View style={[styles.checkbox, acknowledged && styles.checkboxChecked]}>
                {acknowledged && (
                  <Text variant="caption" color={colors.background}>
                    {'\u2713'}
                  </Text>
                )}
              </View>
              <Text variant="caption" color={colors.textSecondary} style={styles.checkboxLabel}>
                I understand that {moduleName} will collect the health data
                described above and I give my consent.
              </Text>
            </Pressable>

            <View style={styles.actions}>
              <Pressable style={styles.declineButton} onPress={handleDecline}>
                <Text variant="label" color={colors.textSecondary}>
                  Decline
                </Text>
              </Pressable>
              <Pressable
                style={[styles.consentButton, !acknowledged && styles.buttonDisabled]}
                onPress={handleConsent}
                disabled={!acknowledged}
              >
                <Text variant="label" color={acknowledged ? colors.text : colors.textTertiary}>
                  I Consent
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  dialog: {
    maxWidth: 480,
    width: '100%',
    maxHeight: '85%',
  },
  scroll: {
    flexGrow: 0,
  },
  title: {
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  description: {
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  dataSection: {
    backgroundColor: colors.glass,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  dataTitle: {
    marginBottom: spacing.sm,
  },
  dataRow: {
    paddingVertical: 2,
  },
  privacySection: {
    marginBottom: spacing.md,
  },
  rightItem: {
    paddingVertical: 2,
    paddingLeft: spacing.xs,
  },
  disclaimerSection: {
    backgroundColor: 'rgba(255,159,10,0.08)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,159,10,0.2)',
  },
  disclaimer: {
    lineHeight: 18,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  checkboxLabel: {
    flex: 1,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  declineButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  consentButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.success,
    backgroundColor: 'rgba(48,209,88,0.15)',
  },
  buttonDisabled: {
    borderColor: colors.border,
    backgroundColor: colors.glass,
    opacity: 0.5,
  },
});