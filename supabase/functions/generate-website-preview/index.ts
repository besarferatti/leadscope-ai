import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type UserProfile = { id: string; role: "admin" | "user" };
type Lead = { id: string; user_id: string; business_name: string; industry: string; location: string; website: string };
type Audit = {
  summary: string | null;
  main_issues: string[] | null;
  recommended_offer: string | null;
  seo_content_pack?: {
    meta_title?: string;
    homepage_copy?: { headline?: string; subheadline?: string; cta?: string };
    suggested_keywords?: { primary?: string[]; local?: string[]; service?: string[]; long_tail?: string[] };
    recommended_service?: { service_name?: string; why_sell_this?: string; deliverables?: string[] };
    service_page_ideas?: string[];
    blog_post_ideas?: string[];
    google_business_posts?: string[];
  } | null;
};

type CanonicalIndustry = "dental" | "plumbing" | "electrician" | "roofing" | "hvac" | "construction" | "restaurant" | "cafe" | "beauty" | "auto" | "cleaning" | "landscaping" | "pest_control" | "moving" | "law" | "real_estate" | "fitness" | "hotel" | "accounting" | "veterinary" | "it_services" | "marketing" | "professional";
type LayoutVariant = "medical" | "construction" | "restaurant" | "beauty" | "auto" | "professional";
type HeroStyle = "split" | "bold" | "gallery" | "editorial" | "minimal" | "magazine" | "service";
type CardStyle = "rounded" | "sharp" | "glass" | "editorial" | "bordered" | "shadow";
type VisualDensity = "minimal" | "balanced" | "rich";
type AccentStyle = "soft" | "bold" | "premium" | "warm" | "technical";
type ImageStyle = "clean" | "cinematic" | "editorial" | "project" | "gallery" | "luxury";
type StructureVariant = "classic" | "service_first" | "gallery_first" | "story_driven" | "trust_first" | "cta_focused" | "editorial" | "project_showcase";
type PreviewImage = { url: string; alt: string; photographer?: string; source: "pexels"; source_url?: string };
type PreviewImages = { hero: PreviewImage; gallery: PreviewImage[] };

type VisualTheme = {
  design_variant_id: string;
  structure_variant: StructureVariant;
  layout_variant: LayoutVariant;
  color_theme: string;
  hero_style: HeroStyle;
  section_order: string[];
  card_style: CardStyle;
  visual_density: VisualDensity;
  accent_style: AccentStyle;
  image_style: ImageStyle;
  industry_style: string;
  hero_visual_title: string;
  hero_visual_description: string;
  image_keywords: string[];
  gallery_cards: Array<{ title: string; description: string; image_prompt?: string; image_alt?: string }>;
  image_sections: Array<{ title: string; description: string; image_alt: string; visual_type: "hero" | "gallery" | "service" | "trust" | "cta" }>;
};

type DesignVariant = Pick<VisualTheme, "design_variant_id" | "structure_variant" | "layout_variant" | "color_theme" | "hero_style" | "section_order" | "card_style" | "visual_density" | "accent_style" | "image_style">;
type PreviousDesign = Partial<DesignVariant>;

const allowedSections = ["trust", "services", "service_detail", "about", "story", "process", "projects", "gallery", "experience", "testimonial", "testimonials", "why_us", "cta", "contact", "quote_cta", "featured_service"] as const;
const structureVariants: StructureVariant[] = ["classic", "service_first", "gallery_first", "story_driven", "trust_first", "cta_focused", "editorial", "project_showcase"];
const STRUCTURE_ORDERS: Record<StructureVariant, string[]> = {
  classic: ["trust", "services", "about", "gallery", "why_us", "contact"],
  service_first: ["services", "service_detail", "why_us", "testimonial", "contact"],
  gallery_first: ["gallery", "services", "experience", "testimonial", "contact"],
  story_driven: ["about", "story", "process", "services", "trust", "contact"],
  trust_first: ["trust", "testimonial", "services", "about", "contact"],
  cta_focused: ["cta", "services", "why_us", "gallery", "contact"],
  editorial: ["story", "featured_service", "gallery", "services", "contact"],
  project_showcase: ["projects", "process", "services", "why_us", "quote_cta"],
};
const heroStyles: HeroStyle[] = ["split", "bold", "gallery", "editorial", "minimal", "magazine", "service"];
const cardStyles: CardStyle[] = ["rounded", "sharp", "glass", "editorial", "bordered", "shadow"];
const densityStyles: VisualDensity[] = ["minimal", "balanced", "rich"];
const accentStyles: AccentStyle[] = ["soft", "bold", "premium", "warm", "technical"];

function pickRandom<T>(items: T[]): T { return items[crypto.getRandomValues(new Uint32Array(1))[0] % items.length]; }
function getDesignVariantPools(layout: LayoutVariant): DesignVariant[] {
  const pools: Record<LayoutVariant, DesignVariant[]> = {
    medical: [
      { design_variant_id: "medical-clean", structure_variant: "trust_first", layout_variant: "medical", color_theme: "white-blue", hero_style: "split", section_order: ["trust", "services", "experience", "cta"], card_style: "rounded", visual_density: "balanced", accent_style: "soft", image_style: "clean" },
      { design_variant_id: "medical-premium", structure_variant: "classic", layout_variant: "medical", color_theme: "navy-white", hero_style: "editorial", section_order: ["services", "trust", "experience", "cta"], card_style: "shadow", visual_density: "rich", accent_style: "premium", image_style: "editorial" },
      { design_variant_id: "medical-soft", structure_variant: "cta_focused", layout_variant: "medical", color_theme: "light-blue-cream", hero_style: "minimal", section_order: ["experience", "trust", "services", "cta"], card_style: "glass", visual_density: "minimal", accent_style: "soft", image_style: "clean" },
      { design_variant_id: "medical-modern", structure_variant: "service_first", layout_variant: "medical", color_theme: "bright-minimal", hero_style: "service", section_order: ["services", "experience", "trust", "cta"], card_style: "bordered", visual_density: "balanced", accent_style: "bold", image_style: "gallery" },
    ],
    construction: [
      { design_variant_id: "construction-bold", structure_variant: "project_showcase", layout_variant: "construction", color_theme: "dark-amber", hero_style: "bold", section_order: ["experience", "services", "trust", "cta"], card_style: "sharp", visual_density: "rich", accent_style: "bold", image_style: "project" },
      { design_variant_id: "construction-projects", structure_variant: "project_showcase", layout_variant: "construction", color_theme: "white-gray", hero_style: "gallery", section_order: ["experience", "trust", "services", "cta"], card_style: "bordered", visual_density: "balanced", accent_style: "technical", image_style: "gallery" },
      { design_variant_id: "construction-industrial", structure_variant: "service_first", layout_variant: "construction", color_theme: "black-orange", hero_style: "service", section_order: ["services", "experience", "trust", "cta"], card_style: "shadow", visual_density: "rich", accent_style: "bold", image_style: "project" },
      { design_variant_id: "construction-modern", structure_variant: "story_driven", layout_variant: "construction", color_theme: "architectural-clean", hero_style: "split", section_order: ["trust", "experience", "services", "cta"], card_style: "editorial", visual_density: "minimal", accent_style: "premium", image_style: "cinematic" },
    ],
    restaurant: [
      { design_variant_id: "restaurant-warm", structure_variant: "gallery_first", layout_variant: "restaurant", color_theme: "cream-amber", hero_style: "gallery", section_order: ["experience", "services", "trust", "cta"], card_style: "rounded", visual_density: "rich", accent_style: "warm", image_style: "gallery" },
      { design_variant_id: "restaurant-elegant", structure_variant: "editorial", layout_variant: "restaurant", color_theme: "dark-luxury", hero_style: "editorial", section_order: ["services", "experience", "trust", "cta"], card_style: "editorial", visual_density: "balanced", accent_style: "premium", image_style: "luxury" },
      { design_variant_id: "restaurant-modern", structure_variant: "cta_focused", layout_variant: "restaurant", color_theme: "minimal-white", hero_style: "minimal", section_order: ["services", "trust", "experience", "cta"], card_style: "bordered", visual_density: "minimal", accent_style: "soft", image_style: "clean" },
      { design_variant_id: "restaurant-cozy", structure_variant: "story_driven", layout_variant: "restaurant", color_theme: "warm-cafe", hero_style: "split", section_order: ["experience", "trust", "services", "cta"], card_style: "glass", visual_density: "balanced", accent_style: "warm", image_style: "editorial" },
    ],
    beauty: [
      { design_variant_id: "beauty-luxury", structure_variant: "editorial", layout_variant: "beauty", color_theme: "rose-cream", hero_style: "editorial", section_order: ["experience", "services", "trust", "cta"], card_style: "editorial", visual_density: "balanced", accent_style: "premium", image_style: "luxury" },
      { design_variant_id: "beauty-modern", structure_variant: "cta_focused", layout_variant: "beauty", color_theme: "white-black", hero_style: "minimal", section_order: ["services", "experience", "trust", "cta"], card_style: "sharp", visual_density: "minimal", accent_style: "bold", image_style: "clean" },
      { design_variant_id: "beauty-glam", structure_variant: "gallery_first", layout_variant: "beauty", color_theme: "bold-rose", hero_style: "gallery", section_order: ["experience", "trust", "services", "cta"], card_style: "shadow", visual_density: "rich", accent_style: "bold", image_style: "gallery" },
      { design_variant_id: "beauty-soft", structure_variant: "trust_first", layout_variant: "beauty", color_theme: "pastel", hero_style: "split", section_order: ["trust", "services", "experience", "cta"], card_style: "rounded", visual_density: "balanced", accent_style: "soft", image_style: "editorial" },
    ],
    auto: [
      { design_variant_id: "auto-technical", structure_variant: "service_first", layout_variant: "auto", color_theme: "gray-blue", hero_style: "service", section_order: ["services", "trust", "experience", "cta"], card_style: "bordered", visual_density: "balanced", accent_style: "technical", image_style: "clean" },
      { design_variant_id: "auto-bold", structure_variant: "trust_first", layout_variant: "auto", color_theme: "dark-blue", hero_style: "bold", section_order: ["trust", "services", "experience", "cta"], card_style: "sharp", visual_density: "rich", accent_style: "bold", image_style: "cinematic" },
      { design_variant_id: "auto-clean", structure_variant: "cta_focused", layout_variant: "auto", color_theme: "white-blue", hero_style: "split", section_order: ["services", "experience", "trust", "cta"], card_style: "rounded", visual_density: "minimal", accent_style: "soft", image_style: "clean" },
      { design_variant_id: "auto-garage", structure_variant: "classic", layout_variant: "auto", color_theme: "industrial", hero_style: "gallery", section_order: ["experience", "services", "trust", "cta"], card_style: "shadow", visual_density: "rich", accent_style: "technical", image_style: "project" },
    ],
    professional: [
      { design_variant_id: "professional-clean", structure_variant: "classic", layout_variant: "professional", color_theme: "slate-blue", hero_style: "split", section_order: ["services", "trust", "experience", "cta"], card_style: "rounded", visual_density: "balanced", accent_style: "soft", image_style: "clean" },
      { design_variant_id: "professional-bold", structure_variant: "service_first", layout_variant: "professional", color_theme: "charcoal", hero_style: "bold", section_order: ["trust", "services", "experience", "cta"], card_style: "sharp", visual_density: "rich", accent_style: "bold", image_style: "cinematic" },
      { design_variant_id: "professional-premium", structure_variant: "story_driven", layout_variant: "professional", color_theme: "navy-gold", hero_style: "editorial", section_order: ["experience", "services", "trust", "cta"], card_style: "editorial", visual_density: "balanced", accent_style: "premium", image_style: "luxury" },
      { design_variant_id: "professional-local", structure_variant: "cta_focused", layout_variant: "professional", color_theme: "warm-local", hero_style: "service", section_order: ["services", "experience", "trust", "cta"], card_style: "glass", visual_density: "minimal", accent_style: "warm", image_style: "gallery" },
    ],
  };
  return pools[layout];
}

function normalizeSectionOrder(value: unknown, selectedStructureVariant: StructureVariant) {
  const fallback = STRUCTURE_ORDERS[selectedStructureVariant] || STRUCTURE_ORDERS.classic;
  const allowed = new Set<string>(allowedSections);
  if (!Array.isArray(value)) return [...fallback];

  const normalized = value.filter((item): item is string => typeof item === "string" && allowed.has(item) && item !== "hero");
  const deduped = [...new Set(normalized)].slice(0, 7);
  if (deduped.length < 5) return [...fallback];

  const finalCta = deduped.find((item) => item === "contact" || item === "quote_cta") || fallback.find((item) => item === "contact" || item === "quote_cta") || "contact";
  const withoutFinalCta = deduped.filter((item) => item !== finalCta);
  const withFinalCta = [...withoutFinalCta, finalCta].slice(0, 7);
  if (!withFinalCta.includes(finalCta)) withFinalCta[withFinalCta.length - 1] = finalCta;
  return withFinalCta;
}

function getStructureSectionOrder(structureVariant: StructureVariant) {
  return normalizeSectionOrder(STRUCTURE_ORDERS[structureVariant], structureVariant);
}

function getPreferredStructureVariants(industry: string): StructureVariant[] {
  if (matchesIndustry(industry, ["dental", "dentist", "orthodont", "clinic", "medical", "health"])) return ["trust_first", "classic", "cta_focused", "service_first"];
  if (matchesIndustry(industry, ["construction", "contractor", "remodel", "renovation", "builder", "roofing", "plumb", "electric"])) return ["project_showcase", "service_first", "story_driven", "cta_focused"];
  if (matchesIndustry(industry, ["restaurant", "cafe", "coffee", "food", "bar", "bistro"])) return ["gallery_first", "editorial", "story_driven", "cta_focused"];
  if (matchesIndustry(industry, ["salon", "beauty", "spa", "hair", "barber", "nail", "esthetic"])) return ["editorial", "gallery_first", "cta_focused", "trust_first"];
  if (matchesIndustry(industry, ["auto", "mechanic", "vehicle", "car", "repair", "garage", "tire"])) return ["service_first", "trust_first", "cta_focused", "classic"];
  return ["classic", "service_first", "story_driven", "cta_focused"];
}
function varyDesignVariant(base: DesignVariant, previous: PreviousDesign[]): DesignVariant {
  const usedHeroes = new Set(previous.map((item) => item.hero_style).filter(Boolean));
  const usedCards = new Set(previous.map((item) => item.card_style).filter(Boolean));
  return {
    ...base,
    section_order: getStructureSectionOrder(base.structure_variant),
    hero_style: pickRandom(heroStyles.filter((item) => !usedHeroes.has(item)).length ? heroStyles.filter((item) => !usedHeroes.has(item)) : heroStyles),
    card_style: pickRandom(cardStyles.filter((item) => !usedCards.has(item)).length ? cardStyles.filter((item) => !usedCards.has(item)) : cardStyles),
    visual_density: pickRandom(densityStyles),
    accent_style: pickRandom(accentStyles),
  };
}
function selectStructureVariant(industry: string, previous: PreviousDesign[]): StructureVariant {
  const preferred = getPreferredStructureVariants(industry);
  const usedStructures = new Set(previous.map((item) => item.structure_variant).filter(Boolean));
  const unused = preferred.filter((item) => !usedStructures.has(item));
  return pickRandom(unused.length ? unused : preferred);
}

function selectDesignVariant(layout: LayoutVariant, previous: PreviousDesign[], industry = ""): DesignVariant {
  const preferred = getPreferredStructureVariants(industry);
  const usedDesigns = new Set(previous.map((item) => item.design_variant_id).filter(Boolean));
  const usedStructures = new Set(previous.map((item) => item.structure_variant).filter(Boolean));
  const layoutPool = getDesignVariantPools(layout);
  const preferredPool = layoutPool.filter((item) => preferred.includes(item.structure_variant));
  const pool = preferredPool.length ? preferredPool : layoutPool;
  const preferredUnused = pool.filter((item) => !usedStructures.has(item.structure_variant));
  const designUnused = (preferredUnused.length ? preferredUnused : pool).filter((item) => !usedDesigns.has(item.design_variant_id));
  const selected = pickRandom(designUnused.length ? designUnused : preferredUnused.length ? preferredUnused : pool);
  const shouldVary = !designUnused.length || usedStructures.has(selected.structure_variant);
  const variant = shouldVary ? varyDesignVariant(selected, previous) : selected;
  return { ...variant, section_order: getStructureSectionOrder(variant.structure_variant) };
}

type WebsitePreviewData = {
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
  contact: { headline: string; body: string; website: string; location: string };
  visual_theme: VisualTheme;
  images?: PreviewImages;
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function errorResponse(message: string, status = 400) { return jsonResponse({ error: message }, status); }
function cleanJson(content: string) { return content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim(); }
function createPreviewToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}
function asStringArray(value: unknown, fallback: string[] = []) {
  if (!Array.isArray(value)) return fallback;
  return value.filter((item): item is string => typeof item === "string");
}
function asServices(value: unknown, fallback: WebsitePreviewData["services"]) {
  if (!Array.isArray(value)) return fallback;
  const services = value
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({ title: asString(item.title), description: asString(item.description) }))
    .filter((item) => item.title || item.description);
  return services.length > 0 ? services : fallback;
}

function asGalleryCards(value: unknown, fallback: VisualTheme["gallery_cards"]) {
  if (!Array.isArray(value)) return fallback;
  const cards = value
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({ title: asString(item.title), description: asString(item.description), image_prompt: asString(item.image_prompt), image_alt: asString(item.image_alt) }))
    .filter((item) => item.title || item.description);
  return cards.length > 0 ? cards.slice(0, 4) : fallback;
}
function asImageSections(value: unknown, fallback: VisualTheme["image_sections"]) {
  if (!Array.isArray(value)) return fallback;
  const allowed = new Set(["hero", "gallery", "service", "trust", "cta"]);
  const sections = value
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({ title: asString(item.title), description: asString(item.description), image_alt: asString(item.image_alt), visual_type: allowed.has(asString(item.visual_type)) ? asString(item.visual_type) as VisualTheme["image_sections"][number]["visual_type"] : "gallery" }))
    .filter((item) => item.title || item.description || item.image_alt);
  return sections.length > 0 ? sections.slice(0, 5) : fallback;
}
function asEnum<T extends string>(value: unknown, fallback: T, allowed: readonly T[]): T { return typeof value === "string" && (allowed as readonly string[]).includes(value) ? value as T : fallback; }
function asVisualTheme(value: unknown, fallback: VisualTheme): VisualTheme {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return fallback;
  const theme = value as Record<string, unknown>;
  return {
    design_variant_id: asString(theme.design_variant_id, fallback.design_variant_id),
    structure_variant: asEnum(theme.structure_variant, fallback.structure_variant, structureVariants),
    layout_variant: asEnum(theme.layout_variant, fallback.layout_variant, ["medical", "construction", "restaurant", "beauty", "auto", "professional"]),
    color_theme: asString(theme.color_theme, fallback.color_theme),
    hero_style: asEnum(theme.hero_style, fallback.hero_style, heroStyles),
    section_order: normalizeSectionOrder(theme.section_order, fallback.structure_variant),
    card_style: asEnum(theme.card_style, fallback.card_style, cardStyles),
    visual_density: asEnum(theme.visual_density, fallback.visual_density, densityStyles),
    accent_style: asEnum(theme.accent_style, fallback.accent_style, accentStyles),
    image_style: asEnum(theme.image_style, fallback.image_style, ["clean", "cinematic", "editorial", "project", "gallery", "luxury"]),
    industry_style: asString(theme.industry_style, fallback.industry_style),
    hero_visual_title: asString(theme.hero_visual_title, fallback.hero_visual_title),
    hero_visual_description: asString(theme.hero_visual_description, fallback.hero_visual_description),
    image_keywords: asStringArray(theme.image_keywords, fallback.image_keywords).slice(0, 8),
    gallery_cards: asGalleryCards(theme.gallery_cards, fallback.gallery_cards),
    image_sections: asImageSections(theme.image_sections, fallback.image_sections),
  };
}

function sanitizeImageUrl(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("https://")) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? value : "";
  } catch {
    return "";
  }
}
function asPreviewImage(value: unknown): PreviewImage | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const image = value as Record<string, unknown>;
  const url = sanitizeImageUrl(image.url);
  if (!url || image.source !== "pexels") return null;
  const sourceUrl = sanitizeImageUrl(image.source_url);
  return {
    url,
    alt: asString(image.alt, "Business preview photo"),
    photographer: asString(image.photographer) || undefined,
    source: "pexels",
    source_url: sourceUrl || undefined,
  };
}
function asPreviewImages(value: unknown, fallback?: PreviewImages): PreviewImages | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return fallback;
  const images = value as Record<string, unknown>;
  const hero = asPreviewImage(images.hero) || fallback?.hero;
  const gallery = Array.isArray(images.gallery) ? images.gallery.map(asPreviewImage).filter((item): item is PreviewImage => Boolean(item)).slice(0, 6) : fallback?.gallery || [];
  return hero ? { hero, gallery } : fallback;
}

function asContact(value: unknown, fallback: WebsitePreviewData["contact"]) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return fallback;
  const contact = value as Record<string, unknown>;
  return {
    headline: asString(contact.headline, fallback.headline),
    body: asString(contact.body, fallback.body),
    website: asString(contact.website, fallback.website),
    location: asString(contact.location, fallback.location),
  };
}
function sanitizePreviewData(value: unknown, fallback: WebsitePreviewData): WebsitePreviewData {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return fallback;
  const candidate = value as Record<string, unknown>;
  return {
    business_name: asString(candidate.business_name, fallback.business_name),
    industry: asString(candidate.industry, fallback.industry),
    location: asString(candidate.location, fallback.location),
    website: asString(candidate.website, fallback.website),
    meta_title: asString(candidate.meta_title, fallback.meta_title),
    hero_headline: asString(candidate.hero_headline, fallback.hero_headline),
    subheadline: asString(candidate.subheadline, fallback.subheadline),
    cta_text: asString(candidate.cta_text, fallback.cta_text),
    services: asServices(candidate.services, fallback.services),
    why_choose_us: asStringArray(candidate.why_choose_us, fallback.why_choose_us),
    about_intro: asString(candidate.about_intro, fallback.about_intro),
    contact: asContact(candidate.contact, fallback.contact),
    visual_theme: asVisualTheme(candidate.visual_theme, fallback.visual_theme),
    images: asPreviewImages(candidate.images, fallback.images),
  };
}

function matchesIndustry(industry: string, words: string[]) {
  const normalized = industry.toLowerCase();
  return words.some((word) => normalized.includes(word));
}

function detectCanonicalIndustry(lead: Lead): CanonicalIndustry {
  const text = [lead.industry, lead.business_name, lead.website, lead.location].filter(Boolean).join(" ").toLowerCase();
  const has = (words: string[]) => words.some((word) => text.includes(word));

  if (has(["electrician", "electrical", "wiring", "panel", "lighting"])) return "electrician";
  if (has(["plumbing", "plumber", "pipe", "drain", "leak", "water heater"])) return "plumbing";
  if (has(["roofing", "roofer", "roof", "gutter"])) return "roofing";
  if (has(["hvac", "heating", "cooling", "air conditioning", "furnace", "ac repair"])) return "hvac";
  if (has(["construction", "contractor", "builder", "renovation", "remodel", "concrete", "masonry"])) return "construction";
  if (has(["dental", "dentist", "orthodont", "clinic"])) return "dental";
  if (has(["cafe", "coffee"])) return "cafe";
  if (has(["restaurant", "food", "bar", "bistro"])) return "restaurant";
  if (has(["salon", "beauty", "spa", "hair", "barber", "nail", "esthetic"])) return "beauty";
  if (has(["auto", "mechanic", "vehicle", "car", "garage", "tire"])) return "auto";
  if (has(["cleaning", "cleaner", "maid", "janitorial"])) return "cleaning";
  if (has(["landscaping", "landscaper", "lawn", "garden"] )) return "landscaping";
  if (has(["pest", "exterminator"] )) return "pest_control";
  if (has(["moving", "mover", "relocation"] )) return "moving";
  if (has(["law", "lawyer", "attorney", "legal"] )) return "law";
  if (has(["real estate", "realtor", "property"] )) return "real_estate";
  if (has(["fitness", "gym", "trainer"] )) return "fitness";
  if (has(["hotel", "motel", "hospitality"] )) return "hotel";
  if (has(["accounting", "accountant", "bookkeeping", "tax"] )) return "accounting";
  if (has(["veterinary", "veterinarian", "animal hospital", "pet clinic"] )) return "veterinary";
  if (has(["it services", "managed it", "computer repair", "technology"] )) return "it_services";
  if (has(["marketing", "advertising", "creative agency"] )) return "marketing";
  return "professional";
}

type IndustryWebsiteContent = ReturnType<typeof getIndustryWebsiteContent>;

function getIndustryWebsiteContent(industry: CanonicalIndustry | string, location: string) {
  const place = location ? ` in ${location}` : "";
  const canonical = industry as CanonicalIndustry;
  if (canonical === "electrician") {
    return { displayLabel: "Electrical Services", services: [
      { title: "Electrical Repairs", description: "Responsive troubleshooting and repairs for outlets, breakers, fixtures, and electrical issues." },
      { title: "Panel Upgrades", description: "Safe panel improvements that support modern power needs for homes and businesses." },
      { title: "Lighting Installation", description: "Clean lighting installs and upgrades that improve comfort, visibility, and efficiency." },
      { title: "Safety Inspections", description: "Thorough checks that identify hazards and help keep electrical systems reliable." },
    ], cta: "Schedule Electrical Service", style: "Electrical panels, wiring, technician tools, safe modern service", pexelsQueries: ["electrician wiring", "electrical panel", "electrician repair", "lighting installation"], gallery: [
      { title: "Panel & Wiring Expertise", description: "Professional visuals focused on safe electrical systems and clean workmanship." },
      { title: "Lighting Upgrades", description: "Modern lighting cards for installations, repairs, and efficiency-focused improvements." },
      { title: "Safety-First Service", description: "Trust-building sections for inspections, diagnostics, and dependable repairs." },
    ], hero: `Trusted Electrical Services${place}`, subheadline: "Safe, reliable electrical work for homes and businesses" };
  }
  if (canonical === "plumbing") {
    return { displayLabel: "Plumbing Services", services: [
      { title: "Leak Repair", description: "Prompt leak detection and repair to protect fixtures, walls, and plumbing systems." },
      { title: "Drain Cleaning", description: "Reliable drain clearing for sinks, tubs, kitchens, and main household lines." },
      { title: "Pipe Installation", description: "Clean pipe repairs and installations completed with practical, long-lasting workmanship." },
      { title: "Water Heater Service", description: "Water heater repair and service that helps restore comfort quickly." },
    ], cta: "Book a Plumbing Visit", style: "Plumbing repair scenes, clean fixtures, pipe work, practical technician service", pexelsQueries: ["plumber fixing sink", "plumbing repair", "pipe repair", "bathroom plumbing", "water heater repair"], gallery: [
      { title: "Leak & Fixture Repair", description: "Customer-friendly cards for everyday plumbing repairs and fixture service." },
      { title: "Drain & Pipe Solutions", description: "Clear visuals for drain cleaning, pipe work, and dependable repair visits." },
      { title: "Water Heater Support", description: "Service blocks focused on hot water comfort and timely plumbing help." },
    ], hero: `Reliable Plumbing Services${place}`, subheadline: "Fast, dependable plumbing help for leaks, drains, pipes, and water heaters" };
  }
  if (canonical === "construction") {
    return { displayLabel: "Construction Services", services: [
      { title: "Residential Construction", description: "Well-managed builds with clear communication from planning through completion." },
      { title: "Renovations & Remodeling", description: "Thoughtful updates that improve comfort, function, and long-term property value." },
      { title: "Repairs & Maintenance", description: "Reliable fixes and upkeep handled with practical expertise and care." },
      { title: "Project Planning", description: "Straightforward scopes, timelines, and recommendations before work begins." },
    ], cta: "Request a Free Quote", style: "Modern construction projects, contractor tools, renovation planning, finished home details", pexelsQueries: ["home renovation", "construction project", "contractor tools", "modern house construction"], gallery: [
      { title: "Residential Construction", description: "Portfolio-style cards for quality builds and finished project details." },
      { title: "Renovations & Remodeling", description: "Before-and-after sections that make transformations easy to understand." },
      { title: "Project Planning", description: "Clean visuals for timelines, materials, and organized jobsite communication." },
    ], hero: `Quality Construction Services${place}`, subheadline: "Carefully planned building, remodeling, and repair projects" };
  }
  if (canonical === "roofing") {
    return { displayLabel: "Roofing Services", services: [
      { title: "Roof Repairs", description: "Dependable repairs for damaged shingles, storm wear, and roof problem areas." },
      { title: "New Roof Installation", description: "Professional roof installation with clear guidance on materials and timelines." },
      { title: "Leak Detection", description: "Careful roof assessments that identify leaks and prevent further property damage." },
      { title: "Gutter Services", description: "Gutter support that helps move water away from your home efficiently." },
    ], cta: "Request a Roof Inspection", style: "Roof repair, shingles, gutter details, exterior home protection", pexelsQueries: ["roof repair", "roofer working", "house roof installation", "roofing contractor"], gallery: [
      { title: "Roof Repairs", description: "Exterior project visuals for repairs, shingles, and weather protection." },
      { title: "Roof Installation", description: "Professional cards for new roofs, materials, and jobsite craftsmanship." },
      { title: "Leak & Gutter Care", description: "Trust sections for inspections, water control, and preventative maintenance." },
    ], hero: `Trusted Roofing Services${place}`, subheadline: "Roof repairs, installations, inspections, and gutter support" };
  }
  if (canonical === "hvac") {
    return { displayLabel: "HVAC Services", services: [
      { title: "AC Repair", description: "Responsive cooling repairs that restore comfort when systems stop performing." },
      { title: "Heating Service", description: "Heating diagnostics and service for dependable warmth in colder seasons." },
      { title: "System Installation", description: "Professional HVAC installation guidance for efficient heating and cooling systems." },
      { title: "Maintenance Plans", description: "Preventative service that helps equipment run reliably year-round." },
    ], cta: "Schedule HVAC Service", style: "HVAC technician, air conditioner repair, heating equipment, ventilation systems", pexelsQueries: ["hvac technician", "air conditioner repair", "heating system service", "ventilation system"], gallery: [
      { title: "Cooling Repair", description: "Service cards for AC diagnostics, repairs, and comfort-focused support." },
      { title: "Heating Service", description: "Warm, reliable visuals for furnace and heating system care." },
      { title: "System Maintenance", description: "Clean technical sections for inspections, tune-ups, and efficient performance." },
    ], hero: `Reliable HVAC Services${place}`, subheadline: "Heating, cooling, installation, and maintenance for year-round comfort" };
  }
  if (matchesIndustry(industry, ["dental", "dentist", "orthodont", "clinic"])) {
    return {
      services: [
        { title: "General Dentistry", description: "Comprehensive exams, fillings, and everyday care for healthy, confident smiles." },
        { title: "Cosmetic Dentistry", description: "Modern whitening, bonding, and smile-enhancing treatments tailored to each patient." },
        { title: "Preventive Care", description: "Cleanings, screenings, and guidance designed to protect long-term oral health." },
        { title: "Emergency Dental Care", description: "Prompt support for urgent tooth pain, broken teeth, and unexpected dental concerns." },
      ],
      cta: "Book an Appointment",
      style: "Clean clinic interior, smiling patient, bright modern healthcare look",
      gallery: [
        { title: "Calm Treatment Rooms", description: "Bright, comfortable spaces designed to help patients feel at ease." },
        { title: "Patient-First Care", description: "Clear explanations and supportive guidance before every treatment." },
        { title: "Modern Smile Services", description: "Preventive and cosmetic options presented with a polished clinical feel." },
      ],
      hero: `Comfortable dental care for healthier smiles${place}`,
    };
  }
  if (matchesIndustry(industry, ["restaurant", "cafe", "coffee", "food", "bar", "bistro"])) {
    return { services: [
      { title: "Signature Menu", description: "Guest-favorite dishes crafted with flavor, presentation, and consistency in mind." },
      { title: "Fresh Daily Specials", description: "Seasonal plates and rotating features that give guests a reason to return." },
      { title: "Private Events", description: "Welcoming dining experiences for celebrations, team meals, and special occasions." },
      { title: "Takeaway & Reservations", description: "Easy options for planning ahead, dining in, or enjoying favorites at home." },
    ], cta: "Reserve a Table", style: "Warm dining atmosphere, food photography, elegant menu cards", gallery: [
      { title: "Signature Plates", description: "Rich food-focused cards that showcase the menu experience." },
      { title: "Warm Dining Room", description: "Inviting interiors that make visitors picture their next meal." },
      { title: "Seasonal Features", description: "Elegant blocks for specials, events, and fresh daily highlights." },
    ], hero: `Memorable dining and fresh flavors${place}` };
  }
  if (matchesIndustry(industry, ["construction", "contractor", "remodel", "renovation", "builder", "roofing", "plumb", "electric"])) {
    return { services: [
      { title: "Residential Construction", description: "Well-managed builds with clear communication from planning through completion." },
      { title: "Renovations & Remodeling", description: "Thoughtful updates that improve comfort, function, and long-term property value." },
      { title: "Repairs & Maintenance", description: "Reliable fixes and upkeep handled with practical expertise and care." },
      { title: "Project Planning", description: "Straightforward scopes, timelines, and recommendations before work begins." },
    ], cta: "Request a Free Quote", style: "Modern project photos, tools, before/after project blocks", gallery: [
      { title: "Finished Projects", description: "Portfolio-style cards for completed work and craftsmanship details." },
      { title: "Before & After", description: "Visual blocks that make transformations easy to understand." },
      { title: "On-Site Precision", description: "Clean, professional project imagery with tools and materials." },
    ], hero: `Quality projects built with care${place}` };
  }
  if (matchesIndustry(industry, ["salon", "beauty", "spa", "hair", "barber", "nail", "esthetic"])) {
    return { services: [
      { title: "Hair Styling", description: "Cuts, color, and styling designed around each guest’s look and lifestyle." },
      { title: "Beauty Treatments", description: "Polished services that help clients feel refreshed, confident, and cared for." },
      { title: "Bridal & Event Looks", description: "Special-occasion styling with a refined, photo-ready finish." },
      { title: "Personalized Consultations", description: "Friendly recommendations that make every visit feel tailored and relaxed." },
    ], cta: "Book Your Visit", style: "Elegant salon, beauty closeups, soft luxury design", gallery: [
      { title: "Soft Luxury Studio", description: "Elegant interiors and beauty details with a premium editorial feel." },
      { title: "Signature Looks", description: "Cards for transformations, styling inspiration, and client-ready finishes." },
      { title: "Personal Consultations", description: "Warm visual prompts for one-on-one beauty guidance." },
    ], hero: `Polished beauty experiences made personal${place}` };
  }
  if (matchesIndustry(industry, ["auto", "mechanic", "vehicle", "car", "repair", "garage", "tire"])) {
    return { services: [
      { title: "Vehicle Diagnostics", description: "Clear answers for warning lights, performance concerns, and drivability issues." },
      { title: "Oil & Maintenance", description: "Routine service that helps vehicles stay reliable mile after mile." },
      { title: "Brake Repair", description: "Inspection and repair support for safer stopping and smoother driving." },
      { title: "Engine Service", description: "Practical mechanical care for complex issues and preventative repairs." },
    ], cta: "Schedule Service", style: "Modern garage, clean automotive cards, mechanical detail visuals", gallery: [
      { title: "Clean Service Bays", description: "Modern garage-inspired blocks that communicate precision and care." },
      { title: "Diagnostic Detail", description: "Mechanical closeups for inspections, repairs, and maintenance checks." },
      { title: "Ready for the Road", description: "Customer-friendly visuals focused on safety and reliability." },
    ], hero: `Reliable auto care that keeps you moving${place}` };
  }
  return {
    services: [
      { title: "Professional Services", description: "Reliable support tailored to the needs of local customers and clients." },
      { title: "Personalized Support", description: "Helpful guidance and clear next steps from first conversation to follow-up." },
      { title: "Local Expertise", description: "A practical understanding of the community and the service experience customers expect." },
      { title: "Customer Care", description: "Responsive communication and dependable service built around long-term trust." },
    ],
    cta: "Request a Consultation",
    style: "Premium local business visuals, polished cards, warm customer-focused design",
    gallery: [
      { title: "Welcoming Experience", description: "Premium visual cards that introduce the customer journey." },
      { title: "Trusted Local Team", description: "Professional placeholders for people, spaces, and service moments." },
      { title: "Quality in Detail", description: "Refined blocks that highlight care, process, and results." },
    ],
    hero: `Professional service with a personal touch${place}`,
  };
}

function getLayoutVariant(industry: string): LayoutVariant {
  if (matchesIndustry(industry, ["dental", "dentist", "orthodont", "clinic", "medical", "health"])) return "medical";
  if (matchesIndustry(industry, ["construction", "contractor", "remodel", "renovation", "builder", "roofing", "plumb", "electric"])) return "construction";
  if (matchesIndustry(industry, ["restaurant", "cafe", "coffee", "food", "bar", "bistro"])) return "restaurant";
  if (matchesIndustry(industry, ["salon", "beauty", "spa", "hair", "barber", "nail", "esthetic"])) return "beauty";
  if (matchesIndustry(industry, ["auto", "mechanic", "vehicle", "car", "repair", "garage", "tire"])) return "auto";
  return "professional";
}

function getDisplayLabel(canonicalIndustry: CanonicalIndustry, fallback: string) {
  const content = getIndustryWebsiteContent(canonicalIndustry, "");
  return "displayLabel" in content ? content.displayLabel : fallback || "Professional Services";
}

function getCanonicalPexelsQueries(canonicalIndustry: CanonicalIndustry) {
  const content = getIndustryWebsiteContent(canonicalIndustry, "");
  return "pexelsQueries" in content ? content.pexelsQueries : undefined;
}

function containsForbiddenIndustryText(value: unknown, canonicalIndustry: CanonicalIndustry) {
  const text = JSON.stringify(value || "").toLowerCase();
  const forbidden: Partial<Record<CanonicalIndustry, string[]>> = {
    electrician: ["plumbing", "plumber", "pipe", "drain", "construction", "contractor", "residential construction", "roofing", "roofer", "hvac"],
    plumbing: ["electrician", "electrical", "wiring", "construction", "contractor", "residential construction", "roofing", "roofer", "hvac"],
    construction: ["plumbing", "plumber", "pipe", "drain", "electrician", "electrical", "wiring", "hvac", "air conditioning", "furnace"],
  };
  return (forbidden[canonicalIndustry] || []).some((word) => text.includes(word));
}

function enforceIndustryConsistency(previewData: WebsitePreviewData, canonicalIndustry: CanonicalIndustry, industryContent: IndustryWebsiteContent): WebsitePreviewData {
  const displayLabel = "displayLabel" in industryContent ? industryContent.displayLabel : previewData.industry;
  const hero = "hero" in industryContent ? industryContent.hero : previewData.hero_headline;
  const subheadline = "subheadline" in industryContent ? industryContent.subheadline : previewData.subheadline;
  const galleryCards = industryContent.gallery.map((card) => ({ ...card, image_alt: `${card.title} for ${previewData.business_name}` }));
  const imageKeywords = [displayLabel, previewData.location, ...industryContent.services.map((service) => service.title)].filter(Boolean).slice(0, 8);

  return {
    ...previewData,
    industry: displayLabel,
    hero_headline: containsForbiddenIndustryText(previewData.hero_headline, canonicalIndustry) ? hero : previewData.hero_headline || hero,
    subheadline: containsForbiddenIndustryText(previewData.subheadline, canonicalIndustry) ? subheadline : previewData.subheadline || subheadline,
    cta_text: industryContent.cta,
    services: containsForbiddenIndustryText(previewData.services, canonicalIndustry) ? industryContent.services : industryContent.services,
    contact: {
      ...previewData.contact,
      body: containsForbiddenIndustryText(previewData.contact?.body, canonicalIndustry) ? `Reach out today to ${industryContent.cta.toLowerCase()}.` : previewData.contact.body,
    },
    visual_theme: {
      ...previewData.visual_theme,
      industry_style: industryContent.style,
      hero_visual_title: `${displayLabel} experience`,
      hero_visual_description: industryContent.style,
      image_keywords: imageKeywords,
      gallery_cards: galleryCards,
      image_sections: [
        { title: "Hero visual", description: industryContent.style, image_alt: `${previewData.business_name} ${displayLabel} hero visual`, visual_type: "hero" },
        ...industryContent.gallery.slice(0, 3).map((card) => ({ title: card.title, description: card.description, image_alt: `${card.title} visual`, visual_type: "gallery" as const })),
      ],
    },
  };
}

function extractPreviousDesigns(rows: Array<{ preview_data: unknown }> | null): PreviousDesign[] {
  return (rows || []).map((row) => {
    const data = row.preview_data as { visual_theme?: Record<string, unknown> } | null;
    const theme = data?.visual_theme || {};
    return {
      design_variant_id: asString(theme.design_variant_id),
      structure_variant: asString(theme.structure_variant) as StructureVariant,
      layout_variant: asString(theme.layout_variant) as LayoutVariant,
      color_theme: asString(theme.color_theme),
      hero_style: asString(theme.hero_style) as HeroStyle,
      section_order: asStringArray(theme.section_order),
      card_style: asString(theme.card_style) as CardStyle,
      visual_density: asString(theme.visual_density) as VisualDensity,
      accent_style: asString(theme.accent_style) as AccentStyle,
      image_style: asString(theme.image_style) as ImageStyle,
    };
  });
}

type PexelsPhoto = {
  url?: string;
  photographer?: string;
  alt?: string;
  src?: { large2x?: string; large?: string; medium?: string };
};

function getPexelsQueryVariants(canonicalIndustry: CanonicalIndustry, visualTheme: VisualTheme) {
  const canonicalQueries = getCanonicalPexelsQueries(canonicalIndustry);
  if (canonicalQueries) {
    const styleQueries = visualTheme.image_style ? canonicalQueries.map((query) => `${query} ${visualTheme.image_style}`) : [];
    return [...canonicalQueries, ...styleQueries];
  }
  const value = `${canonicalIndustry} ${visualTheme.layout_variant || ""}`.toLowerCase();
  const variants = matchesIndustry(value, ["dental", "dentist", "orthodont", "clinic", "medical", "health"])
    ? ["modern dental clinic", "dentist patient care", "bright clinic interior"]
    : matchesIndustry(value, ["construction", "contractor", "remodel", "renovation", "builder", "roofing", "plumb", "electric"])
      ? ["home renovation", "construction project", "contractor tools", "modern house construction"]
      : matchesIndustry(value, ["restaurant", "cafe", "coffee", "food", "bar", "bistro"])
        ? ["restaurant food", "dining table", "chef plating", "restaurant interior"]
        : matchesIndustry(value, ["salon", "beauty", "spa", "hair", "barber", "nail", "esthetic"])
          ? ["beauty salon", "hair stylist", "nail salon", "beauty treatment"]
          : matchesIndustry(value, ["auto", "mechanic", "vehicle", "car", "repair", "garage", "tire"])
            ? ["auto repair garage", "mechanic working", "car diagnostics", "vehicle maintenance"]
            : ["business team", "modern office", "local business service"];
  const styleQuery = visualTheme.image_style ? variants.map((query) => `${query} ${visualTheme.image_style}`) : [];
  return [...variants, ...styleQuery];
}

async function fetchPexelsImages(query: string, perPage: number): Promise<PexelsPhoto[]> {
  const apiKey = Deno.env.get("PEXELS_API_KEY")?.trim();
  if (!apiKey) return [];
  try {
    const url = new URL("https://api.pexels.com/v1/search");
    url.searchParams.set("query", query);
    url.searchParams.set("per_page", String(Math.max(1, Math.min(perPage, 12))));
    url.searchParams.set("orientation", "landscape");
    const response = await fetch(url, { headers: { Authorization: apiKey } });
    if (!response.ok) return [];
    const data = await response.json() as { photos?: PexelsPhoto[] };
    return Array.isArray(data.photos) ? data.photos : [];
  } catch {
    return [];
  }
}

async function buildPreviewImages(previewData: WebsitePreviewData, canonicalIndustry: CanonicalIndustry): Promise<PreviewImages | undefined> {
  const queries = getPexelsQueryVariants(canonicalIndustry, previewData.visual_theme);
  const shuffledQueries = [...queries].sort(() => crypto.getRandomValues(new Uint32Array(1))[0] - 2147483648);
  const photos: PexelsPhoto[] = [];
  for (const query of shuffledQueries.slice(0, 3)) {
    photos.push(...await fetchPexelsImages(query, 8));
    if (photos.length >= 5) break;
  }
  const uniquePhotos = photos.filter((photo, index, list) => photo.url && list.findIndex((item) => item.url === photo.url) === index);
  if (!uniquePhotos.length) return undefined;
  const shuffledPhotos = [...uniquePhotos].sort(() => crypto.getRandomValues(new Uint32Array(1))[0] - 2147483648);
  const toImage = (photo: PexelsPhoto, size: "hero" | "gallery"): PreviewImage | null => {
    const url = sanitizeImageUrl(size === "hero" ? photo.src?.large2x || photo.src?.large : photo.src?.medium || photo.src?.large);
    if (!url) return null;
    const sourceUrl = sanitizeImageUrl(photo.url);
    return { url, alt: photo.alt || `${previewData.business_name} ${previewData.industry} photo`, photographer: photo.photographer || undefined, source: "pexels", source_url: sourceUrl || undefined };
  };
  const hero = toImage(shuffledPhotos[0], "hero");
  if (!hero) return undefined;
  const gallery = shuffledPhotos.slice(1, 5).map((photo) => toImage(photo, "gallery")).filter((item): item is PreviewImage => Boolean(item));
  return { hero, gallery };
}

function fallbackPreview(lead: Lead, audit: Audit | null, selectedDesign?: DesignVariant, canonicalIndustry = detectCanonicalIndustry(lead)): WebsitePreviewData {
  const industryContent = getIndustryWebsiteContent(canonicalIndustry, lead.location);
  const displayLabel = "displayLabel" in industryContent ? industryContent.displayLabel : lead.industry || "Professional Services";
  const design = selectedDesign || selectDesignVariant(getLayoutVariant(canonicalIndustry), [], canonicalIndustry);
  const homepage = audit?.seo_content_pack?.homepage_copy;
  const homepageHeadline = homepage?.headline && !/seo|audit|leadscope|agency|package|optimization/i.test(homepage.headline) ? homepage.headline : industryContent.hero;
  const homepageSubheadline = homepage?.subheadline && !/seo|audit|leadscope|agency|package|optimization/i.test(homepage.subheadline) ? homepage.subheadline : `Welcome to ${lead.business_name}, a modern ${displayLabel} experience built around trust, clarity, and customer care${lead.location ? ` in ${lead.location}` : ""}.`;
  return {
    business_name: lead.business_name,
    industry: displayLabel,
    location: lead.location,
    website: lead.website,
    meta_title: `${lead.business_name}${lead.location ? ` | ${lead.location}` : ""}`,
    hero_headline: homepageHeadline,
    subheadline: homepageSubheadline,
    cta_text: homepage?.cta && !/seo|audit|package|optimization/i.test(homepage.cta) ? homepage.cta : industryContent.cta,
    services: industryContent.services,
    why_choose_us: ["Friendly, customer-first communication", "Modern service experience", "Trusted local team", "Clear next steps from first contact"],
    about_intro: `${lead.business_name} helps customers feel confident from the first visit with attentive service, thoughtful recommendations, and a polished experience tailored to ${displayLabel.toLowerCase()} needs${lead.location ? ` in ${lead.location}` : ""}.`,
    contact: { headline: `Ready to get started with ${lead.business_name}?`, body: `Reach out today to ask a question or ${industryContent.cta.toLowerCase()}.`, website: lead.website, location: lead.location },
    visual_theme: {
      ...design,
      industry_style: industryContent.style,
      hero_visual_title: `${displayLabel} experience`,
      hero_visual_description: industryContent.style,
      image_keywords: [displayLabel, lead.location, ...industryContent.services.map((service) => service.title)].filter(Boolean).slice(0, 8),
      gallery_cards: industryContent.gallery.map((card) => ({ ...card, image_alt: `${card.title} for ${lead.business_name}` })),
      image_sections: [
        { title: "Hero visual", description: industryContent.style, image_alt: `${lead.business_name} ${displayLabel} hero visual`, visual_type: "hero" },
        ...industryContent.gallery.slice(0, 3).map((card) => ({ title: card.title, description: card.description, image_alt: `${card.title} visual`, visual_type: "gallery" as const })),
      ],
    },
  };
}


Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return errorResponse("Missing Authorization Bearer token", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return errorResponse("Unauthorized", 401);

    const { lead_id } = await req.json() as { lead_id?: string };
    if (!lead_id) return errorResponse("lead_id is required");

    const { data: profile, error: profileError } = await serviceClient.from("user_profiles").select("id, role").eq("id", user.id).maybeSingle();
    if (profileError || !profile) return errorResponse("User profile not found", 404);

    const { data: lead, error: leadError } = await serviceClient.from("leads").select("id, user_id, business_name, industry, location, website").eq("id", lead_id).maybeSingle();
    if (leadError || !lead) return errorResponse("Lead not found", 404);
    const typedLead = lead as Lead;
    if ((profile as UserProfile).role !== "admin" && typedLead.user_id !== user.id) return errorResponse("Forbidden", 403);

    const { data: previousPreviewRows } = await serviceClient.from("website_previews").select("preview_data, created_at").eq("lead_id", lead_id).order("created_at", { ascending: false }).limit(5);
    const previousDesigns = extractPreviousDesigns(previousPreviewRows as Array<{ preview_data: unknown }> | null);
    const canonicalIndustry = detectCanonicalIndustry(typedLead);
    const industryContent = getIndustryWebsiteContent(canonicalIndustry, typedLead.location);
    const selectedStructureVariant = selectStructureVariant(canonicalIndustry, previousDesigns);
    const selectedSectionOrder = normalizeSectionOrder(STRUCTURE_ORDERS[selectedStructureVariant], selectedStructureVariant);
    const selectedDesign = {
      ...selectDesignVariant(getLayoutVariant(canonicalIndustry), previousDesigns, canonicalIndustry),
      structure_variant: selectedStructureVariant,
      section_order: selectedSectionOrder,
    };

    const { data: audit } = await serviceClient.from("lead_audits").select("summary, main_issues, recommended_offer, seo_content_pack").eq("lead_id", lead_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const typedAudit = audit as Audit | null;
    let previewData = fallbackPreview(typedLead, typedAudit, selectedDesign, canonicalIndustry);

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
    if (openaiApiKey) {
      const prompt = `Create a modern, premium, client-facing one-page website preview for the business itself. This must feel like the lead's real public website concept, not a report or agency pitch. Do not include pricing, internal IDs, account data, billing data, API keys, admin data, or private strategy.

Business public inputs:
- business_name: ${typedLead.business_name}
- canonical_industry: ${canonicalIndustry}
- industry_display_label: ${getDisplayLabel(canonicalIndustry, typedLead.industry)}
- location: ${typedLead.location}
- website: ${typedLead.website || "none"}

Hidden improvement context. Use this only to improve the customer-facing website concept; never expose audit, SEO, agency, strategy, package, or optimization language directly:
- audit summary: ${typedAudit?.summary || "none"}
- main issues: ${(typedAudit?.main_issues || []).join(", ") || "none"}
- homepage copy: ${JSON.stringify(typedAudit?.seo_content_pack?.homepage_copy || {})}
- suggested keywords: ${JSON.stringify(typedAudit?.seo_content_pack?.suggested_keywords || {})}
- service page ideas: ${(typedAudit?.seo_content_pack?.service_page_ideas || []).join(" | ") || "none"}
- blog/service ideas: ${(typedAudit?.seo_content_pack?.blog_post_ideas || []).join(" | ") || "none"}
- Google Business ideas: ${(typedAudit?.seo_content_pack?.google_business_posts || []).join(" | ") || "none"}
- internal agency recommended service to ignore as public service: ${typedAudit?.seo_content_pack?.recommended_service?.service_name || typedAudit?.recommended_offer || "none"}

Hard rules:
- Create services that the business sells to its own customers, specific to the canonical industry only.
- Do NOT create SEO services, SEO packages, technical SEO audit sections, content optimization services, a local SEO angle, audit language, LeadScope language, a meta title suggestion section, an AI website preview label, or internal agency pitch content.
- If the hidden context says weak CTA, write a stronger public CTA.
- If it mentions missing service pages, create better customer-facing service sections.
- If homepage headline/subheadline fits the business website, adapt it; otherwise write new customer-facing copy.
- If keyword suggestions fit naturally, use them in public headings/copy without mentioning keywords or SEO.
- Do not expose suggested_pricing or internal SEO strategy.

Selected design direction to follow:
${JSON.stringify(selectedDesign)}

The selected structure_variant is: ${selectedStructureVariant}
The selected section_order is: ${selectedSectionOrder.join(", ")}
You must follow this structure.
Do not return a shorter section_order.
Do not return only services/experience/trust/cta.

Previous designs to avoid:
${JSON.stringify(previousDesigns)}

Design variation rules:
- Create a new website design variation.
- Return visual_theme.structure_variant and a full visual_theme.section_order.
- visual_theme.structure_variant must be one of: classic, service_first, gallery_first, story_driven, trust_first, cta_focused, editorial, project_showcase.
- visual_theme.section_order must contain 5 to 7 sections selected from: trust, services, service_detail, about, story, process, projects, gallery, experience, testimonial, testimonials, why_us, cta, contact, quote_cta, featured_service.
- Do not return only 3 sections. Do not include hero in section_order because the hero is rendered separately.
- Make this preview feel structurally different from previous designs.
- Do not repeat the previous design variants.
- Do not repeat the same section_order from previous previews.
- Do not reuse the same hero style if possible.
- Do not reuse the same card style if possible.
- Keep the content industry-specific, but change the design structure and visual feeling.
- This preview is for the business’s real customers.
- Do not create an SEO audit, agency pitch, LeadScope page, SEO package, technical SEO section, content optimization section, or internal strategy.

Use SEO/audit insights only as hidden improvement context:
- stronger CTA
- better service sections
- clearer homepage copy
- trust-building sections
- local customer-facing keywords naturally in copy

Never expose:
- suggested_pricing
- SEO package
- technical SEO
- audit
- LeadScope
- AI website preview
- meta title suggestion
- local SEO angle

Return raw JSON only with this exact safe public shape and no extra keys: ${JSON.stringify(previewData)}`;
      const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiApiKey}` },
        body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], temperature: 0.7, max_tokens: 1200 }),
      });
      if (openaiRes.ok) {
        const completion = await openaiRes.json() as { choices: Array<{ message: { content: string } }> };
        try {
          const aiPreview = JSON.parse(cleanJson(completion.choices[0]?.message?.content ?? "{}"));
          previewData = sanitizePreviewData({ ...previewData, ...aiPreview }, previewData);
        } catch {
          // Keep the deterministic fallback rather than failing to create the preview.
        }
      }
    }

    previewData = sanitizePreviewData(previewData, fallbackPreview(typedLead, typedAudit, selectedDesign, canonicalIndustry));
    previewData = enforceIndustryConsistency(previewData, canonicalIndustry, industryContent);
    previewData.visual_theme.structure_variant = selectedStructureVariant;
    previewData.visual_theme.section_order = normalizeSectionOrder(selectedSectionOrder, selectedStructureVariant);
    previewData.images = await buildPreviewImages(previewData, canonicalIndustry);
    previewData = sanitizePreviewData(previewData, fallbackPreview(typedLead, typedAudit, selectedDesign, canonicalIndustry));
    previewData = enforceIndustryConsistency(previewData, canonicalIndustry, industryContent);

    console.log("Saving website preview industry", {
      canonicalIndustry,
      previewIndustry: previewData.industry,
      heroHeadline: previewData.hero_headline,
      imageKeywords: previewData.visual_theme?.image_keywords,
      pexelsHero: previewData.images?.hero?.alt,
    });

    const preview_token = createPreviewToken();
    const { data: saved, error: insertError } = await serviceClient.from("website_previews").insert({ lead_id, user_id: user.id, preview_token, preview_data: previewData }).select("preview_token, preview_data, created_at").single();
    if (insertError) return errorResponse(`Failed to save website preview: ${insertError.message}`, 500);
    return jsonResponse({ preview: saved });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to generate website preview.";
    return errorResponse(message, 500);
  }
});
