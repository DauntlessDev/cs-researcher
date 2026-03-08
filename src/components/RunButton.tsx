"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Provider = { name: "exa" | "perplexity" | "tavily"; available: boolean };

const PROVIDER_LABELS: Record<string, string> = {
  exa: "Exa Deep",
  perplexity: "Perplexity Sonar",
  tavily: "Tavily + Groq",
};

export default function RunButton() {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>("exa");
  const router = useRouter();

  useEffect(() => {
    fetch("/api/providers")
      .then((res) => res.json())
      .then((data: Provider[]) => {
        setProviders(data);
        // Default to first available provider (prefer exa)
        const firstAvailable = data.find((p) => p.available);
        if (firstAvailable) setSelectedProvider(firstAvailable.name);
      })
      .catch(() => {
        // Fallback if endpoint fails
        setProviders([
          { name: "exa", available: true },
          { name: "perplexity", available: false },
          { name: "tavily", available: false },
        ]);
      });
  }, []);

  async function handleRun() {
    setRunning(true);
    setStatus(`Running with ${PROVIDER_LABELS[selectedProvider]}...`);
    setError(null);

    try {
      const res = await fetch("/api/research/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: selectedProvider }),
      });
      const data = await res.json();

      if (data.success) {
        setStatus(
          `Complete! Found ${data.summary.missing_casinos} missing casinos, ` +
            `${data.summary.better_offers_found} better offers. ` +
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
      <div className="flex items-center gap-3">
        <select
          value={selectedProvider}
          onChange={(e) => setSelectedProvider(e.target.value)}
          disabled={running}
          className="px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {providers.map((p) => (
            <option key={p.name} value={p.name} disabled={!p.available}>
              {PROVIDER_LABELS[p.name]}{!p.available ? " (no API key)" : ""}
            </option>
          ))}
        </select>
        <button
          onClick={handleRun}
          disabled={running || !providers.some((p) => p.name === selectedProvider && p.available)}
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
              Running...
            </span>
          ) : (
            "Run Research"
          )}
        </button>
      </div>
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
