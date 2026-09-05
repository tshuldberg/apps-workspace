export {
  BASE_TABLES,
  CREATE_SETTINGS,
  CREATE_WISHLISTS,
  CREATE_WISHLIST_ITEMS,
  CREATE_PHOTOS,
  CREATE_PURCHASES,
  CREATE_USAGE_LOG,
  CREATE_WARRANTIES,
  CREATE_SIZES,
  CREATE_PREFERENCES,
  CREATE_GIFT_PEOPLE,
  CREATE_GIFTS_GIVEN,
  CREATE_GIFT_BUDGETS,
  WISHLIST_TABLES,
  WISHLIST_INDEXES,
  PURCHASES_TABLES,
  PURCHASES_INDEXES,
  USAGE_LOG_TABLES,
  USAGE_LOG_INDEXES,
  WARRANTIES_TABLES,
  WARRANTIES_INDEXES,
  SIZES_TABLES,
  SIZES_INDEXES,
  PREFERENCES_TABLES,
  PREFERENCES_INDEXES,
  GIFTS_TABLES,
  GIFTS_INDEXES,
  ALTER_WISHLIST_ITEMS_GIFT_FOR_PERSON,
  CREATE_THIRTY_DAY_RULE,
  THIRTY_DAY_RULE_TABLES,
  THIRTY_DAY_RULE_INDEXES,
  CREATE_COMPARISONS,
  COMPARISONS_TABLES,
  COMPARISONS_INDEXES,
  CREATE_STORE_NOTES,
  STORE_NOTES_TABLES,
  STORE_NOTES_INDEXES,
  getMigrations,
} from './schema';

export {
  createWishlist,
  getWishlistById,
  listWishlists,
  updateWishlist,
  deleteWishlist,
  generateShareToken,
  getWishlistByShareToken,
} from './crud/wishlists';

export {
  createWishlistItem,
  getWishlistItemById,
  updateWishlistItem,
  deleteWishlistItem,
  listItemsByWishlist,
  listItemsByCategory,
  listItemsByPriority,
  listItemsByGiftForPerson,
  markAsPurchased,
  moveItemToList,
  searchItems,
} from './crud/wishlist-items';

export {
  createPhoto,
  getPhotoById,
  deletePhoto,
  listPhotosByItem,
} from './crud/photos';

export {
  createPurchase,
  getPurchaseById,
  updatePurchase,
  deletePurchase,
  listPurchases,
  markReturned,
  updateSatisfaction,
  getPendingSatisfactionReviews,
} from './crud/purchases';

export {
  logUse,
  getUsageCount,
  getUsageHistory,
  deleteUsageEntry,
} from './crud/usage-log';

export {
  createWarranty,
  getWarrantyById,
  updateWarranty,
  deleteWarranty,
  listWarranties,
  listActiveWarranties,
  listExpiredWarranties,
  listExpiringSoon,
  fileClaim,
  getWarrantiesByPurchase,
  type ListWarrantiesOptions,
} from './crud/warranties';

export {
  createSize,
  getSizeById,
  updateSize,
  deleteSize,
  listSizes,
  listSizesByType,
  listSizesByBrand,
  searchSizesByBrand,
  type ListSizesOptions,
} from './crud/sizes';

export {
  createPreference,
  getPreferenceById,
  updatePreference,
  deletePreference,
  listPreferences,
  listPreferencesByCategory,
  getPreference,
} from './crud/preferences';

export {
  createGift,
  getGiftById,
  updateGift,
  deleteGift,
  listGifts,
  listGiftsByPerson,
  listGiftsByOccasion,
  getGiftHistory,
  getTotalSpentOnPerson,
  getUpcomingOccasions,
  type ListGiftsOptions,
  type UpcomingOccasion,
} from './crud/gifts';

export {
  createGiftPerson,
  getGiftPersonById,
  updateGiftPerson,
  deleteGiftPerson,
  listGiftPeople,
} from './crud/gift-people';

export {
  setGiftBudget,
  getGiftBudget,
  getGiftBudgetById,
  listGiftBudgetsForPerson,
  deleteGiftBudget,
} from './crud/gift-budgets';

export {
  addToWaitList,
  getWaitItemById,
  listWaitingItems,
  listAllWaitItems,
  markBought,
  markSkipped,
  deleteWaitItem,
  type ListWaitItemsOptions,
} from './crud/thirty-day-rule';

export {
  createComparison,
  getComparisonById,
  updateComparison,
  deleteComparison,
  listComparisons,
  listComparisonsByCategory,
  listRecentComparisons,
  linkComparisonToPurchase,
  searchComparisonsByCategory,
  type ListComparisonsOptions,
} from './crud/comparisons';

export {
  upsertStoreNote,
  getStoreNoteById,
  getStoreNoteByName,
  listStoreNotes,
  deleteStoreNote,
} from './crud/store-notes';
