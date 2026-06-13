export interface CommunityComplaint {
  id: string;
  society_id: string;
  tower_id: string | null;
  asset_type: AssetType;
  asset_label: string;
  title: string;
  description: string | null;
  status: 'reported' | 'in_progress' | 'resolved';
  affected_count: number;
  assigned_tech_id: string | null;
  reported_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface CommunityComplaintUpdate {
  id: string;
  complaint_id: string;
  status: 'reported' | 'in_progress' | 'resolved';
  message: string;
  updated_by: string | null;
  created_at: string;
}

export interface CommunityComplaintAffected {
  id: string;
  complaint_id: string;
  resident_id: string;
  joined_at: string;
}

export type AssetType =
  | 'lift'
  | 'gym'
  | 'pool'
  | 'generator'
  | 'corridor'
  | 'parking'
  | 'terrace'
  | 'water'
  | 'power'
  | 'other';

export type NewCommunityComplaint = Omit<
  CommunityComplaint,
  'id' | 'created_at' | 'affected_count' |
  'assigned_tech_id' | 'resolved_at'
>;
