// ── JSON-LD Structured Data Components ───────────────────────────────────────
// These components render invisible <script type="application/ld+json"> tags
// for search engine structured data. They are safe to use in both server and
// client components — no interactivity required.

// ── IdeaJsonLd ───────────────────────────────────────────────────────────────

export interface IdeaJsonLdProps {
  title: string
  body: string
  author: string
  datePublished: string
  dateModified: string
  symbol: string
  url: string
  image?: string
}

/**
 * Outputs an Article JSON-LD script tag for a trading idea.
 * Helps search engines understand the content as a financial analysis article.
 */
export function IdeaJsonLd({
  title,
  body,
  author,
  datePublished,
  dateModified,
  symbol,
  url,
  image,
}: IdeaJsonLdProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: body.slice(0, 200).replace(/[#*\n]/g, ' ').trim(),
    author: {
      '@type': 'Person',
      name: author,
    },
    datePublished,
    dateModified,
    publisher: {
      '@type': 'Organization',
      name: 'MarlinTraders',
      url: 'https://marlintraders.com',
      logo: {
        '@type': 'ImageObject',
        url: 'https://marlintraders.com/logo.png',
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
    about: {
      '@type': 'FinancialProduct',
      name: symbol,
    },
    ...(image ? { image } : {}),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

// ── OrganizationJsonLd ───────────────────────────────────────────────────────

export interface OrganizationJsonLdProps {
  name?: string
  url?: string
  logoUrl?: string
  description?: string
  sameAs?: string[]
}

/**
 * Outputs an Organization JSON-LD script tag for the main site.
 * Place this in the root layout or homepage.
 */
export function OrganizationJsonLd({
  name = 'MarlinTraders',
  url = 'https://marlintraders.com',
  logoUrl = 'https://marlintraders.com/logo.png',
  description = 'All-in-one trading platform — charting, strategy development, execution, journaling, and community. Powered by AI, priced for humans.',
  sameAs = [
    'https://twitter.com/MarlinTraders',
    'https://github.com/MarlinTraders',
  ],
}: OrganizationJsonLdProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name,
    url,
    logo: logoUrl,
    description,
    sameAs,
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

// ── WebSiteJsonLd ────────────────────────────────────────────────────────────

export interface WebSiteJsonLdProps {
  name?: string
  url?: string
  searchUrl?: string
}

/**
 * Outputs a WebSite JSON-LD script tag with a SearchAction.
 * Enables sitelinks search box in Google results.
 * Place this in the root layout.
 */
export function WebSiteJsonLd({
  name = 'MarlinTraders',
  url = 'https://marlintraders.com',
  searchUrl = 'https://marlintraders.com/search?q={search_term_string}',
}: WebSiteJsonLdProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    url,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: searchUrl,
      },
      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}
