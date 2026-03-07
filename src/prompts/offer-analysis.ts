// Analysis prompts are embedded directly in src/lib/gemini.ts
// This file exists for organization and future prompt iteration.

export const ANALYSIS_GUIDELINES = `
When comparing casino promotional offers:

1. "Better" primarily means a larger bonus amount for the player
2. Consider the full picture: deposit requirements, wagering terms, and restrictions
3. A 100% match up to $1000 with 15x wagering is better than 100% up to $500 with 10x wagering (higher total value)
4. No-deposit bonuses are always noteworthy even if small
5. If data is incomplete for either side, note low confidence
6. Always explain WHY one offer is better, not just that it is

Verdict definitions:
- discovered_better: Found offer is genuinely superior (typically larger bonus)
- existing_better: Our current offer is already the best available
- comparable: Offers are similar in value, differences are minor
- different_type: Different promotion structure, needs manual review
- no_data: Insufficient data to compare (missing one or both sides)
`;
