import type {
  OAuthBrokerAuditEvent,
  OAuthBrokerSessionRecord,
  OAuthBrokerStore,
  OAuthPendingConnect,
  OAuthVaultRecord,
} from './oauth-broker-store';
import { OAuthBrokerStoreUnavailableError } from './oauth-broker-store';

/**
 * File deployments do not persist OAuth credentials in v1. Every operation is an
 * explicit unavailable result, so self-host file mode never creates a shadow vault.
 */
export class FileOAuthBrokerStore implements OAuthBrokerStore {
  readonly available = false;

  async putPendingConnect(_record: OAuthPendingConnect): Promise<void> {
    throw new OAuthBrokerStoreUnavailableError();
  }

  async consumePendingConnect(_stateHash: string): Promise<OAuthPendingConnect | null> {
    throw new OAuthBrokerStoreUnavailableError();
  }

  async putVault(_record: OAuthVaultRecord): Promise<void> {
    throw new OAuthBrokerStoreUnavailableError();
  }

  async replaceVault(_record: OAuthVaultRecord): Promise<boolean> {
    throw new OAuthBrokerStoreUnavailableError();
  }

  async getVault(_vaultId: string, _subjectId: string): Promise<OAuthVaultRecord | null> {
    throw new OAuthBrokerStoreUnavailableError();
  }

  async takeVault(_vaultId: string, _subjectId: string): Promise<OAuthVaultRecord | null> {
    throw new OAuthBrokerStoreUnavailableError();
  }

  async takeVaultsForSubject(_subjectId: string): Promise<OAuthVaultRecord[]> {
    throw new OAuthBrokerStoreUnavailableError();
  }

  async recordSession(_record: OAuthBrokerSessionRecord): Promise<void> {
    throw new OAuthBrokerStoreUnavailableError();
  }

  async appendAudit(_event: OAuthBrokerAuditEvent): Promise<void> {
    throw new OAuthBrokerStoreUnavailableError();
  }
}
