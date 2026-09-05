import type { CreateOcclusionRegionInput, OcclusionRegion } from './types';

export function clampRegion(region: CreateOcclusionRegionInput): CreateOcclusionRegionInput {
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  return {
    ...region,
    x: clamp(region.x),
    y: clamp(region.y),
    width: clamp(region.width),
    height: clamp(region.height),
  };
}

export function percentToPixel(percent: number, dimension: number): number {
  return Math.round(percent * dimension);
}

export function pixelToPercent(pixel: number, dimension: number): number {
  if (dimension <= 0) return 0;
  return Math.max(0, Math.min(1, pixel / dimension));
}

export function regionContainsPoint(
  region: Pick<OcclusionRegion, 'shape' | 'x' | 'y' | 'width' | 'height'>,
  px: number,
  py: number,
): boolean {
  if (region.shape === 'ellipse') {
    const cx = region.x + region.width / 2;
    const cy = region.y + region.height / 2;
    const rx = region.width / 2;
    const ry = region.height / 2;
    if (rx <= 0 || ry <= 0) return false;
    return ((px - cx) ** 2) / (rx ** 2) + ((py - cy) ** 2) / (ry ** 2) <= 1;
  }
  return (
    px >= region.x &&
    px <= region.x + region.width &&
    py >= region.y &&
    py <= region.y + region.height
  );
}

export function validateRegions(regions: CreateOcclusionRegionInput[]): string | null {
  if (regions.length === 0) return 'Draw at least one region to create cards.';
  for (const region of regions) {
    if (region.width <= 0 || region.height <= 0) {
      return 'All regions must have positive width and height.';
    }
  }
  return null;
}

export function regionArea(region: Pick<OcclusionRegion, 'width' | 'height'>): number {
  return region.width * region.height;
}

export function isSmallRegion(
  region: Pick<OcclusionRegion, 'width' | 'height'>,
  threshold = 0.03,
): boolean {
  return regionArea(region) < threshold;
}
