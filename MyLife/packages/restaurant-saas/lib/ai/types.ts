export interface DetectedTable {
  shape: 'round' | 'square' | 'rectangle' | 'banquette' | 'bar';
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  estimatedCapacity: number;
}

export interface FloorPlanAnalysis {
  tables: DetectedTable[];
  roomWidth: number;
  roomHeight: number;
  confidence: number;
  processingTimeMs: number;
}

export interface SurgePrediction {
  probability: number; // 0-1
  expectedWalkIns: number;
  factors: SurgeFactor[];
  predictedAt: string;
  windowMinutes: number;
}

export interface SurgeFactor {
  name: string;
  impact: number; // -1 to 1
  value: string;
}

export interface ServerZoneLoad {
  zone: string;
  activeCovers: number;
  capacity: number;
  loadPercent: number;
  avgResponseMinutes: number;
  status: 'green' | 'yellow' | 'red';
}
