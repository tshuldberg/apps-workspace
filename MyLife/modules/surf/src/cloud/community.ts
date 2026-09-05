import type { SupabaseClient } from '@supabase/supabase-js';
import type { SpotReview, SpotPhoto } from '../types';

interface SpotPhotoRow {
  id: string;
  spot_id: string;
  review_id: string | null;
  user_id: string;
  image_url: string;
  caption: string | null;
  latitude: number | null;
  longitude: number | null;
  taken_at: string | null;
  created_at: string;
}

interface SpotReviewRow {
  id: string;
  spot_id: string;
  user_id: string;
  rating: number;
  title: string | null;
  body: string;
  created_at: string;
  updated_at: string;
  spot_photos?: SpotPhotoRow[];
}

function mapPhoto(row: SpotPhotoRow): SpotPhoto {
  return {
    id: row.id,
    spotId: row.spot_id,
    reviewId: row.review_id ?? undefined,
    userId: row.user_id,
    imageUrl: row.image_url,
    caption: row.caption ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    takenAt: row.taken_at ?? undefined,
    createdAt: row.created_at,
  };
}

function mapReview(row: SpotReviewRow): SpotReview {
  return {
    id: row.id,
    spotId: row.spot_id,
    userId: row.user_id,
    rating: row.rating,
    title: row.title ?? undefined,
    body: row.body,
    photoCount: row.spot_photos?.length ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function cloudGetSpotReviews(
  client: SupabaseClient,
  spotId: string,
  limit: number = 30,
): Promise<Array<SpotReview & { photos: SpotPhoto[] }>> {
  const { data, error } = await client
    .from('spot_reviews')
    .select('*, spot_photos(*)')
    .eq('spot_id', spotId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data as SpotReviewRow[]).map((review) => ({
    ...mapReview(review),
    photos: (review.spot_photos ?? []).map(mapPhoto),
  }));
}

export async function cloudGetSpotPhotos(
  client: SupabaseClient,
  spotId: string,
  limit: number = 60,
): Promise<SpotPhoto[]> {
  const { data, error } = await client
    .from('spot_photos')
    .select('*')
    .eq('spot_id', spotId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as SpotPhotoRow[]).map(mapPhoto);
}

export async function cloudCreateSpotReview(
  client: SupabaseClient,
  input: {
    spotId: string;
    userId: string;
    rating: number;
    body: string;
    title?: string;
    photos?: Array<{
      imageUrl: string;
      caption?: string;
      latitude?: number;
      longitude?: number;
    }>;
  },
): Promise<{ id: string }> {
  const { data: reviewRow, error: reviewError } = await client
    .from('spot_reviews')
    .insert({
      spot_id: input.spotId,
      user_id: input.userId,
      rating: input.rating,
      title: input.title ?? null,
      body: input.body,
    })
    .select('id')
    .single();

  if (reviewError) throw reviewError;

  if (input.photos?.length) {
    const { error: photosError } = await client.from('spot_photos').insert(
      input.photos.map((photo) => ({
        spot_id: input.spotId,
        review_id: reviewRow.id,
        user_id: input.userId,
        image_url: photo.imageUrl,
        caption: photo.caption ?? null,
        latitude: photo.latitude ?? null,
        longitude: photo.longitude ?? null,
      })),
    );
    if (photosError) throw photosError;
  }

  return { id: reviewRow.id as string };
}

export async function cloudDeleteSpotReview(
  client: SupabaseClient,
  reviewId: string,
  userId: string,
): Promise<void> {
  const { error } = await client
    .from('spot_reviews')
    .delete()
    .eq('id', reviewId)
    .eq('user_id', userId);

  if (error) throw error;
}
