"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type Provider = { name: "exa" | "perplexity" | "tavily"; available: boolean };

const PROVIDER_LABELS: Record<string, string> = {
  exa: "Exa Deep",
  perplexity: "Perplexity Sonar",
  tavily: "Tavily + Groq",
};

interface LogEntry {
  stage: string;
  detail: string;
  percent: number;
  timestamp: number;
}

export default function RunButton() {
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>("exa");
  const logsEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/providers")
      .then((res) => res.json())
      .then((data: Provider[]) => {
        setProviders(data);
        const firstAvailable = data.find((p) => p.available);
        if (firstAvailable) setSelectedProvider(firstAvailable.name);
      })
      .catch(() => {
        setProviders([
          { name: "exa", available: true },
          { name: "perplexity", available: false },
          { name: "tavily", available: false },
        ]);
      });
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  async function handleRun() {
    setRunning(true);
    setLogs([]);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/research/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: selectedProvider, stream: true }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({ error: "Request failed" }));
        setError(data.error || `HTTP ${res.status}`);
        setRunning(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === "progress") {
              setLogs((prev) => [
                ...prev,
                {
                  stage: event.stage,
                  detail: event.detail,
                  percent: event.percent,
                  timestamp: Date.now(),
                },
              ]);
            } else if (event.type === "done") {
              setResult(
                `Complete! Found ${event.summary.missing_casinos} missing casinos, ` +
                  `${event.summary.better_offers_found} better offers. ` +
                  `Duration: ${Math.round(event.summary.duration_ms / 1000)}s.`
              );
              router.refresh();
            } else if (event.type === "error") {
              setError(event.error);
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setRunning(false);
    }
  }

  const latestLog = logs[logs.length - 1];
  const percent = latestLog?.percent ?? 0;

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
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Running...
            </span>
          ) : (
            "Run Research"
          )}
        </button>
      </div>

      {/* Progress bar */}
      {running && (
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      {/* Live logs */}
      {logs.length > 0 && (
        <div className="bg-gray-900 rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-xs">
          {logs.map((log, i) => (
            <div key={i} className="text-gray-300 leading-relaxed">
              <span className="text-gray-500">[{log.percent}%]</span>{" "}
              <span className="text-blue-400">{log.stage}</span>{" "}
              <span className="text-gray-300">{log.detail}</span>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      )}

      {/* Result */}
      {result && !error && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
          {result}
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
