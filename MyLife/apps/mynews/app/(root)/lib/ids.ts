// Client-generated identifiers for drafts and articles. Base36 time prefix plus
// a short random suffix: sortable enough for local ordering, collision-safe for
// a single device. The server treats article ids as opaque.

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function newDraftId(): string {
  return makeId('d');
}

export function newArticleId(): string {
  return makeId('a');
}

export function newFollowId(): string {
  return makeId('f');
}

export function newSuggestionId(): string {
  return makeId('s');
}
