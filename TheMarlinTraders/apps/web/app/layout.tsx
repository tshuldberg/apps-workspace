import type { Metadata } from 'next'
import { inter, jetbrainsMono } from './fonts'
import { Providers } from './providers'
import { OrganizationJsonLd, WebSiteJsonLd } from '@marlin/ui/seo/json-ld'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'MarlinTraders — All-in-One Trading Platform',
    template: '%s | MarlinTraders',
  },
  description:
    'Charting, strategy development, execution, journaling, and community — powered by AI, priced for humans.',
  metadataBase: new URL('https://marlintraders.com'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://marlintraders.com',
    siteName: 'MarlinTraders',
    title: 'MarlinTraders — All-in-One Trading Platform',
    description:
      'Charting, strategy development, execution, journaling, and community — powered by AI, priced for humans.',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@MarlinTraders',
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: '/',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-navy-black font-sans text-text-primary antialiased">
        <OrganizationJsonLd />
        <WebSiteJsonLd />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
