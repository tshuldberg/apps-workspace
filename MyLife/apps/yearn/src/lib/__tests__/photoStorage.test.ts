import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: vi.fn(),
}));

import {
  buildYearnPhotoStoragePath,
  createYearnPhotoSignedUrl,
  pickYearnProfilePhoto,
  resolveYearnPhotoSignedUrls,
  uploadYearnProfilePhoto,
  YEARN_OTHER_PHOTO_SIGNED_URL_TTL_SECONDS,
  YEARN_PHOTO_BUCKET,
} from '../photoStorage';

describe('photoStorage', () => {
  it('builds owner-scoped storage paths with safe ids', () => {
    expect(buildYearnPhotoStoragePath(
      '11111111-1111-1111-1111-111111111111',
      'photo 1/cover',
      'image/png',
    )).toBe('11111111-1111-1111-1111-111111111111/photo-1-cover.png');
  });

  it('maps picked library assets into upload input', async () => {
    const launcher = vi.fn().mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///tmp/profile.jpg',
          width: 1200,
          height: 1500,
          mimeType: 'image/jpeg',
          fileName: 'profile.jpg',
        },
      ],
    });

    await expect(pickYearnProfilePhoto(launcher)).resolves.toEqual({
      uri: 'file:///tmp/profile.jpg',
      width: 1200,
      height: 1500,
      mimeType: 'image/jpeg',
      fileName: 'profile.jpg',
    });
    expect(launcher).toHaveBeenCalledWith(expect.objectContaining({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 5],
    }));
  });

  it('uploads profile photos to the private Yearn bucket', async () => {
    const upload = vi.fn().mockResolvedValue({
      data: { path: 'user-id/photo-1.jpg' },
      error: null,
    });
    const from = vi.fn().mockReturnValue({ upload });
    const fetchBlob = vi.fn().mockResolvedValue({
      blob: vi.fn().mockResolvedValue(new Blob(['photo'])),
    });

    const result = await uploadYearnProfilePhoto({
      storage: { from },
    } as never, {
      userId: 'user-id',
      photoId: 'photo-1',
      localUri: 'file:///tmp/photo.jpg',
      mimeType: 'image/jpeg',
      fetchBlob,
    });

    expect(result).toEqual({
      path: 'user-id/photo-1.jpg',
      bucket: YEARN_PHOTO_BUCKET,
      mimeType: 'image/jpeg',
    });
    expect(from).toHaveBeenCalledWith(YEARN_PHOTO_BUCKET);
    expect(upload).toHaveBeenCalledWith(
      'user-id/photo-1.jpg',
      expect.any(Blob),
      expect.objectContaining({
        contentType: 'image/jpeg',
        upsert: true,
      }),
    );
  });

  it('creates signed URLs for persisted photo paths', async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://signed.example/photo' },
      error: null,
    });
    const from = vi.fn().mockReturnValue({ createSignedUrl });
    const client = { storage: { from } } as never;

    await expect(createYearnPhotoSignedUrl(
      client,
      'user-id/photo-1.jpg',
      120,
    )).resolves.toBe('https://signed.example/photo');

    await expect(resolveYearnPhotoSignedUrls(client, [
      { path: 'user-id/photo-1.jpg', symbol: 'sparkles' },
      { path: null, symbol: 'book' },
    ], 120)).resolves.toEqual([
      { path: 'user-id/photo-1.jpg', symbol: 'sparkles', signedUrl: 'https://signed.example/photo' },
      { path: null, symbol: 'book', signedUrl: null },
    ]);
    expect(createSignedUrl).toHaveBeenCalledWith('user-id/photo-1.jpg', 120);
  });

  it('caps other-user signed photo URLs at 15 minutes', async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://signed.example/photo' },
      error: null,
    });
    const from = vi.fn().mockReturnValue({ createSignedUrl });
    const client = { storage: { from } } as never;

    expect(YEARN_OTHER_PHOTO_SIGNED_URL_TTL_SECONDS).toBe(900);
    await resolveYearnPhotoSignedUrls(client, [
      { path: 'other-user/photo-1.jpg', symbol: 'sparkles' },
    ], 3_600, 'viewer-user');

    expect(createSignedUrl).toHaveBeenCalledWith('other-user/photo-1.jpg', 900);
  });

  it('uses the safer other-user TTL cap when the viewer is unknown', async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://signed.example/photo' },
      error: null,
    });
    const from = vi.fn().mockReturnValue({ createSignedUrl });
    const client = { storage: { from } } as never;

    await resolveYearnPhotoSignedUrls(client, [
      { path: 'owner-user/photo-1.jpg', symbol: 'sparkles' },
    ], 3_600);

    expect(createSignedUrl).toHaveBeenCalledWith('owner-user/photo-1.jpg', 900);
  });

  it('does not cap own-photo signed URL TTLs', async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://signed.example/photo' },
      error: null,
    });
    const from = vi.fn().mockReturnValue({ createSignedUrl });
    const client = { storage: { from } } as never;

    await resolveYearnPhotoSignedUrls(client, [
      { path: 'viewer-user/photo-1.jpg', symbol: 'sparkles' },
    ], 3_600, 'viewer-user');

    expect(createSignedUrl).toHaveBeenCalledWith('viewer-user/photo-1.jpg', 3_600);
  });

  it('keeps deck photo resolution usable when one signed URL fails', async () => {
    const createSignedUrl = vi.fn()
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'not allowed' },
      })
      .mockResolvedValueOnce({
        data: { signedUrl: 'https://signed.example/photo-2' },
        error: null,
      });
    const from = vi.fn().mockReturnValue({ createSignedUrl });
    const client = { storage: { from } } as never;

    await expect(resolveYearnPhotoSignedUrls(client, [
      { path: 'other-user/photo-1.jpg', symbol: 'one' },
      { path: 'other-user/photo-2.jpg', symbol: 'two' },
    ], 120)).resolves.toEqual([
      { path: 'other-user/photo-1.jpg', symbol: 'one', signedUrl: null },
      { path: 'other-user/photo-2.jpg', symbol: 'two', signedUrl: 'https://signed.example/photo-2' },
    ]);
  });
});
