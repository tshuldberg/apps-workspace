/**
 * Invitation design engine for RSVP events.
 * 20 bundled designs across 5 categories.
 */

import type { InvitationDesign, DesignCategory, DesignCustomization } from '../types';

export const INVITATION_DESIGNS: InvitationDesign[] = [
  // Celebration (4)
  { id: 'confetti', name: 'Confetti', category: 'celebration', backgroundColor: '#1A1025', backgroundPattern: 'confetti', accentColor: '#FB7185', textColor: '#F0F0F5', headerFont: 'Inter', headerWeight: 800 },
  { id: 'balloons', name: 'Balloons', category: 'celebration', backgroundColor: '#0F1A2E', backgroundPattern: 'balloons', accentColor: '#60A5FA', textColor: '#F0F0F5', headerFont: 'Inter', headerWeight: 700 },
  { id: 'sparkle', name: 'Sparkle', category: 'celebration', backgroundColor: '#1A1520', backgroundPattern: 'sparkle', accentColor: '#FBBF24', textColor: '#F0F0F5', headerFont: 'Inter', headerWeight: 700 },
  { id: 'fireworks', name: 'Fireworks', category: 'celebration', backgroundColor: '#0A0A1A', backgroundPattern: 'fireworks', accentColor: '#F97316', textColor: '#F0F0F5', headerFont: 'Inter', headerWeight: 800 },
  // Elegant (4)
  { id: 'marble', name: 'Marble', category: 'elegant', backgroundColor: '#F5F0EB', backgroundPattern: 'marble', accentColor: '#92734F', textColor: '#1A1A24', headerFont: 'Inter', headerWeight: 300 },
  { id: 'gold-leaf', name: 'Gold Leaf', category: 'elegant', backgroundColor: '#1A1815', backgroundPattern: 'gold-leaf', accentColor: '#D4AF37', textColor: '#F0F0F5', headerFont: 'Inter', headerWeight: 400 },
  { id: 'floral', name: 'Floral', category: 'elegant', backgroundColor: '#1A1520', backgroundPattern: 'floral', accentColor: '#E879A8', textColor: '#F0F0F5', headerFont: 'Inter', headerWeight: 400 },
  { id: 'calligraphy', name: 'Calligraphy', category: 'elegant', backgroundColor: '#FFFDF7', backgroundPattern: null, accentColor: '#1A1A24', textColor: '#1A1A24', headerFont: 'Inter', headerWeight: 300 },
  // Casual (4)
  { id: 'kraft-paper', name: 'Kraft Paper', category: 'casual', backgroundColor: '#3D2B1F', backgroundPattern: 'kraft', accentColor: '#F59E0B', textColor: '#F0F0F5', headerFont: 'Inter', headerWeight: 700 },
  { id: 'doodle', name: 'Doodle', category: 'casual', backgroundColor: '#FAFAFA', backgroundPattern: 'doodle', accentColor: '#3B82F6', textColor: '#1A1A24', headerFont: 'Inter', headerWeight: 600 },
  { id: 'retro', name: 'Retro', category: 'casual', backgroundColor: '#2D1B4E', backgroundPattern: 'retro', accentColor: '#F472B6', textColor: '#F0F0F5', headerFont: 'Inter', headerWeight: 800 },
  { id: 'neon', name: 'Neon', category: 'casual', backgroundColor: '#0A0A0F', backgroundPattern: 'neon', accentColor: '#22D3EE', textColor: '#F0F0F5', headerFont: 'Inter', headerWeight: 800 },
  // Seasonal (4)
  { id: 'autumn-leaves', name: 'Autumn Leaves', category: 'seasonal', backgroundColor: '#1A1510', backgroundPattern: 'autumn', accentColor: '#D97706', textColor: '#F0F0F5', headerFont: 'Inter', headerWeight: 600 },
  { id: 'winter-snow', name: 'Winter Snow', category: 'seasonal', backgroundColor: '#0F1520', backgroundPattern: 'snow', accentColor: '#93C5FD', textColor: '#F0F0F5', headerFont: 'Inter', headerWeight: 400 },
  { id: 'spring-bloom', name: 'Spring Bloom', category: 'seasonal', backgroundColor: '#0F1A15', backgroundPattern: 'bloom', accentColor: '#34D399', textColor: '#F0F0F5', headerFont: 'Inter', headerWeight: 500 },
  { id: 'summer-sunset', name: 'Summer Sunset', category: 'seasonal', backgroundColor: '#1A1015', backgroundPattern: 'sunset', accentColor: '#FB923C', textColor: '#F0F0F5', headerFont: 'Inter', headerWeight: 700 },
  // Minimal (4)
  { id: 'clean-white', name: 'Clean White', category: 'minimal', backgroundColor: '#FFFFFF', backgroundPattern: null, accentColor: '#3B82F6', textColor: '#1A1A24', headerFont: 'Inter', headerWeight: 600 },
  { id: 'dark-glass', name: 'Dark Glass', category: 'minimal', backgroundColor: '#0A0A0F', backgroundPattern: null, accentColor: '#FB7185', textColor: '#F0F0F5', headerFont: 'Inter', headerWeight: 600 },
  { id: 'gradient', name: 'Gradient', category: 'minimal', backgroundColor: '#1A1030', backgroundPattern: 'gradient', accentColor: '#A78BFA', textColor: '#F0F0F5', headerFont: 'Inter', headerWeight: 500 },
  { id: 'monochrome', name: 'Monochrome', category: 'minimal', backgroundColor: '#1A1A1A', backgroundPattern: null, accentColor: '#A0A0A0', textColor: '#F0F0F5', headerFont: 'Inter', headerWeight: 400 },
];

export function getDesigns(): InvitationDesign[] {
  return INVITATION_DESIGNS;
}

export function getDesignById(id: string): InvitationDesign | null {
  return INVITATION_DESIGNS.find((d) => d.id === id) ?? null;
}

export function getDesignsByCategory(category: DesignCategory): InvitationDesign[] {
  return INVITATION_DESIGNS.filter((d) => d.category === category);
}

/**
 * Apply customization overrides to a base design.
 */
export function applyDesignOverrides(
  design: InvitationDesign,
  customJson: string | null,
): InvitationDesign {
  if (!customJson) return design;
  try {
    const overrides: DesignCustomization = JSON.parse(customJson);
    return {
      ...design,
      accentColor: overrides.accentColor ?? design.accentColor,
      textColor: overrides.textColor ?? design.textColor,
    };
  } catch {
    return design;
  }
}

/**
 * Auto-detect text color based on background luminance (WCAG formula).
 */
export function autoContrastTextColor(backgroundColor: string): string {
  const hex = backgroundColor.replace('#', '');
  if (hex.length !== 6) return '#F0F0F5';
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.5 ? '#1A1A24' : '#F0F0F5';
}
