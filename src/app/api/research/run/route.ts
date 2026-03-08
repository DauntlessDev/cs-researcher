import { NextRequest, NextResponse } from "next/server";
import { runResearchPipeline } from "@/lib/research-pipeline";
import { SearchProviderType } from "@/lib/search-provider";

export const maxDuration = 300; // 5 minute timeout for serverless

const VALID_PROVIDERS: SearchProviderType[] = ["exa", "perplexity", "tavily"];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const provider = VALID_PROVIDERS.includes(body.provider)
      ? (body.provider as SearchProviderType)
      : "exa";

    const report = await runResearchPipeline((stage, detail, percent) => {
      console.log(`[${percent}%] ${stage}: ${detail}`);
    }, provider);

    return NextResponse.json({
      success: true,
      reportId: report.id,
      provider,
      summary: {
        missing_casinos: report.missing_casinos.length,
        comparisons: report.comparisons.length,
        better_offers_found: report.comparisons.filter(
          (c) => c.verdict === "discovered_better"
        ).length,
        duration_ms: report.metadata.duration_ms,
        estimated_cost: report.metadata.estimated_cost,
      },
    });
  } catch (error) {
    console.error("Research pipeline error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
