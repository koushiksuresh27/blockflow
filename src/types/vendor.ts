export interface Vendor {
  id: string;
  society_id: string;
  company_name: string;
  service_type: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  contract_start: string | null;
  contract_end: string | null;
  monthly_cost: number;
  rating: number | null;
  notes: string | null;
  status: 'active' | 'expired' | 'terminated';
  created_at: string;
}

export type NewVendor = Omit<Vendor, 
  'id' | 'created_at'
>;
