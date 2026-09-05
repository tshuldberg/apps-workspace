import { z } from 'zod';

// ── Voice Channels ──────────────────────────────────────────────────

export const VoiceChannelSchema = z.object({
  id: z.string().uuid(),
  communityId: z.string().uuid(),
  name: z.string().min(1).max(50),
  description: z.string().max(200).nullable(),
  maxParticipants: z.number().int().min(2).max(100).default(25),
  isLocked: z.boolean().default(false),
  createdBy: z.string().uuid(),
  position: z.number().int().nonnegative().default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type VoiceChannel = z.infer<typeof VoiceChannelSchema>;

export const CreateVoiceChannelInputSchema = z.object({
  communityId: z.string().uuid(),
  name: z.string().min(1).max(50),
  description: z.string().max(200).optional(),
  maxParticipants: z.number().int().min(2).max(100).optional(),
});
export type CreateVoiceChannelInput = z.infer<typeof CreateVoiceChannelInputSchema>;

// ── Voice Participants ──────────────────────────────────────────────

export const VoiceParticipantSchema = z.object({
  id: z.string().uuid(),
  channelId: z.string().uuid(),
  userId: z.string().uuid(),
  isMuted: z.boolean().default(false),
  isDeafened: z.boolean().default(false),
  isSpeaking: z.boolean().default(false),
  joinedAt: z.string().datetime(),
});
export type VoiceParticipant = z.infer<typeof VoiceParticipantSchema>;

// ── Voice State ─────────────────────────────────────────────────────

export const VoiceStateSchema = z.object({
  channelId: z.string().uuid(),
  channelName: z.string(),
  participantCount: z.number().int().nonnegative(),
  isMuted: z.boolean(),
  isDeafened: z.boolean(),
  isConnected: z.boolean(),
});
export type VoiceState = z.infer<typeof VoiceStateSchema>;

// ── Signaling ───────────────────────────────────────────────────────

export const SignalTypeSchema = z.enum(['join', 'leave', 'offer', 'answer', 'ice_candidate', 'mute_toggle', 'speaking']);
export type SignalType = z.infer<typeof SignalTypeSchema>;

export const SignalMessageSchema = z.object({
  type: SignalTypeSchema,
  senderId: z.string().uuid(),
  targetId: z.string().uuid().optional(),
  payload: z.record(z.unknown()).optional(),
});
export type SignalMessage = z.infer<typeof SignalMessageSchema>;

// ── Voice Helpers ───────────────────────────────────────────────────

export const VAD_THRESHOLD = 0.01;
export const VAD_SPEAKING_MIN_MS = 100;
export const HEARTBEAT_INTERVAL_MS = 30_000;
export const STALE_PARTICIPANT_MS = 60_000;

export function isChannelFull(
  currentCount: number,
  maxParticipants: number,
): boolean {
  return currentCount >= maxParticipants;
}

export function getGridLayout(participantCount: number): { cols: number; rows: number } {
  if (participantCount <= 1) return { cols: 1, rows: 1 };
  if (participantCount <= 4) return { cols: 2, rows: 2 };
  if (participantCount <= 9) return { cols: 3, rows: 3 };
  return { cols: 3, rows: Math.ceil(participantCount / 3) };
}

export function isParticipantStale(
  lastHeartbeat: number,
  now: number,
): boolean {
  return now - lastHeartbeat > STALE_PARTICIPANT_MS;
}
