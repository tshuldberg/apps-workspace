import {
  HB_ACCENT,
  HB_ACCENT_LIGHT,
  HB_STREAK,
  withAlpha,
  type BuiltInProgram,
} from '@mylife/habits';

const DIFFICULTY_COLORS = {
  beginner: HB_STREAK.fire,
  intermediate: HB_ACCENT_LIGHT,
  advanced: '#FF6B6B',
} as const;

export function formatProgramDifficulty(difficulty: string) {
  return difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
}

export function getProgramDifficultyColor(difficulty: string) {
  return DIFFICULTY_COLORS[difficulty as keyof typeof DIFFICULTY_COLORS] ?? HB_ACCENT_LIGHT;
}

export function formatProgramDuration(days: number) {
  return days === 1 ? '1 day' : `${days} days`;
}

export function buildProgramCoverUri(program: Pick<BuiltInProgram, 'name' | 'focusArea' | 'coverPalette' | 'icon'>) {
  const palette = program.coverPalette.length >= 2
    ? program.coverPalette
    : ['#1B1B20', HB_ACCENT, HB_ACCENT_LIGHT];
  const [from, to, glow = withAlpha(HB_ACCENT_LIGHT, 0.65)] = palette;
  const focusLabel = program.focusArea.toUpperCase();
  const title = escapeSvg(program.name);
  const icon = escapeSvg(program.icon);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${from}" />
          <stop offset="100%" stop-color="${to}" />
        </linearGradient>
        <radialGradient id="glow" cx="80%" cy="18%" r="60%">
          <stop offset="0%" stop-color="${glow}" stop-opacity="0.9" />
          <stop offset="100%" stop-color="${glow}" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="1200" height="720" rx="64" fill="url(#g)" />
      <rect width="1200" height="720" rx="64" fill="#0E0E13" fill-opacity="0.18" />
      <circle cx="970" cy="160" r="260" fill="url(#glow)" />
      <circle cx="230" cy="610" r="210" fill="${withAlpha('#FFFFFF', 0.08)}" />
      <rect x="72" y="72" width="268" height="54" rx="27" fill="${withAlpha('#0E0E13', 0.24)}" />
      <text x="108" y="107" fill="#E4E1E9" font-size="24" font-family="Arial, sans-serif" font-weight="700" letter-spacing="4">${focusLabel}</text>
      <text x="72" y="290" fill="#FFFFFF" font-size="152">${icon}</text>
      <text x="72" y="438" fill="#FFFFFF" font-size="74" font-family="Arial, sans-serif" font-weight="700">${title}</text>
      <text x="72" y="510" fill="${withAlpha('#FFFFFF', 0.82)}" font-size="28" font-family="Arial, sans-serif" font-weight="600">Structured momentum for your next streak.</text>
    </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function escapeSvg(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
