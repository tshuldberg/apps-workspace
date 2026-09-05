// Database layer -- SQLite schema and CRUD

// Schema SQL
export { ALL_TABLES, CREATE_INDEXES, CREATE_SETTINGS, V2_TABLES, V2_INDEXES } from './schema';

// CRUD operations
export {
  createRestaurant,
  getRestaurant,
  updateRestaurant,
  deleteRestaurant,
  listRestaurants,
  markVisited,
  incrementVisitCount,
  recalcAverageRating,
  createTag,
  listTags,
  addTagToRestaurant,
  removeTagFromRestaurant,
  getTagsForRestaurant,
} from './crud';

// Seeds
export { seedCuisineTags, CUISINE_SEEDS } from './seeds';
