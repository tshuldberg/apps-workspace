'use strict';

// Vitest stub for lucide-react-native.
// The real package ships 3000+ icon files and transitively imports
// react-native-svg -> react-native, which the test transform pipeline
// must never crawl. vitest.config.ts aliases the package here.
//
// Vitest 4's CJS interop snapshots export NAMES statically, so a pure
// Proxy (the v3-era shape) yields zero named exports. Named icons used
// anywhere in apps/mobile must be listed in ICON_NAMES explicitly; the
// `icons` map stays dynamic (property access on a value works fine).
// If a test fails with "No X export is defined", add X to ICON_NAMES.

const Icon = () => null;

// Complete union of lucide named imports across app/, components/, lib/
// (regenerate with the parser snippet in
// docs/sessions/2026-06-10-mobile-vitest-hang-root-cause.md when a new
// icon import lands).
const ICON_NAMES = [
  'Activity', 'AlertCircle', 'AlertTriangle', 'ArrowLeft', 'ArrowLeftRight',
  'ArrowRight', 'Baby', 'BarChart3', 'Bell', 'BookOpen', 'BookmarkPlus',
  'Briefcase', 'Cake', 'Calendar', 'CalendarDays', 'CalendarHeart',
  'CalendarPlus', 'CalendarRange', 'Camera', 'Check', 'CheckCircle2',
  'CheckSquare', 'ChefHat', 'ChevronDown', 'ChevronLeft', 'ChevronRight',
  'ChevronUp', 'Clock', 'Clock3', 'Cloud', 'CloudMoon', 'CloudRain',
  'Database', 'Download', 'Droplet', 'Droplets', 'Dumbbell', 'Edit3',
  'EllipsisVertical', 'FileText', 'Flag', 'FlagIcon', 'Flame', 'GitFork',
  'GripVertical', 'Heart', 'HeartPulse', 'HelpCircle', 'History', 'Image',
  'Images', 'Info', 'LayoutGrid', 'Leaf', 'Lightbulb', 'LineChart', 'Link',
  'Loader2', 'Lock', 'Map', 'MapPin', 'Mic', 'Microscope', 'Minus', 'Moon',
  'MoreVertical', 'MoveRight', 'NotebookPen', 'Pause', 'Pencil', 'Phone',
  'Play', 'PlayCircle', 'Plus', 'PlusCircle', 'Repeat', 'RotateCcw',
  'Ruler', 'Salad', 'Save', 'ScanLine', 'Search', 'Settings', 'Share2',
  'Shield', 'ShieldCheck', 'ShoppingCart', 'SkipBack', 'SkipForward',
  'Sliders', 'SlidersHorizontal', 'Smile', 'Snowflake', 'Sparkles',
  'Sprout', 'Square', 'Sun', 'SunMedium', 'Thermometer', 'ThumbsDown',
  'ThumbsUp', 'Timer', 'Trash2', 'TreePine', 'TrendingUp', 'TriangleAlert',
  'Umbrella', 'Upload', 'Users', 'UtensilsCrossed', 'Volume2', 'Waves',
  'Wheat', 'WheatOff', 'Wind', 'X', 'XCircle', 'Zap',
];

const exportsObject = {
  __esModule: true,
  default: Icon,
  icons: new Proxy({}, { get: () => Icon }),
  createLucideIcon: () => Icon,
};

for (const name of ICON_NAMES) {
  exportsObject[name] = Icon;
}

module.exports = exportsObject;
