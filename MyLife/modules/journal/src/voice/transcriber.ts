import type { TranscriptionResult } from './types';

/**
 * Platform-agnostic transcription interface.
 *
 * On iOS: implements via SFSpeechRecognizer with requiresOnDeviceRecognition = true
 * On Android: implements via SpeechRecognizer with EXTRA_PREFER_OFFLINE
 * On Web: implements via Web Speech API (SpeechRecognition / webkitSpeechRecognition)
 *
 * This module defines the interface. Platform implementations are provided
 * by the host app (apps/mobile, apps/web) and injected at runtime.
 */
export interface Transcriber {
  /** Whether on-device transcription is available on the current device. */
  isAvailable(): Promise<boolean>;
  /** Transcribe an audio file at the given path. Returns the transcription result. */
  transcribe(audioFilePath: string): Promise<TranscriptionResult>;
}

/**
 * Process the result of a transcription, handling empty and partial results.
 */
export function processTranscriptionResult(result: TranscriptionResult | null): string {
  if (!result || !result.text.trim()) {
    return '[No speech detected]';
  }

  if (result.isPartial) {
    return `${result.text.trim()} [transcription incomplete]`;
  }

  return result.text.trim();
}
