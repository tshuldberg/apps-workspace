import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { EditorProfileView } from '@mylife/mynews';
import { tokens } from '../theme/tokens';
import { useMyNewsCloud } from '../providers/CloudProvider';
import { ScreenHeader } from '../components/ScreenHeader';
import { LoadingView, MessageView } from '../components/StateViews';
import { buildCredibilityViewModel, lineItemText } from '../lib/credibility';
import { atHandle } from '../lib/format';

type ScreenState =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; profile: EditorProfileView };

export default function CredibilityScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const { isConfigured, port, reason } = useMyNewsCloud();
  const [state, setState] = useState<ScreenState>({ status: 'loading' });

  useEffect(() => {
    if (!port || !handle) return;
    let mounted = true;
    void port
      .getEditorProfile(handle)
      .then((profile) => {
        if (!mounted) return;
        setState(profile ? { status: 'loaded', profile } : { status: 'not-found' });
      })
      .catch((err) => {
        if (!mounted) return;
        setState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      mounted = false;
    };
  }, [handle, port]);

  if (!isConfigured || !port) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Credibility" />
        <MessageView
          title="Not connected"
          body={reason ?? 'Not connected to a MyNews server yet.'}
        />
      </View>
    );
  }

  if (state.status === 'loading') {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Credibility" />
        <LoadingView label="Loading the public ledger..." />
      </View>
    );
  }

  if (state.status === 'not-found') {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Credibility" />
        <MessageView
          title="No such editor"
          body={`There is no profile for ${atHandle(handle ?? '')}.`}
        />
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Credibility" />
        <MessageView title="Could not load the ledger" body={state.message} />
      </View>
    );
  }

  const vm = buildCredibilityViewModel({ profile: state.profile, nowMs: Date.now() });

  return (
    <View style={styles.screen}>
      <ScreenHeader title={atHandle(vm.handle)} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerBlock}>
          <Text style={styles.displayName}>{vm.displayName}</Text>
          <Text style={styles.levelChip}>{vm.levelName}</Text>
        </View>

        {vm.emptyLedger ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No accepted suggestions yet</Text>
            <Text style={styles.cardBody}>
              When {atHandle(vm.handle)} has suggestions accepted, every award lands in a public
              signed ledger and the full math shows here. Nothing is hand-assigned.
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Score breakdown</Text>
            {vm.lineItems.map((item) => (
              <View key={item.type} style={styles.lineRow}>
                <Text style={styles.lineText}>{lineItemText(item)}</Text>
              </View>
            ))}
            <View style={styles.divider} />
            <Text style={styles.lineText}>
              Acceptance diversity ({vm.distinctAuthors}{' '}
              {vm.distinctAuthors === 1 ? 'author' : 'authors'}) × {vm.diversityMult.toFixed(2)}
            </Text>
            <Text style={styles.lineText}>Author standing × {vm.standingMult.toFixed(2)}</Text>
            <Text style={styles.lineText}>Recency decay (12 mo half-life)</Text>
            <View style={styles.divider} />
            <Text style={styles.totalLine}>Weighted score {vm.total.toFixed(1)}</Text>
            <Text style={styles.cardMeta}>
              Computed on this device from the public signed ledger. formula + full ledger public
            </Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {vm.nextLevel ? `Next level: ${vm.nextLevel.name}` : 'Top level reached'}
          </Text>
          {vm.nextLevel ? (
            vm.nextLevel.requirements.map((req) => (
              <Text key={req} style={styles.lineText}>
                · {req}
              </Text>
            ))
          ) : (
            <Text style={styles.cardBody}>
              Section Editor is the top of the ladder. Standing there is kept by the same public
              ledger as everyone else.
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Anti-gaming</Text>
          <Text style={styles.lineText}>
            {vm.pair
              ? `Pair concentration: ${vm.pair.status} (max ${vm.pair.maxSharePct}% from one author)`
              : 'Pair concentration: no awards yet'}
          </Text>
          <Text style={styles.lineText}>Self-edits: 0 pts</Text>
          <Text style={styles.lineText}>Open-suggestion cap: {vm.openCap}</Text>
        </View>
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
  headerBlock: {
    gap: 6,
  },
  displayName: {
    color: tokens.text,
    fontSize: 24,
    fontWeight: '800',
  },
  levelChip: {
    color: tokens.accent,
    fontSize: 13,
    fontWeight: '700',
    alignSelf: 'flex-start',
    backgroundColor: tokens.accentDim,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
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
  cardBody: {
    color: tokens.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  cardMeta: {
    color: tokens.textTertiary,
    fontSize: 12,
    lineHeight: 18,
  },
  lineRow: {
    flexDirection: 'row',
  },
  lineText: {
    color: tokens.text,
    fontSize: 14,
    lineHeight: 22,
  },
  divider: {
    height: 1,
    backgroundColor: tokens.border,
    marginVertical: 4,
  },
  totalLine: {
    color: tokens.text,
    fontSize: 18,
    fontWeight: '800',
  },
});
