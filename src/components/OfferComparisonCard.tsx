import { OfferComparison } from "@/types";

const VERDICT_CONFIG = {
  discovered_better: {
    label: "Better Offer Found",
    bg: "bg-amber-50",
    border: "border-amber-200",
    badge: "bg-amber-500 text-white",
  },
  existing_better: {
    label: "Our Offer is Better",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    badge: "bg-emerald-500 text-white",
  },
  comparable: {
    label: "Comparable",
    bg: "bg-white",
    border: "border-gray-200",
    badge: "bg-gray-500 text-white",
  },
  different_type: {
    label: "Different Type",
    bg: "bg-blue-50",
    border: "border-blue-200",
    badge: "bg-blue-500 text-white",
  },
  no_data: {
    label: "New Casino",
    bg: "bg-purple-50",
    border: "border-purple-200",
    badge: "bg-purple-500 text-white",
  },
};

function calculateEV(
  bonusAmount: number | null,
  wagering: string | null
): number | null {
  if (bonusAmount == null || !wagering) return null;
  const match = wagering.match(/(\d+)x/i);
  if (!match) return null;
  const multiplier = parseInt(match[1], 10);
  if (isNaN(multiplier) || multiplier <= 0) return null;
  return Math.round((bonusAmount / multiplier) * 100) / 100;
}

export default function OfferComparisonCard({
  comparison,
}: {
  comparison: OfferComparison;
}) {
  const config = VERDICT_CONFIG[comparison.verdict];

  return (
    <div className={`rounded-xl border ${config.border} ${config.bg} p-4 shadow-sm`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-bold text-gray-900">{comparison.casino_name}</h4>
          <span className="text-xs text-gray-400 font-medium">{comparison.state}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${config.badge}`}>
            {config.label}
          </span>
          <span className="text-xs text-gray-400 tabular-nums">
            {Math.round(comparison.confidence * 100)}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        {/* Current offer */}
        <div className="bg-white rounded-lg p-3 border border-gray-100">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Current Offer</div>
          {comparison.existing_offer ? (
            <>
              <div className="text-sm font-medium text-gray-800">
                {comparison.existing_offer.Offer_Name}
              </div>
              <div className="text-xs text-gray-500 mt-1 space-x-2">
                <span>{comparison.existing_offer.offer_type}</span>
                <span>Deposit: ${comparison.existing_offer.Expected_Deposit}</span>
                <span>Bonus: ${comparison.existing_offer.Expected_Bonus}</span>
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-300 italic">Not in database</div>
          )}
        </div>

        {/* Discovered offers */}
        <div className="bg-white rounded-lg p-3 border border-gray-100">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
            Discovered ({comparison.discovered_offers.length})
          </div>
          {comparison.discovered_offers.length > 0 ? (
            comparison.discovered_offers.slice(0, 2).map((offer, i) => (
              <div key={i} className={i > 0 ? "mt-2 pt-2 border-t border-gray-50" : ""}>
                <div className="text-sm font-medium text-gray-800">{offer.description}</div>
                <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-2">
                  <span>{offer.type}</span>
                  {offer.bonus_amount != null && <span>Bonus: ${offer.bonus_amount}</span>}
                  {offer.deposit_required != null && <span>Deposit: ${offer.deposit_required}</span>}
                  {offer.wagering_requirement && <span>Wagering: {offer.wagering_requirement}</span>}
                  {(() => {
                    const ev = calculateEV(offer.bonus_amount, offer.wagering_requirement);
                    return ev != null ? (
                      <span className="px-1.5 py-0.5 bg-dark-900 text-accent rounded text-xs font-bold">
                        EV: ${ev}
                      </span>
                    ) : null;
                  })()}
                </div>
                {offer.source_urls.length > 0 && (
                  <a
                    href={offer.source_urls[0]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-accent hover:text-accent-light mt-1 inline-block transition-colors"
                  >
                    Source
                  </a>
                )}
              </div>
            ))
          ) : (
            <div className="text-sm text-gray-300 italic">No offers found</div>
          )}
        </div>
      </div>

      <div className="text-sm text-gray-600">{comparison.explanation}</div>
      {comparison.recommended_action && (
        <div className="text-xs text-gray-400 mt-1.5">
          Action: {comparison.recommended_action}
        </div>
      )}
    </div>
  );
}
