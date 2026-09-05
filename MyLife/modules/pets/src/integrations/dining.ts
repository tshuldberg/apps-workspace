export const PET_FRIENDLY_TAG = {
  name: 'Pet-Friendly',
  kind: 'vibe' as const,
  color: '#30D158',
};

export function isPetFriendly(tags: Array<{ name: string }>): boolean {
  return tags.some((t) => t.name.toLowerCase() === 'pet-friendly');
}
