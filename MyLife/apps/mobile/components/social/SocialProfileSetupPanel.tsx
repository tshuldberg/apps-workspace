import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { SocialProfile } from '@mylife/social';
import { getSocialClient, suggestSocialHandle } from '@mylife/social';
import { colors } from '@mylife/ui';

interface SocialProfileSetupPanelProps {
  initialDisplayName?: string;
  onCreated: (profile: SocialProfile) => void;
}

export function SocialProfileSetupPanel({
  initialDisplayName = '',
  onCreated,
}: SocialProfileSetupPanelProps) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [handle, setHandle] = useState(suggestSocialHandle(initialDisplayName));
  const [bio, setBio] = useState('');
  const [hasEditedHandle, setHasEditedHandle] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const client = getSocialClient();
    if (!client) {
      setError('Social client not initialized.');
      return;
    }

    setIsSubmitting(true);
    const result = await client.createProfile({
      displayName: displayName.trim(),
      handle: suggestSocialHandle(handle),
      bio: bio.trim() || undefined,
    });
    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setError(null);
    onCreated(result.data);
  }

  return (
    <View style={styles.card}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{'\u{1F512}'}</Text>
      </View>
      <Text style={styles.title}>Create your social profile</Text>
      <Text style={styles.description}>
        Social stays opt-in. Pick a handle and decide later which modules can
        share anything.
      </Text>

      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>Display name</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            placeholder="Your name"
            placeholderTextColor={colors.textTertiary}
            onChangeText={(value) => {
              setDisplayName(value);
              if (!hasEditedHandle) {
                setHandle(suggestSocialHandle(value));
              }
            }}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Handle</Text>
          <TextInput
            style={styles.input}
            value={handle}
            placeholder="mylife_handle"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            onChangeText={(value) => {
              setHasEditedHandle(true);
              setHandle(value);
            }}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={styles.textarea}
            value={bio}
            placeholder="What should friends know about your MyLife?"
            placeholderTextColor={colors.textTertiary}
            multiline={true}
            numberOfLines={3}
            onChangeText={setBio}
          />
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        disabled={isSubmitting || displayName.trim().length === 0}
        onPress={() => {
          void submit();
        }}
        style={styles.button}
      >
        <Text style={styles.buttonText}>
          {isSubmitting ? 'Creating profile...' : 'Create profile'}
        </Text>
      </TouchableOpacity>
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
    gap: 14,
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
  form: {
    gap: 12,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surfaceElevated,
    color: colors.text,
    fontSize: 14,
  },
  textarea: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surfaceElevated,
    color: colors.text,
    fontSize: 14,
    minHeight: 84,
    textAlignVertical: 'top',
  },
  error: {
    fontSize: 13,
    color: colors.danger,
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
