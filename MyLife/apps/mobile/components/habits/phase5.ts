export interface ParsedCravingContext {
  location?: string;
  companions?: string;
  notes?: string;
}

export interface RecoveryBenefit {
  thresholdHours: number;
  label: string;
}

export interface RecoveryTrack {
  kind: 'alcohol' | 'nicotine' | 'cannabis' | 'generic';
  dailyMinutesRecovered: number;
  dailyCaloriesAvoided: number;
  meetingUrl: string;
  meetingLabel: string;
  benefits: RecoveryBenefit[];
}

const CRAVING_CONTEXT_PREFIX = '[myhabits:craving-context]';

function trimToUndefined(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function serializeCravingContext(input: ParsedCravingContext): string | undefined {
  const payload = {
    location: trimToUndefined(input.location),
    companions: trimToUndefined(input.companions),
    notes: trimToUndefined(input.notes),
  };

  if (!payload.location && !payload.companions && !payload.notes) {
    return undefined;
  }

  return `${CRAVING_CONTEXT_PREFIX}${JSON.stringify(payload)}`;
}

export function parseCravingContext(raw?: string | null): ParsedCravingContext {
  const value = raw?.trim();
  if (!value) {
    return {};
  }

  if (value.startsWith(CRAVING_CONTEXT_PREFIX)) {
    try {
      const parsed = JSON.parse(
        value.slice(CRAVING_CONTEXT_PREFIX.length),
      ) as ParsedCravingContext;

      return {
        location: trimToUndefined(parsed.location),
        companions: trimToUndefined(parsed.companions),
        notes: trimToUndefined(parsed.notes),
      };
    } catch {
      return { notes: value };
    }
  }

  return { notes: value };
}

export function formatRelativeTimestamp(iso: string): string {
  const timestamp = new Date(iso).getTime();
  if (Number.isNaN(timestamp)) {
    return iso;
  }

  const deltaMs = Date.now() - timestamp;
  const deltaMinutes = Math.max(0, Math.round(deltaMs / 60000));

  if (deltaMinutes < 1) {
    return 'Just now';
  }

  if (deltaMinutes < 60) {
    return `${deltaMinutes}m ago`;
  }

  const deltaHours = Math.round(deltaMinutes / 60);
  if (deltaHours < 24) {
    return `${deltaHours}h ago`;
  }

  const deltaDays = Math.round(deltaHours / 24);
  if (deltaDays === 1) {
    return 'Yesterday';
  }

  if (deltaDays < 7) {
    return `${deltaDays}d ago`;
  }

  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function formatFriendlyDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatCurrencyFromCents(cents: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00`);
  return !Number.isNaN(parsed.getTime());
}

export function inferSobrietyTrack(habitName?: string | null): RecoveryTrack {
  const normalized = habitName?.toLowerCase() ?? '';

  if (/(smok|nicotine|vape|cigarette|tobacco)/.test(normalized)) {
    return {
      kind: 'nicotine',
      dailyMinutesRecovered: 45,
      dailyCaloriesAvoided: 0,
      meetingUrl: 'https://na.org/meetingsearch/',
      meetingLabel: 'Find recovery meetings',
      benefits: [
        { thresholdHours: 8, label: 'Carbon monoxide levels drop toward normal.' },
        { thresholdHours: 24, label: 'Blood pressure and pulse start stabilizing.' },
        { thresholdHours: 48, label: 'Taste and smell begin improving.' },
        { thresholdHours: 336, label: 'Breathing often feels easier.' },
        { thresholdHours: 2160, label: 'Circulation and lung function continue improving.' },
      ],
    };
  }

  if (/(weed|cannabis|thc|marijuana)/.test(normalized)) {
    return {
      kind: 'cannabis',
      dailyMinutesRecovered: 60,
      dailyCaloriesAvoided: 200,
      meetingUrl: 'https://na.org/meetingsearch/',
      meetingLabel: 'Find support meetings',
      benefits: [
        { thresholdHours: 24, label: 'Mental fog can begin lifting.' },
        { thresholdHours: 72, label: 'Sleep rhythm starts rebalancing.' },
        { thresholdHours: 336, label: 'Motivation and focus often improve.' },
        { thresholdHours: 720, label: 'Mood regulation tends to feel steadier.' },
      ],
    };
  }

  if (/(beer|wine|alcohol|drinking|liquor|cocktail)/.test(normalized)) {
    return {
      kind: 'alcohol',
      dailyMinutesRecovered: 90,
      dailyCaloriesAvoided: 700,
      meetingUrl: 'https://www.aa.org/find-aa',
      meetingLabel: 'Find AA meetings',
      benefits: [
        { thresholdHours: 24, label: 'Hydration and sleep quality can start recovering.' },
        { thresholdHours: 72, label: 'Energy and focus often begin to rebound.' },
        { thresholdHours: 336, label: 'Mood swings may feel less sharp.' },
        { thresholdHours: 720, label: 'Resting heart rate and recovery can improve.' },
        { thresholdHours: 2160, label: 'Liver fat and inflammation may continue decreasing.' },
      ],
    };
  }

  return {
    kind: 'generic',
    dailyMinutesRecovered: 60,
    dailyCaloriesAvoided: 300,
    meetingUrl: 'https://na.org/meetingsearch/',
    meetingLabel: 'Find support meetings',
    benefits: [
      { thresholdHours: 24, label: 'Your body starts adjusting to a steadier baseline.' },
      { thresholdHours: 72, label: 'Sleep and energy often begin to level out.' },
      { thresholdHours: 336, label: 'Mood and focus can start feeling more stable.' },
      { thresholdHours: 720, label: 'Consistency usually gets easier to maintain.' },
    ],
  };
}
