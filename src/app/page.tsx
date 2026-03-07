import { getLatestReport } from "@/lib/store";
import ReportDashboard from "@/components/ReportDashboard";
import RunButton from "@/components/RunButton";

export const dynamic = "force-dynamic";

export default async function Home() {
  const report = await getLatestReport();

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Casino & Offer AI Researcher
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Identifying coverage gaps across NJ, MI, PA, WV
            </p>
          </div>
          <RunButton />
        </div>

        {/* Report or empty state */}
        {report ? (
          <ReportDashboard report={report} />
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <div className="text-gray-400 text-4xl mb-4">&#128269;</div>
            <h2 className="text-lg font-medium text-gray-700 mb-2">
              No research reports yet
            </h2>
            <p className="text-sm text-gray-500">
              Click &quot;Run Research&quot; to start the first analysis.
              <br />
              The pipeline will discover casinos, research offers, and generate a
              comparison report.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
