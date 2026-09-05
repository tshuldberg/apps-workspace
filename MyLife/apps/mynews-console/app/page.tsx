import { redirect } from 'next/navigation';

import { requireModerator } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  await requireModerator();
  redirect('/queue');
}
