// Add a storage destination (Plan 41 WP-41B3). The kind picker is driven by the
// registry: a kind this device cannot serve is an honest explanatory row, never
// a disabled tease (NC-41.8). Local device connects immediately with a real
// authorize + read/write health probe; every other kind explains its connect
// flow honestly. A destination is registered in `authorizing` and only reaches
// `ready` after a real health probe passes (NC-41.4).

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';
import {
  serializeCredentialDestinationConfig,
  serializeS3Credentials,
  serializeWebdavCredentials,
  verifyStorageReadWrite,
} from '@mylife/sync';
import { Button, HonestNotice } from '../../components/kit';
import { StatusChip, StorageHeader } from '../../components/StorageKit';
import { useStorage } from '../../providers/StorageProvider';
import {
  STORAGE_UI_COPY,
  buildAddDestinationRows,
  type StorageAddDestinationRow,
  type StorageConnectFlow,
} from '../../data/storage-destinations/storage-ui-core';
import { createLocalDeviceDestinationAdapter } from '../../data/storage-destinations/local-device-adapter';
import { useMeerkatDatabase } from '../../providers/DatabaseProvider';
import { MK_RADIUS, type MkColors } from '../../theme/tokens';
import { useMkStyles } from '../../providers/AppThemeProvider';
import {
  createMobileStorageCredentialRef,
  deleteMobileStorageSecret,
  writeMobileStorageSecret,
} from '../../data/storage-destinations/credential-store';

const FLOW_HINT: Record<StorageConnectFlow, string> = {
  local: 'Connects now on this device.',
  native_apple: 'Uses a native Apple flow; needs a signed build to verify.',
  native_android: 'Pick a folder your device remembers for future backups.',
  web_directory: 'Grant a browser folder in a supported desktop browser.',
  oauth_token: 'Opens the provider’s sign-in to grant a Meerkat-only folder.',
  credential_form: 'Enter server credentials; they stay in this device’s secure storage.',
  hosted: 'A paid first-party option that only holds encrypted objects.',
  connected_server: 'Connect a server that advertises a signed storage capability.',
};

export default function AddDestinationScreen(): React.ReactElement {
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const db = useMeerkatDatabase();
  const { router: storageRouter, registry, connectOAuthDestination, refresh } = useStorage();
  const [busyKind, setBusyKind] = useState<string | null>(null);
  // Synchronous single-flight: two fast taps land before the busy re-render
  // and would register two destinations (or run two OAuth flows) at once.
  const connectInFlightRef = useRef(false);
  const takeConnectSlot = useCallback((kind: string): boolean => {
    if (connectInFlightRef.current) return false;
    connectInFlightRef.current = true;
    setBusyKind(kind);
    return true;
  }, []);
  const releaseConnectSlot = useCallback(() => {
    connectInFlightRef.current = false;
    setBusyKind(null);
  }, []);
  const [credentialKind, setCredentialKind] = useState<'webdav' | 's3' | 'connected_server' | null>(null);
  const [label, setLabel] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [bucket, setBucket] = useState('');
  const [region, setRegion] = useState('');
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [operatorPublicKey, setOperatorPublicKey] = useState('');

  const rows = useMemo(
    () => buildAddDestinationRows({
      supports: (kind) => registry.supports(kind),
      platform: Platform.OS,
    }),
    [registry],
  );

  // Real local-device connect: register the destination, authorize + probe the
  // adapter, and only mark it ready when the read/write probe verifies. On any
  // failure the destination is left in its true non-ready state.
  const connectLocal = useCallback(() => {
    if (!takeConnectSlot('local_device')) return;
    void (async () => {
      try {
        const id = `local-${Crypto.randomUUID()}`;
        const adapter = createLocalDeviceDestinationAdapter({ destinationId: id, db });
        if (adapter === null) {
          Alert.alert('This device', 'Local storage is not available on this device right now.');
          return;
        }
        const capabilities = await adapter.capabilities();
        storageRouter.registerDestination({
          id,
          kind: 'local_device',
          label: 'This device',
          credentialRef: `local-device:${id}`,
          capabilities,
        });
        const authorization = await adapter.authorize({ kind: 'interactive' });
        if (authorization.kind !== 'authorized') {
          refresh();
          Alert.alert('This device', 'The local destination could not be opened.');
          return;
        }
        const health = await storageRouter.checkHealth(id, { refresh: true });
        if (health.state === 'ok') {
          storageRouter.updateDestinationState(id, 'ready');
        }
        refresh();
        router.replace({ pathname: '/storage/destination/[id]', params: { id } });
      } catch (error) {
        refresh();
        Alert.alert('This device', error instanceof Error ? error.message : 'Could not connect this device.');
      } finally {
        releaseConnectSlot();
      }
    })();
  }, [db, storageRouter, refresh, takeConnectSlot, releaseConnectSlot]);

  const connectCredentialDestination = useCallback(() => {
    if (credentialKind === null) return;
    if (!takeConnectSlot(credentialKind)) return;
    void (async () => {
      const id = `${credentialKind}-${Crypto.randomUUID()}`;
      const credentialRef = createMobileStorageCredentialRef(id);
      let registered = false;
      try {
        const rootRef = credentialKind === 'webdav'
          ? serializeCredentialDestinationConfig({ kind: 'webdav', baseUrl: endpoint.trim() })
          : credentialKind === 's3' ? serializeCredentialDestinationConfig({
            kind: 's3', endpoint: endpoint.trim(), bucket: bucket.trim(), region: region.trim(),
          }) : serializeCredentialDestinationConfig({
            kind: 'connected_server',
            descriptorUrl: endpoint.trim(),
            operatorPublicKey: operatorPublicKey.trim().toLowerCase(),
          });
        const credentialJson = credentialKind === 'webdav'
          ? serializeWebdavCredentials({ username: username.trim(), password })
          : credentialKind === 's3' ? serializeS3Credentials({
            accessKeyId: accessKeyId.trim(),
            secretAccessKey,
            ...(sessionToken.trim() ? { sessionToken: sessionToken.trim() } : {}),
          }) : password;
        await writeMobileStorageSecret(credentialRef, credentialJson);
        const adapter = registry.resolve({ id, kind: credentialKind, credentialRef, rootRef });
        if (adapter === null) throw new Error(`${credentialKind === 'webdav'
          ? 'WebDAV' : credentialKind === 's3' ? 'S3' : 'Connected server'} is unavailable in this build.`);
        const authorization = await adapter.authorize({ kind: 'stored_credential', credentialRef });
        if (authorization.kind !== 'authorized') throw new Error('The destination rejected these credentials.');
        await verifyStorageReadWrite(adapter, Crypto.randomUUID());
        storageRouter.registerDestination({
          id,
          kind: credentialKind,
          label: label.trim() || (credentialKind === 'webdav'
            ? 'WebDAV' : credentialKind === 's3' ? 'S3' : 'Connected server'),
          credentialRef,
          rootRef,
          capabilities: await adapter.capabilities(),
        });
        registered = true;
        const health = await storageRouter.checkHealth(id, { refresh: true });
        if (health.state !== 'ok' && health.state !== 'degraded') {
          throw new Error('The destination did not pass its health check.');
        }
        storageRouter.updateDestinationState(id, health.state === 'ok' ? 'ready' : 'degraded');
        setPassword('');
        setSecretAccessKey('');
        setSessionToken('');
        refresh();
        router.replace({ pathname: '/storage/destination/[id]', params: { id } });
      } catch (error) {
        if (!registered) await deleteMobileStorageSecret(credentialRef).catch(() => undefined);
        refresh();
        Alert.alert('Connect destination', error instanceof Error ? error.message : 'Could not connect this destination.');
      } finally {
        releaseConnectSlot();
      }
    })();
  }, [accessKeyId, bucket, credentialKind, endpoint, label, operatorPublicKey, password, refresh,
    region, registry, secretAccessKey, sessionToken, storageRouter, username, takeConnectSlot, releaseConnectSlot]);

  const connectHosted = useCallback(() => {
    if (!takeConnectSlot('hosted_storage')) return;
    void (async () => {
      try {
        const id = `hosted-${Crypto.randomUUID()}`;
        const credentialRef = 'hosted://device';
        const adapter = registry.resolve({ id, kind: 'hosted_storage', credentialRef });
        if (adapter === null) throw new Error('Hosted storage is not configured in this build.');
        const authorization = await adapter.authorize({ kind: 'interactive', credentialRef });
        if (authorization.kind !== 'authorized') throw new Error('Hosted storage authorization did not complete.');
        await verifyStorageReadWrite(adapter, Crypto.randomUUID());
        storageRouter.registerDestination({
          id,
          kind: 'hosted_storage',
          label: 'Meerkat hosted storage',
          credentialRef,
          capabilities: await adapter.capabilities(),
        });
        await storageRouter.checkHealth(id, { refresh: true });
        refresh();
        router.replace({ pathname: '/storage/destination/[id]', params: { id } });
      } catch (error) {
        refresh();
        Alert.alert('Hosted storage', error instanceof Error ? error.message : 'Could not connect hosted storage.');
      } finally {
        releaseConnectSlot();
      }
    })();
  }, [refresh, registry, storageRouter, takeConnectSlot, releaseConnectSlot]);

  const connectOAuth = useCallback((row: StorageAddDestinationRow) => {
    if (row.kind !== 'google_drive' && row.kind !== 'dropbox'
      && row.kind !== 'onedrive' && row.kind !== 'box') return;
    const kind = row.kind;
    if (!takeConnectSlot(kind)) return;
    void (async () => {
      let adapter: ReturnType<typeof registry.resolve> = null;
      try {
        const id = `${kind}-${Crypto.randomUUID()}`;
        const connected = await connectOAuthDestination(kind, id);
        adapter = registry.resolve({ id, kind, credentialRef: connected.credentialRef });
        if (adapter === null) throw new Error(`${row.name} is unavailable in this build.`);
        const authorization = await adapter.authorize({
          kind: 'stored_credential',
          credentialRef: connected.credentialRef,
        });
        if (authorization.kind !== 'authorized') throw new Error(`${row.name} did not authorize storage access.`);
        await verifyStorageReadWrite(adapter, Crypto.randomUUID());
        storageRouter.registerDestination({
          id,
          kind,
          label: row.name,
          accountHint: connected.accountHint,
          credentialRef: connected.credentialRef,
          capabilities: await adapter.capabilities(),
        });
        const health = await storageRouter.checkHealth(id, { refresh: true });
        storageRouter.updateDestinationState(id, health.state === 'ok' ? 'ready' : 'degraded');
        refresh();
        router.replace({ pathname: '/storage/destination/[id]', params: { id } });
      } catch (error) {
        await adapter?.revoke({ deleteRemoteData: false }).catch(() => undefined);
        refresh();
        Alert.alert(row.name, error instanceof Error ? error.message : `Could not connect ${row.name}.`);
      } finally {
        releaseConnectSlot();
      }
    })();
  }, [connectOAuthDestination, refresh, registry, storageRouter, takeConnectSlot, releaseConnectSlot]);

  const onConnect = useCallback((row: StorageAddDestinationRow) => {
    if (row.kind === 'local_device') {
      connectLocal();
      return;
    }
    if (row.kind === 'webdav' || row.kind === 's3' || row.kind === 'connected_server') {
      setCredentialKind(row.kind);
      setLabel(row.name);
      return;
    }
    if (row.kind === 'hosted_storage') {
      connectHosted();
      return;
    }
    if (row.flow === 'oauth_token') {
      connectOAuth(row);
      return;
    }
    // Every other supported flow needs its provider registration / native module
    // wired for this build. Surface the honest next step rather than faking a
    // connection: founder-ops provisions the real OAuth clients and native build.
    Alert.alert(
      row.name,
      `${FLOW_HINT[row.flow]}\n\nThis connect flow is not available to complete in this build yet. Connecting it needs its provider setup or a signed build.`,
    );
  }, [connectHosted, connectLocal, connectOAuth]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 96 }]}
    >
      <StorageHeader title={STORAGE_UI_COPY.addDestinationTitle} subtitle="Choose where an encrypted copy is kept" />
      <HonestNotice text={STORAGE_UI_COPY.encryptBeforeLeaving} />
      {credentialKind ? (
        <View style={styles.form}>
          <Text style={styles.formTitle}>Connect {credentialKind === 'webdav' ? 'WebDAV' : credentialKind === 's3' ? 'S3' : 'a server'}</Text>
          <TextInput style={styles.input} value={label} onChangeText={setLabel} placeholder="Destination name" autoCapitalize="words" />
          <TextInput style={styles.input} value={endpoint} onChangeText={setEndpoint} placeholder={credentialKind === 'webdav' ? 'https://dav.example.com/' : credentialKind === 's3' ? 'https://s3.example.com/' : 'https://storage.example.com/api/storage/v1/descriptor'} autoCapitalize="none" autoCorrect={false} />
          {credentialKind === 'webdav' ? (
            <>
              <TextInput style={styles.input} value={username} onChangeText={setUsername} placeholder="Username" autoCapitalize="none" autoCorrect={false} />
              <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry autoCapitalize="none" autoCorrect={false} />
            </>
          ) : credentialKind === 's3' ? (
            <>
              <TextInput style={styles.input} value={bucket} onChangeText={setBucket} placeholder="Bucket" autoCapitalize="none" autoCorrect={false} />
              <TextInput style={styles.input} value={region} onChangeText={setRegion} placeholder="Region, for example us-east-1" autoCapitalize="none" autoCorrect={false} />
              <TextInput style={styles.input} value={accessKeyId} onChangeText={setAccessKeyId} placeholder="Access key ID" autoCapitalize="none" autoCorrect={false} />
              <TextInput style={styles.input} value={secretAccessKey} onChangeText={setSecretAccessKey} placeholder="Secret access key" secureTextEntry autoCapitalize="none" autoCorrect={false} />
              <TextInput style={styles.input} value={sessionToken} onChangeText={setSessionToken} placeholder="Session token, if required" secureTextEntry autoCapitalize="none" autoCorrect={false} />
            </>
          ) : (
            <>
              <TextInput style={styles.input} value={operatorPublicKey} onChangeText={setOperatorPublicKey} placeholder="Pinned operator public key (64 hex characters)" autoCapitalize="none" autoCorrect={false} />
              <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Server access token" secureTextEntry autoCapitalize="none" autoCorrect={false} />
            </>
          )}
          <Button title={busyKind === credentialKind ? 'Connecting...' : 'Connect and verify'} onPress={connectCredentialDestination} disabled={busyKind !== null} />
          <Button title="Cancel" variant="secondary" onPress={() => setCredentialKind(null)} disabled={busyKind !== null} />
          <HonestNotice text="Credentials are stored in this device’s secure storage. Meerkat writes a temporary object, reads it back, and deletes it before marking the destination ready." />
        </View>
      ) : null}
      <View style={styles.panel}>
        {rows.map((row) => (
          <DestinationChoice
            key={row.kind}
            row={row}
            busy={busyKind === row.kind}
            onConnect={() => onConnect(row)}
          />
        ))}
      </View>
      <HonestNotice text={STORAGE_UI_COPY.hostedNotDefault} />
    </ScrollView>
  );
}

function DestinationChoice({
  row,
  busy,
  onConnect,
}: {
  row: StorageAddDestinationRow;
  busy: boolean;
  onConnect: () => void;
}): React.ReactElement {
  const styles = useMkStyles(makeStyles);
  return (
    <View style={styles.choice}>
      <View style={styles.choiceText}>
        <Text style={styles.choiceName}>{row.name}</Text>
        <Text style={styles.choiceBlurb}>{row.blurb}</Text>
        {!row.supported && row.unavailableReason ? (
          <View style={styles.unavailableRow}>
            <StatusChip label="Not available here" tone="muted" />
            <Text style={styles.unavailableText}>{row.unavailableReason}</Text>
          </View>
        ) : null}
      </View>
      {row.supported ? (
        <Button
          title={busy ? 'Connecting...' : 'Connect'}
          variant="secondary"
          onPress={onConnect}
          disabled={busy}
        />
      ) : null}
    </View>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: 16, gap: 14 },
  panel: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 8,
  },
  form: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 16,
    gap: 10,
  },
  formTitle: { color: c.text, fontSize: 16, fontWeight: '800' },
  input: {
    minHeight: 44,
    backgroundColor: c.surfaceElevated,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    paddingHorizontal: 12,
    color: c.text,
  },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderBottomColor: c.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  choiceText: { flex: 1, minWidth: 0, gap: 4 },
  choiceName: { color: c.text, fontSize: 15, fontWeight: '700' },
  choiceBlurb: { color: c.textSecondary, fontSize: 12.5, lineHeight: 18 },
  unavailableRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  unavailableText: { flex: 1, minWidth: 0, color: c.textTertiary, fontSize: 12, lineHeight: 17 },
});
