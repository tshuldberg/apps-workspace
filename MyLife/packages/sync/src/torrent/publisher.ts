/**
 * Content publishing flow.
 *
 * Handles creating a manifest from local files, storing it in the
 * database, and preparing the content for seeding.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { ContentAccess, ContentCategory, ContentManifest } from '../types';
import { createManifest, type ManifestFile } from './manifest';
import { insertPublishedContent } from '../db/queries';

export interface PublishOptions {
  db: DatabaseAdapter;
  title: string;
  description: string;
  files: ManifestFile[];
  access: ContentAccess;
  category: ContentCategory;
  tags: string[];
  creatorPublicKey: string;
  creatorDisplayName: string;
  creatorPrivateKey: string;
  price?: { amount: number; currency: string; paymentMethods: string[] };
  trackers?: string[];
  webSeeds?: string[];
  /** Symmetric content key for encrypting paid/encrypted content. */
  contentKey?: string;
}

export interface PublishResult {
  manifest: ContentManifest;
  infoHash: string;
  shareLink: string;
  deepLink: string;
}

/**
 * Publish content to the P2P network.
 *
 * Creates a manifest, persists it to the database, and returns
 * shareable links for distribution.
 */
export function publishContent(options: PublishOptions): PublishResult {
  const manifest = createManifest({
    title: options.title,
    description: options.description,
    files: options.files,
    access: options.access,
    category: options.category,
    tags: options.tags,
    creatorPublicKey: options.creatorPublicKey,
    creatorDisplayName: options.creatorDisplayName,
    creatorPrivateKey: options.creatorPrivateKey,
    price: options.price,
    trackers: options.trackers,
    webSeeds: options.webSeeds,
  });

  // Store in database
  insertPublishedContent(options.db, manifest, options.contentKey);

  // Generate links
  const shareLink = `https://share.mylife.app/t/${manifest.infoHash}`;
  const deepLink = `mylife://t/${manifest.infoHash}`;

  return {
    manifest,
    infoHash: manifest.infoHash,
    shareLink,
    deepLink,
  };
}

/**
 * Generate a magnet-style URI for a manifest.
 */
export function generateMagnetUri(manifest: ContentManifest): string {
  const params = new URLSearchParams();
  params.set('xt', `urn:mylife:${manifest.infoHash}`);
  params.set('dn', manifest.title);
  for (const tracker of manifest.trackers) {
    params.append('tr', tracker);
  }
  return `magnet:?${params.toString()}`;
}
