import type { TimeSlot } from './types';

interface TableInfo {
  id: string;
  capacityMin: number;
  capacityMax: number;
  areaId: string;
}

interface ExistingReservation {
  tableId: string | null;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
}

export function generateTimeSlots(
  openTime: string,   // "11:00"
  closeTime: string,  // "22:00"
  intervalMinutes: number = 15,
): string[] {
  const slots: string[] = [];
  const [openH, openM] = openTime.split(':').map(Number);
  const [closeH, closeM] = closeTime.split(':').map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  for (let m = openMinutes; m < closeMinutes; m += intervalMinutes) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    slots.push(`${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`);
  }
  return slots;
}

export function getAvailableSlots(
  date: string,
  partySize: number,
  durationMinutes: number,
  tables: TableInfo[],
  existingReservations: ExistingReservation[],
  openTime: string,
  closeTime: string,
): TimeSlot[] {
  const suitableTables = tables.filter(
    (t) => t.capacityMax >= partySize && t.capacityMin <= partySize + 2,
  );

  if (suitableTables.length === 0) return [];

  const timeSlots = generateTimeSlots(openTime, closeTime);
  const available: TimeSlot[] = [];

  for (const slotTime of timeSlots) {
    const slotStart = new Date(`${date}T${slotTime}:00Z`);
    const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000);

    const freeTables = suitableTables.filter((table) => {
      const hasConflict = existingReservations.some((res) => {
        if (res.tableId !== table.id) return false;
        if (res.status === 'cancelled' || res.status === 'no_show') return false;
        const resStart = new Date(res.scheduledAt);
        const resEnd = new Date(resStart.getTime() + res.durationMinutes * 60000);
        return slotStart < resEnd && slotEnd > resStart;
      });
      return !hasConflict;
    });

    if (freeTables.length > 0) {
      available.push({
        time: slotStart.toISOString(),
        availableTables: freeTables.map((t) => t.id),
        totalCapacity: freeTables.reduce((sum, t) => sum + t.capacityMax, 0),
      });
    }
  }

  return available;
}

export function calculatePacing(
  reservations: ExistingReservation[],
  intervalMinutes: number = 15,
): Map<string, number> {
  const pacing = new Map<string, number>();

  for (const res of reservations) {
    if (res.status === 'cancelled') continue;
    const time = new Date(res.scheduledAt);
    const bucket = `${time.getUTCHours().toString().padStart(2, '0')}:${(Math.floor(time.getUTCMinutes() / intervalMinutes) * intervalMinutes).toString().padStart(2, '0')}`;
    pacing.set(bucket, (pacing.get(bucket) ?? 0) + 1);
  }

  return pacing;
}
