export type LeadStatus =
  | 'New'
  | 'Audited'
  | 'Message Generated'
  | 'Contacted'
  | 'Interested'
  | 'Not Interested'
  | 'Closed';

export type SearchStatus = 'pending' | 'running' | 'completed';
export type WebsiteStatusFilter = 'all' | 'has_website' | 'no_website' | 'social_only';

export interface LeadSearch {
  id: string;
  user_id: string;
  niche: string;
  location: string;
  service_offer: string;
  language: string;
  status: SearchStatus;
  website_status_filter?: WebsiteStatusFilter;
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

export interface SeoContentPack {
  suggested_keywords: {
    primary: string[];
    local: string[];
    service: string[];
    long_tail: string[];
  };
  meta_title: string;
  meta_description: string;
  h1_suggestion: string;
  service_page_ideas: string[];
  blog_post_ideas: string[];
  google_business_posts: string[];
  homepage_copy: {
    headline: string;
    subheadline: string;
    cta: string;
  };
  recommended_service: {
    service_name: string;
    why_sell_this: string;
    deliverables: string[];
  };
  suggested_pricing: {
    market_detected: string;
    one_time_setup: string;
    monthly_retainer: string;
    currency: string;
    pricing_reason: string;
  };
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
  seo_content_pack?: SeoContentPack;
  share_token?: string | null;
  shared_at?: string | null;
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
  openai_api_key?: string;
  google_places_api_key?: string;
  agency_name?: string;
  agency_website?: string;
  default_language?: string;
  default_tone?: string;
}

// Re-export UserProfile from plans so it's accessible from types
export type { UserProfile } from '../lib/plans';


export type PublicSeoContentPack = Omit<SeoContentPack, 'suggested_pricing'>;

export interface SharedAuditReport {
  business_name: string;
  website: string;
  location: string;
  lead_score: number | null;
  website_score: number;
  seo_score: number;
  conversion_score: number;
  main_issues: string[];
  recommended_offer: string;
  personalization_angle: string;
  summary: string;
  seo_content_pack?: PublicSeoContentPack | null;
  shared_at: string | null;
}

export interface WebsitePreview {
  preview_token: string;
  created_at: string;
}


export interface WebsitePreviewImage {
  url: string;
  alt: string;
  photographer?: string;
  source: 'pexels';
  source_url?: string;
}

export interface WebsitePreviewImages {
  hero: WebsitePreviewImage;
  gallery: WebsitePreviewImage[];
}

export interface WebsitePreviewData {
  business_name: string;
  industry: string;
  location: string;
  website: string;
  meta_title: string;
  hero_headline: string;
  subheadline: string;
  cta_text: string;
  services: Array<{ title: string; description: string }>;
  why_choose_us: string[];
  about_intro: string;
  contact: {
    headline: string;
    body: string;
    website: string;
    location: string;
  };
  images?: WebsitePreviewImages;
  visual_theme?: {
    design_variant_id?: string;
    structure_variant?: "classic" | "service_first" | "gallery_first" | "story_driven" | "trust_first" | "cta_focused" | "editorial" | "project_showcase";
    layout_variant?: "medical" | "construction" | "restaurant" | "beauty" | "auto" | "professional";
    color_theme?: string;
    hero_style?: "split" | "bold" | "gallery" | "editorial" | "minimal" | "magazine" | "service";
    section_order?: string[];
    card_style?: "rounded" | "sharp" | "glass" | "editorial" | "bordered" | "shadow";
    visual_density?: "minimal" | "balanced" | "rich";
    accent_style?: "soft" | "bold" | "premium" | "warm" | "technical";
    image_style?: "clean" | "cinematic" | "editorial" | "project" | "gallery" | "luxury";
    industry_style: string;
    hero_visual_title: string;
    hero_visual_description: string;
    image_keywords: string[];
    gallery_cards: Array<{ title: string; description: string; image_prompt?: string; image_alt?: string }>;
    image_sections?: Array<{ title: string; description: string; image_alt: string; image_url?: string; visual_type: "hero" | "gallery" | "service" | "trust" | "cta" }>;
  };
}
