/**
 * Shared Tags — canonical tag vocabulary with polymorphic binding.
 */

// Types
export type {
  Tag,
  CreateTagInput,
  TagBinding,
  BindTagInput,
} from './types';

// Zod schemas (callers may use these for pre-write validation)
export {
  TagSchema,
  CreateTagInputSchema,
  TagBindingSchema,
  BindTagInputSchema,
} from './types';

// Operations
export {
  createTag,
  getOrCreateTag,
  getTagById,
  searchTags,
  bindTag,
  unbindTag,
  getTagsFor,
  getEntitiesForTag,
} from './operations';
