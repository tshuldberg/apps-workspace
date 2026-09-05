import { describe, it } from 'vitest';
import { runStorageAdapterConformance } from '../conformance';
import { InMemoryStorageDestinationAdapter } from '../fakes';

runStorageAdapterConformance(
  'InMemoryStorageDestinationAdapter',
  () => new InMemoryStorageDestinationAdapter({
    maximumObjectBytes: 1024,
    pageSize: 2,
    now: () => '2026-07-14T12:00:00.000Z',
  }),
  { testApi: { describe, it } },
);
