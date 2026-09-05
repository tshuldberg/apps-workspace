import { useMemo, useState } from 'react';
import { ScrollView, Share, View } from 'react-native';
import { createEmergencyContact, listEmergencyContacts, listPets } from '@mylife/pets';
import { Text, colors } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import {
  EmptyPanel,
  Field,
  PETS_ACCENT,
  PetSelector,
  PrimaryButton,
  SectionCard,
  styles,
} from './_ui';

export default function EmergencyScreen() {
  const db = useDatabase();
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [hours, setHours] = useState('');
  const [notes, setNotes] = useState('');
  const [tick, setTick] = useState(0);

  const pets = useMemo(() => listPets(db), [db, tick]);
  const selectedPet = pets.find((pet) => pet.id === selectedPetId) ?? pets[0] ?? null;
  const contacts = useMemo(
    () => listEmergencyContacts(db, selectedPet?.id ?? null),
    [db, selectedPet, tick],
  );
  const primary = contacts[0] ?? null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroTitleRow}>
            <Text variant="caption" color={PETS_ACCENT}>
              Emergency
            </Text>
            <Text variant="heading">Critical contact info ready to share</Text>
            <Text variant="caption" color={colors.textSecondary}>
              Keep emergency vets, after-hours clinics, and pet-specific notes in one quick-access surface.
            </Text>
          </View>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>🚨</Text>
          </View>
        </View>
        {pets.length > 0 ? (
          <PetSelector
            pets={pets}
            selectedPetId={selectedPet?.id ?? null}
            onSelect={setSelectedPetId}
          />
        ) : null}
      </View>

      <SectionCard title="Primary resources" subtitle="Fastest numbers to reach when care turns urgent.">
        <View style={styles.stackedList}>
          <View style={styles.glassItem}>
            <Text variant="body">
              {primary ? `${primary.label}: ${primary.clinicName}` : 'No primary clinic saved'}
            </Text>
            <Text variant="caption" color={colors.textSecondary}>
              {primary ? `${primary.phone}${primary.hours ? ` · ${primary.hours}` : ''}` : 'Add a contact below'}
            </Text>
          </View>
          <View style={styles.glassItem}>
            <Text variant="body">ASPCA Poison Control</Text>
            <Text variant="caption" color={colors.textSecondary}>
              (888) 426-4435
            </Text>
          </View>
        </View>
        <PrimaryButton
          label="Share Emergency Summary"
          onPress={() => {
            void Share.share({
              message: [
                selectedPet ? `Emergency contacts for ${selectedPet.name}` : 'Emergency contacts',
                ...contacts.map(
                  (contact) =>
                    `${contact.label}: ${contact.clinicName} · ${contact.phone}${contact.address ? ` · ${contact.address}` : ''}`,
                ),
                'ASPCA Poison Control: (888) 426-4435',
              ].join('\n'),
            });
          }}
        />
      </SectionCard>

      <SectionCard title="Saved contacts" subtitle="Primary, after-hours, and care-team contacts.">
        {contacts.length === 0 ? (
          <EmptyPanel
            icon="📞"
            title="No emergency contacts yet"
            body="Add a clinic, emergency vet, or poison hotline note below."
          />
        ) : (
          <View style={styles.stackedList}>
            {contacts.map((contact) => (
              <View key={contact.id} style={styles.glassItem}>
                <Text variant="body">{contact.label}</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {contact.clinicName} · {contact.phone}
                </Text>
                {contact.address ? (
                  <Text variant="caption" color={colors.textSecondary}>
                    {contact.address}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </SectionCard>

      <SectionCard title="Add emergency contact" subtitle="Clinic, phone, hours, and optional address.">
        <Field value={label} onChangeText={setLabel} placeholder="Label" />
        <Field value={clinicName} onChangeText={setClinicName} placeholder="Clinic name" />
        <Field value={phone} onChangeText={setPhone} placeholder="Phone number" />
        <Field value={address} onChangeText={setAddress} placeholder="Address" />
        <Field value={hours} onChangeText={setHours} placeholder="Hours" />
        <Field value={notes} onChangeText={setNotes} placeholder="Notes" multiline />
        <PrimaryButton
          label="Save Contact"
          onPress={() => {
            if (!label.trim() || !clinicName.trim() || !phone.trim()) {
              return;
            }

            createEmergencyContact(db, uuid(), {
              petId: selectedPet?.id ?? null,
              label: label.trim(),
              clinicName: clinicName.trim(),
              phone: phone.trim(),
              address: address.trim() || null,
              hours: hours.trim() || null,
              notes: notes.trim() || null,
              isPrimary: contacts.length === 0,
            });
            setTick((value) => value + 1);
            setLabel('');
            setClinicName('');
            setPhone('');
            setAddress('');
            setHours('');
            setNotes('');
          }}
        />
      </SectionCard>
    </ScrollView>
  );
}
