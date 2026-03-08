import { DiscoveredCasino } from "@/types";

export default function MissingCasinosTable({
  casinos,
}: {
  casinos: DiscoveredCasino[];
}) {
  const byState = casinos.reduce(
    (acc, c) => {
      if (!acc[c.state]) acc[c.state] = [];
      acc[c.state].push(c);
      return acc;
    },
    {} as Record<string, DiscoveredCasino[]>
  );

  if (casinos.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-8 text-center text-emerald-700 shadow-sm">
        No missing casinos found — our database covers all discovered operators.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(byState)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([state, stateCasinos]) => (
          <div key={state} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-800">{state}</h3>
              <span className="text-xs font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                {stateCasinos.length} missing
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Casino</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Operator</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Website</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wider">License</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {stateCasinos.map((casino, i) => (
                    <tr
                      key={i}
                      className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-gray-800">{casino.name}</td>
                      <td className="px-4 py-3 text-gray-500">{casino.operator}</td>
                      <td className="px-4 py-3">
                        {casino.website ? (
                          <a
                            href={casino.website.startsWith("http") ? casino.website : `https://${casino.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent hover:text-accent-light transition-colors"
                          >
                            {casino.website.replace(/^https?:\/\//, "")}
                          </a>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-emerald-50 text-emerald-600 font-medium">
                          {casino.license_status || "Active"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {casino.source_urls.slice(0, 2).map((url, j) => {
                          let hostname = url;
                          try { hostname = new URL(url).hostname; } catch { /* use raw url */ }
                          return (
                            <a
                              key={j}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:text-blue-600 text-xs block truncate max-w-[200px] transition-colors"
                            >
                              [{j + 1}] {hostname}
                            </a>
                          );
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
    </div>
  );
}
