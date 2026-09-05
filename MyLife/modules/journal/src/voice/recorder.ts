import { DEFAULT_RECORDING_CONFIG, MAX_AUDIO_SIZE_BYTES } from './types';

/**
 * Build the filesystem path for a voice recording file.
 * Pattern: [baseDir]/jn_voice/[entryId]/[recordingId].aac
 */
export function buildRecordingPath(baseDir: string, entryId: string, recordingId: string): string {
  return `${baseDir}/jn_voice/${entryId}/${recordingId}.aac`;
}

/**
 * Check whether a recording duration has exceeded the maximum.
 */
export function shouldAutoStop(durationMs: number): boolean {
  return durationMs >= DEFAULT_RECORDING_CONFIG.maxDurationMs;
}

/**
 * Check whether the audio file size exceeds the maximum allowed.
 */
export function isFileSizeExceeded(sizeBytes: number): boolean {
  return sizeBytes > MAX_AUDIO_SIZE_BYTES;
}

/**
 * Insert transcription text into existing body at a given position.
 * If cursor position is at the end or not specified, appends as a new paragraph.
 */
export function insertTranscription(
  existingBody: string,
  transcriptionText: string,
  cursorPosition?: number,
): string {
  const textToInsert = transcriptionText.trim();
  if (!textToInsert) {
    return existingBody;
  }

  if (cursorPosition === undefined || cursorPosition >= existingBody.length) {
    const separator = existingBody.trim() ? '\n\n' : '';
    return `${existingBody}${separator}${textToInsert}`;
  }

  const before = existingBody.slice(0, cursorPosition);
  const after = existingBody.slice(cursorPosition);
  return `${before}${textToInsert}${after}`;
}

/**
 * Generate placeholder text when transcription returns empty or fails.
 */
export function handleEmptyTranscription(): string {
  return '[No speech detected]';
}

/**
 * Generate text for partial transcription failures.
 */
export function handlePartialTranscription(partialText: string): string {
  return `${partialText} [transcription incomplete]`;
}
