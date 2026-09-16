import { NextResponse } from "next/server";
import { requireCurrentPlayer } from "@/lib/auth";
import { markEncounterInProgress } from "@/lib/gameService";
import { handleRouteError } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { player } = await requireCurrentPlayer();
    const { id } = await context.params;
    const encounter = await markEncounterInProgress(id, player.id, player.role);

    return NextResponse.json({ encounter });
  } catch (error) {
    return handleRouteError(error);
  }
}
