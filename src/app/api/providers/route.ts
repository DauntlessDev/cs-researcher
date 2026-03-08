import { NextResponse } from "next/server";
import { getAvailableProviders } from "@/lib/search-provider";

export async function GET() {
  return NextResponse.json(getAvailableProviders());
}
