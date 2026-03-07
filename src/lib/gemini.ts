import { GoogleGenerativeAI } from "@google/generative-ai";
import { OfferComparison, XanoOffer, DiscoveredOffer } from "@/types";

const getClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");
  return new GoogleGenerativeAI(apiKey);
};

// NOTE: Using free "gemini-2.0-flash" model.
// For production, consider "gemini-2.0-pro" for better accuracy.
const MODEL = "gemini-2.0-flash";

export async function extractStructuredData(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: systemPrompt,
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  const result = await model.generateContent(userPrompt);
  return result.response.text();
}

export async function analyzeOfferComparison(
  casinoName: string,
  state: string,
  existingOffer: XanoOffer | null,
  discoveredOffers: DiscoveredOffer[]
): Promise<OfferComparison> {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

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

  const result = await model.generateContent(prompt);
  const text = result.response.text();

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
