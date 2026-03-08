"use client";

import { useMemo } from "react";
import { OfferComparison, DiscoveredCasino, STATES } from "@/types";

interface Props {
  comparisons: OfferComparison[];
  missingCasinos: DiscoveredCasino[];
}

export default function CrossStateTable({ comparisons, missingCasinos }: Props) {
  const sortedCasinos = useMemo(() => {
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

    for (const casino of missingCasinos) {
      if (!casinoMap.has(casino.name)) casinoMap.set(casino.name, new Map());
      const stateMap = casinoMap.get(casino.name)!;
      if (!stateMap.has(casino.state)) {
        stateMap.set(casino.state, { amount: null, description: "Not tracked", type: "" });
      }
    }

    return [...casinoMap.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [comparisons, missingCasinos]);

  if (sortedCasinos.length === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-gray-400 shadow-sm">
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
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th scope="col" className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Casino</th>
              {STATES.map((s) => (
                <th key={s.code} scope="col" className="text-center px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  {s.code}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedCasinos.map(([name, stateMap]) => {
              const rowMax = getRowMax(stateMap);
              return (
                <tr key={name} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">{name}</td>
                  {STATES.map(({ code: state }) => {
                    const data = stateMap.get(state);
                    if (!data || data.amount == null) {
                      return (
                        <td key={state} className="px-4 py-3 text-center text-gray-300">
                          —
                        </td>
                      );
                    }
                    const isBest = rowMax != null && data.amount === rowMax && rowMax > 0;
                    return (
                      <td
                        key={state}
                        className={`px-4 py-3 text-center ${isBest ? "font-bold text-emerald-600" : "text-gray-600"}`}
                        title={data.description}
                      >
                        <span className={isBest ? "px-2 py-0.5 bg-emerald-50 rounded-md" : ""}>
                          ${data.amount.toLocaleString()}
                        </span>
                        {data.type && (
                          <div className="text-xs text-gray-400 mt-0.5">{data.type}</div>
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
    </div>
  );
}
