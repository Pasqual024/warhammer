import { NextResponse } from "next/server";
import { requireCurrentPlayer } from "@/lib/auth";
import { extractMoveToggleInput } from "@/lib/authorization";
import { toggleMyMove } from "@/lib/gameService";
import { handleRouteError, readJsonObject } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { player } = await requireCurrentPlayer();
    const body = await readJsonObject(request);
    const input = extractMoveToggleInput(body);
    const moves = await toggleMyMove(player.id, input.cellId);

    return NextResponse.json({ moves });
  } catch (error) {
    return handleRouteError(error);
  }
}
