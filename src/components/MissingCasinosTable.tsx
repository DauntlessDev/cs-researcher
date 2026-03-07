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
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center text-green-700">
        No missing casinos found - our database covers all discovered operators.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(byState)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([state, stateCasinos]) => (
          <div key={state}>
            <h3 className="text-lg font-semibold mb-3 text-gray-800">
              {state}{" "}
              <span className="text-sm font-normal text-red-600">
                ({stateCasinos.length} missing)
              </span>
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left p-3 font-medium text-gray-600">Casino</th>
                    <th className="text-left p-3 font-medium text-gray-600">Operator</th>
                    <th className="text-left p-3 font-medium text-gray-600">Website</th>
                    <th className="text-left p-3 font-medium text-gray-600">License</th>
                    <th className="text-left p-3 font-medium text-gray-600">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {stateCasinos.map((casino, i) => (
                    <tr
                      key={i}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="p-3 font-medium">{casino.name}</td>
                      <td className="p-3 text-gray-600">{casino.operator}</td>
                      <td className="p-3">
                        {casino.website ? (
                          <a
                            href={casino.website.startsWith("http") ? casino.website : `https://${casino.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {casino.website.replace(/^https?:\/\//, "")}
                          </a>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
                          {casino.license_status || "Active"}
                        </span>
                      </td>
                      <td className="p-3">
                        {casino.source_urls.slice(0, 2).map((url, j) => {
                          let hostname = url;
                          try { hostname = new URL(url).hostname; } catch { /* use raw url */ }
                          return (
                            <a
                              key={j}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:underline text-xs block truncate max-w-[200px]"
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
