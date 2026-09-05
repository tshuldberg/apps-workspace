/**
 * Import adapter registry.
 *
 * Central registry where adapters register themselves. The onboarding UI
 * queries the registry to discover which import formats are available for
 * a given module, and to auto-detect the right adapter for an uploaded file.
 */

import type { ModuleId } from '@mylife/module-registry';
import type { ImportAdapter, FormatDetection } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- registry stores heterogeneous adapters
type AnyAdapter = ImportAdapter<any, any>;

/** Internal storage for registered adapters. */
const adapters: AnyAdapter[] = [];

/**
 * Register an import adapter. Call this at module initialization time.
 * Duplicate registrations (same adapter name) are silently ignored.
 */
export function registerAdapter(adapter: AnyAdapter): void {
  if (adapters.some((a) => a.name === adapter.name)) return;
  adapters.push(adapter);
}

/**
 * Get all registered adapters that import into the given module.
 */
export function getAdaptersForModule(moduleId: ModuleId): AnyAdapter[] {
  return adapters.filter((a) => a.targetModule === moduleId);
}

/**
 * Get a registered adapter by its unique name.
 */
export function getAdapterByName(name: string): AnyAdapter | undefined {
  return adapters.find((a) => a.name === name);
}

/**
 * Get all registered adapters.
 */
export function getAllAdapters(): AnyAdapter[] {
  return [...adapters];
}

/** Result of auto-detection, pairing an adapter with its confidence. */
export interface DetectionResult {
  adapter: AnyAdapter;
  detection: FormatDetection;
}

/**
 * Auto-detect which adapter(s) can handle the given file content.
 * Returns all matching adapters sorted by confidence (highest first).
 * Returns an empty array if no adapter recognizes the file.
 */
export function detectAdapter(
  content: string,
  fileName?: string,
): DetectionResult[] {
  const results: DetectionResult[] = [];

  for (const adapter of adapters) {
    const detection = adapter.detectFormat(content, fileName);
    if (detection.detected) {
      results.push({ adapter, detection });
    }
  }

  results.sort((a, b) => b.detection.confidence - a.detection.confidence);
  return results;
}

/**
 * Remove all registered adapters. Primarily for testing.
 */
export function clearRegistry(): void {
  adapters.length = 0;
}
