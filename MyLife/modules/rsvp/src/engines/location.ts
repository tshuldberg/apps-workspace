/**
 * Location/directions engine for RSVP events.
 * Maps URL builders and virtual event detection.
 */

const VIRTUAL_KEYWORDS = ['zoom', 'virtual', 'online', 'video call', 'teams', 'meet', 'webex', 'google meet'];

/**
 * Build Apple Maps directions URL.
 */
export function buildAppleMapsUrl(lat: number, lng: number): string {
  return `maps://maps.apple.com/?daddr=${lat},${lng}`;
}

/**
 * Build Google Maps directions URL.
 */
export function buildGoogleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

/**
 * Build Google Maps search URL from an address string (fallback when no coordinates).
 */
export function buildMapsSearchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/**
 * Detect whether a location name indicates a virtual/online event.
 */
export function isVirtualLocation(locationName: string | null): boolean {
  if (!locationName) return false;
  const lower = locationName.toLowerCase();
  return VIRTUAL_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Build the appropriate directions URL based on platform and available data.
 */
export function buildDirectionsUrl(
  platform: 'ios' | 'android' | 'web',
  lat: number | null,
  lng: number | null,
  address: string | null,
): string | null {
  if (lat != null && lng != null) {
    if (platform === 'ios') return buildAppleMapsUrl(lat, lng);
    return buildGoogleMapsUrl(lat, lng);
  }
  if (address) return buildMapsSearchUrl(address);
  return null;
}
