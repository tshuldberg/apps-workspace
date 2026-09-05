import Stripe from 'stripe';
import type { ConnectAccount, ConnectAccountStatus } from './types';

export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, { apiVersion: '2025-02-24.acacia' });
}

export async function createConnectAccountLink(
  stripe: Stripe,
  accountId: string,
  refreshUrl: string,
  returnUrl: string,
): Promise<string> {
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });
  return link.url;
}

export async function createConnectAccount(
  stripe: Stripe,
  email: string,
  country: string = 'US',
): Promise<string> {
  const account = await stripe.accounts.create({
    type: 'standard',
    email,
    country,
  });
  return account.id;
}

export async function getConnectAccountStatus(
  stripe: Stripe,
  accountId: string,
): Promise<ConnectAccount> {
  const account = await stripe.accounts.retrieve(accountId);

  let status: ConnectAccountStatus = 'onboarding';
  if (account.charges_enabled && account.payouts_enabled) {
    status = 'active';
  } else if (account.details_submitted) {
    status = 'restricted';
  }

  return {
    stripeAccountId: account.id,
    chargesEnabled: account.charges_enabled ?? false,
    payoutsEnabled: account.payouts_enabled ?? false,
    status,
    country: account.country ?? 'US',
    detailsSubmitted: account.details_submitted ?? false,
  };
}

export function deriveAccountStatus(
  chargesEnabled: boolean,
  payoutsEnabled: boolean,
  detailsSubmitted: boolean,
): ConnectAccountStatus {
  if (chargesEnabled && payoutsEnabled) return 'active';
  if (detailsSubmitted) return 'restricted';
  return 'onboarding';
}
