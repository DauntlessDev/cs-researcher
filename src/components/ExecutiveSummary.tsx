import { ResearchReport } from "@/types";

export default function ExecutiveSummary({ report }: { report: ResearchReport }) {
  const betterOffers = report.comparisons.filter(
    (c) => c.verdict === "discovered_better"
  ).length;
  const comparableOffers = report.comparisons.filter(
    (c) => c.verdict === "comparable"
  ).length;
  const existingBetter = report.comparisons.filter(
    (c) => c.verdict === "existing_better"
  ).length;

  const stats = [
    {
      label: "Missing Casinos",
      value: report.missing_casinos.length,
      color: report.missing_casinos.length > 0 ? "text-red-600" : "text-green-600",
    },
    {
      label: "Better Offers Found",
      value: betterOffers,
      color: betterOffers > 0 ? "text-amber-600" : "text-green-600",
    },
    {
      label: "Our Offer is Better",
      value: existingBetter,
      color: "text-green-600",
    },
    {
      label: "Comparable",
      value: comparableOffers,
      color: "text-gray-600",
    },
    {
      label: "States Covered",
      value: report.states.length,
      color: "text-blue-600",
    },
    {
      label: "Sources Cited",
      value: report.metadata.total_citations,
      color: "text-blue-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-white rounded-lg border border-gray-200 p-4 text-center"
        >
          <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
          <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}
