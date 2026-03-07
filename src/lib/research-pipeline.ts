import {
  STATES,
  DiscoveredCasino,
  DiscoveredOffer,
  OfferComparison,
  ResearchReport,
  XanoOffer,
} from "@/types";
import { fetchExistingOffers } from "./xano";
import { searchTavily, batchSearch } from "./tavily";
import { extractStructuredData, analyzeOfferComparison } from "./gemini";
import { matchCasinos } from "./casino-matcher";
import { saveReport } from "./store";
import {
  DISCOVERY_SYSTEM_PROMPT,
  buildDiscoveryUserPrompt,
  DISCOVERY_JSON_SCHEMA,
} from "@/prompts/casino-discovery";
import {
  OFFER_RESEARCH_SYSTEM_PROMPT,
  buildOfferResearchPrompt,
  OFFER_RESEARCH_JSON_SCHEMA,
} from "@/prompts/offer-research";

type ProgressCallback = (stage: string, detail: string, percent: number) => void;

interface PipelineCounters {
  searchQueries: number;
  llmQueries: number;
  totalCitations: number;
}

export async function runResearchPipeline(
  onProgress?: ProgressCallback
): Promise<ResearchReport> {
  const startTime = Date.now();
  const counters: PipelineCounters = {
    searchQueries: 0,
    llmQueries: 0,
    totalCitations: 0,
  };

  const reportId = `report-${new Date().toISOString().replace(/[:.]/g, "-")}`;

  // Stage 1: Fetch existing offers + discover casinos in parallel
  onProgress?.("discovery", "Fetching existing offers and discovering casinos...", 10);

  const [existingOffers, discoveryResults] = await Promise.all([
    fetchExistingOffers(),
    discoverAllCasinos(counters),
  ]);

  onProgress?.("matching", `Found ${existingOffers.length} existing offers. Matching...`, 30);

  // Stage 2: Match casinos per state
  const allMissing: DiscoveredCasino[] = [];
  const allMatched: { existing: XanoOffer; discovered: DiscoveredCasino }[] = [];

  for (const state of STATES) {
    const stateCasinos = discoveryResults.get(state.code) ?? [];
    const result = matchCasinos(existingOffers, stateCasinos, state.code);
    allMissing.push(...result.missing);
    allMatched.push(...result.matched);
  }

  onProgress?.(
    "offer-research",
    `${allMissing.length} missing casinos, ${allMatched.length} matched. Researching offers...`,
    40
  );

  // Stage 3: Research offers for ALL casinos (matched + missing)
  const casinosToResearch = [
    ...allMatched.map((m) => ({
      name: m.discovered.name,
      state: m.discovered.state,
      website: m.discovered.website,
    })),
    ...allMissing.map((m) => ({
      name: m.name,
      state: m.state,
      website: m.website,
    })),
  ];

  const offersByKey = await researchAllOffers(
    casinosToResearch,
    counters,
    onProgress
  );

  onProgress?.("analysis", "Analyzing offer comparisons with Gemini...", 70);

  // Stage 4: Gemini analysis for matched casinos
  const comparisons: OfferComparison[] = [];

  for (let i = 0; i < allMatched.length; i++) {
    const { existing, discovered } = allMatched[i];
    const key = `${discovered.name}|${discovered.state}`;
    const discoveredOffers = offersByKey.get(key) ?? [];

    const comparison = await analyzeOfferComparison(
      discovered.name,
      discovered.state,
      existing,
      discoveredOffers
    );
    comparisons.push(comparison);
    counters.llmQueries++;

    const pct = 70 + Math.round((i / allMatched.length) * 20);
    onProgress?.(
      "analysis",
      `Analyzed ${i + 1}/${allMatched.length} casinos...`,
      pct
    );
  }

  // Also create comparisons for missing casinos (no existing offer)
  for (const missing of allMissing) {
    const key = `${missing.name}|${missing.state}`;
    const discoveredOffers = offersByKey.get(key) ?? [];
    if (discoveredOffers.length > 0) {
      comparisons.push({
        casino_name: missing.name,
        state: missing.state,
        existing_offer: null,
        discovered_offers: discoveredOffers,
        verdict: "no_data",
        confidence: 1,
        explanation: `New casino not in our database. Found ${discoveredOffers.length} offer(s).`,
        recommended_action: "Add casino and offers to database",
      });
    }
  }

  onProgress?.("saving", "Saving report...", 95);

  const report: ResearchReport = {
    id: reportId,
    timestamp: new Date().toISOString(),
    states: STATES.map((s) => s.code),
    missing_casinos: allMissing,
    comparisons,
    metadata: {
      duration_ms: Date.now() - startTime,
      perplexity_queries: counters.searchQueries,
      claude_queries: counters.llmQueries,
      estimated_cost: 0, // Free tier - no cost
      total_citations: counters.totalCitations,
    },
  };

  await saveReport(report);
  onProgress?.("complete", "Research complete!", 100);

  return report;
}

async function discoverAllCasinos(
  counters: PipelineCounters
): Promise<Map<string, DiscoveredCasino[]>> {
  const results = new Map<string, DiscoveredCasino[]>();

  // Step 1: Search with Tavily (advanced depth) for each state
  // Run sequentially to respect rate limits and maximize quality
  const searchResults: { state: typeof STATES[number]; res: Awaited<ReturnType<typeof searchTavily>> }[] = [];
  for (const state of STATES) {
    counters.searchQueries++;
    const res = await searchTavily({
      query: buildDiscoveryUserPrompt(state),
      searchDepth: "advanced",
      maxResults: 15,
    });
    searchResults.push({ state, res });
  }

  // Step 2: Use Gemini to extract structured data from search results
  for (const { state, res } of searchResults) {
    const citations = res.results.map((r) => r.url);
    counters.totalCitations += citations.length;

    // Use raw_content when available for full page data, fallback to snippet
    const searchContext = res.results
      .map((r) => {
        const body = r.raw_content
          ? r.raw_content.substring(0, 3000)
          : r.content;
        return `[${r.title}](${r.url})\n${body}`;
      })
      .join("\n\n---\n\n");

    // Include Tavily's AI answer as an additional high-quality summary
    const answerSection = res.answer
      ? `\n\nAI-generated summary of search results:\n${res.answer}\n\n`
      : "";

    const jsonSchemaHint = JSON.stringify(DISCOVERY_JSON_SCHEMA, null, 2);

    try {
      counters.llmQueries++;
      const content = await extractStructuredData(
        DISCOVERY_SYSTEM_PROMPT,
        `Based on the following search results, ${buildDiscoveryUserPrompt(state)}\n${answerSection}Search results:\n${searchContext}\n\nIMPORTANT: Extract EVERY casino mentioned across all sources. Do not miss any. Include casinos from regulatory lists, review sites, and any other sources.\n\nRespond with JSON matching this schema:\n${jsonSchemaHint}`
      );

      const parsed = JSON.parse(content);
      const casinos: DiscoveredCasino[] = (parsed.casinos ?? []).map(
        (c: Record<string, string>) => ({
          name: c.name ?? "",
          operator: c.operator ?? "",
          website: c.website ?? "",
          license_status: c.license_status ?? "",
          state: state.code,
          source_urls: citations,
        })
      );
      results.set(state.code, casinos);
    } catch (err) {
      console.error(`Failed to parse discovery results for ${state.code}:`, err);
      results.set(state.code, []);
    }
  }

  return results;
}

async function researchAllOffers(
  casinos: { name: string; state: string; website: string }[],
  counters: PipelineCounters,
  onProgress?: ProgressCallback
): Promise<Map<string, DiscoveredOffer[]>> {
  const offersByKey = new Map<string, DiscoveredOffer[]>();

  // Step 1: Batch search with Tavily (advanced depth for quality)
  const searches = casinos.map((casino) => ({
    query: buildOfferResearchPrompt(casino.name, casino.state),
    searchDepth: "advanced" as const,
    maxResults: 10,
    includeDomains: extractHostname(casino.website),
  }));

  counters.searchQueries += searches.length;
  const searchResponses = await batchSearch(searches, 3);

  // Step 2: Use Gemini to extract structured offers from each search result
  const jsonSchemaHint = JSON.stringify(OFFER_RESEARCH_JSON_SCHEMA, null, 2);

  for (let i = 0; i < casinos.length; i++) {
    const casino = casinos[i];
    const res = searchResponses[i];
    const key = `${casino.name}|${casino.state}`;
    const citations = res.results.map((r) => r.url);
    counters.totalCitations += citations.length;

    // Use raw_content for full page data when available
    const searchContext = res.results
      .map((r) => {
        const body = r.raw_content
          ? r.raw_content.substring(0, 2000)
          : r.content;
        return `[${r.title}](${r.url})\n${body}`;
      })
      .join("\n\n---\n\n");

    const answerSection = res.answer
      ? `\n\nAI-generated summary:\n${res.answer}\n\n`
      : "";

    try {
      counters.llmQueries++;
      const content = await extractStructuredData(
        OFFER_RESEARCH_SYSTEM_PROMPT,
        `Based on the following search results, ${buildOfferResearchPrompt(casino.name, casino.state)}\n${answerSection}Search results:\n${searchContext}\n\nExtract ALL promotional offers found. Include deposit match amounts, bonus amounts, wagering requirements, and promo codes when available.\n\nRespond with JSON matching this schema:\n${jsonSchemaHint}`
      );

      const parsed = JSON.parse(content);
      const offers: DiscoveredOffer[] = (parsed.offers ?? []).map(
        (o: Record<string, unknown>) => ({
          casino_name: casino.name,
          state: casino.state,
          type: (o.type as string) ?? "",
          description: (o.description as string) ?? "",
          deposit_required: o.deposit_required as number | null,
          bonus_amount: o.bonus_amount as number | null,
          wagering_requirement: o.wagering_requirement as string | null,
          promo_code: o.promo_code as string | null,
          source_urls: citations,
        })
      );
      offersByKey.set(key, offers);
    } catch {
      console.error(`Failed to parse offers for ${casino.name}`);
      offersByKey.set(key, []);
    }

    if (onProgress && i % 5 === 0) {
      const pct = 40 + Math.round((i / casinos.length) * 30);
      onProgress("offer-research", `Researched ${i + 1}/${casinos.length} casinos...`, pct);
    }
  }

  return offersByKey;
}

function extractHostname(website: string): string[] | undefined {
  if (!website) return undefined;
  try {
    const url = website.startsWith("http") ? website : `https://${website}`;
    return [new URL(url).hostname];
  } catch {
    return undefined;
  }
}
