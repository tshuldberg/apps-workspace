// Single source of truth for the web DM surface flag. Mirrors the mobile pattern
// (DM_MESSAGES_SURFACE_AVAILABLE lives in one module and every consumer imports
// it): ShareInbox (share-destination gating), capability-status ("What works
// today"), and MessagesView (the Message affordance) import THIS, so the honesty
// page can never claim DMs live while the surface is off. Plan 21 Phase 9 flipped
// this ONE constant to true when the real web DM store + thread pane + send/drain
// path shipped; every consumer updates together.
export const DM_MESSAGES_SURFACE_ENABLED = true;
