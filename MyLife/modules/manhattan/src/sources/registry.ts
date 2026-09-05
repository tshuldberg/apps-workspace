import type { EventSourceAdapter } from './types';
import { nycOpenDataAdapter } from './nyc-open-data';
import { icsImportAdapter } from './ics-import';
import { seatGeekAdapter } from './seatgeek';
import { tiktokOembedAdapter } from './tiktok-oembed';
import { shareIntentAdapter } from './share-intent';
import { gapAdapters } from './gaps';

export function buildSourceRegistry(): EventSourceAdapter[] {
  return [
    nycOpenDataAdapter,
    icsImportAdapter,
    seatGeekAdapter,
    tiktokOembedAdapter,
    shareIntentAdapter,
    ...gapAdapters,
  ];
}
