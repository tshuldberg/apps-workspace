import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import {
  getAnnouncementsByEvent,
  getCommentsByEvent,
  getPhotosByEvent,
  createAnnouncement,
  createComment,
  addPhoto,
  deletePhoto,
  type Announcement,
  type EventComment,
  type EventPhoto,
} from '@mylife/rsvp';

export function useFeed(eventId: string | undefined) {
  const db = useDatabase();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [comments, setComments] = useState<EventComment[]>([]);
  const [photos, setPhotos] = useState<EventPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(() => {
    if (!eventId) {
      setAnnouncements([]);
      setComments([]);
      setPhotos([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setAnnouncements(getAnnouncementsByEvent(db, eventId));
      setComments(getCommentsByEvent(db, eventId));
      setPhotos(getPhotosByEvent(db, eventId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [db, eventId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const postAnnouncement = useCallback(
    (message: string) => {
      if (!eventId) return;
      createAnnouncement(db, uuid(), eventId, { message, sendChannel: 'all' });
      refresh();
    },
    [db, eventId, refresh],
  );

  const postComment = useCallback(
    (input: { guestName: string; message: string; rsvpId?: string }) => {
      if (!eventId) return;
      createComment(db, uuid(), eventId, input);
      refresh();
    },
    [db, eventId, refresh],
  );

  const uploadPhoto = useCallback(
    (input: { guestName: string; photoUrl: string; rsvpId?: string; caption?: string }) => {
      if (!eventId) return;
      addPhoto(db, uuid(), eventId, input);
      refresh();
    },
    [db, eventId, refresh],
  );

  const removePhoto = useCallback(
    (photoId: string) => {
      deletePhoto(db, photoId);
      refresh();
    },
    [db, refresh],
  );

  return {
    announcements, comments, photos, loading, error, refresh,
    postAnnouncement, postComment, uploadPhoto, removePhoto,
  };
}
