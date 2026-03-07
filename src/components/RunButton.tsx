"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RunButton() {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleRun() {
    setRunning(true);
    setStatus("Starting research pipeline...");
    setError(null);

    try {
      const res = await fetch("/api/research/run", { method: "POST" });
      const data = await res.json();

      if (data.success) {
        setStatus(
          `Complete! Found ${data.summary.missing_casinos} missing casinos, ` +
            `${data.summary.better_offers_found} better offers. ` +
            `Cost: $${data.summary.estimated_cost}. ` +
            `Duration: ${Math.round(data.summary.duration_ms / 1000)}s.`
        );
        router.refresh();
      } else {
        setError(data.error || "Research failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleRun}
        disabled={running}
        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {running ? (
          <span className="flex items-center gap-2">
            <svg
              className="animate-spin h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Running Research...
          </span>
        ) : (
          "Run Research"
        )}
      </button>
      {status && !error && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
          {status}
        </div>
      )}
      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
        </div>
      )}
    </div>
  );
}
