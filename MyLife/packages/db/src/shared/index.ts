/**
 * Shared-entity adapters over the hub-level tables added in Phase 1a.
 *
 * Each sub-module exposes typed CRUD for a single hub entity. Module
 * authors import from here instead of writing raw SQL against hub tables.
 *
 * Wave A (this export surface): attachments, tags, places.
 * Waves B (reminders/goals/events), C (people/body_metrics/foods/books),
 * and D (timeline/cost_events) ship in follow-on phases.
 */

export * from './attachments';
export * from './tags';
export * from './places';
