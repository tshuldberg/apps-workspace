import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, X } from 'lucide-react-native';
import {
  type FlagTargetTypeValue,
  createFlag,
  JAKARTA_FONTS,
  RECIPES_ACCENT,
  RECIPES_SURFACES,
} from '@mylife/bestchef';
import { GlassCard } from '@mylife/bestchef/ui';
import { ErrorState, Text, colors } from '@mylife/ui';

const REPORT_REASONS = [
  { value: 'AI-generated photo', label: 'AI-generated photo' },
  { value: 'Stolen photo', label: 'Stolen photo' },
  { value: 'Inappropriate content', label: 'Inappropriate content' },
  { value: 'Wrong dish', label: 'Wrong dish' },
  { value: 'Other', label: 'Other' },
] as const;

type ReportReason = (typeof REPORT_REASONS)[number]['value'];

export default function ReportModalScreen() {
  const router = useRouter();
  const { targetType, targetId } = useLocalSearchParams<{
    targetType: string;
    targetId: string;
  }>();

  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [otherDetails, setOtherDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!targetType || !targetId) {
    return (
      <View style={styles.screen}>
        <ErrorState message="Missing report target" />
      </View>
    );
  }

  const handleSubmit = async () => {
    if (!selectedReason) return;

    setSubmitting(true);
    setError(null);

    const reason =
      selectedReason === 'Other' && otherDetails.trim()
        ? `Other: ${otherDetails.trim()}`
        : selectedReason;

    try {
      const result = await createFlag(
        targetType as FlagTargetTypeValue,
        targetId,
        'current-user', // Placeholder until auth is wired
        reason,
      );

      if (!result.ok) {
        setError(result.error);
      } else {
        setSubmitted(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <View style={styles.screen}>
        <View style={styles.successWrap}>
          <View style={styles.successCircle}>
            <Check size={28} color="#fff" strokeWidth={2.5} />
          </View>
          <Text style={styles.successTitle}>Report submitted</Text>
          <Text style={styles.successMessage}>
            Thank you for helping keep BestChef trustworthy. We will review
            this content shortly.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.doneButton, pressed && styles.doneButtonPressed]}
            onPress={() => router.back()}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Report this content</Text>
          <Text style={styles.subtitle}>
            Select the reason that best describes the issue
          </Text>
        </View>

        {/* Reason options */}
        <View style={styles.reasonList}>
          {REPORT_REASONS.map((reason) => {
            const isSelected = selectedReason === reason.value;
            return (
              <GlassCard
                key={reason.value}
                level={isSelected ? 3 : 2}
                style={[
                  styles.reasonCard,
                  isSelected && styles.reasonCardSelected,
                ]}
                onPress={() => setSelectedReason(reason.value)}
              >
                <View style={styles.reasonRow}>
                  <View
                    style={[
                      styles.radioOuter,
                      isSelected && styles.radioOuterSelected,
                    ]}
                  >
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                  <Text
                    style={[
                      styles.reasonLabel,
                      isSelected && styles.reasonLabelSelected,
                    ]}
                  >
                    {reason.label}
                  </Text>
                </View>
              </GlassCard>
            );
          })}
        </View>

        {/* Other details */}
        {selectedReason === 'Other' && (
          <View style={styles.otherWrap}>
            <Text style={styles.otherLabel}>ADDITIONAL DETAILS</Text>
            <TextInput
              style={styles.otherInput}
              placeholder="Describe the issue..."
              placeholderTextColor={colors.textTertiary}
              value={otherDetails}
              onChangeText={setOtherDetails}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{otherDetails.length}/500</Text>
          </View>
        )}

        {/* Error */}
        {error != null && (
          <Text style={styles.errorText}>{error}</Text>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable
          style={styles.cancelButton}
          onPress={() => router.back()}
        >
          <X size={18} color={colors.text} strokeWidth={2} />
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            (!selectedReason || submitting) && styles.submitButtonDisabled,
            pressed && styles.submitButtonPressed,
          ]}
          onPress={() => void handleSubmit()}
          disabled={!selectedReason || submitting}
        >
          <Text style={styles.submitButtonText}>
            {submitting ? 'Submitting...' : 'Submit Report'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: RECIPES_SURFACES.base,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 120,
    gap: 20,
  },

  // Header
  header: {
    gap: 6,
  },
  title: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 22,
    letterSpacing: -0.3,
    color: colors.text,
  },
  subtitle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: colors.textSecondary,
  },

  // Reasons
  reasonList: {
    gap: 8,
  },
  reasonCard: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  reasonCardSelected: {
    borderWidth: 1,
    borderColor: RECIPES_ACCENT,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: RECIPES_ACCENT,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: RECIPES_ACCENT,
  },
  reasonLabel: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 15,
    color: colors.text,
  },
  reasonLabelSelected: {
    color: RECIPES_ACCENT,
  },

  // Other details
  otherWrap: {
    gap: 6,
  },
  otherLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: 'rgba(214, 195, 181, 0.5)',
  },
  otherInput: {
    backgroundColor: RECIPES_SURFACES.lift,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
    color: colors.text,
    minHeight: 80,
  },
  charCount: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 11,
    color: colors.textTertiary,
    alignSelf: 'flex-end',
  },

  // Error
  errorText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: colors.danger,
    textAlign: 'center',
  },

  // Success
  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  successCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: RECIPES_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  successTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 20,
    color: colors.text,
  },
  successMessage: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  doneButton: {
    marginTop: 8,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: RECIPES_SURFACES.focus,
  },
  doneButtonPressed: {
    opacity: 0.85,
  },
  doneButtonText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 14,
    color: colors.text,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: 36,
    backgroundColor: RECIPES_SURFACES.base,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    gap: 12,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: RECIPES_SURFACES.lift,
  },
  cancelButtonText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 14,
    color: colors.text,
  },
  submitButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: RECIPES_ACCENT,
  },
  submitButtonPressed: {
    opacity: 0.85,
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 14,
    color: '#0E0E13',
  },
});
