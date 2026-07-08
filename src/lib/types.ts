export type SessionFormat = '5-a-side' | '7-a-side' | '11-a-side' | 'custom';
export type SessionStatus = 'draft' | 'open' | 'closed' | 'completed';
export type Position = 'GK' | 'DEF' | 'MID' | 'FWD' | 'ANY';
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';
export type PlayerStatus = 'registered' | 'waitlisted' | 'cancelled';
export type PaymentMethod = 'gcash' | 'maya' | 'bank' | 'cash' | 'other';
export type PaymentStatus = 'pending' | 'verified' | 'rejected';

export interface Session {
  id: string;
  title: string;
  description: string | null;
  date: string;
  location: string;
  format: SessionFormat;
  players_per_team: number;
  team_count: number;
  max_players: number;
  fee_amount: number;
  status: SessionStatus;
  teams_published: boolean;
  registered_count: number;
  created_at: string;
}

export interface Player {
  id: string;
  session_id: string;
  full_name: string;
  email: string;
  phone: string;
  preferred_team: string | null;
  preferred_position: Position;
  skill_level: SkillLevel | null;
  notes: string | null;
  status: PlayerStatus;
  checked_in_at: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  player_id: string;
  amount: number;
  method: PaymentMethod;
  reference_number: string | null;
  proof_image_path: string | null;
  status: PaymentStatus;
  created_at: string;
}

export interface Team {
  id: string;
  session_id: string;
  name: string;
  color_tag: string;
  sort_order: number;
  created_at: string;
}

export interface TeamAssignment {
  id: string;
  player_id: string;
  team_id: string;
  jersey_number: number | null;
  assigned_by: 'admin' | 'self';
  updated_at: string;
}

export interface PublicRosterRow {
  session_id: string;
  team_id: string;
  team_name: string;
  color_tag: string;
  full_name: string;
  jersey_number: number | null;
}

export interface TeamPreferenceCount {
  session_id: string;
  team_id: string;
  preference_count: number;
}

export const POSITIONS: Position[] = ['GK', 'DEF', 'MID', 'FWD', 'ANY'];
export const SKILL_LEVELS: SkillLevel[] = ['beginner', 'intermediate', 'advanced'];
export const PAYMENT_METHODS: PaymentMethod[] = ['gcash', 'maya', 'bank', 'cash', 'other'];
export const FORMAT_DEFAULTS: Record<SessionFormat, number | null> = {
  '5-a-side': 5,
  '7-a-side': 7,
  '11-a-side': 11,
  custom: null,
};
