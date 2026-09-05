import {
  SAMPLE_EXPIRATION_OCR_TEXT,
  SAMPLE_GROCERY_PHOTO_JSON,
  SAMPLE_RECEIPT_OCR_TEXT,
} from './kitchen';
import { shouldUseDemoFixturesInDev } from './public-render-policy';

export function getInitialGroceryPhotoCandidates(): string {
  return shouldUseDemoFixturesInDev() ? SAMPLE_GROCERY_PHOTO_JSON : '';
}

export function getInitialReceiptOcrText(): string {
  return shouldUseDemoFixturesInDev() ? SAMPLE_RECEIPT_OCR_TEXT : '';
}

export function getInitialExpirationOcrText(): string {
  return shouldUseDemoFixturesInDev() ? SAMPLE_EXPIRATION_OCR_TEXT : '';
}
