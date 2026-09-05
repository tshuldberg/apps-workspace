import { notFound } from 'next/navigation';
import type { Memorabilia } from '@mylife/sports';
import { sportsGetMemorabilia } from '../../../actions';
import { AddMemorabiliaClient } from './AddMemorabiliaClient';

export const dynamic = 'force-dynamic';

export default async function SportsMemorabiliaAddPage(props: {
  searchParams: Promise<{ editId?: string }>;
}) {
  const { editId } = await props.searchParams;
  let existing: Memorabilia | null = null;
  if (editId) {
    const res = await sportsGetMemorabilia(editId);
    if (!res.ok) notFound();
    existing = res.row;
  }
  return <AddMemorabiliaClient existing={existing} />;
}
