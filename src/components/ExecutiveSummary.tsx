"use client";

import { useMemo } from "react";
import { ResearchReport, STATES } from "@/types";

export default function ExecutiveSummary({ report }: { report: ResearchReport }) {
  const { betterOffers, comparableOffers, existingBetter } = useMemo(() => ({
    betterOffers: report.comparisons.filter((c) => c.verdict === "discovered_better").length,
    comparableOffers: report.comparisons.filter((c) => c.verdict === "comparable").length,
    existingBetter: report.comparisons.filter((c) => c.verdict === "existing_better").length,
  }), [report.comparisons]);

  const stats = [
    {
      label: "Missing Casinos",
      value: report.missing_casinos.length,
      color: report.missing_casinos.length > 0 ? "text-red-500" : "text-emerald-500",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
        </svg>
      ),
    },
    {
      label: "Better Offers Found",
      value: betterOffers,
      color: betterOffers > 0 ? "text-amber-500" : "text-emerald-500",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
        </svg>
      ),
    },
    {
      label: "Our Offer Better",
      value: existingBetter,
      color: "text-emerald-500",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: "Comparable",
      value: comparableOffers,
      color: "text-gray-500",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
        </svg>
      ),
    },
    {
      label: "States Covered",
      value: report.states.length,
      color: "text-blue-500",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
        </svg>
      ),
    },
    {
      label: "Sources Cited",
      value: report.metadata.total_citations,
      color: "text-blue-500",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.388a4.5 4.5 0 00-1.242-7.244l4.5-4.5a4.5 4.5 0 016.364 6.364l-1.757 1.757" />
        </svg>
      ),
    },
  ];

  // Per-state breakdown
  const stateStats = useMemo(() => STATES.map((s) => {
    const state = s.code;
    const missing = report.missing_casinos.filter((c) => c.state === state).length;
    const better = report.comparisons.filter(
      (c) => c.state === state && c.verdict === "discovered_better"
    ).length;
    const total = report.comparisons.filter((c) => c.state === state).length;
    return { state, missing, better, total };
  }), [report.missing_casinos, report.comparisons]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className={`${stat.color} mb-2 opacity-60`}>{stat.icon}</div>
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Per-state breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stateStats.map(({ state, missing, better, total }) => (
          <div
            key={state}
            className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-gray-800 text-lg">{state}</span>
              <span className="text-xs text-gray-400">{total} compared</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className={`flex items-center gap-1 ${missing > 0 ? "text-red-500 font-medium" : "text-emerald-500"}`}>
                <span className={`w-2 h-2 rounded-full ${missing > 0 ? "bg-red-500" : "bg-emerald-500"}`} />
                {missing} missing
              </span>
              <span className={`flex items-center gap-1 ${better > 0 ? "text-amber-500 font-medium" : "text-gray-400"}`}>
                <span className={`w-2 h-2 rounded-full ${better > 0 ? "bg-amber-500" : "bg-gray-300"}`} />
                {better} better
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
