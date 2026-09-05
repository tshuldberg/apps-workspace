import { z } from 'zod';

// ── Conversations ───────────────────────────────────────────────────

export const ConversationSchema = z.object({
  id: z.string().uuid(),
  title: z.string().max(100).nullable(),
  isGroup: z.boolean().default(false),
  createdBy: z.string().uuid(),
  lastMessageAt: z.string().datetime().nullable(),
  lastMessagePreview: z.string().max(200).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Conversation = z.infer<typeof ConversationSchema>;

export const CreateConversationInputSchema = z.object({
  participantIds: z.array(z.string().uuid()).min(1).max(10),
  title: z.string().max(100).optional(),
  isGroup: z.boolean().optional(),
});
export type CreateConversationInput = z.infer<typeof CreateConversationInputSchema>;

// ── Conversation Participants ───────────────────────────────────────

export const ParticipantRoleSchema = z.enum(['owner', 'member']);
export type ParticipantRole = z.infer<typeof ParticipantRoleSchema>;

export const ConversationParticipantSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  userId: z.string().uuid(),
  role: ParticipantRoleSchema,
  lastReadAt: z.string().datetime(),
  isMuted: z.boolean().default(false),
  joinedAt: z.string().datetime(),
});
export type ConversationParticipant = z.infer<typeof ConversationParticipantSchema>;

// ── Direct Messages ─────────────────────────────────────────────────

export const DirectMessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  senderId: z.string().uuid(),
  body: z.string().min(1).max(5000),
  mediaUrl: z.string().url().nullable(),
  mediaType: z.enum(['image', 'gif']).nullable(),
  isEdited: z.boolean().default(false),
  isDeleted: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type DirectMessage = z.infer<typeof DirectMessageSchema>;

export const SendMessageInputSchema = z.object({
  conversationId: z.string().uuid(),
  body: z.string().min(1).max(5000),
  mediaUrl: z.string().url().optional(),
  mediaType: z.enum(['image', 'gif']).optional(),
});
export type SendMessageInput = z.infer<typeof SendMessageInputSchema>;

// ── DM Helpers ──────────────────────────────────────────────────────

export const MAX_GROUP_PARTICIPANTS = 10;
export const MESSAGE_PAGE_SIZE = 50;

export function getUnreadCount(
  messages: Array<{ createdAt: string }>,
  lastReadAt: string,
): number {
  const threshold = new Date(lastReadAt).getTime();
  return messages.filter((m) => new Date(m.createdAt).getTime() > threshold).length;
}

export function isReadByRecipient(
  messageCreatedAt: string,
  recipientLastReadAt: string,
): boolean {
  return new Date(recipientLastReadAt).getTime() >= new Date(messageCreatedAt).getTime();
}

export function formatMessagePreview(body: string, maxLength = 200): string {
  if (body.length <= maxLength) return body;
  return body.slice(0, maxLength - 3) + '...';
}
