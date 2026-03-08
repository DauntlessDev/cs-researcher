import {
  STATES,
  DiscoveredCasino,
  DiscoveredOffer,
  OfferComparison,
  ResearchReport,
  XanoOffer,
} from "@/types";
import { fetchExistingOffers } from "./xano";
import { matchCasinos } from "./casino-matcher";
import { saveReport } from "./store";
import {
  SearchProviderType,
  CasinoWithOffers,
  createSearchProvider,
} from "./search-provider";

type ProgressCallback = (stage: string, detail: string, percent: number) => void;

export async function runResearchPipeline(
  onProgress?: ProgressCallback,
  providerType: SearchProviderType = "exa"
): Promise<ResearchReport> {
  const startTime = Date.now();
  let searchQueries = 0;
  let llmQueries = 0;
  let totalCitations = 0;

  const provider = createSearchProvider(providerType);
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const reportId = `report-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomSuffix}`;

  // Stage 1: Fetch existing offers + research all states
  // Exa/Perplexity: parallel (each call is self-contained)
  // Tavily: sequential (Groq free tier rate limit: 6000 tokens/min)
  onProgress?.("discovery", `Researching casinos with ${provider.name}...`, 10);

  const callsPerState = providerType === "exa" ? 2 : 1; // Exa does 2 calls per state (casinos + offers)
  const existingOffersPromise = fetchExistingOffers();

  type StateResult = { state: typeof STATES[number] } & Awaited<ReturnType<typeof provider.researchState>>;
  let stateResults: StateResult[];

  if (providerType === "tavily") {
    // Sequential for Tavily — Groq rate limits
    stateResults = [];
    for (let i = 0; i < STATES.length; i++) {
      const state = STATES[i];
      const result = await provider.researchState(state);
      searchQueries += callsPerState;
      totalCitations += result.citations.length;
      stateResults.push({ state, ...result });
      const pct = 10 + Math.round(((i + 1) / STATES.length) * 40);
      onProgress?.("discovery", `Completed ${state.code} (${result.casinos.length} casinos)`, pct);
    }
  } else {
    // Staggered parallel — offset each state by 600ms to respect Exa's 2 req/sec limit
    stateResults = await Promise.all(
      STATES.map(async (state, i) => {
        if (i > 0) await new Promise((resolve) => setTimeout(resolve, i * 600));
        const result = await provider.researchState(state);
        searchQueries += callsPerState;
        totalCitations += result.citations.length;
        const pct = 10 + Math.round(((i + 1) / STATES.length) * 40);
        onProgress?.("discovery", `Completed ${state.code} (${result.casinos.length} casinos)`, pct);
        return { state, ...result };
      })
    );
  }

  const existingOffers = await existingOffersPromise;

  console.log(`[PIPELINE] Existing offers from Xano: ${existingOffers.length}`);
  onProgress?.("matching", "Matching casinos against database...", 55);

  // Stage 2: Convert provider results → DiscoveredCasino + DiscoveredOffer, then match
  const allMissing: DiscoveredCasino[] = [];
  const allMatched: { existing: XanoOffer; discovered: DiscoveredCasino }[] = [];
  const offersByKey = new Map<string, DiscoveredOffer[]>();

  for (const { state, casinos, citations } of stateResults) {
    const discoveredCasinos: DiscoveredCasino[] = casinos.map((c: CasinoWithOffers) => ({
      name: c.name,
      operator: c.operator,
      website: c.website,
      license_status: c.license_status,
      state: state.code,
      source_urls: citations,
    }));

    for (const c of casinos) {
      const key = `${c.name}|${state.code}`;
      offersByKey.set(
        key,
        c.offers.map((o) => ({
          casino_name: c.name,
          state: state.code,
          type: o.type,
          description: o.description,
          deposit_required: o.deposit_required,
          bonus_amount: o.bonus_amount,
          wagering_requirement: o.wagering_requirement,
          promo_code: o.promo_code,
          source_urls: citations,
        }))
      );
    }

    const result = matchCasinos(existingOffers, discoveredCasinos, state.code);
    allMissing.push(...result.missing);
    allMatched.push(...result.matched);
    console.log(`[PIPELINE][${state.code}] Match results: ${result.matched.length} matched, ${result.missing.length} missing`);
  }

  console.log(`[PIPELINE] Total: ${allMatched.length} matched casinos, ${allMissing.length} missing casinos`);
  onProgress?.("analysis", "Comparing offers...", 70);

  // Stage 3: Programmatic comparison first, collect ambiguous cases
  const comparisons: OfferComparison[] = [];
  const ambiguousCases: AmbiguousCase[] = [];

  for (const { existing, discovered } of allMatched) {
    const key = `${discovered.name}|${discovered.state}`;
    const discoveredOffers = offersByKey.get(key) ?? [];
    const result = compareOffersProgrammatic(discovered.name, discovered.state, existing, discoveredOffers);

    if (result.needsLlm) {
      ambiguousCases.push({
        index: comparisons.length,
        casino_name: discovered.name,
        state: discovered.state,
        existing,
        discoveredOffers,
        reason: result.reason,
      });
    }
    comparisons.push(result.comparison);
  }

  // Missing casino entries (no comparison needed)
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
        explanation: `New casino not in database. Found ${discoveredOffers.length} offer(s).`,
        recommended_action: "Add casino and offers to database",
      });
    }
  }

  // Log comparison breakdown
  const verdictCounts: Record<string, number> = {};
  for (const c of comparisons) {
    verdictCounts[c.verdict] = (verdictCounts[c.verdict] ?? 0) + 1;
  }
  console.log(`[PIPELINE] Programmatic verdicts: ${JSON.stringify(verdictCounts)}, ${ambiguousCases.length} ambiguous → LLM`);

  // Stage 4: Batch LLM call for ambiguous cases only (0 or 1 call)
  if (ambiguousCases.length > 0) {
    onProgress?.(
      "analysis",
      `${comparisons.length - ambiguousCases.length} resolved programmatically. Sending ${ambiguousCases.length} ambiguous case(s) to LLM...`,
      80
    );

    console.log(`[PIPELINE] LLM batch: sending ${ambiguousCases.length} cases (reasons: ${ambiguousCases.map(c => c.reason).join(", ")})`);
    const llmStartMs = Date.now();
    const llmVerdicts = await batchLlmComparison(ambiguousCases);
    console.log(`[PIPELINE] LLM batch completed in ${Date.now() - llmStartMs}ms — ${llmVerdicts.filter(v => v !== null).length}/${ambiguousCases.length} resolved`);
    llmQueries++;

    for (let i = 0; i < ambiguousCases.length; i++) {
      const ac = ambiguousCases[i];
      const llmResult = llmVerdicts[i];
      if (llmResult) {
        comparisons[ac.index] = {
          ...comparisons[ac.index],
          verdict: llmResult.verdict,
          confidence: llmResult.confidence,
          explanation: llmResult.explanation,
          recommended_action: llmResult.recommended_action,
        };
      } else {
        // LLM failed or unavailable — replace "Pending" with honest fallback
        const c = comparisons[ac.index];
        comparisons[ac.index] = {
          ...c,
          explanation: c.explanation.replace("Pending LLM analysis of ", "Manual review needed for "),
          recommended_action: "Manual review required — automated comparison inconclusive",
        };
      }
    }
  } else {
    onProgress?.("analysis", "All comparisons resolved programmatically.", 85);
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
      search_queries: searchQueries,
      llm_queries: llmQueries + (providerType === "tavily" ? searchQueries : 0),
      estimated_cost: 0,
      total_citations: totalCitations,
    },
  };

  await saveReport(report);

  const totalSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[PIPELINE] ===== COMPLETE =====`);
  console.log(`[PIPELINE] Duration: ${totalSec}s | Searches: ${searchQueries} | LLM calls: ${llmQueries + (providerType === "tavily" ? searchQueries : 0)} | Citations: ${totalCitations}`);
  console.log(`[PIPELINE] Missing casinos: ${allMissing.length} | Comparisons: ${comparisons.length} | Better offers: ${comparisons.filter(c => c.verdict === "discovered_better").length}`);

  onProgress?.("complete", "Research complete!", 100);

  return report;
}

// --- Programmatic comparison ---

interface CompareResult {
  comparison: OfferComparison;
  needsLlm: boolean;
  reason: string;
}

interface AmbiguousCase {
  index: number;
  casino_name: string;
  state: string;
  existing: XanoOffer;
  discoveredOffers: DiscoveredOffer[];
  reason: string;
}

function compareOffersProgrammatic(
  casinoName: string,
  state: string,
  existing: XanoOffer,
  discoveredOffers: DiscoveredOffer[]
): CompareResult {
  const base = {
    casino_name: casinoName,
    state,
    existing_offer: existing,
    discovered_offers: discoveredOffers,
  };

  // No discovered offers → no_data, no LLM needed
  if (discoveredOffers.length === 0) {
    return {
      needsLlm: false,
      reason: "",
      comparison: {
        ...base,
        verdict: "no_data",
        confidence: 0.5,
        explanation: "No offers found from research to compare against.",
        recommended_action: "Manual review — research may have missed current offers",
      },
    };
  }

  const bestDiscovered = discoveredOffers.reduce((best, current) => {
    const bestBonus = best.bonus_amount ?? 0;
    const currentBonus = current.bonus_amount ?? 0;
    return currentBonus > bestBonus ? current : best;
  }, discoveredOffers[0]);

  const existingBonus = existing.Expected_Bonus ?? 0;
  const discoveredBonus = bestDiscovered.bonus_amount ?? 0;

  // Clear type mismatch → different_type, no LLM needed
  const existingType = existing.offer_type?.toLowerCase() ?? "";
  const discoveredType = bestDiscovered.type?.toLowerCase() ?? "";
  const typeMismatch =
    (existingType.includes("deposit") && discoveredType.includes("no_deposit")) ||
    (existingType.includes("no_deposit") && discoveredType.includes("deposit_match"));

  if (typeMismatch) {
    return {
      needsLlm: false,
      reason: "",
      comparison: {
        ...base,
        verdict: "different_type",
        confidence: 0.7,
        explanation: `Different offer types: existing "${existing.offer_type}" vs discovered "${bestDiscovered.type}".`,
        recommended_action: "Review — may want to track both offer types",
      },
    };
  }

  // Clear winner by >25% difference → no LLM needed
  if (existingBonus > 0 && discoveredBonus > 0) {
    const ratio = discoveredBonus / existingBonus;

    if (ratio > 1.25) {
      return {
        needsLlm: false,
        reason: "",
        comparison: {
          ...base,
          verdict: "discovered_better",
          confidence: 0.9,
          explanation: `Discovered offer is clearly better: $${discoveredBonus} vs existing $${existingBonus} bonus.`,
          recommended_action: "Update offer in database with better terms",
        },
      };
    }

    if (ratio < 0.75) {
      return {
        needsLlm: false,
        reason: "",
        comparison: {
          ...base,
          verdict: "existing_better",
          confidence: 0.9,
          explanation: `Existing offer is clearly better: $${existingBonus} vs discovered $${discoveredBonus} bonus.`,
          recommended_action: "Keep current offer — it's already competitive",
        },
      };
    }
  }

  // --- Ambiguous cases: send to LLM ---

  // Close bonus amounts (within 25%) — wagering terms may be the tiebreaker
  if (existingBonus > 0 && discoveredBonus > 0) {
    return {
      needsLlm: true,
      reason: "close_bonus",
      comparison: {
        ...base,
        verdict: "comparable",
        confidence: 0.4,
        explanation: `Bonuses are close ($${existingBonus} vs $${discoveredBonus}). Pending LLM analysis of wagering terms.`,
        recommended_action: "Pending LLM analysis",
      },
    };
  }

  // One or both have $0/null bonus — can't compare numerically
  if (existingBonus === 0 || discoveredBonus === 0) {
    return {
      needsLlm: true,
      reason: "missing_amounts",
      comparison: {
        ...base,
        verdict: "no_data",
        confidence: 0.3,
        explanation: `Cannot compare numerically (existing: $${existingBonus}, discovered: $${discoveredBonus}). Pending LLM analysis of offer descriptions.`,
        recommended_action: "Pending LLM analysis",
      },
    };
  }

  // Fallback — shouldn't reach here, but send to LLM to be safe
  return {
    needsLlm: true,
    reason: "unclear",
    comparison: {
      ...base,
      verdict: "no_data",
      confidence: 0.3,
      explanation: "Could not determine programmatically. Pending LLM analysis.",
      recommended_action: "Pending LLM analysis",
    },
  };
}

// --- Batched LLM comparison (1 call for ALL ambiguous cases) ---

interface LlmVerdict {
  verdict: OfferComparison["verdict"];
  confidence: number;
  explanation: string;
  recommended_action: string;
}

const VALID_VERDICTS: Set<string> = new Set([
  "discovered_better", "existing_better", "comparable", "different_type", "no_data",
]);

async function batchLlmComparison(cases: AmbiguousCase[]): Promise<(LlmVerdict | null)[]> {
  // Try Groq first, then Perplexity as fallback
  const groqKey = process.env.GROQ_API_KEY;
  const perplexityKey = process.env.PERPLEXITY_API_KEY;

  if (!groqKey && !perplexityKey) {
    console.warn("[PIPELINE] No LLM key available — ambiguous comparisons will use programmatic defaults");
    return cases.map(() => null);
  }

  // Build a single prompt with all cases numbered
  const caseSummaries = cases.map((c, i) => {
    const existing = c.existing;
    const best = c.discoveredOffers.reduce((b, cur) =>
      (cur.bonus_amount ?? 0) > (b.bonus_amount ?? 0) ? cur : b,
      c.discoveredOffers[0]
    );

    return `Case ${i + 1}: ${c.casino_name} (${c.state})
  Reason: ${c.reason}
  Existing: "${existing.Offer_Name}" — type: ${existing.offer_type}, deposit: $${existing.Expected_Deposit}, bonus: $${existing.Expected_Bonus}
  Best discovered: "${best.description}" — type: ${best.type}, deposit: $${best.deposit_required ?? "N/A"}, bonus: $${best.bonus_amount ?? "N/A"}, wagering: ${best.wagering_requirement ?? "N/A"}
  All discovered offers: ${c.discoveredOffers.map((o) => `"${o.description}" ($${o.bonus_amount ?? "N/A"}, wagering: ${o.wagering_requirement ?? "N/A"})`).join("; ")}`;
  }).join("\n\n");

  const systemPrompt = "You are a casino promotions analyst. Compare existing vs discovered offers considering bonus amounts, deposit requirements, wagering terms, and overall value. Always respond with valid JSON.";

  const userPrompt = `Compare these ${cases.length} casino offer(s). For each, determine which is genuinely better for the player.

${caseSummaries}

Respond with a JSON object:
{
  "results": [
    {
      "case": 1,
      "verdict": "discovered_better" | "existing_better" | "comparable" | "different_type" | "no_data",
      "confidence": 0.0 to 1.0,
      "explanation": "brief explanation focusing on key differences (wagering, deposit, total value)",
      "recommended_action": "what to do"
    }
  ]
}`;

  try {
    let content: string;

    if (groqKey) {
      content = await callGroq(systemPrompt, userPrompt, groqKey);
    } else {
      content = await callPerplexity(systemPrompt, userPrompt, perplexityKey!);
    }

    const parsed = JSON.parse(content);
    const results: (LlmVerdict | null)[] = [];

    for (let i = 0; i < cases.length; i++) {
      const r = parsed.results?.find((r: { case: number }) => r.case === i + 1);
      if (r && VALID_VERDICTS.has(r.verdict)) {
        results.push({
          verdict: r.verdict as LlmVerdict["verdict"],
          confidence: typeof r.confidence === "number" ? Math.min(1, Math.max(0, r.confidence)) : 0.5,
          explanation: String(r.explanation ?? ""),
          recommended_action: String(r.recommended_action ?? "Manual review required"),
        });
      } else {
        results.push(null);
      }
    }

    return results;
  } catch (err) {
    console.error("[PIPELINE] Batch LLM comparison failed:", err);
    return cases.map(() => null);
  }
}

async function callGroq(system: string, user: string, apiKey: string): Promise<string> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "{}";
}

async function callPerplexity(system: string, user: string, apiKey: string): Promise<string> {
  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.PERPLEXITY_MODEL ?? "sonar-pro",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Perplexity API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "{}";
}
