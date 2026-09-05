import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useEvents, useEvent } from '../../hooks/rsvp/use-events';
import type { Event, RsvpSummary } from '@mylife/rsvp';

interface RsvpContextValue {
  events: Event[];
  eventsLoading: boolean;
  selectedEventId: string | null;
  selectedEvent: Event | null;
  selectedSummary: RsvpSummary | null;
  selectEvent: (id: string | null) => void;
  refreshEvents: () => void;
  createEvent: (input: Parameters<ReturnType<typeof useEvents>['create']>[0]) => string;
}

const RsvpContext = createContext<RsvpContextValue | null>(null);

export function RsvpProvider({ children }: { children: React.ReactNode }) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const { events, loading: eventsLoading, refresh: refreshEvents, create } = useEvents({ includePast: true });
  const { event: selectedEvent, summary: selectedSummary, refresh: refreshSelected } = useEvent(selectedEventId ?? undefined);

  const selectEvent = useCallback((id: string | null) => {
    setSelectedEventId(id);
  }, []);

  const createAndSelect = useCallback(
    (input: Parameters<typeof create>[0]): string => {
      const id = create(input);
      setSelectedEventId(id);
      return id;
    },
    [create],
  );

  const refreshAll = useCallback(() => {
    refreshEvents();
    refreshSelected();
  }, [refreshEvents, refreshSelected]);

  const value = useMemo<RsvpContextValue>(() => ({
    events,
    eventsLoading,
    selectedEventId,
    selectedEvent,
    selectedSummary,
    selectEvent,
    refreshEvents: refreshAll,
    createEvent: createAndSelect,
  }), [events, eventsLoading, selectedEventId, selectedEvent, selectedSummary, selectEvent, refreshAll, createAndSelect]);

  return <RsvpContext.Provider value={value}>{children}</RsvpContext.Provider>;
}

export function useRsvpContext(): RsvpContextValue {
  const ctx = useContext(RsvpContext);
  if (!ctx) throw new Error('useRsvpContext must be used within RsvpProvider');
  return ctx;
}
