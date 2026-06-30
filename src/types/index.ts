export type LeadStatus =
  | 'New'
  | 'Audited'
  | 'Message Generated'
  | 'Contacted'
  | 'Interested'
  | 'Not Interested'
  | 'Closed';

export type SearchStatus = 'pending' | 'running' | 'completed';

export interface LeadSearch {
  id: string;
  user_id: string;
  niche: string;
  location: string;
  service_offer: string;
  language: string;
  status: SearchStatus;
  created_at: string;
  leads_count?: number;
}

export interface Lead {
  id: string;
  user_id: string;
  lead_search_id: string | null;
  business_name: string;
  industry: string;
  location: string;
  address: string;
  website: string;
  phone: string;
  email: string;
  google_rating: number | null;
  reviews_count: number;
  google_maps_url: string;
  lead_score: number;
  status: LeadStatus;
  created_at: string;
}

export interface LeadAudit {
  id: string;
  lead_id: string;
  website_score: number;
  seo_score: number;
  conversion_score: number;
  main_issues: string[];
  recommended_offer: string;
  personalization_angle: string;
  summary: string;
  created_at: string;
}

export interface OutreachMessage {
  id: string;
  lead_id: string;
  channel: 'email' | 'dm';
  language: string;
  tone: string;
  subject: string;
  body: string;
  created_at: string;
}

export interface UserSettings {
  agency_name?: string;
  agency_website?: string;
  default_language?: string;
  default_tone?: string;
}

// Re-export UserProfile from plans so it's accessible from types
export type { UserProfile } from '../lib/plans';
