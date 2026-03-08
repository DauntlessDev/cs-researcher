import { XanoOffer, DiscoveredCasino, MatchResult } from "@/types";

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/\bcasino\b/gi, "")
    .replace(/\bonline\b/gi, "")
    .replace(/\b(nj|mi|pa|wv)\b/gi, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length,
    n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[m][n];
}

function isSameCasino(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Require minimum 3 chars for substring match to avoid false positives (e.g. "bet" matching "betmgm")
  const minLen = Math.min(na.length, nb.length);
  if (minLen >= 3 && (na.includes(nb) || nb.includes(na))) return true;
  if (levenshtein(na, nb) <= 2) return true;
  return false;
}

export function matchCasinos(
  existingOffers: XanoOffer[],
  discoveredCasinos: DiscoveredCasino[],
  state: string
): MatchResult {
  const stateOffers = existingOffers.filter(
    (o) => o.state?.Abbreviation?.toUpperCase() === state.toUpperCase()
  );

  const matched: MatchResult["matched"] = [];
  const missing: DiscoveredCasino[] = [];

  for (const discovered of discoveredCasinos) {
    const match = stateOffers.find((existing) =>
      isSameCasino(existing.Name, discovered.name)
    );
    if (match) {
      matched.push({ existing: match, discovered });
    } else {
      missing.push(discovered);
    }
  }

  return { missing, matched };
}
