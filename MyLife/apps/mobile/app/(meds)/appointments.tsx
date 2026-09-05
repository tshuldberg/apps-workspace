import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  createAppointment,
  deleteAppointment,
  getAppointments,
  getContacts,
  type Appointment,
  type AppointmentType,
  type Contact,
  updateAppointment,
  getSetting,
} from '@mylife/meds';
import {
  GlassCard,
  MaterialSymbol,
  MD_ACCENT,
  MD_ACCENT_LIGHT,
  MD_CHROME_GOLD,
  MD_FONTS,
  MD_SURFACES,
  withAlpha,
} from '@mylife/meds/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import { scheduleMedsReminderNotificationAsync } from '../../lib/meds-notifications';

type ViewMode = 'timeline' | 'calendar';

type AppointmentForm = {
  title: string;
  appointmentType: AppointmentType;
  providerContactId: string | null;
  providerName: string;
  specialty: string;
  date: string;
  time: string;
  location: string;
  notes: string;
  reminderEnabled: boolean;
  reminderMinutesBefore: string;
};

const APPOINTMENT_TYPES: Array<{ value: AppointmentType; label: string; icon: string }> = [
  { value: 'checkup', label: 'Check-up', icon: 'medical_services' },
  { value: 'follow_up', label: 'Follow-up', icon: 'event' },
  { value: 'lab', label: 'Lab', icon: 'science' },
  { value: 'specialist', label: 'Specialist', icon: 'stethoscope' },
  { value: 'therapy', label: 'Therapy', icon: 'mood' },
  { value: 'screening', label: 'Screening', icon: 'monitor_heart' },
  { value: 'procedure', label: 'Procedure', icon: 'local_hospital' },
  { value: 'vaccination', label: 'Vaccine', icon: 'vaccines' },
  { value: 'dental', label: 'Dental', icon: 'favorite' },
  { value: 'eye_exam', label: 'Eye Exam', icon: 'visibility' },
  { value: 'other', label: 'Other', icon: 'assignment' },
];

const REMINDER_OPTIONS = ['30', '60', '120', '1440'] as const;

function buildDefaultForm(): AppointmentForm {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  return {
    title: '',
    appointmentType: 'checkup',
    providerContactId: null,
    providerName: '',
    specialty: '',
    date,
    time: '09:00',
    location: '',
    notes: '',
    reminderEnabled: true,
    reminderMinutesBefore: '120',
  };
}

function formatDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString([], {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function formatTimeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatCountdown(value: string) {
  const target = new Date(value).getTime();
  const delta = target - Date.now();
  if (Number.isNaN(target)) {
    return '';
  }
  if (delta <= 0) {
    return 'Started';
  }

  const totalMinutes = Math.round(delta / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);

  if (days > 0) {
    return hours > 0 ? `in ${days}d ${hours}h` : `in ${days}d`;
  }
  if (hours > 0) {
    return `in ${hours}h`;
  }
  return `in ${Math.max(1, totalMinutes)} min`;
}

function toIsoString(date: string, time: string) {
  const candidate = new Date(`${date}T${time.length === 5 ? `${time}:00` : time}`);
  if (Number.isNaN(candidate.getTime())) {
    return null;
  }
  return candidate.toISOString();
}

function splitIso(iso: string) {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) {
    return { date: '', time: '' };
  }
  return {
    date: value.toISOString().slice(0, 10),
    time: value.toISOString().slice(11, 16),
  };
}

function groupByDate(items: Appointment[]) {
  return items.reduce<Record<string, Appointment[]>>((groups, item) => {
    const dateKey = item.scheduledAt.slice(0, 10);
    groups[dateKey] = groups[dateKey] ?? [];
    groups[dateKey].push(item);
    return groups;
  }, {});
}

export default function AppointmentsScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [showPast, setShowPast] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AppointmentForm>(() => buildDefaultForm());

  const refresh = useCallback(() => {
    setTick((value) => value + 1);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const appointments = useMemo(() => getAppointments(db), [db, tick]);
  const contacts = useMemo(() => getContacts(db), [db, tick]);
  const now = Date.now();
  const upcoming = useMemo(
    () =>
      appointments.filter(
        (item) => item.status === 'scheduled' && new Date(item.scheduledAt).getTime() >= now,
      ),
    [appointments, now],
  );
  const past = useMemo(
    () =>
      appointments.filter(
        (item) => item.status !== 'scheduled' || new Date(item.scheduledAt).getTime() < now,
      ),
    [appointments, now],
  );
  const groupedUpcoming = useMemo(() => groupByDate(upcoming), [upcoming]);
  const nextAppointment = upcoming[0] ?? null;

  const resetForm = () => {
    setEditingId(null);
    setForm(buildDefaultForm());
  };

  const openCreate = () => {
    resetForm();
    setShowEditor(true);
  };

  const openEdit = (appointment: Appointment) => {
    const split = splitIso(appointment.scheduledAt);
    setEditingId(appointment.id);
    setForm({
      title: appointment.title,
      appointmentType: appointment.appointmentType,
      providerContactId: appointment.providerContactId,
      providerName: appointment.providerName ?? '',
      specialty: appointment.specialty ?? '',
      date: split.date,
      time: split.time || '09:00',
      location: appointment.location ?? '',
      notes: appointment.notes ?? '',
      reminderEnabled: appointment.reminderEnabled,
      reminderMinutesBefore: String(appointment.reminderMinutesBefore),
    });
    setShowEditor(true);
  };

  const closeEditor = () => {
    setShowEditor(false);
    resetForm();
  };

  const handleSelectContact = (contact: Contact) => {
    setForm((current) => ({
      ...current,
      providerContactId: contact.id,
      providerName: contact.name,
      specialty: contact.specialty ?? contact.type.replace(/_/g, ' '),
      location: current.location || contact.address || '',
    }));
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      Alert.alert('Add a title', 'Each appointment needs a title so it can appear in the care timeline.');
      return;
    }

    const scheduledAt = toIsoString(form.date, form.time);
    if (!scheduledAt) {
      Alert.alert('Check date and time', 'Use YYYY-MM-DD and HH:MM so MyMeds can schedule the appointment.');
      return;
    }

    try {
      if (editingId) {
        updateAppointment(db, editingId, {
          title: form.title.trim(),
          appointmentType: form.appointmentType,
          providerContactId: form.providerContactId ?? undefined,
          providerName: form.providerName.trim() || undefined,
          specialty: form.specialty.trim() || undefined,
          scheduledAt,
          location: form.location.trim() || undefined,
          notes: form.notes.trim() || undefined,
          reminderEnabled: form.reminderEnabled,
          reminderMinutesBefore: Number.parseInt(form.reminderMinutesBefore, 10),
        });
      } else {
        createAppointment(db, uuid(), {
          title: form.title.trim(),
          appointmentType: form.appointmentType,
          providerContactId: form.providerContactId ?? undefined,
          providerName: form.providerName.trim() || undefined,
          specialty: form.specialty.trim() || undefined,
          scheduledAt,
          location: form.location.trim() || undefined,
          notes: form.notes.trim() || undefined,
          reminderEnabled: form.reminderEnabled,
          reminderMinutesBefore: Number.parseInt(form.reminderMinutesBefore, 10),
        });
      }

      if (
        form.reminderEnabled
        && getSetting(db, 'notifications.master_enabled') === 'true'
      ) {
        const reminderDate = new Date(
          new Date(scheduledAt).getTime() - Number.parseInt(form.reminderMinutesBefore, 10) * 60000,
        );
        await scheduleMedsReminderNotificationAsync({
          title: 'Upcoming MyMeds appointment',
          body: `${form.providerName || form.title}${form.location ? ` • ${form.location}` : ''}`,
          scheduledFor: reminderDate,
        });
      }

      closeEditor();
      refresh();
    } catch {
      Alert.alert('Save failed', 'MyMeds could not save this appointment.');
    }
  };

  const handleDelete = (appointment: Appointment) => {
    Alert.alert('Delete appointment', `Remove "${appointment.title}" from your care schedule?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteAppointment(db, appointment.id);
          refresh();
        },
      },
    ]);
  };

  const handleDirections = async (location: string | null) => {
    if (!location) {
      return;
    }

    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Directions unavailable', 'MyMeds could not open Maps for this location.');
    }
  };

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Appointments</Text>
            <Text style={styles.subtitle}>Your upcoming care schedule, grouped for quick prep and follow-up.</Text>
          </View>
          <Pressable onPress={openCreate} style={styles.addButton}>
            <MaterialSymbol color="#001F2A" name="add" size={20} />
          </Pressable>
        </View>

        <View style={styles.toggleRow}>
          <FilterPill
            active={viewMode === 'timeline'}
            icon="timeline"
            label="Timeline"
            onPress={() => setViewMode('timeline')}
          />
          <FilterPill
            active={viewMode === 'calendar'}
            icon="calendar_today"
            label="Calendar"
            onPress={() => setViewMode('calendar')}
          />
        </View>

        {nextAppointment ? (
          <GlassCard style={styles.heroCard}>
            <View style={styles.heroTop}>
              <View>
                <Text style={styles.heroEyebrow}>Next appointment</Text>
                <Text style={styles.heroDoctor}>{nextAppointment.providerName || nextAppointment.title}</Text>
                <Text style={styles.heroMeta}>
                  {nextAppointment.specialty || APPOINTMENT_TYPES.find((item) => item.value === nextAppointment.appointmentType)?.label}
                </Text>
              </View>
              <View style={styles.countdownPill}>
                <Text style={styles.countdownText}>{formatCountdown(nextAppointment.scheduledAt)}</Text>
              </View>
            </View>

            <View style={styles.heroDetails}>
              <DetailRow icon="event" text={`${formatDateLabel(nextAppointment.scheduledAt)} • ${formatTimeLabel(nextAppointment.scheduledAt)}`} />
              {nextAppointment.location ? <DetailRow icon="place" text={nextAppointment.location} /> : null}
            </View>

            <View style={styles.heroActions}>
              <InlineAction
                icon="directions"
                label="Directions"
                onPress={() => void handleDirections(nextAppointment.location)}
              />
              <InlineAction
                icon="edit"
                label="Edit"
                onPress={() => openEdit(nextAppointment)}
              />
            </View>
          </GlassCard>
        ) : (
          <GlassCard style={styles.emptyCard}>
            <MaterialSymbol color={MD_ACCENT_LIGHT} name="event" size={28} />
            <Text style={styles.emptyTitle}>No upcoming appointments</Text>
            <Text style={styles.emptyBody}>Add your next check-up, lab, or specialist visit to keep prep notes and reminders in one place.</Text>
            <Pressable onPress={openCreate} style={styles.createCta}>
              <Text style={styles.createCtaText}>Add appointment</Text>
            </Pressable>
          </GlassCard>
        )}

        {viewMode === 'timeline' ? (
          <View style={styles.timelineStack}>
            {upcoming.map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={appointment}
                onDelete={() => handleDelete(appointment)}
                onEdit={() => openEdit(appointment)}
                onDirections={() => void handleDirections(appointment.location)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.calendarStack}>
            {Object.entries(groupedUpcoming).map(([dateKey, items]) => (
              <View key={dateKey} style={styles.calendarGroup}>
                <Text style={styles.calendarDate}>{formatDateLabel(`${dateKey}T00:00:00.000Z`)}</Text>
                {items.map((appointment) => (
                  <AppointmentCard
                    key={appointment.id}
                    appointment={appointment}
                    compact
                    onDelete={() => handleDelete(appointment)}
                    onEdit={() => openEdit(appointment)}
                    onDirections={() => void handleDirections(appointment.location)}
                  />
                ))}
              </View>
            ))}
          </View>
        )}

        {past.length > 0 ? (
          <GlassCard style={styles.pastShell}>
            <Pressable onPress={() => setShowPast((value) => !value)} style={styles.rowBetween}>
              <View>
                <Text style={styles.sectionTitle}>Past appointments</Text>
                <Text style={styles.sectionBody}>Review completed visits, missed appointments, and archived notes.</Text>
              </View>
              <MaterialSymbol color="#9F8E81" name={showPast ? 'expand_less' : 'expand_more'} size={22} />
            </Pressable>
            {showPast ? (
              <View style={styles.pastList}>
                {past.map((appointment) => (
                  <AppointmentCard
                    key={appointment.id}
                    appointment={appointment}
                    compact
                    faded
                    onDelete={() => handleDelete(appointment)}
                    onEdit={() => openEdit(appointment)}
                    onDirections={() => void handleDirections(appointment.location)}
                  />
                ))}
              </View>
            ) : null}
          </GlassCard>
        ) : null}
      </ScrollView>

      <Modal
        animationType="slide"
        onRequestClose={closeEditor}
        transparent
        visible={showEditor}
      >
        <Pressable onPress={closeEditor} style={styles.modalOverlay}>
          <Pressable onPress={(event) => event.stopPropagation()} style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <ScrollView
              contentContainerStyle={styles.modalContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.rowBetween}>
                <Text style={styles.modalTitle}>{editingId ? 'Edit Appointment' : 'Add Appointment'}</Text>
                <Pressable onPress={closeEditor} style={styles.iconButton}>
                  <MaterialSymbol color="#9F8E81" name="close" size={18} />
                </Pressable>
              </View>

              <Field label="Title">
                <TextInput
                  onChangeText={(value) => setForm((current) => ({ ...current, title: value }))}
                  placeholder="Cardiology review"
                  placeholderTextColor="#9F8E81"
                  style={styles.input}
                  value={form.title}
                />
              </Field>

              <Field label="Appointment type">
                <View style={styles.chipWrap}>
                  {APPOINTMENT_TYPES.map((item) => (
                    <Chip
                      key={item.value}
                      active={form.appointmentType === item.value}
                      icon={item.icon}
                      label={item.label}
                      onPress={() => setForm((current) => ({ ...current, appointmentType: item.value }))}
                    />
                  ))}
                </View>
              </Field>

              {contacts.length > 0 ? (
                <Field label="Healthcare contacts">
                  <ScrollView
                    horizontal
                    contentContainerStyle={styles.contactRow}
                    showsHorizontalScrollIndicator={false}
                  >
                    {contacts.map((contact) => (
                      <Pressable
                        key={contact.id}
                        onPress={() => handleSelectContact(contact)}
                        style={[
                          styles.contactChip,
                          form.providerContactId === contact.id ? styles.contactChipActive : null,
                        ]}
                      >
                        <Text style={styles.contactChipTitle}>{contact.name}</Text>
                        <Text style={styles.contactChipSubtitle}>{contact.specialty || contact.type}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </Field>
              ) : null}

              <View style={styles.inlineFields}>
                <Field label="Date" style={styles.inlineField}>
                  <TextInput
                    onChangeText={(value) => setForm((current) => ({ ...current, date: value }))}
                    placeholder="2026-04-20"
                    placeholderTextColor="#9F8E81"
                    style={styles.input}
                    value={form.date}
                  />
                </Field>
                <Field label="Time" style={styles.inlineField}>
                  <TextInput
                    onChangeText={(value) => setForm((current) => ({ ...current, time: value }))}
                    placeholder="09:00"
                    placeholderTextColor="#9F8E81"
                    style={styles.input}
                    value={form.time}
                  />
                </Field>
              </View>

              <Field label="Provider">
                <TextInput
                  onChangeText={(value) => setForm((current) => ({ ...current, providerName: value }))}
                  placeholder="Dr. Rivera"
                  placeholderTextColor="#9F8E81"
                  style={styles.input}
                  value={form.providerName}
                />
              </Field>

              <Field label="Specialty">
                <TextInput
                  onChangeText={(value) => setForm((current) => ({ ...current, specialty: value }))}
                  placeholder="Cardiology"
                  placeholderTextColor="#9F8E81"
                  style={styles.input}
                  value={form.specialty}
                />
              </Field>

              <Field label="Location">
                <TextInput
                  onChangeText={(value) => setForm((current) => ({ ...current, location: value }))}
                  placeholder="Heart Center, 200 Main St"
                  placeholderTextColor="#9F8E81"
                  style={styles.input}
                  value={form.location}
                />
              </Field>

              <Field label="Notes">
                <TextInput
                  multiline
                  onChangeText={(value) => setForm((current) => ({ ...current, notes: value }))}
                  placeholder="Prep notes, fasting instructions, questions to ask..."
                  placeholderTextColor="#9F8E81"
                  style={[styles.input, styles.notesInput]}
                  value={form.notes}
                />
              </Field>

              <GlassCard style={styles.reminderCard}>
                <View style={styles.rowBetween}>
                  <View style={styles.sectionMainCopy}>
                    <Text style={styles.sectionTitle}>Appointment reminder</Text>
                    <Text style={styles.sectionBody}>Schedule a reminder before the visit starts.</Text>
                  </View>
                  <TogglePill
                    enabled={form.reminderEnabled}
                    onPress={() =>
                      setForm((current) => ({
                        ...current,
                        reminderEnabled: !current.reminderEnabled,
                      }))
                    }
                  />
                </View>

                <View style={styles.optionRow}>
                  {REMINDER_OPTIONS.map((option) => (
                    <Pressable
                      key={option}
                      onPress={() =>
                        setForm((current) => ({
                          ...current,
                          reminderMinutesBefore: option,
                        }))
                      }
                      style={[
                        styles.optionChip,
                        form.reminderMinutesBefore === option ? styles.optionChipActive : null,
                      ]}
                    >
                      <Text style={[styles.optionChipText, form.reminderMinutesBefore === option ? styles.optionChipTextActive : null]}>
                        {option === '1440' ? '1 day' : `${option} min`}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </GlassCard>

              <Pressable onPress={() => void handleSave()}>
                <View style={styles.saveButton}>
                  <Text style={styles.saveButtonText}>{editingId ? 'Save changes' : 'Save appointment'}</Text>
                </View>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function AppointmentCard({
  appointment,
  onEdit,
  onDelete,
  onDirections,
  compact = false,
  faded = false,
}: {
  appointment: Appointment;
  onEdit: () => void;
  onDelete: () => void;
  onDirections: () => void;
  compact?: boolean;
  faded?: boolean;
}) {
  const typeMeta = APPOINTMENT_TYPES.find((item) => item.value === appointment.appointmentType);

  return (
    <GlassCard style={[styles.appointmentCard, compact ? styles.appointmentCardCompact : null, faded ? styles.faded : null]}>
      <View style={styles.rowBetween}>
        <View style={styles.appointmentHeading}>
          <View style={styles.appointmentIconShell}>
            <MaterialSymbol color={MD_ACCENT_LIGHT} name={typeMeta?.icon ?? 'event'} size={18} />
          </View>
          <View style={styles.appointmentHeadingCopy}>
            <Text style={styles.appointmentTitle}>{appointment.providerName || appointment.title}</Text>
            <Text style={styles.appointmentMeta}>
              {typeMeta?.label ?? appointment.appointmentType} • {formatTimeLabel(appointment.scheduledAt)}
            </Text>
          </View>
        </View>
        <View style={styles.cardActions}>
          <IconAction icon="edit" onPress={onEdit} />
          <IconAction icon="delete" onPress={onDelete} />
        </View>
      </View>

      <View style={styles.detailsStack}>
        <DetailRow icon="event" text={formatDateLabel(appointment.scheduledAt)} />
        {appointment.location ? <DetailRow icon="place" text={appointment.location} /> : null}
        {appointment.notes ? <DetailRow icon="assignment" text={appointment.notes} muted /> : null}
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.footerStatus}>{formatCountdown(appointment.scheduledAt)}</Text>
        {appointment.location ? <InlineAction icon="directions" label="Directions" onPress={onDirections} /> : null}
      </View>
    </GlassCard>
  );
}

function Field({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: object;
}) {
  return (
    <View style={style}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Chip({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.typeChip, active ? styles.typeChipActive : null]}>
      <MaterialSymbol color={active ? '#E4E1E9' : '#9F8E81'} name={icon} size={14} />
      <Text style={[styles.typeChipText, active ? styles.typeChipTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function FilterPill({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.filterPill, active ? styles.filterPillActive : null]}>
      <MaterialSymbol color={active ? '#E4E1E9' : '#9F8E81'} name={icon} size={14} />
      <Text style={[styles.filterPillText, active ? styles.filterPillTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function DetailRow({
  icon,
  text,
  muted = false,
}: {
  icon: string;
  text: string;
  muted?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <MaterialSymbol color={muted ? '#9F8E81' : '#D6C3B5'} name={icon} size={14} />
      <Text style={[styles.detailText, muted ? styles.detailTextMuted : null]}>{text}</Text>
    </View>
  );
}

function InlineAction({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.inlineAction}>
      <MaterialSymbol color={MD_CHROME_GOLD} name={icon} size={14} />
      <Text style={styles.inlineActionText}>{label}</Text>
    </Pressable>
  );
}

function IconAction({
  icon,
  onPress,
}: {
  icon: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.iconButton}>
      <MaterialSymbol color="#9F8E81" name={icon} size={16} />
    </Pressable>
  );
}

function TogglePill({
  enabled,
  onPress,
}: {
  enabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled }}
      onPress={onPress}
      style={[styles.toggleTrack, enabled ? styles.toggleTrackActive : null]}
    >
      <View style={[styles.toggleThumb, enabled ? styles.toggleThumbActive : null]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MD_SURFACES.base,
  },
  content: {
    gap: 14,
    paddingBottom: 140,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  headerCopy: {
    flex: 1,
    paddingRight: 16,
  },
  title: {
    color: '#E4E1E9',
    fontFamily: MD_FONTS.extraBold,
    fontSize: 34,
    letterSpacing: -0.8,
    lineHeight: 38,
  },
  subtitle: {
    color: '#D6C3B5',
    fontFamily: MD_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 6,
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: MD_ACCENT_LIGHT,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  filterPill: {
    alignItems: 'center',
    backgroundColor: withAlpha('#FFFFFF', 0.05),
    borderRadius: 999,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 40,
  },
  filterPillActive: {
    backgroundColor: withAlpha(MD_ACCENT, 0.2),
  },
  filterPillText: {
    color: '#9F8E81',
    fontFamily: MD_FONTS.semiBold,
    fontSize: 13,
  },
  filterPillTextActive: {
    color: '#E4E1E9',
  },
  heroCard: {
    gap: 16,
    padding: 18,
  },
  heroTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroEyebrow: {
    color: MD_ACCENT_LIGHT,
    fontFamily: MD_FONTS.bold,
    fontSize: 10,
    letterSpacing: 1.3,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  heroDoctor: {
    color: '#E4E1E9',
    fontFamily: MD_FONTS.extraBold,
    fontSize: 24,
    lineHeight: 28,
  },
  heroMeta: {
    color: '#D6C3B5',
    fontFamily: MD_FONTS.regular,
    fontSize: 13,
    marginTop: 4,
  },
  countdownPill: {
    backgroundColor: withAlpha(MD_CHROME_GOLD, 0.16),
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  countdownText: {
    color: MD_CHROME_GOLD,
    fontFamily: MD_FONTS.bold,
    fontSize: 12,
  },
  heroDetails: {
    gap: 8,
  },
  heroActions: {
    flexDirection: 'row',
    gap: 10,
  },
  emptyCard: {
    alignItems: 'center',
    gap: 10,
    padding: 24,
  },
  emptyTitle: {
    color: '#E4E1E9',
    fontFamily: MD_FONTS.bold,
    fontSize: 18,
  },
  emptyBody: {
    color: '#D6C3B5',
    fontFamily: MD_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  createCta: {
    backgroundColor: withAlpha(MD_ACCENT, 0.18),
    borderRadius: 999,
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  createCtaText: {
    color: '#E4E1E9',
    fontFamily: MD_FONTS.semiBold,
    fontSize: 13,
  },
  timelineStack: {
    gap: 12,
  },
  calendarStack: {
    gap: 18,
  },
  calendarGroup: {
    gap: 10,
  },
  calendarDate: {
    color: MD_ACCENT_LIGHT,
    fontFamily: MD_FONTS.bold,
    fontSize: 12,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  pastShell: {
    gap: 14,
    padding: 18,
  },
  pastList: {
    gap: 10,
  },
  sectionTitle: {
    color: '#E4E1E9',
    fontFamily: MD_FONTS.bold,
    fontSize: 16,
  },
  sectionBody: {
    color: '#D6C3B5',
    fontFamily: MD_FONTS.regular,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  appointmentCard: {
    gap: 14,
    padding: 16,
  },
  appointmentCardCompact: {
    paddingVertical: 14,
  },
  faded: {
    opacity: 0.6,
  },
  appointmentHeading: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    paddingRight: 12,
  },
  appointmentIconShell: {
    alignItems: 'center',
    backgroundColor: withAlpha(MD_ACCENT, 0.14),
    borderRadius: 16,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  appointmentHeadingCopy: {
    flex: 1,
  },
  appointmentTitle: {
    color: '#E4E1E9',
    fontFamily: MD_FONTS.semiBold,
    fontSize: 16,
    lineHeight: 22,
  },
  appointmentMeta: {
    color: '#D6C3B5',
    fontFamily: MD_FONTS.regular,
    fontSize: 12,
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: withAlpha('#FFFFFF', 0.05),
    borderRadius: 14,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  detailsStack: {
    gap: 8,
  },
  detailRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  detailText: {
    color: '#D6C3B5',
    flex: 1,
    fontFamily: MD_FONTS.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  detailTextMuted: {
    color: '#9F8E81',
  },
  cardFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerStatus: {
    color: MD_CHROME_GOLD,
    fontFamily: MD_FONTS.bold,
    fontSize: 12,
  },
  inlineAction: {
    alignItems: 'center',
    backgroundColor: withAlpha(MD_CHROME_GOLD, 0.12),
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 12,
  },
  inlineActionText: {
    color: MD_CHROME_GOLD,
    fontFamily: MD_FONTS.semiBold,
    fontSize: 12,
  },
  modalOverlay: {
    backgroundColor: 'rgba(0,0,0,0.72)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: MD_SURFACES.low,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '88%',
  },
  modalHandle: {
    alignSelf: 'center',
    backgroundColor: withAlpha('#FFFFFF', 0.18),
    borderRadius: 999,
    height: 5,
    marginTop: 12,
    width: 42,
  },
  modalContent: {
    gap: 14,
    paddingBottom: 40,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  modalTitle: {
    color: '#E4E1E9',
    fontFamily: MD_FONTS.bold,
    fontSize: 22,
    lineHeight: 28,
  },
  fieldLabel: {
    color: '#9F8E81',
    fontFamily: MD_FONTS.bold,
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: withAlpha('#FFFFFF', 0.05),
    borderRadius: 18,
    color: '#E4E1E9',
    fontFamily: MD_FONTS.regular,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  notesInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    alignItems: 'center',
    backgroundColor: withAlpha('#FFFFFF', 0.05),
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
  },
  typeChipActive: {
    backgroundColor: withAlpha(MD_ACCENT, 0.2),
  },
  typeChipText: {
    color: '#9F8E81',
    fontFamily: MD_FONTS.semiBold,
    fontSize: 12,
  },
  typeChipTextActive: {
    color: '#E4E1E9',
  },
  contactRow: {
    gap: 10,
  },
  contactChip: {
    backgroundColor: withAlpha('#FFFFFF', 0.05),
    borderRadius: 18,
    minWidth: 132,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  contactChipActive: {
    backgroundColor: withAlpha(MD_CHROME_GOLD, 0.18),
  },
  contactChipTitle: {
    color: '#E4E1E9',
    fontFamily: MD_FONTS.semiBold,
    fontSize: 13,
  },
  contactChipSubtitle: {
    color: '#9F8E81',
    fontFamily: MD_FONTS.regular,
    fontSize: 11,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  inlineFields: {
    flexDirection: 'row',
    gap: 12,
  },
  inlineField: {
    flex: 1,
  },
  reminderCard: {
    gap: 14,
    padding: 16,
  },
  sectionMainCopy: {
    flex: 1,
    paddingRight: 16,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    backgroundColor: withAlpha('#FFFFFF', 0.05),
    borderRadius: 999,
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  optionChipActive: {
    backgroundColor: withAlpha(MD_ACCENT, 0.2),
  },
  optionChipText: {
    color: '#D6C3B5',
    fontFamily: MD_FONTS.semiBold,
    fontSize: 12,
  },
  optionChipTextActive: {
    color: '#E4E1E9',
  },
  toggleTrack: {
    backgroundColor: withAlpha('#FFFFFF', 0.12),
    borderRadius: 999,
    height: 30,
    justifyContent: 'center',
    paddingHorizontal: 4,
    width: 54,
  },
  toggleTrackActive: {
    backgroundColor: withAlpha(MD_ACCENT, 0.4),
  },
  toggleThumb: {
    backgroundColor: '#9F8E81',
    borderRadius: 11,
    height: 22,
    width: 22,
  },
  toggleThumbActive: {
    backgroundColor: MD_ACCENT,
    marginLeft: 24,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: MD_ACCENT_LIGHT,
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 54,
    marginTop: 6,
  },
  saveButtonText: {
    color: '#001F2A',
    fontFamily: MD_FONTS.bold,
    fontSize: 15,
  },
});
