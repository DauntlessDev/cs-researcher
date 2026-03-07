import { ResearchReport } from "@/types";
import ExecutiveSummary from "./ExecutiveSummary";
import MissingCasinosTable from "./MissingCasinosTable";
import OfferComparisonCard from "./OfferComparisonCard";

export default function ReportDashboard({ report }: { report: ResearchReport }) {
  const duration = Math.round(report.metadata.duration_ms / 1000);
  const sortedComparisons = [...report.comparisons].sort((a, b) => {
    const order = {
      discovered_better: 0,
      different_type: 1,
      no_data: 2,
      comparable: 3,
      existing_better: 4,
    };
    return order[a.verdict] - order[b.verdict];
  });

  return (
    <div className="space-y-8">
      {/* Executive Summary */}
      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Overview</h2>
        <ExecutiveSummary report={report} />
      </section>

      {/* Missing Casinos */}
      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Missing Casinos
        </h2>
        <MissingCasinosTable casinos={report.missing_casinos} />
      </section>

      {/* Offer Comparisons */}
      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Offer Comparisons ({report.comparisons.length})
        </h2>
        <div className="space-y-4">
          {sortedComparisons.map((comparison, i) => (
            <OfferComparisonCard key={i} comparison={comparison} />
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="text-xs text-gray-400 border-t border-gray-200 pt-4 flex flex-wrap gap-4">
        <span>
          Generated: {new Date(report.timestamp).toLocaleString()}
        </span>
        <span>Duration: {duration}s</span>
        <span>
          API calls: {report.metadata.perplexity_queries} Tavily +{" "}
          {report.metadata.claude_queries} Gemini
        </span>
        <span>Est. cost: ${report.metadata.estimated_cost.toFixed(2)}</span>
        <span>{report.metadata.total_citations} sources cited</span>
      </footer>
    </div>
  );
}
