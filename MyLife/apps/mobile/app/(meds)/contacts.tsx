import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
} from 'react-native';
import { getActiveMedications } from '@mylife/meds';
import {
  GlassCard,
  MaterialSymbol,
  SectionHeader,
  MD_ACCENT_LIGHT,
  MD_FONTS,
  MD_SURFACES,
  MD_TEXT,
  MD_TEXT_SECONDARY,
  MD_TEXT_TERTIARY,
  MD_TYPOGRAPHY,
  withAlpha,
} from '@mylife/meds/ui';
import { ErrorState } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

const CONTACT_CATEGORIES = [
  { value: 'doctor', label: 'Doctors', icon: 'local_hospital', color: MD_ACCENT_LIGHT },
  { value: 'pharmacy', label: 'Pharmacies', icon: 'local_pharmacy', color: '#FFB877' },
  { value: 'specialist', label: 'Specialists', icon: 'stethoscope', color: '#8BCFF0' },
  { value: 'emergency', label: 'Emergency', icon: 'emergency', color: '#FF453A' },
] as const;

type ContactCategory = (typeof CONTACT_CATEGORIES)[number]['value'];

type ContactRecord = {
  id: string;
  name: string;
  title: string | null;
  category: ContactCategory;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  linkedMedications: string[];
  createdAt: string;
};

const ENSURE_CONTACT_TABLE = `
  CREATE TABLE IF NOT EXISTS md_contacts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'doctor',
    title TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    linked_medications TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`;

function ensureContactSchema(db: ReturnType<typeof useDatabase>) {
  db.execute(ENSURE_CONTACT_TABLE);

  const columns = db.query<{ name: string }>('PRAGMA table_info(md_contacts)');
  if (!columns.some((column) => column.name === 'title')) {
    try {
      db.execute('ALTER TABLE md_contacts ADD COLUMN title TEXT');
    } catch {
      // Column already exists in previously migrated local databases.
    }
  }
  if (!columns.some((column) => column.name === 'linked_medications')) {
    try {
      db.execute('ALTER TABLE md_contacts ADD COLUMN linked_medications TEXT');
    } catch {
      // Column already exists in previously migrated local databases.
    }
  }
}

function parseLinkedMedications(raw: unknown): string[] {
  if (typeof raw !== 'string' || raw.length === 0) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

function rowToContact(row: Record<string, unknown>): ContactRecord {
  return {
    id: row.id as string,
    name: row.name as string,
    title: (row.title as string) ?? null,
    category: (row.type as ContactCategory) ?? 'doctor',
    phone: (row.phone as string) ?? null,
    email: (row.email as string) ?? null,
    address: (row.address as string) ?? null,
    notes: (row.notes as string) ?? null,
    linkedMedications: parseLinkedMedications(row.linked_medications),
    createdAt: row.created_at as string,
  };
}

function Pill({
  label,
  active,
  color,
  onPress,
}: {
  label: string;
  active?: boolean;
  color: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.pill,
        { backgroundColor: active ? withAlpha(color, 0.18) : MD_SURFACES.high },
      ]}
    >
      <RNText style={[styles.pillText, { color: active ? color : MD_TEXT_SECONDARY }]}>
        {label}
      </RNText>
    </Pressable>
  );
}

export default function ContactsScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<ContactCategory>('doctor');
  const [searchQuery, setSearchQuery] = useState('');
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ContactCategory>('doctor');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [linkedMedications, setLinkedMedications] = useState<string[]>([]);

  useEffect(() => {
    try {
      ensureContactSchema(db);
      setSchemaError(null);
      setTick((value) => value + 1);
    } catch {
      setSchemaError('Failed to prepare healthcare contacts storage.');
    }
  }, [db]);

  const data = useMemo(() => {
    try {
      const medications = getActiveMedications(db);
      const contacts = db
        .query<Record<string, unknown>>(
          'SELECT * FROM md_contacts ORDER BY type ASC, name ASC',
        )
        .map(rowToContact);
      return { error: null, contacts, medications };
    } catch {
      return { error: 'Failed to load healthcare contacts.', contacts: [] as ContactRecord[], medications: [] as ReturnType<typeof getActiveMedications> };
    }
  }, [db, tick]);

  const visibleContacts = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    return data.contacts.filter((contact) => {
      if (contact.category !== activeCategory) {
        return false;
      }
      if (!trimmed) {
        return true;
      }
      return [
        contact.name,
        contact.title ?? '',
        contact.email ?? '',
        contact.phone ?? '',
        contact.address ?? '',
      ].some((field) => field.toLowerCase().includes(trimmed));
    });
  }, [activeCategory, data.contacts, searchQuery]);

  const featuredContact = visibleContacts[0] ?? null;
  const emergencyContact = data.contacts.find((contact) => contact.category === 'emergency') ?? null;

  const refresh = () => setTick((value) => value + 1);

  const resetEditor = () => {
    setEditingId(null);
    setName('');
    setTitle('');
    setCategory('doctor');
    setPhone('');
    setEmail('');
    setAddress('');
    setNotes('');
    setLinkedMedications([]);
    setEditorVisible(false);
  };

  const openCreate = () => {
    setEditingId(null);
    setName('');
    setTitle('');
    setCategory(activeCategory);
    setPhone('');
    setEmail('');
    setAddress('');
    setNotes('');
    setLinkedMedications([]);
    setEditorVisible(true);
  };

  const openEdit = (contact: ContactRecord) => {
    setEditingId(contact.id);
    setName(contact.name);
    setTitle(contact.title ?? '');
    setCategory(contact.category);
    setPhone(contact.phone ?? '');
    setEmail(contact.email ?? '');
    setAddress(contact.address ?? '');
    setNotes(contact.notes ?? '');
    setLinkedMedications(contact.linkedMedications);
    setEditorVisible(true);
  };

  const saveContact = () => {
    if (!name.trim()) {
      return;
    }

    try {
      if (editingId) {
        db.execute(
          `UPDATE md_contacts
           SET name = ?, type = ?, title = ?, phone = ?, email = ?, address = ?, notes = ?, linked_medications = ?
           WHERE id = ?`,
          [
            name.trim(),
            category,
            title.trim() || null,
            phone.trim() || null,
            email.trim() || null,
            address.trim() || null,
            notes.trim() || null,
            JSON.stringify(linkedMedications),
            editingId,
          ],
        );
      } else {
        db.execute(
          `INSERT INTO md_contacts
            (id, name, type, title, phone, email, address, notes, linked_medications, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuid(),
            name.trim(),
            category,
            title.trim() || null,
            phone.trim() || null,
            email.trim() || null,
            address.trim() || null,
            notes.trim() || null,
            JSON.stringify(linkedMedications),
            new Date().toISOString(),
          ],
        );
      }
      resetEditor();
      refresh();
    } catch {
      Alert.alert('Unable to save contact', 'Please review the entered details.');
    }
  };

  const deleteContact = (contact: ContactRecord) => {
    Alert.alert('Delete contact', `Remove ${contact.name} from your healthcare directory?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          db.execute('DELETE FROM md_contacts WHERE id = ?', [contact.id]);
          refresh();
        },
      },
    ]);
  };

  const openLink = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Unable to open', url);
    }
  };

  if (schemaError || data.error) {
    return (
      <View style={styles.errorShell}>
        <ErrorState message={schemaError ?? data.error ?? 'Failed to load contacts.'} onRetry={refresh} />
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.heroCopy}>
          <RNText style={styles.eyebrow}>Care Directory</RNText>
          <RNText style={styles.heroTitle}>Healthcare Contacts</RNText>
          <RNText style={styles.heroBody}>
            Keep doctors, pharmacies, specialists, and emergency responders in
            one searchable directory tied directly to your active meds.
          </RNText>
        </View>

        <View style={styles.toolbar}>
          <View style={styles.searchShell}>
            <MaterialSymbol color={MD_TEXT_TERTIARY} name="search" size={18} />
            <TextInput
              onChangeText={setSearchQuery}
              placeholder="Search providers or clinics"
              placeholderTextColor={MD_TEXT_TERTIARY}
              style={styles.searchInput}
              value={searchQuery}
            />
          </View>
          <Pressable onPress={openCreate} style={styles.heroButton}>
            <MaterialSymbol color="#2B1704" name="person_add" size={20} />
            <RNText style={styles.heroButtonText}>Add</RNText>
          </Pressable>
        </View>

        <View style={styles.pillRow}>
          {CONTACT_CATEGORIES.map((item) => (
            <Pill
              key={item.value}
              active={activeCategory === item.value}
              color={item.color}
              label={item.label}
              onPress={() => setActiveCategory(item.value)}
            />
          ))}
        </View>

        {featuredContact ? (
          <GlassCard padding={20}>
            <SectionHeader title="Featured Contact" />
            <View style={styles.featureCard}>
              <View style={styles.featureHero}>
                <View style={[styles.featureIcon, { backgroundColor: withAlpha(MD_ACCENT_LIGHT, 0.16) }]}>
                  <MaterialSymbol color={MD_ACCENT_LIGHT} name="contact_page" size={24} />
                </View>
                <View style={styles.featureCopy}>
                  <RNText style={styles.featureName}>{featuredContact.name}</RNText>
                  <RNText style={styles.featureRole}>
                    {featuredContact.title ?? CONTACT_CATEGORIES.find((item) => item.value === featuredContact.category)?.label ?? 'Healthcare contact'}
                  </RNText>
                  {featuredContact.address ? (
                    <RNText style={styles.featureMeta}>{featuredContact.address}</RNText>
                  ) : null}
                </View>
              </View>

              <View style={styles.detailGrid}>
                {featuredContact.phone ? (
                  <Pressable onPress={() => openLink(`tel:${featuredContact.phone}`)} style={styles.detailRow}>
                    <MaterialSymbol color={MD_ACCENT_LIGHT} name="call" size={18} />
                    <RNText style={styles.detailText}>{featuredContact.phone}</RNText>
                  </Pressable>
                ) : null}
                {featuredContact.email ? (
                  <Pressable onPress={() => openLink(`mailto:${featuredContact.email}`)} style={styles.detailRow}>
                    <MaterialSymbol color={MD_ACCENT_LIGHT} name="description" size={18} />
                    <RNText style={styles.detailText}>{featuredContact.email}</RNText>
                  </Pressable>
                ) : null}
              </View>

              {featuredContact.linkedMedications.length > 0 ? (
                <View style={styles.pillRow}>
                  {featuredContact.linkedMedications.map((medication) => (
                    <Pill key={medication} color={MD_ACCENT_LIGHT} label={medication} />
                  ))}
                </View>
              ) : null}
            </View>
          </GlassCard>
        ) : null}

        <GlassCard padding={20} style={styles.emergencyCard}>
          <SectionHeader title="Emergency" />
          {emergencyContact ? (
            <View style={styles.emergencyContent}>
              <View style={styles.featureCopy}>
                <RNText style={styles.featureName}>{emergencyContact.name}</RNText>
                <RNText style={styles.featureMeta}>
                  {emergencyContact.title ?? 'Emergency contact'}
                </RNText>
              </View>
              <Pressable
                onPress={() => emergencyContact.phone ? openLink(`tel:${emergencyContact.phone}`) : openCreate()}
                style={styles.emergencyButton}
              >
                <MaterialSymbol color="#690005" name="call" size={18} />
                <RNText style={styles.emergencyButtonText}>
                  {emergencyContact.phone ? 'Call now' : 'Add emergency line'}
                </RNText>
              </Pressable>
            </View>
          ) : (
            <RNText style={styles.emptyCopy}>
              Add an emergency line so care instructions and critical contacts are
              one tap away.
            </RNText>
          )}
        </GlassCard>

        <GlassCard padding={20}>
          <SectionHeader title={CONTACT_CATEGORIES.find((item) => item.value === activeCategory)?.label ?? 'Contacts'} />
          <View style={styles.sectionList}>
            {visibleContacts.length === 0 ? (
              <RNText style={styles.emptyCopy}>
                No contacts in this category yet. Add your next care touchpoint
                and link it to medications when relevant.
              </RNText>
            ) : (
              visibleContacts.map((contact) => {
                const meta = CONTACT_CATEGORIES.find((item) => item.value === contact.category)!;
                return (
                  <View key={contact.id} style={styles.listCard}>
                    <View style={styles.listHeader}>
                      <View style={[styles.listIcon, { backgroundColor: withAlpha(meta.color, 0.16) }]}>
                        <MaterialSymbol color={meta.color} name={meta.icon} size={18} />
                      </View>
                      <View style={styles.featureCopy}>
                        <RNText style={styles.contactName}>{contact.name}</RNText>
                        <RNText style={styles.contactMeta}>
                          {contact.title ?? meta.label}
                        </RNText>
                        {contact.address ? (
                          <RNText style={styles.contactMeta}>{contact.address}</RNText>
                        ) : null}
                      </View>
                      <Pressable onPress={() => openEdit(contact)}>
                        <MaterialSymbol color={MD_TEXT_TERTIARY} name="edit" size={18} />
                      </Pressable>
                    </View>

                    <View style={styles.actionsRow}>
                      {contact.phone ? (
                        <Pressable onPress={() => openLink(`tel:${contact.phone}`)} style={styles.actionButton}>
                          <MaterialSymbol color={meta.color} name="call" size={18} />
                          <RNText style={styles.actionButtonText}>Call</RNText>
                        </Pressable>
                      ) : null}
                      {contact.email ? (
                        <Pressable onPress={() => openLink(`mailto:${contact.email}`)} style={styles.actionButton}>
                          <MaterialSymbol color={meta.color} name="description" size={18} />
                          <RNText style={styles.actionButtonText}>Email</RNText>
                        </Pressable>
                      ) : null}
                      <Pressable onPress={() => deleteContact(contact)} style={styles.actionButton}>
                        <MaterialSymbol color="#FFB4AB" name="delete" size={18} />
                        <RNText style={[styles.actionButtonText, { color: '#FFB4AB' }]}>
                          Delete
                        </RNText>
                      </Pressable>
                    </View>

                    {contact.linkedMedications.length > 0 ? (
                      <View style={styles.pillRow}>
                        {contact.linkedMedications.map((medication) => (
                          <Pill key={`${contact.id}-${medication}`} color={MD_ACCENT_LIGHT} label={medication} />
                        ))}
                      </View>
                    ) : null}

                    {contact.notes ? (
                      <RNText style={styles.noteCopy}>{contact.notes}</RNText>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>
        </GlassCard>
      </ScrollView>

      <Modal
        animationType="slide"
        onRequestClose={resetEditor}
        transparent
        visible={editorVisible}
      >
        <Pressable onPress={resetEditor} style={styles.modalScrim}>
          <Pressable onPress={(event) => event.stopPropagation()} style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <RNText style={styles.sheetTitle}>
              {editingId ? 'Edit Contact' : 'Add Contact'}
            </RNText>

            <View style={styles.sheetFields}>
              <TextInput
                onChangeText={setName}
                placeholder="Name"
                placeholderTextColor={MD_TEXT_TERTIARY}
                style={styles.input}
                value={name}
              />
              <TextInput
                onChangeText={setTitle}
                placeholder="Title or specialty"
                placeholderTextColor={MD_TEXT_TERTIARY}
                style={styles.input}
                value={title}
              />
              <View style={styles.pillRow}>
                {CONTACT_CATEGORIES.map((item) => (
                  <Pill
                    key={item.value}
                    active={category === item.value}
                    color={item.color}
                    label={item.label}
                    onPress={() => setCategory(item.value)}
                  />
                ))}
              </View>
              <TextInput
                keyboardType="phone-pad"
                onChangeText={setPhone}
                placeholder="Phone"
                placeholderTextColor={MD_TEXT_TERTIARY}
                style={styles.input}
                value={phone}
              />
              <TextInput
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor={MD_TEXT_TERTIARY}
                style={styles.input}
                value={email}
              />
              <TextInput
                onChangeText={setAddress}
                placeholder="Address"
                placeholderTextColor={MD_TEXT_TERTIARY}
                style={styles.input}
                value={address}
              />
              <TextInput
                multiline
                onChangeText={setNotes}
                placeholder="Notes"
                placeholderTextColor={MD_TEXT_TERTIARY}
                style={[styles.input, styles.notesInput]}
                value={notes}
              />

              <View style={styles.linkedSection}>
                <RNText style={styles.linkedTitle}>Linked medications</RNText>
                <View style={styles.pillWrap}>
                  {data.medications.map((medication) => (
                    <Pill
                      key={medication.id}
                      active={linkedMedications.includes(medication.name)}
                      color={MD_ACCENT_LIGHT}
                      label={medication.name}
                      onPress={() => setLinkedMedications((current) => (
                        current.includes(medication.name)
                          ? current.filter((item) => item !== medication.name)
                          : [...current, medication.name]
                      ))}
                    />
                  ))}
                </View>
              </View>

              <Pressable onPress={saveContact} style={styles.saveButton}>
                <RNText style={styles.saveButtonText}>
                  {editingId ? 'Save Changes' : 'Add Contact'}
                </RNText>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: MD_SURFACES.base,
    flex: 1,
  },
  content: {
    gap: 16,
    padding: 20,
    paddingBottom: 140,
  },
  errorShell: {
    backgroundColor: MD_SURFACES.base,
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  heroCopy: {
    gap: 6,
  },
  eyebrow: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
  },
  heroTitle: {
    ...MD_TYPOGRAPHY.displayLg,
    color: MD_TEXT,
    fontSize: 40,
    lineHeight: 44,
  },
  heroBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  toolbar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  searchShell: {
    alignItems: 'center',
    backgroundColor: MD_SURFACES.low,
    borderRadius: 999,
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
  },
  searchInput: {
    color: MD_TEXT,
    flex: 1,
    fontFamily: MD_FONTS.regular,
    fontSize: 14,
    paddingVertical: 14,
  },
  heroButton: {
    alignItems: 'center',
    backgroundColor: '#FFDCC0',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  heroButtonText: {
    color: '#2B1704',
    fontFamily: MD_FONTS.bold,
    fontSize: 13,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pillText: {
    fontFamily: MD_FONTS.medium,
    fontSize: 12,
  },
  featureCard: {
    gap: 16,
    marginTop: 18,
  },
  featureHero: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  featureIcon: {
    alignItems: 'center',
    borderRadius: 24,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  featureCopy: {
    flex: 1,
    gap: 2,
  },
  featureName: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.bold,
    fontSize: 18,
  },
  featureRole: {
    color: MD_ACCENT_LIGHT,
    fontFamily: MD_FONTS.medium,
    fontSize: 13,
  },
  featureMeta: {
    color: MD_TEXT_SECONDARY,
    fontFamily: MD_FONTS.regular,
    fontSize: 12,
  },
  detailGrid: {
    gap: 10,
  },
  detailRow: {
    alignItems: 'center',
    backgroundColor: MD_SURFACES.low,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },
  detailText: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.medium,
    fontSize: 13,
  },
  emergencyCard: {
    backgroundColor: withAlpha('#FF453A', 0.08),
  },
  emergencyContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginTop: 18,
  },
  emergencyButton: {
    alignItems: 'center',
    backgroundColor: '#FFB4AB',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  emergencyButtonText: {
    color: '#690005',
    fontFamily: MD_FONTS.bold,
    fontSize: 13,
  },
  sectionList: {
    gap: 12,
    marginTop: 18,
  },
  emptyCopy: {
    color: MD_TEXT_SECONDARY,
    fontFamily: MD_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
  },
  listCard: {
    backgroundColor: MD_SURFACES.low,
    borderRadius: 20,
    gap: 12,
    padding: 14,
  },
  listHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  listIcon: {
    alignItems: 'center',
    borderRadius: 18,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  contactName: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.semiBold,
    fontSize: 15,
  },
  contactMeta: {
    color: MD_TEXT_SECONDARY,
    fontFamily: MD_FONTS.regular,
    fontSize: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: MD_SURFACES.high,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  actionButtonText: {
    color: MD_TEXT_SECONDARY,
    fontFamily: MD_FONTS.medium,
    fontSize: 12,
  },
  noteCopy: {
    color: MD_TEXT_TERTIARY,
    fontFamily: MD_FONTS.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  modalScrim: {
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: MD_SURFACES.low,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: 30,
  },
  sheetHandle: {
    alignSelf: 'center',
    backgroundColor: withAlpha(MD_TEXT_TERTIARY, 0.45),
    borderRadius: 999,
    height: 4,
    marginBottom: 16,
    width: 42,
  },
  sheetTitle: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.bold,
    fontSize: 20,
    marginBottom: 16,
  },
  sheetFields: {
    gap: 12,
  },
  input: {
    backgroundColor: MD_SURFACES.high,
    borderRadius: 18,
    color: MD_TEXT,
    fontFamily: MD_FONTS.regular,
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  notesInput: {
    minHeight: 88,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  linkedSection: {
    gap: 10,
  },
  linkedTitle: {
    color: MD_TEXT_TERTIARY,
    fontFamily: MD_FONTS.medium,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: MD_ACCENT_LIGHT,
    borderRadius: 18,
    paddingVertical: 14,
  },
  saveButtonText: {
    color: '#001F2A',
    fontFamily: MD_FONTS.bold,
    fontSize: 14,
  },
});
