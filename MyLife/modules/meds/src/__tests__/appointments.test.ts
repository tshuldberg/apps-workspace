import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { MEDS_MODULE } from '../definition';
import {
  createContact,
  deleteContact,
  getContactById,
  getContacts,
  updateContact,
} from '../contacts';
import {
  createAppointment,
  deleteAppointment,
  getAppointmentById,
  getAppointments,
  getPastAppointments,
  getUpcomingAppointments,
  updateAppointment,
} from '../appointments';

describe('appointments + contacts', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('meds', MEDS_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  it('creates, updates, and deletes contacts', () => {
    createContact(adapter, 'contact-1', {
      name: 'Dr. Rivera',
      type: 'doctor',
      specialty: 'Cardiology',
      phone: '555-0100',
      email: 'rivera@clinic.test',
    });

    expect(getContacts(adapter)).toHaveLength(1);
    expect(getContactById(adapter, 'contact-1')?.specialty).toBe('Cardiology');

    updateContact(adapter, 'contact-1', {
      specialty: 'Internal Medicine',
      address: '101 Clinic Way',
    });

    const updated = getContactById(adapter, 'contact-1');
    expect(updated?.specialty).toBe('Internal Medicine');
    expect(updated?.address).toBe('101 Clinic Way');

    deleteContact(adapter, 'contact-1');
    expect(getContacts(adapter)).toHaveLength(0);
  });

  it('creates and queries appointments across upcoming and past buckets', () => {
    createContact(adapter, 'contact-1', {
      name: 'Dr. Rivera',
      type: 'doctor',
      specialty: 'Cardiology',
    });

    createAppointment(adapter, 'appt-upcoming', {
      title: 'Cardiology Review',
      appointmentType: 'specialist',
      providerContactId: 'contact-1',
      providerName: 'Dr. Rivera',
      specialty: 'Cardiology',
      scheduledAt: '2026-05-01T14:30:00.000Z',
      location: 'Heart Center',
      reminderEnabled: true,
      reminderMinutesBefore: 90,
      linkedMedicationIds: ['med-1', 'med-2'],
    });

    createAppointment(adapter, 'appt-past', {
      title: 'Annual Lab Panel',
      appointmentType: 'lab',
      providerName: 'Quest Diagnostics',
      scheduledAt: '2026-03-01T08:00:00.000Z',
      status: 'completed',
      reminderEnabled: false,
    });

    expect(getAppointments(adapter)).toHaveLength(2);
    expect(getUpcomingAppointments(adapter, '2026-04-01T00:00:00.000Z')).toHaveLength(1);
    expect(getPastAppointments(adapter, '2026-04-01T00:00:00.000Z')).toHaveLength(1);

    const upcoming = getAppointmentById(adapter, 'appt-upcoming');
    expect(upcoming?.linkedMedicationIds).toEqual(['med-1', 'med-2']);
    expect(upcoming?.reminderMinutesBefore).toBe(90);
  });

  it('updates and deletes appointments', () => {
    createAppointment(adapter, 'appt-1', {
      title: 'Follow-up Visit',
      appointmentType: 'follow_up',
      providerName: 'Dr. Chen',
      scheduledAt: '2026-04-20T09:00:00.000Z',
    });

    updateAppointment(adapter, 'appt-1', {
      location: 'North Clinic',
      status: 'completed',
      reminderEnabled: false,
    });

    const updated = getAppointmentById(adapter, 'appt-1');
    expect(updated?.location).toBe('North Clinic');
    expect(updated?.status).toBe('completed');
    expect(updated?.reminderEnabled).toBe(false);

    deleteAppointment(adapter, 'appt-1');
    expect(getAppointments(adapter)).toHaveLength(0);
  });
});
