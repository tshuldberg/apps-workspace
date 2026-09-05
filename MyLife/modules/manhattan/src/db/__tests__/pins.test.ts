import { describe, it, expect } from 'vitest';
import { createModuleTestDatabase } from '@mylife/db';
import { MANHATTAN_MODULE } from '../../definition';
import { createPin, getPins, getPinById, setPinShareable, softDeletePin, updatePin } from '../crud/pins';

describe('manhattan pins CRUD', () => {
  it('creates, lists, reads', () => {
    const { adapter, close } = createModuleTestDatabase('manhattan', MANHATTAN_MODULE.migrations!);
    const id = createPin(adapter, { name: 'Equinox Bond Street', category: 'Gym', neighborhood: 'NoHo' });
    expect(getPins(adapter)).toHaveLength(1);
    expect(getPinById(adapter, id)?.name).toBe('Equinox Bond Street');
    close();
  });
  it('updates name and details while preserving the shareable flag', () => {
    const { adapter, close } = createModuleTestDatabase('manhattan', MANHATTAN_MODULE.migrations!);
    const id = createPin(adapter, { name: 'Equinox Bond Street', category: 'Gym' });
    setPinShareable(adapter, id, true);
    updatePin(adapter, id, { name: 'Equinox NoHo', category: 'Gym', neighborhood: 'NoHo', isShareable: true });
    const row = getPinById(adapter, id);
    expect(row?.name).toBe('Equinox NoHo');
    expect(row?.neighborhood).toBe('NoHo');
    expect(row?.is_shareable).toBe(1);
    expect(() => updatePin(adapter, id, { name: '' })).toThrow();
    close();
  });
  it('toggles shareable and soft-deletes', () => {
    const { adapter, close } = createModuleTestDatabase('manhattan', MANHATTAN_MODULE.migrations!);
    const id = createPin(adapter, { name: 'Westlight' });
    setPinShareable(adapter, id, true);
    expect(getPinById(adapter, id)?.is_shareable).toBe(1);
    softDeletePin(adapter, id);
    expect(getPinById(adapter, id)).toBeNull();
    close();
  });
});
