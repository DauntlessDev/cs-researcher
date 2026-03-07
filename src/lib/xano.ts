import { XanoOffer } from "@/types";

const XANO_ENDPOINT =
  "https://xhks-nxia-vlqr.n7c.xano.io/api:1ZwRS-f0/activeSUB";

export async function fetchExistingOffers(): Promise<XanoOffer[]> {
  const response = await fetch(XANO_ENDPOINT, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Xano API error: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  return data as XanoOffer[];
}

export function groupOffersByState(
  offers: XanoOffer[]
): Record<string, XanoOffer[]> {
  const grouped: Record<string, XanoOffer[]> = {};
  for (const offer of offers) {
    const state = offer.state?.toUpperCase() || "UNKNOWN";
    if (!grouped[state]) grouped[state] = [];
    grouped[state].push(offer);
  }
  return grouped;
}
