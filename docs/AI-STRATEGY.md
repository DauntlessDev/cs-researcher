# AI Strategy

## Models Used

| Model | Provider | Role | Why This Model |
|-------|----------|------|----------------|
| Sonar Pro | Perplexity | Casino discovery, offer research | Purpose-built for web research with citations |
| Claude Sonnet | Anthropic | Offer comparison and analysis | Strong analytical reasoning with structured output |

## Perplexity Sonar Pro - Research Layer

### Casino Discovery

**Goal:** Identify all licensed online casinos in NJ, MI, PA, and WV.

**Approach:**
- System prompt establishes the role: regulatory research assistant for US online gambling
- User prompt asks for licensed online casinos in a specific state
- `search_domain_filter` targets authoritative sources per state:
  - NJ: `njdge.org`, `nj.gov`
  - MI: `michigan.gov`
  - PA: `gamingcontrolboard.pa.gov`
  - WV: `wvlottery.com`
- `response_format` enforces JSON schema: `{ casinos: [{ name, operator, website, license_status }] }`
- 4 queries run in parallel (one per state)

**Why domain filtering matters:** Without it, Perplexity may return affiliate sites, review blogs, or outdated lists. Gaming commission sites are the authoritative source for licensed operators.

### Offer Research

**Goal:** Find current promotional offers for each casino.

**Approach:**
- One query per casino, asking for current new player promotional offers
- Explicit instruction: "ONLY casino promotions, NOT sportsbook"
- `search_domain_filter` targets the casino's official website
- `search_recency_filter: "week"` ensures current offers
- JSON schema: `{ offers: [{ type, description, deposit_required, bonus_amount, wagering_req, code, source_url }] }`
- Batched 5 at a time to respect 50 RPM rate limit

**Why per-casino queries:** A single "find all offers for all casinos" query produces shallow, unreliable results. Individual queries let Perplexity deeply search each casino's site.

### Prompt Engineering Rules

Following Perplexity's best practices:
- **System prompt = role/style only.** It does not trigger web search.
- **User prompt = actual query.** This is what triggers the search.
- **No few-shot examples.** These confuse Perplexity's search mechanism.
- **JSON schema on first request has 10-30s compilation delay.** Accounted for in timeout handling.

## Claude Sonnet - Analysis Layer

### Offer Comparison

**Goal:** Determine if discovered offers are genuinely better than our existing ones.

**Approach:**
- Receives structured data: our current offer (from Xano) + discovered offers (from Perplexity)
- Uses `tool_use` pattern for reliable structured output
- Returns per-casino verdict:

```json
{
  "match_status": "matched",
  "verdict": "discovered_better",
  "confidence": 0.85,
  "explanation": "Discovered offer has $500 deposit match vs current $200...",
  "recommended_action": "Update offer to reflect $500 deposit match"
}
```

**Why Claude for this step:**
- This is pure analysis, not research - no web access needed
- Claude excels at nuanced comparison ("is 100% up to $500 with 15x wagering better than 50% up to $1000 with 25x wagering?")
- Structured output via tool_use is more reliable than asking a search model to also reason

### Verdict Categories

| Verdict | Meaning |
|---------|---------|
| `discovered_better` | Found offer is genuinely superior (typically larger bonus) |
| `existing_better` | Our current offer is already the best available |
| `comparable` | Offers are similar in value, differences are minor |
| `different_type` | Different promotion structure, manual review recommended |

### Confidence Scoring

Claude assigns a confidence score (0-1) based on:
- Data completeness (do we have full terms for both offers?)
- Source reliability (official site vs third-party?)
- Recency (how fresh is the discovered offer?)

Low-confidence comparisons are flagged for human review in the dashboard.

## Citation Strategy

Every finding in the report links back to its source:
- Perplexity returns citation URLs with each response
- Citations are stored alongside each discovered casino and offer
- The dashboard displays source links next to every claim
- This makes findings verifiable and builds trust in the AI research

## Cost Management

### Per-Run Breakdown
- **Casino discovery:** 4 Perplexity queries (one per state)
- **Offer research:** ~30 Perplexity queries (one per casino, across all states)
- **Offer analysis:** ~30 Claude calls (one per casino comparison)
- **Total:** ~$0.35-$2.00 per full research run

### Cost Tracking
Each report records:
- Number of API calls made (Perplexity + Claude)
- Estimated cost based on token usage
- Total research duration
- Displayed in the report footer for full transparency
