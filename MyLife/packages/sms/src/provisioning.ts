import type { SmsConfig } from './types';

export interface RestaurantNumber {
  restaurantId: string;
  phoneNumber: string;
  friendlyName: string;
  active: boolean;
  provisionedAt: Date;
}

/**
 * Get the from-number for a restaurant.
 * Each restaurant gets a dedicated number for sender identity.
 */
export function getRestaurantFromNumber(
  numbers: RestaurantNumber[],
  restaurantId: string
): string | null {
  const record = numbers.find(
    (n) => n.restaurantId === restaurantId && n.active
  );
  return record?.phoneNumber ?? null;
}

/**
 * Provision a new phone number for a restaurant via Twilio.
 */
export async function provisionNumber(
  config: SmsConfig,
  restaurantId: string,
  areaCode?: string
): Promise<RestaurantNumber | null> {
  try {
    const { Twilio } = await import('twilio');
    const client = new Twilio(config.accountSid, config.authToken);

    const available = await client.availablePhoneNumbers('US')
      .local
      .list({
        areaCode: areaCode ? parseInt(areaCode, 10) : undefined,
        smsEnabled: true,
        limit: 1,
      });

    if (available.length === 0) return null;

    const purchased = await client.incomingPhoneNumbers.create({
      phoneNumber: available[0].phoneNumber,
      friendlyName: `Restaurant ${restaurantId}`,
    });

    return {
      restaurantId,
      phoneNumber: purchased.phoneNumber,
      friendlyName: purchased.friendlyName,
      active: true,
      provisionedAt: new Date(),
    };
  } catch {
    return null;
  }
}

/**
 * Release a provisioned number.
 */
export async function releaseNumber(
  config: SmsConfig,
  numberSid: string
): Promise<boolean> {
  try {
    const { Twilio } = await import('twilio');
    const client = new Twilio(config.accountSid, config.authToken);
    await client.incomingPhoneNumbers(numberSid).remove();
    return true;
  } catch {
    return false;
  }
}
