import { OfferComparison, XanoOffer, DiscoveredOffer } from "@/types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct:free";

// Rate limiting for free tier
let lastCallTime = 0;
const MIN_DELAY_MS = 2000;

async function rateLimit() {
  const now = Date.now();
  const elapsed = now - lastCallTime;
  if (elapsed < MIN_DELAY_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_DELAY_MS - elapsed));
  }
  lastCallTime = Date.now();
}

async function chatCompletion(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  await rateLimit();

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "{}";
}

export async function extractStructuredData(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  return chatCompletion(systemPrompt, userPrompt);
}

export async function analyzeOfferComparison(
  casinoName: string,
  state: string,
  existingOffer: XanoOffer | null,
  discoveredOffers: DiscoveredOffer[]
): Promise<OfferComparison> {
  const existingDesc = existingOffer
    ? `Current offer: "${existingOffer.Offer_Name}" - Type: ${existingOffer.offer_type}, Deposit: $${existingOffer.Expected_Deposit}, Bonus: $${existingOffer.Expected_Bonus}`
    : "No existing offer in our database.";

  const discoveredDesc =
    discoveredOffers.length > 0
      ? discoveredOffers
          .map(
            (o, i) =>
              `Discovered offer ${i + 1}: "${o.description}" - Type: ${o.type}, Deposit: $${o.deposit_required ?? "N/A"}, Bonus: $${o.bonus_amount ?? "N/A"}, Wagering: ${o.wagering_requirement ?? "N/A"}, Source: ${o.source_urls.join(", ")}`
          )
          .join("\n")
      : "No offers discovered from research.";

  const prompt = `Compare casino promotional offers for ${casinoName} in ${state}.

${existingDesc}

${discoveredDesc}

Determine if discovered offers are genuinely better than what we currently have. "Better" typically means a larger bonus amount, but also consider deposit requirements and wagering terms. If we have no existing offer, verdict should be "no_data" unless discovered offers exist, in which case note them as new findings.

Respond with a JSON object with these exact fields:
- "verdict": one of "discovered_better", "existing_better", "comparable", "different_type", "no_data"
- "confidence": number between 0 and 1
- "explanation": brief explanation of the comparison result and key differences
- "recommended_action": what action to take based on findings`;

  const text = await chatCompletion(
    "You are a casino promotions analyst. Always respond with valid JSON.",
    prompt
  );

  let input: Record<string, unknown>;
  try {
    input = JSON.parse(text);
  } catch {
    input = {
      verdict: "no_data",
      confidence: 0,
      explanation: "Analysis failed - could not parse response",
      recommended_action: "Manual review required",
    };
  }

  return {
    casino_name: casinoName,
    state,
    existing_offer: existingOffer,
    discovered_offers: discoveredOffers,
    verdict: input.verdict as OfferComparison["verdict"],
    confidence: input.confidence as number,
    explanation: input.explanation as string,
    recommended_action: input.recommended_action as string,
  };
}
