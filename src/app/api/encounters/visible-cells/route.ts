import { NextResponse } from "next/server";
import { requireCurrentPlayer } from "@/lib/auth";
import { getVisibleEncounterCells } from "@/lib/gameService";
import { handleRouteError } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { player } = await requireCurrentPlayer();
    const result = await getVisibleEncounterCells(player.id);

    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
