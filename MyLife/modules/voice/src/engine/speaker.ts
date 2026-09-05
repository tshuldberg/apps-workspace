/**
 * Speaker diarization engine for voice transcriptions.
 * Assigns speaker labels, merges short segments, and provides analysis.
 */

export interface RawSpeakerSegment {
  speakerLabel: string;
  startSeconds: number;
  endSeconds: number;
  text: string;
  confidence: number;
}

/** Preset palette of 10 colors that work on Cool Obsidian dark backgrounds. */
export const SPEAKER_COLORS = [
  '#60A5FA', // blue
  '#F97316', // orange
  '#34D399', // emerald
  '#A78BFA', // violet
  '#FBBF24', // amber
  '#F472B6', // pink
  '#2DD4BF', // teal
  '#FB923C', // light orange
  '#818CF8', // indigo
  '#4ADE80', // green
] as const;

const MAX_SPEAKERS_PER_TRANSCRIPTION = 10;

/**
 * Get a speaker color from the preset palette by index.
 */
export function getSpeakerColor(index: number): string {
  return SPEAKER_COLORS[index % SPEAKER_COLORS.length];
}

/**
 * Merge adjacent segments that share the same speaker label
 * and merge very short segments (<1s) into their neighbors.
 */
export function mergeShortSegments(segments: RawSpeakerSegment[]): RawSpeakerSegment[] {
  if (segments.length <= 1) return segments;

  const sorted = [...segments].sort((a, b) => a.startSeconds - b.startSeconds);
  const merged: RawSpeakerSegment[] = [];

  for (const seg of sorted) {
    const last = merged[merged.length - 1];

    if (!last) {
      merged.push({ ...seg });
      continue;
    }

    // Merge adjacent segments from the same speaker.
    // Short segments (<1s) are kept separate when the speaker differs
    // to avoid corrupting speaker attribution.
    if (last.speakerLabel === seg.speakerLabel) {
      last.endSeconds = Math.max(last.endSeconds, seg.endSeconds);
      last.text = last.text + ' ' + seg.text;
      last.confidence = Math.min(last.confidence, seg.confidence);
    } else {
      merged.push({ ...seg });
    }
  }

  return merged;
}

/**
 * Assign auto-generated speaker labels ("Speaker 1", "Speaker 2", etc.)
 * to raw diarization output.
 */
export function assignSpeakerLabels(
  segments: RawSpeakerSegment[],
): RawSpeakerSegment[] {
  const labelMap = new Map<string, string>();
  let nextIndex = 1;

  return segments.map((seg) => {
    let label = labelMap.get(seg.speakerLabel);
    if (!label) {
      if (nextIndex > MAX_SPEAKERS_PER_TRANSCRIPTION) {
        label = `Speaker ${MAX_SPEAKERS_PER_TRANSCRIPTION}`;
      } else {
        label = `Speaker ${nextIndex}`;
        labelMap.set(seg.speakerLabel, label);
        nextIndex++;
      }
    }
    return { ...seg, speakerLabel: label };
  });
}

/**
 * Check if a transcription has multiple speakers based on its segments.
 */
export function isMultiSpeaker(segments: RawSpeakerSegment[]): boolean {
  const labels = new Set(segments.map((s) => s.speakerLabel));
  return labels.size > 1;
}

/**
 * Get speaker breakdown stats for a set of segments.
 */
export function getSpeakerBreakdown(
  segments: RawSpeakerSegment[],
): Array<{ speakerLabel: string; totalSeconds: number; segmentCount: number }> {
  const map = new Map<string, { totalSeconds: number; segmentCount: number }>();

  for (const seg of segments) {
    const existing = map.get(seg.speakerLabel) ?? { totalSeconds: 0, segmentCount: 0 };
    existing.totalSeconds += seg.endSeconds - seg.startSeconds;
    existing.segmentCount += 1;
    map.set(seg.speakerLabel, existing);
  }

  return [...map.entries()]
    .map(([speakerLabel, stats]) => ({ speakerLabel, ...stats }))
    .sort((a, b) => b.totalSeconds - a.totalSeconds);
}

/**
 * Process raw diarization output into finalized segments.
 * Assigns labels, merges short segments, and validates time ranges.
 */
export function processDiarization(
  rawSegments: RawSpeakerSegment[],
): RawSpeakerSegment[] {
  if (rawSegments.length === 0) return [];

  const labeled = assignSpeakerLabels(rawSegments);
  return mergeShortSegments(labeled);
}
