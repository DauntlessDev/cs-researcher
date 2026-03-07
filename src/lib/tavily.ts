interface TavilySearchOptions {
  query: string;
  searchDepth?: "basic" | "advanced";
  maxResults?: number;
  includeDomains?: string[];
}

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
}

interface TavilyResponse {
  results: TavilyResult[];
  answer?: string;
}

export async function searchTavily(
  options: TavilySearchOptions
): Promise<TavilyResponse> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error("TAVILY_API_KEY not set");

  const body: Record<string, unknown> = {
    query: options.query,
    search_depth: options.searchDepth ?? "basic",
    max_results: options.maxResults ?? 10,
    include_answer: true,
  };

  if (options.includeDomains?.length) {
    body.include_domains = options.includeDomains;
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Tavily API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return {
    results: (data.results ?? []).map((r: Record<string, string>) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      content: r.content ?? "",
    })),
    answer: data.answer,
  };
}

// Run searches with concurrency limit
export async function batchSearch(
  searches: TavilySearchOptions[],
  concurrency = 5
): Promise<TavilyResponse[]> {
  const results: TavilyResponse[] = [];

  for (let i = 0; i < searches.length; i += concurrency) {
    const batch = searches.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(searchTavily));
    results.push(...batchResults);

    if (i + concurrency < searches.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return results;
}
