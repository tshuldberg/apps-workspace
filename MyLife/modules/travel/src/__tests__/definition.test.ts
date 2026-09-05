import { describe, expect, it } from 'vitest';
import { TRAVEL_MODULE } from '../definition';
import { TRAVEL_MIGRATIONS } from '../db/schema';

describe('TRAVEL_MODULE', () => {
  it('defines the expected module contract', () => {
    expect(TRAVEL_MODULE.id).toBe('travel');
    expect(TRAVEL_MODULE.name).toBe('MyTravel');
    expect(TRAVEL_MODULE.tablePrefix).toBe('tv_');
    expect(TRAVEL_MODULE.accentColor).toBe('#0EA5E9');
    expect(TRAVEL_MODULE.schemaVersion).toBe(7);
    expect(TRAVEL_MODULE.tier).toBe('premium');
    expect(TRAVEL_MODULE.storageType).toBe('sqlite');
    expect(TRAVEL_MODULE.requiresAuth).toBe(false);
    expect(TRAVEL_MODULE.requiresNetwork).toBe(false);
  });

  it('wires the four foundation tabs for P0-C', () => {
    expect(TRAVEL_MODULE.navigation.tabs.map((tab) => tab.key)).toEqual([
      'index',
      'destinations',
      'journal',
      'logistics',
    ]);
  });

  it('registers the settings stack screen for P0-C', () => {
    const screenNames = TRAVEL_MODULE.navigation.screens.map((screen) => screen.name);
    expect(screenNames).toContain('settings');
  });

  it('ships foundation + itinerary + logistics + bookings + extended logistics + packing + journal migrations', () => {
    expect(TRAVEL_MODULE.migrations).toBeDefined();
    expect(TRAVEL_MODULE.migrations).toHaveLength(7);
    expect(TRAVEL_MODULE.migrations?.[0]?.version).toBe(1);
    expect(TRAVEL_MODULE.migrations?.[1]?.version).toBe(2);
    expect(TRAVEL_MODULE.migrations?.[2]?.version).toBe(3);
    expect(TRAVEL_MODULE.migrations?.[3]?.version).toBe(4);
    expect(TRAVEL_MODULE.migrations?.[4]?.version).toBe(5);
    expect(TRAVEL_MODULE.migrations?.[5]?.version).toBe(6);
    expect(TRAVEL_MODULE.migrations?.[6]?.version).toBe(7);
    expect(TRAVEL_MIGRATIONS).toHaveLength(7);
  });

  it('v7 migration creates tv_journal_entries + tv_journal_memories tables and indexes', () => {
    const v7 = TRAVEL_MIGRATIONS[6];
    const upStatements = v7.up.join('\n');
    expect(upStatements).toContain('CREATE TABLE IF NOT EXISTS tv_journal_entries');
    expect(upStatements).toContain('CREATE TABLE IF NOT EXISTS tv_journal_memories');
    expect(upStatements).toContain('idx_tv_journal_entries_trip');
    expect(upStatements).toContain('idx_tv_journal_entries_destination');
    expect(upStatements).toContain('idx_tv_journal_entries_date');
    expect(upStatements).toContain('idx_tv_journal_entries_mood');
    expect(upStatements).toContain('idx_tv_journal_memories_entry_order');
    const downStatements = v7.down.join('\n');
    expect(downStatements).toContain('DROP TABLE IF EXISTS tv_journal_memories');
    expect(downStatements).toContain('DROP TABLE IF EXISTS tv_journal_entries');
  });

  it('v6 migration creates tv_packing_lists + tv_packing_items tables and indexes', () => {
    const v6 = TRAVEL_MIGRATIONS[5];
    const upStatements = v6.up.join('\n');
    expect(upStatements).toContain('CREATE TABLE IF NOT EXISTS tv_packing_lists');
    expect(upStatements).toContain('CREATE TABLE IF NOT EXISTS tv_packing_items');
    expect(upStatements).toContain('idx_tv_packing_lists_trip');
    expect(upStatements).toContain('idx_tv_packing_lists_template');
    expect(upStatements).toContain('idx_tv_packing_items_list_order');
    const downStatements = v6.down.join('\n');
    expect(downStatements).toContain('DROP TABLE IF EXISTS tv_packing_items');
    expect(downStatements).toContain('DROP TABLE IF EXISTS tv_packing_lists');
  });

  it('v5 migration creates emergency_contacts + currencies + checklist_items tables and indexes', () => {
    const v5 = TRAVEL_MIGRATIONS[4];
    const upStatements = v5.up.join('\n');
    expect(upStatements).toContain('CREATE TABLE IF NOT EXISTS tv_emergency_contacts');
    expect(upStatements).toContain('CREATE TABLE IF NOT EXISTS tv_currencies');
    expect(upStatements).toContain('CREATE TABLE IF NOT EXISTS tv_checklist_items');
    expect(upStatements).toContain('idx_tv_emergency_contacts_trip');
    expect(upStatements).toContain('idx_tv_currencies_trip');
    expect(upStatements).toContain('idx_tv_currencies_pair');
    expect(upStatements).toContain('idx_tv_checklist_items_trip');
    expect(upStatements).toContain('idx_tv_checklist_items_order');
    const downStatements = v5.down.join('\n');
    expect(downStatements).toContain('DROP TABLE IF EXISTS tv_emergency_contacts');
    expect(downStatements).toContain('DROP TABLE IF EXISTS tv_currencies');
    expect(downStatements).toContain('DROP TABLE IF EXISTS tv_checklist_items');
  });

  it('v4 migration creates tv_bookings table and indexes', () => {
    const v4 = TRAVEL_MIGRATIONS[3];
    const upStatements = v4.up.join('\n');
    expect(upStatements).toContain('CREATE TABLE IF NOT EXISTS tv_bookings');
    expect(upStatements).toContain('idx_tv_bookings_trip');
    expect(upStatements).toContain('idx_tv_bookings_type');
    expect(upStatements).toContain('idx_tv_bookings_start_ts');
    const downStatements = v4.down.join('\n');
    expect(downStatements).toContain('DROP TABLE IF EXISTS tv_bookings');
  });

  it('v3 migration creates documents + loyalty tables and indexes', () => {
    const v3 = TRAVEL_MIGRATIONS[2];
    const upStatements = v3.up.join('\n');
    expect(upStatements).toContain('CREATE TABLE IF NOT EXISTS tv_documents');
    expect(upStatements).toContain('CREATE TABLE IF NOT EXISTS tv_loyalty_programs');
    expect(upStatements).toContain('idx_tv_documents_type');
    expect(upStatements).toContain('idx_tv_documents_expiry');
    expect(upStatements).toContain('idx_tv_loyalty_type');
    const downStatements = v3.down.join('\n');
    expect(downStatements).toContain('DROP TABLE IF EXISTS tv_loyalty_programs');
    expect(downStatements).toContain('DROP TABLE IF EXISTS tv_documents');
  });

  it('v2 migration creates itinerary_days + activities tables and indexes', () => {
    const v2 = TRAVEL_MIGRATIONS[1];
    const upStatements = v2.up.join('\n');
    expect(upStatements).toContain('CREATE TABLE IF NOT EXISTS tv_itinerary_days');
    expect(upStatements).toContain('CREATE TABLE IF NOT EXISTS tv_activities');
    expect(upStatements).toContain('idx_tv_itinerary_days_trip');
    expect(upStatements).toContain('idx_tv_activities_day');
    expect(upStatements).toContain('idx_tv_activities_trip');
    const downStatements = v2.down.join('\n');
    expect(downStatements).toContain('DROP TABLE IF EXISTS tv_activities');
    expect(downStatements).toContain('DROP TABLE IF EXISTS tv_itinerary_days');
  });

  it('creates tv_trips, tv_destinations, and tv_settings tables', () => {
    const upStatements = TRAVEL_MIGRATIONS[0].up.join('\n');
    expect(upStatements).toContain('CREATE TABLE IF NOT EXISTS tv_trips');
    expect(upStatements).toContain('CREATE TABLE IF NOT EXISTS tv_destinations');
    expect(upStatements).toContain('CREATE TABLE IF NOT EXISTS tv_settings');
  });

  it('ships indexes for trips and destinations', () => {
    const upStatements = TRAVEL_MIGRATIONS[0].up.join('\n');
    expect(upStatements).toContain('idx_tv_trips_status');
    expect(upStatements).toContain('idx_tv_trips_start_date');
    expect(upStatements).toContain('idx_tv_destinations_country');
    expect(upStatements).toContain('idx_tv_destinations_bucket');
  });

  it('provides a down migration that drops all tables', () => {
    const downStatements = TRAVEL_MIGRATIONS[0].down.join('\n');
    expect(downStatements).toContain('DROP TABLE IF EXISTS tv_trips');
    expect(downStatements).toContain('DROP TABLE IF EXISTS tv_destinations');
    expect(downStatements).toContain('DROP TABLE IF EXISTS tv_settings');
  });
});
