// Unified search provider interface — Exa Deep (default), Perplexity Sonar, Tavily+Groq
// Each provider discovers casinos AND their offers in one call per state

import { StateConfig } from "@/types";

export type SearchProviderType = "exa" | "perplexity" | "tavily";

export interface CasinoWithOffers {
  name: string;
  operator: string;
  website: string;
  license_status: string;
  offers: {
    type: string;
    description: string;
    deposit_required: number | null;
    bonus_amount: number | null;
    wagering_requirement: string | null;
    promo_code: string | null;
  }[];
}

export interface ProviderResult {
  casinos: CasinoWithOffers[];
  citations: string[];
}

export interface SearchProvider {
  name: SearchProviderType;
  /** Discover casinos and their offers for a state in a single call */
  researchState(state: StateConfig): Promise<ProviderResult>;
}

// Full nested schema — used by Perplexity and Tavily+Groq (no depth limits)
const CASINO_FULL_SCHEMA = {
  type: "object" as const,
  properties: {
    casinos: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          name: { type: "string" as const, description: "Casino brand name" },
          operator: { type: "string" as const, description: "Parent company or operator" },
          website: { type: "string" as const, description: "Official website URL" },
          license_status: { type: "string" as const, description: "Current license status (active, pending, etc)" },
          offers: {
            type: "array" as const,
            items: {
              type: "object" as const,
              properties: {
                type: { type: "string" as const, description: "Offer type (deposit_match, no_deposit_bonus, free_play, cashback)" },
                description: { type: "string" as const, description: "Full description of the offer" },
                deposit_required: { type: "number" as const, description: "Minimum deposit in dollars. Omit if unknown." },
                bonus_amount: { type: "number" as const, description: "Bonus amount in dollars. Omit if unknown." },
                wagering_requirement: { type: "string" as const, description: "Wagering requirement (e.g. 15x, 20x). Omit if unknown." },
                promo_code: { type: "string" as const, description: "Promo code if needed. Omit if none." },
              },
              required: ["type", "description"],
            },
          },
        },
        required: ["name", "operator", "website", "license_status", "offers"],
      },
    },
  },
  required: ["casinos"],
};

// Flat schemas for Exa Deep (max depth 2, max 10 properties)
const EXA_CASINO_SCHEMA = {
  type: "object" as const,
  properties: {
    casinos: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          name: { type: "string" as const, description: "Casino brand name" },
          operator: { type: "string" as const, description: "Parent company" },
          website: { type: "string" as const, description: "Official website URL" },
          license_status: { type: "string" as const, description: "License status (active, pending, etc)" },
        },
        required: ["name", "operator", "website", "license_status"],
      },
    },
  },
  required: ["casinos"],
};

const EXA_OFFERS_SCHEMA = {
  type: "object" as const,
  properties: {
    offers: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          casino_name: { type: "string" as const, description: "Casino brand name this offer belongs to" },
          type: { type: "string" as const, description: "Offer type: deposit_match, no_deposit_bonus, free_play, or cashback" },
          description: { type: "string" as const, description: "Full description of the promotional offer" },
          deposit_required: { type: "number" as const, description: "Minimum deposit in dollars" },
          bonus_amount: { type: "number" as const, description: "Bonus amount in dollars" },
          wagering_requirement: { type: "string" as const, description: "Wagering requirement (e.g. 15x)" },
          promo_code: { type: "string" as const, description: "Promo code if needed" },
        },
        required: ["casino_name", "type", "description"],
      },
    },
  },
  required: ["offers"],
};

function buildStateQuery(state: StateConfig): string {
  return `List ALL currently licensed and operational online casinos in ${state.name}. Prioritize official sources: the ${state.gaming_commission} regulatory database and state gaming commission records. For each casino, include: brand name, parent operator, official website, license status, and ALL current new-player promotional CASINO offers (welcome bonuses, deposit matches, free play, no-deposit bonuses). Do NOT include sportsbook-only operators or sportsbook promotions — only online casino games.`;
}

/** Retry a fetch call with exponential backoff on 429/5xx */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxRetries = 2
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, init);

    if (response.ok || response.status < 429) return response;

    // Retry on 429 (rate limit) or 5xx (server error)
    if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
      const retryAfter = response.headers.get("retry-after");
      const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : 3000 * (attempt + 1);
      console.warn(`[Retry] ${response.status} from ${url}, waiting ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      continue;
    }

    return response; // Non-retryable error
  }

  // Shouldn't reach here, but satisfy TS
  return fetch(url, init);
}

function parseCasinos(raw: unknown): CasinoWithOffers[] {
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;
  const casinos = obj.casinos;
  if (!Array.isArray(casinos)) return [];

  return casinos.map((c: Record<string, unknown>) => ({
    name: String(c.name ?? ""),
    operator: String(c.operator ?? ""),
    website: String(c.website ?? ""),
    license_status: String(c.license_status ?? ""),
    offers: Array.isArray(c.offers)
      ? c.offers.map((o: Record<string, unknown>) => ({
          type: String(o.type ?? ""),
          description: String(o.description ?? ""),
          deposit_required: typeof o.deposit_required === "number" ? o.deposit_required : null,
          bonus_amount: typeof o.bonus_amount === "number" ? o.bonus_amount : null,
          wagering_requirement: o.wagering_requirement != null ? String(o.wagering_requirement) : null,
          promo_code: o.promo_code != null ? String(o.promo_code) : null,
        }))
      : [],
  }));
}

// --- Exa Deep Provider ---
// Exa Deep has strict schema limits: max depth 2, max 10 properties.
// So we use two calls per state: one for casino discovery, one for offers.
// Both run in parallel. Still only 2 calls per state (8 total for 4 states).

async function exaDeepSearch(apiKey: string, query: string, schema: Record<string, unknown>, label: string): Promise<{ output: unknown; citations: string[]; elapsed: number }> {
  const startMs = Date.now();
  const response = await fetchWithRetry("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      query,
      type: "deep",
      numResults: 20,
      outputSchema: schema,
      contents: { text: { maxCharacters: 3000 } },
    }),
  });

  const elapsed = Date.now() - startMs;

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Exa API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const citations: string[] = (data.results ?? []).map((r: { url: string }) => r.url);
  console.log(`[Exa][${label}] API responded in ${elapsed}ms — ${citations.length} citations, keys: ${Object.keys(data).join(", ")}`);

  const output = data.output?.content ?? data.output ?? data.synthesized;
  if (!output) {
    console.warn(`[Exa][${label}] No structured output. output field: ${JSON.stringify(data.output)?.substring(0, 500)}`);
  }

  return { output, citations, elapsed };
}

function createExaProvider(): SearchProvider {
  return {
    name: "exa",
    async researchState(state) {
      const apiKey = process.env.EXA_API_KEY;
      if (!apiKey) throw new Error("EXA_API_KEY not set");

      console.log(`[Exa][${state.code}] Starting sequential search (casinos then offers, 2 req/s rate limit)...`);

      // Sequential calls to respect Exa's 2 req/sec rate limit
      // (pipeline runs multiple states in parallel, so we serialize within each state)
      const casinoResult = await exaDeepSearch(
        apiKey,
        `All licensed online casino operators in ${state.name}, regulated by ${state.gaming_commission}. Include brand name, parent company, website, and license status. Only online casino operators, not sportsbook-only.`,
        EXA_CASINO_SCHEMA,
        `${state.code}/casinos`
      );

      // Small delay to stay under rate limit when multiple states run concurrently
      await new Promise((resolve) => setTimeout(resolve, 600));

      const offerResult = await exaDeepSearch(
        apiKey,
        `Current new player promotional offers and welcome bonuses for online casinos in ${state.name}. Include deposit match bonuses, no-deposit bonuses, free play offers. Only casino promotions, NOT sportsbook. Include bonus amounts, deposit requirements, wagering requirements, and promo codes.`,
        EXA_OFFERS_SCHEMA,
        `${state.code}/offers`
      );

      const allCitations = [...new Set([...casinoResult.citations, ...offerResult.citations])];

      // Parse casinos
      let casinos: CasinoWithOffers[] = [];
      try {
        const casinoParsed = typeof casinoResult.output === "string" ? JSON.parse(casinoResult.output) : casinoResult.output;
        const rawCasinos = casinoParsed?.casinos ?? [];
        casinos = rawCasinos.map((c: Record<string, string>) => ({
          name: String(c.name ?? ""),
          operator: String(c.operator ?? ""),
          website: String(c.website ?? ""),
          license_status: String(c.license_status ?? ""),
          offers: [] as CasinoWithOffers["offers"],
        }));
        console.log(`[Exa][${state.code}] Parsed ${casinos.length} casinos`);
      } catch (err) {
        console.error(`[Exa][${state.code}] Failed to parse casinos:`, err);
        console.error(`[Exa][${state.code}] Raw: ${String(casinoResult.output).substring(0, 500)}`);
      }

      // Parse offers and attach to casinos by name
      try {
        const offerParsed = typeof offerResult.output === "string" ? JSON.parse(offerResult.output) : offerResult.output;
        const rawOffers = offerParsed?.offers ?? [];
        console.log(`[Exa][${state.code}] Parsed ${rawOffers.length} offers`);

        for (const o of rawOffers) {
          const offerCasinoName = String(o.casino_name ?? "").toLowerCase();
          // Find matching casino (fuzzy: includes check)
          const match = casinos.find(c =>
            c.name.toLowerCase() === offerCasinoName ||
            offerCasinoName.includes(c.name.toLowerCase()) ||
            c.name.toLowerCase().includes(offerCasinoName)
          );
          const offer = {
            type: String(o.type ?? ""),
            description: String(o.description ?? ""),
            deposit_required: typeof o.deposit_required === "number" ? o.deposit_required : null,
            bonus_amount: typeof o.bonus_amount === "number" ? o.bonus_amount : null,
            wagering_requirement: o.wagering_requirement != null ? String(o.wagering_requirement) : null,
            promo_code: o.promo_code != null ? String(o.promo_code) : null,
          };
          if (match) {
            match.offers.push(offer);
          } else if (offerCasinoName) {
            // Casino from offers not in discovery — add it
            casinos.push({
              name: String(o.casino_name ?? ""),
              operator: "",
              website: "",
              license_status: "unknown",
              offers: [offer],
            });
          }
        }
      } catch (err) {
        console.error(`[Exa][${state.code}] Failed to parse offers:`, err);
        console.error(`[Exa][${state.code}] Raw: ${String(offerResult.output).substring(0, 500)}`);
      }

      const offerCount = casinos.reduce((sum, c) => sum + c.offers.length, 0);
      console.log(`[Exa][${state.code}] Final: ${casinos.length} casinos, ${offerCount} offers`);
      if (casinos.length > 0) {
        console.log(`[Exa][${state.code}] Sample: ${casinos.slice(0, 3).map(c => `${c.name} (${c.offers.length} offers)`).join(", ")}`);
      }

      return { casinos, citations: allCitations };
    },
  };
}

// --- Tavily Provider (search + Groq LLM extraction) ---
// Tavily doesn't have native structured output, so we use Groq to extract.
// Two API calls per state: Tavily search → Groq extraction.

function createTavilyProvider(): SearchProvider {
  return {
    name: "tavily",
    async researchState(state) {
      const tavilyKey = process.env.TAVILY_API_KEY;
      if (!tavilyKey) throw new Error("TAVILY_API_KEY not set");
      const groqKey = process.env.GROQ_API_KEY;
      if (!groqKey) throw new Error("GROQ_API_KEY not set (required for Tavily provider)");

      console.log(`[Tavily][${state.code}] Searching...`);

      // Step 1: Search with Tavily — broad search, no domain restriction
      const searchResponse = await fetchWithRetry("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tavilyKey}`,
        },
        body: JSON.stringify({
          query: buildStateQuery(state),
          search_depth: "advanced",
          max_results: 15,
          include_answer: "advanced",
          include_raw_content: true,
          topic: "general",
          // No include_domains — same reason as Exa, we need promo sources too
        }),
      });

      if (!searchResponse.ok) {
        const errorText = await searchResponse.text();
        throw new Error(`Tavily API error ${searchResponse.status}: ${errorText}`);
      }

      const searchData = await searchResponse.json();
      const citations: string[] = (searchData.results ?? []).map(
        (r: { url: string }) => r.url
      );

      console.log(`[Tavily][${state.code}] Got ${citations.length} results, extracting with Groq...`);

      // Build context from search results
      const searchContext = (searchData.results ?? [])
        .map((r: { title: string; url: string; raw_content?: string; content: string }) => {
          const body = r.raw_content ? r.raw_content.substring(0, 3000) : r.content;
          return `[${r.title}](${r.url})\n${body}`;
        })
        .join("\n\n---\n\n");

      const answerSection = searchData.answer
        ? `\nAI Summary:\n${searchData.answer}\n\n`
        : "";

      // Step 2: Extract structured data with Groq
      const groqResponse = await fetchWithRetry("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content: "You are a regulatory research assistant. Extract structured casino and offer data from search results. Always respond with valid JSON.",
            },
            {
              role: "user",
              content: `Based on the following search results, ${buildStateQuery(state)}\n${answerSection}Search results:\n${searchContext}\n\nRespond with JSON matching this schema:\n${JSON.stringify(CASINO_FULL_SCHEMA, null, 2)}`,
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
        }),
      });

      if (!groqResponse.ok) {
        const errorText = await groqResponse.text();
        throw new Error(`Groq API error ${groqResponse.status}: ${errorText}`);
      }

      const groqData = await groqResponse.json();
      const content = groqData.choices?.[0]?.message?.content ?? "{}";

      try {
        const parsed = JSON.parse(content);
        const casinos = parseCasinos(parsed);
        console.log(`[Tavily][${state.code}] Extracted ${casinos.length} casinos, ${casinos.reduce((sum, c) => sum + c.offers.length, 0)} total offers`);
        return { casinos, citations };
      } catch (err) {
        console.error(`[Tavily][${state.code}] Failed to parse Groq response:`, err);
        return { casinos: [], citations };
      }
    },
  };
}

// --- Perplexity Sonar Provider ---

function createPerplexityProvider(): SearchProvider {
  return {
    name: "perplexity",
    async researchState(state) {
      const apiKey = process.env.PERPLEXITY_API_KEY;
      if (!apiKey) throw new Error("PERPLEXITY_API_KEY not set");

      console.log(`[Perplexity][${state.code}] Searching...`);

      const response = await fetchWithRetry("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: process.env.PERPLEXITY_MODEL ?? "sonar-pro",
          messages: [
            {
              role: "system",
              content: "You are a regulatory research assistant specializing in US online gambling. Provide accurate, well-sourced information about licensed online casino operators and their promotional offers.",
            },
            {
              role: "user",
              content: buildStateQuery(state),
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "casino_research",
              schema: CASINO_FULL_SCHEMA,
              strict: true,
            },
          },
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Perplexity API error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content ?? "{}";
      const citations: string[] = data.citations ?? [];

      try {
        const parsed = JSON.parse(content);
        const casinos = parseCasinos(parsed);
        console.log(`[Perplexity][${state.code}] Found ${casinos.length} casinos, ${casinos.reduce((sum, c) => sum + c.offers.length, 0)} total offers`);
        return { casinos, citations };
      } catch (err) {
        console.error(`[Perplexity][${state.code}] Failed to parse response:`, err);
        return { casinos: [], citations };
      }
    },
  };
}

// --- Factory ---

export function createSearchProvider(type: SearchProviderType): SearchProvider {
  switch (type) {
    case "exa":
      return createExaProvider();
    case "perplexity":
      return createPerplexityProvider();
    case "tavily":
      return createTavilyProvider();
    default:
      throw new Error(`Unknown search provider: ${type}`);
  }
}

/** Check which providers have API keys configured */
export function getAvailableProviders(): { name: SearchProviderType; available: boolean }[] {
  return [
    { name: "exa", available: !!process.env.EXA_API_KEY },
    {
      name: "tavily",
      available: !!(process.env.TAVILY_API_KEY && process.env.GROQ_API_KEY),
    },
    { name: "perplexity", available: !!process.env.PERPLEXITY_API_KEY },
  ];
}
