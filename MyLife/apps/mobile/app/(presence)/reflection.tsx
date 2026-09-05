import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  APP_LIBRARY,
  GlassPanel,
  PR_ACCENT_LIGHT,
  PR_FONTS,
  PR_TEXT,
  PR_TEXT_SECONDARY,
  PR_TYPOGRAPHY,
  getAppOpen,
  rateAppOpen,
} from '@mylife/presence';
import { useDatabase } from '../../components/DatabaseProvider';
import { PresenceHero, PresenceScrollScreen, presenceScreenKitStyles } from './_screen-kit';

const REFLECTION_OPTIONS = [
  { rating: 1, emoji: '😖', label: 'Regret' },
  { rating: 2, emoji: '😕', label: 'Drained' },
  { rating: 3, emoji: '😐', label: 'Neutral' },
  { rating: 4, emoji: '🙂', label: 'Worth it' },
  { rating: 5, emoji: '😄', label: 'Great' },
];

export default function ReflectionScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ openId?: string; appId?: string; appName?: string }>();
  const appOpen = useMemo(() => (params.openId != null ? getAppOpen(db, params.openId) : null), [db, params.openId]);
  const app = useMemo(() => APP_LIBRARY.find((entry) => entry.appId === (params.appId ?? appOpen?.app_id)), [appOpen?.app_id, params.appId]);
  const appName = params.appName ?? app?.name ?? 'that session';
  const [rating, setRating] = useState<number | null>(appOpen?.post_rating ?? null);
  const [note, setNote] = useState(appOpen?.reflection_note ?? '');

  const handleSave = () => {
    if (params.openId == null || rating == null) {
      Alert.alert('Missing reflection', 'Choose a rating before saving.');
      return;
    }
    try {
      rateAppOpen(db, params.openId, rating, note.trim().length > 0 ? note.trim() : null);
      router.replace('/(presence)/intentions' as never);
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Could not save the reflection.');
    }
  };

  return (
    <PresenceScrollScreen>
      <PresenceHero
        eyebrow="Quick check-in"
        title={`How was ${appName}?`}
        subtitle="Rate whether opening the app actually matched your intention, then capture one sentence if you want the extra context later."
        icon="self_improvement"
      />

      <GlassPanel padding={18} style={styles.card}>
        <Text style={presenceScreenKitStyles.fieldLabel}>Was it worth it?</Text>
        <View style={styles.emojiRow}>
          {REFLECTION_OPTIONS.map((option) => {
            const selected = rating === option.rating;
            return (
              <Pressable
                key={option.rating}
                onPress={() => setRating(option.rating)}
                style={[styles.emojiButton, selected ? styles.emojiButtonSelected : null]}
              >
                <Text style={styles.emoji}>{option.emoji}</Text>
                <Text style={[styles.emojiLabel, selected ? styles.emojiLabelSelected : null]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View>
          <Text style={presenceScreenKitStyles.fieldLabel}>Anything to note? (optional)</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="I opened it for one message and stayed longer than planned..."
            placeholderTextColor={PR_TEXT_SECONDARY}
            multiline
            style={[presenceScreenKitStyles.input, presenceScreenKitStyles.inputMultiline]}
          />
        </View>

        <View style={presenceScreenKitStyles.actionRow}>
          <Pressable style={presenceScreenKitStyles.secondaryButton} onPress={() => router.replace('/(presence)/intentions' as never)}>
            <Text style={presenceScreenKitStyles.secondaryButtonText}>Skip</Text>
          </Pressable>
          <Pressable style={presenceScreenKitStyles.primaryButton} onPress={handleSave}>
            <Text style={presenceScreenKitStyles.primaryButtonText}>Save</Text>
          </Pressable>
        </View>
      </GlassPanel>
    </PresenceScrollScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 16,
  },
  emojiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  emojiButton: {
    width: '18%',
    minWidth: 58,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  emojiButtonSelected: {
    backgroundColor: `${PR_ACCENT_LIGHT}22`,
  },
  emoji: {
    fontSize: 28,
  },
  emojiLabel: {
    ...PR_TYPOGRAPHY.bodySm,
    color: PR_TEXT_SECONDARY,
    textAlign: 'center',
  },
  emojiLabelSelected: {
    color: PR_TEXT,
    fontFamily: PR_FONTS.semiBold,
  },
});
