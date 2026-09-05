export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

export interface EmergencyInfo {
  id: string;
  full_name: string | null;
  date_of_birth: string | null;
  blood_type: BloodType | null;
  allergies: string | null;
  conditions: string | null;
  emergency_contacts: string | null;
  insurance_provider: string | null;
  insurance_policy_number: string | null;
  insurance_group_number: string | null;
  primary_physician: string | null;
  physician_phone: string | null;
  organ_donor: number | null;
  notes: string | null;
  updated_at: string;
}

export interface UpdateEmergencyInfoInput {
  full_name?: string;
  date_of_birth?: string;
  blood_type?: BloodType;
  allergies?: string;
  conditions?: string;
  emergency_contacts?: string;
  insurance_provider?: string;
  insurance_policy_number?: string;
  insurance_group_number?: string;
  primary_physician?: string;
  physician_phone?: string;
  organ_donor?: boolean;
  notes?: string;
}
