import { NextResponse } from "next/server";
import { requireCurrentPlayer } from "@/lib/auth";
import { submitMyMoves } from "@/lib/gameService";
import { handleRouteError } from "@/lib/http";

export const runtime = "nodejs";

export async function POST() {
  try {
    const { player } = await requireCurrentPlayer();

    if (player.role !== "player") {
      throw new Error("Only players can submit movements.");
    }

    const result = await submitMyMoves(player.id);
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
