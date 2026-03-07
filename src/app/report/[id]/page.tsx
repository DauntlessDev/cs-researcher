import { getReport } from "@/lib/store";
import ReportDashboard from "@/components/ReportDashboard";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await getReport(id);

  if (!report) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <Link
            href="/"
            className="text-sm text-blue-600 hover:underline mb-2 inline-block"
          >
            &larr; Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            Research Report
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            ID: {report.id}
          </p>
        </div>
        <ReportDashboard report={report} />
      </div>
    </main>
  );
}
