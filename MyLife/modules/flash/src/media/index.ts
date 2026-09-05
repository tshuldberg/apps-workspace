export type { MediaType, MediaFile, CreateMediaInput } from './types';
export {
  SUPPORTED_IMAGE_MIMES,
  SUPPORTED_AUDIO_MIMES,
  MAX_IMAGE_SIZE_BYTES,
  MAX_AUDIO_SIZE_BYTES,
  MAX_IMAGE_DIMENSION,
  validateMediaFile,
  mediaTagForImage,
  mediaTagForAudio,
  removeMediaTag,
} from './types';
