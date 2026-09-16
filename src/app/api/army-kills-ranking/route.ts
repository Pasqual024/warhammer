import { NextResponse } from "next/server";
import { requireCurrentPlayer } from "@/lib/auth";
import { handleRouteError } from "@/lib/http";
import { getPublicKillsRanking } from "@/lib/profileTabsService";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireCurrentPlayer();
    const ranking = await getPublicKillsRanking();

    return NextResponse.json({ ranking });
  } catch (error) {
    return handleRouteError(error);
  }
}
