import { calculateCostPerWear } from './analytics';
import type { ClosetExportBundle, ClothingItem } from '../types';

function escapeCsv(value: string | number | null): string {
  if (value == null) {
    return '';
  }
  const text = String(value);
  if (!/[",\n]/.test(text)) {
    return text;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

function joinList(values: string[]): string {
  return values.join(', ');
}

function serializeItemsCsv(items: ClothingItem[]): string {
  const header = [
    'id',
    'name',
    'brand',
    'category',
    'color',
    'seasons',
    'occasions',
    'purchase_price',
    'purchase_date',
    'condition',
    'status',
    'laundry_status',
    'care_instructions',
    'times_worn',
    'wears_since_wash',
    'last_worn_date',
    'cost_per_wear',
    'notes',
    'photo_path',
    'created_at',
  ];

  const rows = items.map((item) => [
    item.id,
    item.name,
    item.brand,
    item.category,
    item.color,
    joinList(item.seasons),
    joinList(item.occasions),
    item.purchasePriceCents == null ? '' : (item.purchasePriceCents / 100).toFixed(2),
    item.purchaseDate,
    item.condition,
    item.status,
    item.laundryStatus,
    item.careInstructions,
    item.timesWorn,
    item.wearsSinceWash,
    item.lastWornDate,
    calculateCostPerWear(item) == null ? 'N/A' : (calculateCostPerWear(item)! / 100).toFixed(2),
    item.notes,
    item.imageUri,
    item.createdAt,
  ]);

  return [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
}

export function serializeClosetExport(bundle: ClosetExportBundle, format: 'json' | 'csv'): string {
  if (format === 'json') {
    return JSON.stringify(bundle, null, 2);
  }

  const sections = [
    `# closet-items.csv\n${serializeItemsCsv(bundle.items)}`,
    `# closet-outfits.csv\n${[
      ['id', 'name', 'item_ids', 'occasion', 'season', 'created_at'],
      ...bundle.outfits.map((outfit) => [
        outfit.id,
        outfit.name,
        joinList(outfit.itemIds),
        outfit.occasion,
        outfit.season,
        outfit.createdAt,
      ]),
    ].map((row) => row.map(escapeCsv).join(',')).join('\n')}`,
    `# closet-wear-logs.csv\n${[
      ['id', 'date', 'outfit_id', 'item_ids', 'notes'],
      ...bundle.wearLogs.map((log) => [
        log.id,
        log.date,
        log.outfitId,
        joinList(log.itemIds),
        log.notes,
      ]),
    ].map((row) => row.map(escapeCsv).join(',')).join('\n')}`,
    `# closet-laundry-events.csv\n${[
      ['id', 'clothing_item_id', 'event_type', 'event_date', 'wears_before_wash', 'created_at'],
      ...bundle.laundryEvents.map((event) => [
        event.id,
        event.clothingItemId,
        event.eventType,
        event.eventDate,
        event.wearsBeforeWash,
        event.createdAt,
      ]),
    ].map((row) => row.map(escapeCsv).join(',')).join('\n')}`,
    `# closet-packing-lists.csv\n${[
      ['id', 'name', 'start_date', 'end_date', 'season', 'mode', 'occasions', 'item_count'],
      ...bundle.packingLists.map((list) => [
        list.id,
        list.name,
        list.startDate,
        list.endDate,
        list.season,
        list.mode,
        joinList(list.occasions),
        list.items.length,
      ]),
    ].map((row) => row.map(escapeCsv).join(',')).join('\n')}`,
    `# closet-settings.csv\n${[
      ['key', 'value'],
      ...bundle.settings.map((setting) => [setting.key, setting.value]),
    ].map((row) => row.map(escapeCsv).join(',')).join('\n')}`,
  ];

  return sections.join('\n\n');
}
