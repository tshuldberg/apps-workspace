import type { SmsConfig, SendResult } from './types';
import { isWithinSendWindow } from './tcpa';

export interface SendSmsOptions {
  to: string;
  body: string;
  from?: string;
  recipientTimezone?: string;
  recipientState?: string;
  skipTcpaCheck?: boolean;
}

/**
 * Send an SMS message with TCPA compliance checks.
 * If outside the send window, the message is not sent and the result
 * indicates it should be queued.
 */
export async function sendSms(
  config: SmsConfig,
  options: SendSmsOptions
): Promise<SendResult> {
  const { to, body, from, recipientTimezone, recipientState, skipTcpaCheck } = options;
  const fromNumber = from ?? config.defaultFromNumber;

  if (!fromNumber) {
    return { success: false, error: 'No from number configured' };
  }

  // TCPA window enforcement
  if (config.tcpaEnforcement !== false && !skipTcpaCheck && recipientTimezone) {
    if (!isWithinSendWindow(recipientTimezone, recipientState)) {
      const { getNextSendWindow } = await import('./tcpa');
      const nextWindow = getNextSendWindow(recipientTimezone, recipientState);
      return {
        success: false,
        queued: true,
        queuedUntil: nextWindow,
        error: 'Outside TCPA send window',
      };
    }
  }

  try {
    const { Twilio } = await import('twilio');
    const client = new Twilio(config.accountSid, config.authToken);

    const message = await client.messages.create({
      to,
      from: fromNumber,
      body,
    });

    return {
      success: true,
      messageId: message.sid,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error sending SMS';
    return { success: false, error };
  }
}
