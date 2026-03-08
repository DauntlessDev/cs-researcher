"use client";

import { useState, useMemo } from "react";
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

  const filteredComparisons = useMemo(() =>
    report.comparisons
      .filter((c) => stateFilter === "all" || c.state === stateFilter)
      .filter((c) => verdictFilter === "all" || c.verdict === verdictFilter)
      .sort((a, b) => (VERDICT_ORDER[a.verdict] ?? 999) - (VERDICT_ORDER[b.verdict] ?? 999)),
    [report.comparisons, stateFilter, verdictFilter]
  );

  const filteredMissing = useMemo(() =>
    report.missing_casinos.filter(
      (c) => stateFilter === "all" || c.state === stateFilter
    ),
    [report.missing_casinos, stateFilter]
  );

  const states = useMemo(() => [...new Set(report.comparisons.map((c) => c.state))].sort(), [report.comparisons]);
  const verdicts = useMemo(() => [...new Set(report.comparisons.map((c) => c.verdict))], [report.comparisons]);

  return (
    <div className="space-y-8">
      {/* Executive Summary */}
      <section>
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span className="w-1 h-5 bg-accent rounded-full" />
          Overview
        </h2>
        <ExecutiveSummary report={report} />
      </section>

      {/* Filters */}
      <section className="flex flex-wrap gap-3 items-center bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <span className="text-sm font-medium text-gray-500" id="filters-label">Filters</span>
        <select
          aria-label="Filter by state"
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="all">All States</option>
          {states.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          aria-label="Filter by verdict"
          value={verdictFilter}
          onChange={(e) => setVerdictFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent"
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
            className="text-xs text-accent hover:text-accent-light font-medium cursor-pointer"
          >
            Clear filters
          </button>
        )}
      </section>

      {/* Cross-State Comparison */}
      <section>
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span className="w-1 h-5 bg-accent rounded-full" />
          Cross-State Offer Comparison
        </h2>
        <CrossStateTable
          comparisons={report.comparisons}
          missingCasinos={report.missing_casinos}
        />
      </section>

      {/* Missing Casinos */}
      <section>
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span className="w-1 h-5 bg-red-500 rounded-full" />
          Missing Casinos
          {stateFilter !== "all" && ` (${stateFilter})`}
        </h2>
        <MissingCasinosTable casinos={filteredMissing} />
      </section>

      {/* Offer Comparisons */}
      <section>
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span className="w-1 h-5 bg-amber-500 rounded-full" />
          Offer Comparisons ({filteredComparisons.length})
        </h2>
        <div className="space-y-3">
          {filteredComparisons.map((comparison) => (
            <OfferComparisonCard key={`${comparison.casino_name}-${comparison.state}`} comparison={comparison} />
          ))}
          {filteredComparisons.length === 0 && (
            <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-gray-400 shadow-sm">
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
