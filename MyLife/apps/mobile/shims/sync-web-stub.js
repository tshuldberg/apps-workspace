// Web-only stub for @mylife/sync to avoid automerge wasm bundling in Expo web dev.
// Only used for Phase 2 runtime validation. Native builds keep the real package.

const stubStatus = {
  tier: 'local_only',
  lastSyncAt: null,
  isSyncing: false,
  error: null,
};

function identity(x) { return x; }

module.exports = {
  useSyncStatus: () => stubStatus,
  useSetSyncTier: () => async () => {},
  isCloudTier: (tier) => tier && tier !== 'local_only',
  tierRequiresAuth: (tier) => tier && tier !== 'local_only',
  SyncEngine: class {
    constructor() {}
    async start() {}
    async stop() {}
  },
  createSyncEngine: () => ({ start: async () => {}, stop: async () => {} }),
  __esModule: true,
  default: {},
};
