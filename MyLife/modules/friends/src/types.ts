/** A person in the user's relationship network. */
export interface Person {
  id: string;
  name: string;
  nickname?: string;
  phone?: string;
  email?: string;
  birthday?: string; // ISO date (YYYY-MM-DD)
  photoUri?: string;
  notes?: string;
  circleIds: string[];
  metAt?: string; // where/how you met
  metDate?: string; // ISO date
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
}

/** A named group (e.g. "College Friends", "Work", "Family"). */
export interface Circle {
  id: string;
  name: string;
  color?: string; // hex
  icon?: string;
  createdAt: string;
  updatedAt: string;
}

/** A logged hangout/interaction with one or more people. */
export interface Hangout {
  id: string;
  personIds: string[];
  title?: string;
  date: string; // ISO date
  location?: string;
  notes?: string;
  photoUris?: string[];
  createdAt: string;
  updatedAt: string;
}

/** A gift given to or received from a person. */
export interface Gift {
  id: string;
  personId: string;
  name: string;
  direction: 'given' | 'received';
  date?: string; // ISO date
  occasion?: string;
  notes?: string;
  createdAt: string;
}

/** A gift idea saved for a person. */
export interface GiftIdea {
  id: string;
  personId: string;
  idea: string;
  url?: string;
  purchased: boolean;
  createdAt: string;
}

/** A memory/moment associated with a person. */
export interface Memory {
  id: string;
  personIds: string[];
  title: string;
  body?: string;
  date?: string; // ISO date
  photoUris?: string[];
  createdAt: string;
}

/** A significant life event for a person (graduation, move, new job, etc.). */
export interface LifeEvent {
  id: string;
  personId: string;
  type: string;
  title: string;
  date: string; // ISO date
  notes?: string;
  createdAt: string;
}

/** A nudge/reminder to reach out to someone. */
export interface Nudge {
  id: string;
  personId: string;
  reason?: string;
  frequency?: 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
  lastContacted?: string; // ISO date
  nextDue?: string; // ISO date
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A photo attached to a person, hangout, or memory. */
export interface Photo {
  id: string;
  uri: string;
  caption?: string;
  takenAt?: string; // ISO datetime
  createdAt: string;
}
