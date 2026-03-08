"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  const abortControllerRef = useRef<AbortController | null>(null);
  const router = useRouter();

  // Cleanup in-flight request on unmount
  useEffect(() => {
    return () => { abortControllerRef.current?.abort(); };
  }, []);

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

  const handleRun = useCallback(async () => {
    setRunning(true);
    setLogs([]);
    setResult(null);
    setError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch("/api/research/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: selectedProvider, stream: true }),
        signal: controller.signal,
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
                `Found ${event.summary.missing_casinos} missing casinos, ` +
                  `${event.summary.better_offers_found} better offers. ` +
                  `Duration: ${Math.round(event.summary.duration_ms / 1000)}s.`
              );
              router.refresh();
            } else if (event.type === "error") {
              setError(event.error);
            }
          } catch (err) {
            if (!(err instanceof SyntaxError)) throw err;
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      abortControllerRef.current = null;
      setRunning(false);
    }
  }, [selectedProvider, router]);

  const latestLog = logs[logs.length - 1];
  const percent = latestLog?.percent ?? 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <select
          aria-label="Select search provider"
          value={selectedProvider}
          onChange={(e) => setSelectedProvider(e.target.value)}
          disabled={running}
          className="px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-sm text-gray-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
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
          className="px-6 py-2.5 bg-accent text-dark-900 rounded-lg font-semibold cursor-pointer hover:bg-accent-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {running ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Research progress"
          className="w-full bg-dark-700 rounded-full h-1.5"
        >
          <div
            className="bg-accent h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      {/* Live logs */}
      {logs.length > 0 && (
        <div aria-live="polite" className="bg-dark-800 rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-xs border border-dark-700">
          {logs.map((log, i) => (
            <div key={i} className="text-gray-400 leading-relaxed">
              <span className="text-dark-600">[{log.percent}%]</span>{" "}
              <span className="text-accent">{log.stage}</span>{" "}
              <span className="text-gray-400">{log.detail}</span>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      )}

      {/* Result */}
      {result && !error && (
        <div className="text-sm text-accent bg-accent/10 border border-accent/20 rounded-lg p-3">
          {result}
        </div>
      )}
      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          {error}
        </div>
      )}
    </div>
  );
}
