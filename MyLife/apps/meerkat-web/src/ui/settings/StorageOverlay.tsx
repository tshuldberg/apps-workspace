// StorageOverlay (Plan 41 WP-41B3). The web Storage & Backup surface, hosting the
// same four cores as the mobile screens (hub, add-destination, destination
// detail, backup, restore) over the byte-twin view-model core. Internal step
// state stands in for the mobile navigation stack. Every value shown is a folded
// mk_storage_* row; nothing claims a backup exists until a destination verified a
// copy. Broker-based cloud providers show the exported broker trust disclosure
// VERBATIM before any connect (AC-41.14).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  exportRecoverableIdentity,
  hexToBytes,
  parseRecoveryKey,
  sealRecovery,
  serializeCredentialDestinationConfig,
  serializeS3Credentials,
  serializeWebdavCredentials,
  verifyStorageReadWrite,
  brokerVaultCredentialRef,
  createHostedAuthBearer,
  changePrimaryDestination,
  parseBrokerVaultCredentialRef,
  rotateStorageCredential,
  createRestorePlan,
  listRemoteBackups,
  openBackupManifest,
  decideStorageSchedule,
  deriveStorageScheduleLastRuns,
  listStorageBackups,
  listStorageDestinations,
  listStorageHealth,
  listStorageJobs,
  listStoragePolicies,
  listStorageObjects,
  planRepairJob,
  runRepairJob,
  parseStorageScheduleConfig,
  updateStorageScheduleConfig,
  type MoveExistingBackupsProgress,
} from '@mylife/sync';
import type { BackupSigningIdentity } from '@mylife/sync/src/storage/backup-format';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { useView } from '../navigation/useView';
import { Modal } from '../shell/Modal';
import { Button } from '../shell/Button';
import { formatBytes } from '../format';
import { useWebStorage } from '../../lib/storage/use-web-storage';
import { createWebLocalDeviceDestinationAdapter } from '../../lib/storage/local-device-adapter';
import { runWebDatabaseBackup } from '../../lib/storage/web-backup-run';
import { GOOGLE_DRIVE_BROKER_TRUST_DISCLOSURE } from '../../lib/storage/google-drive-session';
import {
  createBrowserStorageCredentialRef,
  createBrowserStorageCredentialBroker,
  STORAGE_BROKER_ALLOW_INSECURE_LOOPBACK,
  deleteBrowserStorageSecret,
  deleteBrowserStorageCredentialRef,
  writeBrowserStorageSecret,
} from '../../lib/storage/credential-store';
import { reconnectBrokerVault } from '../../lib/storage/broker-reconnect';
import { HOSTED_API_URL } from '../../lib/hosted-access';
import {
  consumeRemoteBackupDiscovery,
  type RestoreDiscoveryChoice,
} from '../../lib/storage/restore-orchestrator-core';
import {
  createWebAdapterRestoreSource,
  readWebBackupManifestEnvelope,
} from '../../lib/storage/adapter-restore-source';
import { runWebLocalRestore } from '../../lib/storage/local-restore';
import {
  STORAGE_UI_COPY,
  STORAGE_RESTORE_COPY,
  buildAddDestinationRows,
  buildBackupLine,
  buildStorageHubViewModel,
  type StorageAddDestinationRow,
  type StorageChipTone,
} from '../../lib/storage/storage-ui-core';

type Step =
  | { kind: 'hub' }
  | { kind: 'add' }
  | { kind: 'detail'; destinationId: string }
  | { kind: 'backup' }
  | { kind: 'restore' };

function chipClass(tone: StorageChipTone): string {
  return `mk-storage-chip is-${tone}`;
}

function brokerProvider(
  kind: string,
): 'google' | 'dropbox' | 'onedrive' | 'box' | null {
  if (kind === 'google_drive') return 'google';
  if (kind === 'dropbox' || kind === 'onedrive' || kind === 'box') return kind;
  return null;
}

export function StorageOverlay(): React.ReactElement {
  const { dispatch } = useView();
  const [step, setStep] = useState<Step>({ kind: 'hub' });
  const storage = useWebStorage();

  return (
    <Modal title="Storage & Backup" onClose={() => dispatch({ type: 'CLOSE_OVERLAY' })}>
      <div className="mk-storage">
        {step.kind === 'hub' ? <Hub storage={storage} setStep={setStep} /> : null}
        {step.kind === 'add' ? <AddDestination storage={storage} setStep={setStep} /> : null}
        {step.kind === 'detail' ? <Detail storage={storage} destinationId={step.destinationId} setStep={setStep} /> : null}
        {step.kind === 'backup' ? <BackupNow storage={storage} setStep={setStep} /> : null}
        {step.kind === 'restore' ? <RestoreFlow storage={storage} setStep={setStep} /> : null}
      </div>
    </Modal>
  );
}

type StorageProps = { storage: ReturnType<typeof useWebStorage>; setStep: (step: Step) => void };

function Hub({ storage, setStep }: StorageProps): React.ReactElement {
  const vm = useMemo(() => buildStorageHubViewModel(storage.diagnostics), [storage.diagnostics]);
  return (
    <section className="mk-settings-section">
      {vm.issues.length > 0 ? (
        <div className="mk-storage-issues">
          {vm.issues.map((issue) => (
            <div key={issue.kind} className={`mk-storage-issue is-${issue.tone}`}>
              <div className="mk-storage-issue-title">{issue.title}</div>
              <div className="mk-muted">{issue.detail}</div>
            </div>
          ))}
        </div>
      ) : null}

      {!vm.hasAnyDestination ? (
        <div className="mk-storage-empty">
          <h3 className="mk-settings-section-title">{STORAGE_UI_COPY.emptyTitle}</h3>
          <p className="mk-muted">{STORAGE_UI_COPY.emptyBody}</p>
          <Button onClick={() => setStep({ kind: 'add' })}>Add a destination</Button>
          <p className="mk-muted mk-settings-note">{STORAGE_UI_COPY.encryptBeforeLeaving}</p>
        </div>
      ) : (
        <>
          {vm.policies.length > 0 ? (
            <>
              <h3 className="mk-settings-section-title">What goes where</h3>
              {vm.policies.map((policy) => (
                <div key={policy.dataClass} className="mk-storage-policy-row">
                  <span>{policy.label}</span>
                  <span className="mk-muted">
                    {policy.primaryLabel}
                    {policy.mirrorLabel ? ` · mirror: ${policy.mirrorLabel}` : ''}
                  </span>
                </div>
              ))}
            </>
          ) : null}

          <div className="mk-storage-dest-head">
            <h3 className="mk-settings-section-title">Destinations</h3>
            <Button small variant="ghost" onClick={() => setStep({ kind: 'add' })}>Add</Button>
          </div>
          {vm.destinations.map((destination) => (
            <button
              key={destination.id}
              type="button"
              className="mk-storage-dest-row"
              onClick={() => setStep({ kind: 'detail', destinationId: destination.id })}
            >
              <span className="mk-storage-dest-main">
                <span className="mk-storage-dest-label">{destination.label}</span>
                <span className={chipClass(destination.chip.tone)}>{destination.chip.label}</span>
              </span>
              <span className="mk-muted">
                {destination.name} · {destination.verifiedObjects} verified
                {destination.completeBackupCount > 0 ? ` · ${destination.completeBackupCount} backup${destination.completeBackupCount === 1 ? '' : 's'}` : ''}
              </span>
            </button>
          ))}

          <div className="mk-storage-actions">
            <Button onClick={() => setStep({ kind: 'backup' })}>Back up now</Button>
            <Button variant="ghost" onClick={() => setStep({ kind: 'restore' })}>Restore from a backup</Button>
          </div>
          <p className="mk-muted mk-settings-note">{STORAGE_UI_COPY.notBackedUpUntilVerified}</p>
          <p className="mk-muted mk-settings-note">{STORAGE_UI_COPY.hostedNotDefault}</p>
        </>
      )}
    </section>
  );
}

function AddDestination({ storage, setStep }: StorageProps): React.ReactElement {
  const m = useMeerkat();
  const [busyKind, setBusyKind] = useState<string | null>(null);
  // Synchronous single-flight: two fast clicks land before the busy re-render
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
  const [error, setError] = useState<string | null>(null);
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
  const credentialBroker = useMemo(() => createBrowserStorageCredentialBroker({
    baseUrl: HOSTED_API_URL,
    identity: m.identity,
    allowInsecureLoopback: STORAGE_BROKER_ALLOW_INSECURE_LOOPBACK,
  }), [m.identity]);
  const rows = useMemo(
    () => buildAddDestinationRows({ supports: (kind) => storage.registry.supports(kind), platform: 'web' }),
    [storage.registry],
  );

  const connectLocal = useCallback(() => {
    if (!takeConnectSlot('local_device')) return;
    setError(null);
    void (async () => {
      try {
        const id = `local-${globalThis.crypto.randomUUID()}`;
        const adapter = createWebLocalDeviceDestinationAdapter({ destinationId: id, db: m.db });
        const capabilities = await adapter.capabilities();
        storage.router.registerDestination({
          id, kind: 'local_device', label: 'This browser', credentialRef: `local-device:${id}`, capabilities,
        });
        const authorization = await adapter.authorize({ kind: 'interactive' });
        if (authorization.kind !== 'authorized') {
          storage.refresh();
          setError('The local destination could not be opened.');
          return;
        }
        const health = await storage.router.checkHealth(id, { refresh: true });
        // Browser storage is durability-gated: it reads ready only when the
        // grant makes it persistent; otherwise its chip stays honestly degraded.
        if (health.state === 'ok') storage.router.updateDestinationState(id, 'ready');
        storage.refresh();
        setStep({ kind: 'detail', destinationId: id });
      } catch (err) {
        storage.refresh();
        setError(err instanceof Error ? err.message : 'Could not connect this browser.');
      } finally {
        releaseConnectSlot();
      }
    })();
  }, [m.db, storage, setStep, takeConnectSlot, releaseConnectSlot]);

  const connectCredentialDestination = useCallback(() => {
    if (credentialKind === null) return;
    if (!takeConnectSlot(credentialKind)) return;
    setError(null);
    void (async () => {
      const id = `${credentialKind}-${globalThis.crypto.randomUUID()}`;
      let credentialRef: string | null = null;
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
        const secret = credentialKind === 'webdav'
          ? serializeWebdavCredentials({ username: username.trim(), password })
          : credentialKind === 's3' ? serializeS3Credentials({
            accessKeyId: accessKeyId.trim(), secretAccessKey,
            ...(sessionToken.trim() ? { sessionToken: sessionToken.trim() } : {}),
          }) : password;
        credentialRef = await credentialBroker.put(credentialKind, secret);
        const adapter = storage.registry.resolve({ id, kind: credentialKind, credentialRef, rootRef });
        if (adapter === null) throw new Error(`${credentialKind === 'webdav'
          ? 'WebDAV' : credentialKind === 's3' ? 'S3' : 'Connected server'} is unavailable in this browser.`);
        const authorization = await adapter.authorize({ kind: 'stored_credential', credentialRef });
        if (authorization.kind !== 'authorized') throw new Error('The destination rejected these credentials.');
        await verifyStorageReadWrite(adapter, globalThis.crypto.randomUUID());
        storage.router.registerDestination({
          id,
          kind: credentialKind,
          label: label.trim() || (credentialKind === 'webdav'
            ? 'WebDAV' : credentialKind === 's3' ? 'S3' : 'Connected server'),
          credentialRef,
          rootRef,
          capabilities: await adapter.capabilities(),
        });
        registered = true;
        const health = await storage.router.checkHealth(id, { refresh: true });
        if (health.state !== 'ok' && health.state !== 'degraded') {
          throw new Error('The destination did not pass its health check.');
        }
        storage.router.updateDestinationState(id, health.state === 'ok' ? 'ready' : 'degraded');
        setPassword('');
        setSecretAccessKey('');
        setSessionToken('');
        storage.refresh();
        setStep({ kind: 'detail', destinationId: id });
      } catch (err) {
        if (!registered && credentialRef !== null) {
          await credentialBroker.revoke(credentialRef).catch(() => undefined);
        }
        storage.refresh();
        setError(err instanceof Error ? err.message : 'Could not connect this destination.');
      } finally {
        releaseConnectSlot();
      }
    })();
  }, [accessKeyId, bucket, credentialBroker, credentialKind, endpoint, label, operatorPublicKey,
    password, region, secretAccessKey, sessionToken, setStep, storage, username,
    takeConnectSlot, releaseConnectSlot]);

  const connectHosted = useCallback(() => {
    if (!takeConnectSlot('hosted_storage')) return;
    setError(null);
    void (async () => {
      try {
        const id = `hosted-${globalThis.crypto.randomUUID()}`;
        const credentialRef = 'hosted://device';
        const adapter = storage.registry.resolve({ id, kind: 'hosted_storage', credentialRef });
        if (adapter === null) throw new Error('Hosted storage is not configured in this build.');
        const authorization = await adapter.authorize({ kind: 'interactive', credentialRef });
        if (authorization.kind !== 'authorized') throw new Error('Hosted storage authorization did not complete.');
        await verifyStorageReadWrite(adapter, globalThis.crypto.randomUUID());
        storage.router.registerDestination({
          id,
          kind: 'hosted_storage',
          label: 'Meerkat hosted storage',
          credentialRef,
          capabilities: await adapter.capabilities(),
        });
        await storage.router.checkHealth(id, { refresh: true });
        storage.refresh();
        setStep({ kind: 'detail', destinationId: id });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not connect hosted storage.');
      } finally {
        releaseConnectSlot();
      }
    })();
  }, [setStep, storage, takeConnectSlot, releaseConnectSlot]);

  const connectBrokerDestination = useCallback((row: StorageAddDestinationRow) => {
    if (row.kind !== 'google_drive' && row.kind !== 'dropbox'
      && row.kind !== 'onedrive' && row.kind !== 'box') return;
    const destinationKind = row.kind;
    const provider = brokerProvider(destinationKind);
    if (provider === null) return;
    if (!takeConnectSlot(row.kind)) return;
    setError(null);
    void (async () => {
      let adapter: ReturnType<typeof storage.registry.resolve> = null;
      try {
        if (!HOSTED_API_URL) throw new Error('The OAuth broker URL is not configured in this build.');
        const connected = await reconnectBrokerVault({
          brokerBaseUrl: HOSTED_API_URL,
          provider,
          destinationLabel: row.name,
          getHostedAuthBearer: () => createHostedAuthBearer(m.identity),
        });
        const id = `${destinationKind}-${globalThis.crypto.randomUUID()}`;
        const credentialRef = brokerVaultCredentialRef(connected.vaultId);
        adapter = storage.registry.resolve({
          id,
          kind: destinationKind,
          credentialRef,
          rootRef: null,
        });
        if (adapter === null) throw new Error(`${row.name} could not create a storage adapter.`);
        const authorization = await adapter.authorize({ kind: 'broker_vault', credentialRef });
        if (authorization.kind !== 'authorized') throw new Error(`${row.name} authorization did not complete.`);
        await verifyStorageReadWrite(adapter, globalThis.crypto.randomUUID());
        storage.router.registerDestination({
          id,
          kind: destinationKind,
          label: connected.accountHint ? `${row.name} (${connected.accountHint})` : row.name,
          accountHint: connected.accountHint,
          credentialRef,
          capabilities: await adapter.capabilities(),
        });
        await storage.router.checkHealth(id, { refresh: true });
        storage.refresh();
        setStep({ kind: 'detail', destinationId: id });
      } catch (err) {
        await adapter?.revoke({ deleteRemoteData: false }).catch(() => undefined);
        storage.refresh();
        setError(err instanceof Error ? err.message : `Could not connect ${row.name}.`);
      } finally {
        releaseConnectSlot();
      }
    })();
  }, [m.identity, setStep, storage, takeConnectSlot, releaseConnectSlot]);

  const onConnect = useCallback((row: StorageAddDestinationRow) => {
    if (row.kind === 'local_device') { connectLocal(); return; }
    if (row.kind === 'webdav' || row.kind === 's3' || row.kind === 'connected_server') {
      setCredentialKind(row.kind);
      setLabel(row.name);
      return;
    }
    if (row.kind === 'hosted_storage') { connectHosted(); return; }
    if (row.flow === 'oauth_token') {
      connectBrokerDestination(row);
      return;
    }
    // Broker/native flows are not completable in this build; the honest next
    // step is surfaced rather than a fake connection. The broker disclosure is
    // rendered inline (below) before any such connect can proceed.
    setError(`${row.name}: this connect flow needs its provider setup for this build before it can connect.`);
  }, [connectBrokerDestination, connectHosted, connectLocal]);

  return (
    <section className="mk-settings-section">
      <button type="button" className="mk-storage-back" onClick={() => setStep({ kind: 'hub' })}>← Back</button>
      <h3 className="mk-settings-section-title">{STORAGE_UI_COPY.addDestinationTitle}</h3>
      <p className="mk-muted mk-settings-note">{STORAGE_UI_COPY.encryptBeforeLeaving}</p>
      {credentialKind ? (
        <div className="mk-storage-credential-form">
          <h4 className="mk-settings-section-title">Connect {credentialKind === 'webdav' ? 'WebDAV' : credentialKind === 's3' ? 'S3' : 'a server'}</h4>
          <input className="mk-input" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Destination name" />
          <input className="mk-input" value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder={credentialKind === 'webdav' ? 'https://dav.example.com/' : credentialKind === 's3' ? 'https://s3.example.com/' : 'https://storage.example.com/api/storage/v1/descriptor'} />
          {credentialKind === 'webdav' ? (
            <>
              <input className="mk-input" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username" autoComplete="username" />
              <input className="mk-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" autoComplete="current-password" />
            </>
          ) : credentialKind === 's3' ? (
            <>
              <input className="mk-input" value={bucket} onChange={(event) => setBucket(event.target.value)} placeholder="Bucket" />
              <input className="mk-input" value={region} onChange={(event) => setRegion(event.target.value)} placeholder="Region, for example us-east-1" />
              <input className="mk-input" value={accessKeyId} onChange={(event) => setAccessKeyId(event.target.value)} placeholder="Access key ID" autoComplete="off" />
              <input className="mk-input" type="password" value={secretAccessKey} onChange={(event) => setSecretAccessKey(event.target.value)} placeholder="Secret access key" autoComplete="off" />
              <input className="mk-input" type="password" value={sessionToken} onChange={(event) => setSessionToken(event.target.value)} placeholder="Session token, if required" autoComplete="off" />
            </>
          ) : (
            <>
              <input className="mk-input" value={operatorPublicKey} onChange={(event) => setOperatorPublicKey(event.target.value)} placeholder="Pinned operator public key (64 hex characters)" autoComplete="off" />
              <input className="mk-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Server access token" autoComplete="off" />
            </>
          )}
          <div className="mk-storage-actions">
            <Button onClick={connectCredentialDestination} disabled={busyKind !== null}>{busyKind === credentialKind ? 'Connecting...' : 'Connect and verify'}</Button>
            <Button variant="ghost" onClick={() => setCredentialKind(null)} disabled={busyKind !== null}>Cancel</Button>
          </div>
          <p className="mk-muted mk-settings-note">Credentials are held in the KMS-backed credential broker. This browser persists only a vault reference. Meerkat verifies the signed descriptor, challenge, and a temporary read-back before marking the destination ready.</p>
        </div>
      ) : null}
      {rows.map((row) => (
        <div key={row.kind} className="mk-storage-choice">
          <div className="mk-storage-choice-text">
            <div className="mk-storage-choice-name">{row.name}</div>
            <div className="mk-muted">{row.blurb}</div>
            {row.flow === 'oauth_token' ? (
              <div className="mk-storage-disclosure">{GOOGLE_DRIVE_BROKER_TRUST_DISCLOSURE}</div>
            ) : null}
            {!row.supported && row.unavailableReason ? (
              <div className="mk-storage-unavailable">
                <span className="mk-storage-chip is-muted">Not available here</span>
                <span className="mk-muted">{row.unavailableReason}</span>
              </div>
            ) : null}
          </div>
          {row.supported ? (
            <Button small variant="ghost" onClick={() => onConnect(row)} disabled={busyKind === row.kind}>
              {busyKind === row.kind ? 'Connecting...' : 'Connect'}
            </Button>
          ) : null}
        </div>
      ))}
      {error ? <div className="mk-storage-error">{error}</div> : null}
      <p className="mk-muted mk-settings-note">{STORAGE_UI_COPY.hostedNotDefault}</p>
    </section>
  );
}

function Detail({ storage, destinationId, setStep }: StorageProps & { destinationId: string }): React.ReactElement {
  const m = useMeerkat();
  const credentialBroker = useMemo(() => createBrowserStorageCredentialBroker({
    baseUrl: HOSTED_API_URL,
    identity: m.identity,
    allowInsecureLoopback: STORAGE_BROKER_ALLOW_INSECURE_LOOPBACK,
  }), [m.identity]);
  const [checking, setChecking] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [moveRunning, setMoveRunning] = useState(false);
  const [moveProgress, setMoveProgress] = useState<MoveExistingBackupsProgress | null>(null);
  const [manageResult, setManageResult] = useState<string | null>(null);
  const [credentialOne, setCredentialOne] = useState('');
  const [credentialTwo, setCredentialTwo] = useState('');
  const [credentialThree, setCredentialThree] = useState('');
  const vm = useMemo(
    () => buildStorageHubViewModel(storage.diagnostics).destinations.find((d) => d.id === destinationId) ?? null,
    [storage.diagnostics, destinationId],
  );
  const detail = useMemo(() => storage.diagnostics.destinations.find((d) => d.id === destinationId) ?? null, [storage.diagnostics, destinationId]);

  const onCheck = useCallback(() => {
    setChecking(true);
    void (async () => {
      try {
        const destination = storage.router.getDestination(destinationId);
        const adapter = destination ? storage.registry.resolveRouterDestination(destination) : null;
        if (destination?.credential_ref && adapter) {
          const authorization = await adapter.authorize({
            kind: destination.credential_ref.startsWith('broker://oauth/')
              ? 'broker_vault' : 'stored_credential',
            credentialRef: destination.credential_ref,
          });
          if (authorization.kind !== 'authorized') throw new Error('This destination needs to be reconnected.');
        }
        await storage.router.checkHealth(destinationId, { refresh: true });
      } catch (error) {
        setManageResult(error instanceof Error ? error.message : 'Could not check this destination.');
      }
      finally { storage.refresh(); setChecking(false); }
    })();
  }, [destinationId, storage]);

  const onDisconnect = useCallback(() => {
    if (!window.confirm(`${STORAGE_UI_COPY.disconnectConsequence}\n\nDisconnect this destination?`)) return;
    setDisconnecting(true);
    void (async () => {
      let revoked = false;
      try {
        const destination = storage.router.getDestination(destinationId);
        const adapter = destination ? storage.registry.resolveRouterDestination(destination) : null;
        if (adapter) await adapter.revoke({ deleteRemoteData: false });
        storage.router.updateDestinationState(destinationId, 'revoked');
        storage.registry.invalidate(destinationId);
        revoked = true;
      } catch (error) {
        // A failed revoke must render here, not silently leave the screen as
        // if the destination were disconnected.
        setManageResult(error instanceof Error ? error.message : 'Could not disconnect this destination. Nothing was disconnected.');
      } finally {
        storage.refresh();
        setDisconnecting(false);
        if (revoked) setStep({ kind: 'hub' });
      }
    })();
  }, [destinationId, storage, setStep]);

  const destinationRow = storage.router.getDestination(destinationId);
  const moveTargets = buildStorageHubViewModel(storage.diagnostics).destinations
    .filter((destination) => destination.id !== destinationId && destination.chip.state === 'ready');

  const onRotateCredentials = useCallback(() => {
    const destination = storage.router.getDestination(destinationId);
    if (!destination || (destination.kind !== 'webdav' && destination.kind !== 's3')) return;
    const destinationKind = destination.kind;
    setRotating(true);
    setManageResult(null);
    void (async () => {
      let newRef: string | null = null;
      try {
        const secret = destinationKind === 'webdav'
          ? serializeWebdavCredentials({ username: credentialOne.trim(), password: credentialTwo })
          : serializeS3Credentials({
            accessKeyId: credentialOne.trim(), secretAccessKey: credentialTwo,
            ...(credentialThree.trim() ? { sessionToken: credentialThree.trim() } : {}),
          });
        newRef = await credentialBroker.put(destinationKind, secret);
        const report = await rotateStorageCredential({
          db: m.db,
          destinationId,
          newCredentialRef: newRef,
          authorizationKind: 'stored_credential',
          invalidateAdapter: storage.registry.invalidate,
          resolveAdapter: storage.registry.resolveRouterDestination,
          resumeJob: async (jobId) => {
            storage.router.resumeJob(jobId);
            await storage.router.runJob(jobId);
          },
          deleteCredential: (ref) => deleteBrowserStorageCredentialRef(
            m.storageSecretAccess,
            credentialBroker,
            ref,
          ),
          now: () => new Date().toISOString(),
          probeNonce: globalThis.crypto.randomUUID(),
        });
        if (!report.credentialSwapped) {
          await credentialBroker.revoke(newRef).catch(() => undefined);
        }
        setManageResult(report.complete
          ? `Credentials updated. ${report.resumedJobIds.length} paused job${report.resumedJobIds.length === 1 ? '' : 's'} resumed.`
          : `Credential update needs attention: ${report.errorCode ?? 'health probe failed'}.`);
        setCredentialTwo('');
        setCredentialThree('');
      } catch (error) {
        if (newRef !== null) await credentialBroker.revoke(newRef).catch(() => undefined);
        setManageResult(error instanceof Error ? error.message : 'Credential update failed.');
      } finally {
        storage.refresh();
        setRotating(false);
      }
    })();
  }, [credentialBroker, credentialOne, credentialThree, credentialTwo, destinationId, m.db,
    m.storageSecretAccess, storage]);

  const onReconnectBroker = useCallback(() => {
    const destination = storage.router.getDestination(destinationId);
    const provider = destination ? brokerProvider(destination.kind) : null;
    if (!destination || provider === null) return;
    setRotating(true);
    setManageResult(null);
    void (async () => {
      const oldAdapter = storage.registry.resolveRouterDestination(destination);
      try {
        if (!HOSTED_API_URL) throw new Error('The OAuth broker URL is not configured in this build.');
        const connected = await reconnectBrokerVault({
          brokerBaseUrl: HOSTED_API_URL,
          provider,
          destinationLabel: destination.label,
          getHostedAuthBearer: () => createHostedAuthBearer(m.identity),
        });
        const report = await rotateStorageCredential({
          db: m.db,
          destinationId,
          newCredentialRef: brokerVaultCredentialRef(connected.vaultId),
          newAccountHint: connected.accountHint,
          authorizationKind: 'broker_vault',
          invalidateAdapter: storage.registry.invalidate,
          resolveAdapter: storage.registry.resolveRouterDestination,
          resumeJob: async (jobId) => {
            storage.router.resumeJob(jobId);
            await storage.router.runJob(jobId);
          },
          deleteCredential: async () => { await oldAdapter?.revoke({ deleteRemoteData: false }); },
          now: () => new Date().toISOString(),
          probeNonce: globalThis.crypto.randomUUID(),
        });
        setManageResult(report.complete
          ? `Provider reconnected. ${report.resumedJobIds.length} paused job${report.resumedJobIds.length === 1 ? '' : 's'} resumed.`
          : `Reconnect needs attention: ${report.errorCode ?? 'health probe failed'}.`);
      } catch (error) {
        setManageResult(error instanceof Error ? error.message : 'Provider reconnect failed.');
      } finally {
        storage.refresh();
        setRotating(false);
      }
    })();
  }, [destinationId, m.db, m.identity, storage]);

  const onRepair = useCallback(() => {
    setMoveRunning(true);
    setManageResult(null);
    void (async () => {
      try {
        const destinations = listStorageDestinations(m.db);
        for (const destination of destinations) {
          const adapter = storage.registry.resolveRouterDestination(destination);
          if (!adapter) continue;
          const authorization = await adapter.authorize(destination.credential_ref ? {
            kind: destination.credential_ref.startsWith('broker://oauth/')
              ? 'broker_vault' : 'stored_credential',
            credentialRef: destination.credential_ref,
          } : { kind: 'interactive' });
          if (authorization.kind !== 'authorized') storage.registry.invalidate(destination.id);
        }
        const report = await runRepairJob({
          db: m.db,
          plan: planRepairJob({
            objects: listStorageObjects(m.db),
            destinations,
            targetDestinationId: destinationId,
          }),
          resolveAdapter: (targetId) => {
            const destination = storage.router.getDestination(targetId);
            return destination ? storage.registry.resolveRouterDestination(destination) : null;
          },
          now: () => new Date().toISOString(),
          random: () => globalThis.crypto.randomUUID(),
        });
        setManageResult(`Repair checked ${report.planned} object${report.planned === 1 ? '' : 's'}: ${report.repaired} repaired, ${report.failed} failed, ${report.impossible} had no usable verified copy, and ${report.backupsReverified} backup record${report.backupsReverified === 1 ? '' : 's'} returned to complete.`);
      } catch (error) {
        setManageResult(error instanceof Error ? error.message : 'Repair could not run.');
      } finally {
        storage.refresh();
        setMoveRunning(false);
      }
    })();
  }, [destinationId, m.db, storage]);

  const onChangePrimary = useCallback((targetId: string, moveExisting: boolean) => {
    setMoveRunning(true);
    setManageResult(null);
    setMoveProgress(null);
    void changePrimaryDestination({
      db: m.db,
      router: storage.router,
      sourceDestinationId: destinationId,
      targetDestinationId: targetId,
      moveExisting,
      resolveAdapter: storage.registry.resolveRouterDestination,
      onProgress: setMoveProgress,
    }).then((report) => {
      setManageResult(report.move === null
        ? 'Future writes now use the selected destination. Existing copies stayed where they are.'
        : `${report.move.moved} backup${report.move.moved === 1 ? '' : 's'} moved; ${report.move.failed + report.move.skipped} need attention.`);
    }).catch((error: unknown) => {
      setManageResult(error instanceof Error ? error.message : 'Could not change the primary destination.');
    }).finally(() => {
      storage.refresh();
      setMoveRunning(false);
    });
  }, [destinationId, m.db, storage]);

  if (!vm || !detail) {
    return (
      <section className="mk-settings-section">
        <button type="button" className="mk-storage-back" onClick={() => setStep({ kind: 'hub' })}>← Back</button>
        <p className="mk-muted">This destination is no longer available.</p>
      </section>
    );
  }
  const backups = detail.backups.map(buildBackupLine);
  return (
    <section className="mk-settings-section">
      <button type="button" className="mk-storage-back" onClick={() => setStep({ kind: 'hub' })}>← Back</button>
      <div className="mk-storage-dest-head">
        <h3 className="mk-settings-section-title">{vm.label}</h3>
        <span className={chipClass(vm.chip.tone)}>{vm.chip.label}</span>
      </div>
      <div className="mk-stat-grid">
        <div className="mk-stat"><div className="mk-stat-value">{vm.verifiedObjects}</div><div className="mk-stat-label">Verified</div></div>
        <div className="mk-stat"><div className="mk-stat-value">{detail.objectCounts.total}</div><div className="mk-stat-label">Objects</div></div>
        <div className="mk-stat"><div className="mk-stat-value">{vm.unhealthyObjects}</div><div className="mk-stat-label">Need attention</div></div>
      </div>
      <div className="mk-muted mk-settings-note">
        {vm.lastVerificationAt ? `Last verified: ${vm.lastVerificationAt}` : 'No object has been verified here yet.'}
      </div>
      <Button small variant="ghost" onClick={onCheck} disabled={checking}>{checking ? 'Checking...' : 'Verify now'}</Button>
      <Button small variant="ghost" onClick={onRepair} disabled={moveRunning || vm.unhealthyObjects === 0}>{moveRunning ? 'Working...' : 'Repair missing objects'}</Button>

      <h4 className="mk-settings-section-title" style={{ marginTop: 12 }}>Backups here</h4>
      {backups.length === 0 ? (
        <div className="mk-muted">No backup has been written to this destination yet.</div>
      ) : backups.map((backup) => (
        <div key={backup.backupId} className="mk-storage-backup-row">
          <span className="mk-muted">{backup.backupId} · {backup.objectCount} objects · {formatBytes(backup.encryptedBytes)}</span>
          <span className={chipClass(backup.tone)}>{backup.stateLabel}</span>
        </div>
      ))}

      <h4 className="mk-settings-section-title" style={{ marginTop: 12 }}>Manage</h4>
      <p className="mk-muted mk-settings-note">{STORAGE_UI_COPY.migrateExplanation}</p>
      {moveTargets.map((target) => (
        <div key={target.id} className="mk-storage-backup-row">
          <span>{target.label}</span>
          <span className="mk-storage-actions">
            <Button small variant="ghost" onClick={() => onChangePrimary(target.id, false)} disabled={moveRunning}>Future writes</Button>
            <Button small variant="ghost" onClick={() => onChangePrimary(target.id, true)} disabled={moveRunning}>Move existing</Button>
          </span>
        </div>
      ))}
      {moveProgress ? (
        <div className="mk-muted mk-settings-note">
          Move progress: {moveProgress.completed} of {moveProgress.total} backups checked; {moveProgress.moved} moved, {moveProgress.failed} failed, {moveProgress.skipped} skipped.
        </div>
      ) : null}
      {destinationRow?.kind === 'webdav' || destinationRow?.kind === 's3' ? (
        <div className="mk-storage-credential-form">
          <h4 className="mk-settings-section-title">Update credentials</h4>
          <input className="mk-input" value={credentialOne} onChange={(event) => setCredentialOne(event.target.value)} placeholder={destinationRow.kind === 'webdav' ? 'Username' : 'Access key ID'} autoComplete="off" />
          <input className="mk-input" type="password" value={credentialTwo} onChange={(event) => setCredentialTwo(event.target.value)} placeholder={destinationRow.kind === 'webdav' ? 'Password' : 'Secret access key'} autoComplete="off" />
          {destinationRow.kind === 's3' ? <input className="mk-input" type="password" value={credentialThree} onChange={(event) => setCredentialThree(event.target.value)} placeholder="Session token, if required" autoComplete="off" /> : null}
          <Button small onClick={onRotateCredentials} disabled={rotating || !credentialOne.trim() || !credentialTwo}>{rotating ? 'Verifying...' : 'Update and verify'}</Button>
        </div>
      ) : null}
      {parseBrokerVaultCredentialRef(destinationRow?.credential_ref ?? null) ? (
        <Button small onClick={onReconnectBroker} disabled={rotating}>{rotating ? 'Reconnecting...' : 'Reconnect provider'}</Button>
      ) : null}
      {manageResult ? <div className="mk-muted mk-settings-note">{manageResult}</div> : null}
      <Button variant="danger" small onClick={onDisconnect} disabled={disconnecting}>
        {disconnecting ? 'Disconnecting…' : 'Disconnect'}
      </Button>
    </section>
  );
}

function BackupNow({ storage, setStep }: StorageProps): React.ReactElement {
  const m = useMeerkat();
  const vm = useMemo(() => buildStorageHubViewModel(storage.diagnostics), [storage.diagnostics]);
  const targets = vm.destinations.filter((d) => d.chip.state === 'ready');
  const backups = storage.diagnostics.backups.map(buildBackupLine);
  const [recoveryKey, setRecoveryKey] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [scheduleIntervalHours, setScheduleIntervalHours] = useState(24);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  // Stale-selection repair: a selected destination that lost readiness must not
  // stay the backup target (mirrors the mobile backup screen).
  const destinationId = (selectedId && targets.some((t) => t.id === selectedId))
    ? selectedId
    : targets[0]?.id ?? null;
  const schedulePolicy = listStoragePolicies(m.db)
    .find((policy) => policy.data_class === 'sqlite_snapshot') ?? null;
  const scheduleRetentionJson = schedulePolicy?.retention_json ?? null;
  const scheduleConfig = useMemo(
    () => scheduleRetentionJson ? parseStorageScheduleConfig(scheduleRetentionJson) : null,
    [scheduleRetentionJson],
  );
  const scheduleDecision = decideStorageSchedule({
    policies: listStoragePolicies(m.db),
    destinations: listStorageDestinations(m.db),
    health: listStorageHealth(m.db),
    jobs: listStorageJobs(m.db),
    lastRuns: deriveStorageScheduleLastRuns(
      listStorageBackups(m.db),
      listStorageObjects(m.db),
    ),
    now: new Date().toISOString(),
  }).find((decision) => decision.dataClass === 'sqlite_snapshot') ?? null;

  useEffect(() => {
    if (scheduleConfig) setScheduleIntervalHours(scheduleConfig.intervalHours);
  }, [scheduleConfig]);

  // Synchronous single-flight: two fast clicks land before the running
  // re-render and would start two overlapping backup jobs.
  const runInFlightRef = useRef(false);
  const runBackup = useCallback((key: string, targetId: string) => {
    if (runInFlightRef.current) return;
    const recoveryBytes = parseRecoveryKey(key.trim());
    if (!recoveryBytes) { setResult({ ok: false, text: 'That recovery key is not valid. It starts with MKR1.' }); return; }
    runInFlightRef.current = true;
    setRunning(true);
    setResult(null);
    void (async () => {
      let signing: BackupSigningIdentity | null = null;
      try {
        const policy = storage.router.getPolicy('sqlite_snapshot');
        const destinationIds = new Set([targetId]);
        if (policy?.primary_destination_id === targetId && policy.mirror_destination_id) {
          destinationIds.add(policy.mirror_destination_id);
        }
        for (const id of destinationIds) {
          const destination = storage.router.getDestination(id);
          const adapter = destination ? storage.registry.resolveRouterDestination(destination) : null;
          if (!destination || !adapter) {
            if (id === targetId) throw new Error('The selected destination is unavailable.');
            continue;
          }
          if (destination.credential_ref) {
            const authorization = await adapter.authorize({
              kind: destination.credential_ref.startsWith('broker://oauth/')
                ? 'broker_vault' : 'stored_credential',
              credentialRef: destination.credential_ref,
            });
            if (authorization.kind !== 'authorized' && id === targetId) {
              throw new Error('The destination needs to be reconnected.');
            }
          }
        }
        await storage.router.checkHealth(targetId, { refresh: true });
        const recoverable = exportRecoverableIdentity(m.identity);
        signing = {
          deviceId: m.identity.publicKey,
          publicKey: hexToBytes(recoverable.publicKey),
          secretKey: hexToBytes(recoverable.signingPrivateKeyHex),
        };
        const backupId = `backup-${globalThis.crypto.randomUUID()}`;
        const outcome = await runWebDatabaseBackup({
          db: m.db,
          router: storage.router,
          destinationId: targetId,
          backupId,
          schemaVersion: 1,
          payloadStore: storage.payloadStore,
          blobStore: m.blobStore,
          encoderInput: {
            recoveryKey: key.trim(),
            backupId,
            createdAt: new Date().toISOString(),
            schemaVersion: 1,
            migrationVersion: 1,
            appVersion: '1.0.0',
            dataClassVersions: {},
            sealedRecoveryBundle: sealRecovery(recoverable, recoveryBytes),
            signingIdentity: signing,
          },
        });
        setResult(outcome.complete
          ? outcome.mirror?.error
            ? { ok: false, text: `Primary backup verified. The mirror copy did not finish: ${outcome.mirror.error}. The primary remains complete.` }
            : { ok: true, text: 'Backup complete. Every primary and mirror object verified.' }
          : { ok: false, text: `Backup did not finish verifying (${outcome.job.state}). Nothing is marked backed up until it does.` });
      } catch (err) {
        setResult({ ok: false, text: err instanceof Error ? err.message : 'The backup could not be completed.' });
      } finally {
        signing?.secretKey.fill(0);
        recoveryBytes.fill(0);
        storage.refresh();
        runInFlightRef.current = false;
        setRunning(false);
      }
    })();
  }, [m.blobStore, m.db, m.identity, storage]);

  const onBackup = useCallback(() => {
    if (destinationId) runBackup(recoveryKey, destinationId);
  }, [destinationId, recoveryKey, runBackup]);

  const onEnableSchedule = useCallback(() => {
    if (!destinationId) return;
    const recoveryBytes = parseRecoveryKey(recoveryKey.trim());
    if (!recoveryBytes) {
      setResult({ ok: false, text: 'Enter a valid recovery key before enabling scheduled backups.' });
      return;
    }
    recoveryBytes.fill(0);
    setScheduleBusy(true);
    setResult(null);
    void (async () => {
      const existing = storage.router.getPolicy('sqlite_snapshot');
      const previous = existing ? parseStorageScheduleConfig(existing.retention_json) : null;
      if (existing && previous === null) {
        throw new Error('The existing retention policy is invalid. Scheduling was not changed.');
      }
      const keyRef = previous?.recoveryKeyRef
        ?? createBrowserStorageCredentialRef(`schedule-${destinationId}`);
      const createdRef = previous?.recoveryKeyRef === null || previous?.recoveryKeyRef === undefined;
      try {
        await writeBrowserStorageSecret(m.storageSecretAccess, keyRef, recoveryKey.trim());
        if (existing) {
          storage.router.setPolicy({
            ...existing,
            primary_destination_id: destinationId,
            retention_json: updateStorageScheduleConfig(existing.retention_json, {
              enabled: true,
              intervalHours: scheduleIntervalHours,
              recoveryKeyRef: keyRef,
            }),
          });
        } else {
          storage.router.setPolicy({
            dataClass: 'sqlite_snapshot',
            primaryDestinationId: destinationId,
            localCacheBytes: 0,
            retention: {
              keepLast: 7,
              maxAgeDays: 30,
              schedule: {
                enabled: true,
                intervalHours: scheduleIntervalHours,
                recoveryKeyRef: keyRef,
              },
            },
          });
        }
        setResult({
          ok: true,
          text: 'Scheduled backups are enabled. This browser checks the schedule at boot and whenever the tab becomes visible.',
        });
      } catch (error) {
        if (createdRef) await deleteBrowserStorageSecret(m.storageSecretAccess, keyRef).catch(() => undefined);
        throw error;
      } finally {
        storage.refresh();
      }
    })().catch((error: unknown) => {
      setResult({ ok: false, text: error instanceof Error ? error.message : 'The schedule could not be saved.' });
    }).finally(() => setScheduleBusy(false));
  }, [destinationId, m.storageSecretAccess, recoveryKey, scheduleIntervalHours, storage]);

  const onDisableSchedule = useCallback(() => {
    const existing = storage.router.getPolicy('sqlite_snapshot');
    if (!existing) return;
    const previous = parseStorageScheduleConfig(existing.retention_json);
    if (!previous) {
      setResult({ ok: false, text: 'The existing retention policy is invalid. Scheduling was not changed.' });
      return;
    }
    setScheduleBusy(true);
    try {
      storage.router.setPolicy({
        ...existing,
        retention_json: updateStorageScheduleConfig(existing.retention_json, {
          enabled: false,
          intervalHours: previous.intervalHours,
          recoveryKeyRef: null,
        }),
      });
      void (previous.recoveryKeyRef
        ? deleteBrowserStorageSecret(m.storageSecretAccess, previous.recoveryKeyRef)
        : Promise.resolve()).then(() => {
        setResult({ ok: true, text: 'Scheduled backups are off. No last-run time was changed.' });
      }).catch((error: unknown) => {
        setResult({ ok: false, text: error instanceof Error ? error.message : 'The saved schedule key could not be deleted.' });
      }).finally(() => {
        storage.refresh();
        setScheduleBusy(false);
      });
    } catch (error) {
      setResult({ ok: false, text: error instanceof Error ? error.message : 'The schedule could not be disabled.' });
      setScheduleBusy(false);
    }
  }, [m.storageSecretAccess, storage]);

  const onRunScheduledNow = useCallback(() => {
    const keyRef = scheduleConfig?.recoveryKeyRef;
    const key = keyRef ? m.storageSecretAccess.get(keyRef) : null;
    const targetId = schedulePolicy?.primary_destination_id ?? null;
    if (!key || !targetId) {
      setResult({ ok: false, text: 'The scheduled recovery key or destination is unavailable.' });
      return;
    }
    runBackup(key, targetId);
  }, [m.storageSecretAccess, runBackup, scheduleConfig?.recoveryKeyRef,
    schedulePolicy?.primary_destination_id]);

  return (
    <section className="mk-settings-section">
      <button type="button" className="mk-storage-back" onClick={() => setStep({ kind: 'hub' })}>← Back</button>
      <h3 className="mk-settings-section-title">Back up now</h3>
      {targets.length === 0 ? (
        <p className="mk-muted">No destination is ready to receive a backup. Connect and verify a destination first.</p>
      ) : (
        <>
          {targets.map((target) => (
            <label key={target.id} className="mk-storage-radio">
              <input type="radio" name="mk-backup-target" checked={target.id === destinationId} onChange={() => setSelectedId(target.id)} />
              <span>{target.label} <span className="mk-muted">· {target.name}</span></span>
            </label>
          ))}
          <input
            className="mk-input"
            value={recoveryKey}
            onChange={(e) => setRecoveryKey(e.target.value)}
            placeholder="MKR1-XXXXX-XXXXX-..."
            aria-label="Recovery key"
          />
          <Button onClick={onBackup} disabled={running || !destinationId || recoveryKey.trim().length === 0}>
            {running ? 'Backing up...' : 'Back up now'}
          </Button>
          <h4 className="mk-settings-section-title" style={{ marginTop: 12 }}>Scheduled backups</h4>
          <p className="mk-muted mk-settings-note">{webScheduleDecisionText(scheduleDecision)}</p>
          <div className="mk-storage-actions">
            {[6, 24, 168].map((hours) => (
              <Button key={hours} small variant={scheduleIntervalHours === hours ? 'primary' : 'ghost'} onClick={() => setScheduleIntervalHours(hours)} disabled={scheduleBusy}>
                {hours === 6 ? '6 hours' : hours === 24 ? 'Daily' : 'Weekly'}
              </Button>
            ))}
          </div>
          <div className="mk-storage-actions">
            <Button small variant="ghost" onClick={scheduleConfig?.enabled ? onDisableSchedule : onEnableSchedule} disabled={scheduleBusy || (!scheduleConfig?.enabled && (!destinationId || !recoveryKey.trim()))}>
              {scheduleBusy ? 'Saving...' : scheduleConfig?.enabled ? 'Turn off schedule' : 'Enable schedule'}
            </Button>
            <Button small variant="ghost" onClick={onRunScheduledNow} disabled={running || !scheduleConfig?.enabled}>Run scheduled backup now</Button>
          </div>
          <p className="mk-muted mk-settings-note">The scheduled recovery key is stored in this browser’s encrypted secret vault. Browsers cannot promise closed-tab execution, so schedule checks happen only at boot and when this tab becomes visible. Back up now always remains available.</p>
          {result ? <div className={result.ok ? 'mk-storage-success' : 'mk-storage-error'}>{result.text}</div> : null}
          <p className="mk-muted mk-settings-note">{STORAGE_UI_COPY.notBackedUpUntilVerified}</p>
        </>
      )}

      <h4 className="mk-settings-section-title" style={{ marginTop: 12 }}>Backup history</h4>
      {backups.length === 0 ? (
        <div className="mk-muted">No backup has been written yet.</div>
      ) : backups.map((backup) => (
        <div key={`${backup.backupId}:${backup.destinationId}`} className="mk-storage-backup-row">
          <span className="mk-muted">{backup.backupId} · {formatBytes(backup.encryptedBytes)}</span>
          <span className={chipClass(backup.tone)}>{backup.stateLabel}</span>
        </div>
      ))}
    </section>
  );
}

function webScheduleDecisionText(
  decision: ReturnType<typeof decideStorageSchedule>[number] | null,
): string {
  if (decision === null) return 'Scheduled backups are off. No verified run has been recorded.';
  const last = decision.lastRunAt ? ` Last verified backup job: ${decision.lastRunAt}.` : ' No verified run has been recorded.';
  if (decision.reason === 'due') return `A backup is due now.${last}`;
  if (decision.reason === 'not_due') return `Next eligible run: ${decision.nextRunAt ?? 'unknown'}.${last}`;
  if (decision.reason === 'disabled') return `Scheduled backups are off.${last}`;
  return `Scheduled backup is paused: ${decision.reason.replaceAll('_', ' ')}.${last}`;
}

function RestoreFlow({ storage, setStep }: StorageProps): React.ReactElement {
  const m = useMeerkat();
  const vm = useMemo(() => buildStorageHubViewModel(storage.diagnostics), [storage.diagnostics]);
  const [recoveryKey, setRecoveryKey] = useState('');
  const [choices, setChoices] = useState<RestoreDiscoveryChoice[]>([]);
  const [discovering, setDiscovering] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [discoveryRun, setDiscoveryRun] = useState(0);

  useEffect(() => {
    let active = true;
    setDiscovering(true);
    setResult(null);
    void (async () => {
      const found: RestoreDiscoveryChoice[] = [];
      let issues = 0;
      for (const destination of storage.router.listDestinations()) {
        if (destination.state !== 'ready' && destination.state !== 'degraded') continue;
        const adapter = storage.registry.resolveRouterDestination(destination);
        if (adapter === null) continue;
        try {
          if (destination.credential_ref) {
            const authorization = await adapter.authorize({
              kind: destination.credential_ref.startsWith('broker://oauth/')
                ? 'broker_vault' : 'stored_credential',
              credentialRef: destination.credential_ref,
            });
            if (authorization.kind !== 'authorized') throw new Error('authorization_required');
          }
          const remote = await listRemoteBackups(adapter);
          found.push(...consumeRemoteBackupDiscovery(destination.id, remote.backups));
          issues += remote.issues.length;
        } catch {
          issues += 1;
        }
      }
      if (!active) return;
      setChoices(found.sort((left, right) => right.createdAt.localeCompare(left.createdAt)));
      if (issues > 0) setResult(`${issues} remote backup record${issues === 1 ? '' : 's'} could not be verified and ${issues === 1 ? 'was' : 'were'} not shown.`);
      setDiscovering(false);
    })();
    return () => { active = false; };
  }, [discoveryRun, storage.registry, storage.router]);

  // Synchronous single-flight: two fast clicks land before the busy re-render
  // and would race two staged restores.
  const restoreInFlightRef = useRef(false);
  const restore = useCallback((choice: RestoreDiscoveryChoice) => {
    if (restoreInFlightRef.current) return;
    const parsed = parseRecoveryKey(recoveryKey.trim());
    if (!parsed) { setResult('That recovery key is not valid. It starts with MKR1.'); return; }
    parsed.fill(0);
    restoreInFlightRef.current = true;
    setRunningId(choice.backupId);
    setResult(null);
    void (async () => {
      try {
        const destination = storage.router.getDestination(choice.destinationId);
        const adapter = destination ? storage.registry.resolveRouterDestination(destination) : null;
        if (!adapter) throw new Error('This destination is not available in this browser.');
        if (destination?.credential_ref) {
          const authorization = await adapter.authorize({
            kind: destination.credential_ref.startsWith('broker://oauth/')
              ? 'broker_vault' : 'stored_credential',
            credentialRef: destination.credential_ref,
          });
          if (authorization.kind !== 'authorized') throw new Error('This destination needs to be reconnected.');
        }
        const envelope = await readWebBackupManifestEnvelope(adapter, choice.backupId, choice.manifestObjectId);
        const opened = openBackupManifest(choice.locatorJson, envelope, recoveryKey.trim());
        if (!opened.ok) throw opened.error;
        opened.backupRootKey.fill(0);
        const plan = createRestorePlan(opened.manifest, { mode: 'complete' });
        if (!globalThis.confirm(
          `Restore ${plan.backupId} from ${choice.createdAt}?\n\n${STORAGE_RESTORE_COPY.identityReplacementWarning}\n\n${STORAGE_UI_COPY.restoreUntouchedOnFailure}`,
        )) return;
        const outcome = await runWebLocalRestore({
          plan,
          destinationId: choice.destinationId,
          locatorJson: choice.locatorJson,
          manifestEnvelope: envelope,
          recoveryKey: recoveryKey.trim(),
          source: createWebAdapterRestoreSource(adapter, choice.backupId),
          listedBackupIds: choices.map((item) => item.backupId),
          activeDatabase: m.db,
        });
        if (outcome.state.stage !== 'activated') {
          const message = outcome.state.failure?.message
            ?? outcome.activation?.report
            ?? 'Restore did not activate.';
          if (outcome.activeDatabaseClosed) {
            globalThis.alert(`${message}\n\nThe prior database was restored. Meerkat will reload it now.`);
            globalThis.location.reload();
            return;
          }
          throw new Error(message);
        }
        globalThis.location.reload();
      } catch (error) {
        setResult(error instanceof Error ? error.message : 'The restore could not run.');
      } finally {
        restoreInFlightRef.current = false;
        setRunningId(null);
      }
    })();
  }, [choices, m.db, recoveryKey, storage.registry, storage.router]);

  return (
    <section className="mk-settings-section">
      <button type="button" className="mk-storage-back" onClick={() => setStep({ kind: 'hub' })}>← Back</button>
      <h3 className="mk-settings-section-title">Restore from a backup</h3>
      <p className="mk-muted mk-settings-note">{STORAGE_RESTORE_COPY.remoteDiscovery}</p>
      <input className="mk-input" value={recoveryKey} onChange={(event) => setRecoveryKey(event.target.value)} placeholder="MKR1-XXXXX-XXXXX-..." aria-label="Recovery key" />
      <Button small variant="ghost" onClick={() => setDiscoveryRun((value) => value + 1)} disabled={discovering}>{discovering ? 'Finding remote backups...' : 'Refresh remote backups'}</Button>
      {choices.length === 0 ? (
        <p className="mk-muted">{discovering ? 'Checking connected destinations...' : 'No valid remote locator with a present, hash-matching manifest is available to restore.'}</p>
      ) : (
        choices.map((choice) => (
          <div key={`${choice.destinationId}:${choice.backupId}`} className="mk-storage-backup-row">
            <span className="mk-muted">{choice.backupId} · {vm.destinations.find((destination) => destination.id === choice.destinationId)?.label ?? choice.destinationId} · {choice.createdAt}</span>
            <Button small variant="ghost" onClick={() => restore(choice)} disabled={!recoveryKey.trim() || runningId !== null}>{runningId === choice.backupId ? 'Restoring...' : 'Open and restore'}</Button>
          </div>
        ))
      )}
      {result ? <div className="mk-storage-error">{result}</div> : null}
      <p className="mk-muted mk-settings-note">{STORAGE_UI_COPY.restoreUntouchedOnFailure}</p>
      <p className="mk-muted mk-settings-note">
        Restoring a full backup on the web reloads this browser onto the restored data. Open a backup and confirm the
        exact restore summary before it activates.
      </p>
    </section>
  );
}
