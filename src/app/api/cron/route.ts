import { NextRequest, NextResponse } from "next/server";
import { runResearchPipeline } from "@/lib/research-pipeline";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const report = await runResearchPipeline(undefined, "exa");
    return NextResponse.json({
      success: true,
      reportId: report.id,
      missing_casinos: report.missing_casinos.length,
      comparisons: report.comparisons.length,
    });
  } catch (error) {
    console.error("Cron research error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
