import type {
  Condition,
  Listing,
  ListingType,
  Offer,
  VerificationLevel,
} from '../types';
import {
  MK_CONDITION,
  MK_LISTING_TYPES,
  MK_OFFER_STATUS,
  MK_TIER,
} from './tokens';

export function withAlpha(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((part) => `${part}${part}`).join('')
    : normalized;

  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const CONDITION_META = {
  new: {
    tone: 'new',
    color: MK_CONDITION.new,
    label: 'New',
  },
  like_new: {
    tone: 'likeNew',
    color: MK_CONDITION.likeNew,
    label: 'Like New',
  },
  good: {
    tone: 'good',
    color: MK_CONDITION.good,
    label: 'Good',
  },
  fair: {
    tone: 'fair',
    color: MK_CONDITION.fair,
    label: 'Fair',
  },
  poor: {
    tone: 'poor',
    color: MK_CONDITION.poor,
    label: 'Poor',
  },
} as const;

export function getConditionMeta(condition: Condition) {
  return CONDITION_META[condition];
}

const VERIFICATION_META = {
  unverified: {
    tone: 'unverified',
    color: MK_TIER.unverified,
    label: 'Unverified',
    icon: 'account_circle',
  },
  basic: {
    tone: 'basic',
    color: MK_TIER.basic,
    label: 'Basic',
    icon: 'verified',
  },
  verified: {
    tone: 'verified',
    color: MK_TIER.verified,
    label: 'Verified',
    icon: 'verified',
  },
  trusted: {
    tone: 'trusted',
    color: MK_TIER.trusted,
    label: 'Trusted',
    icon: 'verified',
  },
  top_seller: {
    tone: 'topSeller',
    color: MK_TIER.topSeller,
    label: 'Top Seller',
    icon: 'crown',
  },
} as const;

export function getVerificationMeta(level: VerificationLevel) {
  return VERIFICATION_META[level];
}

const LISTING_TYPE_META = {
  sell: {
    tone: 'sell',
    color: MK_LISTING_TYPES.sell,
    label: 'Sell',
    icon: 'sell',
  },
  trade: {
    tone: 'trade',
    color: MK_LISTING_TYPES.trade,
    label: 'Trade',
    icon: 'swap_horiz',
  },
  free: {
    tone: 'free',
    color: MK_LISTING_TYPES.free,
    label: 'Free',
    icon: 'redeem',
  },
  wanted: {
    tone: 'wanted',
    color: MK_LISTING_TYPES.wanted,
    label: 'Wanted',
    icon: 'search',
  },
  service_offer: {
    tone: 'serviceOffer',
    color: MK_LISTING_TYPES.serviceOffer,
    label: 'Service Offer',
    icon: 'build',
  },
  service_request: {
    tone: 'serviceRequest',
    color: MK_LISTING_TYPES.serviceRequest,
    label: 'Service Request',
    icon: 'support_agent',
  },
} as const;

export function getListingTypeMeta(type: ListingType) {
  return LISTING_TYPE_META[type];
}

export function getOfferStatusMeta(status: Offer['status'] | string) {
  switch (status) {
    case 'accepted':
      return {
        tone: 'accepted',
        color: MK_OFFER_STATUS.accepted,
        label: 'Accepted',
      } as const;
    case 'rejected':
      return {
        tone: 'declined',
        color: MK_OFFER_STATUS.declined,
        label: 'Declined',
      } as const;
    case 'countered':
      return {
        tone: 'counter',
        color: MK_OFFER_STATUS.counter,
        label: 'Counter',
      } as const;
    case 'expired':
      return {
        tone: 'expired',
        color: MK_OFFER_STATUS.expired,
        label: 'Expired',
      } as const;
    default:
      return {
        tone: 'pending',
        color: MK_OFFER_STATUS.pending,
        label: 'Pending',
      } as const;
  }
}

export function formatMarketPrice(price: number, currency = 'USD') {
  if (!Number.isFinite(price)) {
    return '$0';
  }

  const maximumFractionDigits = Number.isInteger(price) ? 0 : 2;

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits,
    }).format(price);
  } catch {
    return `$${price.toFixed(maximumFractionDigits)}`;
  }
}

export function getListingPriceLabel(
  listing: Pick<Listing, 'priceCents' | 'currency' | 'pricingType'>,
) {
  if (listing.pricingType === 'free') {
    return 'Free';
  }

  if (listing.priceCents == null) {
    return 'Contact';
  }

  return formatMarketPrice(listing.priceCents / 100, listing.currency);
}

export function formatMessageTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function getMessageBubbleKind(message: Record<string, unknown>) {
  if (typeof message.bubbleType === 'string') {
    return message.bubbleType;
  }

  if (typeof message.imageUrl === 'string') {
    return 'image';
  }

  if (typeof message.locationLabel === 'string') {
    return 'location';
  }

  if (
    typeof message.offerTitle === 'string' ||
    typeof message.offerPrice === 'number'
  ) {
    return 'offer_card';
  }

  if (message.contentType === 'application/e2ee+ciphertext') {
    return 'encrypted';
  }

  return 'text';
}
