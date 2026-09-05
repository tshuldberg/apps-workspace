import { useCallback, useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import {
  accountErrorMessage,
} from '@mylife/mynews';
import { tokens } from './theme/tokens';
import { useMyNewsAuth } from './providers/AuthProvider';
import { useMyNewsCloud } from './providers/CloudProvider';
import { ScreenHeader } from './components/ScreenHeader';
import { MessageView } from './components/StateViews';
import { PrimaryButton, SecondaryButton } from './components/Buttons';
import { exportFileName, exportSizeLabel } from './lib/account';
import { ErrorText } from './components/ErrorText';

type ExportState =
  | { status: 'idle' }
  | { status: 'building' }
  | { status: 'ready'; json: string; byteCount: number; fileName: string }
  | { status: 'error'; message: string };

/** Sections listed for the user; the server owns the authoritative bundle. */
const EXPORT_CONTENTS: readonly string[] = [
  'Your profile, handle, display name and public signing key',
  'Every article you published, with its full signed revision history',
  'Every edit suggestion and thread comment you wrote',
  'Your credibility ledger, with the points behind every accepted edit',
  'Your follows, blocks and mutes, and your newsroom memberships',
  'The reports you filed and any statements of reasons about your content',
  'Your record of accepting the terms, and your support and payment records',
];

export default function AccountExportScreen() {
  const auth = useMyNewsAuth();
  const { isConfigured, port, reason } = useMyNewsCloud();
  const hasSession = auth.status === 'anonymous' || auth.status === 'linked';

  const [state, setState] = useState<ExportState>({ status: 'idle' });

  const onExport = useCallback(async () => {
    if (!port) return;
    setState({ status: 'building' });
    const result = await port.exportAccountData();
    if (!result.ok) {
      setState({ status: 'error', message: accountErrorMessage(result.error) });
      return;
    }
    setState({
      status: 'ready',
      json: JSON.stringify(result.bundle, null, 2),
      byteCount: result.byteCount,
      fileName: exportFileName(new Date().toISOString()),
    });
  }, [port]);

  const onShare = useCallback(async () => {
    if (state.status !== 'ready') return;
    try {
      await Share.share({ message: state.json, title: state.fileName });
    } catch {
      // The user cancelled or the share sheet failed; nothing to fake.
    }
  }, [state]);

  if (!isConfigured || !port) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Export my data" />
        <MessageView
          title="Not connected to a MyNews server yet"
          body={reason ?? 'Your data lives on the MyNews server. Not connected for this build yet.'}
        />
      </View>
    );
  }

  if (!hasSession) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Export my data" />
        <MessageView
          title="Sign in to export your data"
          body="An export is built from your account, so it needs a signed-in session."
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Export my data" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.headline}>Everything your account owns</Text>
          <Text style={styles.body}>
            One JSON file, built the moment you ask for it. We record that you asked, never a copy
            of the file.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>What is included</Text>
          {EXPORT_CONTENTS.map((line) => (
            <Text key={line} style={styles.body}>
              {line}
            </Text>
          ))}
        </View>

        <View style={styles.card}>
          {state.status === 'error' ? <ErrorText style={styles.error}>{state.message}</ErrorText> : null}
          {state.status === 'ready' ? (
            <>
              <Text style={styles.cardTitle}>Ready</Text>
              <Text style={styles.body}>
                {state.fileName} · {exportSizeLabel(state.byteCount)}
              </Text>
              <PrimaryButton label="Share export" onPress={() => void onShare()} />
              <SecondaryButton label="Rebuild export" onPress={() => void onExport()} />
            </>
          ) : (
            <PrimaryButton
              label="Build my export"
              onPress={() => void onExport()}
              loading={state.status === 'building'}
            />
          )}
        </View>

        {state.status === 'ready' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Preview</Text>
            <Text style={styles.code} numberOfLines={20}>
              {state.json.slice(0, 2000)}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.bg,
  },
  content: {
    padding: 20,
    paddingBottom: 48,
    gap: 14,
  },
  card: {
    backgroundColor: tokens.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 16,
    gap: 8,
  },
  cardTitle: {
    color: tokens.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  headline: {
    color: tokens.text,
    fontSize: 20,
    fontWeight: '800',
  },
  body: {
    color: tokens.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  code: {
    color: tokens.textTertiary,
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'Courier',
  },
  error: {
    color: tokens.danger,
    fontSize: 13,
    lineHeight: 19,
  },
});
