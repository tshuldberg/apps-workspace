export interface StoreConformanceScenario<TStore> {
  name: string;
  run(store: TStore): void | Promise<void>;
}

export interface StoreConformanceSuite<TStore> {
  storeName: string;
  createStore(): TStore | Promise<TStore>;
  scenarios: readonly StoreConformanceScenario<TStore>[];
  disposeStore?(store: TStore): void | Promise<void>;
}

export interface StoreConformanceResult {
  storeName: string;
  passedScenarios: string[];
}

/**
 * Executes each scenario against a fresh adapter instance. This prevents scenario
 * ordering from hiding restart, idempotency, or uniqueness defects and lets the
 * same suite target memory, file, and PostgreSQL adapters.
 */
export async function runStoreConformanceSuite<TStore>(
  suite: StoreConformanceSuite<TStore>,
): Promise<StoreConformanceResult> {
  const storeName = suite.storeName.trim();
  if (!storeName) throw new Error('Store conformance suite requires a store name');
  if (suite.scenarios.length === 0) {
    throw new Error(`Store conformance suite has no scenarios: ${storeName}`);
  }

  const scenarioNames = new Set<string>();
  const passedScenarios: string[] = [];

  for (const scenario of suite.scenarios) {
    const scenarioName = scenario.name.trim();
    if (!scenarioName || scenarioNames.has(scenarioName)) {
      throw new Error(`Store conformance suite has an empty or duplicate scenario: ${scenario.name}`);
    }
    scenarioNames.add(scenarioName);
  }

  for (const scenario of suite.scenarios) {
    const scenarioName = scenario.name.trim();
    const store = await suite.createStore();
    let scenarioError: unknown;
    let disposeError: unknown;
    try {
      await scenario.run(store);
      passedScenarios.push(scenarioName);
    } catch (error) {
      scenarioError = error;
    } finally {
      try {
        await suite.disposeStore?.(store);
      } catch (error) {
        disposeError = error;
      }
    }
    if (scenarioError && disposeError) {
      throw new AggregateError(
        [scenarioError, disposeError],
        `Store conformance scenario and disposer failed: ${scenarioName}`,
      );
    }
    if (scenarioError) throw scenarioError;
    if (disposeError) throw disposeError;
  }

  return { storeName, passedScenarios };
}
