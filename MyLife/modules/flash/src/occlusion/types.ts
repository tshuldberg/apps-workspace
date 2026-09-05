export type OcclusionShape = 'rect' | 'ellipse';

export interface OcclusionRegion {
  id: string;
  cardId: string;
  mediaId: string;
  regionIndex: number;
  shape: OcclusionShape;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  maskColor: string;
  createdAt: string;
}

export interface CreateOcclusionRegionInput {
  shape?: OcclusionShape;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  maskColor?: string;
}

export interface OcclusionCardSet {
  noteId: string;
  mediaId: string;
  cards: Array<{ cardId: string; regionIndex: number; label: string }>;
}
