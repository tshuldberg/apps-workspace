import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { getLocalAiActions, runLocalAiAction } from '@mylife/notes';
import type { AiAction } from '@mylife/notes';
import { Text, Card, colors, spacing } from '@mylife/ui';

const ACCENT = colors.modules.notes;

const AI_ACTIONS: { key: AiAction; label: string; icon: string; description: string }[] = [
  { key: 'summarize', label: 'Summarize', icon: '📝', description: 'Create a concise summary' },
  { key: 'fix_grammar', label: 'Fix Grammar', icon: '✏️', description: 'Correct grammar and spelling' },
  { key: 'simplify', label: 'Simplify', icon: '🔤', description: 'Make text easier to read' },
];

export default function AiAssistantScreen() {
  const [inputText, setInputText] = useState('');
  const [resultText, setResultText] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<AiAction | null>(null);
  const [processing, setProcessing] = useState(false);

  const availableActions = getLocalAiActions();

  const handleAction = useCallback((action: AiAction) => {
    if (!inputText.trim()) {
      Alert.alert('No Text', 'Paste or type text to use AI actions.');
      return;
    }
    setProcessing(true);
    setActiveAction(action);
    try {
      const result = runLocalAiAction(action, inputText.trim());
      setResultText(result);
    } catch {
      Alert.alert('Error', 'Failed to process text.');
    } finally {
      setProcessing(false);
    }
  }, [inputText]);

  const handleAccept = useCallback(() => {
    if (resultText) {
      setInputText(resultText);
      setResultText(null);
      setActiveAction(null);
    }
  }, [resultText]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="heading">AI Writing Assistant</Text>
      <Text variant="caption" color={colors.textSecondary}>
        On-device text processing. No data leaves your device.
      </Text>

      {/* Input area */}
      <Card>
        <Text variant="label" color={colors.textTertiary}>INPUT TEXT</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Paste or type text here..."
          placeholderTextColor={colors.textTertiary}
          value={inputText}
          onChangeText={setInputText}
          multiline
          textAlignVertical="top"
        />
        <Text variant="caption" color={colors.textTertiary} style={styles.charCount}>
          {inputText.length} characters
        </Text>
      </Card>

      {/* Quick actions toolbar */}
      <View style={styles.actionsRow}>
        {AI_ACTIONS.map((a) => (
          <Pressable
            key={a.key}
            style={[styles.actionCard, activeAction === a.key && styles.actionCardActive]}
            onPress={() => handleAction(a.key)}
          >
            <Text style={{ fontSize: 24 }}>{a.icon}</Text>
            <Text variant="caption" color={activeAction === a.key ? ACCENT : colors.text}>
              {a.label}
            </Text>
            <Text variant="caption" color={colors.textTertiary} style={{ fontSize: 10 }}>
              {a.description}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Processing indicator */}
      {processing && (
        <Card>
          <View style={styles.processingState}>
            <Text variant="body" color={ACCENT}>Processing...</Text>
          </View>
        </Card>
      )}

      {/* Result */}
      {resultText && !processing && (
        <Card style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Text variant="label" color={colors.textTertiary}>
              {activeAction?.toUpperCase().replace(/_/g, ' ')} RESULT
            </Text>
          </View>
          <Text variant="body" color={colors.text} style={styles.resultText}>
            {resultText}
          </Text>
          <View style={styles.resultActions}>
            <Pressable style={styles.acceptBtn} onPress={handleAccept}>
              <Text variant="caption" color={colors.success}>Accept</Text>
            </Pressable>
            <Pressable
              style={styles.rejectBtn}
              onPress={() => { setResultText(null); setActiveAction(null); }}
            >
              <Text variant="caption" color={colors.danger}>Reject</Text>
            </Pressable>
          </View>
        </Card>
      )}

      {/* Available actions info */}
      <Card>
        <Text variant="label" color={colors.textTertiary}>AVAILABLE ACTIONS</Text>
        {availableActions.map((action) => (
          <View key={action} style={styles.actionInfoRow}>
            <View style={[styles.actionDot, { backgroundColor: ACCENT }]} />
            <Text variant="body" color={colors.text}>{action.replace(/_/g, ' ')}</Text>
          </View>
        ))}
        <Text variant="caption" color={colors.textTertiary} style={styles.privacyNote}>
          All processing happens on-device using local algorithms. Your text is never sent to any server.
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  textArea: {
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, padding: spacing.sm, color: colors.text, fontSize: 15,
    minHeight: 120, marginTop: spacing.sm,
  },
  charCount: { textAlign: 'right', marginTop: spacing.xs },
  actionsRow: { flexDirection: 'row', gap: spacing.sm },
  actionCard: {
    flex: 1, padding: spacing.sm, borderRadius: 12, alignItems: 'center', gap: 4,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  actionCardActive: { borderColor: ACCENT, backgroundColor: `${ACCENT}10` },
  processingState: { paddingVertical: spacing.lg, alignItems: 'center' },
  resultCard: { borderLeftWidth: 3, borderLeftColor: ACCENT },
  resultHeader: { marginBottom: spacing.sm },
  resultText: { lineHeight: 22 },
  resultActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  acceptBtn: {
    flex: 1, paddingVertical: spacing.sm, borderRadius: 8, alignItems: 'center',
    borderWidth: 1, borderColor: colors.success, backgroundColor: `${colors.success}15`,
  },
  rejectBtn: {
    flex: 1, paddingVertical: spacing.sm, borderRadius: 8, alignItems: 'center',
    borderWidth: 1, borderColor: colors.danger, backgroundColor: `${colors.danger}15`,
  },
  actionInfoRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  actionDot: { width: 6, height: 6, borderRadius: 3 },
  privacyNote: { marginTop: spacing.md, lineHeight: 18 },
});
