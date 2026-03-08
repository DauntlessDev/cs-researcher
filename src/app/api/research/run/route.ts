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

    const stream = body.stream === true;

    if (!stream) {
      // Non-streaming: return JSON when done (used by cron, etc.)
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
    }

    // Streaming: send progress events as newline-delimited JSON
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          const report = await runResearchPipeline((stage, detail, percent) => {
            console.log(`[${percent}%] ${stage}: ${detail}`);
            const event = JSON.stringify({ type: "progress", stage, detail, percent });
            controller.enqueue(encoder.encode(event + "\n"));
          }, provider);

          const done = JSON.stringify({
            type: "done",
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
            },
          });
          controller.enqueue(encoder.encode(done + "\n"));
        } catch (error) {
          const err = JSON.stringify({
            type: "error",
            error: error instanceof Error ? error.message : "Unknown error",
          });
          controller.enqueue(encoder.encode(err + "\n"));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
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
