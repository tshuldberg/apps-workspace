export interface PosterInput {
  petName: string;
  species: string;
  breed: string | null;
  weightGrams: number | null;
  microchipId: string | null;
  imageBase64: string | null;
  lastSeenDate: string;
  lastSeenLocation: string;
  contactPhone: string;
  colorMarkings: string | null;
  rewardAmount: string | null;
  additionalNotes: string | null;
}

/**
 * Generate a Lost Pet poster as self-contained HTML.
 * All styles are inline (no external CSS references).
 */
export function generateLostPetPoster(input: PosterInput): string {
  if (!input.contactPhone) {
    throw new Error('Contact phone number is required');
  }

  const safeName = escapeHtml(input.petName);
  const photoHtml = input.imageBase64
    ? `<img src="${escapeHtml(input.imageBase64)}" alt="${safeName}" style="width:100%;max-width:400px;height:auto;border-radius:12px;display:block;margin:0 auto;" />`
    : `<div style="width:300px;height:300px;background:#e5e5e5;border-radius:12px;margin:0 auto;display:flex;align-items:center;justify-content:center;font-size:80px;">${getSpeciesEmoji(input.species)}</div>`;

  const breedLine = input.breed ? `<p style="font-size:18px;color:#555;margin:4px 0;">${truncate(input.breed, 40)}</p>` : '';
  const weightLine = input.weightGrams ? `<p style="font-size:16px;color:#555;margin:4px 0;">Weight: ${(input.weightGrams / 1000).toFixed(1)} kg</p>` : '';
  const chipLine = input.microchipId ? `<p style="font-size:14px;color:#666;margin:4px 0;">Microchip ID: ${escapeHtml(input.microchipId)}</p>` : '';
  const markingsLine = input.colorMarkings ? `<p style="font-size:16px;color:#555;margin:4px 0;">Color/Markings: ${truncate(input.colorMarkings, 80)}</p>` : '';
  const rewardLine = input.rewardAmount ? `<div style="background:#FFF3CD;border:2px solid #F59E0B;border-radius:8px;padding:12px;margin:16px 0;text-align:center;"><p style="font-size:24px;font-weight:bold;color:#92400E;margin:0;">REWARD: ${escapeHtml(input.rewardAmount)}</p></div>` : '';
  const notesLine = input.additionalNotes ? `<p style="font-size:14px;color:#555;margin:8px 0;font-style:italic;">${truncate(input.additionalNotes, 200)}</p>` : '';

  return buildPosterHtml('LOST PET', '#DC2626', input, photoHtml, breedLine, weightLine, chipLine, markingsLine, rewardLine, notesLine);
}

/**
 * Generate a Found Pet poster as self-contained HTML.
 */
export function generateFoundPetPoster(input: Omit<PosterInput, 'rewardAmount'> & { foundDate: string; foundLocation: string }): string {
  if (!input.contactPhone) {
    throw new Error('Contact phone number is required');
  }

  const photoHtml = input.imageBase64
    ? `<img src="${escapeHtml(input.imageBase64)}" alt="Found Pet" style="width:100%;max-width:400px;height:auto;border-radius:12px;display:block;margin:0 auto;" />`
    : `<div style="width:300px;height:300px;background:#e5e5e5;border-radius:12px;margin:0 auto;display:flex;align-items:center;justify-content:center;font-size:80px;">${getSpeciesEmoji(input.species)}</div>`;

  const breedLine = input.breed ? `<p style="font-size:18px;color:#555;margin:4px 0;">${truncate(input.breed, 40)}</p>` : '';
  const weightLine = input.weightGrams ? `<p style="font-size:16px;color:#555;margin:4px 0;">Weight: ${(input.weightGrams / 1000).toFixed(1)} kg</p>` : '';
  const chipLine = input.microchipId ? `<p style="font-size:14px;color:#666;margin:4px 0;">Microchip ID: ${escapeHtml(input.microchipId)}</p>` : '';
  const markingsLine = input.colorMarkings ? `<p style="font-size:16px;color:#555;margin:4px 0;">Color/Markings: ${truncate(input.colorMarkings, 80)}</p>` : '';
  const notesLine = input.additionalNotes ? `<p style="font-size:14px;color:#555;margin:8px 0;font-style:italic;">${truncate(input.additionalNotes, 200)}</p>` : '';

  const posterInput: PosterInput = { ...input, lastSeenDate: input.foundDate, lastSeenLocation: input.foundLocation, rewardAmount: null };
  return buildPosterHtml('FOUND PET', '#16A34A', posterInput, photoHtml, breedLine, weightLine, chipLine, markingsLine, '', notesLine, true);
}

function buildPosterHtml(
  header: string,
  headerColor: string,
  input: PosterInput,
  photoHtml: string,
  breedLine: string,
  weightLine: string,
  chipLine: string,
  markingsLine: string,
  rewardLine: string,
  notesLine: string,
  isFound = false,
): string {
  const locationLabel = isFound ? 'Found at' : 'Last seen';
  const dateLabel = isFound ? 'Found on' : 'Last seen';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${header}</title></head>
<body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#fff;max-width:210mm;margin:0 auto;">
  <div style="text-align:center;margin-bottom:16px;">
    <h1 style="font-size:48px;font-weight:900;color:${headerColor};margin:0;letter-spacing:2px;">${header}</h1>
  </div>
  <div style="margin:16px 0;">${photoHtml}</div>
  <div style="text-align:center;margin:16px 0;">
    <h2 style="font-size:32px;font-weight:bold;margin:8px 0;">${escapeHtml(input.petName)}</h2>
    ${breedLine}
    ${weightLine}
    ${markingsLine}
  </div>
  <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin:16px 0;">
    <p style="font-size:16px;margin:4px 0;"><strong>${dateLabel}:</strong> ${escapeHtml(input.lastSeenDate)}</p>
    <p style="font-size:16px;margin:4px 0;"><strong>${locationLabel}:</strong> ${truncate(input.lastSeenLocation, 100)}</p>
  </div>
  ${rewardLine}
  <div style="background:#EFF6FF;border:2px solid #3B82F6;border-radius:8px;padding:16px;margin:16px 0;text-align:center;">
    <p style="font-size:16px;color:#1E40AF;margin:0 0 4px;">IF ${isFound ? 'THIS IS YOUR PET' : 'FOUND'} PLEASE CALL</p>
    <p style="font-size:36px;font-weight:bold;color:#1E40AF;margin:0;">${escapeHtml(input.contactPhone)}</p>
  </div>
  ${chipLine}
  ${notesLine}
  <p style="font-size:8px;color:#ccc;text-align:center;margin-top:24px;">Generated by MyLife</p>
</body>
</html>`;
}

function getSpeciesEmoji(species: string): string {
  const map: Record<string, string> = {
    dog: '\u{1F415}', cat: '\u{1F408}', bird: '\u{1F426}', fish: '\u{1F41F}',
    reptile: '\u{1F98E}', rabbit: '\u{1F407}', small_mammal: '\u{1F439}', horse: '\u{1F40E}',
  };
  return map[species] ?? '\u{1F43E}';
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function truncate(text: string, maxLen: number): string {
  const trimmed = text.length > maxLen ? text.slice(0, maxLen - 3) + '...' : text;
  return escapeHtml(trimmed);
}
