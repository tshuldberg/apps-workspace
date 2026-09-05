import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_DELETION_GRACE_DAYS,
  ACCOUNT_DELETION_REMOVED,
  ACCOUNT_DELETION_RETAINED,
  DELETION_CONFIRMATION_PHRASE,
} from '@mylife/mynews/cloud-fetch';

const PAGE_PATH = join(import.meta.dirname, '../app/account/delete/page.tsx');
const source = readFileSync(PAGE_PATH, 'utf8');

describe('public /account/delete page', () => {
  it('exists and is rendered per request so the contact line stays capability-keyed', () => {
    expect(source).toContain("export const dynamic = 'force-dynamic'");
    expect(source).toContain('readWebLegalContext');
  });

  it('offers no form, no input, and no fake submission path', () => {
    // A form here could not verify who the visitor is (the site has no sign-in
    // yet), so there must not be one.
    for (const tag of ['<form', '<input', '<textarea', '<button', 'action=', 'onSubmit']) {
      expect(source, tag).not.toContain(tag);
    }
    expect(source).not.toContain('useState');
    expect(source).not.toContain("'use client'");
  });

  it('says where deletion actually happens and names the typed phrase', () => {
    expect(source).toContain('DELETION_CONFIRMATION_PHRASE');
    expect(source).toMatch(/inside the MyNews app/i);
    expect(source).toMatch(/Delete my account/);
  });

  it('discloses the grace period, cancellability, and the one-way point', () => {
    expect(source).toContain('ACCOUNT_DELETION_GRACE_DAYS');
    expect(source).toMatch(/cancel at any point inside that/i);
    expect(source).toMatch(/no longer be cancelled/i);
  });

  it('renders the retained and removed lists from the shared module constants', () => {
    // The lists must come from the module so this page, the app screens, and the
    // privacy policy can never disagree about what deletion does.
    expect(source).toContain('ACCOUNT_DELETION_RETAINED.map');
    expect(source).toContain('ACCOUNT_DELETION_REMOVED.map');
    expect(source).not.toContain('anonymized profile.</li>');
    expect(ACCOUNT_DELETION_RETAINED.length).toBeGreaterThan(0);
    expect(ACCOUNT_DELETION_REMOVED.length).toBeGreaterThan(0);
    expect(ACCOUNT_DELETION_GRACE_DAYS).toBe(7);
    expect(DELETION_CONFIRMATION_PHRASE).toBe('DELETE MY ACCOUNT');
  });

  it('publishes a contact address only when the deployment has one', () => {
    expect(source).toContain('capabilities.emailContact');
    expect(source).toMatch(/has not published a contact address yet/i);
    // No literal address in the page source.
    expect(source).not.toMatch(/[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  });

  it('points at the export flow before deletion and at the privacy policy', () => {
    expect(source).toMatch(/Export my data/);
    expect(source).toContain('/legal/privacy');
  });
});
