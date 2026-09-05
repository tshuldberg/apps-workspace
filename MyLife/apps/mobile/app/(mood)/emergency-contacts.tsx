import { useCallback, useMemo, useState } from 'react';
import { uuid } from '../../lib/uuid';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  Text as RNText,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Phone, Plus, Shield, Trash2 } from 'lucide-react-native';
import {
  createEmergencyContact,
  getEmergencyContacts,
  deleteEmergencyContact,
  type EmergencyContact,
  GlassCard,
  GradientButton,
  MOOD_TYPOGRAPHY,
  MOOD_SURFACES,
  MOOD_ACCENT,
} from '@mylife/mood';
import { useDatabase } from '../../components/DatabaseProvider';

const SOS_GREEN = '#34D399';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#9F8E81';
const TEXT_MUTED = 'rgba(255,255,255,0.4)';

export default function EmergencyContactsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRelationship, setFormRelationship] = useState('');

  const contacts = useMemo(() => getEmergencyContacts(db), [db, tick]);

  const handleAdd = useCallback(() => {
    if (!formName.trim()) return;
    createEmergencyContact(db, uuid(), {
      name: formName.trim(),
      phone: formPhone.trim() || null,
      relationship: formRelationship.trim() || null,
    });
    setFormName('');
    setFormPhone('');
    setFormRelationship('');
    setShowForm(false);
    setTick((t) => t + 1);
  }, [db, formName, formPhone, formRelationship]);

  const handleDelete = useCallback((contact: EmergencyContact) => {
    Alert.alert(
      'Remove Contact',
      `Remove ${contact.name} from emergency contacts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            deleteEmergencyContact(db, contact.id);
            setTick((t) => t + 1);
          },
        },
      ],
    );
  }, [db]);

  const handleCall = useCallback((phone: string) => {
    Linking.openURL(`tel:${phone}`);
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={22} color={TEXT_PRIMARY} />
        </Pressable>
        <RNText style={styles.headerTitle}>SOS Contacts</RNText>
        <View style={{ width: 22 }} />
      </View>

      {/* Hero section */}
      <View style={styles.heroSection}>
        <View style={styles.heroIcon}>
          <Shield size={28} color={MOOD_ACCENT} />
        </View>
        <RNText style={styles.heroText}>
          In case of a crisis, your SOS contacts are reachable with a single tap
          from the quick access screen.
        </RNText>
      </View>

      {/* Your Circle header + Add button */}
      <View style={styles.circleHeader}>
        <RNText style={styles.circleTitle}>Your Circle</RNText>
        <Pressable
          style={styles.addBtn}
          onPress={() => setShowForm(!showForm)}
        >
          <Plus size={14} color={MOOD_ACCENT} />
          <RNText style={styles.addBtnText}>
            {showForm ? 'Cancel' : 'Add Contact'}
          </RNText>
        </Pressable>
      </View>

      {/* Add form */}
      {showForm && (
        <GlassCard level={2} style={styles.formCard}>
          <RNText style={styles.formTitle}>New Contact</RNText>
          <TextInput
            style={styles.input}
            placeholder="Name (required)"
            placeholderTextColor={TEXT_MUTED}
            value={formName}
            onChangeText={setFormName}
            maxLength={100}
          />
          <TextInput
            style={styles.input}
            placeholder="Phone number"
            placeholderTextColor={TEXT_MUTED}
            value={formPhone}
            onChangeText={setFormPhone}
            keyboardType="phone-pad"
            maxLength={30}
          />
          <TextInput
            style={styles.input}
            placeholder="Relationship (e.g., Therapist, Family)"
            placeholderTextColor={TEXT_MUTED}
            value={formRelationship}
            onChangeText={setFormRelationship}
            maxLength={50}
          />
          <GradientButton title="Save Contact" onPress={handleAdd} />
        </GlassCard>
      )}

      {/* Contact list */}
      {contacts.map((contact: EmergencyContact) => (
        <View key={contact.id} style={styles.contactRow}>
          {/* Avatar */}
          <View style={styles.avatar}>
            <RNText style={styles.avatarText}>
              {contact.name.charAt(0).toUpperCase()}
            </RNText>
          </View>

          {/* Info */}
          <View style={styles.contactInfo}>
            <RNText style={styles.contactName}>
              {contact.name}
              {contact.relationship ? ` (${contact.relationship})` : ''}
            </RNText>
            {contact.phone && (
              <RNText style={styles.contactPhone}>{contact.phone}</RNText>
            )}
          </View>

          {/* Actions */}
          <View style={styles.contactActions}>
            {contact.phone && (
              <Pressable
                style={styles.callBtn}
                onPress={() => handleCall(contact.phone!)}
                hitSlop={8}
              >
                <Phone size={18} color={SOS_GREEN} />
              </Pressable>
            )}
            <Pressable
              onPress={() => handleDelete(contact)}
              hitSlop={8}
            >
              <Trash2 size={16} color={TEXT_MUTED} />
            </Pressable>
          </View>
        </View>
      ))}

      {/* Empty state */}
      {contacts.length === 0 && !showForm && (
        <GlassCard level={1} style={styles.emptyCard}>
          <Shield size={24} color={TEXT_MUTED} />
          <RNText style={styles.emptyText}>
            Add trusted contacts who you can reach out to when you need support.
          </RNText>
        </GlassCard>
      )}

      {/* Footer note */}
      <GlassCard level={1} style={styles.footerCard}>
        <Shield size={20} color={TEXT_MUTED} />
        <RNText style={styles.footerText}>
          Add up to 5 emergency contacts for your safety net.
        </RNText>
      </GlassCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MOOD_SURFACES.depth,
  },
  content: {
    paddingBottom: 40,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 12,
  },
  headerTitle: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 18,
    color: MOOD_ACCENT,
    lineHeight: 24,
  },

  // Hero
  heroSection: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 24,
    gap: 16,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: MOOD_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    lineHeight: 22,
    color: TEXT_SECONDARY,
    textAlign: 'center',
  },

  // Circle header
  circleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  circleTitle: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    color: TEXT_PRIMARY,
    lineHeight: 28,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: MOOD_SURFACES.lift,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addBtnText: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    color: MOOD_ACCENT,
    lineHeight: 18,
  },

  // Form
  formCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  formTitle: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    color: TEXT_PRIMARY,
    lineHeight: 22,
  },
  input: {
    fontFamily: MOOD_TYPOGRAPHY.bodyMd.fontFamily,
    fontSize: 15,
    lineHeight: 22,
    color: TEXT_PRIMARY,
    padding: 14,
    backgroundColor: MOOD_SURFACES.focus,
    borderRadius: 12,
  },

  // Contact row
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: MOOD_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 18,
    color: TEXT_PRIMARY,
    lineHeight: 24,
  },
  contactInfo: {
    flex: 1,
    gap: 2,
  },
  contactName: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    color: TEXT_PRIMARY,
    lineHeight: 22,
  },
  contactPhone: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    color: TEXT_SECONDARY,
    lineHeight: 18,
  },
  contactActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty state
  emptyCard: {
    marginHorizontal: 20,
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  emptyText: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    lineHeight: 22,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    paddingHorizontal: 16,
  },

  // Footer
  footerCard: {
    marginHorizontal: 20,
    marginTop: 24,
    alignItems: 'center',
    paddingVertical: 24,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    borderStyle: 'dashed',
  },
  footerText: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    lineHeight: 20,
    color: TEXT_MUTED,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
