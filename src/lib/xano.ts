import { XanoOffer } from "@/types";

const XANO_ENDPOINT =
  process.env.XANO_API_URL ??
  "https://xhks-nxia-vlqr.n7c.xano.io/api:1ZwRS-f0/activeSUB";

export async function fetchExistingOffers(): Promise<XanoOffer[]> {
  const response = await fetch(XANO_ENDPOINT, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Xano API error: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  return data as XanoOffer[];
}

