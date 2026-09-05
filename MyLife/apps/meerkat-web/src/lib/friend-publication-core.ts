/** Publication acknowledgement does not prove a one-use code remains unconsumed. */
export function friendPublicationStatus(expiresAt: number | null, now: number): { expired: boolean; text: string } {
  if (expiresAt === null) return {
    expired: false,
    text: 'Publication acknowledged. This server did not provide an expiry time. The code may already be used or expired; publish again if your friend cannot find you.',
  };
  if (expiresAt <= now) return { expired: true, text: 'This publication has expired. Publish again before sharing your code.' };
  return { expired: false, text: `Published until ${new Date(expiresAt).toLocaleString()}. This is a one-use code and may already have been used.` };
}
