import type { DatabaseAdapter } from '@mylife/db';
import type {
  GardenZone,
  LayoutItem,
  Plant,
  Propagation,
  PropagationStage,
  WishListPriority,
} from '@mylife/garden';

export type ExtendedZone = GardenZone & {
  zoneType: string | null;
  icon: string | null;
  color: string | null;
  photoUri: string | null;
  lightLevel: string | null;
  humidity: string | null;
  temperatureNotes: string | null;
  updatedAt: string | null;
};

export function createLocalId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function getExtendedZones(db: DatabaseAdapter): ExtendedZone[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM gd_zones ORDER BY sort_order ASC, name ASC',
    )
    .map((row) => ({
      id: row.id as string,
      name: row.name as string,
      location: row.location as GardenZone['location'],
      description: (row.description as string) ?? null,
      sortOrder: (row.sort_order as number) ?? 0,
      createdAt: row.created_at as string,
      zoneType: (row.zone_type as string) ?? null,
      icon: (row.icon as string) ?? null,
      color: (row.color as string) ?? null,
      photoUri: (row.photo_uri as string) ?? null,
      lightLevel: (row.light_level as string) ?? null,
      humidity: (row.humidity as string) ?? null,
      temperatureNotes: (row.temperature_notes as string) ?? null,
      updatedAt: (row.updated_at as string) ?? null,
    }));
}

export function getAllPropagations(db: DatabaseAdapter): Propagation[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM gd_propagations ORDER BY start_date DESC, created_at DESC',
    )
    .map((row) => ({
      id: row.id as string,
      parentPlantId: (row.parent_plant_id as string) ?? null,
      method: row.method as Propagation['method'],
      medium: (row.medium as Propagation['medium']) ?? null,
      startDate: row.start_date as string,
      currentStage: row.current_stage as Propagation['currentStage'],
      stageUpdatedAt: row.stage_updated_at as string,
      notes: (row.notes as string) ?? null,
      imageUri: (row.image_uri as string) ?? null,
      childPlantId: (row.child_plant_id as string) ?? null,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    }));
}

export function zoneMatchesPlant(
  plant: Pick<Plant, 'zone'>,
  zone: Pick<GardenZone, 'id' | 'name'>,
): boolean {
  return plant.zone === zone.id || plant.zone === zone.name;
}

export function formatRelativeDate(dateLike: string): string {
  const parsed = new Date(dateLike);
  if (Number.isNaN(parsed.getTime())) return dateLike;

  const now = new Date();
  const diffMs = now.getTime() - parsed.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return 'moments ago';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function initials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export type GardenCategory =
  | 'vegetable'
  | 'herb'
  | 'flower'
  | 'tree'
  | 'shrub'
  | 'houseplant';

export function classifyGardenCategory(
  name?: string | null,
  species?: string | null,
): GardenCategory {
  const haystack = `${name ?? ''} ${species ?? ''}`.toLowerCase();

  if (
    /basil|mint|thyme|oregano|rosemary|sage|cilantro|parsley|dill|chive/.test(
      haystack,
    )
  ) {
    return 'herb';
  }

  if (
    /tomato|pepper|carrot|lettuce|bean|pea|cucumber|squash|radish|kale|broccoli|spinach|onion|garlic|zucchini|eggplant/.test(
      haystack,
    )
  ) {
    return 'vegetable';
  }

  if (
    /rose|dahlia|marigold|zinnia|lavender|sunflower|orchid|lily|tulip|poppy|jasmine/.test(
      haystack,
    )
  ) {
    return 'flower';
  }

  if (/ficus|maple|oak|citrus|olive|apple|pear|lemon|monstera deliciosa tree/.test(haystack)) {
    return 'tree';
  }

  if (/camellia|hydrangea|azalea|boxwood|shrub/.test(haystack)) {
    return 'shrub';
  }

  return 'houseplant';
}

export function priorityToStars(priority: WishListPriority): number {
  if (priority === 'high') return 5;
  if (priority === 'medium') return 3;
  return 1;
}

export function starsToPriority(stars: number): WishListPriority {
  if (stars >= 4) return 'high';
  if (stars >= 2) return 'medium';
  return 'low';
}

const PROPAGATION_STAGES: PropagationStage[] = [
  'started',
  'callusing',
  'rooting',
  'growing',
  'ready',
  'potted',
];

export function propagationStageIndex(stage: PropagationStage): number {
  return PROPAGATION_STAGES.indexOf(stage);
}

export function propagationStageProgress(stage: PropagationStage): number {
  const index = propagationStageIndex(stage);
  if (index < 0) return 0;
  return index / (PROPAGATION_STAGES.length - 1);
}

export function daysSince(dateLike: string): number {
  const parsed = new Date(dateLike);
  if (Number.isNaN(parsed.getTime())) return 0;
  return Math.max(
    0,
    Math.floor((Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24)),
  );
}

export function itemCenter(item: Pick<LayoutItem, 'x' | 'y' | 'widthCells' | 'heightCells'>): {
  x: number;
  y: number;
} {
  return {
    x: item.x + item.widthCells / 2,
    y: item.y + item.heightCells / 2,
  };
}
