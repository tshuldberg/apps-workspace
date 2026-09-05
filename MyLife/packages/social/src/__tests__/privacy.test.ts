import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSocialClientMock } = vi.hoisted(() => ({
  getSocialClientMock: vi.fn(),
}));

vi.mock('../client-store', () => ({
  getSocialClient: getSocialClientMock,
}));

import { optOutOfSocial } from '../privacy';

describe('optOutOfSocial', () => {
  beforeEach(() => {
    getSocialClientMock.mockReset();
  });

  it('returns ok when the user has already opted out', async () => {
    getSocialClientMock.mockReturnValue({
      getMyProfile: vi.fn().mockResolvedValue({
        ok: true,
        data: null,
      }),
      deleteMyProfile: vi.fn(),
    });

    await expect(optOutOfSocial()).resolves.toEqual({ ok: true });
  });

  it('deletes the current profile through the client when one exists', async () => {
    const deleteMyProfile = vi.fn().mockResolvedValue({
      ok: true,
      data: undefined,
    });

    getSocialClientMock.mockReturnValue({
      getMyProfile: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: 'profile-1' },
      }),
      deleteMyProfile,
    });

    await expect(optOutOfSocial()).resolves.toEqual({ ok: true });
    expect(deleteMyProfile).toHaveBeenCalledTimes(1);
  });
});
