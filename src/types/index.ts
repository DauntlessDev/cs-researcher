// Xano API response types
export interface XanoOffer {
  id: number;
  casinodb_id: number;
  Offer_Name: string;
  offer_type: string;
  Expected_Deposit: number;
  Expected_Bonus: number;
  Name: string; // casino name
  states_id: number;
  state: string;
}

// Discovered via Perplexity
export interface DiscoveredCasino {
  name: string;
  operator: string;
  website: string;
  license_status: string;
  state: string;
  source_urls: string[];
}

export interface DiscoveredOffer {
  casino_name: string;
  state: string;
  type: string;
  description: string;
  deposit_required: number | null;
  bonus_amount: number | null;
  wagering_requirement: string | null;
  promo_code: string | null;
  source_urls: string[];
}

// Matching results
export interface MatchResult {
  missing: DiscoveredCasino[];
  matched: {
    existing: XanoOffer;
    discovered: DiscoveredCasino;
  }[];
}

// Claude analysis
export type OfferVerdict =
  | "discovered_better"
  | "existing_better"
  | "comparable"
  | "different_type"
  | "no_data";

export interface OfferComparison {
  casino_name: string;
  state: string;
  existing_offer: XanoOffer | null;
  discovered_offers: DiscoveredOffer[];
  verdict: OfferVerdict;
  confidence: number;
  explanation: string;
  recommended_action: string;
}

// Full report
export interface ResearchReport {
  id: string;
  timestamp: string;
  states: string[];
  missing_casinos: DiscoveredCasino[];
  comparisons: OfferComparison[];
  metadata: {
    duration_ms: number;
    perplexity_queries: number; // kept for report compatibility (now Tavily)
    claude_queries: number; // kept for report compatibility (now Gemini)
    estimated_cost: number;
    total_citations: number;
  };
}

// Pipeline progress
export interface PipelineProgress {
  stage: string;
  detail: string;
  percent: number;
}

// State config
export interface StateConfig {
  code: string;
  name: string;
  gaming_commission: string;
  search_domains: string[];
}

export const STATES: StateConfig[] = [
  {
    code: "NJ",
    name: "New Jersey",
    gaming_commission: "NJ Division of Gaming Enforcement",
    search_domains: ["njdge.org", "nj.gov"],
  },
  {
    code: "MI",
    name: "Michigan",
    gaming_commission: "Michigan Gaming Control Board",
    search_domains: ["michigan.gov"],
  },
  {
    code: "PA",
    name: "Pennsylvania",
    gaming_commission: "PA Gaming Control Board",
    search_domains: ["gamingcontrolboard.pa.gov"],
  },
  {
    code: "WV",
    name: "West Virginia",
    gaming_commission: "WV Lottery",
    search_domains: ["wvlottery.com"],
  },
];
