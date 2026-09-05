import { describe, expect, it, vi } from 'vitest';
import { YearnRepository, type YearnDiscoveryPrefs } from '../yearnRepository';
import { parseDiscoveryFilterInput } from '../discoveryFilters';

const USER_ID = '11111111-1111-4111-8111-111111111111';

function authedClient(extra: Record<string, unknown>) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }),
    },
    ...extra,
  } as never;
}

describe('YearnRepository location', () => {
  it('sends validated coordinates to update_my_location', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const repository = new YearnRepository({ rpc } as never);
    await repository.updateMyLocation(37.7749, -122.4194);
    expect(rpc).toHaveBeenCalledWith('update_my_location', {
      p_latitude: 37.7749,
      p_longitude: -122.4194,
    });
  });

  it('rejects out-of-range coordinates before any network call', async () => {
    const rpc = vi.fn();
    const repository = new YearnRepository({ rpc } as never);
    await expect(repository.updateMyLocation(91, 0)).rejects.toThrow();
    await expect(repository.updateMyLocation(0, 181)).rejects.toThrow();
    await expect(repository.updateMyLocation(Number.NaN, 0)).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('clears the stored location with explicit nulls', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const repository = new YearnRepository({ rpc } as never);
    await repository.clearMyLocation();
    expect(rpc).toHaveBeenCalledWith('update_my_location', {
      p_latitude: null,
      p_longitude: null,
    });
  });
});

describe('YearnRepository discovery prefs', () => {
  it('maps a prefs row to the client shape', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        min_age: 25,
        max_age: 40,
        max_distance_miles: 50,
        intention_filter: 'Life partner',
      },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const repository = new YearnRepository(authedClient({ from }));

    const prefs = await repository.fetchDiscoveryPrefs();
    expect(from).toHaveBeenCalledWith('discovery_prefs');
    expect(eq).toHaveBeenCalledWith('user_id', USER_ID);
    expect(prefs).toEqual({
      minAge: 25,
      maxAge: 40,
      maxDistanceMiles: 50,
      intentionFilter: 'Life partner',
    });
  });

  it('returns null when no prefs row exists', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const repository = new YearnRepository(authedClient({ from }));
    expect(await repository.fetchDiscoveryPrefs()).toBeNull();
  });

  it('upserts prefs keyed to the authenticated user', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ upsert });
    const repository = new YearnRepository(authedClient({ from }));

    const prefs: YearnDiscoveryPrefs = {
      minAge: 21,
      maxAge: null,
      maxDistanceMiles: 100,
      intentionFilter: null,
    };
    await repository.saveDiscoveryPrefs(prefs);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: USER_ID,
        min_age: 21,
        max_age: null,
        max_distance_miles: 100,
        intention_filter: null,
      }),
      { onConflict: 'user_id' },
    );
  });

  it('rejects an inverted age range before writing', async () => {
    const upsert = vi.fn();
    const from = vi.fn().mockReturnValue({ upsert });
    const repository = new YearnRepository(authedClient({ from }));
    await expect(
      repository.saveDiscoveryPrefs({
        minAge: 40,
        maxAge: 25,
        maxDistanceMiles: null,
        intentionFilter: null,
      }),
    ).rejects.toThrow();
    expect(upsert).not.toHaveBeenCalled();
  });

  it('rejects a minAge below 18 (age floor is not filterable away)', async () => {
    const upsert = vi.fn();
    const from = vi.fn().mockReturnValue({ upsert });
    const repository = new YearnRepository(authedClient({ from }));
    await expect(
      repository.saveDiscoveryPrefs({
        minAge: 17,
        maxAge: null,
        maxDistanceMiles: null,
        intentionFilter: null,
      }),
    ).rejects.toThrow();
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe('parseDiscoveryFilterInput', () => {
  const base = {
    minAgeText: '18',
    maxAgeText: '',
    maxDistanceText: '',
    intentionFilter: null,
  };

  it('parses blanks as no-cap and trims values', () => {
    expect(parseDiscoveryFilterInput({ ...base, minAgeText: ' 21 ' })).toEqual({
      minAge: 21,
      maxAge: null,
      maxDistanceMiles: null,
      intentionFilter: null,
    });
  });

  it('rejects a minimum age under 18', () => {
    expect(parseDiscoveryFilterInput({ ...base, minAgeText: '17' })).toMatch(/18/);
  });

  it('rejects an inverted range', () => {
    expect(
      parseDiscoveryFilterInput({ ...base, minAgeText: '30', maxAgeText: '25' }),
    ).toMatch(/below the minimum/);
  });

  it('rejects distances outside 1-500', () => {
    expect(parseDiscoveryFilterInput({ ...base, maxDistanceText: '0' })).toMatch(/miles/);
    expect(parseDiscoveryFilterInput({ ...base, maxDistanceText: '501' })).toMatch(/miles/);
  });

  it('passes the intention filter through', () => {
    expect(
      parseDiscoveryFilterInput({ ...base, intentionFilter: 'Slow burn' }),
    ).toMatchObject({ intentionFilter: 'Slow burn' });
  });
});
