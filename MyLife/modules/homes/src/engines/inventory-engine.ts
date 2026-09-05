import type { InventoryItem, Room } from '../types';

export interface PropertyInventoryValue {
  totalEstimatedCents: number;
  totalPurchaseCents: number;
  itemCount: number;
}

export interface RoomSummaryEntry {
  room: Room;
  itemCount: number;
  totalValueCents: number;
}

export function getPropertyInventoryValue(
  items: InventoryItem[],
): PropertyInventoryValue {
  let totalEstimatedCents = 0;
  let totalPurchaseCents = 0;

  for (const item of items) {
    if (item.estimatedValueCents !== null) {
      totalEstimatedCents += item.estimatedValueCents;
    }
    if (item.purchasePriceCents !== null) {
      totalPurchaseCents += item.purchasePriceCents;
    }
  }

  return {
    totalEstimatedCents,
    totalPurchaseCents,
    itemCount: items.length,
  };
}

export function getRoomSummary(
  items: InventoryItem[],
  rooms: Room[],
): RoomSummaryEntry[] {
  const roomItemMap = new Map<string, { count: number; valueCents: number }>();

  for (const item of items) {
    const existing = roomItemMap.get(item.roomId) ?? { count: 0, valueCents: 0 };
    existing.count += 1;
    if (item.estimatedValueCents !== null) {
      existing.valueCents += item.estimatedValueCents;
    }
    roomItemMap.set(item.roomId, existing);
  }

  return rooms.map((room) => {
    const data = roomItemMap.get(room.id) ?? { count: 0, valueCents: 0 };
    return {
      room,
      itemCount: data.count,
      totalValueCents: data.valueCents,
    };
  });
}

export function getItemsByCategory(
  items: InventoryItem[],
): Map<string, InventoryItem[]> {
  const result = new Map<string, InventoryItem[]>();

  for (const item of items) {
    const existing = result.get(item.category) ?? [];
    existing.push(item);
    result.set(item.category, existing);
  }

  return result;
}

export function getHighValueItems(
  items: InventoryItem[],
  thresholdCents: number,
): InventoryItem[] {
  return items.filter(
    (item) =>
      item.estimatedValueCents !== null &&
      item.estimatedValueCents >= thresholdCents,
  );
}

export function exportInventoryCSV(items: InventoryItem[]): string {
  const header = 'Name,Category,Brand,Model,Serial,Condition,PurchaseDate,PurchasePrice,EstimatedValue,Room';
  const rows = items.map((item) => {
    const purchasePrice =
      item.purchasePriceCents !== null
        ? (item.purchasePriceCents / 100).toFixed(2)
        : '';
    const estimatedValue =
      item.estimatedValueCents !== null
        ? (item.estimatedValueCents / 100).toFixed(2)
        : '';

    return [
      csvEscape(item.name),
      csvEscape(item.category),
      csvEscape(item.brand ?? ''),
      csvEscape(item.model ?? ''),
      csvEscape(item.serialNumber ?? ''),
      csvEscape(item.condition),
      csvEscape(item.purchaseDate ?? ''),
      purchasePrice,
      estimatedValue,
      csvEscape(item.roomId),
    ].join(',');
  });

  return [header, ...rows].join('\n');
}

function csvEscape(value: string): string {
  // Guard against CSV formula injection: prefix dangerous leading chars
  let safe = value;
  if (/^[=+\-@\t\r]/.test(safe)) {
    safe = `'${safe}`;
  }
  if (safe.includes(',') || safe.includes('"') || safe.includes('\n')) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}
