"use client";

import { useState } from "react";
import { ResearchReport } from "@/types";
import ExecutiveSummary from "./ExecutiveSummary";
import MissingCasinosTable from "./MissingCasinosTable";
import OfferComparisonCard from "./OfferComparisonCard";
import CrossStateTable from "./CrossStateTable";

const VERDICT_ORDER = {
  discovered_better: 0,
  different_type: 1,
  no_data: 2,
  comparable: 3,
  existing_better: 4,
};

export default function ReportDashboard({ report }: { report: ResearchReport }) {
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [verdictFilter, setVerdictFilter] = useState<string>("all");

  const filteredComparisons = report.comparisons
    .filter((c) => stateFilter === "all" || c.state === stateFilter)
    .filter((c) => verdictFilter === "all" || c.verdict === verdictFilter)
    .sort((a, b) => VERDICT_ORDER[a.verdict] - VERDICT_ORDER[b.verdict]);

  const filteredMissing = report.missing_casinos.filter(
    (c) => stateFilter === "all" || c.state === stateFilter
  );

  const states = [...new Set(report.comparisons.map((c) => c.state))].sort();
  const verdicts = [...new Set(report.comparisons.map((c) => c.verdict))];

  return (
    <div className="space-y-8">
      {/* Executive Summary */}
      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Overview</h2>
        <ExecutiveSummary report={report} />
      </section>

      {/* Filters */}
      <section className="flex flex-wrap gap-3 items-center">
        <span className="text-sm font-medium text-gray-600">Filter:</span>
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white"
        >
          <option value="all">All States</option>
          {states.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={verdictFilter}
          onChange={(e) => setVerdictFilter(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white"
        >
          <option value="all">All Verdicts</option>
          {verdicts.map((v) => (
            <option key={v} value={v}>
              {v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            </option>
          ))}
        </select>
        {(stateFilter !== "all" || verdictFilter !== "all") && (
          <button
            onClick={() => { setStateFilter("all"); setVerdictFilter("all"); }}
            className="text-xs text-blue-600 hover:underline"
          >
            Clear filters
          </button>
        )}
      </section>

      {/* Cross-State Comparison */}
      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Cross-State Offer Comparison
        </h2>
        <CrossStateTable
          comparisons={report.comparisons}
          missingCasinos={report.missing_casinos}
        />
      </section>

      {/* Missing Casinos */}
      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Missing Casinos
          {stateFilter !== "all" && ` (${stateFilter})`}
        </h2>
        <MissingCasinosTable casinos={filteredMissing} />
      </section>

      {/* Offer Comparisons */}
      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Offer Comparisons ({filteredComparisons.length})
        </h2>
        <div className="space-y-4">
          {filteredComparisons.map((comparison, i) => (
            <OfferComparisonCard key={i} comparison={comparison} />
          ))}
          {filteredComparisons.length === 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-gray-500">
              No comparisons match the current filters.
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="text-xs text-gray-400 border-t border-gray-200 pt-4 flex flex-wrap gap-4">
        <span>
          Generated: {new Date(report.timestamp).toLocaleString()}
        </span>
        <span>Duration: {Math.round(report.metadata.duration_ms / 1000)}s</span>
        <span>
          API calls: {report.metadata.search_queries} search +{" "}
          {report.metadata.llm_queries} analysis
        </span>
        <span>Est. cost: ${report.metadata.estimated_cost.toFixed(2)}</span>
        <span>{report.metadata.total_citations} sources cited</span>
      </footer>
    </div>
  );
}
