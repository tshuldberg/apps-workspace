import { z } from 'zod';

// ── Listing Enums ────────────────────────────────────────────────────

export const ListingStatusSchema = z.enum([
  'draft',
  'active',
  'pending',
  'sold',
  'expired',
  'removed',
]);
export type ListingStatus = z.infer<typeof ListingStatusSchema>;

export const PricingTypeSchema = z.enum(['fixed', 'negotiable', 'free', 'trade']);
export type PricingType = z.infer<typeof PricingTypeSchema>;

export const ConditionSchema = z.enum([
  'new',
  'like_new',
  'good',
  'fair',
  'poor',
]);
export type Condition = z.infer<typeof ConditionSchema>;

export const ListingTypeSchema = z.enum([
  'sell',
  'trade',
  'free',
  'wanted',
  'service_offer',
  'service_request',
]);
export type ListingType = z.infer<typeof ListingTypeSchema>;

export const FulfillmentTypeSchema = z.enum([
  'pickup',
  'delivery',
  'shipping',
  'onsite',
  'remote',
]);
export type FulfillmentType = z.infer<typeof FulfillmentTypeSchema>;

// ── Category ─────────────────────────────────────────────────────────

export const CategorySchema = z.object({
  id: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  name: z.string().min(1).max(60),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  icon: z.string().max(10).nullable(),
  sortOrder: z.number().int().nonnegative(),
});
export type Category = z.infer<typeof CategorySchema>;

// ── Listing ──────────────────────────────────────────────────────────

export const ListingSchema = z.object({
  id: z.string().uuid(),
  sellerId: z.string().uuid(),
  categoryId: z.string().uuid(),
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(5000),
  priceCents: z.number().int().nonnegative().nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  pricingType: PricingTypeSchema,
  condition: ConditionSchema.nullable(),
  listingType: ListingTypeSchema,
  status: ListingStatusSchema,
  locationName: z.string().max(200).nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  fulfillmentType: FulfillmentTypeSchema.nullable(),
  serviceRadiusMiles: z.number().int().positive().nullable(),
  availabilityNotes: z.string().max(500).nullable(),
  tradeFor: z.string().max(500).nullable(),
  viewCount: z.number().int().nonnegative(),
  watchCount: z.number().int().nonnegative(),
  messageCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable(),
});
export type Listing = z.infer<typeof ListingSchema>;

export const CreateListingInputSchema = z.object({
  categoryId: z.string().uuid(),
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(5000),
  priceCents: z.number().int().nonnegative().optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  pricingType: PricingTypeSchema,
  condition: ConditionSchema.optional(),
  listingType: ListingTypeSchema,
  locationName: z.string().max(200).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  fulfillmentType: FulfillmentTypeSchema.optional(),
  serviceRadiusMiles: z.number().int().positive().optional(),
  availabilityNotes: z.string().max(500).optional(),
  tradeFor: z.string().max(500).optional(),
}).superRefine((input, ctx) => {
  const isServiceListing = input.listingType === 'service_offer' || input.listingType === 'service_request';

  if (!isServiceListing && !input.condition) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['condition'],
      message: 'Condition is required for goods listings.',
    });
  }

  if (isServiceListing && !input.fulfillmentType) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['fulfillmentType'],
      message: 'Fulfillment type is required for service listings.',
    });
  }
});
export type CreateListingInput = z.infer<typeof CreateListingInputSchema>;

// ── Listing Photo ────────────────────────────────────────────────────

export const ListingPhotoSchema = z.object({
  id: z.string().uuid(),
  listingId: z.string().uuid(),
  url: z.string().url(),
  sortOrder: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});
export type ListingPhoto = z.infer<typeof ListingPhotoSchema>;

// ── Conversation & Messages ──────────────────────────────────────────

export const ConversationSchema = z.object({
  id: z.string().uuid(),
  listingId: z.string().uuid(),
  buyerId: z.string().uuid(),
  sellerId: z.string().uuid(),
  lastMessageAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type Conversation = z.infer<typeof ConversationSchema>;

export const MessageContentTypeSchema = z.enum([
  'text/plain',
  'application/e2ee+ciphertext',
]);
export type MessageContentType = z.infer<typeof MessageContentTypeSchema>;

export const MessageEncryptionAlgorithmSchema = z.enum(['aes-256-gcm']);
export type MessageEncryptionAlgorithm = z.infer<typeof MessageEncryptionAlgorithmSchema>;

export const MessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  senderId: z.string().uuid(),
  body: z.string().min(1).max(2000).nullable(),
  contentType: MessageContentTypeSchema,
  ciphertext: z.string().min(1).nullable(),
  encryptionAlgorithm: MessageEncryptionAlgorithmSchema.nullable(),
  encryptionSalt: z.string().min(1).nullable(),
  encryptionIv: z.string().min(1).nullable(),
  createdAt: z.string().datetime(),
}).superRefine((message, ctx) => {
  if (message.contentType === 'text/plain' && !message.body) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['body'],
      message: 'Plaintext messages require a body.',
    });
  }

  if (message.contentType === 'application/e2ee+ciphertext') {
    const encryptedFields = [
      ['ciphertext', message.ciphertext],
      ['encryptionAlgorithm', message.encryptionAlgorithm],
      ['encryptionSalt', message.encryptionSalt],
      ['encryptionIv', message.encryptionIv],
    ] as const;

    for (const [field, value] of encryptedFields) {
      if (!value) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: 'Encrypted messages require a complete encryption envelope.',
        });
      }
    }
  }
});
export type Message = z.infer<typeof MessageSchema>;

export const CreateMessageInputSchema = z.union([
  z.object({
    body: z.string().min(1).max(2000),
  }),
  z.object({
    contentType: z.literal('application/e2ee+ciphertext'),
    ciphertext: z.string().min(1),
    encryptionAlgorithm: MessageEncryptionAlgorithmSchema.default('aes-256-gcm'),
    encryptionSalt: z.string().min(1),
    encryptionIv: z.string().min(1),
  }),
]);
export type CreateMessageInput = z.infer<typeof CreateMessageInputSchema>;

// ── Signal-Style Secure Messaging ───────────────────────────────────

export const ConversationRequestStatusSchema = z.enum([
  'pending',
  'accepted',
  'rejected',
  'blocked',
  'expired',
]);
export type ConversationRequestStatus = z.infer<typeof ConversationRequestStatusSchema>;

export const DevicePlatformSchema = z.enum(['ios', 'android', 'web', 'desktop']);
export type DevicePlatform = z.infer<typeof DevicePlatformSchema>;

export const SecureKeyAlgorithmSchema = z.enum(['curve25519']);
export type SecureKeyAlgorithm = z.infer<typeof SecureKeyAlgorithmSchema>;

export const PostQuantumKemSchema = z.enum(['kyber1024']);
export type PostQuantumKem = z.infer<typeof PostQuantumKemSchema>;

export const SecureDeviceSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  platform: DevicePlatformSchema,
  label: z.string().max(80).nullable(),
  identityKey: z.string().min(1),
  registrationId: z.number().int().positive(),
  supportsSealedSender: z.boolean(),
  supportsPostQuantum: z.boolean(),
  createdAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
});
export type SecureDevice = z.infer<typeof SecureDeviceSchema>;

export const SignedPreKeySchema = z.object({
  id: z.string().uuid(),
  deviceId: z.string().uuid(),
  keyId: z.number().int().nonnegative(),
  algorithm: SecureKeyAlgorithmSchema,
  publicKey: z.string().min(1),
  signature: z.string().min(1),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable(),
});
export type SignedPreKey = z.infer<typeof SignedPreKeySchema>;

export const OneTimePreKeyKindSchema = z.enum([
  'curve25519',
  'kyber1024',
  'kyber1024_last_resort',
]);
export type OneTimePreKeyKind = z.infer<typeof OneTimePreKeyKindSchema>;

export const OneTimePreKeySchema = z.object({
  id: z.string().uuid(),
  deviceId: z.string().uuid(),
  keyId: z.number().int().nonnegative(),
  kind: OneTimePreKeyKindSchema,
  publicKey: z.string().min(1),
  isConsumed: z.boolean(),
  createdAt: z.string().datetime(),
  consumedAt: z.string().datetime().nullable(),
});
export type OneTimePreKey = z.infer<typeof OneTimePreKeySchema>;

export const RecipientPreKeyBundleSchema = z.object({
  device: SecureDeviceSchema,
  signedPreKey: SignedPreKeySchema,
  curveOneTimePreKey: OneTimePreKeySchema.nullable(),
  pqOneTimePreKey: OneTimePreKeySchema.nullable(),
  pqLastResortPreKey: OneTimePreKeySchema.nullable(),
});
export type RecipientPreKeyBundle = z.infer<typeof RecipientPreKeyBundleSchema>;

export const PublishDeviceBundleInputSchema = z.object({
  platform: DevicePlatformSchema,
  label: z.string().max(80).optional(),
  identityKey: z.string().min(1),
  registrationId: z.number().int().positive(),
  supportsSealedSender: z.boolean().optional(),
  supportsPostQuantum: z.boolean().optional(),
  signedPreKey: z.object({
    keyId: z.number().int().nonnegative(),
    publicKey: z.string().min(1),
    signature: z.string().min(1),
  }),
  curveOneTimePreKeys: z.array(z.object({
    keyId: z.number().int().nonnegative(),
    publicKey: z.string().min(1),
  })).optional(),
  pqOneTimePreKeys: z.array(z.object({
    keyId: z.number().int().nonnegative(),
    publicKey: z.string().min(1),
  })).optional(),
  pqLastResortPreKey: z.object({
    keyId: z.number().int().nonnegative(),
    publicKey: z.string().min(1),
  }).optional(),
});
export type PublishDeviceBundleInput = z.infer<typeof PublishDeviceBundleInputSchema>;

export const ConversationRequestSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  listingId: z.string().uuid(),
  requesterId: z.string().uuid(),
  responderId: z.string().uuid(),
  friendLinkId: z.string().uuid().nullable(),
  status: ConversationRequestStatusSchema,
  createdAt: z.string().datetime(),
  respondedAt: z.string().datetime().nullable(),
});
export type ConversationRequest = z.infer<typeof ConversationRequestSchema>;

export const CreateConversationRequestInputSchema = z.object({
  listingId: z.string().uuid(),
  friendLinkId: z.string().uuid().optional(),
});
export type CreateConversationRequestInput = z.infer<typeof CreateConversationRequestInputSchema>;

export const EncryptedEnvelopeTypeSchema = z.enum([
  'prekey_signal_message',
  'signal_message',
  'sealed_sender_message',
]);
export type EncryptedEnvelopeType = z.infer<typeof EncryptedEnvelopeTypeSchema>;

export const SecureEnvelopeSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  requestId: z.string().uuid().nullable(),
  senderId: z.string().uuid(),
  senderDeviceId: z.string().uuid(),
  recipientId: z.string().uuid(),
  recipientDeviceId: z.string().uuid(),
  envelopeType: EncryptedEnvelopeTypeSchema,
  protocolVersion: z.string().max(20),
  ciphertext: z.string().min(1),
  registrationId: z.number().int().positive().nullable(),
  messageIndex: z.number().int().nonnegative().nullable(),
  previousChainLength: z.number().int().nonnegative().nullable(),
  sentAt: z.string().datetime(),
  deliveredAt: z.string().datetime().nullable(),
  readAt: z.string().datetime().nullable(),
});
export type SecureEnvelope = z.infer<typeof SecureEnvelopeSchema>;

export const CreateSecureEnvelopeInputSchema = z.object({
  conversationId: z.string().uuid(),
  requestId: z.string().uuid().optional(),
  recipientId: z.string().uuid(),
  senderDeviceId: z.string().uuid(),
  recipientDeviceId: z.string().uuid(),
  envelopeType: EncryptedEnvelopeTypeSchema,
  protocolVersion: z.string().max(20).default('signal-pqxdh-v1'),
  ciphertext: z.string().min(1),
  registrationId: z.number().int().positive().optional(),
  messageIndex: z.number().int().nonnegative().optional(),
  previousChainLength: z.number().int().nonnegative().optional(),
});
export type CreateSecureEnvelopeInput = z.infer<typeof CreateSecureEnvelopeInputSchema>;

// ── Watchlist ────────────────────────────────────────────────────────

export const WatchlistItemSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  listingId: z.string().uuid(),
  createdAt: z.string().datetime(),
});
export type WatchlistItem = z.infer<typeof WatchlistItemSchema>;

// ── Reviews & Seller Stats ───────────────────────────────────────────

export const ReviewSchema = z.object({
  id: z.string().uuid(),
  reviewerId: z.string().uuid(),
  sellerId: z.string().uuid(),
  listingId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  body: z.string().max(1000).nullable(),
  createdAt: z.string().datetime(),
});
export type Review = z.infer<typeof ReviewSchema>;

export const SellerStatsSchema = z.object({
  sellerId: z.string().uuid(),
  totalListings: z.number().int().nonnegative(),
  activeListings: z.number().int().nonnegative(),
  totalSold: z.number().int().nonnegative(),
  averageRating: z.number().nonnegative().nullable(),
  reviewCount: z.number().int().nonnegative(),
  responseRate: z.number().nonnegative().nullable(),
  memberSince: z.string().datetime(),
});
export type SellerStats = z.infer<typeof SellerStatsSchema>;

// ── Saved Search ─────────────────────────────────────────────────────

export const SavedSearchSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().max(100),
  query: z.string().max(200),
  categoryId: z.string().uuid().nullable(),
  minPriceCents: z.number().int().nonnegative().nullable(),
  maxPriceCents: z.number().int().nonnegative().nullable(),
  notifyOnMatch: z.boolean(),
  createdAt: z.string().datetime(),
});
export type SavedSearch = z.infer<typeof SavedSearchSchema>;

// ── Report & Block ───────────────────────────────────────────────────

export const ReportReasonSchema = z.enum([
  'spam',
  'prohibited_item',
  'fraud',
  'offensive',
  'duplicate',
  'other',
]);
export type ReportReason = z.infer<typeof ReportReasonSchema>;

export const ReportSchema = z.object({
  id: z.string().uuid(),
  reporterId: z.string().uuid(),
  listingId: z.string().uuid().nullable(),
  userId: z.string().uuid().nullable(),
  reason: ReportReasonSchema,
  details: z.string().max(1000).nullable(),
  createdAt: z.string().datetime(),
});
export type Report = z.infer<typeof ReportSchema>;

export const BlockSchema = z.object({
  id: z.string().uuid(),
  blockerId: z.string().uuid(),
  blockedId: z.string().uuid(),
  createdAt: z.string().datetime(),
});
export type Block = z.infer<typeof BlockSchema>;

// ── Offers ──────────────────────────────────────────────────────────

export const OfferStatusSchema = z.enum([
  'pending',
  'accepted',
  'rejected',
  'countered',
  'expired',
  'withdrawn',
]);
export type OfferStatus = z.infer<typeof OfferStatusSchema>;

export const OfferSchema = z.object({
  id: z.string().uuid(),
  listingId: z.string().uuid(),
  buyerId: z.string().uuid(),
  sellerId: z.string().uuid(),
  amountCents: z.number().int().positive(),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  status: OfferStatusSchema,
  counterAmountCents: z.number().int().positive().nullable(),
  message: z.string().max(500).nullable(),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Offer = z.infer<typeof OfferSchema>;

export const CreateOfferInputSchema = z.object({
  listingId: z.string().uuid(),
  amountCents: z.number().int().positive(),
  message: z.string().max(500).optional(),
});
export type CreateOfferInput = z.infer<typeof CreateOfferInputSchema>;

// ── Price History ───────────────────────────────────────────────────

export const PriceHistorySchema = z.object({
  id: z.string().uuid(),
  listingId: z.string().uuid(),
  oldPriceCents: z.number().int().nonnegative().nullable(),
  newPriceCents: z.number().int().nonnegative().nullable(),
  changedAt: z.string().datetime(),
});
export type PriceHistory = z.infer<typeof PriceHistorySchema>;

// ── Payments ────────────────────────────────────────────────────────

export const PaymentStatusSchema = z.enum([
  'pending',
  'processing',
  'succeeded',
  'failed',
  'refunded',
  'disputed',
]);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

export const FeePayerSchema = z.enum(['buyer', 'seller']);
export type FeePayer = z.infer<typeof FeePayerSchema>;

export const PaymentSchema = z.object({
  id: z.string().uuid(),
  listingId: z.string().uuid(),
  buyerId: z.string().uuid(),
  sellerId: z.string().uuid(),
  stripePaymentIntentId: z.string(),
  amountCents: z.number().int().positive(),
  processingFeeCents: z.number().int().nonnegative(),
  feePayer: FeePayerSchema,
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  status: PaymentStatusSchema,
  refundAmountCents: z.number().int().nonnegative().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Payment = z.infer<typeof PaymentSchema>;

export const EscrowStatusSchema = z.enum([
  'holding',
  'released',
  'refunded',
  'disputed',
]);
export type EscrowStatus = z.infer<typeof EscrowStatusSchema>;

export const EscrowSchema = z.object({
  id: z.string().uuid(),
  paymentId: z.string().uuid(),
  status: EscrowStatusSchema,
  holdUntil: z.string().datetime(),
  releasedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type Escrow = z.infer<typeof EscrowSchema>;

// ── Disputes ────────────────────────────────────────────────────────

export const DisputeReasonSchema = z.enum([
  'item_not_received',
  'item_not_as_described',
  'item_damaged',
  'wrong_item',
  'counterfeit',
  'other',
]);
export type DisputeReason = z.infer<typeof DisputeReasonSchema>;

export const DisputeStatusSchema = z.enum([
  'open',
  'seller_response',
  'evidence_review',
  'resolved_buyer',
  'resolved_seller',
  'escalated',
  'closed',
]);
export type DisputeStatus = z.infer<typeof DisputeStatusSchema>;

export const DisputeResolutionTypeSchema = z.enum([
  'full_refund',
  'partial_refund',
  'return_and_refund',
  'no_refund',
  'mutual_agreement',
]);
export type DisputeResolutionType = z.infer<typeof DisputeResolutionTypeSchema>;

export const DisputeSchema = z.object({
  id: z.string().uuid(),
  paymentId: z.string().uuid(),
  listingId: z.string().uuid(),
  buyerId: z.string().uuid(),
  sellerId: z.string().uuid(),
  reason: DisputeReasonSchema,
  description: z.string().min(20).max(2000),
  status: DisputeStatusSchema,
  resolutionType: DisputeResolutionTypeSchema.nullable(),
  refundAmountCents: z.number().int().nonnegative().nullable(),
  filedAt: z.string().datetime(),
  sellerResponseDeadline: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type Dispute = z.infer<typeof DisputeSchema>;

export const DisputeEvidenceTypeSchema = z.enum([
  'photo',
  'screenshot',
  'text',
  'tracking',
]);
export type DisputeEvidenceType = z.infer<typeof DisputeEvidenceTypeSchema>;

export const DisputeEvidenceSchema = z.object({
  id: z.string().uuid(),
  disputeId: z.string().uuid(),
  submittedBy: z.string().uuid(),
  evidenceType: DisputeEvidenceTypeSchema,
  content: z.string(),
  caption: z.string().max(500).nullable(),
  createdAt: z.string().datetime(),
});
export type DisputeEvidence = z.infer<typeof DisputeEvidenceSchema>;

export const CreateDisputeInputSchema = z.object({
  paymentId: z.string().uuid(),
  reason: DisputeReasonSchema,
  description: z.string().min(20).max(2000),
});
export type CreateDisputeInput = z.infer<typeof CreateDisputeInputSchema>;

// ── Shipping & Delivery ─────────────────────────────────────────────

export const ShippingCarrierSchema = z.enum([
  'usps',
  'ups',
  'fedex',
  'dhl',
  'amazon',
  'other',
]);
export type ShippingCarrier = z.infer<typeof ShippingCarrierSchema>;

export const ShipmentStatusSchema = z.enum([
  'label_created',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'exception',
  'returned',
]);
export type ShipmentStatus = z.infer<typeof ShipmentStatusSchema>;

export const ShipmentSchema = z.object({
  id: z.string().uuid(),
  paymentId: z.string().uuid(),
  listingId: z.string().uuid(),
  sellerId: z.string().uuid(),
  buyerId: z.string().uuid(),
  carrier: ShippingCarrierSchema,
  trackingNumber: z.string().min(5).max(50),
  status: ShipmentStatusSchema,
  estimatedDeliveryDate: z.string().nullable(),
  actualDeliveryDate: z.string().nullable(),
  lastCarrierUpdate: z.string().nullable(),
  lastCheckedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Shipment = z.infer<typeof ShipmentSchema>;

export const ShipmentEventSchema = z.object({
  id: z.string().uuid(),
  shipmentId: z.string().uuid(),
  status: z.string(),
  description: z.string(),
  location: z.string().nullable(),
  occurredAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});
export type ShipmentEvent = z.infer<typeof ShipmentEventSchema>;

export const AddTrackingInputSchema = z.object({
  paymentId: z.string().uuid(),
  carrier: ShippingCarrierSchema,
  trackingNumber: z.string().min(5).max(50),
});
export type AddTrackingInput = z.infer<typeof AddTrackingInputSchema>;

// ── Service Discovery ───────────────────────────────────────────────

export const ServicePortfolioItemSchema = z.object({
  id: z.string().uuid(),
  listingId: z.string().uuid(),
  mediaType: z.enum(['photo', 'certificate', 'before_after']),
  url: z.string().url(),
  caption: z.string().max(200).nullable(),
  sortOrder: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});
export type ServicePortfolioItem = z.infer<typeof ServicePortfolioItemSchema>;

export const ServiceAreaSchema = z.object({
  id: z.string().uuid(),
  listingId: z.string().uuid(),
  areaName: z.string().max(100),
  centerLat: z.number(),
  centerLng: z.number(),
  radiusMiles: z.number().int().min(1).max(100),
  createdAt: z.string().datetime(),
});
export type ServiceArea = z.infer<typeof ServiceAreaSchema>;

export const ServiceAvailabilitySchema = z.object({
  id: z.string().uuid(),
  listingId: z.string().uuid(),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  createdAt: z.string().datetime(),
});
export type ServiceAvailability = z.infer<typeof ServiceAvailabilitySchema>;

// ── Stripe Connect ──────────────────────────────────────────────────

export const ConnectAccountStatusSchema = z.enum([
  'onboarding',
  'pending_verification',
  'active',
  'restricted',
  'disabled',
]);
export type ConnectAccountStatus = z.infer<typeof ConnectAccountStatusSchema>;

export const ConnectAccountSchema = z.object({
  userId: z.string().uuid(),
  stripeAccountId: z.string().min(1),
  status: ConnectAccountStatusSchema,
  chargesEnabled: z.boolean(),
  payoutsEnabled: z.boolean(),
  country: z.string().regex(/^[A-Z]{2}$/).default('US'),
  defaultCurrency: z.string().regex(/^[a-z]{3}$/).default('usd'),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ConnectAccount = z.infer<typeof ConnectAccountSchema>;

export const CreatePaymentIntentInputSchema = z.object({
  listingId: z.string().uuid(),
  offerId: z.string().uuid().optional(),
  amountCents: z.number().int().positive(),
  currency: z.string().regex(/^[a-z]{3}$/).default('usd'),
  sellerStripeAccountId: z.string().min(1),
  feePayer: FeePayerSchema.default('buyer'),
  metadata: z.record(z.string()).optional(),
});
export type CreatePaymentIntentInput = z.infer<typeof CreatePaymentIntentInputSchema>;

export const RefundInputSchema = z.object({
  paymentId: z.string().uuid(),
  stripePaymentIntentId: z.string().min(1),
  amountCents: z.number().int().positive(),
  reason: z.enum(['requested_by_customer', 'duplicate', 'fraudulent', 'dispute_resolution']),
});
export type RefundInput = z.infer<typeof RefundInputSchema>;

export const StripeWebhookEventTypeSchema = z.enum([
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'charge.dispute.created',
  'charge.dispute.closed',
  'charge.refunded',
  'account.updated',
  'transfer.created',
]);
export type StripeWebhookEventType = z.infer<typeof StripeWebhookEventTypeSchema>;

// ── Seller Verification ─────────────────────────────────────────────

export const VerificationLevelSchema = z.enum([
  'unverified',
  'basic',
  'verified',
  'trusted',
  'top_seller',
]);
export type VerificationLevel = z.infer<typeof VerificationLevelSchema>;

export const SellerVerificationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  emailVerified: z.boolean(),
  phoneVerified: z.boolean(),
  photoVerified: z.boolean(),
  idVerified: z.boolean(),
  completedSales: z.number().int().nonnegative(),
  totalReviews: z.number().int().nonnegative(),
  averageRating: z.number().nonnegative().nullable(),
  accountAgeDays: z.number().int().nonnegative(),
  verificationLevel: VerificationLevelSchema,
  levelAchievedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SellerVerification = z.infer<typeof SellerVerificationSchema>;
