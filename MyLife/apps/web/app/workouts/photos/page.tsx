'use client';

import { useEffect, useRef, useState } from 'react';
import type { PhotoViewType, ProgressPhoto } from '@mylife/workouts';
import {
  doDeleteWorkoutPhoto,
  doUploadWorkoutPhoto,
  fetchWorkoutPhotosView,
} from '../actions';
import {
  ActionLink,
  EmptyState,
  SectionTitle,
  WorkoutsPageHeader,
  WorkoutsSurface,
  chipStyle,
  WORKOUTS_TOKENS,
} from '../ui';

const VIEW_FILTERS: Array<{ key: PhotoViewType | 'all'; label: string }> = [
  { key: 'all', label: 'All Views' },
  { key: 'front', label: 'Front' },
  { key: 'side_left', label: 'Side Left' },
  { key: 'side_right', label: 'Side Right' },
  { key: 'back', label: 'Back' },
];

type PhotosView = Awaited<ReturnType<typeof fetchWorkoutPhotosView>>;

function formatPhotoDate(value: string): string {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function WorkoutPhotosPage() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [filter, setFilter] = useState<PhotoViewType | 'all'>('all');
  const [draftViewType, setDraftViewType] = useState<PhotoViewType>('front');
  const [view, setView] = useState<PhotosView | null>(null);
  const [compareSelection, setCompareSelection] = useState<ProgressPhoto[]>([]);
  const [previewPhoto, setPreviewPhoto] = useState<ProgressPhoto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        setLoading(true);
        const next = await fetchWorkoutPhotosView(filter);
        if (cancelled) return;
        setView(next);
        setError(null);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load photos.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [filter]);

  const refresh = async () => {
    const next = await fetchWorkoutPhotosView(filter);
    setView(next);
  };

  const handleFilesSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const result = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Failed to read file.'));
        reader.readAsDataURL(file);
      });

      await doUploadWorkoutPhoto({
        photoUri: result,
        viewType: draftViewType,
        takenAt: new Date().toISOString(),
        fileSizeBytes: file.size,
      });
      await refresh();
      setError(null);
      event.target.value = '';
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to upload photo.');
    }
  };

  const handleDelete = async (photo: ProgressPhoto) => {
    const confirmed = window.confirm('Delete this progress photo?');
    if (!confirmed) return;

    try {
      await doDeleteWorkoutPhoto(photo.id);
      setPreviewPhoto(null);
      setCompareSelection((current) => current.filter((item) => item.id !== photo.id));
      await refresh();
      setError(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete photo.');
    }
  };

  const toggleCompare = (photo: ProgressPhoto) => {
    setCompareSelection((current) => {
      if (current.some((item) => item.id === photo.id)) {
        return current.filter((item) => item.id !== photo.id);
      }
      if (current.length >= 2) {
        return [current[1], photo];
      }
      return [...current, photo];
    });
  };

  if (loading) {
    return <WorkoutsSurface tone="mid">Loading progress photos...</WorkoutsSurface>;
  }

  if (!view) {
    return (
      <EmptyState
        title="Photos unavailable"
        body={error ?? 'The progress photo surface could not be loaded.'}
        action={<ActionLink href="/workouts/progress" label="Back To Progress" icon="arrow_back" secondary />}
      />
    );
  }

  const compareReady = compareSelection.length === 2;
  const photos = filter === 'all' ? view.allPhotos : view.photos;

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => void handleFilesSelected(event)}
      />

      <WorkoutsSurface tone="glass" style={{ display: 'grid', gap: 22 }}>
        <WorkoutsPageHeader
          eyebrow="Progress Photos"
          title="Visual timeline"
          description="Store progress images locally, filter by angle, and compare two shots side by side without leaving the workouts surface."
          actions={
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              style={{
                border: 'none',
                borderRadius: 999,
                background: WORKOUTS_TOKENS.accent,
                color: '#2E1600',
                padding: '14px 20px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Add Photo
            </button>
          }
        />

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {VIEW_FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              style={chipStyle(filter === item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {VIEW_FILTERS.filter((item) => item.key !== 'all').map((item) => (
            <button
              key={`draft-${item.key}`}
              type="button"
              onClick={() => setDraftViewType(item.key as PhotoViewType)}
              style={chipStyle(draftViewType === item.key)}
            >
              Upload as {item.label}
            </button>
          ))}
        </div>
      </WorkoutsSurface>

      {compareReady ? (
        <WorkoutsSurface tone="mid" style={{ display: 'grid', gap: 16 }}>
          <SectionTitle
            eyebrow="Compare"
            title="Side-by-side check"
            description="Use the compare toggles in the grid to swap these shots."
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
            {compareSelection.map((photo) => (
              <div key={photo.id} style={{ display: 'grid', gap: 10 }}>
                <img
                  src={photo.photoUri}
                  alt={photo.viewType}
                  style={{ width: '100%', borderRadius: 22, objectFit: 'cover', aspectRatio: '3 / 4' }}
                />
                <span style={{ color: WORKOUTS_TOKENS.textSecondary, fontSize: 13 }}>
                  {photo.viewType.replace(/_/g, ' ')} · {formatPhotoDate(photo.takenAt)}
                </span>
              </div>
            ))}
          </div>
        </WorkoutsSurface>
      ) : null}

      {previewPhoto ? (
        <WorkoutsSurface tone="low" style={{ display: 'grid', gap: 16 }}>
          <SectionTitle
            eyebrow="Preview"
            title={previewPhoto.viewType.replace(/_/g, ' ')}
            description={formatPhotoDate(previewPhoto.takenAt)}
            aside={<button type="button" onClick={() => setPreviewPhoto(null)} style={chipStyle(false)}>Close</button>}
          />
          <img
            src={previewPhoto.photoUri}
            alt={previewPhoto.viewType}
            style={{ width: '100%', maxHeight: 620, objectFit: 'contain', borderRadius: 24, background: WORKOUTS_TOKENS.surfaceHigh }}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={() => void handleDelete(previewPhoto)} style={chipStyle(false)}>
              Delete Photo
            </button>
          </div>
        </WorkoutsSurface>
      ) : null}

      {photos.length === 0 ? (
        <EmptyState
          title="No photos yet"
          body="Upload your first progress shot and it will appear here for future comparison."
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          {photos.map((photo) => {
            const compared = compareSelection.some((item) => item.id === photo.id);

            return (
              <WorkoutsSurface key={photo.id} tone="low" style={{ display: 'grid', gap: 10, padding: 14 }}>
                <button
                  type="button"
                  onClick={() => setPreviewPhoto(photo)}
                  style={{
                    border: 'none',
                    padding: 0,
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <img
                    src={photo.photoUri}
                    alt={photo.viewType}
                    style={{ width: '100%', borderRadius: 18, objectFit: 'cover', aspectRatio: '3 / 4' }}
                  />
                </button>
                <div style={{ display: 'grid', gap: 4 }}>
                  <strong style={{ textTransform: 'capitalize' }}>{photo.viewType.replace(/_/g, ' ')}</strong>
                  <span style={{ color: WORKOUTS_TOKENS.textSecondary, fontSize: 13 }}>
                    {formatPhotoDate(photo.takenAt)}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => toggleCompare(photo)} style={chipStyle(compared)}>
                    {compared ? 'Selected' : 'Compare'}
                  </button>
                  <button type="button" onClick={() => void handleDelete(photo)} style={chipStyle(false)}>
                    Delete
                  </button>
                </div>
              </WorkoutsSurface>
            );
          })}
        </div>
      )}

      {error ? <div style={{ color: WORKOUTS_TOKENS.danger }}>{error}</div> : null}
    </div>
  );
}
