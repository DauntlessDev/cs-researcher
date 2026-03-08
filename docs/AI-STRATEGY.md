# AI Strategy

## Provider Architecture

The system supports 3 switchable search providers, selectable from the dashboard UI. Each provider handles both discovery and extraction differently:

| Provider | Search | Extraction | LLM Needed? | Calls per Run |
|----------|--------|-----------|-------------|---------------|
| **Exa Deep** (default) | Exa neural search | `outputSchema` — native structured JSON | No | 8 |
| **Perplexity Sonar** | Perplexity search | `response_format: json_schema` — native structured JSON | No | 4 |
| **Tavily + Groq** | Tavily web search | Groq LLM (Llama 3.3 70B) | Yes (extraction only) | 8 |

Providers without an API key are automatically disabled in the UI dropdown.

## Exa Deep — Default Provider

### How It Works

Exa Deep runs **2 parallel searches per state** (8 total for 4 states):

1. **Casino Discovery Search** — finds licensed online casinos with operator, website, and license status
2. **Offer Research Search** — finds current promotional offers with bonus amounts, wagering requirements, and promo codes

Both use Exa's `outputSchema` parameter for native structured JSON output — no separate LLM extraction step needed.

### Schema Design

Exa Deep enforces a max nesting depth of 2 and max 10 properties per level. To work within these constraints, we use two flat schemas instead of one nested schema:

**Casino Schema** (`EXA_CASINO_SCHEMA`):
```json
{
  "type": "object",
  "properties": {
    "casinos": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "operator": { "type": "string" },
          "website": { "type": "string" },
          "license_status": { "type": "string" }
        }
      }
    }
  }
}
```

**Offer Schema** (`EXA_OFFERS_SCHEMA`):
```json
{
  "type": "object",
  "properties": {
    "offers": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "casino_name": { "type": "string" },
          "offer_type": { "type": "string" },
          "description": { "type": "string" },
          "bonus_amount": { "type": "number" },
          "wagering_requirement": { "type": "number" },
          "source_url": { "type": "string" }
        }
      }
    }
  }
}
```

Results from both searches are merged by fuzzy-matching `casino_name` from offers to casino names from discovery.

### Why Exa Deep as Default

- Native structured output eliminates the LLM extraction step entirely
- Neural search finds results by meaning, not just keywords
- Returns comprehensive data from full page content
- 2 calls per state = 8 total for all 4 states
- Cost: ~$0.012/call = ~$0.10 per full run

## Perplexity Sonar — Lean Alternative

### How It Works

Perplexity runs **1 search per state** (4 total). Each call uses `response_format: { type: "json_schema" }` to get structured output directly — search + extraction in a single API call.

The schema is more detailed than Exa's (no depth limit) and includes both casinos and their offers in one response using `CASINO_FULL_SCHEMA`.

### Why Perplexity

- Fewest API calls (4 total)
- Search + structured extraction in one call
- No depth limits on JSON schema
- Good for when you want the leanest possible pipeline

## Tavily + Groq — Fallback Provider

### How It Works

Tavily handles the web search, and Groq (Llama 3.3 70B) handles structured data extraction:

1. **Tavily search** per state — returns raw web content
2. **Groq LLM call** per state — extracts structured casino/offer data from search results

States run **sequentially** (not in parallel) to respect Groq's free tier rate limits (6000 tokens/min).

### Why Tavily + Groq

- Both have generous free tiers
- Tavily's `include_raw_content` provides rich data for extraction
- Groq is extremely fast (inference on dedicated hardware)
- Good fallback when Exa/Perplexity keys aren't available

## Smart Comparison Engine

### Programmatic First

Most offer comparisons don't need an LLM. The system resolves clear cases programmatically:

| Condition | Verdict | Example |
|-----------|---------|---------|
| Discovered bonus > current by >25% | `discovered_better` | $1500 vs $1000 |
| Current bonus > discovered by >25% | `existing_better` | $1000 vs $500 |
| Both within 25% | `comparable` | $1000 vs $900 |
| Different offer types | `different_type` | Deposit match vs free play |
| No data on either side | `no_data` | Missing bonus amounts |

### Batched LLM for Ambiguous Cases

Only genuinely ambiguous comparisons go to an LLM — all in a **single batched call**:

- Close bonus amounts with different wagering requirements
- Complex multi-part offers
- Cases where programmatic comparison can't determine a clear winner

The LLM (Groq or Perplexity, depending on available keys) receives all ambiguous cases at once and returns verdicts for each. Typical result: 25-30 resolved programmatically, 0-5 via LLM.

### Verdict Categories

| Verdict | Meaning | Color |
|---------|---------|-------|
| `discovered_better` | Found offer is genuinely superior | Amber |
| `existing_better` | Our current offer is already best | Green |
| `comparable` | Offers are similar in value | Gray |
| `different_type` | Different promotion structure | Blue |
| `no_data` | Insufficient data to compare | Gray |

## Cost Comparison

| Pipeline | API Calls | Cost per Run |
|----------|-----------|-------------|
| Old (Exa + Tavily + OpenRouter) | ~90 | ~$0.35-2.00 |
| **Current — Exa Deep** | 8 + 0-1 LLM | **~$0.10** |
| Current — Perplexity Sonar | 4 + 0-1 LLM | ~$0.08 |
| Current — Tavily + Groq | 8 | ~$0.02 (free tiers) |

## Citation Strategy

Every finding links back to its source:
- Exa returns source URLs with each search result
- Perplexity returns citation URLs with each response
- Tavily provides source URLs per result
- Citations are stored alongside each discovered casino and offer
- The dashboard displays source links next to every claim for human verification
