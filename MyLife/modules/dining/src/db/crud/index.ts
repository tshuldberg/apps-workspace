// CRUD barrel export

export {
  createRestaurant,
  getRestaurant,
  updateRestaurant,
  deleteRestaurant,
  listRestaurants,
  markVisited,
  incrementVisitCount,
  decrementVisitCount,
  recalcAverageRating,
} from './restaurants';

export {
  createTag,
  listTags,
  addTagToRestaurant,
  removeTagFromRestaurant,
  getTagsForRestaurant,
} from './tags';

export {
  createVisit,
  getVisit,
  updateVisit,
  deleteVisit,
  listVisitsByRestaurant,
  listVisitsChronological,
  getVisitStats,
} from './visits';

export {
  createPhoto,
  getPhoto,
  deletePhoto,
  listPhotosByVisit,
  listPhotosByDish,
} from './photos';

export {
  createCompanion,
  listCompanionsByVisit,
  deleteCompanion,
} from './companions';

export {
  createWatchlistEntry,
  getWatchlistEntry,
  updateWatchlistEntry,
  deleteWatchlistEntry,
  listWatchlistEntries,
  fulfillWatchlistEntry,
  expireStaleEntries,
} from './watchlist';

export {
  createDish,
  getDish,
  updateDish,
  deleteDish,
  listDishesByVisit,
  listDishesByRestaurant,
  listTopDishes,
  checkAllergens,
} from './dishes';
export type { AllergenMatch } from './dishes';

export {
  createWine,
  getWine,
  updateWine,
  deleteWine,
  listWinesByVisit,
  listWinesByRestaurant,
} from './wines';

export {
  createReservation,
  getReservation,
  updateReservation,
  deleteReservation,
  listReservations,
  listUpcomingReservations,
  cancelReservation,
  completeReservation,
  markNoShow,
  getReservationsByDateRange,
} from './reservations';

export {
  createImport,
  getImport,
  confirmImport,
  rejectImport,
  listPendingImports,
} from './imports';

export { importCsvRows } from './import-restaurants';
