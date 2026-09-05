// Pure playback-math helpers shared by the player screen and the voice layer.
// Kept framework-free so they are unit-testable without a renderer.

// Clamp a target time into the valid [0, duration] window. When duration is
// unknown (0 / NaN, e.g. before metadata loads) only the lower bound applies.
export function clampTime(time: number, duration: number): number {
  if (!Number.isFinite(time)) return 0;
  const lower = Math.max(0, time);
  if (Number.isFinite(duration) && duration > 0) return Math.min(lower, duration);
  return lower;
}

// m:ss clock, e.g. 75 -> "1:15". Negative / non-finite collapse to "0:00".
export function formatClock(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Remaining time as m:ss. Unknown duration reads "0:00".
export function formatRemaining(currentTime: number, duration: number): string {
  if (!Number.isFinite(duration) || duration <= 0) return '0:00';
  return formatClock(duration - currentTime);
}

const SPELLED_NUMBER =
  /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty)\b/;

// True when the spoken phrase named a magnitude ("back up thirty seconds",
// "go back 15"). When it did not ("go back"), the settings seek length applies.
export function transcriptNamesDuration(raw: string): boolean {
  const normalized = raw.toLowerCase();
  return (
    /\d/.test(normalized) ||
    /\bhalf a minute\b/.test(normalized) ||
    /\ba minute\b/.test(normalized) ||
    SPELLED_NUMBER.test(normalized)
  );
}

// The parser defaults a bare seek to +/-10 s. When the user did not name a
// duration and their settings ask for a different length, override the
// magnitude while preserving direction.
export function resolveSeekDelta(deltaSeconds: number, raw: string, settingsSeek: number): number {
  if (transcriptNamesDuration(raw)) return deltaSeconds;
  const sign = deltaSeconds < 0 ? -1 : 1;
  return sign * settingsSeek;
}
