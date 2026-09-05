// Engine barrel export

export {
  parseRestaurantUrl,
  detectPlatform,
  parseGoogleMapsUrl,
  extractMetaFromHtml,
  isValidUrl,
  platformToUrlField,
} from './url-parser';
export type { Platform, ParsedRestaurant } from './url-parser';

export { processPhoto } from './photo-pipeline';
export type { PhotoPipelineOptions, PhotoPipelineResult } from './photo-pipeline';

export {
  buildDeeplink,
  getBestBookingPlatform,
  buildBookingUrl,
} from './deeplink';
export type { DeeplinkPlatform, DeeplinkOptions, DeeplinkResult } from './deeplink';

export {
  parseConfirmationEmail,
  detectEmailPlatform,
} from './email-parser';
export type { ParsedReservation } from './email-parser';

export { generateYearInReview } from './year-review';
export type { YearInReview } from './year-review';

export {
  parseCsvText,
  parseGoogleMapsExport,
} from './csv-importer';
export type { CsvRow, ImportResult, GoogleMapsPlace } from './csv-importer';
