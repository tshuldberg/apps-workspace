import type { BankSyncProvider, BankSyncProviderClient } from './types';

export class BankSyncProviderRouter {
  private readonly clients = new Map<BankSyncProvider, BankSyncProviderClient>();

  constructor(initialClients: BankSyncProviderClient[] = []) {
    for (const client of initialClients) {
      this.register(client);
    }
  }

  register(client: BankSyncProviderClient): void {
    this.clients.set(client.provider, client);
  }

  get(provider: BankSyncProvider): BankSyncProviderClient | null {
    return this.clients.get(provider) ?? null;
  }

  require(provider: BankSyncProvider): BankSyncProviderClient {
    const client = this.get(provider);
    if (!client) {
      throw new Error(`No bank sync provider registered for "${provider}".`);
    }
    return client;
  }

  listProviders(): BankSyncProvider[] {
    return [...this.clients.keys()];
  }
}

export function createBankSyncProviderRouter(
  initialClients: BankSyncProviderClient[] = [],
): BankSyncProviderRouter {
  return new BankSyncProviderRouter(initialClients);
}
