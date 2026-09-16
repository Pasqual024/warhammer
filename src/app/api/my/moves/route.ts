import { NextResponse } from "next/server";
import { requireCurrentPlayer } from "@/lib/auth";
import { getMyMovesState } from "@/lib/gameService";
import { handleRouteError } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { player } = await requireCurrentPlayer();
    const moves = await getMyMovesState(player.id);

    return NextResponse.json({ moves });
  } catch (error) {
    return handleRouteError(error);
  }
}
