import { OfferComparison, DiscoveredCasino } from "@/types";

interface Props {
  comparisons: OfferComparison[];
  missingCasinos: DiscoveredCasino[];
}

const STATES = ["NJ", "MI", "PA", "WV"];

export default function CrossStateTable({ comparisons, missingCasinos }: Props) {
  // Build a map of casino -> state -> best offer amount
  const casinoMap = new Map<
    string,
    Map<string, { amount: number | null; description: string; type: string }>
  >();

  for (const comp of comparisons) {
    const name = comp.casino_name;
    if (!casinoMap.has(name)) casinoMap.set(name, new Map());
    const stateMap = casinoMap.get(name)!;

    const bestOffer = comp.discovered_offers.reduce(
      (best, o) => {
        if (o.bonus_amount != null && (best.amount == null || o.bonus_amount > best.amount)) {
          return { amount: o.bonus_amount, description: o.description, type: o.type };
        }
        return best;
      },
      { amount: null as number | null, description: "", type: "" }
    );

    // Use existing offer if no discovered offer has a bonus amount
    if (bestOffer.amount == null && comp.existing_offer) {
      stateMap.set(comp.state, {
        amount: comp.existing_offer.Expected_Bonus,
        description: comp.existing_offer.Offer_Name,
        type: comp.existing_offer.offer_type,
      });
    } else {
      stateMap.set(comp.state, bestOffer);
    }
  }

  // Add missing casinos with no offer data
  for (const casino of missingCasinos) {
    if (!casinoMap.has(casino.name)) casinoMap.set(casino.name, new Map());
    const stateMap = casinoMap.get(casino.name)!;
    if (!stateMap.has(casino.state)) {
      stateMap.set(casino.state, { amount: null, description: "Not tracked", type: "" });
    }
  }

  const sortedCasinos = [...casinoMap.entries()].sort(([a], [b]) => a.localeCompare(b));

  if (sortedCasinos.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-gray-500">
        No cross-state data available yet.
      </div>
    );
  }

  // Find the max offer per row to highlight
  function getRowMax(stateMap: Map<string, { amount: number | null }>): number | null {
    let max: number | null = null;
    for (const v of stateMap.values()) {
      if (v.amount != null && (max == null || v.amount > max)) max = v.amount;
    }
    return max;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left p-3 font-medium text-gray-600">Casino</th>
            {STATES.map((s) => (
              <th key={s} className="text-center p-3 font-medium text-gray-600">
                {s}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedCasinos.map(([name, stateMap]) => {
            const rowMax = getRowMax(stateMap);
            return (
              <tr key={name} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="p-3 font-medium text-gray-900">{name}</td>
                {STATES.map((state) => {
                  const data = stateMap.get(state);
                  if (!data || data.amount == null) {
                    return (
                      <td key={state} className="p-3 text-center text-gray-300">
                        -
                      </td>
                    );
                  }
                  const isBest = rowMax != null && data.amount === rowMax && rowMax > 0;
                  return (
                    <td
                      key={state}
                      className={`p-3 text-center ${isBest ? "font-bold text-green-700 bg-green-50" : "text-gray-700"}`}
                      title={data.description}
                    >
                      ${data.amount.toLocaleString()}
                      {data.type && (
                        <div className="text-xs text-gray-400">{data.type}</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
