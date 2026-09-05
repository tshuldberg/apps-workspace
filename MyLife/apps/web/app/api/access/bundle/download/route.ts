import { promises as fs } from 'node:fs';
import { basename } from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import {
  isBundleTokenExpired,
  resolveBundleZipPath,
  verifySignedBundleToken,
} from '@/lib/access/bundle';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'Missing token query parameter.' }, { status: 400 });
  }

  const secret = process.env.MYLIFE_BUNDLE_SIGNING_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Bundle signing secret is not configured.' }, { status: 500 });
  }

  const verified = verifySignedBundleToken(token, secret);
  if (!verified.ok || !verified.payload) {
    return NextResponse.json({ error: 'Invalid bundle token.', reason: verified.reason }, { status: 401 });
  }

  if (isBundleTokenExpired(verified.payload)) {
    return NextResponse.json({ error: 'Bundle token is expired.' }, { status: 410 });
  }

  const filePath = resolveBundleZipPath(verified.payload.bundleId);
  if (!filePath) {
    return NextResponse.json({ error: 'Invalid bundle id.' }, { status: 400 });
  }

  let fileBuffer: Buffer;
  try {
    fileBuffer = await fs.readFile(filePath);
  } catch {
    return NextResponse.json({ error: 'Bundle file not found.', bundleId: verified.payload.bundleId }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(fileBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${basename(filePath)}"`,
      'Cache-Control': 'private, no-store, max-age=0',
    },
  });
}
