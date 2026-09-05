import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import {
  getInvitesByEvent,
  getRsvpsByEvent,
  getEventCohosts,
  createInvite,
  recordRsvp,
  addEventCohost,
  approveInviteRequest,
  moveInviteToWaitlist,
  deleteInvite,
  checkInRsvp,
  removeEventCohost,
  type Invite,
  type Rsvp,
  type EventCohost,
} from '@mylife/rsvp';

export function useGuests(eventId: string | undefined) {
  const db = useDatabase();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [rsvps, setRsvps] = useState<Rsvp[]>([]);
  const [cohosts, setCohosts] = useState<EventCohost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(() => {
    if (!eventId) {
      setInvites([]);
      setRsvps([]);
      setCohosts([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setInvites(getInvitesByEvent(db, eventId));
      setRsvps(getRsvpsByEvent(db, eventId));
      setCohosts(getEventCohosts(db, eventId));
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

  const addInvite = useCallback(
    (input: Parameters<typeof createInvite>[3]) => {
      if (!eventId) return;
      createInvite(db, uuid(), eventId, input);
      refresh();
    },
    [db, eventId, refresh],
  );

  const addRsvp = useCallback(
    (input: Parameters<typeof recordRsvp>[3]) => {
      if (!eventId) return;
      recordRsvp(db, uuid(), eventId, input);
      refresh();
    },
    [db, eventId, refresh],
  );

  const addCohost = useCallback(
    (input: { name: string; role?: string }) => {
      if (!eventId) return;
      addEventCohost(db, uuid(), eventId, input);
      refresh();
    },
    [db, eventId, refresh],
  );

  const approve = useCallback(
    (inviteId: string) => {
      approveInviteRequest(db, inviteId);
      refresh();
    },
    [db, refresh],
  );

  const waitlist = useCallback(
    (inviteId: string) => {
      moveInviteToWaitlist(db, inviteId);
      refresh();
    },
    [db, refresh],
  );

  const removeInvite = useCallback(
    (inviteId: string) => {
      deleteInvite(db, inviteId);
      refresh();
    },
    [db, refresh],
  );

  const checkIn = useCallback(
    (rsvpId: string) => {
      checkInRsvp(db, rsvpId);
      refresh();
    },
    [db, refresh],
  );

  const removeCohost = useCallback(
    (cohostId: string) => {
      removeEventCohost(db, cohostId);
      refresh();
    },
    [db, refresh],
  );

  return {
    invites, rsvps, cohosts, loading, error, refresh,
    addInvite, addRsvp, addCohost, approve, waitlist, removeInvite, checkIn, removeCohost,
  };
}
