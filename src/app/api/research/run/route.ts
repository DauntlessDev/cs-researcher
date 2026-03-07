import { NextResponse } from "next/server";
import { runResearchPipeline } from "@/lib/research-pipeline";

export const maxDuration = 300; // 5 minute timeout for serverless

export async function POST() {
  try {
    const report = await runResearchPipeline((stage, detail, percent) => {
      console.log(`[${percent}%] ${stage}: ${detail}`);
    });

    return NextResponse.json({
      success: true,
      reportId: report.id,
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
