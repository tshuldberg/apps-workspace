export interface AuditEvent {
  id: string;
  restaurantId: string;
  actorUserId: string | null;
  action: string;
  entity: string;
  entityId: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditEventInput {
  restaurantId: string;
  actorUserId: string | null;
  action: string;
  entity: string;
  entityId: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

export interface AuditQuery {
  restaurantId: string;
  entity?: string;
  entityId?: string;
  actorUserId?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface RetentionPolicy {
  restaurantId: string;
  retentionDays: number; // default: 2555 (7 years)
}

export const DEFAULT_RETENTION_DAYS = 2555; // 7 years
