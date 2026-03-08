import { getLatestReport } from "@/lib/store";
import ReportDashboard from "@/components/ReportDashboard";
import RunButton from "@/components/RunButton";

export const dynamic = "force-dynamic";

export default async function Home() {
  const report = await getLatestReport();

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Dark hero header */}
      <div className="bg-dark-900 text-white">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Casino & Offer
                <span className="text-accent"> AI Researcher</span>
              </h1>
              <p className="text-sm text-gray-400 mt-2 max-w-md">
                Identifying coverage gaps and better promotional offers across NJ, MI, PA, WV
              </p>
            </div>
            <RunButton />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {report ? (
          <ReportDashboard report={report} />
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white p-16 text-center shadow-sm">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-dark-900/5 mb-5">
              <svg className="w-8 h-8 text-dark-900/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">
              No research reports yet
            </h2>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">
              Select a provider and click <span className="font-medium text-accent">Run Research</span> to discover casinos, research offers, and generate a comparison report.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
