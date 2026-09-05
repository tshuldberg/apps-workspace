import type { CSSProperties } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  addDisputeMessageAction,
  createListingAction,
  createOfferAction,
  getBrowseData,
  getCheckoutData,
  getDisputeDetailData,
  getDisputesData,
  getHomeData,
  getListingData,
  getMessagesData,
  getOffersData,
  getOrderDetailData,
  getOrdersData,
  getProfileData,
  getReviewsData,
  getSavedSearchesData,
  getServicesData,
  getSettingsData,
  getWatchlistData,
  processCheckoutAction,
  respondToOfferAction,
  saveSearchAction,
  sendMessageAction,
  startConversationAction,
  submitDisputeAction,
  submitReportAction,
  toggleBlockUserAction,
  toggleSavedSearchAlertsAction,
  toggleWatchlistAction,
  updateSettingAction,
} from './actions';
import { LOCAL_USER_ID, MARKET_CATEGORIES, MARKET_SELLERS } from './data';
import {
  MARKET_FONT_STACK,
  MarketButton,
  MarketConditionPill,
  MarketEmptyState,
  MarketIcon,
  MarketListingCard,
  MarketPanel,
  MarketPill,
  MarketSectionHeading,
  MarketSellerCard,
  MarketStatTile,
  MarketTimeline,
  MarketVerificationPill,
  formatCurrencyCents,
  formatLongDate,
  formatRelativeTime,
  readFirstParam,
  renderStars,
} from './ui';

const labelStyle: CSSProperties = {
  color: 'var(--market-text-tertiary)',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
};

const inputStyle: CSSProperties = {
  width: '100%',
  border: 'none',
  outline: 'none',
  borderRadius: 18,
  padding: '14px 16px',
  background: 'rgba(255,255,255,0.05)',
  color: 'var(--market-text)',
  fontFamily: MARKET_FONT_STACK,
  fontSize: 14,
};

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 132,
  resize: 'vertical',
};

const submitButtonStyle: CSSProperties = {
  border: 'none',
  borderRadius: 999,
  minHeight: 46,
  padding: '12px 18px',
  background: 'linear-gradient(135deg, var(--market-accent-light), var(--market-accent))',
  color: 'var(--market-accent-dark)',
  fontFamily: MARKET_FONT_STACK,
  fontSize: 13,
  fontWeight: 900,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  boxShadow: '0 18px 40px rgba(20, 184, 166, 0.24)',
};

const secondaryButtonStyle: CSSProperties = {
  border: 'none',
  borderRadius: 999,
  minHeight: 42,
  padding: '11px 16px',
  background: 'rgba(255,255,255,0.06)',
  color: 'var(--market-text-secondary)',
  fontFamily: MARKET_FONT_STACK,
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
};

const tableNumberStyle: CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--market-text)',
  fontWeight: 700,
};

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: 'grid', gap: 8 }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </label>
  );
}

function SectionLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 40,
        padding: '10px 14px',
        borderRadius: 999,
        background: active ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
        color: active ? 'var(--market-text)' : 'var(--market-text-secondary)',
        fontSize: 13,
        fontWeight: active ? 800 : 700,
      }}
    >
      {label}
    </Link>
  );
}

function WatchToggleForm({
  listingId,
  returnTo,
  watched,
}: {
  listingId: string;
  returnTo: string;
  watched: boolean;
}) {
  return (
    <form action={toggleWatchlistAction}>
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button
        type="submit"
        aria-label={watched ? 'Remove from watchlist' : 'Add to watchlist'}
        style={{
          width: 38,
          height: 38,
          border: 'none',
          borderRadius: 999,
          display: 'grid',
          placeItems: 'center',
          background: 'rgba(14, 14, 19, 0.62)',
          backdropFilter: 'blur(14px)',
          cursor: 'pointer',
        }}
      >
        <MarketIcon name="favorite" filled={watched} color={watched ? '#FF7A7A' : '#F0F0F5'} />
      </button>
    </form>
  );
}

function CategoryOptions() {
  return (
    <>
      {MARKET_CATEGORIES.map((category) => (
        <option key={category.id} value={category.id}>
          {category.name}
        </option>
      ))}
    </>
  );
}

function SellerSummary({
  seller,
}: {
  seller: (typeof MARKET_SELLERS)[number];
}) {
  return (
    <MarketPanel tone="mid" padding={20}>
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: 18,
              display: 'grid',
              placeItems: 'center',
              background: 'linear-gradient(135deg, rgba(45,212,191,0.9), rgba(20,184,166,0.8))',
              color: '#002A23',
              fontWeight: 900,
            }}
          >
            {seller.avatarSeed}
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            <strong style={{ fontSize: 17 }}>{seller.name}</strong>
            <span style={{ color: 'var(--market-text-secondary)', fontSize: 14 }}>{seller.location}</span>
          </div>
        </div>
        <div className="mk-chip-row">
          <MarketVerificationPill level={seller.tier} />
          <MarketPill label={`${seller.averageRating.toFixed(1)} Rating`} color="#8BCFF0" />
        </div>
        <p style={{ margin: 0, color: 'var(--market-text-secondary)', lineHeight: 1.6 }}>{seller.bio}</p>
      </div>
    </MarketPanel>
  );
}

export async function MarketHomeScreen() {
  const data = await getHomeData();

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <MarketPanel tone="glass" padding={28}>
        <div className="mk-split">
          <div style={{ display: 'grid', gap: 18 }}>
            <MarketSectionHeading
              eyebrow="Recent Listings"
              title="Buy and sell, human to human."
              subtitle="The market stays cache-first and desktop legible: fresh listings up front, categories in one scan, and your watchlist close enough to act on quickly."
              action={<MarketButton href="/market/browse">See All</MarketButton>}
            />
            <div className="mk-hero-strip">
              <MarketPill label={`${data.stats.activeListings} Active`} icon="inventory_2" />
              <MarketPill label={`${data.stats.savedItems} Watched`} icon="favorite" color="#FF7A7A" />
              <MarketPill label={`${data.stats.services} Services`} icon="build" color="#8BCFF0" />
            </div>
          </div>
          <div className="mk-grid-3">
            <MarketStatTile label="Watchlist" value={String(data.stats.savedItems)} note="Items you are tracking closely" />
            <MarketStatTile label="Services" value={String(data.stats.services)} note="Service offers and requests live" accent="#8BCFF0" />
            <MarketStatTile label="Velocity" value="18h" note="Median response window" accent="#FFB877" />
          </div>
        </div>
      </MarketPanel>

      <div>
        <MarketSectionHeading
          title="Recent Listings"
          subtitle="A horizontal scan for the newest, most active inventory."
          action={<MarketButton href="/market/browse" secondary>Browse Market</MarketButton>}
        />
        <div className="mk-scroll-x">
          {data.recentListings.map((listing) => (
            <div key={listing.id} style={{ minWidth: 312, flex: '0 0 312px' }}>
              <MarketListingCard
                listing={listing}
                sellerName={listing.seller.name}
                categoryName={listing.category.name}
                href={`/market/${listing.id}`}
                overlay={<WatchToggleForm listingId={listing.id} returnTo="/market" watched={listing.isWatched} />}
                eyebrow={
                  listing.previousPriceCents && listing.priceCents
                    ? (
                        <span style={{ color: '#FFB877', fontSize: 12, fontWeight: 700 }}>
                          Down from {formatCurrencyCents(listing.previousPriceCents)}
                        </span>
                      )
                    : null
                }
                footer={<span style={{ color: 'var(--market-text-tertiary)', fontSize: 12 }}>{formatRelativeTime(listing.createdAt)}</span>}
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <MarketSectionHeading title="Browse Categories" subtitle="The whole market condensed into one four-column read." />
        <div className="mk-grid-4">
          {data.categories.map((category) => (
            <Link
              key={category.id}
              href={`/market/browse?category=${category.slug}`}
              style={{
                ...{
                  background: 'var(--market-surface-low)',
                  borderRadius: 24,
                  padding: 18,
                  display: 'grid',
                  gap: 16,
                  minHeight: 148,
                },
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 20,
                  background: 'rgba(45,212,191,0.12)',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <MarketIcon name={String(category.icon ?? 'inventory_2')} color="var(--market-accent-light)" size={28} />
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <strong style={{ fontSize: 18 }}>{category.name}</strong>
                <span style={{ color: 'var(--market-text-secondary)', fontSize: 14 }}>{category.count} active listings</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="mk-split">
        <div>
          <MarketSectionHeading title="Your Watchlist" subtitle="Pinned items with pricing signals and direct next steps." />
          <div className="mk-grid-2">
            {data.watchlistListings.map((listing) => (
              <MarketListingCard
                key={listing.id}
                listing={listing}
                sellerName={listing.seller.name}
                categoryName={listing.category.name}
                href={`/market/${listing.id}`}
                overlay={<WatchToggleForm listingId={listing.id} returnTo="/market" watched />}
                eyebrow={
                  listing.previousPriceCents && listing.priceCents
                    ? (
                        <span style={{ color: '#FFB877', fontSize: 12, fontWeight: 700 }}>
                          {formatCurrencyCents(listing.previousPriceCents - listing.priceCents)} lower than last week
                        </span>
                      )
                    : null
                }
              />
            ))}
          </div>
        </div>

        <div>
          <MarketSectionHeading title="Featured Sellers" subtitle="High-trust profiles worth browsing first." />
          <div className="mk-scroll-x" style={{ display: 'grid', gap: 16 }}>
            {data.featuredSellers.map((seller) => (
              <MarketSellerCard key={seller.id} seller={seller} href={seller.id === LOCAL_USER_ID ? '/market/profile' : `/market/seller/${seller.id}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export async function MarketBrowseScreen({
  params,
}: {
  params: Record<string, string | string[] | undefined>;
}) {
  const filters = {
    q: readFirstParam(params.q),
    category: readFirstParam(params.category),
    condition: readFirstParam(params.condition),
    listingType: readFirstParam(params.listingType),
    minPrice: Number(readFirstParam(params.minPrice) ?? '') || undefined,
    maxPrice: Number(readFirstParam(params.maxPrice) ?? '') || undefined,
    maxDistance: Number(readFirstParam(params.maxDistance) ?? '') || undefined,
    sort: readFirstParam(params.sort) ?? 'newest',
  };
  const data = await getBrowseData(filters);

  return (
    <div className="mk-sidebar-layout">
      <MarketPanel tone="mid" padding={20} style={{ position: 'sticky', top: 88 }}>
        <MarketSectionHeading title="Filters" subtitle="Dial in the browse surface." />
        <form action="/market/browse" className="mk-form-grid">
          <FormField label="Search">
            <input style={inputStyle} name="q" defaultValue={filters.q ?? ''} placeholder="Search listings or sellers" />
          </FormField>
          <FormField label="Category">
            <select name="category" defaultValue={filters.category ?? ''} style={inputStyle}>
              <option value="">All categories</option>
              {MARKET_CATEGORIES.map((category) => (
                <option key={category.id} value={category.slug}>{category.name}</option>
              ))}
            </select>
          </FormField>
          <div className="mk-field-grid">
            <FormField label="Min Price">
              <input style={inputStyle} name="minPrice" type="number" defaultValue={filters.minPrice ?? ''} placeholder="0" />
            </FormField>
            <FormField label="Max Price">
              <input style={inputStyle} name="maxPrice" type="number" defaultValue={filters.maxPrice ?? ''} placeholder="1000" />
            </FormField>
          </div>
          <div className="mk-field-grid">
            <FormField label="Distance">
              <input style={inputStyle} name="maxDistance" type="number" defaultValue={filters.maxDistance ?? ''} placeholder="25" />
            </FormField>
            <FormField label="Sort">
              <select name="sort" defaultValue={filters.sort} style={inputStyle}>
                <option value="newest">Newest</option>
                <option value="popular">Most popular</option>
                <option value="price-low">Price low to high</option>
                <option value="price-high">Price high to low</option>
              </select>
            </FormField>
          </div>
          <FormField label="Condition">
            <select name="condition" defaultValue={filters.condition ?? ''} style={inputStyle}>
              <option value="">Any condition</option>
              <option value="new">New</option>
              <option value="like_new">Like New</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="poor">Poor</option>
            </select>
          </FormField>
          <FormField label="Listing Type">
            <select name="listingType" defaultValue={filters.listingType ?? ''} style={inputStyle}>
              <option value="">Any listing type</option>
              <option value="sell">Sell</option>
              <option value="trade">Trade</option>
              <option value="free">Free</option>
              <option value="wanted">Wanted</option>
              <option value="service_offer">Service Offer</option>
              <option value="service_request">Service Request</option>
            </select>
          </FormField>
          <button type="submit" style={submitButtonStyle}>Apply Filters</button>
        </form>

        {data.hasActiveFilters ? (
          <form action={saveSearchAction} className="mk-form-grid" style={{ marginTop: 18 }}>
            <input type="hidden" name="query" value={filters.q ?? 'market browse'} />
            <input type="hidden" name="categoryId" value={filters.category ?? ''} />
            <input type="hidden" name="minPrice" value={filters.minPrice ?? ''} />
            <input type="hidden" name="maxPrice" value={filters.maxPrice ?? ''} />
            <input type="hidden" name="label" value="Saved from desktop browse" />
            <input type="hidden" name="returnTo" value="/market/saved-searches" />
            <FormField label="Save Search Name">
              <input style={inputStyle} name="name" defaultValue="Desktop browse search" />
            </FormField>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--market-text-secondary)', fontSize: 14 }}>
              <input type="checkbox" name="notifyOnMatch" defaultChecked />
              Notify when matches arrive
            </label>
            <button type="submit" style={secondaryButtonStyle}>Save Search</button>
          </form>
        ) : null}
      </MarketPanel>

      <div style={{ display: 'grid', gap: 20 }}>
        <MarketSectionHeading
          eyebrow="Browse Marketplace"
          title={`${data.listings.length} results`}
          subtitle="Filter rail on the left, responsive listing grid on the right, and one-click watchlist overlays."
        />
        {data.listings.length === 0 ? (
          <MarketEmptyState title="No listings matched" body="Adjust your filters or clear the search to widen the market scan." action={<MarketButton href="/market/browse" secondary>Reset filters</MarketButton>} />
        ) : (
          <div className="mk-grid-4">
            {data.listings.map((listing) => (
              <MarketListingCard
                key={listing.id}
                listing={listing}
                sellerName={listing.seller.name}
                categoryName={listing.category.name}
                href={`/market/${listing.id}`}
                overlay={<WatchToggleForm listingId={listing.id} returnTo="/market/browse" watched={listing.isWatched} />}
                footer={<span style={{ color: 'var(--market-text-tertiary)', fontSize: 12 }}>{listing.distanceMiles} mi away</span>}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export async function MarketListingScreen(listingId: string) {
  const data = await getListingData(listingId);
  if (!data) notFound();

  const checkoutHref = `/market/checkout?listingId=${data.listing.id}`;

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div className="mk-detail-grid">
        <MarketPanel tone="glass" padding={0} style={{ overflow: 'hidden' }}>
          <div style={{ padding: 22, display: 'grid', gap: 16 }}>
            <div
              style={{
                minHeight: 320,
                borderRadius: 26,
                background: `linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(20, 184, 166, 0.5))`,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <div style={{ display: 'grid', gap: 12, justifyItems: 'center' }}>
                <MarketIcon name="inventory_2" color="#F8FAFC" size={56} />
                <span style={{ color: 'rgba(248,250,252,0.88)', fontSize: 15 }}>Desktop gallery placeholder</span>
              </div>
            </div>
            <div className="mk-grid-3">
              <MarketPanel tone="mid" padding={16}><span style={{ color: 'var(--market-text-secondary)' }}>4:5 cover</span></MarketPanel>
              <MarketPanel tone="mid" padding={16}><span style={{ color: 'var(--market-text-secondary)' }}>Detail crop</span></MarketPanel>
              <MarketPanel tone="mid" padding={16}><span style={{ color: 'var(--market-text-secondary)' }}>Context shot</span></MarketPanel>
            </div>
          </div>
        </MarketPanel>

        <div style={{ display: 'grid', gap: 18 }}>
          <MarketPanel tone="glass" padding={24}>
            <div style={{ display: 'grid', gap: 16 }}>
              <div className="mk-chip-row">
                {data.listing.condition ? <MarketConditionPill condition={data.listing.condition} /> : null}
                <MarketVerificationPill level={data.seller.tier} />
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.02, letterSpacing: '-0.05em' }}>{data.listing.title}</h1>
                <p style={{ margin: 0, color: 'var(--market-text-secondary)', lineHeight: 1.7 }}>{data.listing.description}</p>
              </div>
              <div className="mk-chip-row">
                <span style={{ color: 'var(--market-accent-light)', fontSize: 30, fontWeight: 900 }}>
                  {formatCurrencyCents(data.listing.priceCents)}
                </span>
                <span style={{ color: 'var(--market-text-tertiary)', fontSize: 14 }}>
                  {data.listing.locationName ?? 'Remote'} / {data.listing.category.name}
                </span>
              </div>
              <div className="mk-chip-row">
                <form action={startConversationAction}>
                  <input type="hidden" name="listingId" value={data.listing.id} />
                  <button type="submit" style={submitButtonStyle}>Message Seller</button>
                </form>
                <MarketButton href={checkoutHref} secondary>Checkout</MarketButton>
                <Link href={`/market/report?listing=${data.listing.id}&user=${data.seller.id}`} style={{ ...secondaryButtonStyle, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>Report</Link>
              </div>
            </div>
          </MarketPanel>

          <SellerSummary seller={data.seller} />

          <MarketPanel tone="mid" padding={20}>
            <MarketSectionHeading title="Make an Offer" subtitle="Send a direct number without leaving the listing." />
            <form action={createOfferAction} className="mk-form-grid">
              <input type="hidden" name="listingId" value={data.listing.id} />
              <FormField label="Offer Amount">
                <input style={inputStyle} name="amount" type="number" step="0.01" defaultValue={((data.listing.priceCents ?? 0) / 100).toFixed(2)} />
              </FormField>
              <FormField label="Message">
                <textarea style={textareaStyle} name="message" defaultValue="Happy to pay today if pickup timing works." />
              </FormField>
              <button type="submit" style={submitButtonStyle}>Send Offer</button>
            </form>
          </MarketPanel>
        </div>
      </div>

      <div className="mk-split">
        <MarketPanel tone="mid" padding={24}>
          <MarketSectionHeading title="Seller reviews" subtitle={`${data.reviews.length} recent reviews for ${data.seller.name}.`} />
          <div style={{ display: 'grid', gap: 14 }}>
            {data.reviews.slice(0, 4).map((review) => (
              <MarketPanel key={review.id} tone="surface" padding={18}>
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <strong>{review.reviewerName}</strong>
                    <span style={{ color: '#FFB877' }}>{renderStars(review.rating)}</span>
                  </div>
                  <p style={{ margin: 0, color: 'var(--market-text-secondary)', lineHeight: 1.6 }}>{review.body}</p>
                  <span style={{ color: 'var(--market-text-tertiary)', fontSize: 12 }}>{formatLongDate(review.createdAt)}</span>
                </div>
              </MarketPanel>
            ))}
          </div>
        </MarketPanel>

        <MarketPanel tone="mid" padding={24}>
          <MarketSectionHeading title="Related listings" subtitle="Same category, same local orbit." />
          <div style={{ display: 'grid', gap: 14 }}>
            {data.relatedListings.map((listing) => (
              <MarketListingCard
                key={listing.id}
                listing={listing}
                sellerName={listing.seller.name}
                categoryName={listing.category.name}
                href={`/market/${listing.id}`}
                footer={<span style={{ color: 'var(--market-text-tertiary)', fontSize: 12 }}>{listing.distanceMiles} mi</span>}
              />
            ))}
          </div>
        </MarketPanel>
      </div>
    </div>
  );
}

export async function MarketSellScreen({
  params,
}: {
  params: Record<string, string | string[] | undefined>;
}) {
  const selectedType = readFirstParam(params.type) ?? 'sell';

  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 1024 }}>
      <MarketPanel tone="glass" padding={24}>
        <MarketSectionHeading
          eyebrow="Create Listing"
          title="Ship a desktop listing flow with a denser form."
          subtitle="Type pills, photo placeholders, grouped inputs, and one path back into the market shell."
        />
        <div className="mk-chip-row">
          {['sell', 'trade', 'free', 'wanted', 'service_offer', 'service_request'].map((type) => (
            <SectionLink key={type} href={`/market/sell?type=${type}`} label={type.replace(/_/g, ' ')} active={selectedType === type} />
          ))}
        </div>
      </MarketPanel>

      <div className="mk-detail-grid">
        <MarketPanel tone="mid" padding={22}>
          <MarketSectionHeading title="Photos" subtitle="Desktop upload grid placeholder." />
          <div className="mk-grid-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                style={{
                  aspectRatio: '1 / 1',
                  borderRadius: 22,
                  background: index === 0 ? 'rgba(45,212,191,0.1)' : 'rgba(255,255,255,0.04)',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <MarketIcon name={index === 0 ? 'add_a_photo' : 'image'} color={index === 0 ? 'var(--market-accent-light)' : 'var(--market-text-tertiary)'} size={26} />
              </div>
            ))}
          </div>
        </MarketPanel>

        <MarketPanel tone="glass" padding={24}>
          <MarketSectionHeading title="Listing Form" subtitle="Two-column desktop form capped at 1024px." />
          <form action={createListingAction} className="mk-form-grid">
            <input type="hidden" name="listingType" value={selectedType} />
            <div className="mk-field-grid">
              <FormField label="Title">
                <input style={inputStyle} name="title" placeholder="What are you listing?" />
              </FormField>
              <FormField label="Category">
                <select style={inputStyle} name="categoryId" defaultValue={MARKET_CATEGORIES[0].id}>
                  <CategoryOptions />
                </select>
              </FormField>
            </div>
            <div className="mk-field-grid">
              <FormField label="Price">
                <input style={inputStyle} name="price" type="number" step="0.01" placeholder="0.00" />
              </FormField>
              <FormField label="Condition">
                <select style={inputStyle} name="condition" defaultValue={selectedType.includes('service') ? '' : 'good'}>
                  <option value="">No condition</option>
                  <option value="new">New</option>
                  <option value="like_new">Like New</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="poor">Poor</option>
                </select>
              </FormField>
            </div>
            <div className="mk-field-grid">
              <FormField label="Location">
                <input style={inputStyle} name="locationName" defaultValue="Los Angeles" />
              </FormField>
              <FormField label="Fulfillment">
                <select style={inputStyle} name="fulfillmentType" defaultValue={selectedType.includes('service') ? 'remote' : 'pickup'}>
                  <option value="pickup">Pickup</option>
                  <option value="shipping">Shipping</option>
                  <option value="delivery">Delivery</option>
                  <option value="onsite">Onsite</option>
                  <option value="remote">Remote</option>
                </select>
              </FormField>
            </div>
            <FormField label="Description">
              <textarea style={textareaStyle} name="description" placeholder="Describe the item, service, or request in detail." />
            </FormField>
            <div className="mk-field-grid">
              <FormField label="Service Radius">
                <input style={inputStyle} name="serviceRadiusMiles" type="number" placeholder="20" defaultValue={selectedType.includes('service') ? '20' : ''} />
              </FormField>
              <FormField label="Availability Notes">
                <input style={inputStyle} name="availabilityNotes" placeholder="Weekend pickup only, evenings only, etc." />
              </FormField>
            </div>
            <button type="submit" style={submitButtonStyle}>Post Listing</button>
          </form>
        </MarketPanel>
      </div>
    </div>
  );
}

export async function MarketMessagesScreen(activeConversationId?: string) {
  const data = await getMessagesData(activeConversationId);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <MarketSectionHeading
        eyebrow="Marketplace Messages"
        title="Conversation list on the left, active thread on the right."
        subtitle="The thread surface keeps listing context, encrypted states, and quick replies visible together."
      />

      <div className="mk-sidebar-layout">
        <MarketPanel tone="mid" padding={18}>
          <div style={{ display: 'grid', gap: 12 }}>
            {data.conversations.map((conversation) => (
              <Link
                key={conversation.id}
                href={`/market/messages/${conversation.id}`}
                style={{
                  ...{
                    padding: 16,
                    borderRadius: 22,
                    background: data.activeConversation?.id === conversation.id ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                    display: 'grid',
                    gap: 8,
                  },
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <strong>{conversation.otherUser.name}</strong>
                  <span style={{ color: 'var(--market-text-tertiary)', fontSize: 12 }}>
                    {conversation.lastMessageAt ? formatRelativeTime(conversation.lastMessageAt) : 'new'}
                  </span>
                </div>
                <span style={{ color: 'var(--market-accent-light)', fontSize: 12, fontWeight: 700 }}>{conversation.listing?.title}</span>
                <span style={{ color: 'var(--market-text-secondary)', fontSize: 14 }}>
                  {conversation.preview}
                </span>
              </Link>
            ))}
          </div>
        </MarketPanel>

        {data.activeConversation ? (
          <MarketPanel tone="glass" padding={24}>
            <div style={{ display: 'grid', gap: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <div style={{ display: 'grid', gap: 4 }}>
                  <strong style={{ fontSize: 18 }}>{data.activeConversation.otherUser.name}</strong>
                  <span style={{ color: 'var(--market-text-secondary)', fontSize: 14 }}>
                    {data.activeConversation.listing?.title}
                  </span>
                </div>
                <MarketPill label="E2EE Ready" icon="lock" color="#8BCFF0" />
              </div>

              <div style={{ display: 'grid', gap: 14 }}>
                {data.messages.map((message) => {
                  const mine = message.senderId === '00000000-0000-4000-8000-000000000001';
                  return (
                    <div
                      key={message.id}
                      style={{
                        justifySelf: mine ? 'end' : 'start',
                        maxWidth: '72%',
                        padding: '14px 16px',
                        borderRadius: mine ? '20px 20px 8px 20px' : '20px 20px 20px 8px',
                        background: mine ? 'rgba(45,212,191,0.16)' : 'rgba(255,255,255,0.06)',
                      }}
                    >
                      <div style={{ display: 'grid', gap: 8 }}>
                        <span style={{ color: 'var(--market-text)', lineHeight: 1.6 }}>
                          {message.decryptedBody ?? message.body ?? 'Encrypted message'}
                        </span>
                        <span style={{ color: 'var(--market-text-tertiary)', fontSize: 12 }}>
                          {formatLongDate(message.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <form action={sendMessageAction} className="mk-form-grid">
                <input type="hidden" name="conversationId" value={data.activeConversation.id} />
                <FormField label="Reply">
                  <textarea style={textareaStyle} name="body" placeholder="Reply in thread" />
                </FormField>
                <div className="mk-field-grid">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--market-text-secondary)', fontSize: 14 }}>
                    <input type="checkbox" name="encrypted" />
                    Encrypt with the demo thread key
                  </label>
                  <FormField label="Passphrase">
                    <input style={inputStyle} name="passphrase" placeholder="market-demo-key" defaultValue="market-demo-key" />
                  </FormField>
                </div>
                <button type="submit" style={submitButtonStyle}>Send Reply</button>
              </form>
            </div>
          </MarketPanel>
        ) : (
          <MarketEmptyState title="No active thread" body="Start from a listing or select a conversation from the inbox rail." />
        )}
      </div>
    </div>
  );
}

export async function MarketProfileScreen(userId?: string) {
  const data = await getProfileData(userId);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <MarketPanel tone="glass" padding={28}>
        <div className="mk-split">
          <div style={{ display: 'grid', gap: 18 }}>
            <div className="mk-chip-row">
              <MarketVerificationPill level={data.seller.tier} />
              <MarketPill label={`${data.seller.responseRate * 100}% Response`} color="#8BCFF0" />
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <h1 style={{ margin: 0, fontSize: 36, lineHeight: 1.02, letterSpacing: '-0.05em' }}>{data.seller.name}</h1>
              <p style={{ margin: 0, color: 'var(--market-text-secondary)', lineHeight: 1.7 }}>{data.seller.bio}</p>
            </div>
            <div className="mk-chip-row">
              <SectionLink href={userId ? `/market/seller/${userId}` : '/market/profile'} label="Listings" active />
              <SectionLink href={userId ? `/market/reviews/${userId}` : `/market/reviews/${data.seller.id}`} label="Reviews" />
              <SectionLink href="/market/settings" label="About" />
            </div>
          </div>
          <div className="mk-grid-3">
            <MarketStatTile label="Completed Sales" value={String(data.seller.completedSales)} note="Successful closes" />
            <MarketStatTile label="Average Rating" value={data.seller.averageRating.toFixed(1)} note={`${data.seller.reviewCount} reviews`} accent="#FFB877" />
            <MarketStatTile label="Active Listings" value={String(data.listings.length)} note={data.seller.location} accent="#8BCFF0" />
          </div>
        </div>
      </MarketPanel>

      <div className="mk-split">
        <div>
          <MarketSectionHeading title="Listings" subtitle="Desktop cards for the seller inventory." />
          <div className="mk-grid-2">
            {data.listings.map((listing) => (
              <MarketListingCard
                key={listing.id}
                listing={listing}
                sellerName={data.seller.name}
                categoryName={listing.category.name}
                href={`/market/${listing.id}`}
              />
            ))}
          </div>
        </div>

        <MarketPanel tone="mid" padding={24}>
          <MarketSectionHeading title="Recent Reviews" subtitle={`${data.reviews.length} reviews across recent transactions.`} />
          <div style={{ display: 'grid', gap: 14 }}>
            {data.reviews.slice(0, 4).map((review) => (
              <MarketPanel key={review.id} tone="surface" padding={18}>
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <strong>{review.reviewerName}</strong>
                    <span style={{ color: '#FFB877' }}>{renderStars(review.rating)}</span>
                  </div>
                  <p style={{ margin: 0, color: 'var(--market-text-secondary)', lineHeight: 1.6 }}>{review.body}</p>
                </div>
              </MarketPanel>
            ))}
          </div>
        </MarketPanel>
      </div>
    </div>
  );
}

export async function MarketWatchlistScreen() {
  const listings = await getWatchlistData();

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <MarketSectionHeading title="Watchlist" subtitle="Table-style watch surface with price change indicators and quick actions." />
      {listings.length === 0 ? (
        <MarketEmptyState title="No saved listings" body="Heart a listing from browse to populate this watchlist surface." />
      ) : (
        <MarketPanel tone="glass" padding={24}>
          <table className="mk-table">
            <thead>
              <tr>
                <th>Listing</th>
                <th>Seller</th>
                <th>Price</th>
                <th>Delta</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((listing) => (
                <tr key={listing.id}>
                  <td>
                    <div style={{ display: 'grid', gap: 4 }}>
                      <Link href={`/market/${listing.id}`} style={{ color: 'var(--market-text)', fontWeight: 700 }}>{listing.title}</Link>
                      <span>{listing.category.name} / {listing.locationName}</span>
                    </div>
                  </td>
                  <td>{listing.seller.name}</td>
                  <td style={tableNumberStyle}>{formatCurrencyCents(listing.priceCents)}</td>
                  <td>
                    {listing.previousPriceCents && listing.priceCents ? (
                      <span style={{ color: '#FFB877', fontWeight: 700 }}>
                        {formatCurrencyCents(listing.previousPriceCents - listing.priceCents)} lower
                      </span>
                    ) : (
                      <span style={{ color: 'var(--market-text-tertiary)' }}>No change</span>
                    )}
                  </td>
                  <td>
                    <WatchToggleForm listingId={listing.id} returnTo="/market/watchlist" watched />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </MarketPanel>
      )}
    </div>
  );
}

export async function MarketSavedSearchesScreen() {
  const savedSearches = await getSavedSearchesData();

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <MarketSectionHeading title="Saved Searches" subtitle="Search presets with notification toggles and browse handoff." />
      <div className="mk-split">
        <MarketPanel tone="mid" padding={24}>
          <MarketSectionHeading title="Existing Searches" subtitle={`${savedSearches.length} saved filters synced to this device.`} />
          <div style={{ display: 'grid', gap: 14 }}>
            {savedSearches.map((item) => (
              <MarketPanel key={item.id} tone="surface" padding={18}>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <div style={{ display: 'grid', gap: 4 }}>
                      <strong>{item.name}</strong>
                      <span style={{ color: 'var(--market-text-secondary)', fontSize: 14 }}>{item.label}</span>
                    </div>
                    <form action={toggleSavedSearchAlertsAction}>
                      <input type="hidden" name="searchId" value={item.id} />
                      <button type="submit" style={secondaryButtonStyle}>
                        {item.notifyOnMatch ? 'Notifications on' : 'Notifications off'}
                      </button>
                    </form>
                  </div>
                  <div className="mk-chip-row">
                    <MarketPill label={`${item.matchCount} Matches`} color="#8BCFF0" />
                    <span style={{ color: 'var(--market-text-tertiary)', fontSize: 12 }}>{formatLongDate(item.createdAt)}</span>
                  </div>
                </div>
              </MarketPanel>
            ))}
          </div>
        </MarketPanel>

        <MarketPanel tone="glass" padding={24}>
          <MarketSectionHeading title="Create Search" subtitle="Save a new desktop query by hand." />
          <form action={saveSearchAction} className="mk-form-grid">
            <FormField label="Name">
              <input style={inputStyle} name="name" defaultValue="New market search" />
            </FormField>
            <FormField label="Query">
              <input style={inputStyle} name="query" placeholder="camera, chair, service, etc." />
            </FormField>
            <div className="mk-field-grid">
              <FormField label="Category">
                <select style={inputStyle} name="categoryId" defaultValue="">
                  <option value="">Any</option>
                  <CategoryOptions />
                </select>
              </FormField>
              <FormField label="Label">
                <input style={inputStyle} name="label" defaultValue="Created from saved searches" />
              </FormField>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--market-text-secondary)', fontSize: 14 }}>
              <input type="checkbox" name="notifyOnMatch" defaultChecked />
              Email or push me when new matches land
            </label>
            <button type="submit" style={submitButtonStyle}>Save Search</button>
          </form>
        </MarketPanel>
      </div>
    </div>
  );
}

export async function MarketReviewsScreen(sellerId: string) {
  const data = await getReviewsData(sellerId);
  const buckets = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: data.reviews.filter((review) => review.rating === rating).length,
  }));

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <MarketSectionHeading title={`${data.seller.name} Reviews`} subtitle="Histogram plus the latest written feedback." />
      <div className="mk-split">
        <MarketPanel tone="mid" padding={24}>
          <MarketSectionHeading title="Rating Distribution" subtitle={`${data.reviews.length} reviews on record.`} />
          <div style={{ display: 'grid', gap: 14 }}>
            {buckets.map((bucket) => (
              <div key={bucket.rating} style={{ display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span>{bucket.rating} stars</span>
                  <span style={{ color: 'var(--market-text-tertiary)' }}>{bucket.count}</span>
                </div>
                <div style={{ height: 10, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${data.reviews.length === 0 ? 0 : (bucket.count / data.reviews.length) * 100}%`, background: 'linear-gradient(135deg, #FFB877, #14B8A6)' }} />
                </div>
              </div>
            ))}
          </div>
        </MarketPanel>

        <MarketPanel tone="glass" padding={24}>
          <MarketSectionHeading title="Written Feedback" subtitle="Newest first." />
          <div style={{ display: 'grid', gap: 14 }}>
            {data.reviews.map((review) => (
              <MarketPanel key={review.id} tone="surface" padding={18}>
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <strong>{review.reviewerName}</strong>
                    <span style={{ color: '#FFB877' }}>{renderStars(review.rating)}</span>
                  </div>
                  <p style={{ margin: 0, color: 'var(--market-text-secondary)', lineHeight: 1.6 }}>{review.body}</p>
                  <span style={{ color: 'var(--market-text-tertiary)', fontSize: 12 }}>{formatLongDate(review.createdAt)}</span>
                </div>
              </MarketPanel>
            ))}
          </div>
        </MarketPanel>
      </div>
    </div>
  );
}

export async function MarketOffersScreen(tab?: string) {
  const offers = await getOffersData(tab);
  const activeTab = tab ?? 'sent';

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <MarketSectionHeading title="Offers" subtitle="Sent, received, active, and historical offers in one desktop flow." />
      <div className="mk-chip-row">
        <SectionLink href="/market/offers?tab=sent" label="Sent" active={activeTab === 'sent'} />
        <SectionLink href="/market/offers?tab=received" label="Received" active={activeTab === 'received'} />
        <SectionLink href="/market/offers?tab=active" label="Active" active={activeTab === 'active'} />
        <SectionLink href="/market/offers?tab=history" label="History" active={activeTab === 'history'} />
      </div>
      {offers.length === 0 ? (
        <MarketEmptyState title="No offers here yet" body="Switch tabs or make an offer from a listing detail page." />
      ) : (
        <div className="mk-grid-2">
          {offers.map((offer) => (
            <MarketPanel key={offer.id} tone="glass" padding={22}>
              <div style={{ display: 'grid', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <strong style={{ fontSize: 18 }}>{offer.listing?.title ?? 'Listing unavailable'}</strong>
                    <span style={{ color: 'var(--market-text-secondary)', fontSize: 14 }}>
                      {offer.buyer.name} to {offer.seller.name}
                    </span>
                  </div>
                  <MarketPill label={offer.status.replace(/_/g, ' ')} color={offer.status === 'accepted' ? '#30D158' : offer.status === 'rejected' ? '#FF7A7A' : offer.status === 'countered' ? '#8BCFF0' : '#FFB877'} />
                </div>
                <div className="mk-chip-row">
                  <span style={{ color: 'var(--market-accent-light)', fontSize: 26, fontWeight: 900 }}>{formatCurrencyCents(offer.amountCents)}</span>
                  {offer.counterAmountCents ? <span style={{ color: '#8BCFF0', fontWeight: 700 }}>Counter {formatCurrencyCents(offer.counterAmountCents)}</span> : null}
                </div>
                <p style={{ margin: 0, color: 'var(--market-text-secondary)', lineHeight: 1.6 }}>{offer.message}</p>
                {activeTab === 'received' && offer.status === 'pending' ? (
                  <div className="mk-field-grid">
                    <form action={respondToOfferAction}>
                      <input type="hidden" name="offerId" value={offer.id} />
                      <input type="hidden" name="action" value="accept" />
                      <button type="submit" style={submitButtonStyle}>Accept</button>
                    </form>
                    <form action={respondToOfferAction}>
                      <input type="hidden" name="offerId" value={offer.id} />
                      <input type="hidden" name="action" value="reject" />
                      <button type="submit" style={secondaryButtonStyle}>Reject</button>
                    </form>
                  </div>
                ) : null}
                {activeTab === 'received' && offer.status === 'pending' ? (
                  <form action={respondToOfferAction} className="mk-form-grid">
                    <input type="hidden" name="offerId" value={offer.id} />
                    <input type="hidden" name="action" value="counter" />
                    <FormField label="Counter Amount">
                      <input style={inputStyle} name="counterAmount" type="number" step="0.01" defaultValue={((offer.amountCents ?? 0) / 100).toFixed(2)} />
                    </FormField>
                    <button type="submit" style={secondaryButtonStyle}>Send Counter</button>
                  </form>
                ) : null}
              </div>
            </MarketPanel>
          ))}
        </div>
      )}
    </div>
  );
}

export async function MarketCheckoutScreen({
  params,
}: {
  params: Record<string, string | string[] | undefined>;
}) {
  const listingId = readFirstParam(params.listingId);
  const data = await getCheckoutData(listingId);
  if (!data) notFound();
  const total = data.subtotalCents + data.feeCents + data.shippingCents;

  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 1280 }}>
      <MarketSectionHeading title="Checkout" subtitle="Three-step desktop flow with summary sidebar and escrow notice." />
      <div className="mk-detail-grid">
        <div style={{ display: 'grid', gap: 18 }}>
          <MarketPanel tone="glass" padding={22}>
            <div className="mk-chip-row">
              <MarketPill label="1 / Review" filled color="#2DD4BF" />
              <MarketPill label="2 / Payment" color="#8BCFF0" />
              <MarketPill label="3 / Confirm" color="#FFB877" />
            </div>
          </MarketPanel>

          <MarketPanel tone="mid" padding={24}>
            <MarketSectionHeading title="Order Summary" subtitle="Selected listing and desktop payment surface." />
            <div style={{ display: 'grid', gap: 18 }}>
              <div style={{ display: 'grid', gap: 10 }}>
                <strong style={{ fontSize: 19 }}>{data.listing.title}</strong>
                <span style={{ color: 'var(--market-text-secondary)' }}>{data.seller.name} / {data.listing.locationName}</span>
              </div>
              <div
                style={{
                  borderRadius: 24,
                  background: 'rgba(255,255,255,0.05)',
                  padding: 18,
                  display: 'grid',
                  gap: 12,
                }}
              >
                <span style={labelStyle}>Payment Method</span>
                {data.paymentMethods.map((method, index) => (
                  <label key={method.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 14, borderRadius: 18, background: index === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)' }}>
                    <input type="radio" name="paymentMethodPreview" defaultChecked={index === 0} />
                    <div style={{ display: 'grid', gap: 4 }}>
                      <strong>{method.label}</strong>
                      <span style={{ color: 'var(--market-text-secondary)', fontSize: 13 }}>{method.detail}</span>
                    </div>
                  </label>
                ))}
                <div style={{ borderRadius: 22, background: 'rgba(20,184,166,0.08)', padding: 16, display: 'grid', gap: 8 }}>
                  <span style={labelStyle}>Stripe Elements Zone</span>
                  <span style={{ color: 'var(--market-text-secondary)', fontSize: 14 }}>
                    This desktop route reserves the payment method region and completes through the local cache-backed checkout action when live Stripe keys are absent.
                  </span>
                </div>
              </div>
            </div>
          </MarketPanel>
        </div>

        <MarketPanel tone="glass" padding={24}>
          <MarketSectionHeading title="Totals" subtitle="Escrow and fee breakdown." />
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--market-text-secondary)' }}>Subtotal</span><strong>{formatCurrencyCents(data.subtotalCents)}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--market-text-secondary)' }}>Platform fee</span><strong>{formatCurrencyCents(data.feeCents)}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--market-text-secondary)' }}>Shipping</span><strong>{formatCurrencyCents(data.shippingCents)}</strong></div>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.08)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--market-text)' }}>Total</span>
              <strong style={{ fontSize: 28 }}>{formatCurrencyCents(total)}</strong>
            </div>
            <div style={{ borderRadius: 22, padding: 16, background: 'rgba(20,184,166,0.08)' }}>
              <div style={{ display: 'grid', gap: 8 }}>
                <span style={labelStyle}>Secure Escrow</span>
                <span style={{ color: 'var(--market-text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
                  Funds stay held until delivery confirms or buyer protection closes cleanly.
                </span>
              </div>
            </div>
            <form action={processCheckoutAction}>
              <input type="hidden" name="listingId" value={data.listing.id} />
              <button type="submit" style={{ ...submitButtonStyle, width: '100%' }}>
                Pay {formatCurrencyCents(total)}
              </button>
            </form>
          </div>
        </MarketPanel>
      </div>
    </div>
  );
}

export async function MarketOrdersScreen() {
  const orders = await getOrdersData();

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <MarketSectionHeading title="Orders" subtitle="Shipment list and delivery context in one route." />
      {orders.length === 0 ? (
        <MarketEmptyState title="No orders yet" body="Complete a checkout to create the first order tracking timeline." />
      ) : (
        <div className="mk-grid-2">
          {orders.map((order) => (
            <MarketPanel key={order.payment.id} tone="glass" padding={22}>
              <div style={{ display: 'grid', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <strong style={{ fontSize: 18 }}>{order.listing?.title ?? 'Order'}</strong>
                    <span style={{ color: 'var(--market-text-secondary)', fontSize: 14 }}>
                      {order.seller.name} to {order.buyer.name}
                    </span>
                  </div>
                  <MarketPill label={order.shipment?.status.replace(/_/g, ' ') ?? 'pending'} color={order.shipment?.status === 'delivered' ? '#30D158' : '#8BCFF0'} />
                </div>
                <div className="mk-chip-row">
                  <span style={{ color: 'var(--market-accent-light)', fontWeight: 900, fontSize: 24 }}>{formatCurrencyCents(order.payment.amountCents)}</span>
                  <span style={{ color: 'var(--market-text-tertiary)', fontSize: 13 }}>{order.shipment?.carrier.toUpperCase()} / {order.shipment?.trackingNumber}</span>
                </div>
                <Link href={`/market/orders/${order.payment.id}`} style={{ color: 'var(--market-text)', fontWeight: 700 }}>
                  View tracking timeline
                </Link>
              </div>
            </MarketPanel>
          ))}
        </div>
      )}
    </div>
  );
}

export async function MarketOrderDetailScreen(paymentId: string) {
  const data = await getOrderDetailData(paymentId);
  if (!data) notFound();

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <MarketSectionHeading title="Order Tracking" subtitle={`${data.listing?.title ?? 'Order'} / ${data.shipment?.trackingNumber ?? 'tracking pending'}`} />
      <div className="mk-detail-grid">
        <MarketPanel tone="glass" padding={24}>
          <MarketSectionHeading title="Timeline" subtitle="Carrier milestones and delivery notes." />
          <MarketTimeline
            items={data.events.map((event) => ({
              title: event.status.replace(/_/g, ' '),
              subtitle: `${event.description}${event.location ? ` / ${event.location}` : ''}`,
              date: event.occurredAt,
              accent: event.status === 'delivered' ? '#30D158' : '#8BCFF0',
            }))}
          />
        </MarketPanel>

        <MarketPanel tone="mid" padding={24}>
          <MarketSectionHeading title="Order Summary" subtitle="Map placeholder, escrow state, and next step." />
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ borderRadius: 24, minHeight: 220, background: 'rgba(255,255,255,0.05)', display: 'grid', placeItems: 'center' }}>
              <div style={{ display: 'grid', gap: 10, justifyItems: 'center' }}>
                <MarketIcon name="map" color="var(--market-accent-light)" size={42} />
                <span style={{ color: 'var(--market-text-secondary)' }}>Delivery map placeholder</span>
              </div>
            </div>
            <div className="mk-chip-row">
              <MarketPill label={data.payment.status.replace(/_/g, ' ')} color={data.payment.status === 'disputed' ? '#FF7A7A' : '#8BCFF0'} />
              {data.shipment ? <MarketPill label={data.shipment.carrier.toUpperCase()} color="#FFB877" /> : null}
            </div>
            {data.payment.status === 'disputed' ? (
              <Link href="/market/disputes" style={{ ...secondaryButtonStyle, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                View dispute
              </Link>
            ) : null}
          </div>
        </MarketPanel>
      </div>
    </div>
  );
}

export async function MarketDisputesScreen() {
  const disputes = await getDisputesData();
  const orderChoices = (await getOrdersData()).filter((order) => order.payment.status !== 'disputed');

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <MarketSectionHeading title="Disputes" subtitle="Case list plus the desktop entry point for opening a new dispute." />
      <div className="mk-split">
        <MarketPanel tone="mid" padding={24}>
          <MarketSectionHeading title="Open Cases" subtitle={`${disputes.length} cases currently visible.`} />
          <div style={{ display: 'grid', gap: 14 }}>
            {disputes.map((entry) => (
              <Link
                key={entry.dispute.id}
                href={`/market/disputes/${entry.dispute.id}`}
                style={{
                  ...{
                    borderRadius: 24,
                    padding: 18,
                    background: 'rgba(255,255,255,0.05)',
                    display: 'grid',
                    gap: 10,
                  },
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <strong>{entry.listing?.title ?? 'Dispute'}</strong>
                  <MarketPill label={entry.dispute.status.replace(/_/g, ' ')} color={entry.dispute.status === 'open' ? '#FFB877' : '#8BCFF0'} />
                </div>
                <p style={{ margin: 0, color: 'var(--market-text-secondary)', lineHeight: 1.6 }}>{entry.dispute.description}</p>
                <span style={{ color: 'var(--market-text-tertiary)', fontSize: 12 }}>{formatLongDate(entry.dispute.filedAt)}</span>
              </Link>
            ))}
          </div>
        </MarketPanel>

        <MarketPanel tone="glass" padding={24}>
          <MarketSectionHeading title="Open New Dispute" subtitle="File against any existing order." />
          <form action={submitDisputeAction} className="mk-form-grid">
            <FormField label="Order">
              <select style={inputStyle} name="paymentId" defaultValue={orderChoices[0]?.payment.id ?? ''}>
                {orderChoices.map((order) => (
                  <option key={order.payment.id} value={order.payment.id}>
                    {order.listing?.title ?? order.payment.id}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Reason">
              <select style={inputStyle} name="reason" defaultValue="item_not_as_described">
                <option value="item_not_received">Item not received</option>
                <option value="item_not_as_described">Item not as described</option>
                <option value="item_damaged">Item damaged</option>
                <option value="wrong_item">Wrong item</option>
                <option value="counterfeit">Counterfeit</option>
                <option value="other">Other</option>
              </select>
            </FormField>
            <FormField label="Details">
              <textarea style={textareaStyle} name="description" placeholder="Describe the issue with enough detail for the seller and support review." />
            </FormField>
            <button type="submit" style={submitButtonStyle}>Open Dispute</button>
          </form>
        </MarketPanel>
      </div>
    </div>
  );
}

export async function MarketDisputeDetailScreen(disputeId: string) {
  const data = await getDisputeDetailData(disputeId);
  if (!data) notFound();

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <MarketSectionHeading title="Dispute Detail" subtitle={`${data.listing?.title ?? 'Case'} / ${data.dispute.reason.replace(/_/g, ' ')}`} />
      <div className="mk-detail-grid">
        <div style={{ display: 'grid', gap: 18 }}>
          <MarketPanel tone="glass" padding={24}>
            <MarketSectionHeading title="Evidence Grid" subtitle="Attached evidence and notes." />
            <div className="mk-grid-2">
              {data.evidence.map((item) => (
                <MarketPanel key={item.id} tone="surface" padding={18}>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <strong>{item.label}</strong>
                    <span style={{ color: 'var(--market-text-secondary)', lineHeight: 1.6 }}>{item.caption}</span>
                    <span style={{ color: 'var(--market-text-tertiary)', fontSize: 12 }}>{formatLongDate(item.createdAt)}</span>
                  </div>
                </MarketPanel>
              ))}
            </div>
          </MarketPanel>

          <MarketPanel tone="mid" padding={24}>
            <MarketSectionHeading title="Thread" subtitle="Desktop dispute thread with quick replies." />
            <div style={{ display: 'grid', gap: 14 }}>
              {data.messages.map((message) => (
                <MarketPanel key={message.id} tone="surface" padding={18}>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <strong>{message.senderName}</strong>
                    <p style={{ margin: 0, color: 'var(--market-text-secondary)', lineHeight: 1.6 }}>{message.body}</p>
                    <span style={{ color: 'var(--market-text-tertiary)', fontSize: 12 }}>{formatLongDate(message.createdAt)}</span>
                  </div>
                </MarketPanel>
              ))}
            </div>
            <form action={addDisputeMessageAction} className="mk-form-grid" style={{ marginTop: 18 }}>
              <input type="hidden" name="disputeId" value={data.dispute.id} />
              <FormField label="Reply">
                <textarea style={textareaStyle} name="body" placeholder="Add a dispute update or response." />
              </FormField>
              <button type="submit" style={submitButtonStyle}>Post Reply</button>
            </form>
          </MarketPanel>
        </div>

        <MarketPanel tone="glass" padding={24}>
          <MarketSectionHeading title="Case Summary" subtitle="Current state, participants, and resolution window." />
          <div style={{ display: 'grid', gap: 16 }}>
            <div className="mk-chip-row">
              <MarketPill label={data.dispute.status.replace(/_/g, ' ')} color="#FFB877" />
              <MarketPill label={formatCurrencyCents(data.payment?.amountCents ?? 0)} color="#8BCFF0" />
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <strong>{data.listing?.title}</strong>
              <span style={{ color: 'var(--market-text-secondary)' }}>
                Buyer {data.buyer.name} / Seller {data.seller.name}
              </span>
            </div>
            <p style={{ margin: 0, color: 'var(--market-text-secondary)', lineHeight: 1.6 }}>{data.dispute.description}</p>
            <div style={{ display: 'grid', gap: 6 }}>
              <span style={labelStyle}>Response deadline</span>
              <strong>{formatLongDate(data.dispute.sellerResponseDeadline)}</strong>
            </div>
          </div>
        </MarketPanel>
      </div>
    </div>
  );
}

export async function MarketServicesScreen(tab?: string) {
  const activeTab = tab ?? 'browse';
  const services = await getServicesData(activeTab === 'mine' ? 'mine' : activeTab === 'requests' ? 'requests' : 'browse');

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <MarketSectionHeading title="Services" subtitle="Three-tab desktop surface for browse, your services, and requests." />
      <div className="mk-chip-row">
        <SectionLink href="/market/services?tab=browse" label="Browse" active={activeTab === 'browse'} />
        <SectionLink href="/market/services?tab=mine" label="My Services" active={activeTab === 'mine'} />
        <SectionLink href="/market/services?tab=requests" label="Requests" active={activeTab === 'requests'} />
      </div>
      {services.length === 0 ? (
        <MarketEmptyState title="No services in this segment" body="Switch service tabs or create a new service listing." action={<MarketButton href="/market/sell?type=service_offer" secondary>Create Service</MarketButton>} />
      ) : (
        <div className="mk-grid-3">
          {services.map((service) => (
            <MarketPanel key={service.listing.id} tone="glass" padding={22}>
              <div style={{ display: 'grid', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <strong>{service.listing.title}</strong>
                  <MarketVerificationPill level={service.seller.tier} />
                </div>
                <p style={{ margin: 0, color: 'var(--market-text-secondary)', lineHeight: 1.6 }}>{service.listing.description}</p>
                <div className="mk-chip-row">
                  <MarketPill label={formatCurrencyCents(service.listing.priceCents)} color="#FFB877" />
                  <MarketPill label={service.listing.fulfillmentType ?? 'remote'} color="#8BCFF0" />
                </div>
                <span style={{ color: 'var(--market-text-tertiary)', fontSize: 13 }}>
                  {service.availability.length > 0 ? `${service.availability.length} availability blocks` : 'Availability on request'}
                </span>
              </div>
            </MarketPanel>
          ))}
        </div>
      )}
    </div>
  );
}

export async function MarketReportScreen({
  params,
}: {
  params: Record<string, string | string[] | undefined>;
}) {
  const listingId = readFirstParam(params.listing) ?? '';
  const userId = readFirstParam(params.user) ?? '';

  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 1024 }}>
      <MarketPanel tone="glass" padding={24}>
        <MarketSectionHeading
          title="Report Safety Issue"
          subtitle="Desktop report modal translated into a full route with reason picker and optional block action."
        />
        <form action={submitReportAction} className="mk-form-grid">
          <input type="hidden" name="listingId" value={listingId} />
          <input type="hidden" name="userId" value={userId} />
          <FormField label="Reason">
            <select style={inputStyle} name="reason" defaultValue="fraud">
              <option value="spam">Spam</option>
              <option value="prohibited_item">Prohibited item</option>
              <option value="fraud">Fraud</option>
              <option value="offensive">Offensive content</option>
              <option value="duplicate">Duplicate listing</option>
              <option value="other">Other</option>
            </select>
          </FormField>
          <FormField label="Details">
            <textarea style={textareaStyle} name="details" placeholder="Describe what happened and attach enough context for review." />
          </FormField>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--market-text-secondary)', fontSize: 14 }}>
            <input type="checkbox" name="blockUser" />
            Also block this seller or buyer from contacting me
          </label>
          <button type="submit" style={submitButtonStyle}>Submit Report</button>
        </form>
      </MarketPanel>
    </div>
  );
}

export async function MarketSettingsScreen({
  params,
}: {
  params: Record<string, string | string[] | undefined>;
}) {
  const activeSection = readFirstParam(params.section) ?? 'account';
  const data = await getSettingsData();

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <MarketSectionHeading title="Marketplace Settings" subtitle="Two-column desktop settings surface with section rail and content pane." />
      <div className="mk-sidebar-layout">
        <MarketPanel tone="mid" padding={18}>
          <div style={{ display: 'grid', gap: 10 }}>
            {[
              ['account', 'Account'],
              ['notifications', 'Notifications'],
              ['payment-methods', 'Payment Methods'],
              ['privacy', 'Privacy'],
              ['verification', 'Verification'],
              ['blocked-users', 'Blocked Users'],
              ['data', 'Data'],
              ['about', 'About'],
            ].map(([value, label]) => (
              <SectionLink key={value} href={`/market/settings?section=${value}`} label={label} active={activeSection === value} />
            ))}
          </div>
        </MarketPanel>

        <div style={{ display: 'grid', gap: 18 }}>
          <MarketPanel tone="glass" padding={24}>
            <MarketSectionHeading title="Quick Toggles" subtitle="Notification, privacy, and payments grouped into glass cards." />
            <div className="mk-grid-2">
              {data.settings.map((setting) => (
                <MarketPanel key={setting.key} tone="surface" padding={18}>
                  <form action={updateSettingAction} className="mk-form-grid">
                    <input type="hidden" name="key" value={setting.key} />
                    <input type="hidden" name="section" value={activeSection} />
                    <span style={labelStyle}>{setting.key.replace(/_/g, ' ')}</span>
                    <input style={inputStyle} name="value" defaultValue={setting.value} />
                    <button type="submit" style={secondaryButtonStyle}>Save</button>
                  </form>
                </MarketPanel>
              ))}
            </div>
          </MarketPanel>

          <MarketPanel tone="mid" padding={24}>
            <MarketSectionHeading title="Blocked Users" subtitle={`${data.blocks.length} accounts currently blocked.`} />
            <div style={{ display: 'grid', gap: 12 }}>
              {data.blocks.map((block) => (
                <MarketPanel key={block.id} tone="surface" padding={18}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <div style={{ display: 'grid', gap: 4 }}>
                      <strong>{block.blockedName}</strong>
                      <span style={{ color: 'var(--market-text-tertiary)', fontSize: 12 }}>{formatLongDate(block.createdAt)}</span>
                    </div>
                    <form action={toggleBlockUserAction}>
                      <input type="hidden" name="blockedId" value={block.blockedId} />
                      <input type="hidden" name="blockedName" value={block.blockedName} />
                      <button type="submit" style={secondaryButtonStyle}>Unblock</button>
                    </form>
                  </div>
                </MarketPanel>
              ))}
            </div>
          </MarketPanel>
        </div>
      </div>
    </div>
  );
}
