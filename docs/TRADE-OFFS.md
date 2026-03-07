# Trade-offs & Future Work

## Design Trade-offs

### Filesystem Storage vs Database
**Chose:** JSON files on disk
**Trade-off:** Reports don't persist across Vercel deployments (serverless filesystem is ephemeral). For a demo this is fine - reports regenerate on-demand. A production system would use Vercel KV, Supabase, or similar.
**Why:** Zero configuration, inspectable raw data, and the focus of this project is AI research quality, not data persistence.

### Per-Casino Queries vs Bulk Queries
**Chose:** Individual Perplexity query per casino for offer research
**Trade-off:** More API calls (~30 vs ~4), higher cost, longer runtime
**Why:** Bulk queries ("find offers for all NJ casinos") return shallow, incomplete results. Per-casino queries let Perplexity deeply search each casino's site and return comprehensive offer details.

### Sequential Pipeline vs Full Parallelism
**Chose:** Sequential stages with parallelism within each stage
**Trade-off:** Slower total runtime (1-3 minutes vs potentially faster)
**Why:** Each stage depends on the previous stage's output. Casino discovery must complete before we can research offers. Within each stage, queries run in parallel up to rate limits.

### Conservative Name Matching
**Chose:** Levenshtein distance <= 2, substring match, normalization
**Trade-off:** May produce false negatives (casinos that exist in both sources but don't match)
**Why:** False negatives show up as "missing casinos" - easy for a reviewer to spot and dismiss. False positives (incorrectly matching two different casinos) would silently corrupt comparison data. Conservative is safer.

### Sonar Pro vs Sonar
**Chose:** Sonar Pro for all research queries
**Trade-off:** ~3x cost per query
**Why:** Double citation density, better accuracy on structured data extraction, more reliable JSON schema adherence. The cost difference is marginal in absolute terms ($0.14 vs $0.05 for the discovery phase).

## Known Limitations

### Data Freshness
- Promotional offers change frequently (daily/weekly). Results are point-in-time snapshots.
- `search_recency_filter: "week"` helps but doesn't guarantee real-time accuracy.
- Some casinos update offers without updating their websites immediately.

### Casino Name Matching Accuracy
- The fuzzy matcher handles common variations but may miss unusual naming patterns.
- Brand changes, mergers, or white-label casinos may not match correctly.
- Manual review of the "missing casinos" list is expected.

### State Coverage
- Currently covers NJ, MI, PA, WV only (as specified).
- Adding states requires new gaming commission domain filters and prompts.

### AI Hallucination Risk
- Perplexity may occasionally return offers that don't exist or are outdated.
- Citations mitigate this - every claim is linked to a source URL for verification.
- Claude may misinterpret offer terms (e.g., confusing wagering requirements).
- Confidence scores flag uncertain comparisons for human review.

### Rate Limits
- Perplexity: 50 requests per minute. Batching at 5 concurrent requests stays well within this.
- With many casinos per state, a full run may take 1-3 minutes.

## What I'd Improve With More Time

### Accuracy
- **Cross-reference multiple sources** per casino instead of relying on a single Perplexity query
- **Add a verification step** where Claude checks discovered offers against the citation URLs
- **Historical tracking** to detect when offers actually changed vs research noise

### Architecture
- **Vercel KV or Supabase** for persistent storage across deployments
- **Streaming progress** via Server-Sent Events so the dashboard updates in real-time during a run
- **Webhook notifications** (Slack, email) when significant gaps are found
- **Diff reports** showing what changed since the last run

### Coverage
- **Expand to more states** as online gambling legislation evolves
- **Sportsbook offers** as a separate research track (currently excluded per spec)
- **Loyalty programs and VIP offers** beyond new player promotions

### UX
- **Export to CSV/PDF** for sharing with non-technical stakeholders
- **Filtering and sorting** by state, verdict, confidence, offer value
- **Email digest** of daily research findings
- **Offer value calculator** that normalizes different bonus structures for true comparison

### Cost Optimization
- **Cache casino lists** (licensed casinos don't change daily) and only refresh weekly
- **Skip unchanged casinos** by comparing against last run's results
- **Use Sonar (non-Pro)** for casino discovery where citation density matters less
