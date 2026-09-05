/**
 * Voice channel engine: participant management, grid layout, signaling helpers.
 */

import {
  isChannelFull,
  getGridLayout,
  isParticipantStale,
  VAD_THRESHOLD,
  HEARTBEAT_INTERVAL_MS,
  STALE_PARTICIPANT_MS,
} from '../models/voice';

// Re-export helpers
export {
  isChannelFull,
  getGridLayout,
  isParticipantStale,
  VAD_THRESHOLD,
  HEARTBEAT_INTERVAL_MS,
  STALE_PARTICIPANT_MS,
};

// ── STUN/TURN Configuration ─────────────────────────────────────────

export const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// ── Voice Activity Detection ────────────────────────────────────────

/**
 * Determine if audio level indicates speech.
 * Returns true when RMS amplitude exceeds threshold for minimum duration.
 */
export function detectSpeaking(
  rmsLevel: number,
  threshold: number = VAD_THRESHOLD,
): boolean {
  return rmsLevel > threshold;
}

/**
 * Calculate RMS level from raw audio samples.
 */
export function calculateRMS(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
}

// ── Participant Management ──────────────────────────────────────────

export function getActiveParticipants(
  participants: Array<{ userId: string; lastHeartbeat: number }>,
  now: number,
): Array<{ userId: string; lastHeartbeat: number }> {
  return participants.filter((p) => !isParticipantStale(p.lastHeartbeat, now));
}

export function getStaleParticipants(
  participants: Array<{ userId: string; lastHeartbeat: number }>,
  now: number,
): Array<{ userId: string; lastHeartbeat: number }> {
  return participants.filter((p) => isParticipantStale(p.lastHeartbeat, now));
}

// ── Signaling Helpers ───────────────────────────────────────────────

export function buildOfferPayload(
  sdp: string,
  senderId: string,
  targetId: string,
): Record<string, unknown> {
  return { type: 'offer', sdp, senderId, targetId };
}

export function buildAnswerPayload(
  sdp: string,
  senderId: string,
  targetId: string,
): Record<string, unknown> {
  return { type: 'answer', sdp, senderId, targetId };
}

export function buildIceCandidatePayload(
  candidate: string,
  sdpMLineIndex: number,
  senderId: string,
  targetId: string,
): Record<string, unknown> {
  return { type: 'ice_candidate', candidate, sdpMLineIndex, senderId, targetId };
}

// ── Mesh Topology ───────────────────────────────────────────────────

/**
 * Calculate number of peer connections needed for mesh.
 * Each participant needs N-1 connections.
 */
export function getMeshConnectionCount(participantCount: number): number {
  if (participantCount <= 1) return 0;
  return (participantCount * (participantCount - 1)) / 2;
}

/**
 * Warn if mesh topology is approaching practical limits.
 */
export function getMeshQualityWarning(participantCount: number): string | null {
  if (participantCount > 15) return 'Audio quality may degrade with this many participants';
  if (participantCount > 10) return 'Consider limiting participants for best audio quality';
  return null;
}
