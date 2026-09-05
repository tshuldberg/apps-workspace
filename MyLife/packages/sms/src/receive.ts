import type { InboundMessage, ConversationThread } from './types';
import { handleInboundConsent } from './consent';

export interface ReplyRoute {
  context: ConversationThread['context'];
  handler: (message: InboundMessage, thread: ConversationThread) => Promise<string | null>;
}

const replyRoutes: ReplyRoute[] = [];

/**
 * Register a reply handler for a conversation context.
 */
export function registerReplyRoute(route: ReplyRoute): void {
  replyRoutes.push(route);
}

/**
 * Parse an inbound SMS webhook payload (Twilio format).
 */
export function parseInboundWebhook(body: Record<string, string>): InboundMessage {
  return {
    from: body.From ?? '',
    to: body.To ?? '',
    body: body.Body ?? '',
    messageSid: body.MessageSid ?? '',
    timestamp: new Date(),
  };
}

/**
 * Handle an inbound message: check for consent keywords first,
 * then route to the appropriate conversation handler.
 */
export async function handleInboundMessage(
  message: InboundMessage,
  thread: ConversationThread | null,
  restaurantId: string
): Promise<string | null> {
  // Check for opt-out/opt-in keywords first
  const consentResponse = handleInboundConsent(message.body, message.from, restaurantId);
  if (consentResponse) {
    return consentResponse;
  }

  // Route to conversation handler
  if (thread) {
    for (const route of replyRoutes) {
      if (route.context === thread.context) {
        return route.handler(message, thread);
      }
    }
  }

  return null;
}
