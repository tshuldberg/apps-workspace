import { describe, expect, it } from 'vitest';
import {
  FREE_MODULES,
  GA_MODULE_IDS,
  MODULE_RELEASE_STATES,
  MODULE_IDS,
  MODULE_METADATA,
  ModuleDefinitionSchema,
  ModuleIdSchema,
  ModuleRegistry,
  PUBLIC_BETA_MODULE_IDS,
} from '../index';
import {
  FREE_MODULES as FREE_MODULES_DIRECT,
  MODULE_IDS as MODULE_IDS_DIRECT,
  MODULE_METADATA as MODULE_METADATA_DIRECT,
} from '../constants';
import {
  ModuleRegistryContext as ModuleRegistryContextDirect,
  useEnabledModules as useEnabledModulesDirect,
  useModule as useModuleDirect,
  useModuleRegistry as useModuleRegistryDirect,
} from '../hooks';
import {
  GA_MODULE_IDS as GA_MODULE_IDS_DIRECT,
  MODULE_RELEASE_STATES as MODULE_RELEASE_STATES_DIRECT,
  PUBLIC_BETA_MODULE_IDS as PUBLIC_BETA_MODULE_IDS_DIRECT,
} from '../release-states';
import { ModuleRegistry as ModuleRegistryDirect } from '../registry';
import {
  ModuleDefinitionSchema as ModuleDefinitionSchemaDirect,
  ModuleIdSchema as ModuleIdSchemaDirect,
} from '../types';

describe('index barrel exports', () => {
  it('re-exports constants and runtime symbols by reference', () => {
    expect(MODULE_IDS).toBe(MODULE_IDS_DIRECT);
    expect(FREE_MODULES).toBe(FREE_MODULES_DIRECT);
    expect(MODULE_METADATA).toBe(MODULE_METADATA_DIRECT);
    expect(GA_MODULE_IDS).toBe(GA_MODULE_IDS_DIRECT);
    expect(PUBLIC_BETA_MODULE_IDS).toBe(PUBLIC_BETA_MODULE_IDS_DIRECT);
    expect(MODULE_RELEASE_STATES).toBe(MODULE_RELEASE_STATES_DIRECT);
    expect(ModuleRegistry).toBe(ModuleRegistryDirect);
    expect(ModuleIdSchema).toBe(ModuleIdSchemaDirect);
    expect(ModuleDefinitionSchema).toBe(ModuleDefinitionSchemaDirect);
  });

  it('keeps React hooks on the dedicated hooks entrypoint', () => {
    expect(ModuleRegistryContextDirect).toBeDefined();
    expect(useModuleRegistryDirect).toBeDefined();
    expect(useEnabledModulesDirect).toBeDefined();
    expect(useModuleDirect).toBeDefined();
  });
});
