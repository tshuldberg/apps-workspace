// @mylife/books — MyBooks module

// Module definition
export { BOOKS_MODULE } from './definition';

// Cross-module interface
export { booksCrossModule } from './cross-module';

// Models and Zod schemas
export * from './models/index';

// Database CRUD operations
export * from './db/index';

// Open Library API
export * from './api/index';

// Import parsers (Goodreads, StoryGraph)
export * from './import/index';

// Export formatters (CSV, JSON, Markdown)
export * from './export/index';

// Stats and year-in-review
export * from './stats/index';

// E-reader upload parsing helpers
export * from './reader/index';

// Progress engine
export * from './progress/index';

// Discovery engine
export * from './discovery/index';

// Challenge engine
export * from './challenges/index';

// Journal engine
export * from './journal/index';

// Recommendations engine
export * from './recommendations/index';

// Stats sharing (card templates and renderer)
export * from './sharing/index';

// Book clubs
export * from './clubs/index';

// Badge/achievement system
export * from './badges/index';

// Social feed
export * from './social/index';

// Community challenges
export * from './community-challenges/index';

// Reading insights engine
export * from './insights/index';

// Quote collection
export * from './quotes/index';

// Automation rules
export * from './automations/highlight-to-flash';

// UI design tokens (Obsidian Noir design system)
export * from './ui/typography';
export * from './ui/tokens';
