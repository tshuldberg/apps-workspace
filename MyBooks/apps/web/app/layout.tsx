import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MyBooks — Your reading list. Not Amazon\'s ad profile.',
  description:
    'Private, local-first book tracking. Library management, reading goals, stats, and year-in-review. No accounts, no cloud, no telemetry. Powered by Open Library.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
