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
  getPresenceCrossModule,
  recordAppOpen,
} from '@mylife/presence';
import { useDatabase } from '../../components/DatabaseProvider';
import { PresenceHero, PresenceScrollScreen, presenceScreenKitStyles } from './_screen-kit';

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function IntentionPromptScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ appId?: string; appName?: string }>();
  const app = useMemo(() => APP_LIBRARY.find((entry) => entry.appId === params.appId), [params.appId]);
  const appName = params.appName ?? app?.name ?? 'this app';
  const appId = params.appId ?? app?.appId ?? 'unknown.app';
  const [intention, setIntention] = useState(`I am opening ${appName} for...`);

  const handleContinue = () => {
    try {
      const appOpen = recordAppOpen(db, {
        date: todayString(),
        app_id: appId,
        intention_text: intention.trim().length > 0 ? intention.trim() : null,
      });
      const crossModule = getPresenceCrossModule();
      const next = crossModule.onAppSessionEnd(appOpen.id, appId, appName);
      router.replace({
        pathname: next.route,
        params: next.params,
      } as never);
    } catch (error) {
      Alert.alert('Could not continue', error instanceof Error ? error.message : 'Failed to start the app-open stub flow.');
    }
  };

  return (
    <PresenceScrollScreen>
      <PresenceHero
        eyebrow="Intentional opening"
        title={`Why ${appName}?`}
        subtitle="This is the stub flow the native app-open bridge will use. Save your reason, then simulate the post-open reflection."
        icon="lightbulb"
      />

      <GlassPanel padding={18} style={styles.card}>
        <Text style={presenceScreenKitStyles.fieldLabel}>Reason</Text>
        <TextInput
          value={intention}
          onChangeText={setIntention}
          placeholder="Check replies, post a photo, reply to one message..."
          placeholderTextColor={PR_TEXT_SECONDARY}
          multiline
          style={[presenceScreenKitStyles.input, presenceScreenKitStyles.inputMultiline]}
        />

        <View style={presenceScreenKitStyles.actionRow}>
          <Pressable style={presenceScreenKitStyles.secondaryButton} onPress={() => router.back()}>
            <Text style={presenceScreenKitStyles.secondaryButtonText}>Cancel</Text>
          </Pressable>
          <Pressable style={presenceScreenKitStyles.primaryButton} onPress={handleContinue}>
            <Text style={presenceScreenKitStyles.primaryButtonText}>Simulate App Open</Text>
          </Pressable>
        </View>
      </GlassPanel>
    </PresenceScrollScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 14,
  },
  helper: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT,
    fontFamily: PR_FONTS.medium,
  },
});
