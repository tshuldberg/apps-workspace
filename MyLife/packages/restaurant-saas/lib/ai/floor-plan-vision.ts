import type { DetectedTable, FloorPlanAnalysis } from './types';

// Stub for CV model integration (Claude Vision or OpenAI Vision)
// In production, this sends the image to an AI model and parses the response
export async function analyzeFloorPlanPhoto(_imageBase64: string): Promise<FloorPlanAnalysis> {
  // This is a stub - real implementation would call Claude Vision API
  // Return placeholder for now
  const startTime = Date.now();
  return {
    tables: [],
    roomWidth: 800,
    roomHeight: 600,
    confidence: 0,
    processingTimeMs: Date.now() - startTime,
  };
}

export function estimateCapacityFromSize(width: number, height: number, shape: string): number {
  const area = shape === 'round' ? Math.PI * (width / 2) * (height / 2) : width * height;
  if (area < 2000) return 2;
  if (area < 4000) return 4;
  if (area < 8000) return 6;
  if (area < 12000) return 8;
  return 12;
}

export function mapConfidenceToShape(aspectRatio: number, roundness: number): DetectedTable['shape'] {
  if (roundness > 0.85) return 'round';
  if (aspectRatio > 3) return 'bar';
  if (aspectRatio > 2) return 'banquette';
  if (aspectRatio > 1.3) return 'rectangle';
  return 'square';
}
