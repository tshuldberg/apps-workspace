import type { ReactElement, ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { DatabaseAdapter } from '@mylife/db';
import {
  GlassCard,
  ListingTypePill,
  MaterialSymbol,
  MK_ACCENT,
  MK_ACCENT_DARK,
  MK_ACCENT_LIGHT,
  MK_SURFACES,
  MK_TEXT,
  MK_TEXT_SECONDARY,
  MK_TEXT_TERTIARY,
  MK_TYPOGRAPHY,
  PriceBadge,
  SectionHeader,
  VerificationBadge,
  getCachedListingById,
  type DatabaseAdapter as MarketDatabaseAdapter,
  type Listing,
  type VerificationLevel,
  upsertCachedListing,
  withAlpha,
} from '@mylife/market';
import { useDatabase } from '../../components/DatabaseProvider';

const LOCAL_USER = 'local-user';

type ServicesTab = 'browse' | 'my-services' | 'requests';
type ServiceCategory =
  | 'Cleaning'
  | 'Repair'
  | 'Tutoring'
  | 'Design'
  | 'Tech'
  | 'Beauty'
  | 'Other';
type AvailabilityState = 'available' | 'busy' | 'away';
type ReportTargetType = 'listing' | 'user' | 'message';
type ReportReasonChoice =
  | 'spam'
  | 'scam'
  | 'inappropriate'
  | 'counterfeit'
  | 'harassment'
  | 'underage'
  | 'stolen_goods'
  | 'other';
type RequestStatus = 'open' | 'matched' | 'scheduled' | 'closed';

interface ServicePortfolioAsset {
  id: string;
  label: string;
  tint: string;
}

interface ServiceProvider {
  id: string;
  name: string;
  title: string;
  category: ServiceCategory;
  tagline: string;
  rate: number;
  rateUnit: 'hr' | 'flat';
  distanceMiles: number;
  distanceLabel: string;
  availability: AvailabilityState;
  rating: number;
  reviewCount: number;
  verificationTier: VerificationLevel;
  locationLabel: string;
  responseTime: string;
  about: string;
  portfolio: ServicePortfolioAsset[];
}

interface MyServiceItem {
  id: string;
  title: string;
  category: ServiceCategory;
  rate: number;
  rateUnit: 'hr' | 'flat';
  active: boolean;
  scheduleLabel: string;
}

interface ServiceRequestItem {
  id: string;
  title: string;
  category: ServiceCategory;
  budgetLabel: string;
  status: RequestStatus;
  interestedCount: number;
  updatedLabel: string;
  detail: string;
  providerId?: string;
}

interface PaymentMethodItem {
  id: string;
  label: string;
  detail: string;
  brandTint: string;
  isDefault: boolean;
}

interface ShippingAddressItem {
  id: string;
  label: string;
  detail: string;
  isDefault: boolean;
}

interface BlockedUserItem {
  id: string;
  name: string;
  reason: string;
  blockedAt: string;
  tint: string;
}

interface ReportRecord {
  id: string;
  type: ReportTargetType;
  targetId: string | null;
  targetUserId: string | null;
  reason: ReportReasonChoice;
  details: string;
  anonymous: boolean;
  evidenceUris: string[];
  createdAt: string;
}

interface NotificationPreferences {
  newMessages: boolean;
  savedSearchMatches: boolean;
  watchlistPriceDrops: boolean;
  offerReceived: boolean;
  offerAccepted: boolean;
  orderUpdates: boolean;
  disputeUpdates: boolean;
}

interface PrivacyPreferences {
  showOnlineStatus: boolean;
  showLastSeen: boolean;
  allowMessageRequests: boolean;
  hideProfileFromSearch: boolean;
}

interface MarketSettingsStore {
  notifications: NotificationPreferences;
  privacy: PrivacyPreferences;
  paymentMethods: PaymentMethodItem[];
  shippingAddresses: ShippingAddressItem[];
  blockedUsers: BlockedUserItem[];
  payoutConnected: boolean;
  payoutLabel: string;
  reports: ReportRecord[];
  providers: ServiceProvider[];
  myServices: MyServiceItem[];
  serviceRequests: ServiceRequestItem[];
}

const SERVICE_CATEGORIES = [
  'All',
  'Cleaning',
  'Repair',
  'Tutoring',
  'Design',
  'Tech',
  'Beauty',
  'Other',
] as const;

const REPORT_REASON_OPTIONS = [
  {
    id: 'spam',
    label: 'Spam',
    description: 'Mass-posted, irrelevant, or low-quality solicitation.',
  },
  {
    id: 'scam',
    label: 'Scam / Fraud',
    description: 'Requests payment, off-platform contact, or suspicious proofs.',
  },
  {
    id: 'inappropriate',
    label: 'Inappropriate Content',
    description: 'Contains sexual, violent, or abusive content.',
  },
  {
    id: 'counterfeit',
    label: 'Counterfeit',
    description: 'Fake branded goods, forged docs, or misrepresented authenticity.',
  },
  {
    id: 'harassment',
    label: 'Harassment',
    description: 'Threats, intimidation, or abusive language.',
  },
  {
    id: 'underage',
    label: 'Underage',
    description: 'Appears to involve minors or age-restricted activity.',
  },
  {
    id: 'stolen_goods',
    label: 'Stolen Goods',
    description: 'Likely stolen property or suspicious ownership claims.',
  },
  {
    id: 'other',
    label: 'Other',
    description: 'Anything else that could put buyers or sellers at risk.',
  },
] as const satisfies ReadonlyArray<{
  id: ReportReasonChoice;
  label: string;
  description: string;
}>;

const MARKET_ACCOUNT = {
  displayName: 'Trey Seller',
  email: 'trey@mylife.local',
  phone: '+1 (323) 555-0148',
  memberSince: 'Joined January 2024',
  verificationTier: 'trusted' as VerificationLevel,
};

const MARKET_TIER_BENEFITS = [
  'Higher buyer confidence on listing detail pages',
  'Priority placement in service discovery',
  'Reduced friction for trade and checkout flows',
];

const INITIAL_PROVIDERS: ServiceProvider[] = [
  {
    id: 'provider-design',
    name: 'Nina Alvarez',
    title: 'Brand + web refreshes',
    category: 'Design',
    tagline: 'Launch pages, component audits, and product storytelling.',
    rate: 85,
    rateUnit: 'hr',
    distanceMiles: 30,
    distanceLabel: 'Remote / 30 mi',
    availability: 'available',
    rating: 4.9,
    reviewCount: 128,
    verificationTier: 'trusted',
    locationLabel: 'Remote, available across Los Angeles',
    responseTime: 'Usually replies in 1 hour',
    about: 'Tight visual systems, sharp copy polish, and fast handoff files for local creators.',
    portfolio: [
      { id: 'design-1', label: 'Launch page', tint: '#0F766E' },
      { id: 'design-2', label: 'Design audit', tint: '#115E59' },
      { id: 'design-3', label: 'Story system', tint: '#134E4A' },
    ],
  },
  {
    id: 'provider-repair',
    name: 'Marcus Chen',
    title: 'Appliance diagnostics',
    category: 'Repair',
    tagline: 'Fast home appliance troubleshooting with written fixes.',
    rate: 65,
    rateUnit: 'hr',
    distanceMiles: 12,
    distanceLabel: '12 mi',
    availability: 'busy',
    rating: 5.0,
    reviewCount: 215,
    verificationTier: 'top_seller',
    locationLabel: 'Pasadena and Northeast LA',
    responseTime: 'Usually replies in 35 minutes',
    about: 'On-site diagnostics, part sourcing, and clean repair notes you can keep for warranty claims.',
    portfolio: [
      { id: 'repair-1', label: 'Refrigerator fix', tint: '#334155' },
      { id: 'repair-2', label: 'Washer repair', tint: '#475569' },
      { id: 'repair-3', label: 'Dryer airflow', tint: '#1E293B' },
    ],
  },
  {
    id: 'provider-cleaning',
    name: 'Sarah Jenkins',
    title: 'Eco-friendly deep cleans',
    category: 'Cleaning',
    tagline: 'Move-out resets, kitchen rescues, and recurring upkeep.',
    rate: 140,
    rateUnit: 'flat',
    distanceMiles: 18,
    distanceLabel: '18 mi',
    availability: 'available',
    rating: 4.8,
    reviewCount: 94,
    verificationTier: 'verified',
    locationLabel: 'Westside and Culver City',
    responseTime: 'Usually replies in 2 hours',
    about: 'Green products, careful staging-friendly finishes, and before/after summaries for landlords.',
    portfolio: [
      { id: 'clean-1', label: 'Move-out reset', tint: '#166534' },
      { id: 'clean-2', label: 'Kitchen detail', tint: '#15803D' },
      { id: 'clean-3', label: 'Bathroom polish', tint: '#14532D' },
    ],
  },
  {
    id: 'provider-tutoring',
    name: 'Ari Patel',
    title: 'Math + study systems',
    category: 'Tutoring',
    tagline: 'Algebra, calculus, and exam planning for high school and college.',
    rate: 55,
    rateUnit: 'hr',
    distanceMiles: 8,
    distanceLabel: '8 mi',
    availability: 'away',
    rating: 4.7,
    reviewCount: 61,
    verificationTier: 'verified',
    locationLabel: 'Eagle Rock and virtual sessions',
    responseTime: 'Usually replies same day',
    about: 'Short-term exam prep, weekly coaching, and lightweight study templates.',
    portfolio: [
      { id: 'tutor-1', label: 'SAT prep', tint: '#312E81' },
      { id: 'tutor-2', label: 'Calc tutoring', tint: '#3730A3' },
      { id: 'tutor-3', label: 'Study plans', tint: '#4338CA' },
    ],
  },
];

const INITIAL_MY_SERVICES: MyServiceItem[] = [
  {
    id: 'my-service-1',
    title: 'Landing page cleanup',
    category: 'Design',
    rate: 400,
    rateUnit: 'flat',
    active: true,
    scheduleLabel: 'Open this week',
  },
  {
    id: 'my-service-2',
    title: 'Docs and IA review',
    category: 'Tech',
    rate: 90,
    rateUnit: 'hr',
    active: false,
    scheduleLabel: 'Paused while current project wraps',
  },
];

const INITIAL_SERVICE_REQUESTS: ServiceRequestItem[] = [
  {
    id: 'request-1',
    title: 'Need a bike tune-up before Saturday',
    category: 'Repair',
    budgetLabel: '$60 budget',
    status: 'matched',
    interestedCount: 3,
    updatedLabel: 'Updated 2h ago',
    detail: 'Looking for a commuter bike tune-up and brake check in Silver Lake.',
    providerId: 'provider-repair',
  },
  {
    id: 'request-2',
    title: 'Portfolio copy polish',
    category: 'Design',
    budgetLabel: '$250 budget',
    status: 'open',
    interestedCount: 5,
    updatedLabel: 'Updated yesterday',
    detail: 'Need copy + structure help for a freelance design portfolio refresh.',
    providerId: 'provider-design',
  },
];

const INITIAL_SETTINGS_STORE: MarketSettingsStore = {
  notifications: {
    newMessages: true,
    savedSearchMatches: true,
    watchlistPriceDrops: true,
    offerReceived: true,
    offerAccepted: true,
    orderUpdates: true,
    disputeUpdates: false,
  },
  privacy: {
    showOnlineStatus: true,
    showLastSeen: false,
    allowMessageRequests: true,
    hideProfileFromSearch: false,
  },
  paymentMethods: [
    {
      id: 'pm-visa',
      label: 'Visa ending in 4242',
      detail: 'Expires 08/28',
      brandTint: '#1D4ED8',
      isDefault: true,
    },
  ],
  shippingAddresses: [
    {
      id: 'addr-home',
      label: 'Home',
      detail: '2146 Bellevue Ave, Los Angeles, CA',
      isDefault: true,
    },
  ],
  blockedUsers: [
    {
      id: 'blocked-1',
      name: 'Seth Rowan',
      reason: 'Scam attempt in checkout chat',
      blockedAt: 'Blocked 3 days ago',
      tint: '#7C2D12',
    },
  ],
  payoutConnected: false,
  payoutLabel: 'Connect Stripe',
  reports: [],
  providers: INITIAL_PROVIDERS,
  myServices: INITIAL_MY_SERVICES,
  serviceRequests: INITIAL_SERVICE_REQUESTS,
};

const marketStore: MarketSettingsStore = {
  notifications: { ...INITIAL_SETTINGS_STORE.notifications },
  privacy: { ...INITIAL_SETTINGS_STORE.privacy },
  paymentMethods: [...INITIAL_SETTINGS_STORE.paymentMethods],
  shippingAddresses: [...INITIAL_SETTINGS_STORE.shippingAddresses],
  blockedUsers: [...INITIAL_SETTINGS_STORE.blockedUsers],
  payoutConnected: INITIAL_SETTINGS_STORE.payoutConnected,
  payoutLabel: INITIAL_SETTINGS_STORE.payoutLabel,
  reports: [...INITIAL_SETTINGS_STORE.reports],
  providers: [...INITIAL_SETTINGS_STORE.providers],
  myServices: [...INITIAL_SETTINGS_STORE.myServices],
  serviceRequests: [...INITIAL_SETTINGS_STORE.serviceRequests],
};

function toMarketDb(db: DatabaseAdapter): MarketDatabaseAdapter {
  return {
    run: (sql: string, params?: unknown[]) => db.execute(sql, params),
    get: <T,>(sql: string, params?: unknown[]) => db.query<T>(sql, params)[0],
    all: <T,>(sql: string, params?: unknown[]) => db.query<T>(sql, params),
  };
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
}

function formatServiceRate(value: number, unit: 'hr' | 'flat') {
  return unit === 'hr' ? `${formatCurrency(value)}/hr` : `${formatCurrency(value)} flat`;
}

function normalizeServicesTab(value?: string | string[]): ServicesTab {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'my-services' || raw === 'requests') {
    return raw;
  }
  return 'browse';
}

function getAvailabilityMeta(state: AvailabilityState) {
  switch (state) {
    case 'available':
      return { label: 'Available now', color: '#30D158' };
    case 'busy':
      return { label: 'Busy', color: '#F59E0B' };
    default:
      return { label: 'Away', color: MK_TEXT_TERTIARY };
  }
}

function getServiceCategoryIcon(category: ServiceCategory) {
  switch (category) {
    case 'Cleaning':
      return 'cleaning_services';
    case 'Repair':
      return 'build';
    case 'Tutoring':
      return 'school';
    case 'Design':
      return 'design_services';
    case 'Tech':
      return 'support_agent';
    case 'Beauty':
      return 'psychology';
    default:
      return 'support_agent';
  }
}

function getRequestStatusMeta(status: RequestStatus) {
  switch (status) {
    case 'matched':
      return { label: 'Matched', color: MK_ACCENT };
    case 'scheduled':
      return { label: 'Scheduled', color: '#30D158' };
    case 'closed':
      return { label: 'Closed', color: MK_TEXT_TERTIARY };
    default:
      return { label: 'Open', color: MK_ACCENT_LIGHT };
  }
}

function shouldDefaultBlock(reason: ReportReasonChoice) {
  return reason === 'scam' || reason === 'harassment';
}

function getBackendReason(reason: ReportReasonChoice) {
  switch (reason) {
    case 'spam':
      return 'spam';
    case 'scam':
      return 'fraud';
    case 'inappropriate':
    case 'harassment':
      return 'offensive';
    case 'counterfeit':
    case 'underage':
    case 'stolen_goods':
      return 'prohibited_item';
    default:
      return 'other';
  }
}

function buildFallbackListing(id?: string | null): Listing {
  const now = new Date().toISOString();
  return {
    id: id ?? 'market-subject',
    sellerId: 'seller-market',
    categoryId: 'mk-cat-services',
    title: 'Marketplace listing',
    description: 'Local marketplace listing pending moderation review.',
    priceCents: 12_500,
    currency: 'USD',
    pricingType: 'fixed',
    condition: 'good',
    listingType: 'sell',
    status: 'active',
    locationName: 'Los Angeles',
    latitude: null,
    longitude: null,
    fulfillmentType: 'pickup',
    serviceRadiusMiles: null,
    availabilityNotes: null,
    tradeFor: null,
    viewCount: 0,
    watchCount: 0,
    messageCount: 0,
    createdAt: now,
    updatedAt: now,
    expiresAt: null,
  };
}

function useStoreRevision() {
  const [revision, setRevision] = useState(0);
  const bump = useCallback(() => {
    setRevision((value) => value + 1);
  }, []);
  return { revision, bump };
}

function MarketScreenShell({
  title,
  eyebrow,
  heading,
  subtitle,
  children,
  footer,
  rightAction,
  refreshControl,
}: {
  title: string;
  eyebrow?: string;
  heading: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  rightAction?: ReactNode;
  refreshControl?: ReactElement;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 12,
            paddingBottom: (footer ? 120 : 36) + insets.bottom,
          },
        ]}
        refreshControl={refreshControl as never}
      >
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel={`Back from ${title}`}
          >
            <MaterialSymbol name="arrow_back" size={20} color={MK_ACCENT} />
          </Pressable>
          <Text style={styles.topBarTitle}>{title}</Text>
          <View style={styles.topBarActionWrap}>{rightAction}</View>
        </View>

        <View style={styles.hero}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={styles.heroHeading}>{heading}</Text>
          <Text style={styles.heroSubtitle}>{subtitle}</Text>
        </View>

        {children}
      </ScrollView>

      {footer ? (
        <View
          style={[
            styles.footerWrap,
            {
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}

function GradientButton({
  label,
  onPress,
  icon,
  disabled = false,
  tone = 'primary',
}: {
  label: string;
  onPress: () => void;
  icon?: string;
  disabled?: boolean;
  tone?: 'primary' | 'secondary' | 'danger';
}) {
  const gradientColors: readonly [string, string] =
    tone === 'secondary'
      ? [withAlpha(MK_ACCENT_LIGHT, 0.18), withAlpha(MK_ACCENT, 0.28)]
      : tone === 'danger'
        ? ['rgba(255, 69, 58, 0.3)', 'rgba(127, 29, 29, 0.5)']
        : [MK_ACCENT_LIGHT, MK_ACCENT];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.buttonFrame, disabled ? styles.buttonDisabled : null]}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.buttonGradient,
          tone === 'secondary' || tone === 'danger'
            ? styles.buttonGradientMuted
            : null,
        ]}
      >
        {icon ? (
          <MaterialSymbol
            name={icon}
            size={18}
            color={tone === 'primary' ? MK_ACCENT_DARK : MK_TEXT}
            filled={tone === 'primary'}
          />
        ) : null}
        <Text
          style={[
            styles.buttonLabel,
            tone === 'primary' ? styles.buttonLabelPrimary : null,
          ]}
        >
          {label}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

function FilterChip({
  label,
  active = false,
  icon,
  onPress,
}: {
  label: string;
  active?: boolean;
  icon?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.filterChip,
        active ? styles.filterChipActive : null,
      ]}
    >
      {icon ? (
        <MaterialSymbol
          name={icon}
          size={16}
          color={active ? MK_ACCENT_DARK : MK_TEXT_SECONDARY}
        />
      ) : null}
      <Text
        style={[
          styles.filterChipLabel,
          active ? styles.filterChipLabelActive : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SegmentedControl({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.segmentedControl}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[
              styles.segmentButton,
              selected ? styles.segmentButtonActive : null,
            ]}
          >
            <Text
              style={[
                styles.segmentLabel,
                selected ? styles.segmentLabelActive : null,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function PaletteTile({
  asset,
}: {
  asset: ServicePortfolioAsset;
}) {
  return (
    <View style={[styles.portfolioTile, { backgroundColor: asset.tint }]}>
      <Text style={styles.portfolioTileText}>{asset.label}</Text>
    </View>
  );
}

function ProviderCard({
  provider,
  onPress,
}: {
  provider: ServiceProvider;
  onPress: () => void;
}) {
  const availability = getAvailabilityMeta(provider.availability);

  return (
    <GlassCard onPress={onPress} style={styles.providerCard} elevated>
      <View style={styles.providerHeader}>
        <View style={styles.providerIdentity}>
          <View style={styles.avatarFrame}>
            <Text style={styles.avatarInitials}>
              {provider.name
                .split(' ')
                .map((part) => part[0])
                .slice(0, 2)
                .join('')}
            </Text>
            <View
              style={[
                styles.availabilityDot,
                { backgroundColor: availability.color },
              ]}
            />
          </View>

          <View style={styles.providerTextWrap}>
            <View style={styles.providerNameRow}>
              <Text style={styles.providerName}>{provider.name}</Text>
              <VerificationBadge tier={provider.verificationTier} showLabel={false} />
            </View>
            <Text style={styles.providerTitle}>{provider.title}</Text>
            <Text style={styles.providerTagline}>{provider.tagline}</Text>
          </View>
        </View>

        <View style={styles.providerRateWrap}>
          <PriceBadge price={provider.rate} size="sm" />
          <Text style={styles.providerRateMeta}>
            {provider.rateUnit === 'hr' ? '/hr' : 'flat'}
          </Text>
          <View style={styles.ratingRow}>
            <MaterialSymbol name="star" size={14} color="#FFB877" filled />
            <Text style={styles.ratingText}>
              {provider.rating.toFixed(1)} ({provider.reviewCount})
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.providerChipRow}>
        <View
          style={[
            styles.providerBadge,
            { backgroundColor: withAlpha(MK_ACCENT, 0.16) },
          ]}
        >
          <MaterialSymbol
            name={getServiceCategoryIcon(provider.category)}
            size={14}
            color={MK_ACCENT}
          />
          <Text style={styles.providerBadgeText}>{provider.category}</Text>
        </View>

        <View
          style={[
            styles.providerBadge,
            { backgroundColor: withAlpha(availability.color, 0.18) },
          ]}
        >
          <Text style={[styles.providerBadgeText, { color: availability.color }]}>
            {availability.label}
          </Text>
        </View>

        <Text style={styles.providerDistance}>{provider.distanceLabel}</Text>
      </View>

      <View style={styles.portfolioRow}>
        {provider.portfolio.map((asset) => (
          <PaletteTile key={asset.id} asset={asset} />
        ))}
      </View>
    </GlassCard>
  );
}

function SettingToggleRow({
  label,
  detail,
  value,
  onValueChange,
}: {
  label: string;
  detail: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingTextWrap}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingDetail}>{detail}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: MK_SURFACES.high, true: withAlpha(MK_ACCENT, 0.42) }}
        thumbColor={value ? MK_ACCENT_LIGHT : '#E5E7EB'}
      />
    </View>
  );
}

function SectionShell({
  icon,
  label,
  children,
  danger = false,
}: {
  icon: string;
  label: string;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <View style={styles.sectionWrap}>
      <View style={styles.sectionLabelRow}>
        <MaterialSymbol
          name={icon}
          size={18}
          color={danger ? '#FF453A' : MK_ACCENT}
        />
        <Text
          style={[
            styles.sectionLabel,
            danger ? styles.sectionLabelDanger : null,
          ]}
        >
          {label}
        </Text>
      </View>
      <GlassCard style={danger ? styles.dangerGlassCard : null}>{children}</GlassCard>
    </View>
  );
}

function ServiceEmptyState({
  icon,
  title,
  detail,
  actionLabel,
  onPress,
}: {
  icon: string;
  title: string;
  detail: string;
  actionLabel: string;
  onPress: () => void;
}) {
  return (
    <GlassCard style={styles.emptyStateCard}>
      <View style={styles.emptyStateIcon}>
        <MaterialSymbol name={icon} size={24} color={MK_ACCENT} />
      </View>
      <Text style={styles.emptyStateTitle}>{title}</Text>
      <Text style={styles.emptyStateDetail}>{detail}</Text>
      <GradientButton label={actionLabel} onPress={onPress} tone="secondary" />
    </GlassCard>
  );
}

export function MarketServicesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { revision, bump } = useStoreRevision();
  const [tab, setTab] = useState<ServicesTab>(normalizeServicesTab(params.tab));
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<(typeof SERVICE_CATEGORIES)[number]>('All');
  const [distanceMiles, setDistanceMiles] = useState(25);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const providers = useMemo(() => {
    return marketStore.providers.filter((provider) => {
      const queryNeedle = query.trim().toLowerCase();
      const matchesQuery =
        queryNeedle.length === 0 ||
        `${provider.name} ${provider.title} ${provider.tagline} ${provider.category}`
          .toLowerCase()
          .includes(queryNeedle);
      const matchesCategory = category === 'All' || provider.category === category;
      const matchesDistance = provider.distanceMiles <= distanceMiles;
      const matchesAvailability = !availableOnly || provider.availability === 'available';
      return matchesQuery && matchesCategory && matchesDistance && matchesAvailability;
    });
  }, [availableOnly, category, distanceMiles, query, revision]);

  const myServices = useMemo(() => [...marketStore.myServices], [revision]);
  const requests = useMemo(() => [...marketStore.serviceRequests], [revision]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 250));
    bump();
    setRefreshing(false);
  }, [bump]);

  const footer = (
    <GradientButton
      label="Offer a Service"
      icon="add"
      onPress={() => router.push('/(market)/create-service-listing')}
    />
  );

  return (
    <MarketScreenShell
      title="Services"
      eyebrow="MARKETPLACE"
      heading="Services"
      subtitle="Hire local providers, offer your skills, and keep requests moving without leaving the market flow."
      rightAction={
        <Pressable
          onPress={() => router.push('/(market)/create-service-listing')}
          style={styles.iconButton}
        >
          <MaterialSymbol name="add" size={20} color={MK_ACCENT} />
        </Pressable>
      }
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={MK_ACCENT} />
      }
      footer={footer}
    >
      <SegmentedControl
        value={tab}
        onChange={(value) => setTab(value as ServicesTab)}
        options={[
          { value: 'browse', label: 'Browse' },
          { value: 'my-services', label: 'My Services' },
          { value: 'requests', label: 'Requests' },
        ]}
      />

      {tab === 'browse' ? (
        <View style={styles.stack}>
          <GlassCard>
            <View style={styles.searchWrap}>
              <MaterialSymbol name="search" size={18} color={MK_TEXT_TERTIARY} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search providers or service categories"
                placeholderTextColor={MK_TEXT_TERTIARY}
                style={styles.searchInput}
              />
            </View>
          </GlassCard>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.inlineScroller}>
            <FilterChip
              label={`${distanceMiles} mi`}
              icon="tune"
              active
              onPress={() => setDistanceMiles((value) => (value === 10 ? 25 : value === 25 ? 50 : 10))}
            />
            <FilterChip
              label="Available now"
              active={availableOnly}
              onPress={() => setAvailableOnly((value) => !value)}
            />
            {SERVICE_CATEGORIES.map((item) => (
              <FilterChip
                key={item}
                label={item === 'All' ? 'All Services' : item}
                active={category === item}
                icon={item === 'All' ? 'support_agent' : getServiceCategoryIcon(item)}
                onPress={() => setCategory(item)}
              />
            ))}
          </ScrollView>

          {providers.length > 0 ? (
            providers.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                onPress={() => router.push(`/(market)/service-detail?id=${encodeURIComponent(provider.id)}`)}
              />
            ))
          ) : (
            <ServiceEmptyState
              icon="support_agent"
              title="No providers match these filters"
              detail="Broaden your distance, switch categories, or post a request so providers can come to you."
              actionLabel="Post a Request"
              onPress={() => router.push('/(market)/create-service-listing?mode=request')}
            />
          )}
        </View>
      ) : null}

      {tab === 'my-services' ? (
        <View style={styles.stack}>
          <GlassCard>
            <SectionHeader
              title="My services"
              action={{
                label: 'Add Service',
                onPress: () => router.push('/(market)/create-service-listing'),
              }}
            />
            <Text style={styles.helperCopy}>
              Manage your offer cards, pause intake, and update pricing without leaving the market module.
            </Text>
          </GlassCard>

          {myServices.length > 0 ? (
            myServices.map((service) => (
              <GlassCard key={service.id}>
                <View style={styles.settingRow}>
                  <View style={styles.settingTextWrap}>
                    <Text style={styles.settingLabel}>{service.title}</Text>
                    <Text style={styles.settingDetail}>
                      {service.category} · {formatServiceRate(service.rate, service.rateUnit)}
                    </Text>
                    <Text style={styles.mutedText}>{service.scheduleLabel}</Text>
                  </View>
                  <Switch
                    value={service.active}
                    onValueChange={(value) => {
                      const target = marketStore.myServices.find((item) => item.id === service.id);
                      if (target) {
                        target.active = value;
                        bump();
                      }
                    }}
                    trackColor={{ false: MK_SURFACES.high, true: withAlpha(MK_ACCENT, 0.42) }}
                    thumbColor={service.active ? MK_ACCENT_LIGHT : '#E5E7EB'}
                  />
                </View>

                <View style={styles.inlineActionRow}>
                  <GradientButton
                    label="Edit"
                    icon="edit"
                    tone="secondary"
                    onPress={() => router.push(`/(market)/create-service-listing?draft=${encodeURIComponent(service.id)}`)}
                  />
                </View>
              </GlassCard>
            ))
          ) : (
            <ServiceEmptyState
              icon="build"
              title="No active service listings yet"
              detail="Create an offer to show your rates, availability, and response time in the services directory."
              actionLabel="Create service"
              onPress={() => router.push('/(market)/create-service-listing')}
            />
          )}
        </View>
      ) : null}

      {tab === 'requests' ? (
        <View style={styles.stack}>
          <GlassCard>
            <SectionHeader
              title="Requests"
              action={{
                label: 'New Request',
                onPress: () => router.push('/(market)/create-service-listing?mode=request'),
              }}
            />
            <Text style={styles.helperCopy}>
              Buyers can keep service needs visible here while comparing providers and response speed.
            </Text>
          </GlassCard>

          {requests.length > 0 ? (
            requests.map((request) => {
              const status = getRequestStatusMeta(request.status);
              return (
                <GlassCard key={request.id}>
                  <View style={styles.settingRow}>
                    <View style={styles.settingTextWrap}>
                      <Text style={styles.settingLabel}>{request.title}</Text>
                      <Text style={styles.settingDetail}>
                        {request.category} · {request.budgetLabel}
                      </Text>
                      <Text style={styles.mutedText}>{request.detail}</Text>
                    </View>

                    <View
                      style={[
                        styles.statusPill,
                        { backgroundColor: withAlpha(status.color, 0.18) },
                      ]}
                    >
                      <Text style={[styles.statusPillText, { color: status.color }]}>
                        {status.label}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.requestMetaRow}>
                    <Text style={styles.requestMetaText}>
                      {request.interestedCount} provider{request.interestedCount === 1 ? '' : 's'} interested
                    </Text>
                    <Text style={styles.requestMetaText}>{request.updatedLabel}</Text>
                  </View>
                </GlassCard>
              );
            })
          ) : (
            <ServiceEmptyState
              icon="support_agent"
              title="No requests posted"
              detail="Describe the help you need and let trusted providers reply with rates and timing."
              actionLabel="Create request"
              onPress={() => router.push('/(market)/create-service-listing?mode=request')}
            />
          )}
        </View>
      ) : null}
    </MarketScreenShell>
  );
}

export function MarketServiceDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const provider =
    marketStore.providers.find((item) => item.id === params.id) ?? marketStore.providers[0];
  const availability = getAvailabilityMeta(provider.availability);

  return (
    <MarketScreenShell
      title="Provider"
      eyebrow="SERVICES"
      heading={provider.name}
      subtitle={provider.title}
      rightAction={
        <Pressable
          onPress={() => router.push(`/(market)/report?type=user&id=${encodeURIComponent(provider.id)}`)}
          style={styles.iconButton}
        >
          <MaterialSymbol name="flag" size={18} color={MK_ACCENT} />
        </Pressable>
      }
      footer={
        <View style={styles.footerRow}>
          <GradientButton
            label="Message"
            icon="message"
            tone="secondary"
            onPress={() => router.push('/(market)/messages')}
          />
          <GradientButton
            label="Request Service"
            icon="support_agent"
            onPress={() =>
              router.push(
                `/(market)/create-service-listing?mode=request&providerId=${encodeURIComponent(provider.id)}`,
              )
            }
          />
        </View>
      }
    >
      <GlassCard style={styles.providerDetailHero} elevated>
        <View style={styles.providerDetailTop}>
          <View style={styles.providerDetailAvatar}>
            <Text style={styles.providerDetailInitials}>
              {provider.name
                .split(' ')
                .map((part) => part[0])
                .slice(0, 2)
                .join('')}
            </Text>
          </View>
          <View style={styles.stack}>
            <View style={styles.providerNameRow}>
              <Text style={styles.providerName}>{provider.name}</Text>
              <VerificationBadge tier={provider.verificationTier} />
            </View>
            <Text style={styles.providerTitle}>{provider.title}</Text>
            <Text style={styles.providerTagline}>{provider.locationLabel}</Text>
          </View>
        </View>

        <View style={styles.providerChipRow}>
          <View
            style={[
              styles.providerBadge,
              { backgroundColor: withAlpha(availability.color, 0.18) },
            ]}
          >
            <Text style={[styles.providerBadgeText, { color: availability.color }]}>
              {availability.label}
            </Text>
          </View>
          <View style={styles.providerBadge}>
            <Text style={styles.providerBadgeText}>{provider.responseTime}</Text>
          </View>
        </View>
      </GlassCard>

      <SectionShell icon={getServiceCategoryIcon(provider.category)} label="Overview">
        <Text style={styles.settingLabel}>{provider.category}</Text>
        <Text style={styles.settingDetail}>{provider.about}</Text>
        <View style={styles.detailRateRow}>
          <PriceBadge price={provider.rate} size="lg" />
          <Text style={styles.providerRateMeta}>
            {provider.rateUnit === 'hr' ? '/hr' : 'flat'}
          </Text>
        </View>
      </SectionShell>

      <SectionShell icon="star" label="Proof of work">
        <Text style={styles.helperCopy}>
          Recent outcomes and portfolio references surfaced from the service listing.
        </Text>
        <View style={styles.portfolioRow}>
          {provider.portfolio.map((asset) => (
            <PaletteTile key={asset.id} asset={asset} />
          ))}
        </View>
      </SectionShell>
    </MarketScreenShell>
  );
}

export function MarketCreateServiceListingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    mode?: string;
    providerId?: string;
    draft?: string;
  }>();
  const hubDb = useDatabase();
  const db = useMemo(() => toMarketDb(hubDb), [hubDb]);
  const { bump } = useStoreRevision();
  const draft = marketStore.myServices.find((item) => item.id === params.draft);
  const requestedProvider = marketStore.providers.find((item) => item.id === params.providerId);
  const initialMode = params.mode === 'request' ? 'service_request' : 'service_offer';
  const [listingType, setListingType] = useState<'service_offer' | 'service_request'>(
    draft ? 'service_offer' : initialMode,
  );
  const [title, setTitle] = useState(
    draft?.title ?? (requestedProvider ? `Need ${requestedProvider.title.toLowerCase()}` : ''),
  );
  const [category, setCategory] = useState<ServiceCategory>(draft?.category ?? requestedProvider?.category ?? 'Design');
  const [rate, setRate] = useState(draft ? String(draft.rate) : '');
  const [rateUnit, setRateUnit] = useState<'hr' | 'flat'>(draft?.rateUnit ?? 'hr');
  const [details, setDetails] = useState(
    requestedProvider
      ? `Looking for ${requestedProvider.name} or a similar provider to help with ${requestedProvider.category.toLowerCase()} work.`
      : '',
  );
  const [availability, setAvailability] = useState('Weeknights or Saturday morning');

  const saveService = useCallback(() => {
    if (!title.trim() || details.trim().length < 20) {
      Alert.alert('Incomplete service', 'Add a title and at least 20 characters of detail.');
      return;
    }

    const now = new Date().toISOString();
    const listingId = draft?.id ?? makeId('mk-service');

    try {
      upsertCachedListing(db, {
        id: listingId,
        sellerId: LOCAL_USER,
        categoryId: 'mk-cat-services',
        title: title.trim(),
        description: details.trim(),
        priceCents: rate.trim() ? Math.round(Number(rate) * 100) : null,
        currency: 'USD',
        pricingType: 'fixed',
        condition: null,
        listingType,
        status: 'active',
        locationName: requestedProvider?.locationLabel ?? 'Local / remote',
        latitude: null,
        longitude: null,
        fulfillmentType: listingType === 'service_request' ? 'remote' : 'onsite',
        serviceRadiusMiles: 25,
        availabilityNotes: availability.trim() || null,
        tradeFor: null,
        viewCount: 0,
        watchCount: 0,
        messageCount: 0,
        createdAt: now,
        updatedAt: now,
        expiresAt: null,
      });

      if (listingType === 'service_offer') {
        if (draft) {
          draft.title = title.trim();
          draft.category = category;
          draft.rate = Number(rate || 0);
          draft.rateUnit = rateUnit;
          draft.scheduleLabel = availability.trim() || draft.scheduleLabel;
        } else {
          marketStore.myServices.unshift({
            id: listingId,
            title: title.trim(),
            category,
            rate: Number(rate || 0),
            rateUnit,
            active: true,
            scheduleLabel: availability.trim() || 'Open this week',
          });
          marketStore.providers.unshift({
            id: `provider-${listingId}`,
            name: MARKET_ACCOUNT.displayName,
            title: title.trim(),
            category,
            tagline: details.trim(),
            rate: Number(rate || 0),
            rateUnit,
            distanceMiles: 15,
            distanceLabel: '15 mi',
            availability: 'available',
            rating: 5,
            reviewCount: 0,
            verificationTier: MARKET_ACCOUNT.verificationTier,
            locationLabel: 'Your local radius',
            responseTime: 'Usually replies within a few hours',
            about: details.trim(),
            portfolio: [
              { id: `${listingId}-1`, label: 'New offer', tint: '#115E59' },
              { id: `${listingId}-2`, label: category, tint: '#0F766E' },
              { id: `${listingId}-3`, label: 'Availability', tint: '#134E4A' },
            ],
          });
        }
      } else {
        marketStore.serviceRequests.unshift({
          id: listingId,
          title: title.trim(),
          category,
          budgetLabel: rate.trim() ? `${formatCurrency(Number(rate))} budget` : 'Flexible budget',
          status: 'open',
          interestedCount: requestedProvider ? 1 : 0,
          updatedLabel: 'Updated just now',
          detail: details.trim(),
          providerId: requestedProvider?.id,
        });
      }

      bump();
      router.replace(
        listingType === 'service_offer'
          ? '/(market)/services?tab=my-services'
          : '/(market)/services?tab=requests',
      );
    } catch (error) {
      Alert.alert(
        'Unable to save service',
        error instanceof Error ? error.message : 'Try again in a moment.',
      );
    }
  }, [
    availability,
    bump,
    category,
    db,
    details,
    draft,
    listingType,
    rate,
    rateUnit,
    requestedProvider,
    router,
    title,
  ]);

  return (
    <MarketScreenShell
      title={draft ? 'Edit Service' : 'Offer a Service'}
      eyebrow="SERVICES"
      heading={draft ? 'Update your offer' : listingType === 'service_offer' ? 'Create a service offer' : 'Request a service'}
      subtitle="Use the same market infrastructure for expert offers and buyer-side requests."
      footer={<GradientButton label={draft ? 'Save changes' : 'Publish'} icon="check_circle" onPress={saveService} />}
    >
      <GlassCard>
        <SectionHeader title="Listing type" />
        <View style={styles.typePillRow}>
          <ListingTypePill
            type="service_offer"
            selected={listingType === 'service_offer'}
            onPress={() => setListingType('service_offer')}
          />
          <ListingTypePill
            type="service_request"
            selected={listingType === 'service_request'}
            onPress={() => setListingType('service_request')}
          />
        </View>
      </GlassCard>

      <GlassCard>
        <SectionHeader title="Details" />
        <View style={styles.formStack}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Service title"
            placeholderTextColor={MK_TEXT_TERTIARY}
            style={styles.input}
          />
          <TextInput
            value={details}
            onChangeText={setDetails}
            placeholder="Describe the scope, expectations, and what success looks like"
            placeholderTextColor={MK_TEXT_TERTIARY}
            style={[styles.input, styles.largeInput]}
            multiline
          />
          <TextInput
            value={availability}
            onChangeText={setAvailability}
            placeholder="Availability or timing"
            placeholderTextColor={MK_TEXT_TERTIARY}
            style={styles.input}
          />
        </View>
      </GlassCard>

      <GlassCard>
        <SectionHeader title="Category and pricing" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.inlineScroller}>
          {SERVICE_CATEGORIES.filter((item) => item !== 'All').map((item) => (
            <FilterChip
              key={item}
              label={item}
              icon={getServiceCategoryIcon(item)}
              active={category === item}
              onPress={() => setCategory(item)}
            />
          ))}
        </ScrollView>

        <View style={styles.formRow}>
          <TextInput
            value={rate}
            onChangeText={setRate}
            placeholder={listingType === 'service_request' ? 'Budget' : 'Rate'}
            placeholderTextColor={MK_TEXT_TERTIARY}
            keyboardType="numeric"
            style={[styles.input, styles.halfInput]}
          />
          <View style={[styles.input, styles.halfInput, styles.inlineChoiceWrap]}>
            <Pressable
              onPress={() => setRateUnit('hr')}
              style={[
                styles.inlineChoice,
                rateUnit === 'hr' ? styles.inlineChoiceActive : null,
              ]}
            >
              <Text
                style={[
                  styles.inlineChoiceLabel,
                  rateUnit === 'hr' ? styles.inlineChoiceLabelActive : null,
                ]}
              >
                Hourly
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setRateUnit('flat')}
              style={[
                styles.inlineChoice,
                rateUnit === 'flat' ? styles.inlineChoiceActive : null,
              ]}
            >
              <Text
                style={[
                  styles.inlineChoiceLabel,
                  rateUnit === 'flat' ? styles.inlineChoiceLabelActive : null,
                ]}
              >
                Flat
              </Text>
            </Pressable>
          </View>
        </View>
      </GlassCard>
    </MarketScreenShell>
  );
}

export function MarketReportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    type?: string;
    id?: string;
  }>();
  const hubDb = useDatabase();
  const db = useMemo(() => toMarketDb(hubDb), [hubDb]);
  const { bump } = useStoreRevision();
  const targetType = (params.type as ReportTargetType | undefined) ?? 'listing';
  const listing = getCachedListingById(db, params.id ?? '') ?? buildFallbackListing(params.id ?? null);
  const subjectProvider = marketStore.providers.find((item) => item.id === params.id);
  const [reason, setReason] = useState<ReportReasonChoice>('scam');
  const [details, setDetails] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [blockAfterSubmit, setBlockAfterSubmit] = useState(shouldDefaultBlock('scam'));
  const [evidenceUris, setEvidenceUris] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState<ReportRecord | null>(null);

  const subject = useMemo(() => {
    if (targetType === 'user') {
      return {
        eyebrow: 'Reporting user',
        title: subjectProvider?.name ?? 'Marketplace user',
        subtitle: subjectProvider?.title ?? 'Seller or provider profile',
        targetUserId: subjectProvider?.id ?? params.id ?? null,
      };
    }
    if (targetType === 'message') {
      return {
        eyebrow: 'Reporting message',
        title: 'Encrypted chat snippet',
        subtitle: 'Suspicious message captured from a marketplace conversation',
        targetUserId: subjectProvider?.id ?? listing.sellerId,
      };
    }
    return {
      eyebrow: 'Reporting listing',
      title: listing.title,
      subtitle: `${listing.locationName ?? 'Marketplace'} · posted by ${listing.sellerId}`,
      targetUserId: listing.sellerId,
    };
  }, [listing.locationName, listing.sellerId, listing.title, params.id, subjectProvider, targetType]);

  const minimumCharsRemaining = Math.max(0, 20 - details.trim().length);

  const handlePickEvidence = useCallback(async () => {
    if (evidenceUris.length >= 4) {
      Alert.alert('Evidence limit', 'You can attach up to 4 screenshots for this report.');
      return;
    }

    try {
      const ImagePicker = await import('expo-image-picker');
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permission.status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo access to attach screenshots or receipts.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        setEvidenceUris((current) => [...current, result.assets[0].uri]);
      }
    } catch (error) {
      Alert.alert(
        'Unable to add evidence',
        error instanceof Error ? error.message : 'Try again in a moment.',
      );
    }
  }, [evidenceUris.length]);

  const handleSubmit = useCallback(() => {
    if (details.trim().length < 20) {
      Alert.alert('Add more detail', 'Please include at least 20 characters so moderators have enough context.');
      return;
    }

    try {
      const nextRecord: ReportRecord = {
        id: makeId('report'),
        type: targetType,
        targetId: params.id ?? null,
        targetUserId: subject.targetUserId ?? null,
        reason,
        details: details.trim(),
        anonymous,
        evidenceUris,
        createdAt: new Date().toISOString(),
      };

      marketStore.reports.unshift(nextRecord);
      bump();
      setSubmitted(nextRecord);
    } catch (error) {
      Alert.alert(
        'Unable to submit report',
        error instanceof Error ? error.message : 'Try again in a moment.',
      );
    }
  }, [anonymous, bump, details, evidenceUris, params.id, reason, subject.targetUserId, targetType]);

  const finalizeReport = useCallback(() => {
    try {
      if (blockAfterSubmit && subject.targetUserId) {
        const exists = marketStore.blockedUsers.some((item) => item.id === subject.targetUserId);
        if (!exists) {
          marketStore.blockedUsers.unshift({
            id: subject.targetUserId,
            name: subject.title,
            reason: REPORT_REASON_OPTIONS.find((item) => item.id === reason)?.label ?? 'Reported user',
            blockedAt: 'Blocked just now',
            tint: '#7C2D12',
          });
        }
      }

      bump();
      router.back();
    } catch (error) {
      Alert.alert(
        'Unable to finish report',
        error instanceof Error ? error.message : 'Try again in a moment.',
      );
    }
  }, [blockAfterSubmit, bump, reason, router, subject.targetUserId, subject.title]);

  return (
    <MarketScreenShell
      title="Report"
      eyebrow="SAFETY"
      heading="Report Issue"
      subtitle="Help us keep MyMarket safe with clear reasons, evidence, and enough detail for fast review."
      rightAction={
        <Pressable onPress={() => router.back()} style={styles.iconButton}>
          <MaterialSymbol name="close" size={18} color={MK_ACCENT} />
        </Pressable>
      }
      footer={
        submitted ? (
          <GradientButton
            label={blockAfterSubmit ? 'Save and block' : 'Done'}
            icon={blockAfterSubmit ? 'block' : 'check_circle'}
            onPress={finalizeReport}
          />
        ) : (
          <GradientButton
            label="Submit report"
            icon="flag"
            onPress={handleSubmit}
            disabled={details.trim().length < 20}
          />
        )
      }
    >
      <GlassCard style={styles.subjectCard}>
        <View style={styles.subjectThumb}>
          <Text style={styles.subjectThumbText}>
            {subject.title
              .split(' ')
              .map((part) => part[0])
              .slice(0, 2)
              .join('')}
          </Text>
        </View>
        <View style={styles.subjectTextWrap}>
          <Text style={styles.eyebrow}>{subject.eyebrow}</Text>
          <Text style={styles.settingLabel}>{subject.title}</Text>
          <Text style={styles.settingDetail}>{subject.subtitle}</Text>
        </View>
      </GlassCard>

      {submitted ? (
        <GlassCard style={styles.stack} elevated>
          <View style={styles.confirmationIcon}>
            <MaterialSymbol name="check_circle" size={26} color={MK_ACCENT} />
          </View>
          <Text style={styles.emptyStateTitle}>Thank you. Our team will review this within 24 hours.</Text>
          <Text style={styles.emptyStateDetail}>
            Stored reason: {REPORT_REASON_OPTIONS.find((item) => item.id === submitted.reason)?.label ?? getBackendReason(submitted.reason)}.
          </Text>
          {subject.targetUserId ? (
            <View style={styles.confirmationToggleRow}>
              <View style={styles.settingTextWrap}>
                <Text style={styles.settingLabel}>Also block this user</Text>
                <Text style={styles.settingDetail}>
                  They will no longer appear in search, listings, or message requests.
                </Text>
              </View>
              <Switch
                value={blockAfterSubmit}
                onValueChange={setBlockAfterSubmit}
                trackColor={{ false: MK_SURFACES.high, true: withAlpha(MK_ACCENT, 0.42) }}
                thumbColor={blockAfterSubmit ? MK_ACCENT_LIGHT : '#E5E7EB'}
              />
            </View>
          ) : null}
        </GlassCard>
      ) : (
        <>
          <SectionShell icon="flag" label="Reason">
            <View style={styles.reasonList}>
              {REPORT_REASON_OPTIONS.map((option) => {
                const selected = reason === option.id;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => {
                      setReason(option.id);
                      setBlockAfterSubmit(shouldDefaultBlock(option.id));
                    }}
                    style={[
                      styles.reasonRow,
                      selected ? styles.reasonRowSelected : null,
                    ]}
                  >
                    <View style={styles.reasonTextWrap}>
                      <Text style={[styles.settingLabel, selected ? styles.reasonLabelSelected : null]}>
                        {option.label}
                      </Text>
                      <Text style={styles.settingDetail}>{option.description}</Text>
                    </View>
                    <View style={[styles.radioOuter, selected ? styles.radioOuterSelected : null]}>
                      {selected ? <View style={styles.radioInner} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </SectionShell>

          <SectionShell icon="message" label="What happened?">
            <TextInput
              value={details}
              onChangeText={setDetails}
              placeholder="Explain what happened, what looked risky, and any steps already taken."
              placeholderTextColor={MK_TEXT_TERTIARY}
              style={[styles.input, styles.reportInput]}
              multiline
            />
            <Text style={styles.mutedText}>
              {minimumCharsRemaining > 0
                ? `${minimumCharsRemaining} more characters needed`
                : `${details.trim().length} characters`}
            </Text>
          </SectionShell>

          <SectionShell icon="photo_camera" label="Evidence (Optional)">
            <View style={styles.evidenceGrid}>
              {Array.from({ length: 4 }).map((_, index) => {
                const uri = evidenceUris[index];
                return (
                  <Pressable
                    key={`evidence-slot-${index}`}
                    onPress={() => void handlePickEvidence()}
                    style={styles.evidenceSlot}
                  >
                    {uri ? (
                      <Image source={{ uri }} style={styles.evidenceImage} />
                    ) : (
                      <>
                        <MaterialSymbol name="photo_camera" size={20} color={MK_TEXT_TERTIARY} />
                        <Text style={styles.mutedText}>Add</Text>
                      </>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </SectionShell>

          <SectionShell icon="lock" label="Privacy">
            <View style={styles.confirmationToggleRow}>
              <View style={styles.settingTextWrap}>
                <Text style={styles.settingLabel}>Submit anonymously</Text>
                <Text style={styles.settingDetail}>
                  Your identity stays hidden from the reported party, but moderators can still review it.
                </Text>
              </View>
              <Switch
                value={anonymous}
                onValueChange={setAnonymous}
                trackColor={{ false: MK_SURFACES.high, true: withAlpha(MK_ACCENT, 0.42) }}
                thumbColor={anonymous ? MK_ACCENT_LIGHT : '#E5E7EB'}
              />
            </View>
          </SectionShell>
        </>
      )}
    </MarketScreenShell>
  );
}

export function MarketSettingsScreen() {
  const router = useRouter();
  const { revision, bump } = useStoreRevision();

  const paymentMethods = useMemo(() => [...marketStore.paymentMethods], [revision]);
  const addresses = useMemo(() => [...marketStore.shippingAddresses], [revision]);
  const blockedUsers = useMemo(() => [...marketStore.blockedUsers], [revision]);

  const addPaymentMethod = useCallback(() => {
    try {
      marketStore.paymentMethods.push({
        id: makeId('pm'),
        label: 'Mastercard ending in 8181',
        detail: 'Expires 03/29',
        brandTint: '#7C3AED',
        isDefault: marketStore.paymentMethods.length === 0,
      });
      bump();
    } catch (error) {
      Alert.alert('Unable to add payment method', error instanceof Error ? error.message : 'Try again in a moment.');
    }
  }, [bump]);

  const addShippingAddress = useCallback(() => {
    try {
      marketStore.shippingAddresses.push({
        id: makeId('addr'),
        label: 'Studio',
        detail: '1441 Sunset Blvd, Los Angeles, CA',
        isDefault: false,
      });
      bump();
    } catch (error) {
      Alert.alert('Unable to add address', error instanceof Error ? error.message : 'Try again in a moment.');
    }
  }, [bump]);

  const clearLocalCache = useCallback(() => {
    Alert.alert('Clear local cache', 'This UIUX pass keeps shared market data safe. Cache clearing remains confirm-only here.');
  }, []);

  const deleteAccount = useCallback(() => {
    Alert.alert('Delete account', 'Account deletion is intentionally confirm-only in this UI surface.');
  }, []);

  return (
    <MarketScreenShell
      title="Settings"
      eyebrow="MARKETPLACE"
      heading="Settings"
      subtitle="Account, notifications, payment methods, privacy, and safety controls grouped into fast-scanning glass sections."
      rightAction={
        <View style={styles.profileMiniBadge}>
          <Text style={styles.profileMiniBadgeText}>TS</Text>
        </View>
      }
    >
      <SectionShell icon="account_circle" label="Account">
        <View style={styles.stack}>
          <View style={styles.settingRow}>
            <View style={styles.settingTextWrap}>
              <Text style={styles.settingLabel}>{MARKET_ACCOUNT.displayName}</Text>
              <Text style={styles.settingDetail}>Display name</Text>
            </View>
            <Text style={styles.linkText}>Edit</Text>
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingTextWrap}>
              <Text style={styles.settingLabel}>{MARKET_ACCOUNT.email}</Text>
              <Text style={styles.settingDetail}>Email</Text>
            </View>
            <Text style={styles.successText}>Verified</Text>
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingTextWrap}>
              <Text style={styles.settingLabel}>{MARKET_ACCOUNT.phone}</Text>
              <Text style={styles.settingDetail}>Phone</Text>
            </View>
            <Text style={styles.successText}>Verified</Text>
          </View>

          <Text style={styles.mutedText}>{MARKET_ACCOUNT.memberSince}</Text>
        </View>
      </SectionShell>

      <SectionShell icon="verified" label="Verification">
        <View style={styles.stack}>
          <VerificationBadge tier={MARKET_ACCOUNT.verificationTier} />
          <Text style={styles.settingDetail}>
            Current tier: trusted marketplace member with better service discovery placement and higher buyer confidence.
          </Text>
          {MARKET_TIER_BENEFITS.map((item) => (
            <View key={item} style={styles.bulletRow}>
              <View style={styles.bulletDot} />
              <Text style={styles.settingDetail}>{item}</Text>
            </View>
          ))}
          <GradientButton
            label="Upgrade verification"
            icon="verified"
            onPress={() => router.push('/(market)/verification')}
          />
        </View>
      </SectionShell>

      <SectionShell icon="notifications" label="Notifications">
        <View style={styles.stack}>
          <SettingToggleRow
            label="New messages"
            detail="Instant alerts when buyers or sellers reach out."
            value={marketStore.notifications.newMessages}
            onValueChange={(value) => {
              marketStore.notifications.newMessages = value;
              bump();
            }}
          />
          <SettingToggleRow
            label="Saved search matches"
            detail="Push updates when new listings match a saved search."
            value={marketStore.notifications.savedSearchMatches}
            onValueChange={(value) => {
              marketStore.notifications.savedSearchMatches = value;
              bump();
            }}
          />
          <SettingToggleRow
            label="Watchlist price drops"
            detail="Get nudged when a watched item changes price."
            value={marketStore.notifications.watchlistPriceDrops}
            onValueChange={(value) => {
              marketStore.notifications.watchlistPriceDrops = value;
              bump();
            }}
          />
          <SettingToggleRow
            label="Offer received"
            detail="See incoming offers before they go stale."
            value={marketStore.notifications.offerReceived}
            onValueChange={(value) => {
              marketStore.notifications.offerReceived = value;
              bump();
            }}
          />
          <SettingToggleRow
            label="Offer accepted"
            detail="Get notified the moment a negotiation closes."
            value={marketStore.notifications.offerAccepted}
            onValueChange={(value) => {
              marketStore.notifications.offerAccepted = value;
              bump();
            }}
          />
          <SettingToggleRow
            label="Order updates"
            detail="Shipment, delivery, and escrow release events."
            value={marketStore.notifications.orderUpdates}
            onValueChange={(value) => {
              marketStore.notifications.orderUpdates = value;
              bump();
            }}
          />
          <SettingToggleRow
            label="Dispute updates"
            detail="Important review steps from the moderation flow."
            value={marketStore.notifications.disputeUpdates}
            onValueChange={(value) => {
              marketStore.notifications.disputeUpdates = value;
              bump();
            }}
          />
        </View>
      </SectionShell>

      <SectionShell icon="payments" label="Payment Methods">
        <View style={styles.stack}>
          {paymentMethods.map((item) => (
            <View key={item.id} style={styles.paymentRow}>
              <View style={[styles.paymentGlyph, { backgroundColor: withAlpha(item.brandTint, 0.18) }]}>
                <MaterialSymbol name="payments" size={18} color={item.brandTint} />
              </View>
              <View style={styles.settingTextWrap}>
                <Text style={styles.settingLabel}>{item.label}</Text>
                <Text style={styles.settingDetail}>{item.detail}</Text>
              </View>
              {item.isDefault ? <Text style={styles.linkText}>Default</Text> : null}
            </View>
          ))}
          <GradientButton label="Add payment method" icon="add" tone="secondary" onPress={addPaymentMethod} />
        </View>
      </SectionShell>

      <SectionShell icon="payments" label="Payout Methods">
        <View style={styles.stack}>
          <View style={styles.settingRow}>
            <View style={styles.settingTextWrap}>
              <Text style={styles.settingLabel}>Stripe Connect</Text>
              <Text style={styles.settingDetail}>
                {marketStore.payoutConnected ? 'Bank account connected for seller payouts.' : 'No payout account connected yet.'}
              </Text>
            </View>
            <Text style={marketStore.payoutConnected ? styles.successText : styles.mutedText}>
              {marketStore.payoutConnected ? 'Connected' : 'Pending'}
            </Text>
          </View>

          <GradientButton
            label={marketStore.payoutConnected ? 'Manage Stripe' : 'Connect Stripe'}
            icon="payments"
            onPress={() => {
              marketStore.payoutConnected = true;
              marketStore.payoutLabel = 'Manage Stripe';
              bump();
            }}
          />
          <Pressable onPress={() => Alert.alert('Tax info', 'Tax document management remains a linked flow outside this UI-only pass.')}>
            <Text style={styles.linkText}>Open tax information</Text>
          </Pressable>
        </View>
      </SectionShell>

      <SectionShell icon="local_shipping" label="Shipping Addresses">
        <View style={styles.stack}>
          {addresses.map((item) => (
            <View key={item.id} style={styles.settingRow}>
              <View style={styles.settingTextWrap}>
                <Text style={styles.settingLabel}>{item.label}</Text>
                <Text style={styles.settingDetail}>{item.detail}</Text>
              </View>
              {item.isDefault ? <Text style={styles.linkText}>Default</Text> : null}
            </View>
          ))}
          <GradientButton label="Add shipping address" icon="add" tone="secondary" onPress={addShippingAddress} />
        </View>
      </SectionShell>

      <SectionShell icon="lock" label="Privacy">
        <View style={styles.stack}>
          <SettingToggleRow
            label="Show online status"
            detail="Let buyers know when you are currently active."
            value={marketStore.privacy.showOnlineStatus}
            onValueChange={(value) => {
              marketStore.privacy.showOnlineStatus = value;
              bump();
            }}
          />
          <SettingToggleRow
            label="Show last seen"
            detail="Expose recency while keeping exact times private."
            value={marketStore.privacy.showLastSeen}
            onValueChange={(value) => {
              marketStore.privacy.showLastSeen = value;
              bump();
            }}
          />
          <SettingToggleRow
            label="Allow message requests from anyone"
            detail="Broaden marketplace reach beyond your current circles."
            value={marketStore.privacy.allowMessageRequests}
            onValueChange={(value) => {
              marketStore.privacy.allowMessageRequests = value;
              bump();
            }}
          />
          <SettingToggleRow
            label="Hide profile from search"
            detail="Keep your listings active while reducing discoverability."
            value={marketStore.privacy.hideProfileFromSearch}
            onValueChange={(value) => {
              marketStore.privacy.hideProfileFromSearch = value;
              bump();
            }}
          />
        </View>
      </SectionShell>

      <SectionShell icon="block" label="Blocked Users">
        <View style={styles.stack}>
          {blockedUsers.length > 0 ? (
            blockedUsers.map((item) => (
              <View key={item.id} style={styles.paymentRow}>
                <View style={[styles.paymentGlyph, { backgroundColor: withAlpha(item.tint, 0.18) }]}>
                  <MaterialSymbol name="block" size={18} color={item.tint} />
                </View>
                <View style={styles.settingTextWrap}>
                  <Text style={styles.settingLabel}>{item.name}</Text>
                  <Text style={styles.settingDetail}>{item.reason}</Text>
                  <Text style={styles.mutedText}>{item.blockedAt}</Text>
                </View>
                <Pressable
                  onPress={() => {
                    marketStore.blockedUsers = marketStore.blockedUsers.filter((blocked) => blocked.id !== item.id);
                    bump();
                  }}
                >
                  <Text style={styles.linkText}>Unblock</Text>
                </Pressable>
              </View>
            ))
          ) : (
            <Text style={styles.settingDetail}>No blocked users.</Text>
          )}
        </View>
      </SectionShell>

      <SectionShell icon="download" label="Data">
        <View style={styles.stack}>
          <Pressable onPress={() => Alert.alert('Export queued', 'Listings and messages export would be prepared as CSV in the production flow.')}>
            <Text style={styles.linkText}>Export listings + messages (CSV)</Text>
          </Pressable>
          <Pressable onPress={clearLocalCache}>
            <Text style={styles.linkText}>Clear local cache</Text>
          </Pressable>
          <Pressable onPress={deleteAccount}>
            <Text style={styles.dangerText}>Delete account</Text>
          </Pressable>
        </View>
      </SectionShell>

      <SectionShell icon="settings" label="About">
        <View style={styles.stack}>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Version</Text>
            <Text style={styles.settingDetail}>0.1.0-beta</Text>
          </View>
          <Pressable onPress={() => Alert.alert('Privacy policy', 'Privacy policy deep link not wired in this UI-only pass.')}>
            <Text style={styles.linkText}>Privacy policy</Text>
          </Pressable>
          <Pressable onPress={() => Alert.alert('Terms of service', 'Terms deep link not wired in this UI-only pass.')}>
            <Text style={styles.linkText}>Terms of service</Text>
          </Pressable>
          <Pressable onPress={() => Alert.alert('Support', 'Support routing remains a linked flow outside the mobile shell.')}>
            <Text style={styles.linkText}>Support</Text>
          </Pressable>
        </View>
      </SectionShell>
    </MarketScreenShell>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MK_SURFACES.base,
  },
  scroll: {
    flex: 1,
  },
  content: {
    gap: 18,
    paddingHorizontal: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(MK_SURFACES.high, 0.7),
  },
  topBarTitle: {
    ...MK_TYPOGRAPHY.titleMd,
    color: MK_ACCENT,
    flex: 1,
    textAlign: 'center',
  },
  topBarActionWrap: {
    width: 42,
    alignItems: 'flex-end',
  },
  hero: {
    gap: 8,
    paddingTop: 4,
  },
  eyebrow: {
    ...MK_TYPOGRAPHY.labelUpper,
    color: MK_ACCENT_LIGHT,
  },
  heroHeading: {
    ...MK_TYPOGRAPHY.displayLg,
    color: MK_TEXT,
  },
  heroSubtitle: {
    ...MK_TYPOGRAPHY.bodyMd,
    color: MK_TEXT_SECONDARY,
  },
  segmentedControl: {
    flexDirection: 'row',
    gap: 8,
    padding: 4,
    borderRadius: 999,
    backgroundColor: withAlpha(MK_SURFACES.low, 0.92),
  },
  segmentButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  segmentButtonActive: {
    backgroundColor: MK_ACCENT,
  },
  segmentLabel: {
    ...MK_TYPOGRAPHY.bodyMd,
    color: MK_TEXT_SECONDARY,
    fontWeight: '600',
  },
  segmentLabelActive: {
    color: MK_ACCENT_DARK,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    ...MK_TYPOGRAPHY.bodyMd,
    color: MK_TEXT,
    paddingVertical: 0,
  },
  inlineScroller: {
    gap: 10,
    paddingRight: 8,
  },
  filterChip: {
    minHeight: 38,
    borderRadius: 999,
    backgroundColor: MK_SURFACES.low,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterChipActive: {
    backgroundColor: MK_ACCENT,
  },
  filterChipLabel: {
    ...MK_TYPOGRAPHY.caption,
    color: MK_TEXT_SECONDARY,
  },
  filterChipLabelActive: {
    color: MK_ACCENT_DARK,
    fontWeight: '700',
  },
  providerCard: {
    gap: 14,
  },
  providerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  providerIdentity: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  avatarFrame: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(MK_ACCENT, 0.18),
    position: 'relative',
  },
  avatarInitials: {
    ...MK_TYPOGRAPHY.titleMd,
    color: MK_TEXT,
  },
  availabilityDot: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: MK_SURFACES.base,
  },
  providerTextWrap: {
    flex: 1,
    gap: 4,
  },
  providerNameRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  providerName: {
    ...MK_TYPOGRAPHY.titleMd,
    color: MK_TEXT,
    flexShrink: 1,
  },
  providerTitle: {
    ...MK_TYPOGRAPHY.caption,
    color: MK_ACCENT,
  },
  providerTagline: {
    ...MK_TYPOGRAPHY.bodyMd,
    color: MK_TEXT_SECONDARY,
  },
  providerRateWrap: {
    alignItems: 'flex-end',
    gap: 4,
  },
  providerRateMeta: {
    ...MK_TYPOGRAPHY.caption,
    color: MK_TEXT_TERTIARY,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    ...MK_TYPOGRAPHY.caption,
    color: MK_TEXT_SECONDARY,
  },
  providerChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  providerBadge: {
    minHeight: 28,
    borderRadius: 999,
    backgroundColor: withAlpha(MK_SURFACES.high, 0.8),
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  providerBadgeText: {
    ...MK_TYPOGRAPHY.labelUpper,
    color: MK_TEXT,
  },
  providerDistance: {
    ...MK_TYPOGRAPHY.caption,
    color: MK_TEXT_TERTIARY,
  },
  portfolioRow: {
    flexDirection: 'row',
    gap: 10,
  },
  portfolioTile: {
    flex: 1,
    minHeight: 84,
    borderRadius: 18,
    padding: 12,
    justifyContent: 'flex-end',
  },
  portfolioTileText: {
    ...MK_TYPOGRAPHY.caption,
    color: '#FFFFFF',
  },
  footerWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 0,
  },
  buttonFrame: {
    flex: 1,
  },
  buttonGradient: {
    minHeight: 52,
    borderRadius: 18,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  buttonGradientMuted: {
    borderWidth: 0,
  },
  buttonLabel: {
    ...MK_TYPOGRAPHY.titleMd,
    color: MK_TEXT,
  },
  buttonLabelPrimary: {
    color: MK_ACCENT_DARK,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  stack: {
    gap: 12,
  },
  helperCopy: {
    ...MK_TYPOGRAPHY.bodyMd,
    color: MK_TEXT_SECONDARY,
    marginTop: 10,
  },
  emptyStateCard: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 24,
  },
  emptyStateIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: withAlpha(MK_ACCENT, 0.16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateTitle: {
    ...MK_TYPOGRAPHY.headlineMd,
    color: MK_TEXT,
    textAlign: 'center',
  },
  emptyStateDetail: {
    ...MK_TYPOGRAPHY.bodyMd,
    color: MK_TEXT_SECONDARY,
    textAlign: 'center',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  settingTextWrap: {
    flex: 1,
    gap: 2,
  },
  settingLabel: {
    ...MK_TYPOGRAPHY.titleMd,
    color: MK_TEXT,
  },
  settingDetail: {
    ...MK_TYPOGRAPHY.bodyMd,
    color: MK_TEXT_SECONDARY,
  },
  mutedText: {
    ...MK_TYPOGRAPHY.caption,
    color: MK_TEXT_TERTIARY,
  },
  inlineActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  requestMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 14,
  },
  requestMetaText: {
    ...MK_TYPOGRAPHY.caption,
    color: MK_TEXT_TERTIARY,
  },
  sectionWrap: {
    gap: 10,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  sectionLabel: {
    ...MK_TYPOGRAPHY.labelUpper,
    color: MK_TEXT_TERTIARY,
    fontSize: 11,
    letterSpacing: 1.2,
  },
  sectionLabelDanger: {
    color: '#FF453A',
  },
  dangerGlassCard: {
    backgroundColor: 'rgba(255, 69, 58, 0.08)',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  providerDetailHero: {
    gap: 14,
  },
  providerDetailTop: {
    flexDirection: 'row',
    gap: 14,
  },
  providerDetailAvatar: {
    width: 74,
    height: 74,
    borderRadius: 24,
    backgroundColor: withAlpha(MK_ACCENT, 0.18),
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerDetailInitials: {
    ...MK_TYPOGRAPHY.headlineMd,
    color: MK_TEXT,
  },
  detailRateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  typePillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  formStack: {
    gap: 12,
    marginTop: 12,
  },
  input: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: withAlpha(MK_SURFACES.low, 0.92),
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...MK_TYPOGRAPHY.bodyMd,
    color: MK_TEXT,
  },
  largeInput: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  halfInput: {
    flex: 1,
  },
  inlineChoiceWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineChoice: {
    flex: 1,
    minHeight: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MK_SURFACES.high,
  },
  inlineChoiceActive: {
    backgroundColor: MK_ACCENT,
  },
  inlineChoiceLabel: {
    ...MK_TYPOGRAPHY.caption,
    color: MK_TEXT_SECONDARY,
  },
  inlineChoiceLabelActive: {
    color: MK_ACCENT_DARK,
    fontWeight: '700',
  },
  subjectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  subjectThumb: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: withAlpha(MK_ACCENT, 0.16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectThumbText: {
    ...MK_TYPOGRAPHY.headlineMd,
    color: MK_TEXT,
  },
  subjectTextWrap: {
    flex: 1,
    gap: 4,
  },
  reasonList: {
    gap: 10,
  },
  reasonRow: {
    minHeight: 74,
    borderRadius: 18,
    backgroundColor: withAlpha(MK_SURFACES.low, 0.92),
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  reasonRowSelected: {
    backgroundColor: withAlpha(MK_ACCENT, 0.18),
  },
  reasonTextWrap: {
    flex: 1,
    gap: 3,
  },
  reasonLabelSelected: {
    color: MK_ACCENT_LIGHT,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: MK_SURFACES.high,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    backgroundColor: MK_ACCENT,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: MK_ACCENT_DARK,
  },
  reportInput: {
    minHeight: 156,
    marginBottom: 8,
  },
  evidenceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  evidenceSlot: {
    width: '47%',
    aspectRatio: 1,
    borderRadius: 18,
    backgroundColor: withAlpha(MK_SURFACES.low, 0.92),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    gap: 6,
  },
  evidenceImage: {
    width: '100%',
    height: '100%',
  },
  confirmationIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: withAlpha(MK_ACCENT, 0.18),
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  confirmationToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  profileMiniBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(MK_ACCENT, 0.16),
  },
  profileMiniBadgeText: {
    ...MK_TYPOGRAPHY.caption,
    color: MK_TEXT,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  paymentGlyph: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: {
    ...MK_TYPOGRAPHY.caption,
    color: MK_ACCENT_LIGHT,
    fontWeight: '700',
  },
  successText: {
    ...MK_TYPOGRAPHY.caption,
    color: '#30D158',
    fontWeight: '700',
  },
  dangerText: {
    ...MK_TYPOGRAPHY.caption,
    color: '#FF453A',
    fontWeight: '700',
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: MK_ACCENT_LIGHT,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusPillText: {
    ...MK_TYPOGRAPHY.labelUpper,
  },
});
