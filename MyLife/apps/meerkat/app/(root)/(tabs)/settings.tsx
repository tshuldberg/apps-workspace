import { HostedRelayAccessCard } from '../components/HostedRelayAccessCard';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Check, X } from 'lucide-react-native';
import {
  hasConfiguredSyncSecretStore,
  deleteStorageAccountData,
  generateRecoveryKey,
  exportRecoverableIdentity,
  sealRecovery,
  type PinClass,
} from '@mylife/sync';
import { useNode } from '../providers/NodeProvider';
import { useIdentity } from '../providers/IdentityProvider';
import { useSync } from '../providers/SyncProvider';
import { OwnDeviceLinkCard } from '../components/OwnDeviceLinkCard';
import { useMeerkatDatabase } from '../providers/DatabaseProvider';
import { clearNativeIdentitySecret } from '../data/meerkat-db';
import { DELETE_MY_DATA_COPY, hasPublicPersonaRecord, runDeleteMyData } from '../data/delete-account-core';
import { teardownPushWake } from '../data/push-wake-boot';
import { ExpoBlobStore } from '../data/expo-blob-store';
import {
  personaServiceConfig,
  requestPersonaDeletion,
} from '../data/persona-core';
import { Button, CopyRow, HonestNotice, Mono, SectionHeader } from '../components/kit';
import { DeviceLayoutSection } from '../components/DeviceLayoutSection';
import { AccountSection } from '../components/AccountSection';
import {
  DEFAULT_RELAY_OPTOUT_KEY,
  getSetting,
  isLinkPreviewsEnabled,
  setLinkPreviewsEnabled,
  setSetting,
} from '../data/db';
import { DEFAULT_RELAY_URL, PUBLIC_DIRECTORY_URL_SETTING, RELAY_URL_SETTING_KEY } from '../data/sync-core';
import {
  getLastBackgroundRunAt,
  isBackgroundSyncEnabled,
  runBackgroundSyncOnce,
  setBackgroundSyncEnabled,
} from '../data/background-sync';
import {
  registerBackgroundSync,
  unregisterBackgroundSync,
} from '../data/background-task-registration';
import {
  buildAlphaDiagnostics,
  buildAlphaReadinessItems,
  type AlphaReadinessItem,
  type AlphaReadinessState,
} from '../data/alpha-readiness';
import {
  buildHostedBoundaryItems,
  type HostedBoundaryItem,
  type HostedBoundaryState,
} from '../data/hosted-boundaries';
import { buildNativeTransportRungs } from '../data/transport-backends';
import { deviceStorageMeter, setStorageBudget, type DeviceStorageMeter } from '../data/library-store-core';
import {
  STORAGE_BUDGET_PRESETS,
  STORAGE_BUDGET_EXCEEDED_ERROR,
  PIN_CLASS_LABEL,
} from '../data/library-storage-core';
import { type MkColors, MK_MONO, MK_RADIUS, formatBytes, shortHex } from '../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../providers/AppThemeProvider';
import { useStorage } from '../providers/StorageProvider';
import { deleteMobileStorageSecret } from '../data/storage-destinations/credential-store';
import { createMobileStorageAccountRemote } from '../data/storage-destinations/storage-account-delete';

interface TransportRung {
  name: string;
  detail: string;
}

const TRANSPORT_RUNGS: TransportRung[] = [
  { name: 'Connection server', detail: 'Live (manual)' },
  { name: 'LAN (Wi-Fi)', detail: 'Live (manual, dev build)' },
  { name: 'Background sync', detail: 'On-demand drain live; scheduled pending' },
];

export default function SettingsScreen() {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const db = useMeerkatDatabase();
  const { registry: storageRegistry } = useStorage();
  const {
    stats,
    store,
    clearAll,
    getSaveDestination,
    chooseSaveDestination,
    clearSaveDestination,
  } = useNode();
  const { identity, restoreIdentity, resetIdentity } = useIdentity();
  const blobStore = useMemo(() => new ExpoBlobStore(db), [db]);
  const {
    status,
    pairedDevices,
    sessions,
    rungStats,
    isPeerSasVerified,
    dataTransportAvailability,
    autoConnectEnabled,
    setAutoConnect,
  } = useSync();
  // Real availability of the native rungs (WebRTC / Nearby / BLE wake). Each row
  // shows "Available (dev build)" only when its real native backend loaded on
  // this build, else the honest "Not available on this build" (NC-11 / L8).
  const nativeRungs = useMemo(
    () => buildNativeTransportRungs(dataTransportAvailability),
    [dataTransportAvailability],
  );
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [meter, setMeter] = useState<DeviceStorageMeter | null>(null);
  const [meterError, setMeterError] = useState(false);
  const refreshMeter = useCallback(() => {
    // store.stats() walks the filesystem and can reject; without the catch the
    // panel reads "Reading storage..." forever.
    void deviceStorageMeter(db, store)
      .then((m) => { setMeter(m); setMeterError(false); })
      .catch(() => setMeterError(true));
  }, [db, store]);
  useEffect(() => { refreshMeter(); }, [refreshMeter, stats.totalBytes]);
  const budgetBusyRef = useRef(false);
  const [budgetBusy, setBudgetBusy] = useState(false);
  const onPickBudget = useCallback((bytes: number | null) => {
    if (budgetBusyRef.current) return;
    budgetBusyRef.current = true;
    setBudgetBusy(true);
    void (async () => {
      try {
        // runLibraryEviction deletes cached files and can reject; a silent
        // throw would leave the tapped chip looking applied when it was not.
        const plan = await setStorageBudget(db, store, bytes);
        if (plan.impossible) Alert.alert('Storage budget', STORAGE_BUDGET_EXCEEDED_ERROR);
      } catch {
        Alert.alert('Storage budget', 'The budget change could not be applied. Try again.');
      } finally {
        budgetBusyRef.current = false;
        setBudgetBusy(false);
        refreshMeter();
      }
    })();
  }, [db, store, refreshMeter]);
  const [recovery, setRecovery] = useState<{ key: string; sealed: string } | null>(null);
  const [restoreKey, setRestoreKey] = useState('');
  const [restoreBackup, setRestoreBackup] = useState('');
  const [restoreStatus, setRestoreStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [bgRunning, setBgRunning] = useState(false);
  const [bgStatus, setBgStatus] = useState<string | null>(null);
  const [bgEnabled, setBgEnabledState] = useState(() => isBackgroundSyncEnabled(db));
  const [lastBgRun, setLastBgRun] = useState<string | null>(() => getLastBackgroundRunAt(db));
  const [saveDir, setSaveDir] = useState<string | null>(() => getSaveDestination());
  const [saveDirStatus, setSaveDirStatus] = useState<string | null>(null);
  const [directoryUrl, setDirectoryUrl] = useState<string>(
    () => getSetting(db, PUBLIC_DIRECTORY_URL_SETTING) ?? '',
  );
  const [directoryStatus, setDirectoryStatus] = useState<string | null>(null);
  // Free default connection server opt-out (Plan 20). Only meaningful when a
  // default is configured for this build; effectiveRelayUrl(db) reads this key
  // so turning it off makes the app stop dialing the free default (AC-4).
  const [defaultOptedOut, setDefaultOptedOut] = useState(() => getSetting(db, DEFAULT_RELAY_OPTOUT_KEY) === '1');
  const onToggleDefaultOptOut = useCallback(() => {
    const next = !defaultOptedOut;
    setSetting(db, DEFAULT_RELAY_OPTOUT_KEY, next ? '1' : '0');
    setDefaultOptedOut(next);
  }, [db, defaultOptedOut]);

  // Link-preview generation (Plan 32 T3.2), device-local, default ON. When on,
  // sending a message with a URL fetches that page ON THIS device to build a
  // preview attachment; receivers never fetch.
  const [linkPreviews, setLinkPreviews] = useState(() => isLinkPreviewsEnabled(db));
  const onToggleLinkPreviews = useCallback(() => {
    const next = !linkPreviews;
    setLinkPreviewsEnabled(db, next);
    setLinkPreviews(next);
  }, [db, linkPreviews]);
  const isAndroid = Platform.OS === 'android';

  const onSaveDirectoryUrl = useCallback(() => {
    const next = directoryUrl.trim();
    setSetting(db, PUBLIC_DIRECTORY_URL_SETTING, next);
    setDirectoryStatus(
      next
        ? 'Saved. Open Discover to browse public communities from this directory host.'
        : 'Cleared. Public browsing stays off until a directory host is set.',
    );
  }, [db, directoryUrl]);

  const secretStoreReady = hasConfiguredSyncSecretStore();
  const relayUrl = getSetting(db, RELAY_URL_SETTING_KEY);
  const verifiedPeerCount = useMemo(
    () => pairedDevices.filter((device) => isPeerSasVerified(device.deviceId)).length,
    [pairedDevices, isPeerSasVerified],
  );
  const completedSessionCount = useMemo(
    () => sessions.filter((session) => session.status === 'completed').length,
    [sessions],
  );
  const hostedBoundaryItems = useMemo(
    () => buildHostedBoundaryItems({
      relayUrl,
      localStorageLabel: formatBytes(stats.totalBytes),
    }),
    [relayUrl, stats.totalBytes],
  );
  const readinessItems = useMemo(
    () => buildAlphaReadinessItems({
      relayUrl,
      pairedDeviceCount: pairedDevices.length,
      verifiedPeerCount,
      completedSessionCount,
      pendingChanges: status.pendingChanges,
      // Android needs a real persisted folder; iOS always has the share sheet.
      fileSaveDestinationConfigured: isAndroid ? saveDir !== null : true,
      platformOS: Platform.OS,
    }),
    [
      relayUrl,
      pairedDevices.length,
      verifiedPeerCount,
      completedSessionCount,
      status.pendingChanges,
      isAndroid,
      saveDir,
    ],
  );
  const buildDiagnosticsSnapshot = useCallback(
    () => buildAlphaDiagnostics({
      generatedAt: new Date().toISOString(),
      deviceName: identity.displayName,
      deviceShortId: shortHex(identity.publicKey),
      engineState: status.state,
      relayUrl,
      pairedDeviceCount: pairedDevices.length,
      verifiedPeerCount,
      recentSessionCount: sessions.length,
      completedSessionCount,
      pendingChanges: status.pendingChanges,
      fileSaveDestinationConfigured: isAndroid ? saveDir !== null : true,
      platformOS: Platform.OS,
      rungSummaries: rungStats.map((rung) => `${rung.transport} ${rung.successes}/${rung.attempts}`),
      pinnedCount: stats.manifestCount,
      blockCount: stats.blockCount,
      storedBytes: formatBytes(stats.totalBytes),
    }),
    [
      identity.displayName,
      identity.publicKey,
      status.state,
      status.pendingChanges,
      relayUrl,
      pairedDevices.length,
      verifiedPeerCount,
      sessions.length,
      completedSessionCount,
      isAndroid,
      saveDir,
      rungStats,
      stats.manifestCount,
      stats.blockCount,
      stats.totalBytes,
    ],
  );

  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoveryCopyStatus, setRecoveryCopyStatus] = useState<string | null>(null);
  const onGenerateRecovery = useCallback(() => {
    // exportRecoverableIdentity reads the private key from secure storage and
    // THROWS when it is unavailable (an orphaned identity); without the catch
    // the tap crashes or silently does nothing.
    try {
      const { key, bytes } = generateRecoveryKey();
      const sealed = sealRecovery(exportRecoverableIdentity(identity), bytes);
      setRecovery({ key, sealed });
      setRecoveryError(null);
    } catch {
      setRecoveryError(
        'The recovery key could not be created because this device\'s identity key could not be read from secure storage. Nothing was generated.',
      );
    }
  }, [identity]);

  const copyRecoveryValue = useCallback((value: string, doneText: string) => {
    void Clipboard.setStringAsync(value)
      .then(() => setRecoveryCopyStatus(doneText))
      .catch(() => setRecoveryCopyStatus('Copy failed. Nothing was copied to the clipboard; try again.'));
  }, []);

  // Restore this device's identity from a recovery key + its encrypted backup.
  // Confirmed first: restore REPLACES the current identity on this device (the
  // current one, and anything sealed only under it, is discarded).
  const onRestoreIdentity = useCallback(() => {
    if (!restoreKey.trim() || !restoreBackup.trim()) return;
    Alert.alert(
      'Restore identity',
      'This replaces the identity on this device with the one in your backup. The current identity, and anything sealed only under it, will be discarded. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: () => {
            const result = restoreIdentity(restoreKey, restoreBackup);
            if (result.ok) {
              setRestoreKey('');
              setRestoreBackup('');
              setRestoreStatus({ ok: true, text: 'Identity restored. Your device id, pins, and pairings are back; synced data re-flows as you reconnect with peers.' });
            } else {
              setRestoreStatus({
                ok: false,
                text: result.reason === 'bad_key'
                  ? 'That recovery key is not valid. Check for typos; it starts with MKR1.'
                  : 'That backup could not be opened with this key. The key may be wrong, or the backup may be corrupt or from a different identity.',
              });
            }
          },
        },
      ],
    );
  }, [restoreIdentity, restoreKey, restoreBackup]);

  const [diagnosticsStatus, setDiagnosticsStatus] = useState<string | null>(null);
  const onCopyDiagnostics = useCallback(() => {
    // Success is claimed only after the clipboard write resolves; a rejection
    // renders instead of a silent dead tap.
    void Clipboard.setStringAsync(buildDiagnosticsSnapshot())
      .then(() => setDiagnosticsStatus('Diagnostics copied to the clipboard.'))
      .catch(() => setDiagnosticsStatus('Copy failed. Nothing was copied to the clipboard; try again.'));
  }, [buildDiagnosticsSnapshot]);

  // Run the real headless background path on demand (no scheduler). This is the
  // honest, always-on QA hook for runBackgroundSyncOnce: it drains queued
  // messages exactly as a scheduled/push run would, and reports only what it
  // actually applied.
  const onRunBackgroundSyncNow = useCallback(() => {
    setBgRunning(true);
    setBgStatus(null);
    void (async () => {
      try {
        const result = await runBackgroundSyncOnce();
        if (!result.ran) {
          setBgStatus(result.reason ?? 'No relay configured; nothing to drain.');
        } else if (result.applied > 0) {
          setBgStatus(
            result.applied === 1
              ? 'Applied 1 new message from the mailbox.'
              : `Applied ${result.applied} new messages from the mailbox.`,
          );
        } else {
          setBgStatus('Drain ran. No new messages were queued.');
        }
        setLastBgRun(getLastBackgroundRunAt(db));
      } catch (err) {
        setBgStatus(err instanceof Error ? err.message : String(err));
      } finally {
        setBgRunning(false);
      }
    })();
  }, [db]);

  // Dev-build flag (default OFF). Toggling on registers the OS-scheduled drain
  // when the native modules are present; on Expo Go it stays off with honest copy.
  const onToggleBackgroundSync = useCallback(() => {
    void (async () => {
      const next = !bgEnabled;
      if (next) {
        const registration = await registerBackgroundSync();
        if (!registration.registered) {
          setBgStatus(registration.reason ?? 'Background sync is not available in this build.');
          return; // leave the flag OFF: never claim it runs when it does not
        }
        setBackgroundSyncEnabled(db, true);
        setBgEnabledState(true);
        setBgStatus('Best-effort background mailbox drain registered. The OS decides when it runs.');
      } else {
        await unregisterBackgroundSync();
        setBackgroundSyncEnabled(db, false);
        setBgEnabledState(false);
        setBgStatus('Background mailbox drain unregistered.');
      }
    })();
  }, [bgEnabled, db]);

  const onChooseSaveFolder = useCallback(() => {
    void (async () => {
      setSaveDirStatus(null);
      try {
        const chosen = await chooseSaveDestination();
        if (chosen) {
          setSaveDir(chosen);
          setSaveDirStatus('Default save folder set. Downloaded files write there and are verified on disk.');
        } else {
          setSaveDirStatus('Folder selection was cancelled. No default folder is set.');
        }
      } catch {
        // The SAF picker is a native seam and can reject; nothing was changed.
        setSaveDirStatus('The folder picker could not be opened. No default folder was changed; try again.');
      }
    })();
  }, [chooseSaveDestination]);

  const onClearSaveFolder = useCallback(() => {
    clearSaveDestination();
    setSaveDir(null);
    setSaveDirStatus('Default save folder cleared. You will be asked to pick one the next time you save.');
  }, [clearSaveDestination]);

  const confirmClear = useCallback(() => {
    Alert.alert(
      'Clear local file storage',
      'This removes all saved shared content on this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear storage',
          style: 'destructive',
          onPress: () => {
            setClearing(true);
            setClearError(null);
            void clearAll()
              .catch(() => setClearError('Local storage could not be fully cleared. Try again.'))
              .finally(() => setClearing(false));
          },
        },
      ],
    );
  }, [clearAll]);

  const confirmResetIdentity = useCallback(() => {
    Alert.alert(
      'Reset identity',
      'This generates a brand new device identity and friend code. Anything sealed under your current key will no longer show you as the author. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset identity',
          style: 'destructive',
          onPress: () => resetIdentity(),
        },
      ],
    );
  }, [resetIdentity]);

  // B.2: the consolidated "Delete my data" flow. Composes the existing wipes into
  // one auditable action and returns the app to a clean first-run. Best-effort +
  // idempotent: a failed step leaves nothing partial and can be re-run.
  const confirmDeleteMyData = useCallback(() => {
    const runDeletion = (deleteRemoteStorageData: boolean): void => {
      setDeleting(true);
      setDeleteError(null);
      void (async () => {
        try {
          // Plan 42 P5: revoke the push-wake registration and discard the
          // local handle/token before the local wipe.
          await teardownPushWake(db);
          const remoteStorage = createMobileStorageAccountRemote(identity);
          const result = await runDeleteMyData({
            db,
            identityPrivateKeyRef: identity.privateKeyRef,
            hasPublicPersona: hasPublicPersonaRecord(db),
            deleteRemotePersona: () => requestPersonaDeletion(db, personaServiceConfig()),
            deleteStorageData: () => deleteStorageAccountData({
              db,
              deleteRemoteData: deleteRemoteStorageData,
              resolveAdapter: storageRegistry.resolveRouterDestination,
              deleteBrokerVault: remoteStorage.deleteBrokerVault,
              deleteHostedAccount: remoteStorage.deleteHostedAccount,
              deleteCredential: deleteMobileStorageSecret,
              now: () => new Date().toISOString(),
            }),
            clearNodeBytes: clearAll,
            clearBlobBytes: () => blobStore.clearAll(),
            deleteSecret: clearNativeIdentitySecret,
            createFreshIdentity: resetIdentity,
          });
          if (!result.ok) throw new Error(result.reason);
        } catch (err) {
          setDeleteError(err instanceof Error ? err.message : DELETE_MY_DATA_COPY.errorRetry);
        } finally {
          setDeleting(false);
        }
      })();
    };
    Alert.alert(
      DELETE_MY_DATA_COPY.confirmTitle,
      DELETE_MY_DATA_COPY.confirmBody,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: DELETE_MY_DATA_COPY.confirmAction,
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Delete encrypted backup objects?',
              'Both choices revoke every destination and delete local credentials. Choose whether each adapter should also delete the encrypted backup objects it can reach.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Keep backup objects', onPress: () => runDeletion(false) },
                { text: 'Delete backup objects', style: 'destructive', onPress: () => runDeletion(true) },
              ],
            );
          },
        },
      ],
    );
  }, [blobStore, db, identity, clearAll, resetIdentity, storageRegistry]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
    >
      <Text style={styles.title}>Settings</Text>
      <DeviceLayoutSection />

      <View style={styles.panel}>
        <SectionHeader title="Secure storage" />
        <View style={styles.statusLine}>
          {secretStoreReady ? (
            <Check size={18} color={c.success} strokeWidth={2.5} />
          ) : (
            <X size={18} color={c.danger} strokeWidth={2.5} />
          )}
          <Text style={styles.statusLineText}>
            {secretStoreReady
              ? 'Identity keys are stored in the device keychain.'
              : 'Secure key storage is not configured.'}
          </Text>
        </View>
      </View>

      <View style={styles.panel}>
        <SectionHeader title="Local file storage" />
        <View style={styles.statsRow}>
          <Stat label="Pinned" value={String(stats.manifestCount)} />
          <Stat label="Blocks" value={String(stats.blockCount)} />
          <Stat label="Stored" value={formatBytes(stats.totalBytes)} />
        </View>
        <Button
          title={clearing ? 'Clearing...' : 'Clear local storage'}
          variant="danger"
          onPress={confirmClear}
          disabled={clearing || stats.manifestCount === 0}
        />
        {clearError ? <Text style={styles.deleteError}>{clearError}</Text> : null}
      </View>

      <View style={styles.panel}>
        <SectionHeader
          title="Storage & Backup"
          hint="Choose where an encrypted copy of your data is kept and verified"
        />
        <Button title="Open Storage & Backup" onPress={() => router.push('/storage')} />
        <HonestNotice text="Add a destination you control (this device, a cloud drive, your own server) and Meerkat keeps an encrypted copy there. Nothing is backed up until a destination verifies a copy." />
      </View>

      <View style={styles.panel}>
        <SectionHeader
          title="Storage budget"
          hint="A device-wide cap. Only cached items you have not kept are removed to stay under it."
        />
        <View style={styles.budgetChips}>
          {STORAGE_BUDGET_PRESETS.map((preset) => {
            const selected = (meter?.budgetBytes ?? null) === preset.bytes;
            return (
              <Pressable
                key={preset.label}
                onPress={() => onPickBudget(preset.bytes)}
                disabled={budgetBusy}
                style={[styles.budgetChip, selected && styles.budgetChipOn, budgetBusy && { opacity: 0.6 }]}
              >
                <Text style={[styles.budgetChipText, selected && styles.budgetChipTextOn]}>{preset.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.aboutText}>
          {meter
            ? `Using ${formatBytes(meter.storedBytes)}${meter.budgetBytes !== null ? ` of ${formatBytes(meter.budgetBytes)}` : ' (no cap)'}.`
            : meterError
              ? 'Storage usage could not be read. Reopen this screen to try again.'
              : 'Reading storage...'}
        </Text>
        {meter ? (
          <View>
            {(Object.keys(meter.breakdown) as PinClass[]).map((cls) => {
              const row = meter.breakdown[cls];
              if (row.count === 0) return null;
              return (
                <View key={cls} style={styles.rungRow}>
                  <Text style={styles.rungName}>{PIN_CLASS_LABEL[cls]}</Text>
                  <Text style={styles.aboutText}>{row.count} · {formatBytes(row.bytes)}</Text>
                </View>
              );
            })}
          </View>
        ) : null}
        <HonestNotice text="Your own items and anything you Keep on this device are never removed to fit the budget. If they alone are larger than the budget, Meerkat says so and removes nothing further." />
      </View>

      <View style={styles.panel}>
        <SectionHeader title="Hosted services" hint="What is local today versus paid hosted infrastructure" />
        {hostedBoundaryItems.filter((item) => item.id !== 'hosted_relay').map((item) => (
          <HostedBoundaryRow key={item.id} item={item} />
        ))}
        <HostedRelayAccessCard />
        <HonestNotice text="The $4.99 app covers private local use, and a connection server is a free zero-knowledge meeting point. Hosted backup, public reach, always-on community history, extra hosted connection capacity, and hosted file storage are paid services only when they are actually connected." />
        <Button title="Unlock Meerkat" variant="secondary" onPress={() => router.push('/upgrade')} />
      </View>

      <View style={styles.panel}>
        <SectionHeader title="Connection options" hint="How encrypted data moves between devices" />
        {TRANSPORT_RUNGS.map((rung) => (
          <View key={rung.name} style={styles.rungRow}>
            <Text style={styles.rungName}>{rung.name}</Text>
            <View style={styles.pendingPill}>
              <Text style={styles.pendingPillText}>{rung.detail}</Text>
            </View>
          </View>
        ))}
        {nativeRungs.map((rung) => (
          <View key={rung.id} style={styles.rungRow}>
            <Text style={styles.rungName}>{rung.name}</Text>
            <View
              style={[
                styles.pendingPill,
                { borderColor: rung.available ? c.success : c.border, borderWidth: StyleSheet.hairlineWidth },
              ]}
            >
              <Text
                style={[
                  styles.pendingPillText,
                  { color: rung.available ? c.success : c.textTertiary },
                ]}
              >
                {rung.detail}
              </Text>
            </View>
          </View>
        ))}
        <View style={styles.rungRow}>
          <Text style={styles.rungName}>Transport diagnostics</Text>
          <Button
            title="View"
            variant="secondary"
            onPress={() => router.push('/transport-diagnostics')}
          />
        </View>
        <View style={styles.rungRow}>
          <Text style={styles.rungName}>
            {autoConnectEnabled ? 'Automatic connections: on' : 'Automatic connections: off'}
          </Text>
          <Button
            title={autoConnectEnabled ? 'Turn off' : 'Turn on'}
            variant="secondary"
            onPress={() => setAutoConnect(!autoConnectEnabled)}
          />
        </View>
        <Button title="Open Sync" onPress={() => router.push('/sync')} />
        {DEFAULT_RELAY_URL.trim().length > 0 ? (
          <View style={styles.rungRow}>
            <Text style={styles.rungName}>
              {defaultOptedOut ? 'Free default server: off' : 'Free default server: on'}
            </Text>
            <Button
              title={defaultOptedOut ? 'Turn on' : 'Turn off'}
              variant="secondary"
              onPress={onToggleDefaultOptOut}
            />
          </View>
        ) : null}
        <Text style={{ color: c.textSecondary, fontSize: 13, lineHeight: 19 }}>
          Host your own server: run a free, zero-knowledge connection server (and a community) from
          your own desktop or laptop. Phones and browsers can't host. The one-tap Meerkat Host app and
          the deploy guide are how you'll do it.
        </Text>
        <HonestNotice text="Connection server and local Wi-Fi are live for manual sessions only. Pair two devices on the Sync screen, then run Listen + Sync now against the same server, or use local Wi-Fi from a development build. A connection server is a zero-knowledge meeting point; the paid tier ($4.99/mo) adds capacity, backup, public reach, and always-on history, not a different meeting point. Turning the free default off (above) makes the app stop using it. Direct peer-to-peer (WebRTC), Nearby, and Bluetooth wake are native transports that only exist in a development build; they read 'Not available on this build' here in Expo Go and are never dialed until their real native module is present. Bluetooth is a wake-up signal only and never carries file data. Automatic dialing of your paired devices while the app is open is an opt-in setting (Automatic connections on the Sync screen, off by default); scheduled background sync that runs while the app is closed is still pending." />
      </View>

      <OwnDeviceLinkCard />

      <View style={styles.panel}>
        <SectionHeader
          title="Public directory"
          hint="Where Discover browses public communities, channels, and forums"
        />
        <TextInput
          style={styles.directoryInput}
          value={directoryUrl}
          onChangeText={setDirectoryUrl}
          placeholder="wss://your-directory-host"
          placeholderTextColor={c.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          accessibilityLabel="Public directory host URL"
        />
        <Button title="Save directory host" variant="secondary" onPress={onSaveDirectoryUrl} />
        {directoryStatus ? <Text style={styles.aboutText}>{directoryStatus}</Text> : null}
        <HonestNotice text="Public viewing is free and needs no account. Paste a public directory host to browse and read public content in Discover. Leave it empty and the Public feed control stays hidden, since there is no real public source to read from yet." />
      </View>

      <View style={styles.panel}>
        <SectionHeader
          title="Background sync"
          hint="Best-effort drain of messages queued while this device was offline"
        />
        <Button
          title={bgRunning ? 'Running...' : 'Run background sync now'}
          variant="secondary"
          onPress={onRunBackgroundSyncNow}
          disabled={bgRunning}
        />
        <Button
          title={bgEnabled ? 'Disable scheduled background sync' : 'Enable scheduled background sync'}
          variant="secondary"
          onPress={onToggleBackgroundSync}
        />
        {bgStatus ? <Text style={styles.aboutText}>{bgStatus}</Text> : null}
        {lastBgRun ? (
          <Text style={styles.aboutText}>Last background run: {lastBgRun}</Text>
        ) : null}
        <HonestNotice text="Run background sync now drains messages a paired device parked for you while you were offline, opening only what verifies against your key. Scheduled background sync is a dev-build feature, off by default: when enabled, the OS runs the same drain best-effort on its own timing (not guaranteed). A live two-device handshake still needs both devices awake with the same phrase. Automatic dialing of paired devices while the app is open is a separate opt-in setting (Automatic connections on the Sync screen); this background-sync toggle never turns it on." />
      </View>

      <View style={styles.panel}>
        <SectionHeader
          title="Saved files"
          hint="Where downloaded attachments and decrypted content are written"
        />
        {isAndroid ? (
          <>
            <View style={styles.statusLine}>
              {saveDir ? (
                <Check size={18} color={c.success} strokeWidth={2.5} />
              ) : (
                <X size={18} color={c.warning} strokeWidth={2.5} />
              )}
              <Text style={styles.statusLineText}>
                {saveDir
                  ? 'A default folder is set. Saves are written there and verified on disk before they count as saved.'
                  : 'No default folder yet. Pick one so downloaded files land somewhere you can find them.'}
              </Text>
            </View>
            <Button
              title={saveDir ? 'Change default folder' : 'Choose default folder'}
              variant="secondary"
              onPress={onChooseSaveFolder}
            />
            {saveDir ? (
              <Button title="Clear default folder" variant="secondary" onPress={onClearSaveFolder} />
            ) : null}
          </>
        ) : (
          <View style={styles.statusLine}>
            <Check size={18} color={c.success} strokeWidth={2.5} />
            <Text style={styles.statusLineText}>
              Saving opens the iOS share sheet so you can send a file to Files or another app. iOS does
              not let an app confirm the final Files location, so we never claim one.
            </Text>
          </View>
        )}
        {saveDirStatus ? <Text style={styles.aboutText}>{saveDirStatus}</Text> : null}
        <Button title="Open Downloads" variant="secondary" onPress={() => router.push('/downloads')} />
        <HonestNotice text="Saving only writes already-decrypted bytes you explicitly export. Nothing here touches encrypted storage or a connection server. A file counts as saved only after the OS write is confirmed on disk; on iOS that means a verified temp file plus the open save sheet, not a guaranteed final location." />
      </View>

      <View style={styles.panel}>
        <SectionHeader
          title="Link previews"
          hint="Meerkat fetches the page you are sharing to build the preview. People who receive it never fetch anything."
        />
        <Button
          title={linkPreviews ? 'Generating link previews (on)' : 'Generate link previews (off)'}
          variant="secondary"
          onPress={onToggleLinkPreviews}
        />
        <HonestNotice text="When on, sending a message with a link fetches that page ON THIS device to build a small preview card, which travels with the message like any attachment. Turning it off sends the plain link text with no fetch. The people you send to never fetch the page themselves." />
      </View>


      <View style={styles.panel}>
        <SectionHeader
          title="Alpha test readiness"
          hint="Local setup checks for own-device, friend, and community transfer tests"
        />
        {readinessItems.map((item) => (
          <ReadinessRow key={item.id} item={item} />
        ))}
        <Button title="Copy diagnostics" variant="secondary" onPress={onCopyDiagnostics} />
        {diagnosticsStatus ? <Text style={styles.aboutText}>{diagnosticsStatus}</Text> : null}
        <HonestNotice text="Diagnostics include only short device ids and local counts. They do not include private keys, full connection server URLs, message bodies, file names, or share-link decrypt keys." />
      </View>

      <View style={styles.panel}>
        <SectionHeader title="Recovery key" hint="Restore your identity if you lose this device" />
        {recovery ? (
          <>
            <Text style={styles.fieldLabel}>Your recovery key (write it down, keep it offline)</Text>
            <Mono>{recovery.key}</Mono>
            <CopyRow
              label="Copy recovery key"
              onPress={() => copyRecoveryValue(recovery.key, 'Recovery key copied to the clipboard.')}
            />
            <Text style={styles.fieldLabel}>Encrypted identity backup (save anywhere)</Text>
            <CopyRow
              label="Copy encrypted backup"
              onPress={() => copyRecoveryValue(recovery.sealed, 'Encrypted backup copied to the clipboard.')}
            />
            {recoveryCopyStatus ? <Text style={styles.aboutText}>{recoveryCopyStatus}</Text> : null}
            <HonestNotice text="Anyone with the recovery key can impersonate you: treat it like a seed phrase. The encrypted backup is a local export, not cloud backup. Keep the key and the backup apart. To restore on a fresh install, paste both into Restore identity below. Hosted backup is a paid service and is not connected in this build." />
          </>
        ) : (
          <>
            <Button title="Generate recovery key" onPress={onGenerateRecovery} />
            {recoveryError ? <Text style={styles.deleteError}>{recoveryError}</Text> : null}
            <HonestNotice text="Creates a printable 256-bit key that encrypts a local export of your identity keys. It is not cloud backup. We never see it, and hosted backup is not connected in this build." />
          </>
        )}
      </View>

      <View style={styles.panel}>
        <SectionHeader title="Restore identity" hint="Bring back your identity on a new or wiped device" />
        <Text style={styles.fieldLabel}>Recovery key</Text>
        <TextInput
          style={styles.directoryInput}
          value={restoreKey}
          onChangeText={setRestoreKey}
          placeholder="MKR1-XXXXX-XXXXX-..."
          placeholderTextColor={c.textTertiary}
          autoCapitalize="characters"
          autoCorrect={false}
          accessibilityLabel="Recovery key"
        />
        <Text style={styles.fieldLabel}>Encrypted identity backup</Text>
        <TextInput
          style={[styles.directoryInput, { minHeight: 72 }]}
          value={restoreBackup}
          onChangeText={setRestoreBackup}
          placeholder="Paste the encrypted backup"
          placeholderTextColor={c.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          multiline
          accessibilityLabel="Encrypted identity backup"
        />
        <Button
          title="Restore identity"
          onPress={onRestoreIdentity}
          disabled={!restoreKey.trim() || !restoreBackup.trim()}
        />
        {restoreStatus ? (
          <Text style={[styles.aboutText, { color: restoreStatus.ok ? c.success : c.danger }]}>
            {restoreStatus.text}
          </Text>
        ) : null}
        <HonestNotice text="Restoring rebuilds the SAME identity from your recovery key and its encrypted backup: same device id, pins, and pairings. It replaces the identity on this device, so anything sealed only under the current identity is discarded. It restores identity keys, not your synced data; that re-flows from peers as you reconnect. A wrong key or a tampered backup fails closed and changes nothing." />
      </View>

      <View style={styles.panel}>
        <SectionHeader title="About Meerkat" />
        <Text style={styles.aboutText}>
          Meerkat is the front door to a private, encrypted network. Your device keeps
          your identity and saved content local. The vision: private storage,
          device-to-device communication, friend codes, and member-hosted communities.
        </Text>
        <Text style={styles.aboutMeta}>
          Design: docs/designs/meerkat-network-v2-architecture.md
        </Text>
      </View>

      {/* Plan 51 P3: the verification-account card (status, anonymous-pass state,
          and the "Delete verification account" flow). It renders only when the
          account layer is configured AND signed in, and is kept clearly separate
          from "Delete my data" below (the two deletions are independent). */}
      <AccountSection mode="settings" />

      <View style={styles.panel}>
        <SectionHeader title="Danger zone" />
        <Button title="Reset identity" variant="danger" onPress={confirmResetIdentity} />
      </View>

      <View style={styles.panel}>
        <SectionHeader title={DELETE_MY_DATA_COPY.sectionTitle} hint={DELETE_MY_DATA_COPY.sectionHint} />
        <Button
          title={deleting ? DELETE_MY_DATA_COPY.deleting : DELETE_MY_DATA_COPY.buttonLabel}
          variant="danger"
          onPress={confirmDeleteMyData}
          disabled={deleting}
        />
        {deleteError ? <Text style={styles.deleteError}>{deleteError}</Text> : null}
        <HonestNotice text="Deletes your public persona first, revokes every storage destination, deletes broker vaults and hosted storage, then deletes your identity, files, content, communities, direct messages, and settings on this device. A separate choice controls whether destination adapters also delete reachable encrypted backup objects. Remote failures pause the local wipe with your signing key intact so you can retry. Anything already synced to another person or device stays there." />
      </View>

      <View style={{ height: insets.bottom + 96 }} />
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const styles = useMkStyles(makeStyles);
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function readinessStateLabel(state: AlphaReadinessState): string {
  switch (state) {
    case 'ready':
      return 'Ready';
    case 'needs_action':
      return 'Needs action';
    case 'blocked':
      return 'Blocked';
    case 'manual':
      return 'Manual check';
  }
}

function readinessStateColor(state: AlphaReadinessState, c: MkColors): string {
  switch (state) {
    case 'ready':
      return c.success;
    case 'needs_action':
      return c.warning;
    case 'blocked':
      return c.danger;
    case 'manual':
      return c.info;
  }
}

function hostedBoundaryStateColor(state: HostedBoundaryState, c: MkColors): string {
  switch (state) {
    case 'included':
      return c.success;
    case 'local_only':
      return c.info;
    case 'paid_required':
      return c.warning;
    case 'unavailable':
      return c.textTertiary;
  }
}

function HostedBoundaryRow({ item }: { item: HostedBoundaryItem }) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const color = hostedBoundaryStateColor(item.state, c);
  return (
    <View style={styles.hostedRow}>
      <View style={styles.hostedText}>
        <Text style={styles.hostedTitle}>{item.title}</Text>
        <Text style={styles.hostedDetail}>{item.detail}</Text>
      </View>
      <View style={[styles.hostedPill, { borderColor: color }]}>
        <Text style={[styles.hostedPillText, { color }]}>{item.stateLabel}</Text>
      </View>
    </View>
  );
}

function ReadinessRow({ item }: { item: AlphaReadinessItem }) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const color = readinessStateColor(item.state, c);
  return (
    <View style={styles.readinessRow}>
      <View style={styles.readinessText}>
        <Text style={styles.readinessLabel}>{item.label}</Text>
        <Text style={styles.readinessDetail}>{item.detail}</Text>
      </View>
      <View style={[styles.readinessPill, { borderColor: color }]}>
        <Text style={[styles.readinessPillText, { color }]}>{readinessStateLabel(item.state)}</Text>
      </View>
    </View>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: 16, gap: 14 },
  title: { color: c.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  panel: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 16,
    gap: 12,
  },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusLineText: { flex: 1, color: c.textSecondary, fontSize: 14, lineHeight: 20 },
  statsRow: { flexDirection: 'row', gap: 10 },
  stat: {
    flex: 1,
    backgroundColor: c.surfaceElevated,
    borderRadius: MK_RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 2,
  },
  statValue: { color: c.accent, fontSize: 18, fontWeight: '800' },
  statLabel: {
    color: c.textTertiary,
    fontSize: 10,
    fontWeight: '600',
  },
  budgetChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  budgetChip: {
    backgroundColor: c.surfaceElevated,
    borderRadius: MK_RADIUS.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  budgetChipOn: { backgroundColor: c.accent },
  budgetChipText: { color: c.textSecondary, fontSize: 12.5, fontWeight: '700' },
  budgetChipTextOn: { color: c.onAccent },
  rungRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rungName: { color: c.text, fontSize: 14, fontWeight: '600' },
  readinessRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    borderBottomColor: c.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  readinessText: { flex: 1, minWidth: 0, gap: 3 },
  readinessLabel: { color: c.text, fontSize: 14, fontWeight: '700' },
  readinessDetail: { color: c.textSecondary, fontSize: 12, lineHeight: 17 },
  readinessPill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  readinessPillText: { fontSize: 10, fontWeight: '800' },
  hostedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 9,
    borderBottomColor: c.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  hostedText: { flex: 1, minWidth: 0, gap: 4 },
  hostedTitle: { color: c.text, fontSize: 14, fontWeight: '800' },
  hostedDetail: { color: c.textSecondary, fontSize: 12, lineHeight: 17 },
  hostedPill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
    maxWidth: 132,
  },
  hostedPillText: { fontSize: 10, fontWeight: '800', textAlign: 'center' },
  pendingPill: {
    backgroundColor: c.surfaceElevated,
    borderRadius: MK_RADIUS.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pendingPillText: {
    color: c.warning,
    fontSize: 11,
    fontWeight: '700',
  },
  aboutText: { color: c.textSecondary, fontSize: 14, lineHeight: 21 },
  directoryInput: {
    minHeight: 46,
    backgroundColor: c.surfaceElevated,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: c.text,
    fontFamily: MK_MONO,
    fontSize: 13,
  },
  aboutMeta: { color: c.textTertiary, fontSize: 12, fontFamily: MK_MONO },
  fieldLabel: {
    color: c.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  deleteError: {
    color: c.danger,
    fontSize: 13,
    fontWeight: '600',
  },
});
