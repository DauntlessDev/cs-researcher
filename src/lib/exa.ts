const EXA_API_URL = "https://api.exa.ai/search";

interface ExaResult {
  title: string;
  url: string;
  text?: string;
  summary?: string;
  highlights?: string[];
}

interface ExaResponse {
  results: ExaResult[];
  requestId: string;
}

async function searchExa(options: {
  query: string;
  numResults?: number;
  type?: "auto" | "neural" | "deep";
  includeDomains?: string[];
  includeText?: string[];
  contents?: {
    text?: boolean | { maxCharacters?: number };
    summary?: { query?: string };
    highlights?: boolean | { query?: string };
  };
}): Promise<ExaResponse> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) throw new Error("EXA_API_KEY not set");

  const body: Record<string, unknown> = {
    query: options.query,
    numResults: options.numResults ?? 15,
    type: options.type ?? "auto",
    contents: options.contents ?? {
      text: { maxCharacters: 3000 },
      highlights: true,
    },
  };

  if (options.includeDomains?.length) {
    body.includeDomains = options.includeDomains;
  }
  if (options.includeText?.length) {
    body.includeText = options.includeText;
  }

  const response = await fetch(EXA_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Exa API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return {
    requestId: data.requestId ?? "",
    results: (data.results ?? []).map((r: Record<string, unknown>) => ({
      title: (r.title as string) ?? "",
      url: (r.url as string) ?? "",
      text: (r.text as string) ?? "",
      summary: (r.summary as string) ?? "",
      highlights: (r.highlights as string[]) ?? [],
    })),
  };
}

// Search for casino regulatory/licensing pages specifically
export async function discoverCasinosExa(
  stateName: string,
  stateCode: string,
  gamingCommission: string,
  officialDomains: string[]
): Promise<{ results: ExaResult[]; allResults: ExaResult[] }> {
  // Two-pronged search: official sources + review aggregators
  const [officialResults, reviewResults] = await Promise.all([
    searchExa({
      query: `${gamingCommission} list of all licensed authorized online casino operators ${stateName}`,
      numResults: 10,
      type: "auto",
      includeDomains: officialDomains.length > 0 ? officialDomains : undefined,
      contents: {
        text: { maxCharacters: 5000 },
        highlights: { query: `licensed online casino ${stateCode}` },
      },
    }),
    searchExa({
      query: `complete list every online casino ${stateName} ${stateCode} 2026 licensed legal`,
      numResults: 10,
      type: "auto",
      contents: {
        text: { maxCharacters: 3000 },
        highlights: { query: `online casino ${stateCode}` },
      },
    }),
  ]);

  // Deduplicate by URL
  const seen = new Set<string>();
  const allResults: ExaResult[] = [];
  for (const r of [...officialResults.results, ...reviewResults.results]) {
    if (!seen.has(r.url)) {
      seen.add(r.url);
      allResults.push(r);
    }
  }

  return {
    results: officialResults.results,
    allResults,
  };
}
