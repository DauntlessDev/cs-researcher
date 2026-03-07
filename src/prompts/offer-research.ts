export const OFFER_RESEARCH_SYSTEM_PROMPT =
  "You are a promotional offer researcher for online casinos. You find current, accurate promotional offers from official casino websites. Report only casino promotions, never sportsbook offers.";

export function buildOfferResearchPrompt(
  casinoName: string,
  state: string
): string {
  return `Research the current new player promotional offers for ${casinoName} online casino in ${state}. Find welcome bonuses, deposit matches, free play offers, and any other new player promotions. ONLY include casino promotions, NOT sportsbook offers. For each offer, provide the type, full description, deposit required, bonus amount, wagering requirements, and any promo code needed.`;
}

export const OFFER_RESEARCH_JSON_SCHEMA = {
  type: "object",
  properties: {
    offers: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            description:
              "Offer type (deposit_match, no_deposit_bonus, free_play, cashback, etc)",
          },
          description: {
            type: "string",
            description: "Full description of the offer",
          },
          deposit_required: {
            type: ["number", "null"],
            description: "Minimum deposit required in dollars, or null if none",
          },
          bonus_amount: {
            type: ["number", "null"],
            description:
              "Bonus amount in dollars, or null if variable/percentage-based",
          },
          wagering_requirement: {
            type: ["string", "null"],
            description: "Wagering requirement (e.g. 15x, 20x bonus), or null",
          },
          promo_code: {
            type: ["string", "null"],
            description: "Promo code if needed, or null",
          },
        },
        required: [
          "type",
          "description",
          "deposit_required",
          "bonus_amount",
          "wagering_requirement",
          "promo_code",
        ],
      },
    },
  },
  required: ["offers"],
};
