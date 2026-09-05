import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { Text, colors } from '@mylife/ui';
import {
  getEmergencyInfo,
  updateEmergencyInfo,
  type BloodType,
  HEALTH_ACCENT,
  HEALTH_SECONDARY,
  HEALTH_SURFACES,
  HEALTH_TYPOGRAPHY,
  JAKARTA_FONTS,
  SectionHeader,
  GlassCard,
  GradientButton,
} from '@mylife/health';
import { useDatabase } from '../../components/DatabaseProvider';

const BLOOD_TYPES: BloodType[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// ---------------------------------------------------------------------------
// Contact parsing helpers
// ---------------------------------------------------------------------------

interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

function parseContacts(raw: string): EmergencyContact[] {
  if (!raw.trim()) return [];
  return raw
    .split('\n')
    .filter((l) => l.trim())
    .map((line) => {
      // Format: "Name (Relationship): Phone"
      const relMatch = line.match(/^(.+?)\s*\((.+?)\)\s*:\s*(.+)$/);
      if (relMatch) {
        return { name: relMatch[1].trim(), relationship: relMatch[2].trim(), phone: relMatch[3].trim() };
      }
      // Fallback: "Name: Phone"
      const parts = line.split(':');
      if (parts.length >= 2) {
        return { name: parts[0].trim(), relationship: '', phone: parts.slice(1).join(':').trim() };
      }
      return { name: line.trim(), relationship: '', phone: '' };
    });
}


// ---------------------------------------------------------------------------
// List item parsing (allergies, conditions, medications)
// ---------------------------------------------------------------------------

function parseList(raw: string): string[] {
  if (!raw.trim()) return [];
  return raw.split('\n').filter((l) => l.trim());
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function EmergencyInfoScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((v) => v + 1), []);

  const info = useMemo(() => {
    try { return getEmergencyInfo(db); } catch { return null; }
  }, [db, tick]);

  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [bloodType, setBloodType] = useState<BloodType | null>(null);
  const [allergies, setAllergies] = useState('');
  const [conditions, setConditions] = useState('');
  const [contacts, setContacts] = useState('');
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [physician, setPhysician] = useState('');
  const [physicianPhone, setPhysicianPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [showOnLockScreen, setShowOnLockScreen] = useState(false);
  const [organDonor, setOrganDonor] = useState(false);

  // Load existing data into form on first render
  if (info && !loaded) {
    setFullName(info.full_name ?? '');
    setDob(info.date_of_birth ?? '');
    setBloodType(info.blood_type ?? null);
    setAllergies(info.allergies ?? '');
    setConditions(info.conditions ?? '');
    setContacts(info.emergency_contacts ?? '');
    setInsuranceProvider(info.insurance_provider ?? '');
    setPolicyNumber(info.insurance_policy_number ?? '');
    setPhysician(info.primary_physician ?? '');
    setPhysicianPhone(info.physician_phone ?? '');
    setNotes(info.notes ?? '');
    setLoaded(true);
  }

  const handleSave = () => {
    try {
      updateEmergencyInfo(db, {
        full_name: fullName || undefined,
        date_of_birth: dob || undefined,
        blood_type: bloodType ?? undefined,
        allergies: allergies || undefined,
        conditions: conditions || undefined,
        emergency_contacts: contacts || undefined,
        insurance_provider: insuranceProvider || undefined,
        insurance_policy_number: policyNumber || undefined,
        primary_physician: physician || undefined,
        physician_phone: physicianPhone || undefined,
        notes: notes || undefined,
      });
      refresh();
      Alert.alert('Saved', 'Emergency info updated.');
    } catch {
      Alert.alert('Error', 'Failed to save emergency info.');
    }
  };

  const handleCall = (phone: string) => {
    const cleaned = phone.replace(/[^0-9+]/g, '');
    if (cleaned) Linking.openURL(`tel:${cleaned}`);
  };

  const parsedContacts = useMemo(() => parseContacts(contacts), [contacts]);
  const allergyList = useMemo(() => parseList(allergies), [allergies]);
  const conditionList = useMemo(() => parseList(conditions), [conditions]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ── Title ── */}
      <View style={styles.header}>
        <Text style={styles.title}>Emergency Info</Text>
        <Text style={styles.subtitle}>
          Your medical ID, stored locally on your device
        </Text>
      </View>

      {/* ── Medical ID Card ── */}
      <SectionHeader label="MEDICAL ID" title="Your Profile" />
      <GlassCard level={1} style={[styles.cardSpacing, styles.medicalIdCard]}>
        <View style={styles.medIdHeader}>
          <View style={styles.medIdBadge}>
            <Text style={styles.medIdBadgeText}>ID</Text>
          </View>
          <Text style={styles.medIdTitle}>Medical ID</Text>
        </View>

        {/* Name */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>FULL NAME</Text>
          <TextInput
            style={styles.input}
            placeholder="Full Name"
            placeholderTextColor="rgba(255,255,255,0.25)"
            value={fullName}
            onChangeText={setFullName}
          />
        </View>

        {/* Date of Birth */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>DATE OF BIRTH</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="rgba(255,255,255,0.25)"
            value={dob}
            onChangeText={setDob}
          />
        </View>

        {/* Blood Type */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>BLOOD TYPE</Text>
          <View style={styles.chipRow}>
            {BLOOD_TYPES.map((bt) => (
              <Pressable
                key={bt}
                style={[styles.chip, bloodType === bt && styles.chipActive]}
                onPress={() => setBloodType(bloodType === bt ? null : bt)}
              >
                <Text
                  style={[
                    styles.chipText,
                    bloodType === bt && styles.chipTextActive,
                  ]}
                >
                  {bt}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Organ Donor */}
        <View style={styles.toggleRow}>
          <View>
            <Text style={styles.toggleLabel}>Organ Donor</Text>
            <Text style={styles.toggleCaption}>Registered organ donor</Text>
          </View>
          <Switch
            value={organDonor}
            onValueChange={setOrganDonor}
            trackColor={{ false: HEALTH_SURFACES.focus, true: HEALTH_SECONDARY }}
            thumbColor="#FFFFFF"
          />
        </View>
      </GlassCard>

      {/* ── Medical Conditions ── */}
      <SectionHeader label="CONDITIONS" title="Medical Conditions" />
      <GlassCard level={2} style={styles.cardSpacing}>
        {conditionList.length > 0 && (
          <View style={styles.tagList}>
            {conditionList.map((c, i) => (
              <View key={i} style={styles.tag}>
                <Text style={styles.tagText}>{c}</Text>
              </View>
            ))}
          </View>
        )}
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="Add conditions (one per line)"
          placeholderTextColor="rgba(255,255,255,0.25)"
          value={conditions}
          onChangeText={setConditions}
          multiline
        />
      </GlassCard>

      {/* ── Allergies ── */}
      <SectionHeader label="ALLERGIES" title="Known Allergies" />
      <GlassCard level={2} style={styles.cardSpacing}>
        {allergyList.length > 0 && (
          <View style={styles.tagList}>
            {allergyList.map((a, i) => (
              <View key={i} style={[styles.tag, styles.tagDanger]}>
                <Text style={styles.tagDangerText}>{a}</Text>
              </View>
            ))}
          </View>
        )}
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="Add allergies (one per line)"
          placeholderTextColor="rgba(255,255,255,0.25)"
          value={allergies}
          onChangeText={setAllergies}
          multiline
        />
      </GlassCard>

      {/* ── Emergency Contacts ── */}
      <SectionHeader label="CONTACTS" title="Emergency Contacts" />
      {parsedContacts.length > 0 && (
        <GlassCard level={2} style={styles.cardSpacing}>
          {parsedContacts.map((c, i) => (
            <View
              key={i}
              style={[styles.contactRow, i > 0 && styles.contactDivider]}
            >
              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>{c.name}</Text>
                {c.relationship ? (
                  <Text style={styles.contactRelationship}>{c.relationship}</Text>
                ) : null}
                <Text style={styles.contactPhone}>{c.phone}</Text>
              </View>
              {c.phone ? (
                <Pressable
                  style={styles.callButton}
                  onPress={() => handleCall(c.phone)}
                >
                  <Text style={styles.callButtonText}>Call</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </GlassCard>
      )}
      <GlassCard level={2} style={styles.cardSpacing}>
        <Text style={styles.fieldLabel}>ADD / EDIT CONTACTS</Text>
        <Text style={styles.contactHint}>
          Format: Name (Relationship): Phone
        </Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="Jane Doe (Spouse): 555-1234"
          placeholderTextColor="rgba(255,255,255,0.25)"
          value={contacts}
          onChangeText={setContacts}
          multiline
        />
      </GlassCard>

      {/* ── Insurance ── */}
      <SectionHeader label="INSURANCE" title="Insurance Info" />
      <GlassCard level={2} style={styles.cardSpacing}>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>PROVIDER</Text>
          <TextInput
            style={styles.input}
            placeholder="Insurance Provider"
            placeholderTextColor="rgba(255,255,255,0.25)"
            value={insuranceProvider}
            onChangeText={setInsuranceProvider}
          />
        </View>
        <View style={[styles.fieldGroup, styles.fieldDivider]}>
          <Text style={styles.fieldLabel}>POLICY NUMBER</Text>
          <TextInput
            style={styles.input}
            placeholder="Policy Number"
            placeholderTextColor="rgba(255,255,255,0.25)"
            value={policyNumber}
            onChangeText={setPolicyNumber}
          />
        </View>
      </GlassCard>

      {/* ── Primary Physician ── */}
      <SectionHeader label="PHYSICIAN" title="Primary Physician" />
      <GlassCard level={2} style={styles.cardSpacing}>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>NAME</Text>
          <TextInput
            style={styles.input}
            placeholder="Physician Name"
            placeholderTextColor="rgba(255,255,255,0.25)"
            value={physician}
            onChangeText={setPhysician}
          />
        </View>
        <View style={[styles.fieldGroup, styles.fieldDivider]}>
          <Text style={styles.fieldLabel}>PHONE</Text>
          <TextInput
            style={styles.input}
            placeholder="Phone"
            placeholderTextColor="rgba(255,255,255,0.25)"
            value={physicianPhone}
            onChangeText={setPhysicianPhone}
            keyboardType="phone-pad"
          />
        </View>
      </GlassCard>

      {/* ── Notes ── */}
      <SectionHeader label="ADDITIONAL" title="Notes" />
      <GlassCard level={2} style={styles.cardSpacing}>
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="Additional notes..."
          placeholderTextColor="rgba(255,255,255,0.25)"
          value={notes}
          onChangeText={setNotes}
          multiline
        />
      </GlassCard>

      {/* ── Share / Display Settings ── */}
      <SectionHeader label="SETTINGS" title="Share & Display" />
      <GlassCard level={2} style={styles.cardSpacing}>
        <View style={styles.toggleRow}>
          <View>
            <Text style={styles.toggleLabel}>Show on Lock Screen</Text>
            <Text style={styles.toggleCaption}>
              Display emergency info on lock screen
            </Text>
          </View>
          <Switch
            value={showOnLockScreen}
            onValueChange={setShowOnLockScreen}
            trackColor={{ false: HEALTH_SURFACES.focus, true: HEALTH_ACCENT }}
            thumbColor="#FFFFFF"
          />
        </View>
      </GlassCard>

      {/* ── Save Button ── */}
      <View style={styles.buttonContainer}>
        <GradientButton title="Save Emergency Info" onPress={handleSave} />
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: HEALTH_SURFACES.depth,
  },
  content: {
    paddingBottom: 100,
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  title: {
    ...HEALTH_TYPOGRAPHY.displayLg,
    color: colors.text,
  },
  subtitle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },

  // Card spacing
  cardSpacing: {
    marginHorizontal: 16,
    marginTop: 8,
  },

  // Medical ID card -- prominent with red border glow
  medicalIdCard: {
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    shadowColor: HEALTH_ACCENT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 4,
  },
  medIdHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  medIdBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: HEALTH_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medIdBadgeText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  medIdTitle: {
    ...HEALTH_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },

  // Field groups
  fieldGroup: {
    gap: 6,
    marginBottom: 12,
  },
  fieldDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.04)',
    paddingTop: 12,
  },
  fieldLabel: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    color: colors.textSecondary,
  },

  // Inputs
  input: {
    backgroundColor: HEALTH_SURFACES.focus,
    borderRadius: 12,
    padding: 16,
    color: colors.text,
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },

  // Blood type chips
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: HEALTH_SURFACES.lift,
  },
  chipActive: {
    backgroundColor: HEALTH_ACCENT,
    borderColor: HEALTH_ACCENT,
  },
  chipText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 13,
    color: colors.text,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },

  // Toggle rows
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  toggleLabel: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 15,
    color: colors.text,
  },
  toggleCaption: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Tags (conditions / allergies)
  tagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  tag: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: HEALTH_SURFACES.highest,
  },
  tagDanger: {
    backgroundColor: 'rgba(239,68,68,0.15)',
  },
  tagText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    color: colors.text,
  },
  tagDangerText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    color: '#F87171',
  },

  // Emergency contacts
  contactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  contactDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  contactInfo: {
    flex: 1,
    gap: 2,
  },
  contactName: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 15,
    color: colors.text,
  },
  contactRelationship: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  contactPhone: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  contactHint: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: 4,
  },
  callButton: {
    backgroundColor: '#30D158',
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginLeft: 12,
  },
  callButtonText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 13,
    color: '#FFFFFF',
  },

  // Save button area
  buttonContainer: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
});
