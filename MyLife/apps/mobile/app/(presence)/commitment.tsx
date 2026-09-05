import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  GlassPanel,
  PR_ACCENT_LIGHT,
  PR_FONTS,
  PR_TEXT,
  PR_TEXT_SECONDARY,
  PR_TYPOGRAPHY,
  createCommitment,
  deleteCommitment,
  getActiveCommitment,
  getCommitments,
  updateCommitment,
  type CommitmentContract,
} from '@mylife/presence';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  PresenceHero,
  PresenceScrollScreen,
  PresenceSectionHeader,
  presenceScreenKitStyles,
} from './_screen-kit';

export default function CommitmentScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const activeCommitment = useMemo(() => getActiveCommitment(db), [db, tick]);
  const commitments = useMemo(() => getCommitments(db), [db, tick]);
  const [draft, setDraft] = useState(activeCommitment?.text ?? '');

  const saveCommitment = () => {
    if (draft.trim().length === 0) {
      Alert.alert('Empty commitment', 'Write a note to your future self before saving.');
      return;
    }
    try {
      if (activeCommitment == null) {
        createCommitment(db, draft);
      } else {
        updateCommitment(db, activeCommitment.id, draft);
      }
      setTick((value) => value + 1);
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Could not save the commitment.');
    }
  };

  return (
    <PresenceScrollScreen>
      <PresenceHero
        eyebrow="Why this matters"
        title="Commitment Contract"
        subtitle="Write a note your future self can read when the day is slipping and you need a reason to return."
        icon="handshake"
      />

      <GlassPanel padding={18} style={styles.editorCard}>
        <Text style={presenceScreenKitStyles.fieldLabel}>Active commitment</Text>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="I committed to being present because..."
          placeholderTextColor={PR_TEXT_SECONDARY}
          multiline
          style={[presenceScreenKitStyles.input, presenceScreenKitStyles.inputMultiline]}
        />
        <View style={presenceScreenKitStyles.actionRow}>
          <Pressable style={presenceScreenKitStyles.secondaryButton} onPress={() => setDraft(activeCommitment?.text ?? '')}>
            <Text style={presenceScreenKitStyles.secondaryButtonText}>Reset</Text>
          </Pressable>
          <Pressable style={presenceScreenKitStyles.primaryButton} onPress={saveCommitment}>
            <Text style={presenceScreenKitStyles.primaryButtonText}>Save</Text>
          </Pressable>
        </View>
      </GlassPanel>

      <PresenceSectionHeader title="History" />
      <View style={presenceScreenKitStyles.stack}>
        {commitments.map((commitment) => (
          <CommitmentHistoryCard
            key={commitment.id}
            commitment={commitment}
            onDelete={() => {
              Alert.alert('Delete commitment', 'Remove this commitment from history?', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => {
                    try {
                      deleteCommitment(db, commitment.id);
                      if (commitment.id === activeCommitment?.id) {
                        setDraft('');
                      }
                      setTick((value) => value + 1);
                    } catch {
                      Alert.alert('Delete failed', 'Could not delete the commitment.');
                    }
                  },
                },
              ]);
            }}
          />
        ))}
      </View>
    </PresenceScrollScreen>
  );
}

function CommitmentHistoryCard({
  commitment,
  onDelete,
}: {
  commitment: CommitmentContract;
  onDelete: () => void;
}) {
  return (
    <GlassPanel padding={18} style={styles.historyCard}>
      <View style={styles.historyHeader}>
        <Text style={styles.historyLabel}>{commitment.active ? 'Active now' : new Date(commitment.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
        <Pressable onPress={onDelete}>
          <Text style={styles.deleteText}>Delete</Text>
        </Pressable>
      </View>
      <Text style={styles.historyText}>{commitment.text}</Text>
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  editorCard: {
    gap: 14,
  },
  historyCard: {
    gap: 10,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  historyLabel: {
    ...PR_TYPOGRAPHY.labelUpper,
    color: PR_ACCENT_LIGHT,
    fontFamily: PR_FONTS.semiBold,
  },
  historyText: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT,
  },
  deleteText: {
    ...PR_TYPOGRAPHY.bodySm,
    color: '#FFB4AB',
    fontFamily: PR_FONTS.semiBold,
  },
});
