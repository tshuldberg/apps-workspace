import { beforeEach, describe, expect, it, vi } from 'vitest';

const imagePicker = vi.hoisted(() => ({
  requestCameraPermissionsAsync: vi.fn(),
  launchCameraAsync: vi.fn(),
  launchImageLibraryAsync: vi.fn(),
}));
vi.mock('expo-image-picker', () => imagePicker);

import {
  buildVerificationSelfiePath,
  captureVerificationSelfie,
  uploadVerificationSelfie,
} from '../verification';
import { YearnRepository } from '../yearnRepository';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SUBMISSION_ID = '22222222-2222-4222-8222-222222222222';

beforeEach(() => {
  vi.clearAllMocks();
  imagePicker.requestCameraPermissionsAsync.mockResolvedValue({ status: 'granted' });
  imagePicker.launchCameraAsync.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///selfie.jpg', mimeType: 'image/jpeg' }],
  });
});

describe('buildVerificationSelfiePath', () => {
  it('builds the server-validated own-folder verification path', () => {
    expect(buildVerificationSelfiePath(USER_ID, 1753876800000)).toBe(
      `${USER_ID}/verification-selfie-1753876800000.jpg`,
    );
  });
});

describe('captureVerificationSelfie', () => {
  it('fails honestly when camera permission is denied and never opens the camera', async () => {
    imagePicker.requestCameraPermissionsAsync.mockResolvedValue({ status: 'denied' });
    const result = await captureVerificationSelfie(imagePicker);
    expect(result).toMatchObject({ ok: false, reason: 'permission_denied' });
    expect(imagePicker.launchCameraAsync).not.toHaveBeenCalled();
  });

  it('uses the CAMERA, never the photo library (live selfie requirement)', async () => {
    // Deliberately exercises the DEFAULT runtime so a swap to the photo
    // library inside the module itself cannot slip through.
    const result = await captureVerificationSelfie();
    expect(result).toMatchObject({ ok: true, localUri: 'file:///selfie.jpg' });
    expect(imagePicker.launchCameraAsync).toHaveBeenCalledWith(
      expect.objectContaining({ cameraType: 'front' }),
    );
    expect(imagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it('reports cancellation distinctly', async () => {
    imagePicker.launchCameraAsync.mockResolvedValue({ canceled: true });
    const result = await captureVerificationSelfie(imagePicker);
    expect(result).toMatchObject({ ok: false, reason: 'cancelled' });
  });
});

describe('uploadVerificationSelfie', () => {
  it('uploads into the verification folder without upsert', async () => {
    const upload = vi.fn().mockResolvedValue({
      data: { path: `${USER_ID}/verification-selfie-1.jpg` },
      error: null,
    });
    const from = vi.fn().mockReturnValue({ upload });
    const client = { storage: { from } } as never;
    const fetchBlob = vi.fn().mockResolvedValue({
      blob: () => Promise.resolve(new Blob(['x'])),
    });

    const path = await uploadVerificationSelfie(client, {
      userId: USER_ID,
      localUri: 'file:///selfie.jpg',
      fetchBlob: fetchBlob as never,
    });
    expect(path).toBe(`${USER_ID}/verification-selfie-1.jpg`);
    expect(from).toHaveBeenCalledWith('yearn-photos');
    const [uploadPath, , options] = upload.mock.calls[0] as [string, unknown, Record<string, unknown>];
    expect(uploadPath).toMatch(new RegExp(`^${USER_ID}/verification-selfie-\\d+\\.jpg$`));
    expect(options).toMatchObject({ upsert: false });
  });
});

describe('YearnRepository verification', () => {
  it('submits the selfie path through the definer RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: SUBMISSION_ID, error: null });
    const repository = new YearnRepository({ rpc } as never);
    await expect(
      repository.submitVerification(`${USER_ID}/verification-selfie-1.jpg`),
    ).resolves.toBe(SUBMISSION_ID);
    expect(rpc).toHaveBeenCalledWith('submit_verification', {
      p_selfie_path: `${USER_ID}/verification-selfie-1.jpg`,
    });
  });

  it('maps the latest submission state', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: SUBMISSION_ID,
        status: 'rejected',
        review_reason: 'Face does not match profile photos',
        created_at: '2026-07-30T12:00:00.000Z',
        reviewed_at: '2026-07-30T13:00:00.000Z',
      },
      error: null,
    });
    const limit = vi.fn().mockReturnValue({ maybeSingle });
    const order = vi.fn().mockReturnValue({ limit });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }),
      },
      from,
    } as never;
    const repository = new YearnRepository(client);

    await expect(repository.fetchMyVerification()).resolves.toEqual({
      id: SUBMISSION_ID,
      status: 'rejected',
      reviewReason: 'Face does not match profile photos',
      createdAt: '2026-07-30T12:00:00.000Z',
      reviewedAt: '2026-07-30T13:00:00.000Z',
    });
    expect(from).toHaveBeenCalledWith('verification_submissions');
    expect(eq).toHaveBeenCalledWith('user_id', USER_ID);
  });
});
