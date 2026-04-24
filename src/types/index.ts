export type CenterType = "nonprofit" | "for-profit" | "head-start";
export type AreaEligibility = "eligible" | "maybe" | "not-eligible" | "unknown";

export interface Sponsor {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
}

export interface Center {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  county: string | null;
  phone: string | null;
  email: string | null;
  director_name: string | null;
  center_type: CenterType;
  is_licensed: boolean;
  license_number: string | null;
  licensed_capacity: number | null;
  current_enrollment: number | null;
  area_eligibility: AreaEligibility;
  frp_percentage: number | null;
  subsidy_pct: number | null;
  is_cacfp_participant: boolean;
  sponsor_id: string | null;
  sponsor?: Sponsor | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  last_verified_at: string | null;
}

export interface SearchStats {
  total_count: number;
  unsponsored_count: number;
  eligible_count: number;
  avg_capacity: number;
  nonprofit_count: number;
  forprofit_count: number;
  headstart_count: number;
  licensed_count: number;
}

export interface SearchFilters {
  query: string;
  searchType: "auto" | "zip" | "city" | "county" | "state";
  unsponsoredOnly: boolean;
  centerType: CenterType | null;
  areaEligibleOnly: boolean;
  licensedOnly: boolean;
  sortBy: "name" | "capacity-desc" | "capacity-asc" | "eligibility";
}

export interface OutreachEntry {
  id: string;
  center_id: string;
  contact_method: string;
  contact_date: string;
  contacted_by: string | null;
  notes: string | null;
  outcome: string | null;
  follow_up_date: string | null;
}
