import { OfferComparison } from "@/types";

const VERDICT_CONFIG = {
  discovered_better: {
    label: "Better Offer Found",
    bg: "bg-amber-50",
    border: "border-amber-300",
    badge: "bg-amber-100 text-amber-800",
  },
  existing_better: {
    label: "Our Offer is Better",
    bg: "bg-green-50",
    border: "border-green-300",
    badge: "bg-green-100 text-green-800",
  },
  comparable: {
    label: "Comparable",
    bg: "bg-gray-50",
    border: "border-gray-300",
    badge: "bg-gray-100 text-gray-700",
  },
  different_type: {
    label: "Different Type",
    bg: "bg-blue-50",
    border: "border-blue-300",
    badge: "bg-blue-100 text-blue-800",
  },
  no_data: {
    label: "New Casino",
    bg: "bg-purple-50",
    border: "border-purple-300",
    badge: "bg-purple-100 text-purple-800",
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
  if (multiplier <= 0) return null;
  // Simplified EV: bonus / wagering multiplier (higher = better)
  return Math.round((bonusAmount / multiplier) * 100) / 100;
}

export default function OfferComparisonCard({
  comparison,
}: {
  comparison: OfferComparison;
}) {
  const config = VERDICT_CONFIG[comparison.verdict];

  return (
    <div className={`rounded-lg border ${config.border} ${config.bg} p-4`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-semibold text-gray-900">{comparison.casino_name}</h4>
          <span className="text-xs text-gray-500">{comparison.state}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.badge}`}>
            {config.label}
          </span>
          <span className="text-xs text-gray-400">
            {Math.round(comparison.confidence * 100)}% conf
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        {/* Current offer */}
        <div className="bg-white/70 rounded p-3">
          <div className="text-xs font-medium text-gray-500 mb-1">Current Offer</div>
          {comparison.existing_offer ? (
            <>
              <div className="text-sm font-medium">
                {comparison.existing_offer.Offer_Name}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                Type: {comparison.existing_offer.offer_type} | Deposit: $
                {comparison.existing_offer.Expected_Deposit} | Bonus: $
                {comparison.existing_offer.Expected_Bonus}
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-400 italic">Not in database</div>
          )}
        </div>

        {/* Discovered offers */}
        <div className="bg-white/70 rounded p-3">
          <div className="text-xs font-medium text-gray-500 mb-1">
            Discovered ({comparison.discovered_offers.length})
          </div>
          {comparison.discovered_offers.length > 0 ? (
            comparison.discovered_offers.slice(0, 2).map((offer, i) => (
              <div key={i} className={i > 0 ? "mt-2 pt-2 border-t border-gray-100" : ""}>
                <div className="text-sm font-medium">{offer.description}</div>
                <div className="text-xs text-gray-600 mt-1">
                  {offer.type}
                  {offer.bonus_amount != null && ` | Bonus: $${offer.bonus_amount}`}
                  {offer.deposit_required != null && ` | Deposit: $${offer.deposit_required}`}
                  {offer.wagering_requirement && ` | Wagering: ${offer.wagering_requirement}`}
                  {(() => {
                    const ev = calculateEV(offer.bonus_amount, offer.wagering_requirement);
                    return ev != null ? (
                      <span className="ml-1 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
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
                    className="text-xs text-blue-500 hover:underline"
                  >
                    Source
                  </a>
                )}
              </div>
            ))
          ) : (
            <div className="text-sm text-gray-400 italic">No offers found</div>
          )}
        </div>
      </div>

      <div className="text-sm text-gray-700">{comparison.explanation}</div>
      {comparison.recommended_action && (
        <div className="text-xs text-gray-500 mt-2">
          Action: {comparison.recommended_action}
        </div>
      )}
    </div>
  );
}
