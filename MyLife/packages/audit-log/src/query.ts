import type { AuditEvent, AuditQuery } from './types';

export function filterEvents(events: AuditEvent[], query: AuditQuery): AuditEvent[] {
  let filtered = events.filter((e) => e.restaurantId === query.restaurantId);
  if (query.entity) filtered = filtered.filter((e) => e.entity === query.entity);
  if (query.entityId) filtered = filtered.filter((e) => e.entityId === query.entityId);
  if (query.actorUserId) filtered = filtered.filter((e) => e.actorUserId === query.actorUserId);
  if (query.action) filtered = filtered.filter((e) => e.action === query.action);
  if (query.startDate) filtered = filtered.filter((e) => e.createdAt >= query.startDate!);
  if (query.endDate) filtered = filtered.filter((e) => e.createdAt <= query.endDate!);
  filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (query.offset) filtered = filtered.slice(query.offset);
  if (query.limit) filtered = filtered.slice(0, query.limit);
  return filtered;
}
