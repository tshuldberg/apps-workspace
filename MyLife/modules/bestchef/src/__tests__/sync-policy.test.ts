import { describe, expect, it } from 'vitest';

import { RECIPES_MODULE } from '../definition';

function getRule(tableName: string) {
  const rule = RECIPES_MODULE.syncPolicy?.entityRules.find((entry) => entry.tableName === tableName);
  if (!rule) {
    throw new Error(`Missing BestChef sync rule for ${tableName}`);
  }
  return rule;
}

describe('BestChef mesh sync policy', () => {
  it('caps private kitchen inventory and local product data at personal replica', () => {
    const personalOnlyTables = [
      'recipe_grocery_flags',
      'food_products',
      'food_product_aliases',
      'food_confirmations',
      'nutrition_data',
      'unit_conversion_corrections',
      'pantry_items',
      'pantry_batches',
      'receipt_imports',
      'receipt_import_lines',
    ];

    for (const tableName of personalOnlyTables) {
      const rule = getRule(tableName);
      expect(rule.defaultScope, `${tableName} default scope`).toBe('personal_replica');
      expect(rule.maxScope, `${tableName} max scope`).toBe('personal_replica');
    }
  });

  it('keeps shared grocery lists opt-in while stripping raw receipt capture fields', () => {
    expect(getRule('shopping_lists')).toMatchObject({
      defaultScope: 'personal_replica',
      maxScope: 'shared_workspace',
    });
    expect(getRule('shopping_list_items')).toMatchObject({
      defaultScope: 'personal_replica',
      maxScope: 'shared_workspace',
    });

    expect(getRule('receipt_imports').stripColumns).toEqual(['photo_uri', 'raw_ocr_text']);
    expect(getRule('receipt_import_lines').stripColumns).toEqual(['candidate_json']);
  });

  it('keeps server product cache tables out of local mesh entity rules', () => {
    const tableNames = RECIPES_MODULE.syncPolicy?.entityRules.map((rule) => rule.tableName) ?? [];

    expect(tableNames.some((tableName) => tableName.startsWith('bc_product_'))).toBe(false);
    expect(tableNames).not.toContain('bc_product_records');
    expect(tableNames).not.toContain('bc_product_contributions');
    expect(tableNames).not.toContain('bc_product_evidence');
  });

  it('keeps local vote proof drafts device-local and stripped from mesh payloads', () => {
    const rule = getRule('local_vote_proofs');

    expect(rule.defaultScope).toBe('device_local');
    expect(rule.maxScope).toBe('device_local');
    expect(rule.stripColumns).toEqual(['local_image_uri', 'content_hash', 'failure_reason']);
  });

  it('keeps submission like cache and queue device-local', () => {
    expect(getRule('bestchef_submission_likes')).toMatchObject({
      defaultScope: 'device_local',
      maxScope: 'device_local',
    });
    expect(getRule('bestchef_submission_like_queue')).toMatchObject({
      defaultScope: 'device_local',
      maxScope: 'device_local',
    });
  });

  it('declares explicit device_local rules for every V28-V33 local-only table so nothing inherits the module personal_replica default outbound', () => {
    const deviceLocalTables = [
      'pending_reports',
      'bestchef_reports',
      'bestchef_blocks',
      'saved_submissions_cache',
      'media_upload_jobs',
      'pantry_staples',
    ];

    for (const tableName of deviceLocalTables) {
      const rule = getRule(tableName);
      expect(rule.defaultScope, `${tableName} default scope`).toBe('device_local');
      expect(rule.maxScope, `${tableName} max scope`).toBe('device_local');
    }
  });
});
