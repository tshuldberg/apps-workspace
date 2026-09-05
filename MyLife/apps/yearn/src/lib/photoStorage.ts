import * as ImagePicker from 'expo-image-picker';
import type { AnySupabaseClient } from './supabase';
import type { YearnPhoto } from './yearnRepository';

export const YEARN_PHOTO_BUCKET = 'yearn-photos';

export interface YearnPickedPhoto {
  uri: string;
  width: number | null;
  height: number | null;
  mimeType: string;
  fileName: string | null;
}

export interface YearnUploadedPhoto {
  path: string;
  bucket: typeof YEARN_PHOTO_BUCKET;
  mimeType: string;
}

export interface YearnSignedPhoto extends YearnPhoto {
  signedUrl: string | null;
}

type ImagePickerLauncher = (
  options: ImagePicker.ImagePickerOptions,
) => Promise<ImagePicker.ImagePickerResult>;

type FetchBlob = (uri: string) => Promise<{
  blob: () => Promise<Blob>;
}>;

function inferMimeType(uri: string, fallback = 'image/jpeg'): string {
  const cleanUri = uri.split('?')[0]?.toLowerCase() ?? uri.toLowerCase();
  if (cleanUri.endsWith('.png')) return 'image/png';
  if (cleanUri.endsWith('.webp')) return 'image/webp';
  if (cleanUri.endsWith('.heic')) return 'image/heic';
  if (cleanUri.endsWith('.heif')) return 'image/heif';
  return fallback;
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('heic')) return 'heic';
  if (mimeType.includes('heif')) return 'heif';
  return 'jpg';
}

function normalizePhotoId(photoId: string): string {
  return photoId.trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 72) || 'photo';
}

export function buildYearnPhotoStoragePath(
  userId: string,
  photoId: string,
  mimeType = 'image/jpeg',
): string {
  return `${userId}/${normalizePhotoId(photoId)}.${extensionForMimeType(mimeType)}`;
}

export async function pickYearnProfilePhoto(
  launcher: ImagePickerLauncher = ImagePicker.launchImageLibraryAsync,
): Promise<YearnPickedPhoto | null> {
  const result = await launcher({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [4, 5],
    quality: 0.86,
    exif: false,
  });

  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;

  return {
    uri: asset.uri,
    width: asset.width ?? null,
    height: asset.height ?? null,
    mimeType: asset.mimeType ?? inferMimeType(asset.uri),
    fileName: asset.fileName ?? null,
  };
}

export async function uploadYearnProfilePhoto(
  client: AnySupabaseClient,
  input: {
    userId: string;
    photoId: string;
    localUri: string;
    mimeType?: string | null;
    fetchBlob?: FetchBlob;
  },
): Promise<YearnUploadedPhoto> {
  const mimeType = input.mimeType ?? inferMimeType(input.localUri);
  const path = buildYearnPhotoStoragePath(input.userId, input.photoId, mimeType);
  const fetchBlob = input.fetchBlob ?? fetch;
  const response = await fetchBlob(input.localUri);
  const blob = await response.blob();
  const { data, error } = await client.storage
    .from(YEARN_PHOTO_BUCKET)
    .upload(path, blob, {
      cacheControl: '3600',
      contentType: mimeType,
      upsert: true,
    });

  if (error) throw new Error(error.message);

  return {
    path: data?.path ?? path,
    bucket: YEARN_PHOTO_BUCKET,
    mimeType,
  };
}

export const YEARN_PHOTO_SIGNED_URL_TTL_SECONDS = 120;

// The photo access policy in 20260712000002_yearn_photo_access_scope.sql revokes
// new reads when another-user surface disappears. This cap bounds stale signed
// URL access after an unmatch, pass, or block to 15 minutes.
export const YEARN_OTHER_PHOTO_SIGNED_URL_TTL_SECONDS = 900;

export async function createYearnPhotoSignedUrl(
  client: AnySupabaseClient,
  path: string,
  expiresInSeconds = YEARN_PHOTO_SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  const { data, error } = await client.storage
    .from(YEARN_PHOTO_BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error) throw new Error(error.message);
  if (!data?.signedUrl) throw new Error('Signed photo URL was not returned.');
  return data.signedUrl;
}

export async function resolveYearnPhotoSignedUrls(
  client: AnySupabaseClient,
  photos: YearnPhoto[],
  expiresInSeconds = YEARN_PHOTO_SIGNED_URL_TTL_SECONDS,
  viewerUserId?: string,
): Promise<YearnSignedPhoto[]> {
  return Promise.all(photos.map(async (photo) => {
    if (!photo.path) {
      return { ...photo, signedUrl: null };
    }

    const ownerUserId = photo.path.split('/')[0];
    const effectiveExpiresInSeconds = viewerUserId === ownerUserId
      ? expiresInSeconds
      : Math.min(expiresInSeconds, YEARN_OTHER_PHOTO_SIGNED_URL_TTL_SECONDS);

    let signedUrl: string | null = null;
    try {
      signedUrl = await createYearnPhotoSignedUrl(client, photo.path, effectiveExpiresInSeconds);
    } catch {
      signedUrl = null;
    }

    return {
      ...photo,
      signedUrl,
    };
  }));
}
