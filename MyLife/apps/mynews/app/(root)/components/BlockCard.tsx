import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { buildBlockSet, type BlockMode } from '@mylife/mynews';
import { tokens } from '../theme/tokens';
import { useMyNewsAuth } from '../providers/AuthProvider';
import { useMyNewsCloud } from '../providers/CloudProvider';
import { PrimaryButton, SecondaryButton } from './Buttons';
import { blockErrorMessage } from '../lib/blocks';
import { ErrorText } from './ErrorText';

/**
 * Block / Mute / Unblock affordance for an author, shared by the journalist
 * profile (and any surface with a profile id). Resolves the current state from
 * the viewer's own block list, then blocks, mutes, or unblocks through the port.
 * Honest states only: signed-out shows a sign-in prompt, and every action reads
 * back the real result. A block hides the author's content from your feeds
 * immediately; it is reversible and account-private (the author never learns).
 */
export function BlockCard({
  profileId,
  displayName,
}: {
  profileId: string;
  displayName: string;
}) {
  const router = useRouter();
  const auth = useMyNewsAuth();
  const { port } = useMyNewsCloud();
  const hasSession = auth.status === 'anonymous' || auth.status === 'linked';

  const [mode, setMode] = useState<BlockMode | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);

  const refresh = useCallback(async () => {
    if (!port || !hasSession) {
      setLoaded(true);
      return;
    }
    try {
      const blocks = await port.listBlocks();
      setMode(buildBlockSet(blocks).byProfileId.get(profileId) ?? null);
    } catch {
      // The card falls back to the un-blocked affordance; nothing fabricated.
      setMode(null);
    } finally {
      setLoaded(true);
    }
  }, [hasSession, port, profileId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const apply = useCallback(
    async (next: BlockMode | null) => {
      if (!port) return;
      setBusy(true);
      setError(null);
      setNeedsSignIn(false);
      const result =
        next === null ? await port.removeBlock(profileId) : await port.setBlock(profileId, next);
      setBusy(false);
      if (result.ok) {
        setMode(next);
        return;
      }
      const mapped = blockErrorMessage(result.error ?? 'unknown');
      setError(mapped.message);
      setNeedsSignIn(mapped.action === 'sign-in');
    },
    [port, profileId],
  );

  if (!loaded) return null;

  if (!hasSession) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Not seeing eye to eye?</Text>
        <Text style={styles.note}>
          Sign in to block or mute {displayName}. Your block list is tied to your account and stays
          private.
        </Text>
        <SecondaryButton label="Sign in" onPress={() => router.push('/(root)/register')} />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {mode ? (
        <>
          <Text style={styles.title}>
            {mode === 'mute' ? 'Muted' : 'Blocked'}
          </Text>
          <Text style={styles.note}>
            {mode === 'mute'
              ? `${displayName} is muted. Their stories and suggestions stay out of your feeds.`
              : `${displayName} is blocked. Their stories and suggestions stay out of your feeds.`}
          </Text>
          {error ? <ErrorText style={styles.error}>{error}</ErrorText> : null}
          <SecondaryButton label="Unblock" onPress={() => void apply(null)} loading={busy} />
        </>
      ) : (
        <>
          <Text style={styles.title}>Block or mute</Text>
          <Text style={styles.note}>
            Blocking hides {displayName}&apos;s stories and suggestions from your feeds. Muting is a
            softer hide. Both are reversible and private.
          </Text>
          {error ? <ErrorText style={styles.error}>{error}</ErrorText> : null}
          {error && needsSignIn ? (
            <SecondaryButton label="Sign in" onPress={() => router.push('/(root)/register')} />
          ) : null}
          <View style={styles.row}>
            <View style={styles.grow}>
              <SecondaryButton label="Mute" onPress={() => void apply('mute')} loading={busy} />
            </View>
            <View style={styles.grow}>
              <PrimaryButton label="Block" onPress={() => void apply('block')} loading={busy} />
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    backgroundColor: tokens.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 14,
    gap: 10,
  },
  title: {
    color: tokens.text,
    fontSize: 16,
    fontWeight: '800',
  },
  note: {
    color: tokens.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  grow: {
    flex: 1,
  },
  error: {
    color: tokens.danger,
    fontSize: 13,
    lineHeight: 19,
  },
});
