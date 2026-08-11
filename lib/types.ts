export type Role = 'admin' | 'volunteer';

export interface Profile {
  id: string;
  full_name: string;
  role: Role;
}

export interface Registrant {
  id: string;
  event_id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  full_name: string;
  age: number | null;
  gender: 'male' | 'female' | null;
  church: string | null;
  city: string | null;
  state: string | null;
  country: string;
  email: string | null;
  phone: string | null;
  merch_size: string | null;
  registration_status: 'registered' | 'walk_in' | 'cancelled';
  cabin: string | null;
  small_group: string | null;
  liability_complete: boolean;
  liability_submitted_at: string | null;
  checked_in_at: string | null;
  checked_in_by: string | null;
  emergency_name: string | null;
  emergency_relationship: string | null;
  emergency_phone: string | null;
  medical_notes: string | null;
  allergies: string | null;
  special_notes: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditRow {
  id: number;
  registrant_id: string | null;
  actor_id: string | null;
  action: string;
  detail: unknown;
  created_at: string;
}
