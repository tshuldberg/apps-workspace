import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('market schema triggers', () => {
  it('keeps message and seller stats triggers delete-aware and supports secure service listings', () => {
    const schema = readFileSync(
      new URL('../cloud/schema.sql', import.meta.url),
      'utf8',
    );

    expect(schema).toContain('after insert or delete on mk_messages');
    expect(schema).toContain('create or replace function mk_sync_seller_listing_stats()');
    expect(schema).toContain('greatest(0, watch_count - 1)');
    expect(schema).toContain("'service_offer'");
    expect(schema).toContain('fulfillment_type');
    expect(schema).toContain("content_type in ('text/plain', 'application/e2ee+ciphertext')");
    expect(schema).toContain('create table if not exists mk_message_requests');
    expect(schema).toContain('create table if not exists mk_secure_devices');
    expect(schema).toContain('create table if not exists mk_signed_prekeys');
    expect(schema).toContain('create table if not exists mk_one_time_prekeys');
    expect(schema).toContain('create table if not exists mk_secure_messages');
    expect(schema).toContain('create or replace function mk_claim_recipient_prekey_bundles');
    expect(schema).toContain('create trigger mk_secure_messages_last_message');
    expect(schema).toContain('create trigger mk_secure_messages_listing_count');
    expect(schema).toContain("envelope_type in ('prekey_signal_message', 'signal_message', 'sealed_sender_message')");
  });
});
