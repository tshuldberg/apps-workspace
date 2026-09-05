export function shouldShowNotification(
  habitCompletedToday: boolean,
): boolean {
  return !habitCompletedToday;
}

export function validateRadius(meters: number): boolean {
  return Number.isInteger(meters) && meters >= 50 && meters <= 500;
}

export function validateCoordinates(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function formatNotificationBody(habitName: string): string {
  return `Time for ${habitName}!`;
}

export function isPlatformSupported(platform: string): boolean {
  return platform === 'ios' || platform === 'android';
}
